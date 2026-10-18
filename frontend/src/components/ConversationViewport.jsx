import { useLayoutEffect, useRef, useState } from "react";
import useLiveReducedMotion from "./useLiveReducedMotion";

// Display state only: no requests, message mutation, or simulated presence.
export function useConversationViewport(containerRef, id, messages, active, loading = false) {
  const positions = useRef(new Map());
  const previous = useRef({ id: null, count: 0, active: false });
  const nearEnd = useRef(true);
  const [pending, setPending] = useState(0);
  const reduced = useLiveReducedMotion();
  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!active || !node || loading) {
      previous.current.active = false;
      return;
    }
    const prior = previous.current;
    if (!prior.active || prior.id !== id) {
      const saved = positions.current.get(id);
      node.scrollTop = saved?.top ?? node.scrollHeight;
      nearEnd.current = saved?.nearEnd ?? true;
      setPending(0);
    } else if (messages.length > prior.count && !nearEnd.current) {
      setPending(value => value + messages.length - prior.count);
    }
    previous.current = { id, count: messages.length, active: true };
  }, [active, containerRef, id, loading, messages]);
  const onScroll = event => {
    const node = event.currentTarget;
    nearEnd.current = node.scrollHeight - node.scrollTop - node.clientHeight < 96;
    positions.current.set(id, { top: node.scrollTop, nearEnd: nearEnd.current });
    if (nearEnd.current) setPending(0);
  };
  const jumpToLatest = () => {
    const node = containerRef.current;
    if (!node) return;
    nearEnd.current = true;
    setPending(0);
    node.scrollTo({ top: node.scrollHeight, behavior: reduced ? "instant" : "smooth" });
  };
  return { pending, onScroll, jumpToLatest };
}

export function ConversationNotice({ viewport }) {
  if (!viewport.pending) return null;
  return <div className="conversation-new-message" role="status"><button type="button" onClick={viewport.jumpToLatest}>{viewport.pending} tin mới · Xem tin cuối ↓</button></div>;
}

export function ConversationBack({ onClick }) {
  return <button type="button" className="conversation-back" onClick={onClick} aria-label="Quay lại danh sách hội thoại">← <span>Danh sách</span></button>;
}
