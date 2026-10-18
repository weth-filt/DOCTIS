import { useLayoutEffect, useRef } from "react";
import useLiveReducedMotion from "./useLiveReducedMotion";

export function useConversationMotion(containerRef, conversationId, messages, loading) {
  const previous = useRef({ conversationId: null, count: 0, initialized: false });
  const reduced = useLiveReducedMotion();
  useLayoutEffect(() => {
    const container = containerRef.current;
    const state = previous.current;
    const changed = state.conversationId !== conversationId;
    if (!container || loading) {
      if (changed || loading) previous.current = { conversationId, count: 0, initialized: false };
      return;
    }
    const animations = [];
    if (changed || !state.initialized) {
      if (container.animate && !reduced) animations.push(container.animate([{ opacity: 0, transform: "translateX(8px)" }, { opacity: 1, transform: "none" }], { duration: 180 }));
    } else if (messages.length > state.count && !reduced) {
      [...container.querySelectorAll(".conversation-message")].slice(-(messages.length - state.count)).forEach((node) => {
        const animation = node.animate?.([{ opacity: 0, transform: "translateY(7px)" }, { opacity: 1, transform: "none" }], { duration: 180, easing: "ease-out" });
        if (animation) animations.push(animation);
      });
    }
    previous.current = { conversationId, count: messages.length, initialized: true };
    return () => animations.forEach((animation) => animation.cancel());
  }, [containerRef, conversationId, messages, loading, reduced]);
}
