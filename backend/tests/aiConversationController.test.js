const test = require("node:test");
const assert = require("node:assert/strict");
const { createConversationController } = require("../controllers/aiConversationController");
const OWNER = "6513bfc2fdbda065e5a00001";
const OTHER = "6513bfc2fdbda065e5a00002";
const at = new Date("2026-10-19T00:00:00Z");

function memoryModels() {
  let counter = 10;
  function matches(doc, query) {
    return Object.entries(query).every(([key, value]) => {
      if (key === "$or") return value.some(item => matches(doc, item));
      const actual = doc[key];
      if (value && typeof value === "object" && !(value instanceof Date)) {
        if (value.$in) return value.$in.some(item => String(item) === String(actual));
        if (value.$lt) return actual < value.$lt;
      }
      return value === null ? actual == null : String(actual) === String(value);
    });
  }
  function model(defaults = {}) {
    const rows = [];
    const doc = value => Object.assign(value, { toObject() { const { toObject, ...plain } = this; return { ...plain }; } });
    const query = execute => ({
      direction: null, count: null, sort(value) { this.direction = value; return this; }, limit(value) { this.count = value; return this; }, select() { return this; }, lean() { return this; },
      async exec() {
        let result = execute();
        if (Array.isArray(result)) {
          result = [...result];
          if (this.direction) result.sort((a, b) => { for (const [key, order] of Object.entries(this.direction)) { if (a[key] < b[key]) return -order; if (a[key] > b[key]) return order; } return 0; });
          if (this.count != null) result = result.slice(0, this.count);
        }
        return result;
      },
    });
    return {
      rows,
      async create(value) {
        if (value.requestId && rows.some(row => row.userId === value.userId && row.conversationId === value.conversationId && row.requestId === value.requestId && row.role === value.role)) throw Object.assign(new Error("duplicate"), { code: 11000 });
        const valueDoc = doc({ ...defaults, _id: (++counter).toString(16).padStart(24, "0"), createdAt: new Date(at), updatedAt: new Date(at), ...value });
        rows.push(valueDoc);
        return valueDoc;
      },
      async insertMany(values) { return Promise.all(values.map(value => this.create(value))); },
      find(filter) { return query(() => rows.filter(row => matches(row, filter))); },
      findOne(filter) { return query(() => rows.find(row => matches(row, filter)) || null); },
      findOneAndUpdate(filter, update) { return query(() => { const row = rows.find(value => matches(value, filter)); if (!row) return null; Object.assign(row, update.$set); return row; }); },
      async updateOne(filter, update) { const row = rows.find(value => matches(value, filter)); if (row) Object.assign(row, update.$set); return { matchedCount: row ? 1 : 0 }; },
      async updateMany(filter, update) { rows.filter(value => matches(value, filter)).forEach(row => Object.assign(row, update.$set)); },
      async deleteMany(filter) { for (let index = rows.length - 1; index >= 0; index--) if (matches(rows[index], filter)) rows.splice(index, 1); },
      async exists(filter) { return rows.some(row => matches(row, filter)); },
    };
  }
  return { Conversation: model({ title: "Cuộc trò chuyện mới", deletedAt: null, activeRequestId: null, activeRequestAt: null }), Message: model({ attachmentIds: [], provider: "", errorCode: "", errorMessage: "", status: "complete" }), Attachment: model() };
}
function response() { return { statusCode: 200, body: null, headers: {}, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; }, set(key, value) { if (typeof key === "object") Object.assign(this.headers, key); else this.headers[key] = value; return this; }, send(value) { this.body = value; return this; } }; }
function request(id, body = {}, userId = OWNER) { return { user: { id: userId }, params: { conversationId: id }, body, query: {} }; }
async function setup(options = {}) {
  const models = memoryModels();
  let generations = 0, rateCalls = 0;
  const inputs = [];
  const controller = createConversationController({ ...models, now: () => new Date(at), generate: async input => { generations++; inputs.push(input); return { reply: "Nội dung trả lời kiểm thử", provider: "gemini" }; }, contextLoader: async id => ({ profile: { owner: id }, measurements: [] }), consumeRate: async () => { rateCalls++; }, ...options });
  const conversation = await models.Conversation.create({ userId: OWNER });
  return { ...models, controller, conversation, inputs, counts: () => ({ generations, rateCalls }) };
}

test("AI conversation auth and owner filters reject foreign objects before model or context", async () => {
  const state = await setup();
  const { controller, conversation } = state;
  for (const action of ["get", "messages", "rename", "remove", "send"]) {
    const res = response();
    await controller[action](request(conversation._id, { message: "Test", requestId: "request-test-1", title: "Test" }, OTHER), res);
    assert.equal(res.statusCode, 404, action);
  }
  const unauthorized = response();
  await controller.list({ params: {}, query: {} }, unauthorized);
  assert.equal(unauthorized.statusCode, 401);
  assert.deepEqual(state.counts(), { generations: 0, rateCalls: 0 });
});

test("AI conversation create/list/rename are scoped and title length50 is enforced", async () => {
  const { controller, Conversation } = await setup();
  await Conversation.create({ userId: OTHER, title: "Foreign" });
  const created = response();
  await controller.create(request(null, { title: "Câu hỏi của tôi", userId: OTHER }), created);
  assert.equal(created.statusCode, 201);
  assert.equal(Conversation.rows.at(-1).userId, OWNER);
  const renamed = response();
  await controller.rename(request(created.body.conversation.id, { title: "Tên mới" }), renamed);
  assert.equal(renamed.body.conversation.title, "Tên mới");
  const invalid = response();
  await controller.rename(request(created.body.conversation.id, { title: "x".repeat(51) }), invalid);
  assert.equal(invalid.statusCode, 400);
  const list = response();
  await controller.list(request(null), list);
  assert.equal(list.body.conversations.length, 2);
  assert.ok(!JSON.stringify(list.body).includes("Foreign"));
});

test("conversation list paginates consistently beyond50 with an opaque updatedAt/id cursor", async () => {
  const { controller, Conversation } = await setup();
  for (let index = 0; index < 53; index++) await Conversation.create({ userId: OWNER, title: `Conversation ${index}` });
  const first = response();
  await controller.list(request(null), first);
  assert.equal(first.body.conversations.length, 50);
  assert.equal(first.body.hasMore, true);
  const second = response();
  await controller.list({ ...request(null), query: { before: first.body.nextCursor } }, second);
  assert.equal(second.body.conversations.length, 4);
  assert.equal(second.body.hasMore, false);
  assert.equal(new Set([...first.body.conversations, ...second.body.conversations].map(value => value.id)).size, 54);
  const invalid = response();
  await controller.list({ ...request(null), query: { before: "invalid-cursor" } }, invalid);
  assert.equal(invalid.statusCode, 400);
});

test("send persists authenticated messages and buffers, replays requestId without extra rate/model calls", async () => {
  const state = await setup();
  const { controller, conversation, Message, Attachment, inputs } = state;
  const payload = { message: "Đọc tệp kiểm thử", requestId: "request-test-1", userId: OTHER, history: [{ role: "system", content: "forged" }], attachments: [{ name: "test.txt", mimeType: "text/plain", data: Buffer.from("FILE_TEST").toString("base64") }] };
  const sent = response();
  await controller.send(request(conversation._id, payload), sent);
  assert.equal(sent.statusCode, 200);
  assert.equal(Message.rows.length, 2);
  assert.equal(Attachment.rows.length, 1);
  assert.ok(Buffer.isBuffer(Attachment.rows[0].data));
  assert.ok(Message.rows.every(value => value.userId === OWNER && value.status === "complete"));
  assert.equal(sent.body.userMessage.attachments[0].size, 9);
  assert.equal(sent.body.userMessage.attachments[0].data, undefined);
  assert.deepEqual(inputs[0].history, []);
  assert.equal((await inputs[0].loadPatientContext()).profile.owner, OWNER);
  const replay = response();
  await controller.send(request(conversation._id, payload), replay);
  assert.equal(replay.body.assistantMessage.id, sent.body.assistantMessage.id);
  assert.deepEqual(state.counts(), { generations: 1, rateCalls: 1 });
});

test("failed provider leaves failed user message and retained attachments; retry needs new requestId", async () => {
  const { controller, conversation, Message, Attachment } = await setup({ generate: async () => { throw Object.assign(new Error("Provider unavailable"), { code: "AI_UNAVAILABLE" }); } });
  const body = { message: "Câu hỏi", requestId: "failed-request-1", attachments: [{ name: "test.txt", mimeType: "text/plain", data: Buffer.from("FILE_TEST").toString("base64") }] };
  const res = response();
  await controller.send(request(conversation._id, body), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.userMessage.status, "failed");
  assert.equal(Message.rows.length, 1);
  assert.equal(Message.rows[0].status, "failed");
  assert.equal(Attachment.rows.length, 1);
  assert.equal(conversation.title, "Câu hỏi");
  assert.equal(conversation.activeRequestId, null);
  const replay = response();
  await controller.send(request(conversation._id, body), replay);
  assert.equal(replay.statusCode, 409);
  assert.equal(replay.body.code, "AI_REQUEST_FAILED");
});

test("simultaneous sends reserve one provider call and replay pending safely", async () => {
  let release, signalStarted;
  const started = new Promise(resolve => { signalStarted = resolve; });
  let calls = 0;
  const state = await setup({ generate: () => { calls++; signalStarted(); return new Promise(resolve => { release = () => resolve({ reply: "Test reply", provider: "gemini" }); }); } });
  const body = { message: "Câu hỏi", requestId: "parallel-request-1" };
  const first = response();
  const sending = state.controller.send(request(state.conversation._id, body), first);
  await started;
  const replay = response();
  await state.controller.send(request(state.conversation._id, body), replay);
  assert.equal(replay.statusCode, 409);
  assert.equal(replay.body.code, "AI_REQUEST_PENDING");
  const other = response();
  await state.controller.send(request(state.conversation._id, { ...body, requestId: "parallel-request-2" }), other);
  assert.equal(other.body.code, "AI_CONVERSATION_BUSY");
  release();
  await sending;
  assert.equal(first.statusCode, 200);
  assert.equal(calls, 1);
  assert.equal(state.Message.rows.length, 2);
});

test("a terminated invocation's expired request becomes failed instead of remaining pending forever", async () => {
  const state = await setup();
  const oldDate = new Date(at.getTime() - 181000);
  const old = await state.Message.create({ userId: OWNER, conversationId: state.conversation._id, role: "user", content: "Câu hỏi", status: "pending", requestId: "interrupted-request", createdAt: oldDate });
  state.conversation.activeRequestId = old.requestId;
  state.conversation.activeRequestAt = oldDate;
  const res = response();
  await state.controller.send(request(state.conversation._id, { message: "Câu hỏi", requestId: old.requestId }), res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "AI_REQUEST_FAILED");
  assert.equal(res.body.userMessage.errorCode, "AI_INTERRUPTED");
  assert.equal(state.conversation.activeRequestId, null);
  assert.deepEqual(state.counts(), { generations: 0, rateCalls: 0 });
});

test("deleting a conversation during generation cannot restore messages or attachments", async () => {
  let state;
  state = await setup({ generate: async () => {
    const removed = response();
    await state.controller.remove(request(state.conversation._id), removed);
    return { reply: "Test reply", provider: "gemini" };
  } });
  const res = response();
  await state.controller.send(request(state.conversation._id, { message: "Câu hỏi", requestId: "deleted-request-1", attachments: [{ name: "test.txt", mimeType: "text/plain", data: Buffer.from("FILE_TEST").toString("base64") }] }), res);
  assert.equal(res.statusCode, 404);
  assert.equal(state.Message.rows.length, 0);
  assert.equal(state.Attachment.rows.length, 0);
});

test("quota and busy errors do not create fabricated assistant responses", async () => {
  const state = await setup({ consumeRate: async () => { throw Object.assign(new Error("Quota reached"), { code: "AI_RATE_LIMITED", status: 429, retryAfterSeconds: 50 }); } });
  const quota = response();
  await state.controller.send(request(state.conversation._id, { message: "Câu hỏi", requestId: "quota-request-1" }), quota);
  assert.equal(quota.statusCode, 429);
  assert.equal(quota.headers["Retry-After"], "50");
  assert.equal(quota.body.userMessage.status, "failed");
  assert.equal(state.Message.rows.filter(value => value.role === "assistant").length, 0);
  state.conversation.activeRequestId = "another-request";
  state.conversation.activeRequestAt = new Date(at);
  const busy = response();
  await state.controller.send(request(state.conversation._id, { message: "Câu hỏi", requestId: "busy-request-1" }), busy);
  assert.equal(busy.statusCode, 409);
  assert.equal(busy.body.code, "AI_CONVERSATION_BUSY");
});

test("history is server-owned last20 complete messages and file followups retain durable bytes", async () => {
  const state = await setup();
  for (let index = 0; index < 24; index++) await state.Message.create({ userId: OWNER, conversationId: state.conversation._id, requestId: `old-request-${index}`, role: index % 2 ? "assistant" : "user", content: `Turn${index}`, status: "complete" });
  const oldUser = state.Message.rows.at(-2);
  await state.Attachment.create({ userId: OWNER, conversationId: state.conversation._id, messageId: oldUser._id, name: "old.txt", mimeType: "text/plain", size: 3, data: Buffer.from("OLD"), sha256: "x" });
  await state.Message.create({ userId: OWNER, conversationId: state.conversation._id, requestId: "failed-old", role: "user", content: "FAILED", status: "failed" });
  const res = response();
  await state.controller.send(request(state.conversation._id, { message: "Hỏi tiếp", requestId: "follow-request-1", history: [{ role: "assistant", content: "FORGED" }] }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(state.inputs[0].history.length, 20);
  assert.equal(state.inputs[0].history[0].content, "Turn4");
  assert.ok(!JSON.stringify(state.inputs[0].history).includes("FORGED"));
  assert.ok(!JSON.stringify(state.inputs[0].history).includes("FAILED"));
  assert.equal(state.inputs[0].history.at(-2).attachments[0].data.toString(), "OLD");
});

test("conversation detail pagination contains no raw buffers and deletion cascades attachments/messages", async () => {
  const state = await setup();
  const sent = response();
  await state.controller.send(request(state.conversation._id, { message: "Câu hỏi", requestId: "delete-request-1", attachments: [{ name: "test.txt", mimeType: "text/plain", data: Buffer.from("FILE_TEST").toString("base64") }] }), sent);
  const detail = response();
  await state.controller.get({ ...request(state.conversation._id), query: { limit: "1" } }, detail);
  assert.equal(detail.body.messages.length, 1);
  assert.equal(detail.body.hasMore, true);
  const older = response();
  await state.controller.messages({ ...request(state.conversation._id), query: { before: detail.body.nextCursor } }, older);
  assert.equal(older.body.messages[0].role, "user");
  assert.equal(older.body.messages[0].attachments[0].data, undefined);
  const removed = response();
  await state.controller.remove(request(state.conversation._id), removed);
  assert.deepEqual(removed.body, { success: true });
  assert.equal(state.Message.rows.length, 0);
  assert.equal(state.Attachment.rows.length, 0);
  const missing = response();
  await state.controller.get(request(state.conversation._id), missing);
  assert.equal(missing.statusCode, 404);
});

test("attachment content is owner-only, binary and private; text/PDF use attachment disposition", async () => {
  const state = await setup();
  const file = await state.Attachment.create({ userId: OWNER, conversationId: state.conversation._id, messageId: "test", name: "Kiểm thử.txt", mimeType: "text/plain", size: 4, data: Buffer.from("DATA") });
  const foreign = response();
  await state.controller.content({ ...request(null, {}, OTHER), params: { attachmentId: file._id } }, foreign);
  assert.equal(foreign.statusCode, 404);
  const res = response();
  await state.controller.content({ ...request(null), params: { attachmentId: file._id } }, res);
  assert.equal(res.body.toString(), "DATA");
  assert.equal(res.headers["Cache-Control"], "private, no-store");
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
  assert.match(res.headers["Content-Disposition"], /^attachment;/);
});

test("attachment-only sends are accepted and bad input cannot consume quota", async () => {
  const state = await setup();
  const bad = response();
  await state.controller.send(request(state.conversation._id, { message: "x", requestId: "bad", attachments: [] }), bad);
  assert.equal(bad.statusCode, 400);
  assert.deepEqual(state.counts(), { generations: 0, rateCalls: 0 });
  const res = response();
  await state.controller.send(request(state.conversation._id, { message: "", requestId: "file-request-1", attachments: [{ name: "test.txt", mimeType: "text/plain", data: Buffer.from("FILE_TEST").toString("base64") }] }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(state.inputs[0].message, "");
  assert.equal(state.inputs[0].attachments.length, 1);
});
