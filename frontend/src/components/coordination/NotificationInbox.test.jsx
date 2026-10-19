import { act, fireEvent, render, screen } from "@testing-library/react";
import API from "../../services/api";
import NotificationInbox from "./NotificationInbox";
jest.mock("../../services/api", () => ({ get: jest.fn(), patch: jest.fn() }));
const notification = { id: "notice-fixture", title: "Đăng ký mới kiểm thử", message: "Hồ sơ cần điều phối", entityType: "intake", entityId: "intake-fixture", createdAt: "2026-10-19T08:00:00Z", readAt: null };
let visibility, timeouts, clearTimeouts;
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  visibility = jest.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  timeouts = jest.spyOn(window, "setTimeout"); clearTimeouts = jest.spyOn(window, "clearTimeout");
  API.get.mockResolvedValue({ data: { notifications: [notification], unreadCount: 1 } });
  API.patch.mockResolvedValue({ data: { notification: { ...notification, readAt: "2026-10-19T09:00:00Z" } } });
});
afterEach(() => { visibility.mockRestore(); timeouts.mockRestore(); clearTimeouts.mockRestore(); jest.useRealTimers(); });
function scheduledPoll() { const index = timeouts.mock.calls.map(([, delay]) => delay).lastIndexOf(10000); return timeouts.mock.results[index]?.value; }
test("persistent inbox reads from the API and navigates with the actual notification target", async () => {
  const onOpen = jest.fn(); const { unmount } = render(<NotificationInbox onOpen={onOpen} />);
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "Thông báo, 1 chưa đọc" }));
  fireEvent.click(screen.getByRole("button", { name: /Đăng ký mới kiểm thử/ }));
  expect(onOpen).toHaveBeenCalledWith(notification);
  await act(async () => {});
  expect(API.patch).toHaveBeenCalledWith("/notifications/notice-fixture/read", {});
  expect(screen.getByRole("button", { name: "Thông báo" })).toBeTruthy();
  const timer = scheduledPoll(); expect(timer).toBeDefined(); unmount(); expect(clearTimeouts).toHaveBeenCalledWith(timer);
});
test("hidden pages do not poll and becoming visible refreshes without a page reload", async () => {
  visibility.mockReturnValue("hidden");
  const { unmount } = render(<NotificationInbox />); await act(async () => {});
  expect(API.get).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(API.get).not.toHaveBeenCalled();
  visibility.mockReturnValue("visible");
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(API.get).toHaveBeenCalledTimes(1);
  const timer = scheduledPoll(); expect(timer).toBeDefined(); unmount(); expect(clearTimeouts).toHaveBeenCalledWith(timer);
  await act(async () => { jest.advanceTimersByTime(120000); document.dispatchEvent(new Event("visibilitychange")); });
  expect(API.get).toHaveBeenCalledTimes(1);
});
test("errors back off polling and do not invent an unread count", async () => {
  API.get.mockRejectedValueOnce(new Error("network"));
  const { unmount } = render(<NotificationInbox />); await act(async () => {});
  expect(screen.getByRole("button", { name: "Thông báo" })).toBeTruthy();
  await act(async () => { jest.advanceTimersByTime(19000); }); expect(API.get).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(1000); }); expect(API.get).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("button", { name: "Thông báo, 1 chưa đọc" })).toBeTruthy(); unmount();
});
