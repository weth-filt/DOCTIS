import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { SceneBoundary } from "./HeartScene";
import { buildMeasurementPlot, formatMeasurement } from "../healthChartData";
import { MeasurementPlot } from "../DashboardChart";
import useLiveReducedMotion from "../useLiveReducedMotion";
import { depthPlotGeometry } from "./sceneData";

const DepthCanvas=lazy(()=>import("./ChartDepthCanvas"));
export default function ChartDepth({data=[],metric,mode="time"}) {
  const reduced=useLiveReducedMotion();
  const [failed,setFailed]=useState(false);
  const onFailure=useCallback(()=>setFailed(true),[]);
  const plot=useMemo(()=>buildMeasurementPlot(data,metric.lines.map(line=>line.key),mode),[data,metric,mode]);
  const hasValues=useMemo(()=>depthPlotGeometry(plot,metric.lines).hasValues,[plot,metric]);
  const fallback=<MeasurementPlot data={data} metric={metric} mode={mode}/>;
  if(failed) return <><p className="measurement-caption" role="status">Đồ họa 3D hiện không khả dụng. Biểu đồ 2D và số liệu vẫn được giữ.</p>{fallback}</>;
  if(reduced || !data.length || !hasValues) return fallback;
  return <div className="chart-depth-view"><SceneBoundary fallback={fallback} onFailure={onFailure}><Suspense fallback={fallback}><DepthCanvas plot={plot} metric={metric} onFailure={onFailure}/></Suspense></SceneBoundary>
    <div className="measurement-legend">{metric.lines.map(line=><span key={line.key}><i style={{background:line.color}}/>{line.label} · {metric.unit}</span>)}</div>
    <p className="measurement-caption">Kéo để xoay nhẹ, dùng nút +/− để phóng. {mode === "time" ? "Vị trí giữ đúng thời gian; đường nối ngắt khi thiếu dữ liệu hơn 7 ngày." : "Các lần đo cách đều, không biểu thị khoảng thời gian."}</p>
    <details className="chart-depth-values"><summary>Xem số liệu gốc · {data.length} lần ghi nhận</summary><div className="measurement-table-scroll"><table><thead><tr><th>Thời gian</th>{metric.lines.map(line=><th key={line.key}>{line.label} ({metric.unit})</th>)}</tr></thead><tbody>{data.map((row,index)=><tr key={row._id||index}><td>{new Date(row.timestamp).toLocaleString("vi-VN")}</td>{metric.lines.map(line=><td key={line.key}>{formatMeasurement(row[line.key])}</td>)}</tr>)}</tbody></table></div></details>
  </div>;
}
