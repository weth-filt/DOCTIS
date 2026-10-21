import API from "./api";

// One short, in-memory handoff from successful login to the selected workspace.
// No medical responses are written to localStorage/sessionStorage or shared
// across logins. Normal reads only share requests that are still in flight.
const reads = new Map();
let sessionToken;
const HANDOFF_MS = 30000;

function clearReads() {
  reads.forEach(entry => clearTimeout(entry.timer));
  reads.clear();
}

function read(path, config, retain) {
  const token = localStorage.getItem("token") || "";
  if (token !== sessionToken) { clearReads(); sessionToken = token; }
  // Parameterized/cancellable requests keep their caller's independent lifetime.
  if (!token || config?.signal || config?.params) return API.get(path, config);
  const existing = reads.get(path);
  if (existing) {
    if (!retain) {
      existing.retain = false;
      if (existing.settled) { clearTimeout(existing.timer); reads.delete(path); }
    }
    return existing.promise;
  }
  const entry = { retain, settled: false };
  const remove = () => {
    clearTimeout(entry.timer);
    if (reads.get(path) === entry) reads.delete(path);
  };
  entry.promise = API.get(path, config).then(response => {
    entry.settled = true;
    if (!entry.retain) remove();
    return response;
  }, error => { remove(); throw error; });
  // Also expire a speculative request that never settles; it cannot be reused forever.
  entry.timer = setTimeout(remove, HANDOFF_MS);
  reads.set(path, entry);
  return entry.promise;
}

export const readWorkspace = (path, config) => read(path, config, false);

export function primeWorkspaceReads(role) {
  const paths = role === "admin"
    ? ["/admin/users", "/admin/assignments/patients", "/admin/assignments/doctors"]
    : role === "doctor"
    ? ["/doctor/patients?summary=1", "/appointments/doctor"]
    : ["/health/history", "/profile", "/appointments/patient"];
  paths.forEach(path => {
    try { read(path, undefined, true).catch(() => {}); }
    catch { /* Speculation must not interrupt successful authentication. */ }
  });
}

// A successful login, profile edit, appointment action, etc. invalidates any
// prefetched snapshot. Never hand a pre-write response to a post-write refresh.
API.interceptors?.request?.use?.(config => {
  if (!["get", "head", "options"].includes(String(config.method || "get").toLowerCase())) clearReads();
  return config;
});
API.interceptors?.response?.use?.(response => {
  if (!["get", "head", "options"].includes(String(response.config?.method || "get").toLowerCase())) clearReads();
  return response;
}, error => {
  if (!["get", "head", "options"].includes(String(error.config?.method || "get").toLowerCase())) clearReads();
  return Promise.reject(error);
});
