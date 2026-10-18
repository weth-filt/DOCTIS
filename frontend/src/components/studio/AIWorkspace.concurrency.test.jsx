import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AIWorkspace from "./AIWorkspace";
import API from "../../services/api";
import { prepareAIAttachment, validateAIRequest } from "./aiWorkspaceUtils";

jest.mock("../../services/api", () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() }));
jest.mock("../useLiveReducedMotion", () => () => true);
jest.mock("../ConversationMotion", () => ({ useConversationMotion: jest.fn() }));
jest.mock("./AIResponse", () => ({ message }) => <span>{message.text}</span>);
jest.mock("./aiWorkspaceUtils", () => ({
  ...jest.requireActual("./aiWorkspaceUtils"),
  prepareAIAttachment: jest.fn(),
  validateAIRequest: jest.fn()
}));

const first = { id: "chat-1", title: "Hội thoại thứ nhất", updatedAt: "2026-10-19T08:00:00Z" };
const second = { id: "chat-2", title: "Hội thoại thứ hai", updatedAt: "2026-10-19T07:00:00Z" };
const userMessage = { id: "user-1", role: "user", content: "Câu hỏi đang thử", createdAt: "2026-10-19T08:00:00Z", attachments: [], status: "complete" };
const assistantMessage = { id: "assistant-1", role: "assistant", content: "Phản hồi đã được lưu", createdAt: "2026-10-19T08:00:01Z", attachments: [], status: "complete" };
const input = () => screen.getByRole("textbox", { name: "Nhập câu hỏi cho DOCTIS" });
const send = () => screen.getByRole("button", { name: "Gửi câu hỏi" });
const messageCalls = () => API.post.mock.calls.filter(([url]) => url.endsWith("/messages"));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

beforeEach(() => {
  jest.clearAllMocks();
  validateAIRequest.mockImplementation(jest.requireActual("./aiWorkspaceUtils").validateAIRequest);
  API.get.mockImplementation(url => Promise.resolve({ data: url === "/ai/conversations"
    ? { conversations: [first, second], hasMore: false }
    : { conversation: url.endsWith("chat-2") ? second : first, messages: [], hasMore: false } }));
  API.post.mockImplementation(url => Promise.resolve({ data: url === "/ai/conversations"
    ? { conversation: first }
    : { conversation: first, userMessage, assistantMessage } }));
});

test("same-batch Enter and submit create only one conversation and one message request", async () => {
  const creation = deferred();
  API.post.mockImplementation(url => url === "/ai/conversations" ? creation.promise : Promise.resolve({ data: { conversation: first, userMessage, assistantMessage } }));
  const { container } = render(<AIWorkspace />);
  await screen.findByRole("button", { name: /^Hội thoại thứ nhất/ });
  fireEvent.change(input(), { target: { value: userMessage.content } });
  act(() => {
    fireEvent.keyDown(input(), { key: "Enter" });
    fireEvent.submit(container.querySelector("form.aiw-composer"));
    fireEvent.keyDown(input(), { key: "Enter" });
  });
  expect(API.post).toHaveBeenCalledTimes(1);
  expect(API.post).toHaveBeenCalledWith("/ai/conversations", {});
  await act(async () => { creation.resolve({ data: { conversation: first } }); });
  await screen.findByText(assistantMessage.content);
  expect(messageCalls()).toHaveLength(1);
  expect(API.post).toHaveBeenCalledTimes(2);
  expect(input().disabled).toBe(false);
});

test("ambiguous request IDs and drafts survive switching conversations and starting a new one", async () => {
  let count = 0;
  API.post.mockImplementation(url => {
    if (url === "/ai/conversations") throw new Error("An existing chat must not be recreated");
    count += 1;
    return count === 1 ? Promise.reject(new Error("Network response lost")) : Promise.resolve({ data: { conversation: first, userMessage, assistantMessage } });
  });
  render(<AIWorkspace />);
  fireEvent.click(await screen.findByRole("button", { name: /^Hội thoại thứ nhất/ }));
  await waitFor(() => expect(input().disabled).toBe(false));
  fireEvent.change(input(), { target: { value: userMessage.content } });
  fireEvent.click(send());
  await screen.findByRole("alert");
  const originalId = messageCalls()[0][1].requestId;
  fireEvent.click(screen.getByRole("button", { name: /^Hội thoại thứ hai/ }));
  await waitFor(() => expect(input().disabled).toBe(false));
  fireEvent.change(input(), { target: { value: "Bản nháp ở hội thoại thứ hai" } });
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu cuộc trò chuyện mới" }));
  expect(input().value).toBe("");
  fireEvent.click(screen.getByRole("button", { name: /^Hội thoại thứ nhất/ }));
  await waitFor(() => expect(input().disabled).toBe(false));
  expect(input().value).toBe(userMessage.content);
  fireEvent.click(send());
  await screen.findByText(assistantMessage.content);
  expect(messageCalls()).toHaveLength(2);
  expect(messageCalls()[1][1].requestId).toBe(originalId);
  expect(API.post.mock.calls.some(([url]) => url === "/ai/conversations")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: /^Hội thoại thứ hai/ }));
  await waitFor(() => expect(input().disabled).toBe(false));
  expect(input().value).toBe("Bản nháp ở hội thoại thứ hai");
});

test("older-message loading belongs to its view and stale completion cannot unlock another request", async () => {
  const olderFirst = deferred();
  const olderSecond = deferred();
  API.get.mockImplementation(url => {
    if (url === "/ai/conversations") return Promise.resolve({ data: { conversations: [first, second] } });
    if (url === "/ai/conversations/chat-1/messages") return olderFirst.promise;
    if (url === "/ai/conversations/chat-2/messages") return olderSecond.promise;
    const conversation = url.endsWith("chat-2") ? second : first;
    return Promise.resolve({ data: { conversation, messages: [{ ...assistantMessage, id: `${conversation.id}-recent`, content: `Tin mới ${conversation.id}` }], hasMore: true, nextCursor: `${conversation.id}-cursor` } });
  });
  render(<AIWorkspace />);
  fireEvent.click(await screen.findByRole("button", { name: /^Hội thoại thứ nhất/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Tải tin nhắn cũ hơn" }));
  expect(screen.getByRole("button", { name: "Đang tải…" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /^Hội thoại thứ hai/ }));
  const olderButton = await screen.findByRole("button", { name: "Tải tin nhắn cũ hơn" });
  expect(olderButton.disabled).toBe(false);
  fireEvent.click(olderButton);
  await act(async () => { olderFirst.resolve({ data: { messages: [{ ...userMessage, id: "old-first", content: "Tin cũ không được lọt sang" }], hasMore: false } }); });
  expect(screen.queryByText("Tin cũ không được lọt sang")).toBeNull();
  expect(screen.getByRole("button", { name: "Đang tải…" }).disabled).toBe(true);
  await act(async () => { olderSecond.resolve({ data: { messages: [{ ...userMessage, id: "old-second", content: "Tin cũ hội thoại hai" }], hasMore: false } }); });
  await screen.findByText("Tin cũ hội thoại hai");
  expect(screen.getByText("Tin mới chat-2")).toBeTruthy();
  expect(API.get).toHaveBeenCalledWith("/ai/conversations/chat-1/messages", { params: { before: "chat-1-cursor", limit: 40 } });
  expect(API.get).toHaveBeenCalledWith("/ai/conversations/chat-2/messages", { params: { before: "chat-2-cursor", limit: 40 } });
});

test("validation errors release the immediate send lock for a corrected draft", async () => {
  validateAIRequest.mockImplementationOnce(() => { throw new Error("Bản nháp chưa hợp lệ"); });
  render(<AIWorkspace />);
  await screen.findByRole("button", { name: /^Hội thoại thứ nhất/ });
  fireEvent.change(input(), { target: { value: "Bản nháp đầu" } });
  fireEvent.click(send());
  expect((await screen.findByRole("alert")).textContent).toContain("Bản nháp chưa hợp lệ");
  expect(API.post).not.toHaveBeenCalled();
  fireEvent.change(input(), { target: { value: userMessage.content } });
  fireEvent.click(send());
  await screen.findByText(assistantMessage.content);
  expect(messageCalls()).toHaveLength(1);
  expect(input().disabled).toBe(false);
});

test("a pending attachment preparation still blocks sending and conversation navigation", async () => {
  const preparation = deferred();
  prepareAIAttachment.mockReturnValueOnce(preparation.promise);
  render(<AIWorkspace />);
  await screen.findByRole("button", { name: /^Hội thoại thứ nhất/ });
  fireEvent.change(input(), { target: { value: userMessage.content } });
  fireEvent.change(screen.getByLabelText("Chọn ảnh hoặc tệp đính kèm"), { target: { files: [new File(["%PDF-fixture"], "test.pdf", { type: "application/pdf" })] } });
  fireEvent.keyDown(input(), { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: /^Hội thoại thứ nhất/ }));
  expect(API.post).not.toHaveBeenCalled();
  expect(API.get).toHaveBeenCalledTimes(1);
  await act(async () => { preparation.resolve({ localId: "local-1", name: "test.pdf", mimeType: "application/pdf", size: 15, data: "JVBERg==", previewUrl: "" }); });
  await screen.findByRole("button", { name: "Bỏ tệp test.pdf" });
  fireEvent.click(send());
  await screen.findByText(assistantMessage.content);
  expect(messageCalls()).toHaveLength(1);
});
