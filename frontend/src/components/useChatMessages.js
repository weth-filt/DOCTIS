import { useCallback, useRef, useState } from "react";
import { chatMessageId, confirmChatMessage, isPendingChatMessage, mergeChatMessages } from "../utils/chatMessages";

// Component-lifetime memory only. Responses always belong to the conversation
// that requested them, even when selection changes before a request completes.
export default function useChatMessages() {
  const [messages, setMessages] = useState([]);
  const current = useRef("");
  const conversations = useRef(new Map());
  const update = useCallback((id, change) => {
    const key = String(id);
    const previous = conversations.current.get(key) || [];
    const next = change(previous);
    conversations.current.set(key, next);
    if (current.current === key) setMessages(next);
  }, []);
  const selectConversation = useCallback(id => {
    current.current = String(id);
    setMessages(conversations.current.get(String(id)) || []);
  }, []);
  const isActive = useCallback(id => current.current === String(id), []);
  const hasMessages = useCallback(id => Boolean(conversations.current.get(String(id))?.length), []);
  const hasPending = useCallback(id => Boolean(conversations.current.get(String(id))?.some(isPendingChatMessage)), []);
  const receiveMessages = useCallback((id, incoming) => update(id, previous => {
    // A poll can observe a committed message before POST returns its ID. Wait
    // for that acknowledgement instead of showing both its temp and server row.
    if (previous.some(isPendingChatMessage)) return previous;
    return mergeChatMessages(previous, incoming);
  }), [update]);
  const addPending = useCallback((id, message) => update(id, previous =>
    mergeChatMessages(previous, [{ ...message, _clientKey: chatMessageId(message) }])), [update]);
  const confirmPending = useCallback((id, temporaryId, saved) => update(id, previous =>
    confirmChatMessage(previous, temporaryId, saved)), [update]);
  const rejectPending = useCallback((id, temporaryId) => update(id, previous =>
    previous.filter(message => chatMessageId(message) !== temporaryId)), [update]);
  return { messages, selectConversation, isActive, hasMessages, hasPending, receiveMessages, addPending, confirmPending, rejectPending };
}
