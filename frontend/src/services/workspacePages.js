// A login screen only needs its own code. Start the selected workspace download
// as soon as authentication succeeds, while the welcome screen is visible.
export const loadPatientWorkspace = () => import("../pages/Dashboard/Dashboard");
export const loadDoctorWorkspace = () => import("../pages/Dashboard/DoctorDashboard");
export const loadAdminWorkspace = () => import("../pages/admin/AdminDashboard");

export function preloadWorkspace(role) {
  const load = role === "admin" ? loadAdminWorkspace : role === "doctor" ? loadDoctorWorkspace : loadPatientWorkspace;
  // A failed speculative download must not turn a successful login into an error.
  load().catch(() => {});
}
