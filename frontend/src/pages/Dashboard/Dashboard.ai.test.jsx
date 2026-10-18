import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Dashboard from "./Dashboard";
import API from "../../services/api";
import { StudioPreferencesProvider } from "../../components/studio/StudioPreferences";

// Synthetic test fixtures only. Every HTTP method and native fetch is mocked;
// this suite cannot contact a database or an AI provider.
jest.mock("../../services/api", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));
jest.mock("../../components/studio/StudioExperience", () => () => null);
jest.mock("../../components/3d/HeartScene", () => ({ __esModule: true, default: () => <div aria-hidden="true" />, HeartSceneProvider: ({ children }) => children, SceneBoundary: ({ children }) => children }));
jest.mock("../../components/3d/ChartDepth", () => ({ __esModule: true, default: ({ data }) => <div>{data.length} records</div> }));
jest.mock("../../components/DashboardChart", () => ({
  HEALTH_METRICS: [
    { key: "glucose", label: "Đường huyết", unit: "mg/dL", lines: [{ key: "glucose" }] },
    { key: "pressure", label: "Huyết áp", unit: "mmHg", lines: [{ key: "systolic" }, { key: "diastolic" }] },
    { key: "bmi", label: "BMI", unit: "kg/m²", lines: [{ key: "bmi" }] },
    { key: "heartRate", label: "Nhịp tim", unit: "bpm", lines: [{ key: "heartRate" }] },
  ],
  MeasurementPlot: ({ data, metric, mode }) => <div>{metric.key}:{mode}:{data.length}</div>,
}));
jest.mock("framer-motion", () => {
  const React = require("react");
  const components = {};
  return { MotionConfig: ({ children }) => children, AnimatePresence: ({ children }) => children,
    motion: new Proxy({}, { get: (_target, tag) => {
      if (!components[tag]) components[tag] = React.forwardRef(({ children, initial, animate, exit, transition, layout, layoutId, whileInView, viewport, whileHover, whileTap, ...props }, ref) => React.createElement(tag, { ...props, ref }, children));
      return components[tag];
    } }),
  };
});

const originalFetch = global.fetch;
const originalScrollTo = window.scrollTo;
const originalElementScrollTo = HTMLElement.prototype.scrollTo;
const originalMatchMedia = window.matchMedia;
const OLD_CONVERSATION = { id: "saved-chat", title: "Cuộc trò chuyện đã lưu", createdAt: "2026-10-18T08:00:00Z", updatedAt: "2026-10-18T08:00:01Z" };
const OLD_MESSAGES = [
  { id: "saved-user", role: "user", content: "Câu hỏi cũ từ máy chủ", createdAt: "2026-10-18T08:00:00Z", status: "complete", attachments: [] },
  { id: "saved-assistant", role: "assistant", content: "Phản hồi cũ từ máy chủ", createdAt: "2026-10-18T08:00:01Z", status: "complete", attachments: [], provider: "gemini" },
];
const READ_FIXTURES = {
  "/care-plans/my": null, "/care-plans/current": null,
  "/health/history": [{ _id: "test-reading", createdAt: "2026-10-16T08:00:00Z", height: 170, weight: 65, bmi: 22.49, glucose: 100, systolic: 120, diastolic: 80, heartRate: 75 }],
  "/health/advices": [], "/appointments/patient": [],
  "/profile": { _id: "test-patient", fullName: "Bệnh nhân kiểm thử", email: "patient@example.test", allergies: "Thông tin riêng kiểm thử", chronicDiseases: "Thông tin bệnh nền kiểm thử" },
  "/messages/doctors": [], "/prescriptions/my": [],
};
let consoleError, saved, turn, created;

beforeAll(() => {
  window.scrollTo = jest.fn(); HTMLElement.prototype.scrollTo = jest.fn();
  // The complete API reply renders immediately. Animation is tested separately.
  window.matchMedia = query => ({ matches: query.includes("prefers-reduced-motion"), addEventListener: jest.fn(), removeEventListener: jest.fn(), addListener: jest.fn(), removeListener: jest.fn() });
});
beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("user", JSON.stringify({ _id: "test-patient", fullName: "Bệnh nhân kiểm thử", role: "patient" }));
  jest.clearAllMocks(); turn = 0; created = 0;
  saved = new Map([[OLD_CONVERSATION.id, { conversation: OLD_CONVERSATION, messages: OLD_MESSAGES }]]);
  API.get.mockImplementation(path => {
    if (Object.prototype.hasOwnProperty.call(READ_FIXTURES, path)) return Promise.resolve({ data: JSON.parse(JSON.stringify(READ_FIXTURES[path])) });
    if (path === "/ai/conversations") return Promise.resolve({ data: { conversations: [...saved.values()].map(value => value.conversation), hasMore: false } });
    const match = path.match(/^\/ai\/conversations\/([^/]+)$/);
    if (match && saved.has(match[1])) return Promise.resolve({ data: { ...saved.get(match[1]), hasMore: false } });
    return Promise.reject(new Error(`Unexpected test-only read: ${path}`));
  });
  API.post.mockImplementation((path, payload) => {
    if (path === "/ai/conversations") {
      const conversation = { id: `new-chat-${++created}`, title: "Cuộc trò chuyện mới", createdAt: "2026-10-19T08:00:00Z", updatedAt: "2026-10-19T08:00:00Z" };
      saved.set(conversation.id, { conversation, messages: [] });
      return Promise.resolve({ data: { conversation } });
    }
    const match = path.match(/^\/ai\/conversations\/([^/]+)\/messages$/);
    return match ? Promise.resolve({ data: persistedResponse(match[1], payload.message, `Phản hồi kiểm thử ${turn + 1}.`) }) : Promise.reject(new Error("Unexpected test-only request"));
  });
  API.put.mockRejectedValue(new Error("Profile writes are disabled."));
  API.patch.mockRejectedValue(new Error("Rename is covered in the isolated workspace suite."));
  API.delete.mockRejectedValue(new Error("Deletion is covered in the isolated workspace suite."));
  global.fetch = jest.fn(() => Promise.reject(new Error("Remote fetch is disabled.")));
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  expect(API.put).not.toHaveBeenCalled(); expect(API.patch).not.toHaveBeenCalled(); expect(API.delete).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(API.post.mock.calls.every(([path]) => /^\/ai\/conversations(?:\/[^/]+\/messages)?$/.test(path))).toBe(true);
  consoleError.mockRestore();
});
afterAll(() => {
  global.fetch = originalFetch; window.scrollTo = originalScrollTo; HTMLElement.prototype.scrollTo = originalElementScrollTo;
  window.matchMedia = originalMatchMedia; window.localStorage.clear();
});

function persistedResponse(id, question, response) {
  turn += 1;
  const previous = saved.get(id) || { conversation: { id, createdAt: "2026-10-19T08:00:00Z" }, messages: [] };
  const conversation = { ...previous.conversation, title: previous.messages.length ? previous.conversation.title : question.slice(0, 50), updatedAt: `2026-10-19T08:00:${String(turn + 1).padStart(2, "0")}Z` };
  const userMessage = { id: `user-${turn}`, role: "user", content: question, createdAt: `2026-10-19T08:00:${String(turn).padStart(2, "0")}Z`, status: "complete", attachments: [] };
  const assistantMessage = { id: `assistant-${turn}`, role: "assistant", content: response, createdAt: conversation.updatedAt, status: "complete", attachments: [], provider: "gemini" };
  saved.set(id, { conversation, messages: [...previous.messages, userMessage, assistantMessage] });
  return { conversation, userMessage, assistantMessage, reply: response, provider: "gemini" };
}
async function openDashboard() {
  const result = render(<StudioPreferencesProvider><Dashboard /></StudioPreferencesProvider>);
  await screen.findByRole("heading", { name: /Bệnh nhân kiểm thử/ });
  await waitFor(() => expect(API.get).toHaveBeenCalledWith("/profile"));
  return result;
}
const nav = () => within(screen.getByRole("navigation", { name: "Điều hướng chính" }));
const aiInput = () => screen.getByRole("textbox", { name: "Nhập câu hỏi cho DOCTIS" });
const sendButton = () => screen.getByRole("button", { name: "Gửi câu hỏi" });
async function openAI() {
  const result = await openDashboard();
  fireEvent.click(nav().getByRole("button", { name: "AI phân tích" }));
  await waitFor(() => expect(API.get).toHaveBeenCalledWith("/ai/conversations"));
  return { ...result, input: aiInput() };
}
function submit(input, message) { fireEvent.change(input, { target: { value: message } }); fireEvent.click(sendButton()); }
function lastReply(container) {
  const replies = container.querySelectorAll(".aiw-message.is-assistant .assistant-response > span[aria-hidden='true'], .aiw-message.is-assistant .aiw-message-text");
  return replies[replies.length - 1];
}
const messagePosts = () => API.post.mock.calls.filter(([path]) => path.endsWith("/messages"));
function deferredReply() {
  let resolve, reject;
  const promise = new Promise((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}

test("history is read only on first AI entry, which opens a new greeting rather than an old chat", async () => {
  await openDashboard();
  expect(API.get.mock.calls.some(([path]) => path.startsWith("/ai/"))).toBe(false);
  fireEvent.click(nav().getByRole("button", { name: "AI phân tích" }));
  await screen.findByRole("button", { name: /^Cuộc trò chuyện đã lưu/ });
  expect(screen.getByText("Chào bạn, mình là DOCTIS.")).toBeTruthy();
  expect(screen.queryByText("Phản hồi cũ từ máy chủ")).toBeNull();
  fireEvent.click(nav().getByRole("button", { name: "Bảng điều khiển" }));
  fireEvent.click(nav().getByRole("button", { name: "AI phân tích" }));
  expect(API.get.mock.calls.filter(([path]) => path === "/ai/conversations")).toHaveLength(1);
  expect(API.post).not.toHaveBeenCalled();
});

test("creates then sends one current question without client PII, health data or history", async () => {
  const response = "Nội dung phản hồi kiểm thử từ dịch vụ.\n• Ý thứ hai giữ nguyên.";
  const originalPost = API.post.getMockImplementation();
  API.post.mockImplementation((path, payload) => path === "/ai/conversations" ? originalPost(path, payload) : Promise.resolve({ data: persistedResponse("new-chat-1", payload.message, response) }));
  const { container, input } = await openAI();
  submit(input, "  Một câu hỏi hiện tại.  ");
  await waitFor(() => expect(lastReply(container)?.textContent).toBe(response));
  expect(API.post).toHaveBeenCalledTimes(2);
  expect(API.post).toHaveBeenNthCalledWith(1, "/ai/conversations", {});
  expect(messagePosts()[0][0]).toBe("/ai/conversations/new-chat-1/messages");
  const payload = messagePosts()[0][1];
  expect(Object.keys(payload).sort()).toEqual(["attachments", "message", "requestId"]);
  expect(payload).toEqual({ message: "Một câu hỏi hiện tại.", attachments: [], requestId: expect.any(String) });
  expect(JSON.stringify(payload)).not.toMatch(/patient@example|Bệnh nhân kiểm thử|test-patient|chronicDiseases|Thông tin riêng|height|glucose|history/);
  expect(input.value).toBe(""); expect(sendButton().disabled).toBe(true);
});

test("a saved chat continues on its server ID without resubmitting history from the client", async () => {
  const { container, input } = await openAI();
  fireEvent.click(await screen.findByRole("button", { name: /^Cuộc trò chuyện đã lưu/ }));
  await screen.findByText("Phản hồi cũ từ máy chủ");
  submit(input, "Câu hỏi tiếp nối");
  await waitFor(() => expect(lastReply(container)?.textContent).toBe("Phản hồi kiểm thử 1."));
  expect(API.post).toHaveBeenCalledTimes(1);
  expect(messagePosts()[0][0]).toBe("/ai/conversations/saved-chat/messages");
  expect(messagePosts()[0][1]).not.toHaveProperty("history");
});

test("menu navigation preserves draft, health form and session without sending a question", async () => {
  window.localStorage.setItem("token", "synthetic-session-token");
  const { input } = await openAI();
  const storedUser = window.localStorage.getItem("user");
  fireEvent.change(input, { target: { value: "Bản nháp chưa gửi" } });
  fireEvent.click(nav().getByRole("button", { name: "Thông tin sức khỏe" }));
  fireEvent.change(screen.getByLabelText("Chiều cao (cm)"), { target: { value: "174" } });
  expect(screen.queryByRole("textbox", { name: "Nhập câu hỏi cho DOCTIS" })).toBeNull();
  fireEvent.click(nav().getByRole("button", { name: "AI phân tích" }));
  expect(aiInput().value).toBe("Bản nháp chưa gửi");
  fireEvent.click(nav().getByRole("button", { name: "Thông tin sức khỏe" }));
  expect(screen.getByLabelText("Chiều cao (cm)").value).toBe("174");
  expect(window.localStorage.getItem("token")).toBe("synthetic-session-token");
  expect(window.localStorage.getItem("user")).toBe(storedUser); expect(API.post).not.toHaveBeenCalled();
});

test("server failure retains draft and saved failed turn without fabricating an assistant reply", async () => {
  const originalPost = API.post.getMockImplementation();
  let attempts = 0;
  API.post.mockImplementation((path, payload) => {
    if (path === "/ai/conversations") return originalPost(path, payload);
    if (++attempts === 1) return Promise.reject({ response: { status: 502, data: { code: "AI_PROVIDER_ERROR", msg: "Dịch vụ AI tạm thời không khả dụng.", userMessage: { id: "failed-user", role: "user", content: payload.message, createdAt: "2026-10-19T08:00:00Z", status: "failed", attachments: [], errorMessage: "Chưa nhận được phản hồi AI." } } } });
    return originalPost(path, payload);
  });
  const { container, input } = await openAI();
  submit(input, "Câu hỏi cần thử lại");
  await screen.findByText("Dịch vụ AI tạm thời không khả dụng.");
  expect(screen.getByText("Chưa nhận được phản hồi AI.")).toBeTruthy(); expect(lastReply(container)).toBeUndefined();
  expect(input.value).toBe("Câu hỏi cần thử lại");
  const firstId = messagePosts()[0][1].requestId;
  fireEvent.click(sendButton());
  await waitFor(() => expect(lastReply(container)?.textContent).toBe("Phản hồi kiểm thử 1."));
  expect(messagePosts()[1][1].requestId).not.toBe(firstId);
  expect(messagePosts()[1][1]).not.toHaveProperty("history");
});

test.each([undefined, "  ", { text: "Invalid response type" }])("an unpersisted reply does not count as a completed message (%p)", async reply => {
  const originalPost = API.post.getMockImplementation();
  let attempts = 0;
  API.post.mockImplementation((path, payload) => {
    if (path === "/ai/conversations") return originalPost(path, payload);
    return ++attempts === 1 ? Promise.resolve({ data: { reply } }) : originalPost(path, payload);
  });
  const { container, input } = await openAI();
  submit(input, "Câu hỏi cần xác nhận");
  await screen.findByRole("alert"); expect(lastReply(container)).toBeUndefined();
  expect(input.value).toBe("Câu hỏi cần xác nhận"); expect(sendButton().disabled).toBe(false);
  fireEvent.click(sendButton());
  await waitFor(() => expect(lastReply(container)?.textContent).toBe("Phản hồi kiểm thử 1."));
  expect(messagePosts()).toHaveLength(2);
});

test("same-tick Enter cannot duplicate conversations or message requests", async () => {
  const originalPost = API.post.getMockImplementation();
  const deferred = deferredReply();
  API.post.mockImplementation((path, payload) => path === "/ai/conversations" ? originalPost(path, payload) : deferred.promise);
  const { container, input } = await openAI();
  fireEvent.change(input, { target: { value: "Một câu hỏi duy nhất" } });
  act(() => { fireEvent.keyDown(input, { key: "Enter", code: "Enter" }); fireEvent.keyDown(input, { key: "Enter", code: "Enter" }); });
  await waitFor(() => expect(messagePosts()).toHaveLength(1));
  expect(API.post.mock.calls.filter(([path]) => path === "/ai/conversations")).toHaveLength(1);
  const reset = screen.getByRole("button", { name: "Cuộc trò chuyện mới", exact: true });
  expect(reset.disabled).toBe(true); expect(input.disabled).toBe(true);
  fireEvent.click(reset); fireEvent.keyDown(input, { key: "Enter", code: "Enter" }); expect(messagePosts()).toHaveLength(1);
  await act(async () => { deferred.resolve({ data: persistedResponse("new-chat-1", "Một câu hỏi duy nhất", "Câu trả lời duy nhất.") }); });
  expect(lastReply(container)?.textContent).toBe("Câu trả lời duy nhất."); expect(reset.disabled).toBe(false);
});

test("an ambiguous timeout retains the same request ID for an idempotent retry", async () => {
  const originalPost = API.post.getMockImplementation();
  const deferred = deferredReply();
  let attempts = 0;
  API.post.mockImplementation((path, payload) => {
    if (path === "/ai/conversations") return originalPost(path, payload);
    return ++attempts === 1 ? deferred.promise : originalPost(path, payload);
  });
  const { container, input } = await openAI();
  submit(input, "Yêu cầu bị quá thời gian"); await waitFor(() => expect(messagePosts()).toHaveLength(1));
  await act(async () => { deferred.reject({ code: "ECONNABORTED" }); });
  expect(screen.getByRole("alert").textContent).toContain("Câu hỏi và tệp vẫn được giữ");
  expect(input.value).toBe("Yêu cầu bị quá thời gian"); fireEvent.click(sendButton());
  await waitFor(() => expect(lastReply(container)?.textContent).toBe("Phản hồi kiểm thử 1."));
  expect(messagePosts()[1][1].requestId).toBe(messagePosts()[0][1].requestId);
});

test("new chat has a blank draft while the previous conversation draft can be recovered", async () => {
  const { container, input } = await openAI();
  submit(input, "Câu hỏi thuộc cuộc trước");
  await waitFor(() => expect(lastReply(container)?.textContent).toBe("Phản hồi kiểm thử 1."));
  fireEvent.change(input, { target: { value: "Bản nháp thuộc cuộc trước" } });
  const reads = API.get.mock.calls.length, writes = API.post.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Cuộc trò chuyện mới", exact: true }));
  expect(aiInput().value).toBe(""); expect(screen.getByText("Chào bạn, mình là DOCTIS.")).toBeTruthy();
  expect(container.querySelectorAll(".aiw-message")).toHaveLength(0);
  expect(API.post).toHaveBeenCalledTimes(writes); expect(API.get).toHaveBeenCalledTimes(reads);
  fireEvent.click(screen.getByRole("button", { name: /^Câu hỏi thuộc cuộc trước/ }));
  await waitFor(() => expect(aiInput().value).toBe("Bản nháp thuộc cuộc trước"));
  await waitFor(() => expect(lastReply(container)?.textContent).toBe("Phản hồi kiểm thử 1."));
});
