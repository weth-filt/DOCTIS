import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FaArrowLeft, FaArrowRight, FaCheck, FaRunning, FaCapsules, FaUtensils } from "react-icons/fa";
import useLiveReducedMotion from "../useLiveReducedMotion";
import "../../CSS/patient-functions.css";

const activitiesFor = (day) => [
  ...(day.meals || []).map((item) => ({ ...item, kind: "meal" })),
  ...(day.medications || []).map((item) => ({ ...item, kind: "medication" })),
  day.exercise ? { ...day.exercise, kind: "exercise", description: day.exercise.duration } : null,
].filter(Boolean).sort((a, b) => String(a.time).localeCompare(String(b.time)));

export default function CareWeekGallery({ days = [], activeDay = 0, onSelectDay, onToggleActivity }) {
  const reduced = useLiveReducedMotion();
  const shell = useRef(null);
  const gallery = useRef(null);
  const previousCompletion = useRef({});
  const [celebrating, setCelebrating] = useState(null);
  useEffect(() => {
    let newlyCompleted = null;
    days.forEach((day, index) => {
      const activities = activitiesFor(day);
      const completed = activities.length > 0 && activities.every((item) => item.done);
      if (completed && previousCompletion.current[index] === false) newlyCompleted = index;
      previousCompletion.current[index] = completed;
    });
    if (newlyCompleted !== null) {
      setCelebrating(newlyCompleted);
    }
  }, [days]);
  useEffect(() => {
    if (celebrating === null) return;
    const timer = window.setTimeout(() => setCelebrating(null), 650);
    return () => window.clearTimeout(timer);
  }, [celebrating]);
  useLayoutEffect(() => {
    const host = shell.current;
    const track = gallery.current;
    if (reduced || !days.length || !host || !track || !window.matchMedia) return;
    const desktop = window.matchMedia("(min-width: 1200px) and (hover: hover) and (pointer: fine)");
    let cancelled = false;
    let frame;
    let generation = 0;
    let activeKey = "";
    let trigger;
    let animation;
    const release = () => {
      trigger?.kill(true);
      animation?.kill();
      trigger = null;
      animation = null;
      activeKey = "";
      delete host.dataset.scrollMode;
    };
    const configure = () => {
      const sequence = ++generation;
      const overflow = Math.max(0, track.scrollWidth - track.clientWidth);
      const height = host.getBoundingClientRect().height;
      // Long clinical plans remain ordinary native scroll areas. A pinned
      // section must fit under the header, including its tallest activity card.
      if (!desktop.matches || overflow <= 4 || height <= 0 || height >= window.innerHeight - 140) {
        release();
        return;
      }
      const headerHeight = host.closest(".studio-main-shell")?.querySelector(".studio-topbar")?.getBoundingClientRect().height || 88;
      const top = Math.min(140, Math.max(96, headerHeight + 12));
      const key = `${Math.round(overflow)}:${Math.round(height)}:${Math.round(top)}`;
      if (key === activeKey) return;
      Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([gsapModule, triggerModule]) => {
        if (cancelled || sequence !== generation || !desktop.matches) return;
        const gsap = gsapModule.gsap || gsapModule.default;
        const ScrollTrigger = triggerModule.ScrollTrigger || triggerModule.default;
        gsap.registerPlugin(ScrollTrigger);
        release();
        const progress = { value: 0 };
        const previousLeft = track.scrollLeft;
        animation = gsap.to(progress, {
          value: overflow, duration: 1, ease: "none", paused: true,
          onUpdate: () => { track.scrollLeft = progress.value; },
        });
        trigger = ScrollTrigger.create({
          trigger: host, pin: host, animation,
          start: `top ${top}px`,
          end: `+=${Math.min(1800, Math.max(180, overflow * .9))}`,
          scrub: .3, anticipatePin: 1, invalidateOnRefresh: true,
        });
        // Initializing the trigger must not reset a manually selected day.
        if (!trigger.isActive) track.scrollLeft = previousLeft;
        host.dataset.scrollMode = "pinned";
        activeKey = key;
      }).catch(() => { if (!cancelled && sequence === generation) release(); });
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(configure);
    };
    desktop.addEventListener?.("change", schedule);
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    observer?.observe(host);
    observer?.observe(track);
    configure();
    return () => {
      cancelled = true;
      generation += 1;
      window.cancelAnimationFrame(frame);
      desktop.removeEventListener?.("change", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
      release();
    };
  }, [reduced, days.length]);
  const move = (direction) => gallery.current?.scrollBy({ left: direction * 270, behavior: reduced ? "instant" : "smooth" });
  return <div className="care-gallery-shell" ref={shell}>
    <div className="care-gallery-toolbar"><p>Chọn ngày và theo dõi các việc đã hoàn thành.</p><div><button type="button" onClick={() => move(-1)} aria-label="Xem ngày trước"><FaArrowLeft /></button><button type="button" onClick={() => move(1)} aria-label="Xem ngày tiếp theo"><FaArrowRight /></button></div></div>
    <div className="care-week-gallery" ref={gallery} aria-label="Lịch chăm sóc theo ngày">{days.map((day, dayIndex) => {
      const activities = activitiesFor(day);
      const completed = activities.filter((item) => item.done).length;
      const progress = activities.length ? Math.round(completed / activities.length * 100) : 0;
      return <motion.article key={day.label || dayIndex} className={`care-gallery-card ${activeDay === dayIndex ? "is-active" : ""} ${celebrating === dayIndex && !reduced ? "is-celebrating" : ""}`} initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .1 }} transition={{ duration: reduced ? 0 : .3, delay: reduced ? 0 : Math.min(dayIndex, 3) * .035 }}>
        <button type="button" className="care-gallery-day" aria-pressed={activeDay === dayIndex} onClick={() => onSelectDay?.(dayIndex)}><span className="care-gallery-day-number">{String(dayIndex + 1).padStart(2, "0")}</span><div><span>Ngày chăm sóc</span><h4>{day.label || `Ngày ${dayIndex + 1}`}</h4></div><svg className="care-progress-ring" viewBox="0 0 44 44" aria-label={`Hoàn thành ${progress}%`}><circle cx="22" cy="22" r="18" /><motion.circle cx="22" cy="22" r="18" initial={false} animate={{ strokeDashoffset: 113.1 * (1 - progress / 100) }} transition={{ duration: reduced ? 0 : .3 }} /><text x="22" y="25" textAnchor="middle">{progress}%</text></svg></button>
        <div className="care-gallery-tally"><span>{completed} / {activities.length} việc đã xong</span>{progress === 100 && activities.length > 0 && <span><FaCheck /> Hoàn thành</span>}</div>
        <div className="care-gallery-activities">{activities.map((item) => <button key={`${item.id}-${item.time}`} type="button" className={`care-gallery-activity ${item.done ? "completed" : ""}`} aria-pressed={!!item.done} onClick={() => { onSelectDay?.(dayIndex); onToggleActivity?.(dayIndex, item.id); }}><span className="care-gallery-activity-icon">{item.kind === "meal" ? <FaUtensils /> : item.kind === "medication" ? <FaCapsules /> : <FaRunning />}</span><div><time>{item.time}</time><strong>{item.title || item.label}</strong><p>{item.text || item.description || ""}</p></div><span className="care-gallery-check"><svg viewBox="0 0 20 20"><motion.path d="m4 10 4 4 8-8" initial={false} animate={{ pathLength: item.done ? 1 : 0 }} transition={{ duration: reduced ? 0 : .2 }} /></svg></span></button>)}</div>
        {celebrating === dayIndex && !reduced && <div className="care-completion-sparks" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((spark) => <i key={spark} style={{ "--spark-angle": `${spark * 60}deg` }} />)}</div>}
      </motion.article>;
    })}</div>
  </div>;
}
