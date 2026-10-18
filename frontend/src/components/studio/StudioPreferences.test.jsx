import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import StudioControls from "./StudioControls";
import { readStudioPreferences, STUDIO_PREFERENCES_KEY, StudioPreferencesProvider, useStudioPreferences } from "./StudioPreferences";
import useLiveReducedMotion from "../useLiveReducedMotion";

beforeEach(() => window.localStorage.clear());

test("preferences default safely and normalize stored presentation values", () => {
  expect(readStudioPreferences()).toEqual({ theme: "light", simpleUI: false, sidebarCollapsed: false });
  window.localStorage.setItem(STUDIO_PREFERENCES_KEY, JSON.stringify({ theme: "dark", simpleUI: true, sidebarCollapsed: "true", token: "ignored" }));
  expect(readStudioPreferences()).toEqual({ theme: "dark", simpleUI: true, sidebarCollapsed: false });
  window.localStorage.setItem(STUDIO_PREFERENCES_KEY, "broken JSON");
  expect(readStudioPreferences().theme).toBe("light");
});

function Harness() {
  const preferences = useStudioPreferences();
  return <div data-testid="preferences" data-theme={preferences.theme} data-simple={preferences.simpleUI} data-collapsed={preferences.sidebarCollapsed}><input aria-label="Unsaved draft" defaultValue="A draft" /><StudioControls /></div>;
}

test("controls persist preferences without replacing a draft field", () => {
  window.localStorage.setItem("user", "existing-auth-value");
  render(<StudioPreferencesProvider><Harness /></StudioPreferencesProvider>);
  const input = screen.getByLabelText("Unsaved draft");
  fireEvent.change(input, { target: { value: "An unfinished form" } });
  fireEvent.click(screen.getByRole("button", { name: "Bật giao diện tối" }));
  fireEvent.click(screen.getByRole("button", { name: "Giao diện đơn giản" }));
  fireEvent.click(screen.getByRole("button", { name: "Thu gọn thanh điều hướng" }));
  expect(screen.getByTestId("preferences").dataset).toEqual(expect.objectContaining({ theme: "dark", simple: "true", collapsed: "true" }));
  expect(JSON.parse(window.localStorage.getItem(STUDIO_PREFERENCES_KEY))).toEqual({ theme: "dark", simpleUI: true, sidebarCollapsed: true });
  expect(screen.getByLabelText("Unsaved draft")).toBe(input);
  expect(input.value).toBe("An unfinished form");
  expect(window.localStorage.getItem("user")).toBe("existing-auth-value");
});

test("a storage event synchronizes presentation preferences from another tab", () => {
  const { result } = renderHook(() => useStudioPreferences(), { wrapper: StudioPreferencesProvider });
  act(() => {
    window.localStorage.setItem(STUDIO_PREFERENCES_KEY, JSON.stringify({ theme: "dark", simpleUI: true }));
    window.dispatchEvent(new StorageEvent("storage", { key: STUDIO_PREFERENCES_KEY }));
  });
  expect(result.current.theme).toBe("dark");
  expect(result.current.simpleUI).toBe(true);
});

test("simple interface participates in reduced motion without changing OS settings", () => {
  const { result } = renderHook(() => ({ preferences: useStudioPreferences(), reduced: useLiveReducedMotion() }), { wrapper: StudioPreferencesProvider });
  act(() => result.current.preferences.setSimpleUI(true));
  expect(result.current.reduced).toBe(true);
  act(() => result.current.preferences.setSimpleUI(false));
  expect(result.current.reduced).toBe(false);
});
