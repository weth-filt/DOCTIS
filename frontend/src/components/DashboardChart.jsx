import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildMeasurementPlot, prepareHealthChartData } from "./healthChartData";
import useLiveReducedMotion from "./useLiveReducedMotion";
import "../CSS/measurement-studio.css";

export const HEALTH_METRICS = [
  { key: "glucose", label: "Đường huyết", unit: "mg/dL", lines: [{ key: "glucose", label: "Đường huyết", color: "#087f8c" }] },
  { key: "pressure", label: "Huyết áp", unit: "mmHg", lines: [{ key: "systolic", label: "Tâm thu", color: "#087f8c" }, { key: "diastolic", label: "Tâm trương", color: "#d0806b" }] },
  { key: "bmi", label: "BMI", unit: "kg/m²", lines: [{ key: "bmi", label: "BMI", color: "#438b78" }] },
  { key: "heartRate", label: "Nhịp tim", unit: "bpm", lines: [{ key: "heartRate", label: "Nhịp tim", color: "#c36e75" }] },
];

function MeasurementTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) return null;
  return <div className="measurement-tooltip"><time>{new Date(payload[0].payload.timestamp).toLocaleString("vi-VN")}</time>{payload.map((item) => <div key={item.dataKey}><i style={{ background: item.color }} /><span>{item.name}</span><strong>{item.value} {metric.unit}</strong></div>)}</div>;
}

export function MeasurementPlot({ data, metric = HEALTH_METRICS[0], mode = "time", compact = false }) {
  const reduced = useLiveReducedMotion();
  const { rows, segments, gaps } = buildMeasurementPlot(data, metric.lines.map((line) => line.key), mode);
  const hasValues = rows.some((row) => metric.lines.some((line) => segments.some((segment) => row[`s${segment}_${line.key}`] != null)));
  if (!rows.length || !hasValues) return <div className="measurement-empty" role="status">Chưa có dữ liệu {metric.label.toLowerCase()} trong khoảng đã chọn.</div>;
  const first = rows[0].plotX;
  const last = rows[rows.length - 1].plotX;
  const domain = first === last ? [first - (mode === "time" ? 3600000 : 1), last + (mode === "time" ? 3600000 : 1)] : ["dataMin", "dataMax"];
  return <>
    <div className={`measurement-plot ${compact ? "is-compact" : ""}`} role="img" aria-label={`Biểu đồ ${metric.label}, ${metric.unit}, ${mode === "time" ? "theo thời gian" : "theo thứ tự lần đo"}`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 480, height: compact ? 260 : 300 }}><LineChart data={rows} margin={{ top: 15, right: 18, left: 0, bottom: 12 }}>
        <CartesianGrid stroke="#e5edef" strokeDasharray="3 5" vertical={false} />
        <XAxis type="number" dataKey="plotX" scale={mode === "time" ? "time" : "linear"} domain={domain} allowDecimals={false} axisLine={false} tickLine={false} minTickGap={35} tick={{ fill: "#70838d", fontSize: 12 }} tickFormatter={(value) => {
          if (mode === "readings") return Number.isInteger(value) && value >= 1 && value <= rows.length ? `#${value}` : "";
          const date = new Date(value);
          return last - first < 86400000 ? date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : `${date.getDate()}/${date.getMonth() + 1}`;
        }} />
        <YAxis width={62} domain={["auto", "auto"]} allowDecimals={metric.key === "bmi"} axisLine={false} tickLine={false} tick={{ fill: "#70838d", fontSize: 12 }} />
        <Tooltip content={<MeasurementTooltip metric={metric} />} cursor={{ stroke: "#9abdbb", strokeDasharray: "3 4" }} />
        {segments.flatMap((segment) => metric.lines.map((line) => <Line key={`${segment}_${line.key}`} dataKey={`s${segment}_${line.key}`} name={line.label} type="linear" stroke={line.color} strokeWidth={2.5} dot={{ r: rows.length > 70 ? 2 : 3, fill: line.color, stroke: "#fff", strokeWidth: 1 }} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} connectNulls={false} isAnimationActive={!reduced} animationDuration={650} animationEasing="ease-out" />))}
      </LineChart></ResponsiveContainer>
    </div>
    <div className="measurement-legend">{metric.lines.map((line) => <span key={line.key}><i style={{ background: line.color }} />{line.label} · {metric.unit}</span>)}</div>
    {mode === "time" ? <p className="measurement-caption">{gaps ? `${gaps} khoảng thiếu dữ liệu. ` : ""}Đường nối ngắt khi hai lần đo cách nhau hơn 7 ngày.</p> : <p className="measurement-caption">Các điểm cách đều theo lần đo; khoảng cách không biểu thị thời gian. Xem ngày giờ thật trong tooltip.</p>}
  </>;
}

export default function DashboardChart({ data = [], compact = false, loading = false, error = false }) {
  if (loading) return <div className="measurement-empty" role="status">Đang tải lịch sử đo…</div>;
  if (error) return <div className="measurement-empty" role="alert">Không tải được lịch sử sức khỏe. Vui lòng thử lại sau.</div>;
  return <MeasurementPlot data={prepareHealthChartData(data)} compact={compact} />;
}
