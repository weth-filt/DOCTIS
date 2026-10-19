import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import API from "../services/api";
import useWorkspaceDialog from "./useWorkspaceDialog";
import "../CSS/appointment-cancel.css";

export default function CancelAppointmentDialog({ appointment, onClose, onCancelled }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const mounted = useRef(true);
  const id = appointment?._id || appointment?.id;
  const titleId = useId(), reasonId = useId();
  const close = () => { if (!locked.current) onClose?.(); };
  const dialog = useWorkspaceDialog(Boolean(appointment), close);
  useEffect(() => { setReason(""); setError(""); }, [id]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  if (!appointment) return null;
  const date = new Date(appointment.appointmentDate);
  const when = Number.isFinite(date.getTime()) ? date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Chưa có thời gian hợp lệ";
  const submit = async event => {
    event.preventDefault();
    if (locked.current) return;
    const cleanReason = reason.trim();
    if (cleanReason.length < 3 || cleanReason.length > 1000) { setError("Vui lòng nhập lý do từ 3 đến 1.000 ký tự."); return; }
    locked.current = true; setBusy(true); setError("");
    try {
      const response = await API.put(`/appointments/cancel/${encodeURIComponent(id)}`, { reason: cleanReason });
      if (!response.data?.appointment || response.data.appointment.status !== "cancelled") throw new Error("CANCEL_NOT_CONFIRMED");
      if (!mounted.current) return;
      onCancelled?.(response.data.appointment, response.data);
      onClose?.();
    } catch (failure) {
      if (mounted.current) setError(failure.response?.data?.msg || "Chưa xác nhận được việc hủy lịch. Vui lòng thử lại; lịch chưa bị xóa.");
    } finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  return createPortal(<div className="appointment-cancel-shade" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <section ref={dialog} className="appointment-cancel-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy} tabIndex={-1}>
      <header><div><span className="appointment-cancel-kicker">LỊCH HẸN</span><h2 id={titleId}>Xác nhận hủy lịch hẹn</h2></div><button type="button" onClick={close} disabled={busy} aria-label="Đóng xác nhận hủy lịch">×</button></header>
      <dl><div><dt>Thời gian</dt><dd>{when}</dd></div><div><dt>Loại khám</dt><dd>{appointment.type || "Tái khám"}</dd></div>{appointment.patientId?.fullName && <div><dt>Bệnh nhân</dt><dd>{appointment.patientId.fullName}</dd></div>}{appointment.doctorId?.fullName && <div><dt>Bác sĩ</dt><dd>{appointment.doctorId.fullName}</dd></div>}</dl>
      <p>Lịch hẹn được giữ trong lịch sử với trạng thái đã hủy. Bên còn lại sẽ nhận thông báo.</p>
      <form onSubmit={submit}><label htmlFor={reasonId}>Lý do hủy <span aria-hidden="true">*</span></label><textarea id={reasonId} value={reason} onChange={event => { setReason(event.target.value); setError(""); }} rows={3} maxLength={1000} disabled={busy} placeholder="Nhập lý do để bệnh nhân hoặc bác sĩ được biết…" required />
        {error && <p className="appointment-cancel-error" role="alert">{error}</p>}
        <footer><button type="button" className="appointment-cancel-keep" onClick={close} disabled={busy}>Giữ lịch hẹn</button><button type="submit" className="appointment-cancel-confirm" disabled={busy || reason.trim().length < 3}>{busy ? "Đang hủy lịch…" : "Xác nhận hủy"}</button></footer>
      </form>
    </section>
  </div>, document.body);
}
