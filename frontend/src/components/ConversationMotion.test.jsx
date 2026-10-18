import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { useConversationMotion } from "./ConversationMotion";

function Conversation({ messages }) {
  const container = useRef(null);
  useConversationMotion(container, "existing-conversation", messages, false);
  return <div ref={container}>{messages.map((text) => <div key={text} className="conversation-message">{text}</div>)}</div>;
}

test("changing the live preference cancels active chat motion and affects future messages without replaying history", () => {
  const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
  const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, "animate");
  const listeners = new Set();
  const preference = {
    matches: false,
    addEventListener: (event, listener) => listeners.add(listener),
    removeEventListener: (event, listener) => listeners.delete(listener),
  };
  const calls = [];
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => preference });
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value() {
      const animation = { cancel: jest.fn() };
      calls.push({ node: this, animation });
      return animation;
    },
  });
  const changePreference = (matches) => act(() => {
    preference.matches = matches;
    listeners.forEach((listener) => listener({ matches }));
  });
  let unmount;
  try {
    const view = render(<Conversation messages={["first"]} />);
    unmount = view.unmount;
    expect(calls).toHaveLength(1);
    view.rerender(<Conversation messages={["first", "second"]} />);
    expect(calls).toHaveLength(2);
    expect(calls[1].node.textContent).toBe("second");
    changePreference(true);
    expect(calls[1].animation.cancel).toHaveBeenCalledTimes(1);
    view.rerender(<Conversation messages={["first", "second", "third"]} />);
    expect(calls).toHaveLength(2);
    changePreference(false);
    expect(calls).toHaveLength(2);
    view.rerender(<Conversation messages={["first", "second", "third", "fourth"]} />);
    expect(calls).toHaveLength(3);
    expect(calls[2].node.textContent).toBe("fourth");
    view.unmount();
    expect(calls[2].animation.cancel).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
  } finally {
    unmount?.();
    if (originalMatchMedia) Object.defineProperty(window, "matchMedia", originalMatchMedia);
    else delete window.matchMedia;
    if (originalAnimate) Object.defineProperty(Element.prototype, "animate", originalAnimate);
    else delete Element.prototype.animate;
  }
});
