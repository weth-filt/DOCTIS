import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import DoctorDashboard from "./DoctorDashboard";
import API from "../../services/api";
import { StudioPreferencesProvider } from "../../components/studio/StudioPreferences";
jest.mock("../../services/api", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn() }));
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock("../../components/3d/HeartScene", () => () => null);
jest.mock("../../components/CareScene", () => () => null);
jest.mock("../../components/HealthAnalytics", () => () => null);
jest.mock("../../components/studio/StudioExperience", () => () => null);
jest.mock("framer-motion", () => {
  const React = require("react"); const components = {};
  return { MotionConfig: ({ children }) => children, motion: new Proxy({}, { get: (_target, tag) => {
    if (!components[tag]) components[tag] = React.forwardRef(({ children, initial, animate, exit, transition, layout, layoutId, whileHover, whileTap, ...props }, ref) => React.createElement(tag, { ...props, ref }, children)); return components[tag];
  } }) };
});
const patient = { _id: "patient-fixture", fullName: "Bệnh nhân kiểm thử", chronicDiseases: "Bệnh nền do bệnh nhân khai báo" };
const originalMatchMedia = window.matchMedia;
let appointments;
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); localStorage.setItem("user", JSON.stringify({ _id: "doctor-fixture", fullName: "Bác sĩ kiểm thử", role: "doctor" }));
  window.matchMedia = () => ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  appointments = ["pending", "approved", "completed"].map((status, index) => ({ _id: `appointment-${index}`, patientId: patient, appointmentDate: "2026-10-20T08:00:00Z", type: "Tái khám", status }));
  API.get.mockImplementation(path => Promise.resolve({ data: path === "/appointments/doctor" ? appointments : path === "/doctor/patients" ? [patient] : path === "/notifications" ? { notifications: [], unreadCount: 0 } : [] }));
  API.put.mockImplementation((path, body) => {
    const id = path.split("/").at(-1); appointments = appointments.map(item => item._id === id ? { ...item, status: "cancelled", cancellationReason: body.reason } : item);
    return Promise.resolve({ data: { appointment: appointments.find(item => item._id === id), msg: "Đã hủy kiểm thử" } });
  });
});
afterEach(() => { window.matchMedia = originalMatchMedia; localStorage.clear(); });
async function openAppointments() {
  const result = render(<StudioPreferencesProvider><DoctorDashboard /></StudioPreferencesProvider>);
  await waitFor(() => expect(API.get).toHaveBeenCalledWith("/appointments/doctor", expect.anything()));
  fireEvent.click(screen.getByRole("button", { name: "Lịch hẹn", exact: true }));
  await screen.findByText("Đã hoàn thành"); return result;
}
test("doctor cancellation is available only for pending or approved appointments and closing preserves the record", async () => {
  const { container } = await openAppointments();
  expect(screen.getAllByRole("button", { name: "Hủy", exact: true })).toHaveLength(2);
  const completed = container.querySelector(".appointment-status.completed").closest(".appointment-row");
  expect(within(completed).queryByRole("button", { name: "Hủy", exact: true })).toBeNull();
  fireEvent.click(screen.getAllByRole("button", { name: "Hủy", exact: true })[0]);
  expect(screen.getByRole("dialog", { name: "Xác nhận hủy lịch hẹn" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Giữ lịch hẹn" }));
  expect(API.put).not.toHaveBeenCalled(); expect(screen.getAllByRole("button", { name: "Hủy", exact: true })).toHaveLength(2);
});
test("confirmed doctor cancellation sends the reason and reloads the persisted appointment state", async () => {
  await openAppointments();
  fireEvent.click(screen.getAllByRole("button", { name: "Hủy", exact: true })[0]);
  fireEvent.change(screen.getByRole("textbox", { name: /Lý do hủy/ }), { target: { value: "Lý do kiểm thử" } });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy", exact: true }));
  await waitFor(() => expect(API.put).toHaveBeenCalledWith("/appointments/cancel/appointment-0", { reason: "Lý do kiểm thử" }));
  await screen.findByText("Đã hủy"); expect(screen.getAllByRole("button", { name: "Hủy", exact: true })).toHaveLength(1);
  expect(API.post).not.toHaveBeenCalled();
});
