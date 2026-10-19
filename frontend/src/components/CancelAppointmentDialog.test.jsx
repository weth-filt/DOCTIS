import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CancelAppointmentDialog from "./CancelAppointmentDialog";
import API from "../services/api";
jest.mock("../services/api", () => ({ put: jest.fn() }));
const appointment = { _id: "appointment-fixture", appointmentDate: "2026-10-20T02:00:00Z", status: "approved", type: "Tái khám", doctorId: { fullName: "Bác sĩ kiểm thử" } };
beforeEach(() => jest.clearAllMocks());

test("closing the confirmation or pressing Escape keeps the appointment untouched", () => {
  const close = jest.fn(); render(<CancelAppointmentDialog appointment={appointment} onClose={close} />);
  expect(screen.getByRole("dialog", { name: "Xác nhận hủy lịch hẹn" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Giữ lịch hẹn" }));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(close).toHaveBeenCalledTimes(2); expect(API.put).not.toHaveBeenCalled();
});

test("confirmed cancellation sends a trimmed reason once and returns the persisted cancelled record", async () => {
  let resolve;
  API.put.mockReturnValue(new Promise(done => { resolve = done; }));
  const close = jest.fn(), cancelled = jest.fn();
  render(<CancelAppointmentDialog appointment={appointment} onClose={close} onCancelled={cancelled} />);
  fireEvent.change(screen.getByRole("textbox", { name: /Lý do hủy/ }), { target: { value: "  Tôi cần đổi thời gian  " } });
  const form = screen.getByRole("dialog").querySelector("form");
  act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(API.put).toHaveBeenCalledTimes(1);
  expect(API.put).toHaveBeenCalledWith("/appointments/cancel/appointment-fixture", { reason: "Tôi cần đổi thời gian" });
  fireEvent.keyDown(document, { key: "Escape" }); expect(close).not.toHaveBeenCalled();
  const updated = { ...appointment, status: "cancelled", cancelReason: "Tôi cần đổi thời gian" };
  await act(async () => { resolve({ data: { msg: "Đã hủy", appointment: updated } }); });
  expect(cancelled).toHaveBeenCalledWith(updated, { msg: "Đã hủy", appointment: updated }); expect(close).toHaveBeenCalledTimes(1);
});

test("server denial retains reason and never calls success or closes the dialog", async () => {
  API.put.mockRejectedValue({ response: { status: 409, data: { msg: "Lịch đã hoàn thành." } } });
  const close = jest.fn(), cancelled = jest.fn(); render(<CancelAppointmentDialog appointment={appointment} onClose={close} onCancelled={cancelled} />);
  const reason = screen.getByRole("textbox", { name: /Lý do hủy/ });
  fireEvent.change(reason, { target: { value: "Lý do kiểm thử" } }); fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Lịch đã hoàn thành.");
  expect(reason.value).toBe("Lý do kiểm thử"); expect(close).not.toHaveBeenCalled(); expect(cancelled).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("button", { name: "Xác nhận hủy" }).disabled).toBe(false));
});

test("an incomplete API response cannot fabricate a successful cancellation", async () => {
  API.put.mockResolvedValue({ data: { msg: "Fixture only" } });
  const cancelled = jest.fn(); render(<CancelAppointmentDialog appointment={appointment} onCancelled={cancelled} />);
  fireEvent.change(screen.getByRole("textbox", { name: /Lý do hủy/ }), { target: { value: "Lý do kiểm thử" } }); fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" }));
  await screen.findByRole("alert"); expect(cancelled).not.toHaveBeenCalled();
});
