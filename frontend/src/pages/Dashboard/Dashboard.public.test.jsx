import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Dashboard from "./Dashboard";
import API from "../../services/api";
import { StudioPreferencesProvider } from "../../components/studio/StudioPreferences";
jest.mock("../../services/api", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() }));
jest.mock("../../components/studio/StudioExperience", () => () => null);
jest.mock("../../components/3d/HeartScene", () => ({ __esModule: true, default: () => null, HeartSceneProvider: ({ children }) => children, SceneBoundary: ({ children }) => children }));
jest.mock("../../components/3d/ChartDepth", () => () => null);
jest.mock("../../components/DashboardChart", () => ({ HEALTH_METRICS: [
  { key: "glucose", label: "Đường huyết", unit: "mg/dL", lines: [{ key: "glucose" }] },
  { key: "pressure", label: "Huyết áp", unit: "mmHg", lines: [{ key: "systolic" }, { key: "diastolic" }] },
  { key: "bmi", label: "BMI", unit: "kg/m²", lines: [{ key: "bmi" }] },
  { key: "heartRate", label: "Nhịp tim", unit: "bpm", lines: [{ key: "heartRate" }] },
], MeasurementPlot: () => <div /> }));
jest.mock("framer-motion", () => {
  const React = require("react"); const components = {};
  return { MotionConfig: ({ children }) => children, AnimatePresence: ({ children }) => children,
    motion: new Proxy({}, { get: (_target, tag) => {
      if (!components[tag]) components[tag] = React.forwardRef(({ children, initial, animate, exit, transition, layout, layoutId, whileInView, viewport, whileHover, whileTap, ...props }, ref) => React.createElement(tag, { ...props, ref }, children)); return components[tag];
    } }),
  };
});
const profile = { _id: "patient-fixture", username: "patient-fixture", fullName: "Bệnh nhân kiểm thử", email: "patient@example.test", cccd: "000000000001", phone: "0900000000", fatherPhone: "0900000001", dateOfBirth: "1990-01-01", gender: "Nam", bloodType: "O+", allergies: "Không có", chronicDiseases: "Không có bệnh nền", medicalHistory: "Tiền sử đã lưu", address: "Địa chỉ cũ", ward: "Phường cũ", wardId: "ward-old", city: "Đà Nẵng", province: "Đà Nẵng" };
const hospital = { id: "hospital-fixture", name: "Bệnh viện kiểm thử", address: "Địa chỉ bệnh viện kiểm thử", phone: "0000" };
const careTeam = { status: "hospital_selected", hospital, doctor: null, requiresAddressUpdate: false, address: { address: "Địa chỉ mới đã lưu", wardId: "ward-new", ward: "Phường mới đã lưu", city: "Đà Nẵng" } };
const originalMatchMedia = window.matchMedia;
const originalAlert = window.alert;
const originalScrollTo = window.scrollTo;
const originalElementScrollTo = HTMLElement.prototype.scrollTo;
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
let appointments, notifications;
beforeAll(() => {
  window.matchMedia = query => ({ matches: query.includes("prefers-reduced-motion"), addEventListener: jest.fn(), removeEventListener: jest.fn() });
  window.scrollTo = jest.fn(); HTMLElement.prototype.scrollTo = jest.fn(); HTMLElement.prototype.scrollIntoView = jest.fn(); window.alert = jest.fn();
});
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); localStorage.setItem("user", JSON.stringify({ _id: profile._id, fullName: profile.fullName, role: "user" }));
  const stamp = new Date(new Date().getFullYear(), new Date().getMonth(), 10, 9, 30).toISOString();
  appointments = ["pending", "approved", "completed"].map((status, index) => ({ _id: `appointment-${index}`, doctorId: { _id: "doctor-fixture", fullName: "Bác sĩ lịch kiểm thử" }, patientId: profile._id, appointmentDate: stamp, type: "Tái khám", status }));
  notifications = [];
  API.get.mockImplementation(path => {
    if (path === "/profile") return Promise.resolve({ data: profile });
    if (path === "/care-team") return Promise.resolve({ data: careTeam });
    if (path === "/public/wards") return Promise.resolve({ data: { wards: [{ id: "ward-new", name: "Phường mới đã lưu" }] } });
    if (path === "/appointments/patient") return Promise.resolve({ data: appointments });
    if (path === "/notifications") return Promise.resolve({ data: { notifications, unreadCount: notifications.filter(item => !item.readAt).length } });
    if (path === "/care-plans/my" || path === "/care-plans/current") return Promise.resolve({ data: null });
    if (path === "/ai/conversations") return Promise.resolve({ data: { conversations: [] } });
    if (["/health/history", "/health/advices", "/messages/doctors", "/prescriptions/my"].includes(path)) return Promise.resolve({ data: [] });
    return Promise.reject(new Error(`Unexpected isolated test read: ${path}`));
  });
  API.post.mockRejectedValue(new Error("No post operation authorized in this fixture"));
  API.delete.mockRejectedValue(new Error("No deletion authorized in this fixture"));
  API.patch.mockImplementation((path, body) => Promise.resolve({ data: path === "/care-team/address" ? { ...careTeam, address: { ...careTeam.address, ...body }, msg: "Đã cập nhật địa chỉ kiểm thử" } : { notification: { ...notifications.find(item => path.includes(item.id)), readAt: new Date().toISOString() } } }));
  API.put.mockImplementation((path, body) => {
    if (path === "/profile") return Promise.resolve({ data: { profile: { ...profile, ...body } } });
    const id = path.split("/").at(-1);
    appointments = appointments.map(item => item._id === id ? { ...item, status: "cancelled", cancelReason: body.reason } : item);
    const saved = appointments.find(item => item._id === id);
    // The real cancellation API returns IDs, not populated doctor/patient data.
    return Promise.resolve({ data: { appointment: { ...saved, doctorId: "doctor-fixture", patientId: profile._id }, msg: "Đã hủy kiểm thử" } });
  });
});
afterEach(() => { expect(API.post).not.toHaveBeenCalled(); expect(API.delete).not.toHaveBeenCalled(); });
afterAll(() => { localStorage.clear(); window.matchMedia = originalMatchMedia; window.alert = originalAlert; window.scrollTo = originalScrollTo; HTMLElement.prototype.scrollTo = originalElementScrollTo; HTMLElement.prototype.scrollIntoView = originalScrollIntoView; });
async function open() { const result = render(<StudioPreferencesProvider><Dashboard /></StudioPreferencesProvider>); await screen.findByRole("heading", { name: /Bệnh nhân kiểm thử/ }); return result; }
function navigate(label) { fireEvent.click(within(screen.getByRole("navigation", { name: "Điều hướng chính" })).getByRole("button", { name: label })); }

test("patient cancellation hides actions for completed records, closing preserves the appointment and confirmed state keeps the doctor identity", async () => {
  await open(); navigate("Lịch hẹn khám");
  const agenda = screen.getByRole("region", { name: "Danh sách lịch hẹn" });
  await waitFor(() => expect(within(agenda).getAllByRole("button", { name: "Hủy lịch hẹn" })).toHaveLength(2));
  fireEvent.click(within(agenda).getAllByRole("button", { name: "Hủy lịch hẹn" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Giữ lịch hẹn" })); expect(API.put).not.toHaveBeenCalled();
  fireEvent.click(within(agenda).getAllByRole("button", { name: "Hủy lịch hẹn" })[0]);
  fireEvent.change(screen.getByRole("textbox", { name: /Lý do hủy/ }), { target: { value: "Lý do kiểm thử" } });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy", exact: true }));
  await waitFor(() => expect(API.put).toHaveBeenCalledWith("/appointments/cancel/appointment-0", { reason: "Lý do kiểm thử" }));
  await within(agenda).findByText("Đã hủy");
  const cancelled = [...agenda.querySelectorAll(".appointment-detail-card")].find(card => card.textContent.includes("Đã hủy"));
  expect(within(cancelled).getByText("Bác sĩ lịch kiểm thử")).toBeTruthy();
  expect(within(cancelled).queryByRole("button", { name: "Hủy lịch hẹn" })).toBeNull();
});

test("saving the care-team location synchronizes only location fields without overwriting a clinical profile draft", async () => {
  await open(); navigate("Hồ sơ bệnh nhân");
  fireEvent.change(screen.getByLabelText("Tiền sử bệnh"), { target: { value: "Bản nháp lâm sàng chưa lưu" } });
  navigate("Bệnh viện và bác sĩ phụ trách");
  await screen.findByRole("heading", { name: hospital.name });
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật địa chỉ" }));
  await screen.findByRole("option", { name: "Phường mới đã lưu" });
  fireEvent.change(screen.getByLabelText("Địa chỉ chi tiết *"), { target: { value: "Địa chỉ mới qua biểu mẫu" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu địa chỉ" }));
  await screen.findByText("Đã cập nhật địa chỉ kiểm thử");
  navigate("Hồ sơ bệnh nhân");
  expect(screen.getByLabelText("Tiền sử bệnh").value).toBe("Bản nháp lâm sàng chưa lưu");
  expect(screen.getByLabelText("Địa chỉ chi tiết").value).toBe("Địa chỉ mới qua biểu mẫu");
  expect(screen.getByLabelText("Địa chỉ chi tiết").readOnly).toBe(true);
  expect(screen.getByLabelText("Phường").value).toBe(careTeam.address.ward);
  expect(screen.getByLabelText("Thành phố").value).toBe("Đà Nẵng");
});

test("saving clinical profile excludes protected location fields from the generic profile endpoint", async () => {
  const { container } = await open(); navigate("Hồ sơ bệnh nhân");
  fireEvent.change(screen.getByLabelText("Tiền sử bệnh"), { target: { value: "Bản nháp lâm sàng đã xác nhận" } });
  fireEvent.click(container.querySelector(".profile-save-btn"));
  await waitFor(() => expect(API.put).toHaveBeenCalledWith("/profile", expect.objectContaining({ medicalHistory: "Bản nháp lâm sàng đã xác nhận" })));
  const payload = API.put.mock.calls.find(([path]) => path === "/profile")[1];
  for (const field of ["address", "province", "district", "ward", "wardId", "city"]) expect(payload).not.toHaveProperty(field);
});

test("an appointment notification selects the actual record even when it is outside the current month", async () => {
  appointments = [{ ...appointments[0], _id: "older-appointment", appointmentDate: new Date(new Date().getFullYear(), new Date().getMonth() - 3, 12, 9, 30).toISOString(), doctorId: { _id: "older-doctor", fullName: "Bác sĩ cuộc hẹn cũ" } }];
  notifications = [{ id: "notice-fixture", title: "Lịch hẹn kiểm thử cần xem", message: "Cập nhật lịch đã lưu", entityType: "appointment", entityId: "older-appointment", createdAt: new Date().toISOString(), readAt: null }];
  await open();
  fireEvent.click(await screen.findByRole("button", { name: "Thông báo, 1 chưa đọc" }));
  fireEvent.click(screen.getByRole("button", { name: /Lịch hẹn kiểm thử cần xem/ }));
  const agenda = await screen.findByRole("region", { name: "Danh sách lịch hẹn" });
  await within(agenda).findByText("Bác sĩ cuộc hẹn cũ");
});
