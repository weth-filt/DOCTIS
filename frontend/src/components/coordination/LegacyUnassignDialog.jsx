import { useRef, useState } from "react";
import API from "../../services/api";
import useWorkspaceDialog from "../useWorkspaceDialog";
import { entityId, errorText, personName } from "./coordinationUtils";

export default function LegacyUnassignDialog({ patient, onClose, onSaved }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const dialog = useWorkspaceDialog(Boolean(patient), () => { if (!lock.current) onClose(); });
  const submit = async event => {
    event.preventDefault(); if (lock.current || !patient) return;
    if (!reason.trim()) { setError("Nhập lý do kết thúc phân công cũ."); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await API.post("/admin/assignments/unassign", { patientId: entityId(patient), reason: reason.trim(), ...(patient.intake ? { revision: patient.intake.revision } : {}) });
      onSaved?.(response.data); onClose();
    } catch (failure) { setError(errorText(failure, "Chưa kết thúc được phân công cũ.")); }
    finally { lock.current = false; setBusy(false); }
  };
  if (!patient) return null;
  return <div className="admin-modal-backdrop"><section ref={dialog} className="admin-reason-dialog" role="dialog" aria-modal="true" aria-labelledby="legacy-unassign-title" tabIndex={-1}><h2 id="legacy-unassign-title">Kết thúc phân công cũ?</h2><p>{personName(patient)}. Bác sĩ cũ sẽ không còn quyền theo dõi qua phân công này; hồ sơ và lịch sử được giữ nguyên. Việc chọn bác sĩ mới vẫn phải qua tiếp nhận bệnh viện.</p><form onSubmit={submit}><label htmlFor="legacy-unassign-reason">Lý do</label><textarea id="legacy-unassign-reason" value={reason} maxLength={1000} rows={3} onChange={event => setReason(event.target.value)} disabled={busy} />{error && <p role="alert" className="coord-error">{error}</p>}<div className="coord-actions"><button type="button" className="coord-secondary" onClick={onClose} disabled={busy}>Giữ phân công</button><button type="submit" className="coord-danger" disabled={busy || !reason.trim()}>{busy ? "Đang lưu…" : "Kết thúc phân công cũ"}</button></div></form></section></div>;
}
