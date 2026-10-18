import { act, render, screen, waitFor } from "@testing-library/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import CareWeekGallery from "./CareWeekGallery";

let mockReduced = false;
jest.mock("../useLiveReducedMotion", () => () => mockReduced);
jest.mock("gsap", () => ({ gsap: { registerPlugin: jest.fn(), to: jest.fn() } }));
jest.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: { create: jest.fn() } }));
jest.mock("framer-motion", () => {
  const React = require("react");
  const components = {};
  return { motion: new Proxy({}, { get: (_target, tag) => {
    if (!components[tag]) components[tag] = React.forwardRef(({ children, initial, animate, transition, whileInView, viewport, ...props }, ref) => React.createElement(tag, { ...props, ref }, children));
    return components[tag];
  } }) };
});

const originalMedia = window.matchMedia;
const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth");
const originalClient = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
const originalHeight = Object.getOwnPropertyDescriptor(window, "innerHeight");
const days = [{ label: "Ngày một", meals: [{ id: "a", time: "08:00", title: "Bữa sáng" }], medications: [] }];
let desktop;
let shellHeight;
let overflow;
let killTrigger;
let killAnimation;
beforeEach(() => {
  mockReduced = false;
  desktop = true;
  shellHeight = 260;
  overflow = 1200;
  killTrigger = jest.fn();
  killAnimation = jest.fn();
  gsap.to.mockImplementation(() => ({ kill: killAnimation }));
  ScrollTrigger.create.mockImplementation(() => ({ kill: killTrigger, isActive: false }));
  window.matchMedia = () => ({ matches: desktop, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 1000 });
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, get() { return this.classList.contains("care-week-gallery") ? 400 + overflow : 0; } });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get() { return this.classList.contains("care-week-gallery") ? 400 : 0; } });
  jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ height: shellHeight, width: 400, top: 120, left: 0, right: 400, bottom: 120 + shellHeight }));
});
afterEach(() => {
  jest.restoreAllMocks();
  window.matchMedia = originalMedia;
  if (originalWidth) Object.defineProperty(HTMLElement.prototype, "scrollWidth", originalWidth); else delete HTMLElement.prototype.scrollWidth;
  if (originalClient) Object.defineProperty(HTMLElement.prototype, "clientWidth", originalClient); else delete HTMLElement.prototype.clientWidth;
  Object.defineProperty(window, "innerHeight", originalHeight);
});

test("short overflowing desktop gallery uses bounded pin/scrub and maps only presentation scroll", async () => {
  const { container, unmount } = render(<CareWeekGallery days={days} />);
  await waitFor(() => expect(ScrollTrigger.create).toHaveBeenCalledTimes(1));
  const settings = ScrollTrigger.create.mock.calls[0][0];
  expect(settings.pin).toBe(container.querySelector(".care-gallery-shell"));
  expect(settings.scrub).toBe(.3);
  expect(Number(settings.end.replace("+=", ""))).toBeLessThanOrEqual(1800);
  const [progress, tween] = gsap.to.mock.calls[0];
  act(() => { progress.value = 600; tween.onUpdate(); });
  expect(screen.getByLabelText("Lịch chăm sóc theo ngày").scrollLeft).toBe(600);
  unmount();
  expect(killTrigger).toHaveBeenCalledWith(true);
  expect(killAnimation).toHaveBeenCalled();
});

test.each(["touch", "tall", "no-overflow", "reduced"])("%s retains the native gallery without ScrollTrigger", async (mode) => {
  if (mode === "touch") desktop = false;
  if (mode === "tall") shellHeight = 870;
  if (mode === "no-overflow") overflow = 0;
  if (mode === "reduced") mockReduced = true;
  render(<CareWeekGallery days={days} />);
  await act(async () => {});
  expect(ScrollTrigger.create).not.toHaveBeenCalled();
});

test("switching to reduced/simple motion removes a live pin", async () => {
  const { rerender, container } = render(<CareWeekGallery days={days} />);
  await waitFor(() => expect(ScrollTrigger.create).toHaveBeenCalledTimes(1));
  mockReduced = true;
  rerender(<CareWeekGallery days={days} />);
  expect(killTrigger).toHaveBeenCalledWith(true);
  expect(killAnimation).toHaveBeenCalled();
  expect(container.querySelector(".care-gallery-shell").dataset.scrollMode).toBeUndefined();
});

test("pin spacer is restored before React removes a menu's gallery DOM", async () => {
  ScrollTrigger.create.mockImplementation((settings) => {
    const host = settings.pin;
    const parent = host.parentNode;
    const spacer = document.createElement("div");
    parent.insertBefore(spacer, host);
    spacer.appendChild(host);
    killTrigger.mockImplementation(() => {
      if (!spacer.parentNode) return;
      spacer.parentNode.insertBefore(host, spacer);
      spacer.remove();
    });
    return { kill: killTrigger, isActive: false };
  });
  const { unmount } = render(<CareWeekGallery days={days} />);
  await waitFor(() => expect(ScrollTrigger.create).toHaveBeenCalledTimes(1));
  expect(() => unmount()).not.toThrow();
  expect(killTrigger).toHaveBeenCalledWith(true);
});
