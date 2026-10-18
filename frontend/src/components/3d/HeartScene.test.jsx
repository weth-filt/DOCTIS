import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import HeartScene, { HeartSceneProvider } from "./HeartScene";
import useLiveReducedMotion from "../useLiveReducedMotion";
import { useStudioPreferences } from "../studio/StudioPreferences";

jest.mock("../useLiveReducedMotion", () => ({ __esModule: true, default: jest.fn(() => false) }));
jest.mock("../studio/StudioPreferences", () => ({ useStudioPreferences:jest.fn(() => ({deviceTilt:false})) }));
jest.mock("framer-motion", () => ({ motion: { div: ({ children, animate, transition, initial, ...props }) => <div {...props} data-scene-x={animate?.x} data-scene-y={animate?.y}>{children}</div> } }));
let mockScenePointer;
jest.mock("./HeartWebGL", () => ({ __esModule: true, default: function MockCanvas({ active, onReady, onFailure, pointer }) {
  const React = require("react");
  mockScenePointer=pointer;
  React.useEffect(() => { onReady(); }, [onReady]);
  return <div data-testid="webgl" data-active={active}><button onClick={onFailure}>Lose context</button></div>;
} }));

let originalRaf;
let originalCancel;
let bounds;
let hidden;
beforeEach(() => {
  useLiveReducedMotion.mockReturnValue(false);
  useStudioPreferences.mockReturnValue({deviceTilt:false});
  originalRaf = window.requestAnimationFrame;
  originalCancel = window.cancelAnimationFrame;
  window.requestAnimationFrame = callback => { callback(0); return 1; };
  window.cancelAnimationFrame = jest.fn();
  bounds = jest.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ left: 10, top: 10, right: 310, bottom: 310, width: 300, height: 300 });
  hidden = jest.spyOn(document, "hidden", "get").mockReturnValue(false);
});
afterEach(() => {
  bounds.mockRestore();
  hidden.mockRestore();
  window.requestAnimationFrame = originalRaf;
  window.cancelAnimationFrame = originalCancel;
});

function Harness({ intro = true }) {
  return <HeartSceneProvider><HeartScene className="hero-slot" bpm={78} status="Ổn định" />{intro && <HeartScene className="intro-slot" priority={100} />}</HeartSceneProvider>;
}

test("one persistent canvas hides only its active slot and moves from intro to hero", async () => {
  const { container, rerender } = render(<Harness />);
  const canvas = await screen.findByTestId("webgl");
  await waitFor(() => expect(container.querySelector(".intro-slot").classList.contains("is-webgl-ready")).toBe(true));
  expect(container.querySelector(".hero-slot").classList.contains("is-webgl-ready")).toBe(false);
  expect(container.querySelectorAll(".heart-canvas-layer")).toHaveLength(1);
  await act(async () => rerender(<Harness intro={false} />));
  expect(screen.getByTestId("webgl")).toBe(canvas);
  expect(container.querySelector(".hero-slot").classList.contains("is-webgl-ready")).toBe(true);
});

test("context loss releases the canvas and exposes the static fallback", async () => {
  const { container } = render(<Harness intro={false} />);
  await screen.findByTestId("webgl");
  fireEvent.click(screen.getByRole("button", { name: "Lose context", hidden: true }));
  expect(screen.queryByTestId("webgl")).toBeNull();
  expect(container.querySelector(".heart-fallback")).not.toBeNull();
  expect(container.querySelector(".is-webgl-ready")).toBeNull();
});

test("simple interface never mounts a WebGL canvas", () => {
  useLiveReducedMotion.mockReturnValue(true);
  const { container } = render(<Harness />);
  expect(screen.queryByTestId("webgl")).toBeNull();
  expect(container.querySelectorAll(".heart-fallback")).toHaveLength(2);
  expect(container.querySelector(".is-webgl-ready")).toBeNull();
});

test("offscreen initial slots defer WebGL creation", () => {
  bounds.mockReturnValue({ left: 10, top: 1500, right: 310, bottom: 1800, width: 300, height: 300 });
  render(<Harness />);
  expect(screen.queryByTestId("webgl")).toBeNull();
});

test("hidden tabs pause an existing scene without replacing its canvas", async () => {
  render(<Harness intro={false} />);
  const canvas = await screen.findByTestId("webgl");
  expect(canvas.dataset.active).toBe("true");
  hidden.mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  expect(canvas.dataset.active).toBe("false");
  expect(screen.getByTestId("webgl")).toBe(canvas);
});

test("an initially hidden tab defers its first WebGL context", () => {
  hidden.mockReturnValue(true);
  render(<Harness />);
  expect(screen.queryByTestId("webgl")).toBeNull();
});

test("a slot is remeasured after its ancestor entrance transform finishes", async () => {
  const originalAnimations = Object.getOwnPropertyDescriptor(Element.prototype, "getAnimations");
  let finish;
  const finished = new Promise(resolve => { finish = resolve; });
  const animation = { playState: "running", effect: { getComputedTiming: () => ({ endTime: 700 }) }, finished };
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value() { return this.classList.contains("animated-ancestor") ? [animation] : []; } });
  let shifted = true;
  bounds.mockImplementation(() => ({ left: shifted ? 28 : 10, top: shifted ? 18 : 10, right: 328, bottom: 318, width: 300, height: 300 }));
  try {
    const { container } = render(<HeartSceneProvider><section className="animated-ancestor"><HeartScene /></section></HeartSceneProvider>);
    await screen.findByTestId("webgl");
    expect(container.querySelector(".heart-canvas-layer").dataset.sceneX).toBe("28");
    shifted = false;
    await act(async () => { finish(); await finished; });
    await waitFor(() => expect(container.querySelector(".heart-canvas-layer").dataset.sceneX).toBe("10"));
    expect(container.querySelector(".heart-canvas-layer").dataset.sceneY).toBe("10");
  } finally {
    if (originalAnimations) Object.defineProperty(Element.prototype, "getAnimations", originalAnimations);
    else delete Element.prototype.getAnimations;
  }
});

test("opt-in device tilt updates only the pointer ref and reduced mode removes its listener", async () => {
  useStudioPreferences.mockReturnValue({deviceTilt:true});
  const add=jest.spyOn(window,"addEventListener");
  const remove=jest.spyOn(window,"removeEventListener");
  try {
    const {rerender}=render(<Harness intro={false} />);
    await screen.findByTestId("webgl");
    const listener=add.mock.calls.find(call=>call[0]==="deviceorientation")[1];
    listener({beta:0,gamma:0});
    listener({beta:30,gamma:45});
    expect(mockScenePointer.current).toEqual({x:.5,y:.5});
    useLiveReducedMotion.mockReturnValue(true);
    rerender(<Harness intro={false} />);
    expect(remove).toHaveBeenCalledWith("deviceorientation",listener);
    expect(mockScenePointer.current).toEqual({x:0,y:0});
  } finally {add.mockRestore();remove.mockRestore();}
});
