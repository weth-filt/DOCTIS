import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import useLiveReducedMotion from "./useLiveReducedMotion";
import { useWorkspaceMotion } from "./WorkspaceMotion";

jest.mock("./useLiveReducedMotion", () => ({ __esModule: true, default: jest.fn() }));

let animationCalls;
let originalAnimate;
let originalScrollTo;

function Harness() {
  const [page, setPage] = useState("dashboard");
  const { screenRef, navigate } = useWorkspaceMotion(page, setPage);
  return <>
    <button onClick={() => navigate("profile")}>Profile</button>
    <button onClick={() => navigate("dashboard")}>Overview</button>
    <main ref={screenRef} data-testid="surface" id="workspace">
      {page === "dashboard" ? <article className="patient-overview">
        <section className="overview-intro"><svg aria-labelledby="scene-title">
          <title id="scene-title">Care scene</title>
          <defs>
            <linearGradient id="scene-paint"><stop stopColor="teal" /></linearGradient>
            <filter id="scene-shadow"><feDropShadow stdDeviation="2" /></filter>
            <clipPath id="scene-clip"><rect width="100" height="100" /></clipPath>
            <path id="scene-shape" d="M0 0h10v10H0Z" />
          </defs>
          <g filter="url(#scene-shadow)" clipPath="url('#scene-clip')">
            <rect fill="url(#scene-paint)" style={{ stroke: "url(#scene-paint)" }} width="100" height="100" />
            <use href="#scene-shape" />
          </g>
        </svg></section>
        <section className="overview-metrics"><div className="form-grid"><div /></div></section>
        <section className="overview-workbench" />
        <section className="overview-insights" />
        <section className="overview-library" />
      </article> : <section className="studio-profile-section"><input id="profile-name" aria-label="Name" /></section>}
    </main>
  </>;
}

beforeEach(() => {
  animationCalls = [];
  originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, "animate");
  originalScrollTo = window.scrollTo;
  window.scrollTo = jest.fn();
  useLiveReducedMotion.mockReturnValue(false);
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value(keyframes, options) {
      const animation = { cancel: jest.fn(() => animation.oncancel?.()) };
      animationCalls.push({ node: this, keyframes, options, animation });
      return animation;
    },
  });
});

afterEach(() => {
  if (originalAnimate) Object.defineProperty(Element.prototype, "animate", originalAnimate);
  else delete Element.prototype.animate;
  window.scrollTo = originalScrollTo;
});

test("overview animates five presentation groups in order and settles within 700ms", () => {
  render(<Harness />);
  const groups = animationCalls.filter(({ node }) => node.className.startsWith("overview-"));
  expect(groups.map(({ node }) => node.className)).toEqual([
    "overview-intro", "overview-metrics", "overview-workbench", "overview-insights", "overview-library",
  ]);
  expect(groups.map(({ options }) => options.delay)).toEqual([80, 150, 220, 290, 360]);
  expect(groups.every(({ options }) => options.delay + options.duration <= 700)).toBe(true);
  expect(animationCalls.some(({ node }) => node.parentElement?.className === "form-grid")).toBe(false);
  expect(groups[0].keyframes[0].transform).toBe("translate3d(18px, 8px, 0)");
});

test("returning to a section restores its own document scroll position", () => {
  const scrollY = Object.getOwnPropertyDescriptor(window, "scrollY");
  try {
    render(<Harness />);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 600 });
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 220 });
    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 600, behavior: "instant" });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 650 });
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 220, behavior: "instant" });
  } finally {
    if (scrollY) Object.defineProperty(window, "scrollY", scrollY);
    else delete window.scrollY;
  }
});

test("rapid navigation cancels old movement and leaves only the latest inert snapshot", () => {
  render(<Harness />);
  const surface = document.querySelector("main[data-testid=surface]:not(.studio-transition-snapshot)");
  fireEvent.click(screen.getByRole("button", { name: "Profile" }));
  const profileAnimations = [...animationCalls];
  const snapshot = surface.querySelector(".studio-transition-snapshot");
  expect(snapshot.getAttribute("aria-hidden")).toBe("true");
  expect(snapshot.inert).toBe(true);
  expect(snapshot.style.pointerEvents).toBe("none");
  expect(snapshot.id).not.toBe("workspace");
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  expect(profileAnimations.every(({ animation }) => animation.cancel.mock.calls.length > 0)).toBe(true);
  expect(surface.querySelectorAll(".studio-transition-snapshot")).toHaveLength(1);
  expect(surface.querySelector(".studio-transition-snapshot [id='profile-name']")).toBeNull();
  expect(surface.querySelectorAll(".studio-page-sweep")).toHaveLength(1);
});

test("outgoing SVG retains scoped gradients, shadows, clip paths and local references", () => {
  render(<Harness />);
  const surface = document.querySelector("main[data-testid=surface]:not(.studio-transition-snapshot)");
  fireEvent.click(screen.getByRole("button", { name: "Profile" }));
  const snapshot = surface.querySelector(".studio-transition-snapshot");
  const svg = snapshot.querySelector("svg");
  const gradient = snapshot.querySelector("linearGradient");
  const shadow = snapshot.querySelector("filter");
  const clip = snapshot.querySelector("clipPath");
  const painted = snapshot.querySelector("g > rect");
  expect(painted.getAttribute("fill")).toBe(`url(#${gradient.id})`);
  expect(painted.style.stroke).toBe(`url(#${gradient.id})`);
  expect(snapshot.querySelector("g").getAttribute("filter")).toBe(`url(#${shadow.id})`);
  expect(snapshot.querySelector("g").getAttribute("clip-path")).toBe(`url('#${clip.id}')`);
  expect(svg.getAttribute("aria-labelledby")).toBe(svg.querySelector("title").id);
  expect(svg.querySelector("use").getAttribute("href")).toBe(`#${svg.querySelector("defs > path").id}`);
  const allIds = [...document.querySelectorAll("[id]")].map(node => node.id);
  expect(new Set(allIds).size).toBe(allIds.length);
  expect(allIds.every(id => !id.startsWith("scene-"))).toBe(true);
});

test("reduced motion removes translation, stagger and decorative overlays", () => {
  useLiveReducedMotion.mockReturnValue(true);
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Profile" }));
  expect(animationCalls.every(({ keyframes, options }) => (
    keyframes[0].transform === "none" && options.delay === 0 && options.duration === 80
  ))).toBe(true);
  expect(document.querySelector("main[data-testid=surface]:not(.studio-transition-snapshot)").querySelector(".studio-transition-snapshot, .studio-page-sweep")).toBeNull();
});

test("a live preference change cancels motion without resetting page scroll", () => {
  const { rerender } = render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Profile" }));
  const moving = [...animationCalls];
  window.scrollTo.mockClear();
  useLiveReducedMotion.mockReturnValue(true);
  rerender(<Harness />);
  expect(moving.every(({ animation }) => animation.cancel.mock.calls.length)).toBe(true);
  expect(document.querySelector("main[data-testid=surface]:not(.studio-transition-snapshot)").querySelector(".studio-transition-layer, .studio-page-sweep")).toBeNull();
  expect(window.scrollTo).not.toHaveBeenCalled();
  useLiveReducedMotion.mockReturnValue(false);
  rerender(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  expect(document.querySelector("main[data-testid=surface]:not(.studio-transition-snapshot)").querySelector(".studio-page-sweep")).not.toBeNull();
});

test("outgoing scene keeps the scrolled visible slice, with viewport-sized layers", () => {
  const bounds = jest.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function () {
    return this.tagName === "MAIN" ? { top: -400, left: 240, width: 1000, height: 1800, bottom:1400, right:1240 } : { top:0,left:0,width:0,height:0,bottom:0,right:0 };
  });
  try {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    const surface = document.querySelector("main[data-testid=surface]:not(.studio-transition-snapshot)");
    const layer = surface.querySelector(".studio-transition-layer");
    expect(layer.style.position).toBe("fixed");
    expect(layer.style.left).toBe("240px");
    expect(layer.style.height).toBe(`${window.innerHeight}px`);
    expect(layer.querySelector(".studio-transition-snapshot").style.top).toBe("-400px");
    expect(surface.querySelector(".studio-page-sweep").style.height).toBe(`${window.innerHeight}px`);
  } finally { bounds.mockRestore(); }
});

function FourFunctions() {
  const [page,setPage] = useState("dashboard");
  const [name,setName] = useState("");
  const [height,setHeight] = useState("");
  const [draft,setDraft] = useState("");
  const {screenRef,navigate} = useWorkspaceMotion(page,setPage);
  return <><nav>{['dashboard','profile','health','analytics','chat'].map(item => <button key={item} onClick={() => navigate(item)}>{item}</button>)}</nav><main ref={screenRef} data-testid="four-surface">
    {page === 'dashboard' && <section className="overview-intro">Overview</section>}
    {page === 'profile' && <section className="studio-profile-section"><input aria-label="Draft name" value={name} onChange={e=>setName(e.target.value)} /></section>}
    {page === 'health' && <><h2 className="studio-form-title">Health</h2><div className="form-grid"><input aria-label="Draft height" value={height} onChange={e=>setHeight(e.target.value)} /></div></>}
    {page === 'analytics' && <section className="measurement-panel">Chart</section>}
    {page === 'chat' && <section><textarea aria-label="Chat draft" value={draft} onChange={e=>setDraft(e.target.value)} /></section>}
  </main></>;
}

test("all four functions transition and preserve form and chat drafts across navigation", () => {
  render(<FourFunctions />);
  for (const page of ['profile','health','analytics']) {
    fireEvent.click(screen.getByRole('button',{name:page,exact:true}));
    const surface=document.querySelector("main[data-testid=four-surface]:not(.studio-transition-snapshot)");
    expect(surface.querySelector('.studio-transition-layer')).not.toBeNull();
    expect(surface.querySelector('.studio-page-sweep')).not.toBeNull();
    if(page==='profile') fireEvent.change(screen.getByLabelText('Draft name'),{target:{value:'Unsaved name'}});
    if(page==='health') fireEvent.change(screen.getByLabelText('Draft height'),{target:{value:'172'}});
  }
  fireEvent.click(screen.getByRole('button',{name:'chat',exact:true}));
  fireEvent.change(screen.getByLabelText('Chat draft'),{target:{value:'Unsent message'}});
  fireEvent.click(screen.getByRole('button',{name:'profile',exact:true}));
  expect(screen.getByLabelText('Draft name').value).toBe('Unsaved name');
  fireEvent.click(screen.getByRole('button',{name:'health',exact:true}));
  expect(screen.getByLabelText('Draft height').value).toBe('172');
  fireEvent.click(screen.getByRole('button',{name:'chat',exact:true}));
  expect(screen.getByLabelText('Chat draft').value).toBe('Unsent message');
});
