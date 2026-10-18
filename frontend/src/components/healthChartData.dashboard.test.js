import { buildMeasurementPlot, filterMeasurementRange, prepareHealthChartData } from "./healthChartData";

test("dashboard retains two readings from the same day at their true times", () => {
  const records = prepareHealthChartData([
    { _id: "later", createdAt: "2026-10-16T09:15:00Z", glucose: 112 },
    { _id: "earlier", createdAt: "2026-10-16T01:30:00Z", glucose: 94 },
  ]);
  const plot = buildMeasurementPlot(records, ["glucose"]);
  expect(plot.rows.map((row) => row._id)).toEqual(["earlier", "later"]);
  expect(plot.rows[1].plotX - plot.rows[0].plotX).toBe(7.75 * 3600000);
  expect(plot.rows.map((row) => row.s0_glucose)).toEqual([94, 112]);
});

test("missing measurements stay as null separators without invented zeros", () => {
  const records = prepareHealthChartData([
    { createdAt: "2026-10-14T00:00:00Z", glucose: 94 },
    { createdAt: "2026-10-15T00:00:00Z", glucose: null },
    { createdAt: "2026-10-16T00:00:00Z", glucose: 110 },
  ]);
  const plot = buildMeasurementPlot(records, ["glucose"]);
  expect(plot.rows).toHaveLength(3);
  expect(plot.rows.map((row) => row.s0_glucose)).toEqual([94, null, 110]);
});

test("a single valid reading survives invalid dates and a selected range", () => {
  const records = prepareHealthChartData([
    { createdAt: "invalid", glucose: 80 },
    { createdAt: "2026-10-16T01:30:00Z", glucose: 94 },
    { createdAt: undefined, glucose: 100 },
  ]);
  const plot = buildMeasurementPlot(filterMeasurementRange(records, 7), ["glucose"]);
  expect(plot.rows).toHaveLength(1);
  expect(plot.rows[0].plotX).toBe(Date.parse("2026-10-16T01:30:00Z"));
  expect(plot.rows[0].s0_glucose).toBe(94);
  expect(plot.gaps).toBe(0);
});

test("pressure lines preserve independently missing values and exact gap boundary", () => {
  const records = prepareHealthChartData([
    { createdAt: "2026-10-01T00:00:00Z", systolic: 120, diastolic: 80 },
    { createdAt: "2026-10-08T00:00:00Z", systolic: "", diastolic: 82 },
    { createdAt: "2026-10-15T00:00:01Z", systolic: 128, diastolic: null },
  ]);
  const plot = buildMeasurementPlot(records, ["systolic", "diastolic"]);
  expect(plot.gaps).toBe(1);
  expect(plot.rows[1].s0_systolic).toBeNull();
  expect(plot.rows[1].s0_diastolic).toBe(82);
  expect(plot.rows[2].s1_systolic).toBe(128);
  expect(plot.rows[2].s1_diastolic).toBeNull();
});
