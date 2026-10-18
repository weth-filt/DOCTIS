import { useEffect, useRef, useState } from "react";
import useLiveReducedMotion from "../useLiveReducedMotion";

let gsapPromise;
const loadGsap = () => (gsapPromise ||= import("gsap").then(module => module.gsap || module.default));

/** Presentation-only layer. It never fetches data or owns a form/chat state. */
export default function StudioExperience({ page, smoothScroll = false }) {
  const hostRef = useRef(null);
  const cursorRef = useRef(null);
  const [desktopCursor, setDesktopCursor] = useState(false);
  const reduced = useLiveReducedMotion();

  useEffect(() => {
    if (!window.matchMedia || reduced) { setDesktopCursor(false); return; }
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setDesktopCursor(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [reduced]);

  useEffect(() => {
    if (!desktopCursor || reduced) return;
    const root = hostRef.current?.closest("[data-studio-theme]");
    const cursor = cursorRef.current;
    if (!root || !cursor) return;
    let frame;
    let x = 0;
    let y = 0;
    const move = event => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      x = event.clientX;
      y = event.clientY;
      cursor.dataset.visible = "true";
      cursor.dataset.interactive = Boolean(event.target.closest("button,a,[role=button],[data-studio-drag]"));
      if (!frame) frame = window.requestAnimationFrame(() => {
        cursor.style.transform = `translate3d(${x}px,${y}px,0)`;
        frame = null;
      });
    };
    const leave = () => { cursor.dataset.visible = "false"; };
    root.addEventListener("pointermove", move, { passive: true });
    root.addEventListener("pointerleave", leave);
    return () => { root.removeEventListener("pointermove", move); root.removeEventListener("pointerleave", leave); window.cancelAnimationFrame(frame); };
  }, [desktopCursor, reduced]);

  useEffect(() => {
    const root = hostRef.current?.closest("[data-studio-theme]");
    if (!root || reduced || typeof IntersectionObserver === "undefined") return;
    let cancelled = false;
    const animations = [];
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting || entry.target.dataset.studioRevealed) return;
      const node = entry.target;
      node.dataset.studioRevealed = "true";
      observer.unobserve(node);
      loadGsap().then(gsap => {
        if (!cancelled && node.isConnected) animations.push(gsap.fromTo(node, { opacity: .25, y: 18 }, { opacity: 1, y: 0, duration: .65, ease: "power3.out", clearProps: "opacity,transform" }));
      }).catch(() => {});
    }), { threshold: .12, rootMargin: "0px 0px -24px 0px" });
    root.querySelectorAll("[data-studio-reveal],.studio-scroll-reveal").forEach(node => observer.observe(node));
    return () => { cancelled = true; observer.disconnect(); animations.forEach(animation => { animation.progress(1); animation.kill(); }); };
  }, [page, reduced]);

  useEffect(() => {
    // Only a parent explicitly opting into document scrolling enables Lenis.
    // Conversation/drawer/form wheel targets always retain native scrolling.
    if (!smoothScroll || reduced || ["ai", "doctor-chat", "messages"].includes(page)) return;
    let cancelled = false;
    let teardown;
    Promise.all([import("lenis"), loadGsap(), import("gsap/ScrollTrigger")]).then(([lenisModule, gsap, triggerModule]) => {
      if (cancelled) return;
      const ScrollTrigger = triggerModule.ScrollTrigger || triggerModule.default;
      gsap.registerPlugin(ScrollTrigger);
      const Lenis = lenisModule.default;
      const lenis = new Lenis({
        duration: .85, smoothWheel: true, syncTouch: false,
        prevent: node => Boolean(node.closest?.("input,textarea,select,[data-lenis-prevent],.conversation-workspace,.chat-body,.patient-drawer,[role=dialog]")),
      });
      const tick = time => lenis.raf(time * 1000);
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(tick);
      teardown = () => { gsap.ticker.remove(tick); lenis.off("scroll", ScrollTrigger.update); lenis.destroy(); };
    }).catch(() => {});
    return () => { cancelled = true; teardown?.(); };
  }, [page, smoothScroll, reduced]);

  return <>
    <span ref={hostRef} className="studio-experience-host" aria-hidden="true" />
    {desktopCursor && !reduced && <div ref={cursorRef} className="studio-experience-cursor" aria-hidden="true"><i /><span /></div>}
  </>;
}
