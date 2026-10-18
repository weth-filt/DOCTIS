import { useEffect } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import PatientWelcomeGate from "./PatientWelcomeGate";
import { useStudioPreferences } from "./StudioPreferences";
import { beginPatientWelcome, completePatientWelcome, hasPendingPatientWelcome, PATIENT_WELCOME_KEY } from "./patientWelcomeSession";

jest.mock("../3d/HeartScene", () => ({ __esModule:true, default:({priority}) => <div data-testid="welcome-heart" data-priority={priority} /> }));
jest.mock("./StudioPreferences", () => ({ useStudioPreferences:jest.fn() }));

let originalMedia;
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  completePatientWelcome();
  useStudioPreferences.mockReturnValue({theme:"light",simpleUI:false});
  originalMedia=Object.getOwnPropertyDescriptor(window,"matchMedia");
  jest.useFakeTimers();
});
afterEach(() => {
  jest.restoreAllMocks();
  completePatientWelcome();
  if(originalMedia) Object.defineProperty(window,"matchMedia",originalMedia); else delete window.matchMedia;
  jest.useRealTimers();
});

function signedIn(role="user") {
  window.localStorage.setItem("token","test-session-token");
  window.localStorage.setItem("user",JSON.stringify({role,fullName:"Người dùng kiểm thử"}));
}

function DashboardProbe({onMount}) {
  useEffect(()=>{onMount?.();},[onMount]);
  return <div data-testid="dashboard">Dashboard child</div>;
}
function Gate({onMount}) {
  return <PatientWelcomeGate><DashboardProbe onMount={onMount} /></PatientWelcomeGate>;
}

test("a normal authenticated direct load does not show or start a welcome", () => {
  signedIn();
  const mounts=jest.fn();
  render(<Gate onMount={mounts} />);
  expect(screen.queryByRole("button",{name:/Bỏ qua/})).toBeNull();
  expect(screen.getByTestId("dashboard")).not.toBeNull();
  expect(mounts).toHaveBeenCalledTimes(1);
  expect(hasPendingPatientWelcome()).toBe(false);
  expect(window.sessionStorage.getItem(PATIENT_WELCOME_KEY)).toBeNull();
});

test.each([
  ["no token",()=>window.localStorage.setItem("user",JSON.stringify({role:"user"}))],
  ["missing user",()=>window.localStorage.setItem("token","test-session-token")],
  ["doctor",()=>signedIn("doctor")],
  ["admin",()=>signedIn("admin")],
  ["malformed user",()=>{window.localStorage.setItem("token","test-session-token");window.localStorage.setItem("user","not JSON");}],
  ["null user",()=>{window.localStorage.setItem("token","test-session-token");window.localStorage.setItem("user","null");}],
])("a pending marker does not show patient welcome for %s",(label,prepare)=>{
  prepare();
  beginPatientWelcome();
  render(<Gate />);
  expect(screen.queryByRole("button",{name:/Bỏ qua/})).toBeNull();
  expect(screen.getByTestId("dashboard")).not.toBeNull();
});

test("pending welcome blocks dashboard mount beyond 30 seconds and Escape",()=>{
  signedIn();
  beginPatientWelcome();
  const mounts=jest.fn();
  render(<Gate onMount={mounts} />);
  const skip=screen.getByRole("button",{name:/Bỏ qua/});
  expect(document.activeElement).toBe(skip);
  expect(screen.getByRole("heading",{name:/Người dùng kiểm thử/})).not.toBeNull();
  expect(screen.getByTestId("welcome-heart").dataset.priority).toBe("100");
  act(()=>jest.advanceTimersByTime(60000));
  fireEvent.keyDown(skip,{key:"Escape"});
  fireEvent.keyDown(document,{key:"Escape"});
  expect(screen.queryByTestId("dashboard")).toBeNull();
  expect(mounts).not.toHaveBeenCalled();
  expect(hasPendingPatientWelcome()).toBe(true);
  expect(screen.getByRole("button",{name:/Bỏ qua/})).toBe(skip);
});

test("only Skip clears the marker and mounts the dashboard without changing auth",()=>{
  signedIn();
  const storedUser=window.localStorage.getItem("user");
  beginPatientWelcome();
  const mounts=jest.fn();
  render(<Gate onMount={mounts} />);
  fireEvent.click(screen.getByRole("button",{name:/Bỏ qua/}));
  expect(screen.queryByTestId("welcome-heart")).toBeNull();
  expect(screen.getByTestId("dashboard")).not.toBeNull();
  expect(mounts).toHaveBeenCalledTimes(1);
  expect(hasPendingPatientWelcome()).toBe(false);
  expect(window.sessionStorage.getItem(PATIENT_WELCOME_KEY)).toBeNull();
  expect(window.localStorage.getItem("token")).toBe("test-session-token");
  expect(window.localStorage.getItem("user")).toBe(storedUser);
});

test("pending survives remount until Skip and never repeats afterward without a new login marker",()=>{
  signedIn();
  beginPatientWelcome();
  const first=render(<Gate />);
  first.unmount();
  expect(hasPendingPatientWelcome()).toBe(true);
  const second=render(<Gate />);
  expect(screen.queryByTestId("dashboard")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:/Bỏ qua/}));
  second.unmount();
  render(<Gate />);
  expect(screen.queryByRole("button",{name:/Bỏ qua/})).toBeNull();
  expect(screen.getByTestId("dashboard")).not.toBeNull();
});

test("each new login marker starts welcome again even with the legacy seen flag",()=>{
  signedIn();
  window.sessionStorage.setItem("doctis.ui.intro.v1","seen");
  beginPatientWelcome();
  const first=render(<Gate />);
  fireEvent.click(screen.getByRole("button",{name:/Bỏ qua/}));
  first.unmount();
  beginPatientWelcome();
  render(<Gate />);
  expect(screen.queryByTestId("dashboard")).toBeNull();
  expect(screen.getByRole("button",{name:/Bỏ qua/})).not.toBeNull();
  expect(window.sessionStorage.getItem(PATIENT_WELCOME_KEY)).toBe("pending");
});

test("simple and OS reduced motion keep the welcome until explicit Skip",()=>{
  signedIn();
  beginPatientWelcome();
  useStudioPreferences.mockReturnValue({theme:"dark",simpleUI:true});
  Object.defineProperty(window,"matchMedia",{configurable:true,value:jest.fn(()=>({matches:true}))});
  const {container}=render(<Gate />);
  act(()=>jest.advanceTimersByTime(60000));
  expect(container.querySelector(".patient-welcome-page").dataset.studioSimple).toBe("true");
  expect(screen.queryByTestId("dashboard")).toBeNull();
  expect(screen.getByRole("button",{name:/Bỏ qua/})).not.toBeNull();
});

test("stored pending is recognized independently of the in-memory marker",()=>{
  completePatientWelcome();
  window.sessionStorage.setItem(PATIENT_WELCOME_KEY,"pending");
  expect(hasPendingPatientWelcome()).toBe(true);
  completePatientWelcome();
  expect(hasPendingPatientWelcome()).toBe(false);
});

test("restricted session storage uses the same-tab fallback and Skip still clears it",()=>{
  signedIn();
  const originals={getItem:Storage.prototype.getItem,setItem:Storage.prototype.setItem,removeItem:Storage.prototype.removeItem};
  Object.keys(originals).forEach(method=>jest.spyOn(Storage.prototype,method).mockImplementation(function(...args){
    if(this===window.sessionStorage) throw new Error("Session storage restricted in test");
    return originals[method].apply(this,args);
  }));
  beginPatientWelcome();
  expect(hasPendingPatientWelcome()).toBe(true);
  render(<Gate />);
  expect(screen.queryByTestId("dashboard")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:/Bỏ qua/}));
  expect(screen.getByTestId("dashboard")).not.toBeNull();
  expect(hasPendingPatientWelcome()).toBe(false);
});
