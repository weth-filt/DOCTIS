import { useId } from "react";
import { motion } from "framer-motion";
import useLiveReducedMotion from "./useLiveReducedMotion";
import "../CSS/dashboard-care-artwork.css";

/** Decorative care sculpture. It intentionally contains no patient readings. */
export default function DashboardCareArtwork() {
  const artworkId = useId().replace(/:/g, "");
  const reducedMotion = useLiveReducedMotion();
  const gradient = (name) => `url(#${artworkId}-${name})`;
  const reveal = (delay, x = 0, y = 18, scale = 0.96) => ({
    initial: reducedMotion ? false : { opacity: 0, x, y, scale },
    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
    transition: { duration: reducedMotion ? 0 : 0.34, delay: reducedMotion ? 0 : delay, ease: [0.16, 1, 0.3, 1] },
  });
  const heart = "M311 279c-22-22-102-68-102-126 0-47 57-66 102-23 45-43 102-24 102 23 0 58-80 104-102 126Z";

  return (
    <div className="dashboard-care-artwork" aria-hidden="true">
      <svg viewBox="0 0 580 430" fill="none" focusable="false">
        <defs>
          <linearGradient id={`${artworkId}-folio-edge`} x1="132" y1="104" x2="315" y2="286" gradientUnits="userSpaceOnUse"><stop stopColor="#95c8c1" /><stop offset="1" stopColor="#508e8a" /></linearGradient>
          <linearGradient id={`${artworkId}-paper`} x1="111" y1="80" x2="284" y2="266" gradientUnits="userSpaceOnUse"><stop stopColor="#fffef4" /><stop offset=".57" stopColor="#e9f3e8" /><stop offset="1" stopColor="#c6e2d6" /></linearGradient>
          <linearGradient id={`${artworkId}-heart-edge`} x1="222" y1="144" x2="376" y2="288" gradientUnits="userSpaceOnUse"><stop stopColor="#62c8be" /><stop offset=".6" stopColor="#217e80" /><stop offset="1" stopColor="#115d68" /></linearGradient>
          <linearGradient id={`${artworkId}-heart`} x1="247" y1="107" x2="367" y2="274" gradientUnits="userSpaceOnUse"><stop stopColor="#b4f2dd" /><stop offset=".29" stopColor="#73dacb" /><stop offset=".66" stopColor="#32b5ac" /><stop offset="1" stopColor="#138d93" /></linearGradient>
          <linearGradient id={`${artworkId}-heart-shine`} x1="246" y1="113" x2="303" y2="225" gradientUnits="userSpaceOnUse"><stop stopColor="#fff" stopOpacity=".85" /><stop offset="1" stopColor="#effff4" stopOpacity="0" /></linearGradient>
          <linearGradient id={`${artworkId}-coral`} x1="413" y1="267" x2="477" y2="345" gradientUnits="userSpaceOnUse"><stop stopColor="#ffe1c3" /><stop offset=".44" stopColor="#efae94" /><stop offset="1" stopColor="#ce806f" /></linearGradient>
          <linearGradient id={`${artworkId}-calendar`} x1="391" y1="69" x2="467" y2="152" gradientUnits="userSpaceOnUse"><stop stopColor="#fbfced" /><stop offset="1" stopColor="#bdded2" /></linearGradient>
          <linearGradient id={`${artworkId}-platform`} x1="228" y1="300" x2="342" y2="386" gradientUnits="userSpaceOnUse"><stop stopColor="#7ac3b2" stopOpacity=".19" /><stop offset="1" stopColor="#6ca7a0" stopOpacity=".02" /></linearGradient>
          <radialGradient id={`${artworkId}-aura`} cx="0" cy="0" r="1" gradientTransform="translate(300 210) rotate(90) scale(172 206)" gradientUnits="userSpaceOnUse"><stop stopColor="#69dac4" stopOpacity=".16" /><stop offset="1" stopColor="#69dac4" stopOpacity="0" /></radialGradient>
          <filter id={`${artworkId}-shadow`} x="-35%" y="-30%" width="180%" height="190%"><feDropShadow dx="9" dy="19" stdDeviation="12" floodColor="#001f2b" floodOpacity=".32" /></filter>
          <filter id={`${artworkId}-small-shadow`} x="-50%" y="-40%" width="220%" height="230%"><feDropShadow dx="5" dy="12" stdDeviation="8" floodColor="#001c29" floodOpacity=".29" /></filter>
          <filter id={`${artworkId}-contact-shadow`} x="-40%" y="-150%" width="180%" height="400%"><feGaussianBlur stdDeviation="8" /></filter>
        </defs>

        <motion.g {...reveal(0, 0, 5, 0.98)}>
          <ellipse cx="300" cy="210" rx="206" ry="172" fill={gradient("aura")} />
          <circle cx="298" cy="204" r="171" stroke="#b8e4cf" strokeOpacity=".12" />
          <circle cx="298" cy="204" r="146" stroke="#b8e4cf" strokeOpacity=".07" strokeDasharray="2 9" />
          <ellipse cx="298" cy="343" rx="177" ry="40" fill={gradient("platform")} stroke="#c9efda" strokeOpacity=".13" />
          <ellipse cx="296" cy="337" rx="144" ry="25" fill="#001d29" fillOpacity=".23" filter={gradient("contact-shadow")} />
          <path d="M94 280c-31-36 24-101 123-145s201-50 232-14" stroke="#b8e4cf" strokeOpacity=".22" strokeWidth="1.5" />
          <circle cx="110" cy="204" r="5" fill="#efb699" />
          <circle cx="469" cy="215" r="4" fill="#9be1cd" />
          <circle cx="185" cy="74" r="2.5" fill="#c7edda" fillOpacity=".65" />
        </motion.g>

        <motion.g {...reveal(0.035, -18, 15)}>
          <g transform="rotate(-14 208 202)" filter={gradient("shadow")}>
            <rect x="128" y="98" width="172" height="222" rx="25" fill={gradient("folio-edge")} />
            <rect x="117" y="87" width="172" height="222" rx="25" fill={gradient("paper")} stroke="#f5fff1" strokeOpacity=".65" />
            <rect x="169" y="76" width="70" height="27" rx="11" fill="#9cc9b7" stroke="#d3edda" strokeWidth="2" />
            <path d="M184 88h39" stroke="#e8f7e8" strokeWidth="5" strokeLinecap="round" />
            <circle cx="162" cy="140" r="17" fill="#d3e6d9" />
            <path d="M162 131v18m-9-9h18" stroke="#4a9d92" strokeWidth="5" strokeLinecap="round" />
            <path d="M192 133h54M192 146h35" stroke="#a6c7b7" strokeWidth="5" strokeLinecap="round" />
            <path d="M145 188h109M145 207h80M145 226h92" stroke="#b7d2c2" strokeWidth="6" strokeLinecap="round" />
            <rect x="143" y="253" width="91" height="27" rx="8" fill="#d4e7d7" />
            <circle cx="156" cy="266" r="4" fill="#76b4a0" />
            <path d="M168 266h50" stroke="#a5cbb6" strokeWidth="4" strokeLinecap="round" />
            <path d="M128 111v166" stroke="#fffef3" strokeOpacity=".8" strokeWidth="2" strokeLinecap="round" />
          </g>
        </motion.g>

        <motion.g {...reveal(0.08, 12, 22, 0.92)}>
          <g transform="rotate(7 311 193)" filter={gradient("shadow")}>
            <path d={heart} transform="translate(9 12)" fill={gradient("heart-edge")} />
            <path d={heart} fill={gradient("heart")} stroke="#a6f1d9" strokeOpacity=".6" strokeWidth="1.5" />
            <path d="M225 147c5-29 40-36 64-18" stroke={gradient("heart-shine")} strokeWidth="11" strokeLinecap="round" />
            <path d="M389 145c13 40-46 84-77 110" stroke="#b3efcf" strokeOpacity=".18" strokeWidth="2" strokeLinecap="round" />
            <path d="M249 186h33l13-30 23 65 19-41 11 15h30" stroke="#096b79" strokeOpacity=".22" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" transform="translate(1 4)" />
            <path d="M249 186h33l13-30 23 65 19-41 11 15h30" stroke="#effff0" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </motion.g>

        <motion.g {...reveal(0.11, 8, -12, 0.92)}>
          <g transform="rotate(12 435 113)" filter={gradient("small-shadow")}>
            <rect x="393" y="75" width="86" height="88" rx="18" fill="#518f88" />
            <rect x="387" y="68" width="86" height="88" rx="18" fill={gradient("calendar")} stroke="#ebffed" strokeOpacity=".65" />
            <path d="M387 89q0-21 20-21h46q20 0 20 21v9h-86Z" fill="#93ccbb" />
            <path d="M409 62v16M451 62v16" stroke="#d9f0d9" strokeWidth="6" strokeLinecap="round" />
            <path d="M406 114h9m13 0h9m13 0h4m-48 17h9m13 0h9" stroke="#80b5a1" strokeWidth="5" strokeLinecap="round" />
            <circle cx="450" cy="132" r="9" fill="#eeb596" />
            <path d="m446 132 3 3 5-6" stroke="#fff7e8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </motion.g>

        <motion.g {...reveal(0.14, 12, 18, 0.88)}>
          <g transform="rotate(-10 435 303)" filter={gradient("small-shadow")}>
            <rect x="407" y="277" width="70" height="70" rx="23" fill="#ae7263" />
            <rect x="401" y="269" width="70" height="70" rx="23" fill={gradient("coral")} stroke="#ffe3c5" strokeOpacity=".55" />
            <path d="M436 286v35m-17-17h35" stroke="#fff9e8" strokeWidth="10" strokeLinecap="round" />
            <path d="M410 286q0-8 9-9" stroke="#fff7e4" strokeOpacity=".65" strokeWidth="3" strokeLinecap="round" />
          </g>
        </motion.g>

        <motion.g {...reveal(0.12, 0, 5, 1)}>
          <path d="M455 131c33 37-22 102-122 146S133 327 101 292" stroke="#c4e9d0" strokeOpacity=".36" strokeWidth="1.5" />
          <path d="M112 303c37 19 117 8 194-22" stroke="#e6f4d9" strokeOpacity=".65" strokeWidth="2" strokeLinecap="round" />
          <circle cx="145" cy="308" r="7" fill="#b4e9d2" />
          <circle cx="150" cy="305" r="2" fill="#f0ffea" />
          <path d="M492 271v12m-6-6h12" stroke="#b3d8c5" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" />
        </motion.g>
      </svg>
    </div>
  );
}
