import { fireEvent, render, screen } from "@testing-library/react";
import AISuggestions from "./AISuggestions";
import AppointmentCalendar from "./AppointmentCalendar";
import CareWeekGallery from "./CareWeekGallery";

jest.mock("framer-motion", () => {
  const React = require("react");
  const components = {};
  return {
    AnimatePresence: ({ children }) => children,
    motion: new Proxy({}, { get: (_target, tag) => {
      if (!components[tag]) components[tag] = React.forwardRef(({ children, initial, animate, exit, transition, layout, whileInView, viewport, ...props }, ref) => React.createElement(tag, { ...props, ref }, children));
      return components[tag];
    } }),
  };
});

test("AI suggestions only fill the existing draft and retain the medical disclaimer", () => {
  const choose = jest.fn();
  render(<AISuggestions onChoose={choose} />);
  fireEvent.click(screen.getByRole("button", { name: "Gợi ý bữa tối phù hợp" }));
  expect(choose).toHaveBeenCalledTimes(1);
  expect(choose).toHaveBeenCalledWith("Gợi ý bữa tối phù hợp");
  expect(screen.getByText(/không thay thế chẩn đoán/)).toBeTruthy();
});

test("calendar filters actual appointments and exposes existing details without a booking action", () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-17T12:00:00Z"));
  const data = [{ _id: "a", appointmentDate: "2026-10-18T08:00:00Z", doctorId: { fullName: "Doctor A" }, status: "CONFIRMED", note: "Existing note" }, { _id: "b", appointmentDate: "2026-10-22T08:00:00Z", doctorId: { fullName: "Doctor B" } }];
  const original = JSON.stringify(data);
  const { unmount } = render(<AppointmentCalendar appointments={data} statusLabel={(status) => status} />);
  expect(screen.getByText("Doctor A")).toBeTruthy();
  expect(screen.getByText("Doctor B")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /18.*10.*1 cuộc hẹn/ }));
  expect(screen.getByText("Doctor A")).toBeTruthy();
  expect(screen.queryByText("Doctor B")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết" }));
  expect(screen.getByText("Existing note")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Đặt lịch/ })).toBeNull();
  expect(JSON.stringify(data)).toBe(original);
  unmount();
  jest.useRealTimers();
});

test("care gallery passes the existing activity id and day index without mutating its source", () => {
  const select = jest.fn();
  const toggle = jest.fn();
  const days = [{ label: "Ngày đầu", meals: [{ id: "meal-a", time: "08:00", title: "Bữa sáng", done: false }], medications: [], exercise: null }];
  const original = JSON.stringify(days);
  render(<CareWeekGallery days={days} activeDay={0} onSelectDay={select} onToggleActivity={toggle} />);
  fireEvent.click(screen.getByRole("button", { name: /08:00 Bữa sáng/ }));
  expect(select).toHaveBeenCalledWith(0);
  expect(toggle).toHaveBeenCalledWith(0, "meal-a");
  expect(JSON.stringify(days)).toBe(original);
});
