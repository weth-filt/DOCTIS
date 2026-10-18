import { fireEvent, render, screen, within } from "@testing-library/react";
import HealthAnalytics from "./HealthAnalytics";

jest.mock("./useLiveReducedMotion", () => () => true);
jest.mock("./DashboardChart", () => ({
  HEALTH_METRICS: [{ key: "glucose", label: "Đường huyết", unit: "mg/dL", lines: [{ key: "glucose" }] }],
  MeasurementPlot: ({ data, mode }) => <div data-testid="analytics-plot">{data.length}:{mode}</div>,
}));
jest.mock("framer-motion", () => {
  const React = require("react");
  const components = {};
  return { AnimatePresence: ({ children }) => children, motion: new Proxy({}, { get: (_target, tag) => {
    if (!components[tag]) components[tag] = React.forwardRef(({ children, initial, animate, exit, transition, layout, layoutId, ...props }, ref) => React.createElement(tag, { ...props, ref }, children));
    return components[tag];
  } }) };
});

const records = [
  { _id: "a", createdAt: "2026-09-01T08:00:00Z", glucose: 100 },
  { _id: "b", createdAt: "2026-09-08T08:00:00Z", glucose: 140 },
  { _id: "c", createdAt: "2026-09-18T08:00:00Z", glucose: 94 },
];

test("analytics zoom and range filter actual records without changing source data", () => {
  const original = JSON.stringify(records);
  render(<HealthAnalytics data={records} />);
  expect(screen.getByTestId("analytics-plot").textContent).toBe("3:time");
  fireEvent.change(screen.getByRole("slider", { name: "Từ lần đo #1" }), { target: { value: "1" } });
  expect(screen.getByTestId("analytics-plot").textContent).toBe("2:time");
  expect(screen.getAllByRole("row").length).toBe(3);
  fireEvent.click(screen.getByRole("button", { name: "7 ngày" }));
  expect(screen.getByTestId("analytics-plot").textContent).toBe("1:time");
  expect(JSON.stringify(records)).toBe(original);
});

test("analytics numeric sorting keeps timestamp and values together; reduced motion disables 3D", () => {
  render(<HealthAnalytics data={records} />);
  const sort = within(screen.getByRole("columnheader", { name: /Đường huyết/ })).getByRole("button");
  fireEvent.click(sort);
  let rows = screen.getAllByRole("row");
  expect(rows[1].textContent).toContain("94 mg/dL");
  fireEvent.click(sort);
  rows = screen.getAllByRole("row");
  expect(rows[1].textContent).toContain("140 mg/dL");
  expect(screen.getByRole("button", { name: "3D" }).disabled).toBe(true);
});
