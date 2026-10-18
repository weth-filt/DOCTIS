import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FiActivity, FiAlertCircle, FiArrowUp, FiCamera, FiCheck, FiClock, FiDownload, FiEdit2, FiFileText, FiMenu, FiMessageSquare, FiPaperclip, FiPlus, FiRefreshCw, FiTrash2, FiX } from "react-icons/fi";
import API from "../../services/api";
import { ConversationNotice } from "../ConversationViewport";
import { useConversationMotion } from "../ConversationMotion";
import useLiveReducedMotion from "../useLiveReducedMotion";
import AIResponse from "./AIResponse";
import {
  AI_ATTACHMENT_ACCEPT, MAX_AI_ATTACHMENTS, MAX_AI_MESSAGE_LENGTH, aiDateLabel, conversationId, conversationTitle,
  formatAttachmentSize, groupConversations, prepareAIAttachment, releaseAttachment, sortConversations,
  upsertConversation, validateAIRequest, validateAttachmentTotals,
} from "./aiWorkspaceUtils";
import "../../CSS/ai-workspace.css";

const WELCOME_PROMPTS = ["Giải thích giúp tôi kết quả xét nghiệm", "Gợi ý câu hỏi cho buổi khám", "Tôi muốn hỏi về bữa ăn và vận động"];
const getError = (error, fallback) => typeof error?.response?.data?.msg === "string" ? error.response.data.msg : fallback;
const requestId = () => typeof window.crypto?.randomUUID === "function" ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const normalizedMessage = (item, animate = false) => item && conversationId(item) && ["user", "assistant"].includes(item.role)
  ? { ...item, id: conversationId(item), content: String(item.content || ""), attachments: Array.isArray(item.attachments) ? item.attachments : [], sender: item.role === "assistant" ? "ai" : "user", text: String(item.content || ""), animate } : null;
const mergeMessages = (old, additions) => {
  const map = new Map(old.map(item => [item.id, item]));
  additions.filter(Boolean).forEach(item => map.set(item.id, item));
  return [...map.values()].sort((a, b) => Date.parse(a.createdAt || "") - Date.parse(b.createdAt || ""));
};

function useMobileHistory() {
  const [mobile, setMobile] = useState(() => typeof window.matchMedia === "function" && window.matchMedia("(max-width: 900px)").matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(max-width: 900px)");
    const update = () => setMobile(query.matches);
    update();
    if (query.addEventListener) { query.addEventListener("change", update); return () => query.removeEventListener("change", update); }
    query.addListener?.(update);
    return () => query.removeListener?.(update);
  }, []);
  return mobile;
}

function trapFocus(event, node) {
  if (event.key !== "Tab" || !node) return;
  const focusable = [...node.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')];
  if (!focusable.length) { event.preventDefault(); node.focus(); return; }
  if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
  else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
}

function WorkspaceDialog({ title, children, onClose, busy = false, className = "", returnFocusRef }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const returnFocusNode = returnFocusRef?.current;
    (ref.current?.querySelector("input, textarea") || ref.current?.querySelector("button, a[href]"))?.focus();
    return () => {
      if (returnFocusNode && !returnFocusNode.closest("[hidden]")) returnFocusNode.focus();
      else if (previous?.isConnected && !previous.closest("[hidden], [inert]")) previous.focus();
    };
  }, [returnFocusRef]);
  return <div className="aiw-modal-shade" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className={`aiw-dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1} onKeyDown={event => {
      if (event.key === "Escape" && !busy) { event.stopPropagation(); onClose(); }
      trapFocus(event, ref.current);
    }}>
      <header><h3 id={titleId}>{title}</h3><button className="aiw-icon-button" type="button" onClick={onClose} disabled={busy} aria-label="Đóng hộp thoại"><FiX aria-hidden="true" /></button></header>
      {children}
    </section>
  </div>;
}

/** Keep this component mounted and pass active=false when another menu opens.
 * Draft text and file bytes stay only in component memory, never localStorage.
 */
export default function AIWorkspace({ active = true }) {
  const reduced = useLiveReducedMotion();
  const mobile = useMobileHistory();
  const historyId = useId();
  const [conversations, setConversations] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [listHasMore, setListHasMore] = useState(false);
  const [listCursor, setListCursor] = useState(null);
  const [listMoreLoading, setListMoreLoading] = useState(false);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [hasOlder, setHasOlder] = useState(false);
  const [olderCursor, setOlderCursor] = useState(null);
  const [olderLoading, setOlderLoading] = useState(false);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const [optimisticMessage, setOptimisticMessage] = useState(null);
  const [composerError, setComposerError] = useState("");
  const [notice, setNotice] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [viewer, setViewer] = useState(null);
  const [unread, setUnread] = useState(0);
  const mounted = useRef(true);
  const loadedList = useRef(false);
  const viewRequest = useRef(0);
  const viewerRequest = useRef(0);
  const viewerAbort = useRef(null);
  const activeRef = useRef(active);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const historyRef = useRef(null);
  const historyToggleRef = useRef(null);
  const nearEnd = useRef(true);
  const previousCount = useRef(0);
  const prependAnchor = useRef(null);
  const drafts = useRef(new Map());
  const attempts = useRef(new Map());
  const sendLock = useRef(false);
  const olderLock = useRef(null);
  const listMutations = useRef(0);
  const deletedIds = useRef(new Set());
  const currentId = conversationId(currentConversation);
  const draftKey = currentId || "new";
  const groups = useMemo(() => groupConversations(conversations), [conversations]);
  const visibleMessages = optimisticMessage ? [...messages, optimisticMessage] : messages;
  useConversationMotion(bodyRef, currentId || "new", messages, messageLoading);
  activeRef.current = active;

  useEffect(() => {
    mounted.current = true;
    const draftStore = drafts.current;
    return () => {
      mounted.current = false;
      viewerAbort.current?.abort();
      const urls = new Set([...draftStore.values()].flatMap(draft => draft.attachments.map(item => item.previewUrl)).filter(Boolean));
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => { drafts.current.set(draftKey, { input, attachments }); }, [draftKey, input, attachments]);
  useEffect(() => {
    const url = viewer?.owned ? viewer.url : null;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [viewer?.owned, viewer?.url]);

  const loadList = useCallback(async () => {
    const version = listMutations.current;
    setListLoading(true); setListError("");
    try {
      const response = await API.get("/ai/conversations");
      if (mounted.current) {
        setConversations(old => {
          const incoming = sortConversations(response.data?.conversations).filter(item => !deletedIds.current.has(conversationId(item)));
          return version === listMutations.current ? incoming : old.reduce((result, item) => upsertConversation(result, item), incoming);
        });
        setListHasMore(Boolean(response.data?.hasMore)); setListCursor(response.data?.nextCursor || null);
      }
    } catch (error) { if (mounted.current) setListError(getError(error, "Chưa tải được lịch sử. Bạn có thể thử lại.")); }
    finally { if (mounted.current) setListLoading(false); }
  }, []);
  const loadMoreConversations = async () => {
    if (!listCursor || listMoreLoading) return;
    setListMoreLoading(true); setListError("");
    try {
      const response = await API.get("/ai/conversations", { params: { before: listCursor, limit: 30 } });
      if (!mounted.current) return;
      setConversations(old => (response.data?.conversations || []).filter(item => !deletedIds.current.has(conversationId(item))).reduce((result, item) => result.some(value => conversationId(value) === conversationId(item)) ? result : upsertConversation(result, item), old));
      setListHasMore(Boolean(response.data?.hasMore)); setListCursor(response.data?.nextCursor || null);
    } catch (error) { if (mounted.current) setListError(getError(error, "Chưa tải được những cuộc trò chuyện cũ hơn.")); }
    finally { if (mounted.current) setListMoreLoading(false); }
  };
  useEffect(() => {
    if (active && !loadedList.current) { loadedList.current = true; loadList(); }
  }, [active, loadList]);

  useEffect(() => {
    if (!active || !mobile || !historyOpen) return undefined;
    const previous = document.activeElement;
    const toggle = historyToggleRef.current;
    historyRef.current?.querySelector("button")?.focus();
    const keydown = event => {
      if (event.key === "Escape") { setHistoryOpen(false); event.preventDefault(); }
      trapFocus(event, historyRef.current);
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); if (activeRef.current) (toggle || previous)?.focus(); };
  }, [active, mobile, historyOpen]);
  useEffect(() => { if (!active) setHistoryOpen(false); }, [active]);
  useLayoutEffect(() => {
    const node = inputRef.current;
    if (!node || !active) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight || 48, 144)}px`;
  }, [input, active]);
  useLayoutEffect(() => {
    const node = bodyRef.current;
    if (!node || !active || messageLoading) return;
    if (prependAnchor.current) {
      node.scrollTop = prependAnchor.current.top + node.scrollHeight - prependAnchor.current.height;
      prependAnchor.current = null;
    } else if (nearEnd.current) { node.scrollTop = node.scrollHeight; setUnread(0); }
    else if (messages.length > previousCount.current) setUnread(count => count + messages.length - previousCount.current);
    previousCount.current = messages.length;
  }, [active, messages, sending, optimisticMessage, messageLoading]);
  const followReply = useCallback(() => {
    const node = bodyRef.current;
    if (node && activeRef.current && nearEnd.current) node.scrollTop = node.scrollHeight;
  }, []);
  const jumpToLatest = () => {
    nearEnd.current = true; setUnread(0);
    const node = bodyRef.current;
    if (node?.scrollTo) node.scrollTo({ top: node.scrollHeight, behavior: reduced ? "instant" : "smooth" });
    else if (node) node.scrollTop = node.scrollHeight;
  };

  const saveDraft = () => drafts.current.set(draftKey, { input, attachments });
  const startNew = () => {
    if (sendLock.current || sending || preparing) return;
    saveDraft();
    drafts.current.get("new")?.attachments.forEach(releaseAttachment);
    drafts.current.set("new", { input: "", attachments: [] });
    viewRequest.current += 1;
    setCurrentConversation(null); setMessages([]); setMessageLoading(false); setMessageError("");
    setInput(""); setAttachments([]); setComposerError(""); setHasOlder(false); setOlderCursor(null); setHistoryOpen(false);
    attempts.current.delete("new"); olderLock.current = null; setOlderLoading(false); prependAnchor.current = null;
    nearEnd.current = true; previousCount.current = 0;
    if (activeRef.current) inputRef.current?.focus();
  };
  const openConversation = async conversation => {
    if (sendLock.current || sending || preparing) return;
    saveDraft();
    const id = conversationId(conversation);
    const draft = drafts.current.get(id) || { input: "", attachments: [] };
    const request = ++viewRequest.current;
    setCurrentConversation(conversation); setMessages([]); setInput(draft.input); setAttachments(draft.attachments);
    setHistoryOpen(false); setMessageLoading(true); setMessageError(""); setComposerError(""); setHasOlder(false); setOlderCursor(null);
    olderLock.current = null; setOlderLoading(false); prependAnchor.current = null;
    nearEnd.current = true; previousCount.current = 0;
    try {
      const response = await API.get(`/ai/conversations/${encodeURIComponent(id)}`);
      if (!mounted.current || request !== viewRequest.current) return;
      setCurrentConversation(response.data?.conversation || conversation);
      setMessages((response.data?.messages || []).map(item => normalizedMessage(item)).filter(Boolean));
      setHasOlder(Boolean(response.data?.hasMore)); setOlderCursor(response.data?.nextCursor || null);
    } catch (error) { if (mounted.current && request === viewRequest.current) setMessageError(getError(error, "Chưa mở được cuộc trò chuyện. Bạn hãy thử tải lại.")); }
    finally { if (mounted.current && request === viewRequest.current) setMessageLoading(false); }
  };
  const loadOlder = async () => {
    if (!currentId || !olderCursor || olderLoading || olderLock.current === viewRequest.current) return;
    const request = viewRequest.current;
    olderLock.current = request;
    setOlderLoading(true);
    try {
      const response = await API.get(`/ai/conversations/${encodeURIComponent(currentId)}/messages`, { params: { before: olderCursor, limit: 40 } });
      if (!mounted.current || request !== viewRequest.current) return;
      const node = bodyRef.current;
      prependAnchor.current = node ? { top: node.scrollTop, height: node.scrollHeight } : null;
      setMessages(old => mergeMessages(old, (response.data?.messages || []).map(item => normalizedMessage(item))));
      setHasOlder(Boolean(response.data?.hasMore)); setOlderCursor(response.data?.nextCursor || null);
    } catch (error) { if (mounted.current && request === viewRequest.current) setMessageError(getError(error, "Chưa tải được tin nhắn cũ hơn.")); }
    finally { if (mounted.current && request === viewRequest.current) { olderLock.current = null; setOlderLoading(false); } }
  };

  const selectFiles = async event => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || preparing || sending || sendLock.current) return;
    setComposerError("");
    if (files.length + attachments.length > MAX_AI_ATTACHMENTS) { setComposerError("Mỗi tin nhắn chỉ đính kèm tối đa 4 tệp."); return; }
    setPreparing(true);
    const prepared = [];
    try {
      for (const file of files) prepared.push(await prepareAIAttachment(file));
      validateAttachmentTotals([...attachments, ...prepared]);
      if (mounted.current) setAttachments(old => [...old, ...prepared]);
      else prepared.forEach(releaseAttachment);
    } catch (error) { prepared.forEach(releaseAttachment); if (mounted.current) setComposerError(error.message || "Không xử lý được tệp. Bạn hãy chọn lại."); }
    finally { if (mounted.current) setPreparing(false); }
  };
  const removeAttachment = localId => {
    if (sending || sendLock.current) return;
    setAttachments(old => old.filter(item => { if (item.localId === localId) { releaseAttachment(item); return false; } return true; }));
    setComposerError("");
  };

  const closeViewer = () => { viewerRequest.current += 1; viewerAbort.current?.abort(); setViewer(null); };
  const openAttachment = async attachment => {
    viewerAbort.current?.abort();
    const sequence = ++viewerRequest.current;
    if (attachment.previewUrl) { setViewer({ attachment, url: attachment.previewUrl, owned: false, loading: false }); return; }
    if (attachment.localId && attachment.data) {
      try {
        const bytes = Uint8Array.from(atob(attachment.data), character => character.charCodeAt(0));
        const blob = new Blob([bytes], { type: attachment.mimeType });
        setViewer({ attachment, url: URL.createObjectURL(blob), owned: true, loading: false });
      } catch { setComposerError("Chưa mở được bản xem trước. Bạn hãy bỏ tệp và chọn lại."); }
      return;
    }
    const id = conversationId(attachment);
    if (!id) { setComposerError("Tệp này chưa có đường dẫn lưu trữ hợp lệ."); return; }
    setViewer({ attachment, loading: true });
    const controller = new AbortController(); viewerAbort.current = controller;
    try {
      const response = await API.get(`/ai/attachments/${encodeURIComponent(id)}/content`, { responseType: "blob", signal: controller.signal });
      if (!mounted.current || sequence !== viewerRequest.current) return;
      const mimeType = attachment.mimeType || response.data?.type;
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: mimeType });
      setViewer({ attachment: { ...attachment, mimeType }, loading: false, url: URL.createObjectURL(blob), owned: true });
    } catch (error) {
      if (mounted.current && sequence === viewerRequest.current && !controller.signal.aborted) setViewer({ attachment, loading: false, error: "Chưa tải được tệp. Bạn hãy đóng và thử mở lại." });
    }
  };

  const sendMessage = async event => {
    event?.preventDefault();
    if (sendLock.current || sending || preparing || messageLoading || (!input.trim() && !attachments.length)) return;
    sendLock.current = true;
    const message = input.trim();
    const files = attachments;
    let attemptKey = draftKey;
    let payload;
    try {
      validateAttachmentTotals(files);
      const body = { message, attachments: files.map(({ name, mimeType, data }) => ({ name, mimeType, data })) };
      const signature = JSON.stringify(body);
      const previous = attempts.current.get(draftKey);
      payload = validateAIRequest({ ...body, requestId: previous?.signature === signature && previous?.conversationId === currentId ? previous.requestId : requestId() });
      attempts.current.set(draftKey, { signature, conversationId: currentId, requestId: payload.requestId });
    } catch (error) { sendLock.current = false; setComposerError(error.message); return; }
    setComposerError(""); setMessageError(""); setSending(true); nearEnd.current = true;
    setOptimisticMessage({ id: `pending-${payload.requestId}`, role: "user", content: message, attachments: files, optimistic: true });
    try {
      let conversation = currentConversation;
      let id = currentId;
      if (!id) {
        const created = await API.post("/ai/conversations", {});
        conversation = created.data?.conversation;
        id = conversationId(conversation);
        if (!id) throw new Error("AI_CONVERSATION_MISSING");
        if (!mounted.current) return;
        drafts.current.delete("new"); drafts.current.set(id, { input, attachments: files });
        listMutations.current += 1;
        setCurrentConversation(conversation); setConversations(old => upsertConversation(old, conversation));
        const attempt = attempts.current.get("new");
        if (attempt) { attempts.current.set(id, { ...attempt, conversationId: id }); attempts.current.delete("new"); }
        attemptKey = id;
      }
      const response = await API.post(`/ai/conversations/${encodeURIComponent(id)}/messages`, payload);
      if (!mounted.current) return;
      const data = response.data || {};
      const savedUser = normalizedMessage(data.userMessage);
      const savedAssistant = normalizedMessage(data.assistantMessage, true);
      if (!savedUser || !savedAssistant) throw new Error("AI_MESSAGE_RESPONSE_INCOMPLETE");
      setMessages(old => mergeMessages(old, [savedUser, savedAssistant]));
      if (data.conversation) { listMutations.current += 1; setCurrentConversation(data.conversation); setConversations(old => upsertConversation(old, data.conversation)); }
      files.forEach(releaseAttachment); setAttachments([]); setInput(""); drafts.current.set(id, { input: "", attachments: [] });
      attempts.current.delete(id);
    } catch (error) {
      if (!mounted.current) return;
      const saved = normalizedMessage(error.response?.data?.userMessage);
      if (saved) setMessages(old => mergeMessages(old, [saved]));
      if (saved?.status === "failed" || error.response?.data?.code === "AI_REQUEST_FAILED") attempts.current.delete(attemptKey);
      setComposerError(getError(error, "Chưa nhận được phản hồi. Câu hỏi và tệp vẫn được giữ để bạn thử gửi lại."));
    } finally {
      sendLock.current = false;
      if (mounted.current) { setSending(false); setOptimisticMessage(null); if (activeRef.current) inputRef.current?.focus(); }
    }
  };

  const renameConversation = async event => {
    event.preventDefault();
    const title = conversationTitle(renameTitle);
    if (!renameTitle.trim() || !renameTarget) return;
    setDialogBusy(true); setDialogError("");
    try {
      const response = await API.patch(`/ai/conversations/${encodeURIComponent(conversationId(renameTarget))}`, { title });
      if (!mounted.current) return;
      const updated = response.data?.conversation;
      if (updated) { listMutations.current += 1; setConversations(old => upsertConversation(old, updated)); if (conversationId(updated) === currentId) setCurrentConversation(updated); }
      setRenameTarget(null); setNotice("Đã đổi tên cuộc trò chuyện.");
    } catch (error) { if (mounted.current) setDialogError(getError(error, "Chưa đổi được tên. Bạn hãy thử lại.")); }
    finally { if (mounted.current) setDialogBusy(false); }
  };
  const deleteConversation = async () => {
    if (!deleteTarget) return;
    const id = conversationId(deleteTarget);
    setDialogBusy(true); setDialogError("");
    try {
      await API.delete(`/ai/conversations/${encodeURIComponent(id)}`);
      if (!mounted.current) return;
      drafts.current.get(id)?.attachments.forEach(releaseAttachment);
      listMutations.current += 1; deletedIds.current.add(id);
      setConversations(old => old.filter(item => conversationId(item) !== id));
      if (id === currentId) startNew();
      drafts.current.delete(id);
      attempts.current.delete(id);
      setDeleteTarget(null); setNotice("Đã xóa cuộc trò chuyện và các tệp liên quan.");
    } catch (error) { if (mounted.current) setDialogError(getError(error, "Chưa xóa được cuộc trò chuyện. Bạn hãy thử lại.")); }
    finally { if (mounted.current) setDialogBusy(false); }
  };

  const attachmentTile = (attachment, key, removable = false) => <div className={`aiw-attachment ${removable ? "is-draft" : ""}`} key={key}>
    <button type="button" className="aiw-attachment-open" onClick={() => openAttachment(attachment)} aria-label={`Xem tệp ${attachment.name || "đính kèm"}`}>
      {attachment.previewUrl ? <img src={attachment.previewUrl} alt="" /> : <span className="aiw-file-icon"><FiFileText aria-hidden="true" /></span>}
      <span><strong>{attachment.name || "Tệp đính kèm"}</strong><small>{formatAttachmentSize(attachment.size || 0)}{attachment.mimeType === "application/pdf" ? " · PDF" : ""}</small></span>
    </button>
    {removable && <button type="button" className="aiw-attachment-remove" disabled={sending} onClick={() => removeAttachment(attachment.localId)} aria-label={`Bỏ tệp ${attachment.name}`}><FiX aria-hidden="true" /></button>}
  </div>;

  return <section className="ai-workspace" hidden={!active} data-reduced-motion={reduced} aria-label="Trợ lý AI và lịch sử trò chuyện">
    {historyOpen && mobile && <button type="button" className="aiw-history-backdrop" tabIndex={-1} aria-label="Đóng lịch sử trò chuyện" onClick={() => setHistoryOpen(false)} />}
    <aside id={historyId} ref={historyRef} className={`aiw-history ${historyOpen ? "is-open" : ""}`} aria-label="Lịch sử trò chuyện" aria-hidden={mobile && !historyOpen ? true : undefined} inert={mobile && !historyOpen ? true : undefined} role={mobile && historyOpen ? "dialog" : undefined} aria-modal={mobile && historyOpen ? true : undefined}>
      <div className="aiw-history-heading"><span><FiClock aria-hidden="true" /> Lịch sử trò chuyện</span><button className="aiw-icon-button aiw-history-close" type="button" onClick={() => setHistoryOpen(false)} aria-label="Đóng danh sách lịch sử"><FiX aria-hidden="true" /></button></div>
      <button type="button" className="aiw-new-button" onClick={startNew} disabled={sending || preparing}><FiPlus aria-hidden="true" /> Cuộc trò chuyện mới</button>
      <div className="aiw-history-list" aria-busy={listLoading}>
        {listLoading && !conversations.length && <p className="aiw-muted" role="status">Đang tải lịch sử…</p>}
        {listError && <div className="aiw-inline-error" role="alert"><p>{listError}</p><button type="button" onClick={loadList} disabled={listLoading}><FiRefreshCw aria-hidden="true" /> Thử tải lại</button></div>}
        {!listLoading && !listError && !conversations.length && <div className="aiw-history-empty"><FiMessageSquare aria-hidden="true" /><p>Chưa có cuộc trò chuyện nào</p><small>Những cuộc trò chuyện của bạn sẽ xuất hiện tại đây.</small></div>}
        {groups.map(group => <section className="aiw-history-group" key={group.label}><h3>{group.label}</h3>{group.items.map(item => <div className={`aiw-conversation-row ${conversationId(item) === currentId ? "is-selected" : ""}`} key={conversationId(item)}>
          <button type="button" className="aiw-conversation-open" disabled={sending || preparing} aria-current={conversationId(item) === currentId ? "true" : undefined} onClick={() => openConversation(item)}><FiMessageSquare aria-hidden="true" /><span><strong>{conversationTitle(item.title)}</strong><time dateTime={item.updatedAt || item.createdAt}>{aiDateLabel(item.updatedAt || item.createdAt, true)}</time></span></button>
          <div className="aiw-conversation-actions"><button type="button" className="aiw-icon-button" disabled={sending || preparing} aria-label={`Đổi tên ${conversationTitle(item.title)}`} onClick={() => { setRenameTarget(item); setRenameTitle(conversationTitle(item.title)); setDialogError(""); setHistoryOpen(false); }}><FiEdit2 aria-hidden="true" /></button><button type="button" className="aiw-icon-button" disabled={sending || preparing} aria-label={`Xóa ${conversationTitle(item.title)}`} onClick={() => { setDeleteTarget(item); setDialogError(""); setHistoryOpen(false); }}><FiTrash2 aria-hidden="true" /></button></div>
        </div>)}</section>)}
        {listHasMore && <button type="button" className="aiw-older-button" onClick={loadMoreConversations} disabled={listMoreLoading}>{listMoreLoading ? "Đang tải…" : "Tải thêm cuộc trò chuyện"}</button>}
      </div>
      <p className="aiw-history-privacy"><FiCheck aria-hidden="true" /> Lịch sử gắn với tài khoản của bạn.</p>
    </aside>

    <div className="aiw-chat">
      <header className="aiw-chat-header"><button ref={historyToggleRef} type="button" className="aiw-icon-button aiw-history-toggle" aria-label="Mở lịch sử trò chuyện" aria-expanded={historyOpen} aria-controls={historyId} onClick={() => setHistoryOpen(true)}><FiMenu aria-hidden="true" /></button><span className="aiw-brand-icon" aria-hidden="true"><FiActivity /></span><div><span className="aiw-eyebrow">DOCTIS AI</span><h2>{currentConversation ? conversationTitle(currentConversation.title) : "Trò chuyện mới"}</h2></div><button className="aiw-icon-button aiw-header-new" type="button" aria-label="Bắt đầu cuộc trò chuyện mới" onClick={startNew} disabled={sending || preparing}><FiPlus aria-hidden="true" /></button></header>
      {notice && <div className="aiw-notice" role="status">{notice}<button type="button" className="aiw-icon-button" onClick={() => setNotice("")} aria-label="Đóng thông báo"><FiX aria-hidden="true" /></button></div>}
      <div className="aiw-message-pane" ref={bodyRef} role="log" aria-label="Nội dung cuộc trò chuyện" aria-live={messageLoading ? "off" : "polite"} aria-busy={messageLoading} onScroll={event => { const node = event.currentTarget; nearEnd.current = node.scrollHeight - node.scrollTop - node.clientHeight < 96; if (nearEnd.current) setUnread(0); }}>
        {messageLoading && <div className="aiw-loading-state" role="status"><span className="aiw-spinner" aria-hidden="true" />Đang mở cuộc trò chuyện…</div>}
        {messageError && <div className="aiw-inline-error" role="alert"><p>{messageError}</p>{currentConversation && <button type="button" disabled={sending} onClick={() => openConversation(currentConversation)}><FiRefreshCw aria-hidden="true" /> Tải lại cuộc trò chuyện</button>}</div>}
        {!messageLoading && !messageError && !visibleMessages.length && <div className="aiw-welcome"><div className="aiw-welcome-art" aria-hidden="true"><span><FiActivity /></span><i /><b>DOCTIS</b></div><span className="aiw-eyebrow">Cùng bạn hiểu sức khỏe</span><h3>Chào bạn, mình là DOCTIS.</h3><p>Bạn muốn hỏi điều gì hôm nay? Có thể gửi ảnh kết quả xét nghiệm, đơn thuốc hoặc đặt câu hỏi để chuẩn bị cho buổi khám.</p><div className="aiw-prompts">{WELCOME_PROMPTS.map((prompt, index) => <button key={prompt} type="button" onClick={() => { setInput(prompt); inputRef.current?.focus(); }}><span>0{index + 1}</span>{prompt}<FiArrowUp aria-hidden="true" /></button>)}</div></div>}
        {!messageLoading && hasOlder && <button className="aiw-older-button" type="button" onClick={loadOlder} disabled={olderLoading}>{olderLoading ? "Đang tải…" : "Tải tin nhắn cũ hơn"}</button>}
        {!messageLoading && visibleMessages.map(item => <article className={`aiw-message conversation-message ${item.role === "user" ? "is-user" : "is-assistant"} ${item.status === "failed" ? "is-failed" : ""}`} key={item.id}>
          <div className="aiw-message-label"><span>{item.role === "user" ? "Bạn" : "DOCTIS"}</span>{item.createdAt && <time dateTime={item.createdAt}>{aiDateLabel(item.createdAt, true)}</time>}{item.provider === "records" && <small>Từ hồ sơ đã lưu</small>}</div>
          <div className="aiw-message-bubble">{item.content && (item.role === "assistant" && item.animate ? <AIResponse message={item} onReveal={followReply} /> : <span className="aiw-message-text">{item.content}</span>)}{item.attachments?.length > 0 && <div className="aiw-message-attachments">{item.attachments.map((attachment, index) => attachmentTile(attachment, conversationId(attachment) || attachment.localId || index))}</div>}</div>
          {item.optimistic && <small className="aiw-message-state">Đang gửi…</small>}{item.status === "pending" && <small className="aiw-message-state">Đang chờ phản hồi. Bạn có thể tải lại cuộc trò chuyện để cập nhật.</small>}{item.status === "failed" && <small className="aiw-message-state is-error"><FiAlertCircle aria-hidden="true" />{item.errorMessage || "Tin nhắn chưa nhận được phản hồi AI."}</small>}
        </article>)}
        {sending && <div className="aiw-thinking" role="status"><span className="aiw-thinking-dots" aria-hidden="true"><i /><i /><i /></span> Đang gửi và chờ phản hồi…</div>}
      </div>
      <ConversationNotice viewport={{ pending: unread, jumpToLatest }} />
      <div className="aiw-composer-area">
        {composerError && <div className="aiw-composer-error" role="alert"><FiAlertCircle aria-hidden="true" /><span>{composerError}</span></div>}
        <form className="aiw-composer" onSubmit={sendMessage}>
          {attachments.length > 0 && <div className="aiw-draft-attachments" aria-label="Tệp đang đính kèm">{attachments.map(item => attachmentTile(item, item.localId, true))}</div>}
          <label className="aiw-sr-only" htmlFor={`${historyId}-input`}>Nhập câu hỏi cho DOCTIS</label><textarea id={`${historyId}-input`} ref={inputRef} rows={2} maxLength={MAX_AI_MESSAGE_LENGTH} placeholder="Hỏi DOCTIS hoặc gửi kết quả khám của bạn…" value={input} disabled={sending || messageLoading} onChange={event => { setInput(event.target.value); setComposerError(""); }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); sendMessage(); } }} />
          <div className="aiw-composer-toolbar"><div><button className="aiw-icon-button" type="button" aria-label="Đính kèm ảnh hoặc tệp" title="Ảnh, PDF, TXT, CSV · tối đa 4 tệp, tổng 2 MB" disabled={preparing || sending || messageLoading} onClick={() => fileRef.current?.click()}><FiPaperclip aria-hidden="true" /></button><button className="aiw-icon-button" type="button" aria-label="Chụp ảnh để gửi DOCTIS" disabled={preparing || sending || messageLoading} onClick={() => cameraRef.current?.click()}><FiCamera aria-hidden="true" /></button><span className="aiw-attachment-limit">{preparing ? "Đang chuẩn bị tệp…" : "Tối đa 4 tệp · tổng 2 MB"}</span></div><span className="aiw-input-count">{input.length}/{MAX_AI_MESSAGE_LENGTH}</span><button className="aiw-send-button" type="submit" disabled={sending || preparing || messageLoading || (!input.trim() && !attachments.length)} aria-label={sending ? "Đang gửi câu hỏi" : "Gửi câu hỏi"}>{sending ? <span className="aiw-spinner" aria-hidden="true" /> : <FiArrowUp aria-hidden="true" />}<span>{sending ? "Đang gửi" : "Gửi"}</span></button></div>
          <input ref={fileRef} className="aiw-sr-only" type="file" accept={AI_ATTACHMENT_ACCEPT} multiple tabIndex={-1} aria-label="Chọn ảnh hoặc tệp đính kèm" onChange={selectFiles} /><input ref={cameraRef} className="aiw-sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" tabIndex={-1} aria-label="Chọn ảnh từ máy ảnh" onChange={selectFiles} />
        </form>
        <p className="aiw-disclaimer">Thông tin AI chỉ để tham khảo, không thay thế chẩn đoán hoặc hướng dẫn điều trị của bác sĩ.</p>
      </div>
    </div>

    {renameTarget && <WorkspaceDialog title="Đổi tên cuộc trò chuyện" onClose={() => setRenameTarget(null)} busy={dialogBusy} returnFocusRef={inputRef}><form onSubmit={renameConversation}><label htmlFor={`${historyId}-rename`}>Tên cuộc trò chuyện</label><input id={`${historyId}-rename`} value={renameTitle} maxLength={50} onChange={event => setRenameTitle(event.target.value)} autoComplete="off" /><small>Tối đa 50 ký tự.</small>{dialogError && <p className="aiw-inline-error" role="alert">{dialogError}</p>}<footer><button type="button" className="aiw-secondary-button" onClick={() => setRenameTarget(null)} disabled={dialogBusy}>Hủy</button><button type="submit" className="aiw-primary-button" disabled={dialogBusy || !renameTitle.trim()}>{dialogBusy ? "Đang lưu…" : "Lưu tên"}</button></footer></form></WorkspaceDialog>}
    {deleteTarget && <WorkspaceDialog title="Xóa cuộc trò chuyện?" onClose={() => setDeleteTarget(null)} busy={dialogBusy} returnFocusRef={inputRef}><p>Cuộc trò chuyện “{conversationTitle(deleteTarget.title)}” và các tệp liên quan sẽ bị xóa. Thao tác này không thể hoàn tác.</p>{dialogError && <p className="aiw-inline-error" role="alert">{dialogError}</p>}<footer><button type="button" className="aiw-secondary-button" onClick={() => setDeleteTarget(null)} disabled={dialogBusy}>Giữ lại</button><button type="button" className="aiw-danger-button" onClick={deleteConversation} disabled={dialogBusy}>{dialogBusy ? "Đang xóa…" : "Xóa cuộc trò chuyện"}</button></footer></WorkspaceDialog>}
    {viewer && <WorkspaceDialog title={viewer.attachment?.name || "Tệp đính kèm"} onClose={closeViewer} className="aiw-file-dialog" returnFocusRef={inputRef}>{viewer.loading ? <p className="aiw-loading-state" role="status"><span className="aiw-spinner" aria-hidden="true" /> Đang tải tệp…</p> : viewer.error ? <p className="aiw-inline-error" role="alert">{viewer.error}</p> : <>{viewer.attachment?.mimeType?.startsWith("image/") && ["image/jpeg", "image/png", "image/webp"].includes(viewer.attachment.mimeType) ? <img className="aiw-large-image" src={viewer.url} alt={viewer.attachment.name || "Ảnh đính kèm"} /> : <div className="aiw-file-summary"><FiFileText aria-hidden="true" /><p>{viewer.attachment?.mimeType === "application/pdf" ? "Tệp PDF" : "Tệp văn bản"} · {formatAttachmentSize(viewer.attachment?.size || 0)}</p><span>Tải về để xem đầy đủ nội dung.</span></div>}<footer><a className="aiw-primary-button" href={viewer.url} download={viewer.attachment?.name || "tep-dinh-kem"}><FiDownload aria-hidden="true" /> Tải tệp về</a></footer></>}</WorkspaceDialog>}
  </section>;
}
