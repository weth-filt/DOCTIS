const AIConversation = require("../models/AIConversation");
const AIMessage = require("../models/AIMessage");
const AIAttachment = require("../models/AIAttachment");
const { chatAI } = require("../services/aiService");
const { loadPatientContext, isValidPatientId } = require("../services/aiPatientContext");
const { consumeAIMessage } = require("../services/aiRateLimit");
const { normalizeAttachments, serializeAttachment } = require("../services/aiAttachments");

const DEFAULT_TITLE = "Cuộc trò chuyện mới";
const MAX_HISTORY_BYTES = 6 * 1024 * 1024;
const REQUEST_LEASE_MS = 180000;

function fail(code, message, status = 400) {
  const error = new Error(message);
  Object.assign(error, { code, status });
  return error;
}
function safeError(error) {
  const code = typeof error?.code === "string" && error.code.startsWith("AI_") ? error.code : "AI_UNAVAILABLE";
  const status = error?.status || (code === "AI_RATE_LIMITED" ? 429 : ["AI_NOT_CONFIGURED", "AI_CONTEXT_UNAVAILABLE"].includes(code) ? 503 : ["AI_EMPTY_MESSAGE", "AI_MESSAGE_TOO_LONG"].includes(code) ? 400 : 502);
  return { code, status, msg: code === "AI_UNAVAILABLE" ? "Chưa thể xử lý cuộc trò chuyện AI. Vui lòng thử lại sau." : error.message };
}
function sendError(res, error, extra = {}) {
  const { code, status, msg } = safeError(error);
  const retryAfterSeconds = error?.retryAfterSeconds;
  if (retryAfterSeconds && typeof res.set === "function") res.set("Retry-After", String(retryAfterSeconds));
  return res.status(status).json({ code, msg, ...(retryAfterSeconds ? { retryAfterSeconds } : {}), ...extra });
}
function dateString(value) { return value ? new Date(value).toISOString() : null; }
function serializeConversation(value) {
  return { id: String(value._id), title: value.title, createdAt: dateString(value.createdAt), updatedAt: dateString(value.updatedAt), lastMessageAt: dateString(value.lastMessageAt) };
}
function serializeMessage(value, attachments = []) {
  return { id: String(value._id), role: value.role, content: value.content || "", status: value.status, requestId: value.requestId, attachments: attachments.map(serializeAttachment), createdAt: dateString(value.createdAt), provider: value.provider || "", errorCode: value.errorCode || "", errorMessage: value.errorMessage || "" };
}
function conversationCursor(value) {
  return Buffer.from(JSON.stringify({ at: dateString(value.updatedAt), id: String(value._id) })).toString("base64url");
}
function parseConversationCursor(value) {
  try {
    if (typeof value !== "string" || value.length > 200 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!isValidPatientId(parsed.id) || typeof parsed.at !== "string" || !Number.isFinite(Date.parse(parsed.at))) throw new Error();
    return { at: new Date(parsed.at), id: parsed.id };
  } catch { throw fail("AI_INVALID_CURSOR", "Mốc danh sách hội thoại không hợp lệ."); }
}

function createConversationController({ Conversation = AIConversation, Message = AIMessage, Attachment = AIAttachment, generate = chatAI, contextLoader = loadPatientContext, consumeRate = consumeAIMessage, now = () => new Date() } = {}) {
  const userFrom = req => {
    if (!req.user?.id) throw fail("AI_UNAUTHORIZED", "Vui lòng đăng nhập để sử dụng trợ lý AI.", 401);
    if (!isValidPatientId(req.user.id)) throw fail("AI_INVALID_USER", "Không xác định được tài khoản hợp lệ.");
    return req.user.id;
  };
  const conversationFrom = async (req, userId) => {
    const id = req.params?.conversationId;
    if (!isValidPatientId(id)) throw fail("AI_CONVERSATION_NOT_FOUND", "Không tìm thấy cuộc trò chuyện.", 404);
    const value = await Conversation.findOne({ _id: id, userId, deletedAt: null }).lean().exec();
    if (!value) throw fail("AI_CONVERSATION_NOT_FOUND", "Không tìm thấy cuộc trò chuyện.", 404);
    return value;
  };
  const filesFor = async (userId, conversationId, messageIds, withData = false) => {
    if (!messageIds.length) return [];
    const query = Attachment.find({ userId, conversationId, messageId: { $in: messageIds } });
    if (withData) query.select("+data");
    return query.lean().exec();
  };
  const messagePage = async (req, userId, conversationId) => {
    const limit = Math.max(1, Math.min(50, Number.parseInt(req.query?.limit, 10) || 40));
    const before = req.query?.before;
    if (before && !isValidPatientId(before)) throw fail("AI_INVALID_CURSOR", "Mốc lịch sử không hợp lệ.");
    const found = await Message.find({ userId, conversationId, ...(before ? { _id: { $lt: before } } : {}) }).sort({ _id: -1 }).limit(limit + 1).lean().exec();
    const hasMore = found.length > limit;
    const messages = found.slice(0, limit).reverse();
    const files = await filesFor(userId, conversationId, messages.map(value => value._id));
    return { messages: messages.map(value => serializeMessage(value, files.filter(file => String(file.messageId) === String(value._id)))), hasMore, nextCursor: hasMore && messages.length ? String(messages[0]._id) : null };
  };
  const wrap = handler => async (req, res) => { try { return await handler(req, res); } catch (error) { return sendError(res, error); } };

  const list = wrap(async (req, res) => {
    const userId = userFrom(req);
    const limit = Math.max(1, Math.min(50, Number.parseInt(req.query?.limit, 10) || 50));
    const before = req.query?.before ? parseConversationCursor(req.query.before) : null;
    const values = await Conversation.find({ userId, deletedAt: null, ...(before ? { $or: [{ updatedAt: { $lt: before.at } }, { updatedAt: before.at, _id: { $lt: before.id } }] } : {}) }).sort({ updatedAt: -1, _id: -1 }).limit(limit + 1).lean().exec();
    const hasMore = values.length > limit;
    const page = values.slice(0, limit);
    return res.json({ conversations: page.map(serializeConversation), hasMore, nextCursor: hasMore ? conversationCursor(page.at(-1)) : null });
  });
  const create = wrap(async (req, res) => {
    const userId = userFrom(req);
    const title = req.body?.title === undefined ? DEFAULT_TITLE : normalizeTitle(req.body.title);
    const conversation = await Conversation.create({ userId, title });
    return res.status(201).json({ conversation: serializeConversation(conversation) });
  });
  const get = wrap(async (req, res) => {
    const userId = userFrom(req);
    const conversation = await conversationFrom(req, userId);
    return res.json({ conversation: serializeConversation(conversation), ...await messagePage(req, userId, conversation._id) });
  });
  const messages = wrap(async (req, res) => {
    const userId = userFrom(req);
    const conversation = await conversationFrom(req, userId);
    return res.json(await messagePage(req, userId, conversation._id));
  });
  const rename = wrap(async (req, res) => {
    const userId = userFrom(req);
    const conversation = await conversationFrom(req, userId);
    const title = normalizeTitle(req.body?.title);
    const updated = await Conversation.findOneAndUpdate({ _id: conversation._id, userId, deletedAt: null }, { $set: { title } }, { new: true }).lean().exec();
    if (!updated) throw fail("AI_CONVERSATION_NOT_FOUND", "Không tìm thấy cuộc trò chuyện.", 404);
    return res.json({ conversation: serializeConversation(updated) });
  });
  const remove = wrap(async (req, res) => {
    const userId = userFrom(req);
    const conversation = await conversationFrom(req, userId);
    await Conversation.updateOne({ _id: conversation._id, userId }, { $set: { deletedAt: now(), activeRequestId: null, activeRequestAt: null } });
    await Promise.all([Message.deleteMany({ userId, conversationId: conversation._id }), Attachment.deleteMany({ userId, conversationId: conversation._id })]);
    return res.json({ success: true });
  });
  const content = wrap(async (req, res) => {
    const userId = userFrom(req);
    if (!isValidPatientId(req.params?.attachmentId)) throw fail("AI_ATTACHMENT_NOT_FOUND", "Không tìm thấy tệp đính kèm.", 404);
    const file = await Attachment.findOne({ _id: req.params.attachmentId, userId }).select("+data").lean().exec();
    if (!file || !await Conversation.exists({ _id: file.conversationId, userId, deletedAt: null })) throw fail("AI_ATTACHMENT_NOT_FOUND", "Không tìm thấy tệp đính kèm.", 404);
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data?.buffer || []);
    const disposition = file.mimeType.startsWith("image/") ? "inline" : "attachment";
    res.set({ "Content-Type": file.mimeType, "Content-Length": String(data.length), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": `${disposition}; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g, "%27")}` });
    return res.send(data);
  });
  const send = async (req, res) => {
    let userId, conversation, userMessage, requestId, locked = false, savedFiles = [];
    try {
      userId = userFrom(req);
      conversation = await conversationFrom(req, userId);
      const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
      if (message.length > 1200) throw fail("AI_MESSAGE_TOO_LONG", "Câu hỏi tối đa 1.200 ký tự.");
      const files = normalizeAttachments(req.body?.attachments);
      if (!message && !files.length) throw fail("AI_EMPTY_MESSAGE", "Bạn hãy nhập câu hỏi hoặc chọn tệp trước nhé.");
      requestId = req.body?.requestId;
      if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) throw fail("AI_INVALID_REQUEST", "Mã gửi tin nhắn không hợp lệ.");
      const existing = await Message.findOne({ userId, conversationId: conversation._id, requestId, role: "user" }).lean().exec();
      if (existing) {
        const reply = await Message.findOne({ userId, conversationId: conversation._id, requestId, role: "assistant", status: "complete" }).lean().exec();
        const attachments = await filesFor(userId, conversation._id, [existing._id]);
        if (reply) return res.json({ conversation: serializeConversation(conversation), userMessage: serializeMessage(existing, attachments), assistantMessage: serializeMessage(reply), reply: reply.content, provider: reply.provider });
        if (existing.status === "pending" && new Date(existing.createdAt).getTime() <= now().getTime() - REQUEST_LEASE_MS) {
          const errorFields = { status: "failed", errorCode: "AI_INTERRUPTED", errorMessage: "Lượt xử lý trước đã bị gián đoạn. Bạn có thể gửi lại câu hỏi." };
          await Message.updateOne({ _id: existing._id, userId, status: "pending" }, { $set: errorFields });
          await Conversation.updateOne({ _id: conversation._id, userId, activeRequestId: requestId, activeRequestAt: { $lt: new Date(now().getTime() - REQUEST_LEASE_MS) } }, { $set: { activeRequestId: null, activeRequestAt: null } });
          Object.assign(existing, errorFields);
        }
        return res.status(409).json({ code: existing.status === "failed" ? "AI_REQUEST_FAILED" : "AI_REQUEST_PENDING", msg: existing.status === "failed" ? "Lượt gửi này đã thất bại. Hãy gửi lại với một lượt mới." : "Tin nhắn này đang được xử lý.", userMessage: serializeMessage(existing, attachments), ...(existing.status === "pending" ? { retryAfterSeconds: 3 } : {}) });
      }
      const at = now();
      const claimed = await Conversation.findOneAndUpdate({ _id: conversation._id, userId, deletedAt: null, $or: [{ activeRequestId: null }, { activeRequestAt: { $lt: new Date(at.getTime() - REQUEST_LEASE_MS) } }] }, { $set: { activeRequestId: requestId, activeRequestAt: at } }, { new: true }).lean().exec();
      if (!claimed) throw fail("AI_CONVERSATION_BUSY", "Cuộc trò chuyện đang xử lý một tin nhắn. Vui lòng chờ phản hồi.", 409);
      locked = true;
      // A terminated serverless invocation cannot leave a conversation locked
      // forever. Expired turns stay visible as failed, never fabricated replies.
      await Message.updateMany({ userId, conversationId: conversation._id, status: "pending", createdAt: { $lt: new Date(at.getTime() - REQUEST_LEASE_MS) } }, { $set: { status: "failed", errorCode: "AI_INTERRUPTED", errorMessage: "Lượt xử lý trước đã bị gián đoạn. Bạn có thể gửi lại câu hỏi." } });
      userMessage = await Message.create({ userId, conversationId: conversation._id, role: "user", content: message, requestId, status: "pending" });
      const title = (message || files[0]?.name || DEFAULT_TITLE).slice(0, 50);
      const titled = await Conversation.findOneAndUpdate({ _id: conversation._id, userId, deletedAt: null, activeRequestId: requestId }, { $set: { lastMessageAt: now(), ...(conversation.title === DEFAULT_TITLE ? { title } : {}) } }, { new: true }).lean().exec();
      if (!titled) throw fail("AI_CONVERSATION_NOT_FOUND", "Cuộc trò chuyện đã được đóng hoặc xóa.", 404);
      conversation = titled;
      await consumeRate(userId);
      if (files.length) {
        savedFiles = await Attachment.insertMany(files.map(file => ({ ...file, userId, conversationId: conversation._id, messageId: userMessage._id })));
        await Message.updateOne({ _id: userMessage._id, userId }, { $set: { attachmentIds: savedFiles.map(file => file._id) } });
      }
      const previous = (await Message.find({ userId, conversationId: conversation._id, status: "complete" }).sort({ _id: -1 }).limit(20).lean().exec()).reverse();
      const historicalFiles = await filesFor(userId, conversation._id, previous.map(value => value._id));
      let remaining = MAX_HISTORY_BYTES - files.reduce((total, file) => total + file.size, 0);
      const allowedHistoryIds = new Set();
      // Keep newest complete file groups. Never send a partial/mislabelled file
      // or all binary history without a bounded provider request budget.
      for (const old of [...previous].reverse()) {
        const group = historicalFiles.filter(file => String(file.messageId) === String(old._id));
        const bytes = group.reduce((total, file) => total + file.size, 0);
        if (bytes <= remaining) { group.forEach(file => allowedHistoryIds.add(String(file._id))); remaining -= bytes; }
      }
      const selectedFiles = allowedHistoryIds.size ? await Attachment.find({ userId, conversationId: conversation._id, _id: { $in: [...allowedHistoryIds] } }).select("+data").lean().exec() : [];
      const history = previous.map(value => ({ role: value.role, content: value.content, attachments: selectedFiles.filter(file => String(file.messageId) === String(value._id)), attachmentsOmitted: historicalFiles.filter(file => String(file.messageId) === String(value._id) && !allowedHistoryIds.has(String(file._id))).length }));
      const result = await generate({ message, attachments: files, history, historyLimit: 20, trustedHistory: true, loadPatientContext: () => contextLoader(userId) });
      if (typeof result?.reply !== "string" || !result.reply.trim()) throw fail("AI_EMPTY_RESPONSE", "Trợ lý chưa trả về nội dung hợp lệ.", 502);
      if (!await Conversation.exists({ _id: conversation._id, userId, deletedAt: null, activeRequestId: requestId })) throw fail("AI_CONVERSATION_NOT_FOUND", "Cuộc trò chuyện đã được đóng hoặc xóa.", 404);
      const assistantMessage = await Message.create({ userId, conversationId: conversation._id, role: "assistant", content: result.reply, requestId, replyTo: userMessage._id, status: "complete", provider: result.provider });
      await Message.updateOne({ _id: userMessage._id, userId }, { $set: { status: "complete" } });
      const updated = await Conversation.findOneAndUpdate({ _id: conversation._id, userId, deletedAt: null, activeRequestId: requestId }, { $set: { lastMessageAt: now(), ...(conversation.title === DEFAULT_TITLE ? { title: (message || files[0]?.name || DEFAULT_TITLE).slice(0, 50) } : {}) } }, { new: true }).lean().exec();
      return res.json({ conversation: serializeConversation(updated || conversation), userMessage: serializeMessage({ ...userMessage.toObject(), status: "complete" }, savedFiles), assistantMessage: serializeMessage(assistantMessage), reply: result.reply, provider: result.provider });
    } catch (error) {
      let failedMessage;
      if (userMessage) {
        const safe = safeError(error);
        await Message.updateOne({ _id: userMessage._id, userId }, { $set: { status: "failed", errorCode: safe.code, errorMessage: safe.msg } }).catch(() => {});
        failedMessage = serializeMessage({ ...userMessage.toObject(), status: "failed", errorCode: safe.code, errorMessage: safe.msg }, savedFiles);
        if (safe.code === "AI_CONVERSATION_NOT_FOUND") await Promise.all([Message.deleteMany({ userId, conversationId: conversation._id }), Attachment.deleteMany({ userId, conversationId: conversation._id })]).catch(() => {});
      }
      return sendError(res, error, failedMessage ? { userMessage: failedMessage } : {});
    } finally {
      if (locked) await Conversation.updateOne({ _id: conversation._id, userId, activeRequestId: requestId }, { $set: { activeRequestId: null, activeRequestAt: null } }).catch(() => {});
    }
  };
  return { list, create, get, messages, rename, remove, content, send };
}

function normalizeTitle(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 50) throw fail("AI_INVALID_TITLE", "Tiêu đề cần từ 1 đến 50 ký tự.");
  return value.trim().replace(/[\u0000-\u001f\u007f]/g, " ");
}

module.exports = { ...createConversationController(), createConversationController, serializeConversation, serializeMessage, safeError, sendError };
