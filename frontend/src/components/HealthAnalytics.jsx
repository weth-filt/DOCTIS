import { lazy, Suspense, useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaArrowDown, FaArrowUp, FaChartLine, FaCube, FaHistory, FaSearchMinus, FaTable } from "react-icons/fa";
import useLiveReducedMotion from "./useLiveReducedMotion";
import { useStudioPreferences } from "./studio/StudioPreferences";
import { HEALTH_METRICS, MeasurementPlot } from "./DashboardChart";
import { filterMeasurementRange, formatMeasurement, prepareHealthChartData } from "./healthChartData";
import "../CSS/measurement-studio.css";

const ChartDepth = lazy(() => import("./3d/ChartDepth"));
const RANGES = [{ value: 0, label: "Tất cả" }, { value: 7, label: "7 ngày" }, { value: 30, label: "30 ngày" }, { value: 90, label: "90 ngày" }];
const COLUMNS = [{ key: "timestamp", label: "Thời gian" }, { key: "height", label: "Chiều cao" }, { key: "weight", label: "Cân nặng" }, { key: "bmi", label: "BMI" }, { key: "glucose", label: "Đường huyết" }, { key: "systolic", label: "Huyết áp" }, { key: "heartRate", label: "Nhịp tim" }];

export default function HealthAnalytics({ data = [], loading = false, error = false }) {
  const reduced = useLiveReducedMotion();
  const { simpleUI } = useStudioPreferences();
  const id = useId();
  const [metricKey, setMetricKey] = useState("glucose");
  const [days, setDays] = useState(0);
  const [mode, setMode] = useState("time");
  const [depth, setDepth] = useState(false);
  const [zoomStart, setZoomStart] = useState(0);
  const [zoomEnd, setZoomEnd] = useState(null);
  const [sort, setSort] = useState({ key: "timestamp", ascending: false });
  const records = useMemo(() => prepareHealthChartData(data), [data]);
  const filtered = useMemo(() => filterMeasurementRange(records, days), [records, days]);
  const start = Math.min(zoomStart, Math.max(0, filtered.length - 1));
  const end = Math.max(start, Math.min(zoomEnd ?? filtered.length - 1, filtered.length - 1));
  const displayed = useMemo(() => filtered.slice(start, end + 1), [filtered, start, end]);
  const metric = HEALTH_METRICS.find((item) => item.key === metricKey);
  const latest = [...displayed].reverse().find((row) => metric.lines.some((line) => formatMeasurement(row[line.key]) !== "—"));
  const tableRows = useMemo(() => [...displayed].sort((a, b) => {
    const aValid = formatMeasurement(a[sort.key]) !== "—";
    const bValid = formatMeasurement(b[sort.key]) !== "—";
    if (!aValid || !bValid) return aValid ? -1 : bValid ? 1 : 0;
    return (Number(a[sort.key]) - Number(b[sort.key])) * (sort.ascending ? 1 : -1);
  }), [displayed, sort]);
  const selectRange = (range) => { setDays(range); setZoomStart(0); setZoomEnd(null); };
  const toggleSort = (key) => setSort((current) => ({ key, ascending: current.key === key ? !current.ascending : key !== "timestamp" }));
  const actualDepth = depth && !reduced && !simpleUI;
  const standardPlot = <MeasurementPlot data={displayed} metric={metric} mode={mode} />;

  return <div className="measurement-studio measurement-observatory">
    <header className="measurement-page-intro"><div><span className="measurement-kicker">Lưu giữ / Theo dõi sức khỏe</span><h2>Nhìn lại từng lần ghi nhận.</h2><p>Dữ liệu theo thời gian, giữ đúng từng chỉ số và khoảng trống giữa các lần đo.</p></div><div className="measurement-record-seal"><FaHistory /><strong>{records.length}</strong><span>lần đã lưu</span></div></header>
    <section className="measurement-panel measurement-observatory-chart">
      <div className="measurement-toolbar"><div className="measurement-tabs" role="group" aria-label="Chỉ số sức khỏe">{HEALTH_METRICS.map((item) => <button key={item.key} type="button" aria-pressed={item.key === metricKey} onClick={() => setMetricKey(item.key)}>{item.key === metricKey && <motion.i className="measurement-tab-selection" layoutId={`measurement-tab-${id}`} transition={{ duration: reduced ? 0 : .2 }} />}<span>{item.label}</span></button>)}</div><div className="measurement-dimension" role="group" aria-label="Chiều hiển thị"><button type="button" aria-pressed={!actualDepth} onClick={() => setDepth(false)}><FaChartLine /> 2D</button><button type="button" aria-pressed={actualDepth} disabled={reduced || simpleUI} onClick={() => setDepth(true)} title={reduced || simpleUI ? "Chế độ 2D được dùng khi giảm chuyển động hoặc bật giao diện đơn giản." : "Khám phá cùng dữ liệu trong không gian 3D"}><FaCube /> 3D</button></div></div>
      <div className="measurement-summary"><div><span>Lần đo gần nhất trong khoảng</span><h2>{latest ? metric.lines.map((line) => formatMeasurement(latest[line.key])).join(" / ") : "—"} <small>{latest ? metric.unit : ""}</small></h2><time>{latest ? new Date(latest.timestamp).toLocaleString("vi-VN") : "Chưa có lần ghi nhận phù hợp"}</time></div><div className="measurement-controls"><div className="measurement-range-pills" role="group" aria-label="Khoảng dữ liệu">{RANGES.map((range) => <button type="button" key={range.value} aria-pressed={days === range.value} onClick={() => selectRange(range.value)}>{range.label}</button>)}</div><label>Trục biểu đồ<select value={mode} onChange={(event) => setMode(event.target.value)}><option value="time">Theo thời gian</option><option value="readings">Theo lần đo</option></select></label></div></div>
      <AnimatePresence mode="wait" initial={false}><motion.div key={`${metricKey}-${actualDepth}`} className="measurement-visual-surface" initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: reduced ? 1 : 0 }} transition={{ duration: reduced ? 0 : .2 }}>{loading ? <div className="measurement-empty" role="status">Đang tải dữ liệu…</div> : error ? <div className="measurement-empty" role="alert">Không tải được dữ liệu sức khỏe.</div> : actualDepth ? <Suspense fallback={standardPlot}><ChartDepth data={displayed} metric={metric} mode={mode} /></Suspense> : standardPlot}</motion.div></AnimatePresence>
      {filtered.length > 2 && <div className="measurement-zoom"><div><FaSearchMinus /><span>Thu phóng theo lần ghi nhận</span><button type="button" disabled={start === 0 && end === filtered.length - 1} onClick={() => { setZoomStart(0); setZoomEnd(null); }}>Đặt lại</button></div><div className="measurement-zoom-inputs"><label>Từ lần đo #{start + 1}<input type="range" min="0" max={Math.max(0, end - 1)} value={start} onChange={(event) => setZoomStart(Number(event.target.value))} /></label><label>Đến lần đo #{end + 1}<input type="range" min={Math.min(start + 1, filtered.length - 1)} max={filtered.length - 1} value={end} onChange={(event) => setZoomEnd(Number(event.target.value))} /></label></div></div>}
      <div className="measurement-context-line"><span><i /> {displayed.length} lần đo trong khung nhìn</span><p>{records.length ? `Khoảng tính đến lần đo mới nhất: ${new Date(records[records.length - 1].timestamp).toLocaleDateString("vi-VN")}.` : "Chỉ số sẽ xuất hiện sau khi được ghi nhận."}</p></div>
    </section>
    <section className="measurement-panel measurement-history"><div className="measurement-table-heading"><div><span className="measurement-kicker"><FaTable /> Dữ liệu gốc</span><h2>Lịch sử ghi nhận</h2></div><span>{displayed.length} lần đo · Bấm tiêu đề để sắp xếp</span></div><div className="measurement-table-scroll"><table><thead><tr>{COLUMNS.map((column) => <th key={column.key} aria-sort={sort.key === column.key ? sort.ascending ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleSort(column.key)}>{column.label}{sort.key === column.key ? sort.ascending ? <FaArrowUp /> : <FaArrowDown /> : <span className="measurement-sort-placeholder">↕</span>}</button></th>)}</tr></thead><tbody><AnimatePresence initial={false}>{tableRows.map((row, index) => <motion.tr layout={!reduced} key={row._id || `${row.timestamp}-${records.indexOf(row)}`} initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .18, delay: reduced ? 0 : Math.min(index, 6) * .025 }}><td><time>{new Date(row.timestamp).toLocaleString("vi-VN")}</time></td><td>{formatMeasurement(row.height, "cm")}</td><td>{formatMeasurement(row.weight, "kg")}</td><td>{formatMeasurement(row.bmi, "kg/m²")}</td><td>{formatMeasurement(row.glucose, "mg/dL")}</td><td>{formatMeasurement(row.systolic) === "—" && formatMeasurement(row.diastolic) === "—" ? "—" : `${formatMeasurement(row.systolic)}/${formatMeasurement(row.diastolic)} mmHg`}</td><td>{formatMeasurement(row.heartRate, "bpm")}</td></motion.tr>)}</AnimatePresence>{!displayed.length && <tr><td colSpan={7}>{loading ? "Đang tải…" : error ? "Không tải được lịch sử." : "Chưa có bản ghi trong khoảng này."}</td></tr>}</tbody></table></div></section>
  </div>;
}
