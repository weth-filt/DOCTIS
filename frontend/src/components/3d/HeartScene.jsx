import { Component, createContext, lazy, Suspense, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import useLiveReducedMotion from "../useLiveReducedMotion";
import { useStudioPreferences } from "../studio/StudioPreferences";
import { heartTone, highestPrioritySlot, rectIsVisible } from "./sceneData";
import "../../CSS/heart-scene.css";

const HeartWebGL = lazy(() => import("./HeartWebGL"));
const HeartContext = createContext(null);

export function HeartFallback({ status = "neutral" }) {
  const id = useId().replace(/:/g, "");
  const tint = heartTone(status);
  return <svg className="heart-fallback" viewBox="0 0 360 300" aria-hidden="true">
    <defs><linearGradient id={`${id}-heart`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e0fff8"/><stop offset=".4" stopColor={tint}/><stop offset="1" stopColor="#08777b"/></linearGradient><filter id={`${id}-shadow`} x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#001b1c" floodOpacity=".25"/></filter></defs>
    <ellipse cx="180" cy="253" rx="66" ry="9" fill="#001c1d" opacity=".16"/>
    <ellipse cx="180" cy="154" rx="142" ry="61" fill="none" stroke={tint} opacity=".4" transform="rotate(-25 180 154)"/>
    <path d="M180 93C150 28 74 67 83 119c8 47 97 108 97 108s89-61 97-108c9-52-67-91-97-26Z" fill={`url(#${id}-heart)`} stroke="#c8fff2" strokeWidth="1.5" filter={`url(#${id}-shadow)`}/>
    <path d="m108 127 31 2 14-23 19 67 21-49 10 17h46" fill="none" stroke="#f1fffc" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="m180 93-8 80 8 54m-97-108 89 54 105-54M180 93l-97 26m97-26 97 26" fill="none" stroke="#e1fff4" opacity=".19"/>
    <circle cx="308" cy="100" r="5" fill={tint}/><circle cx="56" cy="212" r="2" fill={tint}/><circle cx="286" cy="235" r="2" fill={tint}/>
  </svg>;
}

export class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure?.(); }
  render() { return this.state.failed ? this.props.fallback || null : this.props.children; }
}

// A single canvas follows live DOM slots. No health data leaves this browser.
export function HeartSceneProvider({ children }) {
  const slots = useRef(new Map());
  const [target, setTarget] = useState(null);
  const [bounds, setBounds] = useState(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const reduced = useLiveReducedMotion();
  const { deviceTilt } = useStudioPreferences();
  const onFailure = useCallback(() => { setFailed(true); setReady(false); }, []);
  const onReady = useCallback(() => setReady(true), []);
  const updateTarget = useCallback(() => setTarget(current => {
    const next = highestPrioritySlot(slots.current);
    return current?.id === next?.id && current?.node === next?.node && current?.bpm === next?.bpm && current?.status === next?.status && current?.busy === next?.busy && current?.pointer === next?.pointer && current?.priority === next?.priority ? current : next;
  }), []);
  const register = useCallback((id, entry) => {
    slots.current.set(id, entry);
    updateTarget();
    return () => {
      slots.current.delete(id);
      updateTarget();
    };
  }, [updateTarget]);
  useLayoutEffect(() => {
    if (!target?.node) { setBounds(null); return; }
    let frame;
    let live = true;
    let watchedEntrance = false;
    const watchEntrance = () => {
      if (watchedEntrance) return;
      watchedEntrance = true;
      const finishes = [];
      // Transform-only entrance animations do not notify ResizeObserver. Watch
      // this slot's ancestor chain once, never all page/particle animations.
      let node = target.node;
      for (let depth = 0; node && node !== document.body && depth < 16; depth += 1, node = node.parentElement) {
        try {
          node.getAnimations?.().forEach(animation => {
            const end = animation.effect?.getComputedTiming?.().endTime;
            const finished = animation.finished;
            if (["running", "pending"].includes(animation.playState) && Number.isFinite(end) && end >= 0 && end <= 1500 && typeof finished?.then === "function") finishes.push(finished);
          });
        } catch { /* Older engines still receive the two bounded settles below. */ }
      }
      if (finishes.length) Promise.allSettled(finishes).then(() => { if (live) measure("settle"); });
    };
    const measure = (flying = false) => {
      if (!live) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!live) return;
        const rect = target.node.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height);
        const shown = rectIsVisible(rect, window.innerWidth, window.innerHeight);
        setBounds({ x:rect.left + (rect.width-size)/2, y:rect.top+(rect.height-size)/2, scale:size/360, shown, flying:flying === true, settling:flying === "settle" });
        watchEntrance();
      });
    };
    measure(true);
    // A finite fallback covers CSS/Framer transforms created just after layout
    // and engines without getAnimations(). No continuous tracking RAF is used.
    const settleTimers = [750, 1100].map(delay => window.setTimeout(() => measure("settle"), delay));
    const onScroll = () => measure(false);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onScroll) : null;
    observer?.observe(target.node);
    window.addEventListener("scroll", onScroll, { passive:true, capture:true });
    window.addEventListener("resize", onScroll);
    return () => { live = false; settleTimers.forEach(timer => window.clearTimeout(timer)); cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener("scroll", onScroll, true); window.removeEventListener("resize", onScroll); };
  }, [target]);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const enabled = !!target && !reduced && !failed;
  useEffect(() => { if (!enabled) setReady(false); }, [enabled]);
  useEffect(() => {
    const pointer = target?.pointer;
    if (!enabled || reduced || !visible || !bounds?.shown || !deviceTilt || !pointer) return;
    let baseline;
    const orient = event => {
      if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
      if (!baseline) baseline = { beta:event.beta, gamma:event.gamma };
      const clamp = value => Math.max(-.5, Math.min(.5, value));
      pointer.current = { x:clamp((event.gamma-baseline.gamma)/60), y:clamp((event.beta-baseline.beta)/60) };
    };
    window.addEventListener("deviceorientation", orient, {passive:true});
    return () => { window.removeEventListener("deviceorientation", orient); pointer.current = {x:0,y:0}; };
  }, [enabled, reduced, visible, bounds?.shown, deviceTilt, target]);
  return <HeartContext.Provider value={{ register, ready:ready && enabled, targetId:target?.id }}>
    {children}
    {enabled && bounds && ((bounds.shown && visible) || ready) && <motion.div className="heart-canvas-layer" style={{zIndex:target.priority>=100?2002:11}} aria-hidden="true" initial={false}
      animate={{ x:bounds.x, y:bounds.y, scale:bounds.scale, opacity:ready && bounds.shown ? 1 : 0 }}
      transition={{ duration:bounds.flying ? .9 : bounds.settling ? .16 : 0, ease:[.76,0,.24,1] }}>
      <SceneBoundary onFailure={onFailure}><Suspense fallback={null}>
        <HeartWebGL bpm={target.bpm} status={target.status} busy={target.busy} pointer={target.pointer} active={visible && bounds.shown} onReady={onReady} onFailure={onFailure}/>
      </Suspense></SceneBoundary>
    </motion.div>}
  </HeartContext.Provider>;
}

export default function HeartScene({ bpm, status="neutral", busy=false, compact=false, className="", priority=0 }) {
  const node = useRef(null);
  const pointer = useRef({x:0,y:0});
  const context = useContext(HeartContext);
  const id = useId();
  const register = context?.register;
  useLayoutEffect(() => register?.(id, { node:node.current, bpm, status, busy, pointer, priority }), [register,id,bpm,status,busy,priority]);
  const move = event => {
    if (event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.current = { x:(event.clientX-rect.left)/rect.width-.5, y:(event.clientY-rect.top)/rect.height-.5 };
  };
  return <div ref={node} className={`heart-scene ${compact ? "is-compact" : ""} ${context?.ready && context.targetId === id ? "is-webgl-ready" : ""} ${className}`} onPointerMove={move} onPointerLeave={() => { pointer.current={x:0,y:0}; }} aria-hidden="true"><HeartFallback status={status}/><span className="heart-scene-floor"/></div>;
}
