import { fireEvent, render, screen } from "@testing-library/react";
import ChartDepth from "./ChartDepth";
import useLiveReducedMotion from "../useLiveReducedMotion";

jest.mock("../useLiveReducedMotion", () => ({ __esModule: true, default: jest.fn(() => false) }));
jest.mock("../DashboardChart", () => ({ MeasurementPlot: () => <div data-testid="standard-plot">2D plot</div> }));
jest.mock("./HeartScene", () => ({ SceneBoundary: ({ children }) => children }));
jest.mock("./ChartDepthCanvas", () => ({ __esModule: true, default: ({ onFailure }) => <div data-testid="depth-plot"><button onClick={onFailure}>Lose chart context</button></div> }));

const metric = { key: "glucose", label: "Đường huyết", unit: "mg/dL", lines: [{ key: "glucose", label: "Đường huyết" }] };
beforeEach(() => useLiveReducedMotion.mockReturnValue(false));

test("context loss falls back to the standard plot and explains the actual state", async () => {
  render(<ChartDepth data={[{ timestamp: 1234, glucose: 94 }]} metric={metric} />);
  await screen.findByTestId("depth-plot");
  fireEvent.click(screen.getByRole("button", { name: "Lose chart context" }));
  expect(screen.queryByTestId("depth-plot")).toBeNull();
  expect(screen.getByTestId("standard-plot")).not.toBeNull();
  expect(screen.getByRole("status").textContent).toContain("3D hiện không khả dụng");
});

test("simple or reduced motion uses 2D before a canvas is mounted", () => {
  useLiveReducedMotion.mockReturnValue(true);
  render(<ChartDepth data={[{ timestamp: 1234, glucose: 94 }]} metric={metric} />);
  expect(screen.queryByTestId("depth-plot")).toBeNull();
  expect(screen.getByTestId("standard-plot")).not.toBeNull();
});

test("an empty metric does not open a WebGL context for an empty graph", () => {
  render(<ChartDepth data={[{ timestamp: 1234, glucose: null }]} metric={metric} />);
  expect(screen.queryByTestId("depth-plot")).toBeNull();
  expect(screen.getByTestId("standard-plot")).not.toBeNull();
});
