import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Dashboard from "./Dashboard";
import API from "../../services/api";
import { StudioPreferencesProvider } from "../../components/studio/StudioPreferences";

// These fixtures exist only in this test. No HTTP client, canvas or credentials
// are used, and every write method is guarded against accidental interaction.
jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock("../../components/studio/StudioExperience", () => () => null);
jest.mock("../../components/3d/HeartScene", () => ({
  __esModule: true,
  default: () => <div data-testid="heart-presentation-placeholder" aria-hidden="true" />,
  HeartSceneProvider: ({ children }) => children,
  SceneBoundary: ({ children }) => children,
}));
jest.mock("../../components/3d/ChartDepth", () => ({
  __esModule: true,
  default: ({ data }) => <div data-testid="depth-presentation-placeholder">{data.length} records</div>,
}));
jest.mock("../../components/DashboardChart", () => ({
  HEALTH_METRICS: [
    { key: "glucose", label: "Đường huyết", unit: "mg/dL", lines: [{ key: "glucose" }] },
    { key: "pressure", label: "Huyết áp", unit: "mmHg", lines: [{ key: "systolic" }, { key: "diastolic" }] },
    { key: "bmi", label: "BMI", unit: "kg/m²", lines: [{ key: "bmi" }] },
    { key: "heartRate", label: "Nhịp tim", unit: "bpm", lines: [{ key: "heartRate" }] },
  ],
  MeasurementPlot: ({ data, metric, mode }) => <div data-testid="measurement-presentation-placeholder">{metric.key}:{mode}:{data.length}</div>,
}));
jest.mock("framer-motion", () => {
  const React = require("react");
  const components = {};
  return {
    MotionConfig: ({ children }) => children,
    AnimatePresence: ({ children }) => children,
    motion: new Proxy({}, { get: (_target, tag) => {
      if (!components[tag]) components[tag] = React.forwardRef(({ children, initial, animate, exit, transition, layout, layoutId, whileInView, viewport, whileHover, whileTap, ...props }, ref) => React.createElement(tag, { ...props, ref }, children));
      return components[tag];
    } }),
  };
});

const originalFetch = global.fetch;
const originalScrollTo = window.scrollTo;
const originalElementScrollTo = HTMLElement.prototype.scrollTo;
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
const originalMatchMedia = window.matchMedia;
const appointmentDate = new Date(new Date().getFullYear(), new Date().getMonth(), 10, 9, 30).toISOString();
const READ_FIXTURES = {
  "/care-plans/my": null,
  "/care-plans/current": null,
  "/ai/conversations": {conversations:[],hasMore:false},
  "/notifications": {notifications:[],unreadCount:0,nextCursor:null},
  "/health/history": [{ _id: "test-reading", createdAt: "2026-10-16T08:00:00.000Z", height: 170, weight: 65, bmi: 22.49, glucose: 100, systolic: 120, diastolic: 80, heartRate: 75 }],
  "/health/advices": [],
  "/appointments/patient": [{ _id: "test-appointment", appointmentDate, doctorId: { fullName: "Bác sĩ kiểm thử" }, type: "Tái khám đã lưu", status: "approved", note: "Ghi chú lịch hẹn kiểm thử" }],
  "/profile": { _id: "test-patient", fullName: "Bệnh nhân kiểm thử", email: "patient@example.test", bloodType: "O+", allergies: "Không có", chronicDiseases: "Không có bệnh nền" },
  "/messages/doctors": [],
  "/prescriptions/my": [],
};

beforeAll(() => {
  window.scrollTo = jest.fn();
  HTMLElement.prototype.scrollTo = jest.fn();
  HTMLElement.prototype.scrollIntoView = jest.fn();
  window.matchMedia = () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn(), addListener: jest.fn(), removeListener: jest.fn() });
});
beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("user", JSON.stringify({ _id: "test-patient", fullName: "Bệnh nhân kiểm thử", role: "patient" }));
  jest.clearAllMocks();
  API.get.mockImplementation((path) => {
    if (!Object.prototype.hasOwnProperty.call(READ_FIXTURES, path)) return Promise.reject(new Error(`Unexpected test-only read: ${path}`));
    return Promise.resolve({ data: JSON.parse(JSON.stringify(READ_FIXTURES[path])) });
  });
  const blockWrite = () => Promise.reject(new Error("Write operations are disabled in presentation integration tests."));
  API.post.mockImplementation(blockWrite);
  API.put.mockImplementation(blockWrite);
  API.delete.mockImplementation(blockWrite);
  global.fetch = jest.fn(() => Promise.reject(new Error("Remote fetch is disabled in presentation integration tests.")));
});
afterEach(() => {
  expect(API.post).not.toHaveBeenCalled();
  expect(API.put).not.toHaveBeenCalled();
  expect(API.delete).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
});
afterAll(() => {
  global.fetch = originalFetch;
  window.scrollTo = originalScrollTo;
  HTMLElement.prototype.scrollTo = originalElementScrollTo;
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  window.matchMedia = originalMatchMedia;
  window.localStorage.clear();
});

async function openDashboard() {
  const result = render(<StudioPreferencesProvider><Dashboard /></StudioPreferencesProvider>);
  await screen.findByRole("heading", { name: /Bệnh nhân kiểm thử/ });
  const initialReads = Object.keys(READ_FIXTURES).filter(path => path !== "/ai/conversations");
  await waitFor(() => expect(API.get).toHaveBeenCalledTimes(initialReads.length));
  initialReads.forEach(path => expect(API.get.mock.calls.filter(([requested]) => requested === path)).toHaveLength(1));
  return result;
}
function navigate(label) {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Điều hướng chính" })).getByRole("button", { name: label }));
}

test("health draft survives menu changes and preferences preserve the input DOM node", async () => {
  const { container } = await openDashboard();
  const originalReads = API.get.mock.calls.length;
  navigate("Thông tin sức khỏe");
  const height = screen.getByLabelText("Chiều cao (cm)");
  fireEvent.change(height, { target: { value: "173" } });
  const weight = screen.getByLabelText("Cân nặng (kg)");
  fireEvent.change(weight, { target: { value: "68" } });
  height.focus();
  fireEvent.click(screen.getByRole("button", { name: "Bật giao diện tối" }));
  expect(screen.getByLabelText("Chiều cao (cm)")).toBe(height);
  expect(height.value).toBe("173");
  expect(document.activeElement).toBe(height);
  expect(container.querySelector("[data-studio-theme]").dataset.studioTheme).toBe("dark");
  fireEvent.click(screen.getByRole("button", { name: "Giao diện đơn giản" }));
  expect(screen.getByLabelText("Chiều cao (cm)")).toBe(height);
  expect(document.activeElement).toBe(height);
  expect(container.querySelector("[data-studio-simple]").dataset.studioSimple).toBe("true");
  navigate("Biểu đồ & lịch sử");
  expect(screen.queryByLabelText("Chiều cao (cm)")).toBeNull();
  navigate("Thông tin sức khỏe");
  expect(screen.getByLabelText("Chiều cao (cm)").value).toBe("173");
  expect(screen.getByLabelText("Cân nặng (kg)").value).toBe("68");
  expect(API.get).toHaveBeenCalledTimes(originalReads);
});

test("profile section navigation and numeric steppers target existing controls", async () => {
  await openDashboard();
  navigate("Hồ sơ bệnh nhân");
  const sections = within(screen.getByRole("navigation", { name: "Các phần trong hồ sơ" }));
  expect(sections.getAllByRole("button").length).toBe(5);
  fireEvent.click(sections.getByRole("button", { name: /Thông tin y tế cơ bản/ }));
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  expect(screen.getByLabelText("Họ và tên *").value).toBe("Bệnh nhân kiểm thử");
  navigate("Thông tin sức khỏe");
  expect(screen.getByRole("heading", { name: "Thể trạng" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Chỉ số sinh hiệu" })).toBeTruthy();
  const height = screen.getByLabelText("Chiều cao (cm)");
  fireEvent.change(height, { target: { value: "170" } });
  fireEvent.click(screen.getByRole("button", { name: "Tăng Chiều cao (cm)" }));
  expect(height.value).toBe("171");
  fireEvent.click(screen.getByRole("button", { name: "Giảm Chiều cao (cm)" }));
  expect(height.value).toBe("170");
});

test("AI suggestion fills and preserves a draft without sending an API request", async () => {
  await openDashboard();
  const originalReads = API.get.mock.calls.length;
  navigate("AI phân tích");
  await waitFor(() => expect(API.get).toHaveBeenCalledWith("/ai/conversations"));
  fireEvent.click(screen.getByRole("button", { name: /Tôi muốn hỏi về bữa ăn và vận động/ }));
  expect(screen.getByRole("textbox", { name: "Nhập câu hỏi cho DOCTIS" }).value).toBe("Tôi muốn hỏi về bữa ăn và vận động");
  expect(screen.getByText(/Thông tin AI chỉ để tham khảo/)).toBeTruthy();
  navigate("Thông tin sức khỏe");
  navigate("AI phân tích");
  expect(screen.getByRole("textbox", { name: "Nhập câu hỏi cho DOCTIS" }).value).toBe("Tôi muốn hỏi về bữa ăn và vận động");
  expect(API.get).toHaveBeenCalledTimes(originalReads + 1);
});

test("profile view and edit modes preserve the same controlled fields and draft", async () => {
  await openDashboard();
  navigate("Hồ sơ bệnh nhân");
  const originalReads = API.get.mock.calls.length;
  const name = screen.getByLabelText("Họ và tên *");
  fireEvent.change(name, { target: { value: "Bản nháp chưa lưu" } });
  fireEvent.click(screen.getByRole("button", { name: "Xem hồ sơ" }));
  expect(screen.getByLabelText("Họ và tên *")).toBe(name);
  expect(name.value).toBe("Bản nháp chưa lưu");
  expect(name.closest("fieldset").disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa", exact: true }));
  expect(screen.getByLabelText("Họ và tên *")).toBe(name);
  expect(name.closest("fieldset").disabled).toBe(false);
  expect(name.value).toBe("Bản nháp chưa lưu");
  navigate("Biểu đồ & lịch sử");
  navigate("Hồ sơ bệnh nhân");
  expect(screen.getByLabelText("Họ và tên *").value).toBe("Bản nháp chưa lưu");
  expect(API.get).toHaveBeenCalledTimes(originalReads);
});

test("appointment interior shows read-only existing date, doctor, status and note", async () => {
  await openDashboard();
  const originalReads = API.get.mock.calls.length;
  navigate("Lịch hẹn khám");
  expect(screen.getByText("Bác sĩ kiểm thử")).toBeTruthy();
  expect(screen.getByText("Đã xác nhận")).toBeTruthy();
  expect(screen.getByText(/Tái khám đã lưu/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết" }));
  expect(screen.getByText("Ghi chú lịch hẹn kiểm thử")).toBeTruthy();
  expect(screen.getByText(new Date(appointmentDate).toLocaleDateString("vi-VN"))).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Đặt lịch|Xác nhận lịch/ })).toBeNull();
  expect(API.get).toHaveBeenCalledTimes(originalReads);
});
