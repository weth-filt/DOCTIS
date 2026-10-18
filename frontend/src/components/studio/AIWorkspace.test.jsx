import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AIWorkspace from "./AIWorkspace";
import API from "../../services/api";
import { prepareAIAttachment } from "./aiWorkspaceUtils";

jest.mock("../../services/api", () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() }));
jest.mock("../useLiveReducedMotion", () => () => true);
jest.mock("../ConversationMotion", () => ({ useConversationMotion: jest.fn() }));
jest.mock("./AIResponse", () => ({ message }) => <span>{message.text}</span>);
jest.mock("./aiWorkspaceUtils", () => ({ ...jest.requireActual("./aiWorkspaceUtils"), prepareAIAttachment: jest.fn() }));

const conversation = { id: "chat-1", title: "Cuộc trò chuyện cũ", updatedAt: "2026-10-19T08:00:00Z", createdAt: "2026-10-19T08:00:00Z" };
const userMessage = { id: "message-1", role: "user", content: "Câu hỏi mới", createdAt: "2026-10-19T08:00:00Z", attachments: [], status: "complete" };
const assistantMessage = { id: "message-2", role: "assistant", content: "Phản hồi thật của API kiểm tra", createdAt: "2026-10-19T08:00:01Z", attachments: [], status: "complete", provider: "gemini" };
const input = () => screen.getByRole("textbox", { name: "Nhập câu hỏi cho DOCTIS" });
const send = () => screen.getByRole("button", { name: "Gửi câu hỏi" });
const originalCreateURL = URL.createObjectURL;
const originalRevokeURL = URL.revokeObjectURL;

beforeEach(() => {
  jest.clearAllMocks();
  API.get.mockImplementation(url => Promise.resolve({ data: url === "/ai/conversations" ? { conversations: [conversation], hasMore: false } : { conversation, messages: [userMessage, assistantMessage], hasMore: false } }));
  API.post.mockImplementation(url => Promise.resolve({ data: url === "/ai/conversations" ? { conversation } : { conversation: { ...conversation, title: "Câu hỏi mới" }, userMessage, assistantMessage, reply: assistantMessage.content, provider: "gemini" } }));
  API.patch.mockResolvedValue({ data: { conversation: { ...conversation, title: "Tên mới" } } });
  API.delete.mockResolvedValue({ data: { success: true } });
  URL.createObjectURL = jest.fn().mockReturnValue("blob:authenticated-file");
  URL.revokeObjectURL = jest.fn();
  prepareAIAttachment.mockResolvedValue({ localId: "local-1", name: "test.pdf", mimeType: "application/pdf", size: 15, data: "JVBERg==", previewUrl: "" });
});
afterEach(() => { URL.createObjectURL = originalCreateURL; URL.revokeObjectURL = originalRevokeURL; });

test("loads server history but defaults to a fresh greeting without reopening an old chat", async () => {
  render(<AIWorkspace />);
  expect(screen.getByText("Chào bạn, mình là DOCTIS.")).toBeTruthy();
  await screen.findByRole("button", { name: /^Cuộc trò chuyện cũ/ });
  expect(API.get).toHaveBeenCalledTimes(1);
  expect(API.get).toHaveBeenCalledWith("/ai/conversations");
  expect(API.post).not.toHaveBeenCalled();
  expect(screen.getByText("Thông tin AI chỉ để tham khảo, không thay thế chẩn đoán hoặc hướng dẫn điều trị của bác sĩ.")).toBeTruthy();
});

test("opens a saved conversation and sends continued messages to its own ID", async () => {
  render(<AIWorkspace />);
  fireEvent.click(await screen.findByRole("button", { name: /^Cuộc trò chuyện cũ/ }));
  await screen.findByText(assistantMessage.content);
  expect(API.get).toHaveBeenCalledWith("/ai/conversations/chat-1");
  fireEvent.change(input(), { target: { value: "Câu hỏi tiếp theo" } });
  fireEvent.click(send());
  await waitFor(() => expect(API.post).toHaveBeenCalledWith("/ai/conversations/chat-1/messages", expect.objectContaining({ message: "Câu hỏi tiếp theo", requestId: expect.any(String) })));
  expect(API.post.mock.calls.some(([url]) => url === "/ai/conversations")).toBe(false);
});

test("a new conversation is created on first send and the response uses persisted messages", async () => {
  render(<AIWorkspace />);
  fireEvent.change(input(), { target: { value: "Câu hỏi mới" } });
  fireEvent.click(send());
  await screen.findByText(assistantMessage.content);
  expect(API.post).toHaveBeenNthCalledWith(1, "/ai/conversations", {});
  expect(API.post).toHaveBeenNthCalledWith(2, "/ai/conversations/chat-1/messages", expect.objectContaining({ message: "Câu hỏi mới", attachments: [] }));
  expect(input().value).toBe("");
  expect(screen.getAllByText("Câu hỏi mới").length).toBeGreaterThan(0);
});

test("drafts survive other dashboard menus when the component remains mounted", async () => {
  const { rerender } = render(<AIWorkspace active />);
  await screen.findByRole("button", { name: /^Cuộc trò chuyện cũ/ });
  fireEvent.change(input(), { target: { value: "Câu hỏi chưa gửi" } });
  rerender(<AIWorkspace active={false} />);
  expect(screen.queryByRole("textbox", { name: "Nhập câu hỏi cho DOCTIS" })).toBeNull();
  rerender(<AIWorkspace active />);
  expect(input().value).toBe("Câu hỏi chưa gửi");
  expect(API.get).toHaveBeenCalledTimes(1);
  expect(API.post).not.toHaveBeenCalled();
});

test("rename saves the title through PATCH and delete requires explicit confirmation", async () => {
  render(<AIWorkspace />);
  fireEvent.click(await screen.findByRole("button", { name: "Đổi tên Cuộc trò chuyện cũ" }));
  const rename = screen.getByRole("dialog", { name: "Đổi tên cuộc trò chuyện" });
  const field = within(rename).getByRole("textbox", { name: "Tên cuộc trò chuyện" });
  expect(document.activeElement).toBe(field);
  fireEvent.change(field, { target: { value: "Tên mới" } });
  fireEvent.click(within(rename).getByRole("button", { name: "Lưu tên" }));
  await waitFor(() => expect(API.patch).toHaveBeenCalledWith("/ai/conversations/chat-1", { title: "Tên mới" }));
  fireEvent.click(await screen.findByRole("button", { name: "Xóa Tên mới" }));
  expect(API.delete).not.toHaveBeenCalled();
  const deletion = screen.getByRole("dialog", { name: "Xóa cuộc trò chuyện?" });
  fireEvent.click(within(deletion).getByRole("button", { name: "Xóa cuộc trò chuyện" }));
  await waitFor(() => expect(API.delete).toHaveBeenCalledWith("/ai/conversations/chat-1"));
  await screen.findByText("Chưa có cuộc trò chuyện nào");
});

test("attachments can be previewed, removed and sent without any message text", async () => {
  render(<AIWorkspace />);
  const picker = screen.getByLabelText("Chọn ảnh hoặc tệp đính kèm");
  fireEvent.change(picker, { target: { files: [new File(["%PDF-fixture"], "test.pdf", { type: "application/pdf" })] } });
  await screen.findByRole("button", { name: "Bỏ tệp test.pdf" });
  fireEvent.click(screen.getByRole("button", { name: "Bỏ tệp test.pdf" }));
  expect(screen.queryByRole("button", { name: "Bỏ tệp test.pdf" })).toBeNull();
  fireEvent.change(picker, { target: { files: [new File(["%PDF-fixture"], "test.pdf", { type: "application/pdf" })] } });
  await screen.findByRole("button", { name: "Bỏ tệp test.pdf" });
  fireEvent.click(send());
  await waitFor(() => expect(API.post).toHaveBeenCalledWith("/ai/conversations/chat-1/messages", expect.objectContaining({ message: "", attachments: [{ name: "test.pdf", mimeType: "application/pdf", data: "JVBERg==" }] })));
});

test("historic files are fetched through the authenticated API and blob URLs are revoked on close", async () => {
  API.get.mockImplementation(url => {
    if (url === "/ai/conversations") return Promise.resolve({ data: { conversations: [conversation] } });
    if (url === "/ai/attachments/file-1/content") return Promise.resolve({ data: new Blob(["%PDF-fixture"], { type: "application/pdf" }) });
    return Promise.resolve({ data: { conversation, messages: [{ ...userMessage, attachments: [{ id: "file-1", name: "report.pdf", size: 15, mimeType: "application/pdf", contentUrl: "https://untrusted.example/file?token=do-not-use" }] }] } });
  });
  render(<AIWorkspace />);
  fireEvent.click(await screen.findByRole("button", { name: /^Cuộc trò chuyện cũ/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Xem tệp report.pdf" }));
  await screen.findByRole("link", { name: "Tải tệp về" });
  expect(API.get).toHaveBeenCalledWith("/ai/attachments/file-1/content", expect.objectContaining({ responseType: "blob" }));
  expect(API.get.mock.calls.some(([url]) => url.includes("untrusted.example") || url.includes("token="))).toBe(false);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Đóng hộp thoại" }));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:authenticated-file");
});

test("an ambiguous network retry retains draft and requestId instead of duplicating the model call", async () => {
  let attempts = 0;
  API.post.mockImplementation(url => {
    if (url === "/ai/conversations") return Promise.resolve({ data: { conversation } });
    attempts += 1;
    return attempts === 1 ? Promise.reject(new Error("Network error")) : Promise.resolve({ data: { conversation, userMessage, assistantMessage } });
  });
  render(<AIWorkspace />);
  fireEvent.change(input(), { target: { value: "Câu hỏi mới" } }); fireEvent.click(send());
  await screen.findByRole("alert");
  expect(input().value).toBe("Câu hỏi mới");
  fireEvent.click(send());
  await screen.findByText(assistantMessage.content);
  const payloads = API.post.mock.calls.filter(([url]) => url.endsWith("/messages")).map(([, body]) => body);
  expect(payloads).toHaveLength(2);
  expect(payloads[0].requestId).toBe(payloads[1].requestId);
});

test("older history pages merge without duplicate conversations", async () => {
  API.get.mockImplementation((url, config) => Promise.resolve({ data: config?.params?.before ? { conversations: [conversation, { ...conversation, id: "chat-2", title: "Cuộc cũ hơn" }], hasMore: false } : { conversations: [conversation], hasMore: true, nextCursor: "opaque-cursor" } }));
  render(<AIWorkspace />);
  fireEvent.click(await screen.findByRole("button", { name: "Tải thêm cuộc trò chuyện" }));
  await screen.findByRole("button", { name: /^Cuộc cũ hơn/ });
  expect(screen.getAllByRole("button", { name: /^Cuộc trò chuyện cũ/ })).toHaveLength(1);
  expect(API.get).toHaveBeenCalledWith("/ai/conversations", { params: { before: "opaque-cursor", limit: 30 } });
});

test("IME composition does not send prematurely, and Shift+Enter keeps a new line", async () => {
  render(<AIWorkspace />);
  fireEvent.change(input(), { target: { value: "Đang soạn" } });
  fireEvent.keyDown(input(), { key: "Enter", shiftKey: true });
  fireEvent.keyDown(input(), { key: "Enter", isComposing: true });
  expect(API.post).not.toHaveBeenCalled();
  await act(async () => {});
});

test("a failed saved user message is shown and a definitive retry uses a new request ID", async () => {
  let attempts = 0;
  API.post.mockImplementation(url => {
    if (url === "/ai/conversations") return Promise.resolve({ data: { conversation } });
    attempts += 1;
    return attempts === 1 ? Promise.reject({ response: { data: { code: "AI_RATE_LIMITED", msg: "Bạn thử lại sau nhé.", userMessage: { ...userMessage, status: "failed", errorMessage: "Chưa có phản hồi" } } } }) : Promise.resolve({ data: { conversation, userMessage, assistantMessage } });
  });
  render(<AIWorkspace />);
  fireEvent.change(input(), { target: { value: "Câu hỏi mới" } }); fireEvent.click(send());
  await screen.findByText("Chưa có phản hồi");
  expect(input().value).toBe("Câu hỏi mới");
  fireEvent.click(send());
  await screen.findByText(assistantMessage.content);
  const payloads = API.post.mock.calls.filter(([url]) => url.endsWith("/messages")).map(([, body]) => body);
  expect(payloads[0].requestId).not.toBe(payloads[1].requestId);
  expect(screen.queryByText("Chưa có phản hồi")).toBeNull();
});

test("old message pages can be opened without dropping the current conversation messages", async () => {
  API.get.mockImplementation((url, config) => {
    if (url === "/ai/conversations") return Promise.resolve({ data: { conversations: [conversation] } });
    if (config?.params?.before) return Promise.resolve({ data: { messages: [{ ...userMessage, id: "older-message", content: "Tin nhắn cũ hơn", createdAt: "2026-09-01T10:00:00Z" }], hasMore: false } });
    return Promise.resolve({ data: { conversation, messages: [assistantMessage], hasMore: true, nextCursor: "message-cursor" } });
  });
  render(<AIWorkspace />);
  fireEvent.click(await screen.findByRole("button", { name: /^Cuộc trò chuyện cũ/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Tải tin nhắn cũ hơn" }));
  await screen.findByText("Tin nhắn cũ hơn");
  expect(screen.getByText(assistantMessage.content)).toBeTruthy();
  expect(API.get).toHaveBeenCalledWith("/ai/conversations/chat-1/messages", { params: { before: "message-cursor", limit: 40 } });
});

test("deleting the open conversation returns to a fresh welcome", async () => {
  render(<AIWorkspace />);
  fireEvent.click(await screen.findByRole("button", { name: /^Cuộc trò chuyện cũ/ }));
  await screen.findByText(assistantMessage.content);
  fireEvent.click(screen.getByRole("button", { name: "Xóa Cuộc trò chuyện cũ" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xóa cuộc trò chuyện" }));
  await screen.findByText("Chào bạn, mình là DOCTIS.");
  expect(screen.queryByText(assistantMessage.content)).toBeNull();
  expect(input().value).toBe("");
});

test("an incomplete API success does not discard the draft or fabricate an assistant message", async () => {
  API.post.mockImplementation(url => Promise.resolve({ data: url === "/ai/conversations" ? { conversation } : { reply: "Unpersisted text" } }));
  render(<AIWorkspace />);
  fireEvent.change(input(), { target: { value: "Câu hỏi chưa xác nhận" } }); fireEvent.click(send());
  await screen.findByRole("alert");
  expect(input().value).toBe("Câu hỏi chưa xác nhận");
  expect(screen.queryByText("Unpersisted text")).toBeNull();
});

test("a local PDF preview uses memory only, without an authenticated content request before upload", async () => {
  render(<AIWorkspace />);
  fireEvent.change(screen.getByLabelText("Chọn ảnh hoặc tệp đính kèm"), { target: { files: [new File(["%PDF-fixture"], "test.pdf", { type: "application/pdf" })] } });
  fireEvent.click(await screen.findByRole("button", { name: "Xem tệp test.pdf" }));
  await screen.findByRole("link", { name: "Tải tệp về" });
  expect(API.get.mock.calls.some(([url]) => url.includes("/attachments/"))).toBe(false);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Đóng hộp thoại" }));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:authenticated-file");
});

test("mobile history opens as a dialog and Escape restores the trigger focus", async () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  try {
    render(<AIWorkspace />);
    await waitFor(() => expect(API.get).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: "Lịch sử trò chuyện" })).toBeNull();
    const trigger = screen.getByRole("button", { name: "Mở lịch sử trò chuyện" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Lịch sử trò chuyện" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Lịch sử trò chuyện" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  } finally { window.matchMedia = originalMatchMedia; }
});
