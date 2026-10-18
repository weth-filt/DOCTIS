import { motion } from "framer-motion";
import { useId } from "react";
import useLiveReducedMotion from "./useLiveReducedMotion";
import CareScene from "./CareScene";
import "../CSS/workspace-primitives.css";

export function WorkspaceTabs({ label, options, value, onChange }) {
  const id = useId();
  const reduced = useLiveReducedMotion();
  return <div className="workspace-tabs" role="group" aria-label={label}>{options.map(option =>
    <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
      {value === option.value && <motion.i layoutId={`${id}-selection`} transition={{ duration: reduced ? 0 : .18 }} />}
      <span>{option.label}</span>{option.count !== undefined && <small>{option.count}</small>}
    </button>)}</div>;
}

export function WorkspaceIntro({ title, description, kind = "profile", children }) {
  return <section className="workspace-intro"><div className="workspace-intro-copy"><h2>{title}</h2><p>{description}</p>{children}</div><CareScene kind={kind} className="small" /></section>;
}

export function WorkspaceNotice({ feedback, onClose }) {
  const reduced = useLiveReducedMotion();
  if (!feedback) return null;
  return <motion.div className={`workspace-notice ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"} initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : 5 }} transition={{ duration: reduced ? .08 : .18 }}><span aria-hidden="true">{feedback.type === "error" ? "!" : "✓"}</span><p>{feedback.text}</p><button type="button" aria-label="Đóng thông báo" onClick={onClose}>×</button></motion.div>;
}
