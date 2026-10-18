import { useId } from "react";
import "../CSS/care-scene.css";

/** Layered SVG illustration with CSS perspective; no WebGL model. */
export default function CareScene({ kind = "health", className = "" }) {
  const id = useId().replace(/:/g, "");
  return <div className={`care-scene care-scene-${kind} ${className}`} aria-hidden="true"><svg viewBox="0 0 280 210" fill="none">
    <defs><linearGradient id={`${id}-paper`} x1="70" y1="35" x2="200" y2="180" gradientUnits="userSpaceOnUse"><stop stopColor="#fff" /><stop offset="1" stopColor="#dcefed" /></linearGradient><linearGradient id={`${id}-teal`} x1="85" y1="40" x2="205" y2="180" gradientUnits="userSpaceOnUse"><stop stopColor="#80dfd4" /><stop offset="1" stopColor="#087f8c" /></linearGradient><linearGradient id={`${id}-coral`} x1="190" y1="90" x2="230" y2="150"><stop stopColor="#f7c7b1" /><stop offset="1" stopColor="#d58f7c" /></linearGradient><filter id={`${id}-shadow`} x="-60%" y="-50%" width="220%" height="240%"><feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#143d48" floodOpacity=".14" /></filter></defs>
    <ellipse cx="140" cy="183" rx="90" ry="12" fill="#153d48" opacity=".10" />
    <ellipse cx="142" cy="114" rx="110" ry="67" transform="rotate(-23 142 114)" stroke="#9bdbd3" strokeOpacity=".4" />
    <circle cx="226" cy="54" r="13" fill="#ade5dc" opacity=".75" /><circle cx="51" cy="144" r="9" fill="#edb49c" opacity=".8" />
    <g className="care-scene-object" filter={`url(#${id}-shadow)`}>
      {kind === "profile" || kind === "admin" ? <>
        <path d="M69 56q0-12 12-12h53l14 14h55q12 0 12 12v97q0 12-12 12H81q-12 0-12-12Z" fill="#298e91" />
        <rect x="79" y="54" width="127" height="116" rx="13" fill={`url(#${id}-paper)`} />
        <circle cx="116" cy="91" r="15" fill="#a1d7ce" /><path d="M92 125q24-27 48 0" fill="#67b5aa" /><path d="M155 85h30M155 100h25M96 145h88" stroke="#96c3bf" strokeWidth="7" strokeLinecap="round" />
      </> : kind === "calendar" ? <>
        <rect x="75" y="53" width="132" height="123" rx="17" fill="#369d9c" /><rect x="69" y="45" width="132" height="123" rx="17" fill={`url(#${id}-paper)`} /><path d="M69 64q0-19 19-19h94q19 0 19 19v22H69Z" fill={`url(#${id}-teal)`} /><path d="M103 37v22M167 37v22" stroke="#275969" strokeWidth="8" strokeLinecap="round" />
        {[0,1,2].flatMap((row) => [0,1,2].map((col) => <rect key={`${row}-${col}`} x={91+col*32} y={102+row*20} width="13" height="9" rx="3" fill={row===1&&col===1?"#e9aa91":"#b4d7d1"} />))}
      </> : kind === "chat" || kind === "assistant" ? <>
        <path d="M71 62q0-16 16-16h98q16 0 16 16v62q0 16-16 16h-57l-31 25v-25H87q-16 0-16-16Z" fill={`url(#${id}-teal)`} /><path d="M132 113h75q17 0 17 17v36l-20-12h-72q-12 0-12-12v-17q0-12 12-12Z" fill={`url(#${id}-paper)`} /><circle cx="105" cy="91" r="5" fill="#eafff9" /><circle cx="136" cy="91" r="5" fill="#eafff9" /><circle cx="167" cy="91" r="5" fill="#eafff9" /><path d="M142 134h55" stroke="#b7d4cf" strokeWidth="6" strokeLinecap="round" />
      </> : kind === "chart" ? <>
        <rect x="65" y="40" width="146" height="134" rx="19" fill={`url(#${id}-paper)`} /><path d="M89 147h100" stroke="#aecdc7" strokeWidth="3" /><rect x="91" y="101" width="20" height="46" rx="5" fill="#a0dacf" /><rect x="128" y="79" width="20" height="68" rx="5" fill={`url(#${id}-teal)`} /><rect x="165" y="58" width="20" height="89" rx="5" fill="#e7af98" /><path d="m86 83 38-21 24 6 29-27" stroke="#3b9292" strokeWidth="4" strokeLinecap="round" />
      </> : <>
        <rect x="80" y="42" width="124" height="133" rx="27" fill="#197e85" /><rect x="70" y="34" width="124" height="133" rx="27" fill={`url(#${id}-teal)`} />
        <path d="M131 133c-7-7-44-32-44-54 0-21 28-29 44-8 16-21 44-13 44 8 0 22-37 47-44 54Z" fill="#eafffa" /><path d="M98 96h17l8-18 13 35 8-17h20" stroke="#188f95" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      </>}
    </g>
    <g className="care-scene-foreground" filter={`url(#${id}-shadow)`}><rect x="186" y="130" width="45" height="45" rx="14" fill={`url(#${id}-coral)`} /><path d="M208 141v23m-11-11h23" stroke="#fff5ec" strokeWidth="5" strokeLinecap="round" /></g>
  </svg></div>;
}
