import { useEffect, useState } from "react";
import { useStudioPreferences } from "./studio/StudioPreferences";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function readPreference() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(REDUCED_MOTION_QUERY).matches
    : false;
}

// Listen directly so an open workspace responds to browser/OS changes without
// remounting its forms, chat state or API effects.
export function useLiveReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(readPreference);
  const { simpleUI } = useStudioPreferences();

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const preference = window.matchMedia(REDUCED_MOTION_QUERY);
    const updatePreference = () => setReducedMotion(preference.matches);

    if (typeof preference.addEventListener === "function") {
      preference.addEventListener("change", updatePreference);
      updatePreference();
      return () => preference.removeEventListener("change", updatePreference);
    }

    if (typeof preference.addListener === "function") {
      preference.addListener(updatePreference);
      updatePreference();
      return () => preference.removeListener(updatePreference);
    }

    updatePreference();
  }, []);

  return reducedMotion || simpleUI;
}

export default useLiveReducedMotion;
