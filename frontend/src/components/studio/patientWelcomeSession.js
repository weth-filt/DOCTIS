// Presentation state only. Never store a JWT or patient details in this marker.
export const PATIENT_WELCOME_KEY = "doctis.ui.patient-welcome.v1";
let pendingInMemory = false;

export function beginPatientWelcome() {
  pendingInMemory = true;
  try { window.sessionStorage.setItem(PATIENT_WELCOME_KEY, "pending"); } catch { /* Same-tab navigation still works when session storage is restricted. */ }
}

export function hasPendingPatientWelcome() {
  try { return window.sessionStorage.getItem(PATIENT_WELCOME_KEY) === "pending" || pendingInMemory; }
  catch { return pendingInMemory; }
}

export function completePatientWelcome() {
  pendingInMemory = false;
  try { window.sessionStorage.removeItem(PATIENT_WELCOME_KEY); } catch { /* The in-memory marker is cleared as well. */ }
}
