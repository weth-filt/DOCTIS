export function prepareHealthChartData(data) {
  if (!Array.isArray(data)) return [];
  return data.filter((row) => row?.createdAt).map((row) => ({
    ...row,
    timestamp: new Date(row.createdAt).getTime(),
  })).filter((row) => Number.isFinite(row.timestamp)).sort((a, b) => a.timestamp - b.timestamp);
}

export function metricPoints(data, key) {
  return data.filter((row) => {
    const value = row[key];
    return value !== null && value !== undefined && String(value).trim() !== "" && Number.isFinite(Number(value)) && Number.isFinite(row.timestamp);
  }).map((row) => ({ ...row, [key]: Number(row[key]) }));
}

export function filterMeasurementRange(data, days = 0) {
  if (!days || !data.length) return data;
  const end = data[data.length - 1].timestamp;
  return data.filter((row) => row.timestamp >= end - days * 86400000);
}

// Segment keys live on actual records. No invented measurement is inserted.
export function buildMeasurementPlot(data, keys, mode = "time", gapDays = 7) {
  let segment = 0;
  let gaps = 0;
  const rows = data.map((row, index) => {
    if (index && mode === "time" && row.timestamp - data[index - 1].timestamp > gapDays * 86400000) { segment += 1; gaps += 1; }
    const point = { ...row, plotX: mode === "time" ? row.timestamp : index + 1 };
    keys.forEach((key) => {
      const value = row[key];
      point[`s${segment}_${key}`] = value !== null && value !== undefined && String(value).trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
    });
    return point;
  });
  return { rows, segments: Array.from({ length: segment + 1 }, (_, index) => index), gaps };
}

export function formatMeasurement(value, unit = "") {
  if (value === null || value === undefined || String(value).trim() === "" || !Number.isFinite(Number(value))) return "—";
  return `${Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
}
