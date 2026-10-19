import { useCallback, useEffect, useRef, useState } from "react";
import { FaHospital, FaMapMarkerAlt, FaPhone, FaUserMd } from "react-icons/fa";
import API from "../../services/api";
import { entityId, errorText, intakeLabel, personName } from "./coordinationUtils";
import "../../CSS/coordination.css";

export default function CareTeamPanel({ active = true, refreshKey = 0, onUpdated }) {
  const [data, setData] = useState(null);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ address: "", wardId: "" });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);
  const [wardsLoading, setWardsLoading] = useState(false);
  const lock = useRef(false);
  const dirtyAddress = useRef(false);
  const loadWards = useCallback(async signal => {
    setWardsLoading(true);
    try { const response = await API.get("/public/wards", { signal }); if (!signal?.aborted) setWards(response.data?.wards || []); }
    catch (failure) { if (!signal?.aborted) setError(errorText(failure, "Chưa tải được danh mục phường.")); }
    finally { if (!signal?.aborted) setWardsLoading(false); }
  }, []);
  const load = useCallback(async signal => {
    setLoading(true); setError("");
    try {
      const response = await API.get("/care-team", { signal });
      if (signal?.aborted) return;
      const value = response.data || {};
      setData(value);
      if (!dirtyAddress.current) setForm({ address: value.address?.address || "", wardId: entityId(value.address?.wardId) || entityId(value.address?.ward) });
      if (value.requiresAddressUpdate) {
        setEditingAddress(true); await loadWards(signal);
      }
    } catch (failure) { if (!signal?.aborted) setError(errorText(failure, "Chưa tải được thông tin bệnh viện và bác sĩ phụ trách.")); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [loadWards]);
  useEffect(() => { if (!active) return undefined; const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [active, refreshKey, load]);
  const saveAddress = async event => {
    event.preventDefault();
    if (lock.current) return;
    if (!form.address.trim() || !wards.some(ward => entityId(ward) === form.wardId)) { setError("Vui lòng nhập địa chỉ chi tiết và chọn phường trong danh mục."); return; }
    lock.current = true; setSaving(true); setError(""); setNotice("");
    try {
      const response = await API.patch("/care-team/address", { address: form.address.trim(), wardId: form.wardId, city: "Đà Nẵng" });
      dirtyAddress.current = false; setEditingAddress(false); setData(response.data); setNotice(response.data?.msg || "Đã lưu địa chỉ để admin tiếp tục điều phối."); onUpdated?.(response.data);
    } catch (failure) { setError(errorText(failure, "Chưa lưu được địa chỉ. Bạn hãy thử lại.")); }
    finally { lock.current = false; setSaving(false); }
  };
  const hospital = data?.hospital || data?.intake?.hospital;
  const doctor = data?.doctor || data?.intake?.assignedDoctor;
  const status = data?.status || data?.intake?.status;
  return <section className="coord-panel patient-care-team" hidden={!active}>
    <header className="coord-heading"><div><span className="coord-kicker">KẾT NỐI CHĂM SÓC</span><h2>Bệnh viện và bác sĩ phụ trách</h2><p>Theo dõi thông tin điều phối và kết quả tiếp nhận của bệnh viện.</p></div><FaHospital aria-hidden="true" /></header>
    {error && <p className="coord-error" role="alert">{error}</p>}{notice && <p className="coord-success" role="status">{notice}</p>}
    {loading && !data ? <p role="status">Đang tải thông tin chăm sóc…</p> : data && <>
      <div className="coord-status-line"><span className={`coord-status ${status || "waiting_hospital"}`}>{intakeLabel(status)}</span>{data.legacyAssignment && <small>Phân công từ hồ sơ cũ · admin cần xác minh bệnh viện.</small>}</div>
      {!editingAddress && <div className="coord-status-line"><span>{data.address?.address || "Chưa có địa chỉ"}{typeof data.address?.ward === "string" && data.address.ward ? `, ${data.address.ward}` : data.address?.ward?.name ? `, ${data.address.ward.name}` : ""}</span><button type="button" className="coord-secondary" onClick={() => { setEditingAddress(true); setError(""); if (!wards.length) loadWards(); }}>Cập nhật địa chỉ</button></div>}
      {editingAddress && <form className="coord-address-form" onSubmit={saveAddress}><h3>{data.requiresAddressUpdate ? "Bổ sung" : "Cập nhật"} địa chỉ phục vụ</h3><p>Bạn giữ nguyên tài khoản hiện có. Admin sẽ đối chiếu thông tin địa chỉ được cập nhật.</p><label>Thành phố<input value="Đà Nẵng" readOnly /></label><label>Phường *<select value={form.wardId} onChange={event => { dirtyAddress.current = true; setForm(old => ({ ...old, wardId: event.target.value })); }} disabled={saving || wardsLoading || !wards.length}><option value="">{wardsLoading ? "Đang tải phường…" : "Chọn phường"}</option>{wards.map(ward => <option key={entityId(ward)} value={entityId(ward)}>{ward.name}</option>)}</select></label><label>Địa chỉ chi tiết *<input value={form.address} maxLength={500} onChange={event => { dirtyAddress.current = true; setForm(old => ({ ...old, address: event.target.value })); }} placeholder="Số nhà, tên đường, tổ hoặc khu dân cư" disabled={saving} /></label>{!wardsLoading && !wards.length && <p className="coord-warning">Danh mục phường chưa được cấu hình. Vui lòng liên hệ admin để bổ sung, không cần đăng ký lại.</p>}<div className="coord-actions"><button type="submit" className="coord-primary" disabled={saving || wardsLoading || !wards.length}>{saving ? "Đang lưu…" : "Lưu địa chỉ"}</button>{!data.requiresAddressUpdate && <button type="button" className="coord-secondary" disabled={saving} onClick={() => { dirtyAddress.current = false; setEditingAddress(false); setForm({ address: data.address?.address || "", wardId: entityId(data.address?.wardId) || entityId(data.address?.ward) }); }}>Hủy chỉnh sửa</button>}{!wardsLoading && !wards.length && <button type="button" className="coord-secondary" onClick={() => loadWards()}>Tải lại danh mục phường</button>}</div></form>}
      <div className="coord-care-grid"><article><span className="coord-large-icon"><FaHospital /></span><h3>{hospital?.name || "Chờ cập nhật bệnh viện"}</h3>{hospital ? <><p><FaMapMarkerAlt aria-hidden="true" />{hospital.address || "Admin cần bổ sung địa chỉ bệnh viện."}</p>{hospital.phone && <p><FaPhone aria-hidden="true" /><a href={`tel:${String(hospital.phone).replace(/[^+\d]/g, "")}`}>{hospital.phone}</a></p>}<p className="coord-note">Mang thông tin hồ sơ và giấy tờ cần thiết đến bệnh viện để được tiếp nhận. Thông tin điều phối này chưa phải lịch hẹn khám; bạn xem lịch đã tạo tại mục Lịch hẹn.</p></> : <p>Admin sẽ đối chiếu địa chỉ của bạn và cập nhật bệnh viện phù hợp. Thông báo sẽ được lưu trong tài khoản.</p>}</article>
      <article><span className="coord-large-icon"><FaUserMd /></span><h3>{doctor ? personName(doctor) : "Chờ bác sĩ phụ trách"}</h3>{doctor ? <><p>Bác sĩ phụ trách theo phân công đang được hệ thống ghi nhận.</p>{doctor.phone && <p><FaPhone aria-hidden="true" />{doctor.phone}</p>}</> : <p>{status === "accepted" ? "Bệnh viện đã tiếp nhận. Admin sẽ ghi nhận bác sĩ do bệnh viện quyết định." : "Bác sĩ chỉ được ghi nhận sau khi bệnh viện tiếp nhận và quyết định phân công."}</p>}</article></div>
    </>}
  </section>;
}
