import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { ConversationNotice, useConversationViewport } from "./ConversationViewport";

function Harness({ rows, active = true }) {
  const ref = useRef(null);
  const viewport = useConversationViewport(ref, "conversation", rows, active);
  return <>{active && <div data-testid="timeline" ref={ref} onScroll={viewport.onScroll} />}
    <ConversationNotice viewport={viewport} /></>;
}

test("new messages notify a reader in history without moving the reading position", () => {
  const { rerender } = render(<Harness rows={[{ id: 1 }]} />);
  const timeline = screen.getByTestId("timeline");
  Object.defineProperties(timeline, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 100 },
  });
  timeline.scrollTop = 200;
  timeline.scrollTo = jest.fn();
  fireEvent.scroll(timeline);
  rerender(<Harness rows={[{ id: 1 }, { id: 2 }]} />);
  expect(timeline.scrollTop).toBe(200);
  fireEvent.click(screen.getByRole("button", { name: /1 tin mới/ }));
  expect(timeline.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 1000 }));
  expect(screen.queryByRole("status")).toBeNull();
});

test("switching sections restores the saved reading position", () => {
  const rows = [{ id: 1 }];
  const { rerender } = render(<Harness rows={rows} />);
  const timeline = screen.getByTestId("timeline");
  Object.defineProperties(timeline, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 100 },
  });
  timeline.scrollTop = 300;
  fireEvent.scroll(timeline);
  rerender(<Harness rows={rows} active={false} />);
  rerender(<Harness rows={rows} />);
  expect(screen.getByTestId("timeline").scrollTop).toBe(300);
});

test("jump to latest responds to live reduced motion without resetting the reading position", () => {
  const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
  const listeners = new Set();
  const preference = {
    matches: false,
    addEventListener: (event, listener) => listeners.add(listener),
    removeEventListener: (event, listener) => listeners.delete(listener),
  };
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => preference });
  let unmount;
  try {
    const view = render(<Harness rows={[{ id: 1 }]} />);
    unmount = view.unmount;
    const timeline = screen.getByTestId("timeline");
    Object.defineProperties(timeline, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 100 },
    });
    timeline.scrollTo = jest.fn();
    timeline.scrollTop = 200;
    fireEvent.scroll(timeline);
    view.rerender(<Harness rows={[{ id: 1 }, { id: 2 }]} />);
    fireEvent.click(screen.getByRole("button", { name: /1 tin/ }));
    expect(timeline.scrollTo).toHaveBeenLastCalledWith({ top: 1000, behavior: "smooth" });

    fireEvent.scroll(timeline);
    view.rerender(<Harness rows={[{ id: 1 }, { id: 2 }, { id: 3 }]} />);
    act(() => {
      preference.matches = true;
      listeners.forEach((listener) => listener({ matches: true }));
    });
    expect(timeline.scrollTop).toBe(200);
    fireEvent.click(screen.getByRole("button", { name: /1 tin/ }));
    expect(timeline.scrollTo).toHaveBeenLastCalledWith({ top: 1000, behavior: "instant" });

    act(() => {
      preference.matches = false;
      listeners.forEach((listener) => listener({ matches: false }));
    });
    fireEvent.scroll(timeline);
    view.rerender(<Harness rows={[{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]} />);
    fireEvent.click(screen.getByRole("button", { name: /1 tin/ }));
    expect(timeline.scrollTo).toHaveBeenLastCalledWith({ top: 1000, behavior: "smooth" });
  } finally {
    unmount?.();
    if (originalMatchMedia) Object.defineProperty(window, "matchMedia", originalMatchMedia);
    else delete window.matchMedia;
  }
});
