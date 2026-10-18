import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import AIResponse from "./AIResponse";

let mockReduced = false;
jest.mock("../useLiveReducedMotion", () => () => mockReduced);

const originalFrame = window.requestAnimationFrame;
const originalCancel = window.cancelAnimationFrame;
let frames;
let clock;
beforeEach(() => {
  mockReduced = false;
  frames = new Map();
  clock = 0;
  let id = 0;
  window.requestAnimationFrame = jest.fn((callback) => { id += 1; frames.set(id, callback); return id; });
  window.cancelAnimationFrame = jest.fn((frame) => frames.delete(frame));
  jest.spyOn(performance, "now").mockImplementation(() => clock);
});
afterEach(() => {
  jest.restoreAllMocks();
  window.requestAnimationFrame = originalFrame;
  window.cancelAnimationFrame = originalCancel;
});

const shownText = (container) => container.querySelector(".assistant-response > [aria-hidden=true]").textContent;

test("full response is immediately available to screen readers; visible reveal completes within 650ms", () => {
  const message = { sender: "ai", text: "Đây là câu trả lời hoàn chỉnh từ API. ".repeat(12) };
  const { container } = render(<AIResponse message={message} />);
  expect(container.querySelector(".assistant-response > span:not([aria-hidden])").textContent).toBe(message.text);
  expect(shownText(container)).toBe("");
  act(() => {
    clock = 650;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(clock));
  });
  expect(shownText(container)).toBe(message.text);
  expect(screen.queryByRole("button", { name: "Hiện toàn bộ câu trả lời" })).toBeNull();
  expect(frames.size).toBe(0);
});

test("skip reveals all text and an existing message object never replays after navigation", () => {
  const message = { sender: "ai", text: "Thông tin tham khảo đã nhận đầy đủ." };
  const first = render(<AIResponse message={message} />);
  fireEvent.click(screen.getByRole("button", { name: "Hiện toàn bộ câu trả lời" }));
  expect(shownText(first.container)).toBe(message.text);
  first.unmount();
  expect(frames.size).toBe(0);
  const scheduled = window.requestAnimationFrame.mock.calls.length;
  const next = render(<AIResponse message={message} />);
  expect(shownText(next.container)).toBe(message.text);
  expect(window.requestAnimationFrame).toHaveBeenCalledTimes(scheduled);
});

test("reduced/simple motion is instant and unmount cancels any pending reveal frame", () => {
  mockReduced = true;
  const reduced = render(<AIResponse message={{ sender: "ai", text: "Hồ sơ và sức khỏe ❤️" }} />);
  expect(shownText(reduced.container)).toBe("Hồ sơ và sức khỏe ❤️");
  expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  reduced.unmount();
  mockReduced = false;
  const active = render(<AIResponse message={{ sender: "ai", text: "Phản hồi đang được trình bày." }} />);
  expect(frames.size).toBe(1);
  active.unmount();
  expect(frames.size).toBe(0);
});

test("development StrictMode does not suppress the first response reveal", () => {
  render(<StrictMode><AIResponse message={{ sender: "ai", text: "Câu trả lời mới." }} /></StrictMode>);
  expect(screen.getByRole("button", { name: "Hiện toàn bộ câu trả lời" })).toBeTruthy();
  expect(frames.size).toBe(1);
});

test("onReveal observes committed visible text after progression and skip", () => {
  const observed = [];
  const onReveal = jest.fn(() => observed.push(document.querySelector(".assistant-response > [aria-hidden=true]")?.textContent));
  const message = { sender: "ai", text: "Phản hồi đã có đầy đủ từ hệ thống. ".repeat(12) };
  render(<AIResponse message={message} onReveal={onReveal} />);
  expect(observed[observed.length - 1]).toBe("");
  act(() => {
    clock = 180;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(clock));
  });
  expect(observed[observed.length - 1].length).toBeGreaterThan(0);
  expect(observed[observed.length - 1].length).toBeLessThan(message.text.length);
  fireEvent.click(screen.getByRole("button", { name: "Hiện toàn bộ câu trả lời" }));
  expect(observed[observed.length - 1]).toBe(message.text);
});

test("onReveal is called with full text committed for reduced/simple presentation", () => {
  mockReduced = true;
  const text = "Toàn bộ nội dung xuất hiện ngay.";
  const observed = [];
  const onReveal = jest.fn(() => observed.push(document.querySelector(".assistant-response > [aria-hidden=true]")?.textContent));
  render(<AIResponse message={{ sender: "ai", text }} onReveal={onReveal} />);
  expect(onReveal).toHaveBeenCalled();
  expect(observed[observed.length - 1]).toBe(text);
  expect(window.requestAnimationFrame).not.toHaveBeenCalled();
});
