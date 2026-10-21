import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import useChatMessages from "./useChatMessages";
import { confirmChatMessage, mergeChatMessages, temporaryChatId } from "../utils/chatMessages";

// Only synthetic messages and controlled response ordering; no network, account,
// medical record or real patient/doctor message is sent by these regressions.
const first = { _id: "saved-first", content: "Tin cũ", createdAt: "2026-10-21T01:00:00Z", read: false };
const pending = { _id: "temp-fixture", content: "Tin vừa gửi", createdAt: "2026-10-21T01:01:00Z", read: false };
const saved = { ...pending, _id: "saved-new" };

function setup() {
  const ref = { current: null };
  function Harness() {
    ref.current = useChatMessages();
    return <div>{ref.current.messages.map(message => <p key={message._clientKey || message._id} data-testid="message" data-id={message._id}>{message.content}</p>)}</div>;
  }
  render(<Harness />);
  act(() => { ref.current.selectConversation("doctor-a"); ref.current.receiveMessages("doctor-a", [first]); });
  return ref;
}

test("a poll started before sending cannot remove the visible pending message", () => {
  const ref = setup();
  act(() => ref.current.addPending("doctor-a", pending));
  const node = screen.getByText(pending.content);
  act(() => ref.current.receiveMessages("doctor-a", [first]));
  expect(screen.getByText(pending.content)).toBe(node);
  expect(screen.getAllByTestId("message")).toHaveLength(2);
  expect(ref.current.hasPending("doctor-a")).toBe(true);
});

test("POST acknowledgement and older GET responses keep the same bubble DOM node", () => {
  const ref = setup();
  act(() => ref.current.addPending("doctor-a", pending));
  const node = screen.getByText(pending.content);
  act(() => ref.current.confirmPending("doctor-a", pending._id, saved));
  expect(screen.getByText(pending.content)).toBe(node);
  expect(node.getAttribute("data-id")).toBe(saved._id);
  act(() => { ref.current.receiveMessages("doctor-a", [first]); ref.current.receiveMessages("doctor-a", []); });
  expect(screen.getByText(pending.content)).toBe(node);
  act(() => ref.current.receiveMessages("doctor-a", [first, saved]));
  expect(screen.getByText(pending.content)).toBe(node);
  expect(screen.getAllByTestId("message")).toHaveLength(2);
});

test("a poll seeing the saved row before POST returns does not duplicate its temp row", () => {
  const ref = setup();
  act(() => ref.current.addPending("doctor-a", pending));
  act(() => ref.current.receiveMessages("doctor-a", [first, saved]));
  expect(screen.getAllByText(pending.content)).toHaveLength(1);
  act(() => ref.current.confirmPending("doctor-a", pending._id, saved));
  act(() => ref.current.receiveMessages("doctor-a", [first, saved]));
  expect(screen.getAllByText(pending.content)).toHaveLength(1);
  expect(ref.current.hasPending("doctor-a")).toBe(false);
});

test("late reads and acknowledgements belong to their original conversation", () => {
  const ref = setup();
  act(() => ref.current.addPending("doctor-a", pending));
  act(() => { ref.current.selectConversation("doctor-b"); ref.current.receiveMessages("doctor-b", [{ ...first, content: "Hội thoại B" }]); });
  act(() => { ref.current.confirmPending("doctor-a", pending._id, saved); ref.current.receiveMessages("doctor-a", [first]); });
  expect(screen.queryByText(pending.content)).toBeNull();
  expect(screen.getByText("Hội thoại B")).toBeInTheDocument();
  act(() => ref.current.selectConversation("doctor-a"));
  expect(screen.getByText(pending.content)).toBeInTheDocument();
  expect(screen.queryByText("Hội thoại B")).toBeNull();
});

test("multiple pending sends can be acknowledged out of order without losing a row", () => {
  const ref = setup();
  const second = { ...pending, _id: "temp-second", content: "Tin thứ hai" };
  act(() => { ref.current.addPending("doctor-a", pending); ref.current.addPending("doctor-a", second); });
  act(() => ref.current.confirmPending("doctor-a", second._id, { ...second, _id: "saved-second" }));
  act(() => ref.current.receiveMessages("doctor-a", [first]));
  expect(screen.getAllByTestId("message")).toHaveLength(3);
  act(() => ref.current.confirmPending("doctor-a", pending._id, saved));
  act(() => ref.current.receiveMessages("doctor-a", [first]));
  expect(screen.getAllByTestId("message")).toHaveLength(3);
  expect(ref.current.hasPending("doctor-a")).toBe(false);
});

test("failed send cleanup removes only that pending row", () => {
  const ref = setup();
  act(() => { ref.current.addPending("doctor-a", pending); ref.current.addPending("doctor-a", { ...pending, _id: "temp-other", content: "Tin khác" }); });
  act(() => ref.current.rejectPending("doctor-a", pending._id));
  expect(screen.queryByText(pending.content)).toBeNull();
  expect(screen.getByText(first.content)).toBeInTheDocument();
  expect(screen.getByText("Tin khác")).toBeInTheDocument();
});

test("read receipts and attachments survive older snapshots", () => {
  const attachment = { name: "fixture.txt", type: "text/plain", dataUrl: "data:text/plain;base64,dGVzdA==" };
  const confirmed = confirmChatMessage([{ ...pending, attachment }], pending._id, saved);
  const read = mergeChatMessages(confirmed, [{ ...saved, read: true }]);
  const older = mergeChatMessages(read, [{ ...saved, read: false }]);
  expect(older[0].read).toBe(true);
  expect(older[0].attachment).toEqual(attachment);
  expect(older[0]._clientKey).toBe(pending._id);
  expect(mergeChatMessages(older, [{ ...saved, read: false }])).toBe(older);
});

test("acknowledgement deduplicates the saved ID even if it was already received", () => {
  const result = confirmChatMessage([pending, { ...saved, read: true }], pending._id, saved);
  expect(result).toHaveLength(1);
  expect(result[0]).toEqual(expect.objectContaining({ _id: saved._id, _clientKey: pending._id, read: true }));
});

test("temporary IDs are unique when two sends use the same clock millisecond", () => {
  const clock = jest.spyOn(Date, "now").mockReturnValue(1);
  try { expect(temporaryChatId()).not.toBe(temporaryChatId()); }
  finally { clock.mockRestore(); }
});
