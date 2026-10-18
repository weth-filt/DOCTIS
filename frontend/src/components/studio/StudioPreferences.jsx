import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const STUDIO_PREFERENCES_KEY = "doctis.ui.preferences.v1";
export const DEFAULT_STUDIO_PREFERENCES = Object.freeze({ theme: "light", simpleUI: false, sidebarCollapsed: false });

function normalizePreferences(value) {
  return {
    theme: value?.theme === "dark" ? "dark" : "light",
    simpleUI: value?.simpleUI === true,
    sidebarCollapsed: value?.sidebarCollapsed === true,
  };
}

export function readStudioPreferences() {
  try {
    return normalizePreferences(JSON.parse(window.localStorage.getItem(STUDIO_PREFERENCES_KEY) || "null"));
  } catch {
    return { ...DEFAULT_STUDIO_PREFERENCES };
  }
}

const noop = () => {};
const StudioPreferencesContext = createContext({
  ...DEFAULT_STUDIO_PREFERENCES,
  deviceTilt: false, setDeviceTilt: noop,
  setTheme: noop, toggleTheme: noop,
  setSimpleUI: noop, toggleSimpleUI: noop,
  setSidebarCollapsed: noop, toggleSidebarCollapsed: noop,
});

export function StudioPreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(readStudioPreferences);
  // Sensor permission is a per-session opt-in and is never written to storage.
  const [deviceTilt, setDeviceTilt] = useState(false);
  useEffect(() => {
    try { window.localStorage.setItem(STUDIO_PREFERENCES_KEY, JSON.stringify(preferences)); } catch { /* Private/storage-restricted mode still works in memory. */ }
  }, [preferences]);
  useEffect(() => {
    const sync = event => {
      if (event.key !== STUDIO_PREFERENCES_KEY && event.key !== null) return;
      setPreferences(readStudioPreferences());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const setTheme = useCallback(theme => setPreferences(current => ({ ...current, theme: theme === "dark" ? "dark" : "light" })), []);
  const toggleTheme = useCallback(() => setPreferences(current => ({ ...current, theme: current.theme === "dark" ? "light" : "dark" })), []);
  const setSimpleUI = useCallback(value => setPreferences(current => ({ ...current, simpleUI: Boolean(value) })), []);
  const toggleSimpleUI = useCallback(() => setPreferences(current => ({ ...current, simpleUI: !current.simpleUI })), []);
  const setSidebarCollapsed = useCallback(value => setPreferences(current => ({ ...current, sidebarCollapsed: Boolean(value) })), []);
  const toggleSidebarCollapsed = useCallback(() => setPreferences(current => ({ ...current, sidebarCollapsed: !current.sidebarCollapsed })), []);
  const value = useMemo(() => ({ ...preferences, deviceTilt, setDeviceTilt, setTheme, toggleTheme, setSimpleUI, toggleSimpleUI, setSidebarCollapsed, toggleSidebarCollapsed }),
    [preferences, deviceTilt, setTheme, toggleTheme, setSimpleUI, toggleSimpleUI, setSidebarCollapsed, toggleSidebarCollapsed]);
  return <StudioPreferencesContext.Provider value={value}>{children}</StudioPreferencesContext.Provider>;
}

export function useStudioPreferences() {
  return useContext(StudioPreferencesContext);
}
