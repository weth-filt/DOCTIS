import CareScene from "./CareScene";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import useLiveReducedMotion from "./useLiveReducedMotion";

/** Lightweight CSS 3D artwork, not a WebGL/Three.js model. */
export default function HealthStudioMark({ kind = "health", icon, label, size = "regular" }) {
  const hostRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState !== "hidden");
  const reduceMotion = useLiveReducedMotion();

  useEffect(() => {
    const host = hostRef.current;
    const updateVisibility = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", updateVisibility);
    let observer;
    if (host && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.1 });
      observer.observe(host);
    }
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      observer?.disconnect();
    };
  }, []);

  const floating = size === "hero" && inView && pageVisible && !reduceMotion;
  const animate = floating
    ? { y: [0, -5, 0], rotateZ: [-1.5, 1, -1.5] }
    : { y: 0, rotateZ: 0 };

  return (
    <div ref={hostRef} className={`health-studio-mark ${kind} ${size}`} aria-hidden="true">
      <motion.div
        className="health-studio-object"
        animate={animate}
        transition={floating ? { duration: 7.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
      >
        {size === "hero" ? <CareScene kind={kind} /> : <>
        <span className="studio-object-shadow" />
        <span className="studio-object-back" />
        <span className="studio-object-side" />
        <span className="studio-object-face">{icon}</span>
        <span className="studio-object-highlight" />
        </>}
      </motion.div>
      {label && <span className="studio-object-label">{label}</span>}
    </div>
  );
}
