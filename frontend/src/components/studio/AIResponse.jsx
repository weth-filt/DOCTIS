import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import useLiveReducedMotion from "../useLiveReducedMotion";

// Object identity belongs to the existing parent message list. This weak cache
// neither alters that state nor keeps historic responses alive after disposal.
const seenResponses = new WeakSet();
const screenReaderOnly = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 };

export default function AIResponse({ message, onReveal }) {
  const reduced = useLiveReducedMotion();
  const text = String(message?.text ?? "");
  const characters = useMemo(() => typeof Intl.Segmenter === "function" ? Array.from(new Intl.Segmenter("vi", { granularity: "grapheme" }).segment(text), (part) => part.segment) : Array.from(text), [text]);
  const length = characters.length;
  const current = useRef(message);
  const ownedRun = useRef(null);
  const skipped = useRef(false);
  const [visible, setVisible] = useState(() => reduced || !message || message.sender !== "ai" || message.isError || seenResponses.has(message) ? length : 0);
  const animate = !reduced && message?.sender === "ai" && !message?.isError;

  // The parent may follow the end only while the reader is already near it.
  // Notify after this text has committed; never own or force chat scrolling.
  useLayoutEffect(() => { onReveal?.(); }, [visible, onReveal]);

  useEffect(() => {
    if (current.current !== message) {
      current.current = message;
      skipped.current = false;
    }
    if (!message || typeof message !== "object" || !animate || (seenResponses.has(message) && ownedRun.current !== message) || skipped.current || !length) {
      if (message && typeof message === "object") seenResponses.add(message);
      if (!animate) skipped.current = true;
      setVisible(length);
      return;
    }
    // This is a bounded presentation reveal of an already complete API reply,
    // never a simulated network stream. Screen readers receive all text now.
    seenResponses.add(message);
    ownedRun.current = message;
    setVisible(0);
    const duration = Math.min(650, Math.max(180, length * 3));
    const started = performance.now();
    let frame;
    const reveal = () => {
      if (skipped.current) return;
      const progress = Math.min(1, (performance.now() - started) / duration);
      setVisible(Math.min(length, Math.ceil(progress * length)));
      if (progress < 1) frame = window.requestAnimationFrame(reveal);
    };
    frame = window.requestAnimationFrame(reveal);
    return () => window.cancelAnimationFrame(frame);
  }, [message, length, animate]);

  const pending = animate && visible < length;
  return <span className="assistant-response"><span style={screenReaderOnly}>{text}</span><span aria-hidden="true">{characters.slice(0, reduced ? length : visible).join("")}{pending && <span style={{ display: "inline-block", width: 2, height: "1em", marginInlineStart: 3, background: "currentColor", opacity: .6, verticalAlign: "-.12em" }} />}</span>{pending && <button type="button" className="assistant-response-skip" style={{ display: "block", marginTop: 9, padding: 0, border: 0, background: "transparent", color: "inherit", textDecoration: "underline", fontSize: 10, cursor: "pointer", opacity: .75 }} onClick={() => { skipped.current = true; setVisible(length); }}>Hiện toàn bộ câu trả lời</button>}</span>;
}
