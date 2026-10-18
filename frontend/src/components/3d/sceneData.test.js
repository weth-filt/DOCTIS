import { buildMeasurementPlot } from "../healthChartData";
import { depthPlotGeometry, heartbeatPeriod, heartbeatScaleAt, heartTone, highestPrioritySlot, rectIsVisible } from "./sceneData";

test("heart timing follows real bpm with a neutral 60 bpm fallback", () => {
  expect(heartbeatPeriod(120)).toBe(.5);
  expect(heartbeatPeriod("75")).toBe(.8);
  [undefined, null, "", 0, -20, Infinity, "invalid"].forEach(value => expect(heartbeatPeriod(value)).toBe(1));
  expect(heartbeatScaleAt(.06, 120)).toBeGreaterThan(heartbeatScaleAt(.4, 120));
  expect(heartbeatScaleAt(.56, 120)).toBeCloseTo(heartbeatScaleAt(.06, 120), 8);
});

test("WebGL and fallback share actual status colors without recomputing risk", () => {
  expect(heartTone("Ổn định")).toBe("#5eead4");
  expect(heartTone("Cao")).toBe("#fbbf24");
  expect(heartTone("Chú ý")).toBe("#fbbf24");
  expect(heartTone("Nguy hiểm")).toBe("#fb7185");
  expect(heartTone("Chưa có dữ liệu")).toBe("#99d2cf");
});

test("3D coordinates preserve gaps and never invent missing measurement points", () => {
  const days = 86400000;
  const rows = [
    { timestamp: days, systolic: 120, diastolic: 75 },
    { timestamp: 2 * days, systolic: 125, diastolic: null },
    { timestamp: 20 * days, systolic: 130, diastolic: 80 },
  ];
  const plot = buildMeasurementPlot(rows, ["systolic", "diastolic"]);
  const { groups, hasValues } = depthPlotGeometry(plot, [{ key: "systolic" }, { key: "diastolic" }]);
  expect(hasValues).toBe(true);
  expect(groups).toHaveLength(4);
  expect(new Set(groups.map(group => group.key)).size).toBe(4);
  expect(groups.flatMap(group => group.chains.flatMap(chain => chain))).toHaveLength(5);
  expect(groups.find(group => group.key === "0-systolic").chains[0]).toHaveLength(2);
  expect(groups.find(group => group.key === "1-systolic").chains[0]).toHaveLength(1);
});

test("one timestamp is centered and an entirely missing metric has no geometry", () => {
  const single = buildMeasurementPlot([{ timestamp: 1234, glucose: 94 }], ["glucose"]);
  expect(depthPlotGeometry(single, [{ key: "glucose" }]).groups[0].chains[0][0][0]).toBe(0);
  const missing = buildMeasurementPlot([{ timestamp: 1234, glucose: null }], ["glucose"]);
  expect(depthPlotGeometry(missing, [{ key: "glucose" }]).hasValues).toBe(false);
});

test("intro takes canvas priority and releasing it restores the hero slot", () => {
  const slots = new Map([["hero", { priority: 0 }], ["intro", { priority: 100 }], ["mascot", { priority: 0 }]]);
  expect(highestPrioritySlot(slots).id).toBe("intro");
  slots.delete("intro");
  expect(highestPrioritySlot(slots).id).toBe("mascot");
});

test("viewport visibility excludes hidden, zero-sized and both offscreen axes", () => {
  const rect = { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 };
  expect(rectIsVisible(rect, 390, 700)).toBe(true);
  expect(rectIsVisible({ ...rect, top: 800, bottom: 900 }, 390, 700)).toBe(false);
  expect(rectIsVisible({ ...rect, left: 500, right: 600 }, 390, 700)).toBe(false);
  expect(rectIsVisible({ ...rect, width: 0 }, 390, 700)).toBe(false);
});
