import { buildMeasurementPlot, filterMeasurementRange, formatMeasurement, metricPoints, prepareHealthChartData } from "./healthChartData";

test("sorts a display copy without changing records or equalizing time gaps", () => {
  const records = [
    { createdAt: "2026-09-18T06:00:00Z", glucose: "94" },
    { createdAt: "2026-05-12T06:00:00Z", glucose: "90" },
    { createdAt: "2026-05-12T07:00:00Z", glucose: "98" },
  ];
  const original = JSON.stringify(records);
  const result = prepareHealthChartData(records);
  expect(JSON.stringify(records)).toBe(original);
  expect(result[1].timestamp - result[0].timestamp).toBe(3600000);
  expect(result[2].timestamp - result[1].timestamp).toBeGreaterThan(3600000);
  expect(result[0]).not.toBe(records[1]);
});

test("omits missing/invalid timestamps instead of plotting invented dates", () => {
  expect(prepareHealthChartData([{ createdAt: null }, { createdAt: "bad date" }, {}])).toEqual([]);
});

test("does not turn missing readings into zero and keeps numeric source values", () => {
  const data = [null, undefined, "", " ", "unknown", "94", 0].map((glucose) => ({ timestamp: 1, glucose }));
  expect(metricPoints(data, "glucose").map((row) => row.glucose)).toEqual([94, 0]);
  expect(data[5].glucose).toBe("94");
});

test("range ends at the newest real measurement and retains its boundary", () => {
  const rows = prepareHealthChartData([
    { createdAt: "2026-01-01T00:00:00Z" },
    { createdAt: "2026-01-24T00:00:00Z" },
    { createdAt: "2026-01-31T00:00:00Z" },
  ]);
  expect(filterMeasurementRange(rows, 7)).toEqual(rows.slice(1));
  expect(filterMeasurementRange(rows, 0)).toBe(rows);
});

test("breaks long time gaps without adding measurements", () => {
  const rows = prepareHealthChartData([
    { createdAt: "2026-01-01", systolic: 120, diastolic: 80 },
    { createdAt: "2026-03-01", systolic: 134, diastolic: null },
  ]);
  const plot = buildMeasurementPlot(rows, ["systolic", "diastolic"]);
  expect(plot.rows).toHaveLength(2);
  expect(plot.gaps).toBe(1);
  expect(plot.rows[0].s0_systolic).toBe(120);
  expect(plot.rows[1].s1_systolic).toBe(134);
  expect(plot.rows[1].s1_diastolic).toBeNull();
  expect(buildMeasurementPlot(rows, ["systolic"], "readings").rows.map(row => row.plotX)).toEqual([1, 2]);
});

test("missing display values never gain a unit or become zero", () => {
  expect(formatMeasurement(null, "bpm")).toBe("—");
  expect(formatMeasurement("", "cm")).toBe("—");
  expect(formatMeasurement(78, "bpm")).toBe("78 bpm");
});
