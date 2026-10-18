import { useCallback, useId, useLayoutEffect, useRef } from "react";
import useLiveReducedMotion from "./useLiveReducedMotion";

const OVERLAYS = ".studio-transition-layer, .studio-transition-snapshot, .studio-page-sweep";
export const WORKSPACE_SCENE_MOTION = Object.freeze({ duration: 340, delay: 80, stagger: 70, exit: 180, sweep: 620 });

function visibleWorkspace(surface) {
  const rect = surface.getBoundingClientRect();
  const header = surface.closest(".studio-main-shell")?.querySelector(".studio-topbar");
  const top = Math.max(0, rect.top, header?.getBoundingClientRect().bottom || 0);
  return { rect, top, left: Math.max(0, rect.left), width: rect.width || surface.clientWidth || window.innerWidth, height: Math.max(0, window.innerHeight - top) };
}

function setViewportBounds(node, bounds) {
  Object.assign(node.style, { position: "fixed", top: `${bounds.top}px`, bottom: "auto", left: `${bounds.left}px`, right: "auto", width: `${bounds.width}px`, height: `${bounds.height}px`, pointerEvents: "none" });
}

const PRESENTATION_GROUPS = [
  ".overview-intro", ".overview-metrics", ".overview-workbench", ".overview-insights", ".overview-library",
  ".profile-page-header", ".studio-profile-section", ".studio-form-title", ".studio-form-subtitle",
  ".form-grid > *", ".health-save-area", ".measurement-panel", ".admin-hero",
  ".role-overview-stage", ".admin-stat-grid > *", ".admin-dashboard-grid > *", ".doctor-grid > *", ".doctor-section", ".patient-grid > *",
].join(", ");

function presentationGroups(surface) {
  const groups = [...surface.querySelectorAll(PRESENTATION_GROUPS)];
  // A card inside a section must not receive a second transform from this hook.
  return groups.length
    ? groups.filter(node => !groups.some(parent => parent !== node && parent.contains(node)))
    : [...surface.children];
}

const ID_REFERENCES = new Set([
  "for", "headers", "list", "form", "aria-labelledby", "aria-describedby", "aria-controls", "aria-owns", "aria-activedescendant",
]);

function scopeSnapshotIds(snapshot, prefix) {
  const nodes = [snapshot, ...snapshot.querySelectorAll("*")];
  const ids = new Map();
  nodes.forEach((node) => {
    if (node.id) {
      const scoped = `${prefix}-${ids.size}`;
      ids.set(node.id, scoped);
      node.id = scoped;
    }
  });
  const paintReferences = value => value.replace(/url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g,
    (reference, quote, id) => ids.has(id) ? `url(${quote}#${ids.get(id)}${quote})` : reference);
  nodes.forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const { name, value } = attribute;
      let scoped = paintReferences(value);
      if ((name === "href" || name === "xlink:href") && value.startsWith("#") && ids.has(value.slice(1))) {
        scoped = `#${ids.get(value.slice(1))}`;
      } else if (ID_REFERENCES.has(name)) {
        scoped = value.split(/\s+/).map(id => ids.get(id) || id).join(" ");
      }
      if (scoped !== value) node.setAttribute(name, scoped);
    });
    if (node.localName === "style") node.textContent = paintReferences(node.textContent);
  });
}

// Animate presentation nodes only. State, forms and API effects stay in the page.
export function useWorkspaceMotion(page, updatePage, pageOrder) {
  const screenRef = useRef(null);
  const outgoing = useRef(null);
  const active = useRef([]);
  const direction = useRef(1);
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const snapshotSequence = useRef(0);
  const previousPage = useRef(page);
  const scrollPositions = useRef(new Map());
  const reduceMotion = useLiveReducedMotion();
  const navigate = useCallback((next) => {
    if (next === page) return;
    const order = pageOrder || ["dashboard", "profile", "health", "analytics", "ai", "care-plan", "appointments", "doctor-chat", "advices"];
    direction.current = order.indexOf(next) >= order.indexOf(page) ? 1 : -1;
    scrollPositions.current.set(page, window.scrollY || window.pageYOffset || 0);
    active.current.forEach((animation) => animation.cancel());
    active.current = [];
    outgoing.current = null;
    screenRef.current?.querySelectorAll(OVERLAYS).forEach((node) => node.remove());
    if (screenRef.current && !reduceMotion) {
      const surface = screenRef.current;
      const bounds = visibleWorkspace(surface);
      const snapshot = surface.cloneNode(true);
      const sourceNodes = surface.querySelectorAll("*");
      snapshot.querySelectorAll("*").forEach((node, index) => {
        const source = sourceNodes[index];
        // Freeze the displayed draft; this clone is inert and never submits.
        if (source.type !== "file" && "value" in source && "value" in node) node.value = source.value;
        if ("checked" in source) node.checked = source.checked;
        node.style.animation = "none";
        node.style.transition = "none";
        if (source.scrollTop || source.scrollLeft) {
          node.dataset.snapshotScroll = `${source.scrollTop},${source.scrollLeft}`;
        }
      });
      snapshot.className = `${surface.className} studio-transition-snapshot`;
      snapshot.setAttribute("aria-hidden", "true");
      snapshot.inert = true;
      snapshot.style.pointerEvents = "none";
      Object.assign(snapshot.style, { position: "absolute", inset: "auto", top: `${bounds.rect.top - bounds.top}px`, left: "0", width: `${bounds.width}px`, height: `${Math.max(bounds.rect.height, surface.scrollHeight)}px`, margin: "0", padding: window.getComputedStyle(surface).padding, overflow: "hidden" });
      // Outgoing graphics must keep their gradients, masks and shadows after the
      // React source unmounts. Give the clone its own definitions and references.
      scopeSnapshotIds(snapshot, `studio-snapshot-${instanceId}-${++snapshotSequence.current}`);
      const layer = document.createElement("div");
      layer.className = "studio-transition-layer";
      layer.setAttribute("aria-hidden", "true");
      layer.inert = true;
      setViewportBounds(layer, bounds);
      layer.append(snapshot);
      outgoing.current = layer;
    }
    updatePage(next);
  }, [page, reduceMotion, updatePage, pageOrder, instanceId]);

  useLayoutEffect(() => {
    const surface = screenRef.current;
    if (!surface || typeof surface.animate !== "function") return;
    if (previousPage.current !== page) window.scrollTo({ top: scrollPositions.current.get(page) || 0, behavior: "instant" });
    previousPage.current = page;
    active.current = [];
    const children = presentationGroups(surface);
    if (outgoing.current && !reduceMotion) {
      const layer = outgoing.current;
      outgoing.current = null;
      surface.append(layer);
      layer.querySelectorAll("[data-snapshot-scroll]").forEach((node) => {
        const [top, left] = node.dataset.snapshotScroll.split(",").map(Number);
        node.scrollTop = top;
        node.scrollLeft = left;
        delete node.dataset.snapshotScroll;
      });
      const animation = layer.animate([{ opacity: 1, transform: "translateX(0)" }, { opacity: 0, transform: `translateX(${-18 * direction.current}px)` }], { duration: WORKSPACE_SCENE_MOTION.exit, easing: "ease-out", fill: "both" });
      animation.onfinish = () => layer.remove();
      animation.oncancel = () => layer.remove();
      active.current.push(animation);
    }
    outgoing.current = null;
    children.forEach((child, index) => {
      const isOverview = child.matches(".overview-intro, .overview-metrics, .overview-workbench, .overview-insights, .overview-library");
      active.current.push(child.animate([
        { opacity: 0, transform: reduceMotion ? "none" : isOverview
          ? `translate3d(${18 * direction.current}px, 8px, 0)`
          : `translateX(${18 * direction.current}px)` },
        { opacity: 1, transform: "none" },
        // A shared inter-function scene; extra groups share the final beat.
      ], { duration: reduceMotion ? 80 : WORKSPACE_SCENE_MOTION.duration, delay: reduceMotion ? 0 : WORKSPACE_SCENE_MOTION.delay + Math.min(index, 4) * WORKSPACE_SCENE_MOTION.stagger, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" }));
    });
    if (!reduceMotion) {
      const sweep = document.createElement("div");
      sweep.className = "studio-page-sweep";
      sweep.setAttribute("aria-hidden", "true");
      sweep.style.pointerEvents = "none";
      const bounds = visibleWorkspace(surface);
      setViewportBounds(sweep, { ...bounds, width: bounds.width * .65 });
      surface.append(sweep);
      const animation = sweep.animate([{ transform: `translateX(${direction.current > 0 ? -110 : 165}%)`, opacity: 0 }, { opacity: 0.3, offset: 0.38 }, { transform: `translateX(${direction.current > 0 ? 165 : -110}%)`, opacity: 0 }], { duration: WORKSPACE_SCENE_MOTION.sweep, easing: "cubic-bezier(.22,1,.36,1)" });
      animation.onfinish = () => sweep.remove();
      animation.oncancel = () => sweep.remove();
      active.current.push(animation);
    }
    return () => {
      active.current.forEach((animation) => animation.cancel());
      surface.querySelectorAll(OVERLAYS).forEach((node) => node.remove());
    };
  }, [page, reduceMotion]);

  return { screenRef, navigate };
}
