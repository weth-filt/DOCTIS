import { act, render, screen } from "@testing-library/react";
import StudioExperience from "./StudioExperience";
import { STUDIO_PREFERENCES_KEY, StudioPreferencesProvider } from "./StudioPreferences";

jest.mock("gsap", () => ({ gsap: { fromTo: jest.fn(() => ({ kill: jest.fn() })) } }), { virtual: true });

let originalMedia;
beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  jest.useFakeTimers();
  originalMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
  Object.defineProperty(window, "matchMedia", { configurable:true, value:jest.fn(query => ({ matches:query === "(hover: hover) and (pointer: fine)", addEventListener:jest.fn(), removeEventListener:jest.fn() })) });
});
afterEach(() => {
  jest.useRealTimers();
  if(originalMedia) Object.defineProperty(window,"matchMedia",originalMedia); else delete window.matchMedia;
});

function Experience({page="dashboard"}) {
  return <StudioPreferencesProvider><div data-studio-theme="light"><input aria-label="Unfinished form" defaultValue="A draft" /><StudioExperience page={page} name="Người dùng" /></div></StudioPreferencesProvider>;
}

test("opening a workspace directly never creates a welcome or a dismissal timer", () => {
  const {container}=render(<Experience />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(container.querySelector(".studio-experience-intro")).toBeNull();
  expect(jest.getTimerCount()).toBe(0);
  expect(window.sessionStorage.length).toBe(0);
  expect(container.querySelector(".studio-experience-cursor")).not.toBeNull();
});

test("function navigation never shows or schedules a welcome", () => {
  const {rerender}=render(<Experience />);
  const input=screen.getByLabelText("Unfinished form");
  input.focus();
  for(const page of ["profile","health","analytics","ai","doctor-chat","dashboard"]) rerender(<Experience page={page} />);
  act(() => jest.advanceTimersByTime(10000));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(jest.getTimerCount()).toBe(0);
  expect(document.activeElement).toBe(input);
  expect(screen.getByLabelText("Unfinished form")).toBe(input);
  expect(window.sessionStorage.length).toBe(0);
});

test("simple interface suppresses the decorative cursor without any intro behavior", () => {
  window.localStorage.setItem(STUDIO_PREFERENCES_KEY, JSON.stringify({ simpleUI: true }));
  const { container } = render(<Experience />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(container.querySelector(".studio-experience-cursor")).toBeNull();
  expect(jest.getTimerCount()).toBe(0);
});
