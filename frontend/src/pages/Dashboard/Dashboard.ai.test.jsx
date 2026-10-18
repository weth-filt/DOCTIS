import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

// All records and replies below are synthetic test fixtures. Every HTTP
// method is mocked, so these checks cannot contact an AI provider or database.
const originalFetch = global.fetch;
const originalScrollTo = window.scrollTo;
const originalElementScrollTo = HTMLElement.prototype.scrollTo;
const originalMatchMedia = window.matchMedia;
const READ_FIXTURES = {
  "/care-plans/my": null,
  "/care-plans/current": null,
  "/health/history": [{ _id: "test-reading", createdAt: "2026-10-16T08:00:00.000Z", height: 170, weight: 65, bmi: 22.49, glucose: 100, systolic: 120, diastolic: 80, heartRate: 75 }],
  "/health/advices": [],
  "/appointments/patient": [],
  "/profile": { _id: "test-patient", fullName: "Bệnh nhân kiểm thử", email: "patient@example.test", allergies: "Không có", chronicDiseases: "Đái tháo đường type 2" },
  "/messages/doctors": [],
  "/prescriptions/my": [],
};
let consoleError;
beforeAll(() => {
  window.scrollTo = jest.fn();
  HTMLElement.prototype.scrollTo = jest.fn();
  // Reduced motion renders the complete real response immediately. Animation
  // itself is covered separately by AIResponse.test.jsx.
  window.matchMedia = (query) => ({ matches: query.includes("prefers-reduced-motion"), addEventListener: jest.fn(), removeEventListener: jest.fn(), addListener: jest.fn(), removeListener: jest.fn() });
});
beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("user", JSON.stringify({ _id: "test-patient", fullName: "Bệnh nhân kiểm thử", role: "patient" }));
  jest.clearAllMocks();
  API.get.mockImplementation((path) => Object.prototype.hasOwnProperty.call(READ_FIXTURES, path)
    ? Promise.resolve({ data: JSON.parse(JSON.stringify(READ_FIXTURES[path])) })
    : Promise.reject(new Error(`Unexpected test-only read: ${path}`)));
  API.post.mockImplementation(() => Promise.reject(new Error("Unexpected test-only request")));
  API.put.mockImplementation(() => Promise.reject(new Error("Profile writes are disabled.")));
  API.delete.mockImplementation(() => Promise.reject(new Error("Deletion is disabled.")));
  global.fetch = jest.fn(() => Promise.reject(new Error("Remote fetch is disabled.")));
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  expect(API.put).not.toHaveBeenCalled();
  expect(API.delete).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(API.post.mock.calls.every(([path]) => path === "/ai/analyze")).toBe(true);
  consoleError.mockRestore();
});
afterAll(() => {
  global.fetch = originalFetch;
  window.scrollTo = originalScrollTo;
  HTMLElement.prototype.scrollTo = originalElementScrollTo;
  window.matchMedia = originalMatchMedia;
  window.localStorage.clear();
});

async function openAI() {
  const result = render(<StudioPreferencesProvider><Dashboard /></StudioPreferencesProvider>);
  await screen.findByRole("heading", { name: /Bệnh nhân kiểm thử/ });
  await waitFor(() => expect(API.get).toHaveBeenCalledTimes(Object.keys(READ_FIXTURES).length));
  fireEvent.click(within(screen.getByRole("navigation", { name: "Điều hướng chính" })).getByRole("button", { name: "AI phân tích" }));
  return { ...result, input: screen.getByRole("textbox", { name: "Nhập câu hỏi về đái tháo đường type 2" }) };
}
function submit(input, message) {
  fireEvent.change(input, { target: { value: message } });
  fireEvent.click(screen.getByRole("button", { name: "Gửi", exact: true }));
}
function lastReply(container) {
  const replies = container.querySelectorAll(".chat-message.ai:not(.error) .assistant-response > span[aria-hidden='true']");
  return replies[replies.length - 1];
}
function pendingReply() {
  let resolve, reject;
  const promise = new Promise((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}

test("sends the current question once without greeting or client-side health context, and displays the provider reply verbatim", async () => {
  const response = "Nội dung phản hồi kiểm thử từ dịch vụ.\n• Ý thứ hai giữ nguyên.";
  API.post.mockResolvedValue({ data: { reply: response, provider: "test" } });
  const { container, input } = await openAI();
  submit(input, "  Tôi cần hỏi về chỉ số đã lưu.  ");
  await waitFor(() => expect(lastReply(container).textContent).toBe(response));
  expect(API.post).toHaveBeenCalledTimes(1);
  expect(API.post).toHaveBeenCalledWith("/ai/analyze", {
    message: "Tôi cần hỏi về chỉ số đã lưu.", history: [],
  }, { timeout: 150000 });
  expect(input.value).toBe("");
  expect(screen.getByRole("button", { name: "Gửi", exact: true }).disabled).toBe(true);
});

test("retains completed conversation turns while excluding greeting and failed replies from history", async () => {
  const backendMessage = "Dịch vụ AI tạm thời không khả dụng.";
  API.post.mockRejectedValueOnce({ response: { status: 502, data: { msg: backendMessage } } })
    .mockResolvedValueOnce({ data: { reply: "Câu trả lời đã hoàn tất." } })
    .mockResolvedValueOnce({ data: { reply: "Câu trả lời tiếp theo." } });
  const { container, input } = await openAI();
  submit(input, "Câu hỏi đầu tiên");
  await waitFor(() => expect(container.querySelector(".chat-message.ai.error .assistant-response > span[aria-hidden='true']").textContent).toBe(backendMessage));
  expect(input.value).toBe("Câu hỏi đầu tiên");
  expect(screen.getByRole("button", { name: "Gửi", exact: true }).disabled).toBe(false);
  submit(input, "Câu hỏi thứ hai");
  await waitFor(() => expect(lastReply(container).textContent).toBe("Câu trả lời đã hoàn tất."));
  submit(input, "Câu hỏi thứ ba");
  await waitFor(() => expect(lastReply(container).textContent).toBe("Câu trả lời tiếp theo."));
  expect(API.post.mock.calls[2][1]).toEqual({
    message: "Câu hỏi thứ ba",
    history: [
      { role: "user", content: "Câu hỏi thứ hai" },
      { role: "assistant", content: "Câu trả lời đã hoàn tất." },
    ],
  });
});

test.each([undefined, "  ", { text: "Invalid response type" }])("treats an absent or invalid reply as an error and re-enables retry (%p)", async (reply) => {
  API.post.mockResolvedValueOnce({ data: { reply } }).mockResolvedValueOnce({ data: { reply: "Đã nhận phản hồi hợp lệ." } });
  const { container, input } = await openAI();
  submit(input, "Câu hỏi cần thử lại");
  await waitFor(() => expect(container.querySelector(".chat-message.ai.error")).not.toBeNull());
  expect(container.querySelector(".chat-message.ai.error").textContent).toContain("Trợ lý AI chưa trả về nội dung hợp lệ. Vui lòng thử lại.");
  expect(input.value).toBe("Câu hỏi cần thử lại");
  expect(screen.getByRole("button", { name: "Gửi", exact: true }).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Gửi", exact: true }));
  await waitFor(() => expect(lastReply(container).textContent).toBe("Đã nhận phản hồi hợp lệ."));
  expect(API.post).toHaveBeenCalledTimes(2);
});

test("blocks same-tick duplicate Enter submissions and preserves a new draft while waiting", async () => {
  const deferred = pendingReply();
  API.post.mockReturnValueOnce(deferred.promise);
  const { container, input } = await openAI();
  fireEvent.change(input, { target: { value: "Một câu hỏi duy nhất" } });
  act(() => {
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
  });
  expect(API.post).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Đang gửi...", exact: true }).disabled).toBe(true);
  fireEvent.change(input, { target: { value: "Bản nháp câu hỏi tiếp theo" } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
  expect(API.post).toHaveBeenCalledTimes(1);
  await act(async () => { deferred.resolve({ data: { reply: "Câu trả lời duy nhất." } }); });
  expect(lastReply(container).textContent).toBe("Câu trả lời duy nhất.");
  expect(input.value).toBe("Bản nháp câu hỏi tiếp theo");
  expect(screen.getByRole("button", { name: "Gửi", exact: true }).disabled).toBe(false);
});

test("timeout leaves an explicit error, retains a newer draft, and clears the busy lock", async () => {
  const deferred = pendingReply();
  API.post.mockReturnValueOnce(deferred.promise).mockResolvedValueOnce({ data: { reply: "Yêu cầu sau đã hoàn tất." } });
  const { container, input } = await openAI();
  submit(input, "Yêu cầu bị quá thời gian");
  fireEvent.change(input, { target: { value: "Bản nháp mới" } });
  await act(async () => { deferred.reject({ code: "ECONNABORTED" }); });
  expect(container.querySelector(".chat-message.ai.error").textContent).toContain("Trợ lý AI phản hồi quá lâu. Vui lòng thử lại.");
  expect(input.value).toBe("Bản nháp mới");
  expect(screen.getByRole("button", { name: "Gửi", exact: true }).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Gửi", exact: true }));
  await waitFor(() => expect(lastReply(container).textContent).toBe("Yêu cầu sau đã hoàn tất."));
  expect(API.post).toHaveBeenCalledTimes(2);
});

test("repeated failed retries remain visible without contaminating provider history", async () => {
  const failure = { response: { status: 502, data: { msg: "Lỗi dịch vụ kiểm thử." } } };
  API.post.mockRejectedValueOnce(failure).mockRejectedValueOnce(failure)
    .mockResolvedValueOnce({ data: { reply: "Phản hồi sau khi thử lại." } });
  const { container, input } = await openAI();
  const question = "Câu hỏi được thử lại hai lần";
  submit(input, question);
  await waitFor(() => expect(container.querySelectorAll(".chat-message.ai.error")).toHaveLength(1));
  fireEvent.click(screen.getByRole("button", { name: "Gửi", exact: true }));
  await waitFor(() => expect(container.querySelectorAll(".chat-message.ai.error")).toHaveLength(2));
  fireEvent.click(screen.getByRole("button", { name: "Gửi", exact: true }));
  await waitFor(() => expect(lastReply(container).textContent).toBe("Phản hồi sau khi thử lại."));
  expect(API.post).toHaveBeenCalledTimes(3);
  API.post.mock.calls.forEach(([path, payload]) => {
    expect(path).toBe("/ai/analyze");
    expect(payload).toEqual({ message: question, history: [] });
  });
  expect(container.querySelectorAll(".chat-message.user")).toHaveLength(3);
  expect(container.querySelectorAll(".chat-message.ai.error")).toHaveLength(2);
});

test("new conversation clears only AI context and preserves the current draft, session, and health form without an API call", async () => {
  window.localStorage.setItem("token", "test-only-session-token");
  const storedUser = window.localStorage.getItem("user");
  API.post.mockResolvedValueOnce({ data: { reply: "Câu trả lời thuộc hội thoại trước." } })
    .mockResolvedValueOnce({ data: { reply: "Câu trả lời thuộc hội thoại mới." } });
  const { container, input } = await openAI();
  submit(input, "Câu hỏi thuộc hội thoại trước");
  await waitFor(() => expect(lastReply(container).textContent).toBe("Câu trả lời thuộc hội thoại trước."));
  const nav = within(screen.getByRole("navigation", { name: "Điều hướng chính" }));
  fireEvent.click(nav.getByRole("button", { name: "Thông tin sức khỏe" }));
  fireEvent.change(screen.getByLabelText("Chiều cao (cm)"), { target: { value: "174" } });
  fireEvent.click(nav.getByRole("button", { name: "AI phân tích" }));
  const currentInput = screen.getByRole("textbox", { name: "Nhập câu hỏi về đái tháo đường type 2" });
  fireEvent.change(currentInput, { target: { value: "Bản nháp cần giữ nguyên" } });
  const readsBeforeReset = API.get.mock.calls.length;
  const postsBeforeReset = API.post.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Cuộc trò chuyện mới" }));
  expect(currentInput.value).toBe("Bản nháp cần giữ nguyên");
  expect(container.querySelectorAll(".chat-message.user")).toHaveLength(0);
  expect(container.querySelectorAll(".chat-message.ai")).toHaveLength(1);
  expect(lastReply(container).textContent).toContain("Chào bạn, mình là DOCTIS.");
  expect(API.post).toHaveBeenCalledTimes(postsBeforeReset);
  expect(API.get).toHaveBeenCalledTimes(readsBeforeReset);
  expect(window.localStorage.getItem("token")).toBe("test-only-session-token");
  expect(window.localStorage.getItem("user")).toBe(storedUser);
  fireEvent.click(nav.getByRole("button", { name: "Thông tin sức khỏe" }));
  expect(screen.getByLabelText("Chiều cao (cm)").value).toBe("174");
  fireEvent.click(nav.getByRole("button", { name: "AI phân tích" }));
  fireEvent.click(screen.getByRole("button", { name: "Gửi", exact: true }));
  await waitFor(() => expect(lastReply(container).textContent).toBe("Câu trả lời thuộc hội thoại mới."));
  expect(API.post.mock.calls[1][1]).toEqual({ message: "Bản nháp cần giữ nguyên", history: [] });
});

test("new conversation is disabled while an AI response is pending", async () => {
  const deferred = pendingReply();
  API.post.mockReturnValueOnce(deferred.promise);
  const { container, input } = await openAI();
  submit(input, "Câu hỏi đang chờ phản hồi");
  const reset = screen.getByRole("button", { name: "Cuộc trò chuyện mới" });
  expect(reset.disabled).toBe(true);
  fireEvent.click(reset);
  expect(container.querySelectorAll(".chat-message.user")).toHaveLength(1);
  expect(API.post).toHaveBeenCalledTimes(1);
  await act(async () => { deferred.resolve({ data: { reply: "Đã nhận phản hồi đang chờ." } }); });
  expect(lastReply(container).textContent).toBe("Đã nhận phản hồi đang chờ.");
  expect(reset.disabled).toBe(false);
});
