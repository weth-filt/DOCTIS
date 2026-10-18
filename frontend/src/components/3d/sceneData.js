// Pure presentation calculations. They never change clinical values or risks.
export function heartTone(status) {
  const label = String(status || "").toLowerCase();
  if (/nguy hiểm|danger|critical|cảnh báo/.test(label)) return "#fb7185";
  if (/cao|warning|chú ý|cần theo dõi/.test(label)) return "#fbbf24";
  if (!label || /neutral|chưa có|chưa đủ|unknown/.test(label)) return "#99d2cf";
  return "#5eead4";
}

export function heartbeatPeriod(bpm) {
  const value = Number(bpm);
  return 60 / (Number.isFinite(value) && value > 0 ? value : 60);
}

export function heartbeatScaleAt(elapsed, bpm) {
  const period = heartbeatPeriod(bpm);
  const time = Number.isFinite(elapsed) ? elapsed : 0;
  const phase = ((time % period) + period) % period / period;
  return 1 + .045 * Math.exp(-Math.pow((phase - .12) * 18, 2)) + .022 * Math.exp(-Math.pow((phase - .31) * 20, 2));
}

export function rectIsVisible(rect, width, height) {
  return Boolean(rect && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < height && rect.right > 0 && rect.left < width);
}

export function highestPrioritySlot(slots) {
  let selected = null;
  slots.forEach((entry, id) => {
    if (!selected || (entry.priority || 0) >= (selected.priority || 0)) selected = { id, ...entry };
  });
  return selected;
}

export function depthPlotGeometry(plot, lines) {
  const rows = plot.rows || [];
  const first = rows[0]?.plotX ?? 0;
  const span = (rows[rows.length - 1]?.plotX ?? first) - first;
  const values = rows.flatMap(row => lines.flatMap(line => {
    const value = row[line.key];
    return value !== null && value !== undefined && String(value).trim() !== "" && Number.isFinite(Number(value)) ? [Number(value)] : [];
  }));
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const extent = max - min || 1;
  const groups = (plot.segments || []).flatMap(segment => lines.map((line, lineIndex) => {
    const chains = [];
    let chain = [];
    rows.forEach(row => {
      const value = row[`s${segment}_${line.key}`];
      if (value == null || !Number.isFinite(value) || !Number.isFinite(row.plotX)) {
        if (chain.length) chains.push(chain);
        chain = [];
      } else {
        chain.push([span > 0 ? (row.plotX - first) / span * 7 - 3.5 : 0, (value - min) / extent * 2.7 - .9, lineIndex * .65]);
      }
    });
    if (chain.length) chains.push(chain);
    return { key: `${segment}-${line.key}`, line, chains };
  }));
  return { groups, hasValues: groups.some(group => group.chains.some(chain => chain.length)) };
}
