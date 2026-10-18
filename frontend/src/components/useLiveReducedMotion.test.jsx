import { act, renderHook } from "@testing-library/react";
import useLiveReducedMotion from "./useLiveReducedMotion";

let originalMatchMedia;

beforeEach(() => {
  originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
});

afterEach(() => {
  if (originalMatchMedia) Object.defineProperty(window, "matchMedia", originalMatchMedia);
  else delete window.matchMedia;
});

function mockPreference(initial, legacy = false) {
  const listeners = new Set();
  const preference = {
    matches: initial,
    media: "(prefers-reduced-motion: reduce)",
  };
  if (legacy) {
    preference.addListener = jest.fn((listener) => listeners.add(listener));
    preference.removeListener = jest.fn((listener) => listeners.delete(listener));
  } else {
    preference.addEventListener = jest.fn((event, listener) => listeners.add(listener));
    preference.removeEventListener = jest.fn((event, listener) => listeners.delete(listener));
  }
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: jest.fn(() => preference),
  });
  return {
    preference,
    change(matches) {
      preference.matches = matches;
      act(() => listeners.forEach((listener) => listener({ matches })));
    },
  };
}

test("reads the initial browser preference", () => {
  mockPreference(true);
  const { result } = renderHook(() => useLiveReducedMotion());
  expect(result.current).toBe(true);
  expect(window.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
});

test("updates an open workspace from normal to reduced and back, then removes its listener", () => {
  const { preference, change } = mockPreference(false);
  const { result, unmount } = renderHook(() => useLiveReducedMotion());
  expect(result.current).toBe(false);
  change(true);
  expect(result.current).toBe(true);
  change(false);
  expect(result.current).toBe(false);
  const listener = preference.addEventListener.mock.calls[0][1];
  unmount();
  expect(preference.removeEventListener).toHaveBeenCalledWith("change", listener);
});

test("supports and cleans up the legacy MediaQueryList listener API", () => {
  const { preference, change } = mockPreference(false, true);
  const { result, unmount } = renderHook(() => useLiveReducedMotion());
  change(true);
  expect(result.current).toBe(true);
  change(false);
  expect(result.current).toBe(false);
  const listener = preference.addListener.mock.calls[0][0];
  unmount();
  expect(preference.removeListener).toHaveBeenCalledWith(listener);
});

test("falls back safely when matchMedia is unavailable", () => {
  Object.defineProperty(window, "matchMedia", { configurable: true, value: undefined });
  const { result } = renderHook(() => useLiveReducedMotion());
  expect(result.current).toBe(false);
});
