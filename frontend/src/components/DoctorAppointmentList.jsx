import { useEffect, useMemo, useRef, useState } from "react";
import { FaCalendarAlt, FaCheck, FaEnvelope, FaSearch, FaSyncAlt } from "react-icons/fa";
import { formatAppointmentDateTime } from "../utils/appointmentDateTime";

const labels = { pending: "Chờ duyệt", approved: "Đã duyệt", completed: "Đã hoàn thành", cancelled: "Đã hủy" };
const tabs = [["all", "Tất cả"], ["pending", "Chờ duyệt"], ["approved", "Đã duyệt"], ["completed", "Đã hoàn thành"], ["cancelled", "Đã hủy"]];
const personName = item => item.patientId?.fullName || item.patientId?.username || "Bệnh nhân";

export default function DoctorAppointmentList({ appointments = [], loading, error, feedback, actionId, reminderId, creating, now, focusId, onReload, onUpdateStatus, onCancel, onRemind }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const focusedNotification = useRef(null);
  const busy = Boolean(actionId || reminderId || creating);
  const visible = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi-VN");
    return appointments.filter(item => (filter === "all" || item.status === filter) && (!keyword || [personName(item), item.type, item.note].filter(Boolean).join(" ").toLocaleLowerCase("vi-VN").includes(keyword)));
  }, [appointments, filter, search]);
  useEffect(() => { if (focusId) { setFilter("all"); setSearch(""); } }, [focusId]);
  useEffect(() => {
    if (!focusId || focusedNotification.current === focusId) return;
    const node = document.getElementById(`doctor-appointment-${focusId}`);
    if (node) {
      node.focus({ preventScroll: true }); node.scrollIntoView?.({ block: "center", behavior: "auto" });
      focusedNotification.current = focusId;
    }
  }, [focusId, visible]);

  return <section className="patient-table doctor-appointments" aria-label="Quản lý lịch hẹn">
    <div className="table-top"><div><h2>Lịch hẹn</h2><p>Duyệt lịch chờ, cập nhật buổi khám và quản lý lịch đã tạo.</p></div><button type="button" className="soft-btn doctor-appointment-refresh" onClick={onReload} disabled={loading || busy}><FaSyncAlt aria-hidden="true" />{loading ? "Đang tải…" : "Tải lại"}</button></div>
    <div className="doctor-appointment-toolbar"><label><FaSearch aria-hidden="true" /><input type="search" aria-label="Tìm lịch hẹn" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm bệnh nhân hoặc nội dung lịch…" /></label><span className="doctor-appointment-count">{visible.length} lịch hẹn</span></div>
    <div className="doctor-appointment-filters" role="group" aria-label="Lọc trạng thái lịch hẹn">{tabs.map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span>{key === "all" ? appointments.length : appointments.filter(item => item.status === key).length}</span></button>)}</div>
    {error && <p role="alert" className="doctor-appointment-feedback is-error">{error}</p>}
    {feedback && <p role={feedback.type === "error" ? "alert" : "status"} className={`doctor-appointment-feedback is-${feedback.type}`}>{feedback.message}</p>}
    <div className="appointment-list" aria-busy={loading}>{visible.map(item => {
      const timestamp = new Date(item.appointmentDate).getTime();
      const hasValidTime = Boolean(item.appointmentDate) && Number.isFinite(timestamp);
      const canComplete = hasValidTime && timestamp <= now;
      const active = ["pending", "approved"].includes(item.status);
      return <article className="appointment-row" id={`doctor-appointment-${item._id}`} tabIndex={-1} key={item._id}>
        <div className="appointment-date-icon"><FaCalendarAlt aria-hidden="true" /></div>
        <div className="appointment-main"><strong>{personName(item)}</strong><span>{formatAppointmentDateTime(item.appointmentDate)} · {item.type || "Tái khám"}</span>{item.note && <p>{item.note}</p>}{item.status === "approved" && !canComplete && <small className="appointment-timing-note">{hasValidTime ? "Chỉ hoàn tất sau khi đến giờ hẹn." : "Cần cập nhật thời gian hẹn hợp lệ."}</small>}{item.status === "cancelled" && item.cancelReason && <small>Lý do hủy: {item.cancelReason}</small>}</div>
        <span className={`appointment-status ${item.status}`}>{labels[item.status] || "Chưa xác định"}</span>
        <div className="appointment-actions">
          {item.status === "pending" && <button type="button" className="view-btn" disabled={busy} onClick={() => onUpdateStatus(item, "approved")}><FaCheck aria-hidden="true" />{actionId === item._id ? "Đang duyệt…" : "Duyệt"}</button>}
          {item.status === "approved" && <button type="button" className="view-btn" disabled={busy || !canComplete} title={!canComplete ? `Có thể hoàn tất từ ${formatAppointmentDateTime(item.appointmentDate)}` : undefined} onClick={() => onUpdateStatus(item, "completed")}><FaCheck aria-hidden="true" />{actionId === item._id ? "Đang lưu…" : "Hoàn tất"}</button>}
          {active && <><button type="button" className="reminder-btn" disabled={busy} onClick={() => onRemind(item._id)}><FaEnvelope aria-hidden="true" />{reminderId === item._id ? "Đang gửi…" : "Nhắc email"}</button><button type="button" className="close-btn" disabled={busy} onClick={() => onCancel(item)}>Hủy</button></>}
        </div>
      </article>;
    })}{!visible.length && <div className="empty-state"><FaCalendarAlt aria-hidden="true" />{loading ? "Đang tải lịch hẹn…" : error ? "Chưa tải được danh sách lịch hẹn." : search || filter !== "all" ? "Không có lịch hẹn phù hợp bộ lọc." : "Chưa có lịch hẹn."}</div>}</div>
  </section>;
}
