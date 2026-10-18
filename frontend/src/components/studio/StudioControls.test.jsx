import { fireEvent, render, screen } from "@testing-library/react";
import StudioControls from "./StudioControls";
import { STUDIO_PREFERENCES_KEY, StudioPreferencesProvider } from "./StudioPreferences";

let originalMedia;
let originalOrientation;
let requestPermission;
beforeEach(() => {
  window.localStorage.clear();
  originalMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
  originalOrientation = Object.getOwnPropertyDescriptor(window, "DeviceOrientationEvent");
  requestPermission = jest.fn().mockResolvedValue("granted");
  Object.defineProperty(window, "DeviceOrientationEvent", { configurable:true, value:{ requestPermission } });
  Object.defineProperty(window, "matchMedia", { configurable:true, value:jest.fn(query => ({ matches:query === "(pointer: coarse)", addEventListener:jest.fn(), removeEventListener:jest.fn() })) });
});
afterEach(() => {
  if(originalMedia) Object.defineProperty(window,"matchMedia",originalMedia); else delete window.matchMedia;
  if(originalOrientation) Object.defineProperty(window,"DeviceOrientationEvent",originalOrientation); else delete window.DeviceOrientationEvent;
});

function Controls() { return <StudioPreferencesProvider><StudioControls /></StudioPreferencesProvider>; }

test("mobile tilt never requests permission automatically", () => {
  render(<Controls />);
  expect(screen.getByRole("button",{name:"Bật nghiêng theo chuyển động điện thoại"})).not.toBeNull();
  expect(requestPermission).not.toHaveBeenCalled();
});

test("permission is requested explicitly and the opt-in is never persisted", async () => {
  const first=render(<Controls />);
  fireEvent.click(screen.getByRole("button",{name:"Bật nghiêng theo chuyển động điện thoại"}));
  await screen.findByRole("button",{name:"Tắt nghiêng theo chuyển động điện thoại"});
  expect(requestPermission).toHaveBeenCalledTimes(1);
  expect(Object.keys(JSON.parse(window.localStorage.getItem(STUDIO_PREFERENCES_KEY))).sort()).toEqual(["sidebarCollapsed","simpleUI","theme"]);
  first.unmount();
  render(<Controls />);
  expect(screen.getByRole("button",{name:"Bật nghiêng theo chuyển động điện thoại"})).not.toBeNull();
  expect(requestPermission).toHaveBeenCalledTimes(1);
});

test("denied sensor permission keeps tilt off and reports the actual result", async () => {
  requestPermission.mockResolvedValue("denied");
  render(<Controls />);
  fireEvent.click(screen.getByRole("button",{name:"Bật nghiêng theo chuyển động điện thoại"}));
  expect((await screen.findByRole("status")).textContent).toContain("Chưa được cấp quyền cảm biến");
  expect(screen.getByRole("button",{name:"Bật nghiêng theo chuyển động điện thoại"}).getAttribute("aria-pressed")).toBe("false");
});

test("simple interface hides the sensor opt-in", () => {
  window.localStorage.setItem(STUDIO_PREFERENCES_KEY,JSON.stringify({simpleUI:true}));
  render(<Controls />);
  expect(screen.queryByRole("button",{name:/nghiêng theo chuyển động điện thoại/})).toBeNull();
  expect(requestPermission).not.toHaveBeenCalled();
});
