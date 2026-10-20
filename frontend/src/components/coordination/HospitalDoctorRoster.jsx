import { useCallback, useEffect, useRef, useState } from "react";
import { FaHospital, FaMapMarkerAlt, FaUserMd } from "react-icons/fa";
import API from "../../services/api";
import HospitalPicker from "./HospitalPicker";
import { entityId, errorText, hospitalIssues, hospitalMembershipIssues, personName } from "./coordinationUtils";

export default function HospitalDoctorRoster({ hospitals, wards, initialHospitalId = "", reloadKey = 0, onChanged, onManageCatalog }) {
  const [doctors, setDoctors] = useState([]);
  const [wardId, setWardId] = useState("");
  const [hospitalId, setHospitalId] = useState(initialHospitalId);
  const [doctorId, setDoctorId] = useState("");
  const [sameWardOnly, setSameWardOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const loadDoctors = useCallback(async signal => {
    setLoading(true);
    try {
      const response = await API.get("/admin/assignments/doctors", { signal });
      if (!signal?.aborted) setDoctors(Array.isArray(response.data) ? response.data : []);
    } catch (failure) {
      if (!signal?.aborted) setError(errorText(failure, "Chưa tải được danh sách bác sĩ."));
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController(); loadDoctors(controller.signal);
    return () => controller.abort();
  }, [loadDoctors, reloadKey]);

  const hospital = hospitals.find(item => entityId(item) === hospitalId);
  const hospitalWardId = entityId(hospital?.wardId);
  const hospitalWard = wards.find(item => entityId(item) === hospitalWardId);
  const roster = doctors.filter(item => entityId(item.hospitalId) === hospitalId && hospitalId);
  const candidates = doctors.filter(item => item.role === "doctor" && entityId(item.hospitalId) !== hospitalId && (!sameWardOnly || entityId(item.wardId) === hospitalWardId));
  const selectedDoctor = doctors.find(item => entityId(item) === doctorId);
  const membershipIssues = hospitalMembershipIssues(hospital, wards);
  const membershipReady = Boolean(hospital) && membershipIssues.length === 0;
  const hospitalsInWard = hospitals.filter(item => !wardId || entityId(item.wardId) === wardId);
  const save = async event => {
    event.preventDefault();
    if (lock.current || !selectedDoctor || !membershipReady || selectedDoctor.patientCount > 0) return;
    lock.current = true; setSaving(true); setError(""); setNotice("");
    try {
      await API.put(`/admin/doctors/${encodeURIComponent(entityId(selectedDoctor))}`, { hospitalId });
      await loadDoctors(); setDoctorId("");
      setNotice(`Đã cập nhật ${personName(selectedDoctor)} làm việc tại ${hospital.name}.`);
      onChanged?.();
    } catch (failure) { setError(errorText(failure, "Chưa cập nhật được bệnh viện của bác sĩ.")); }
    finally { lock.current = false; setSaving(false); }
  };

  return <section className="coord-team-workspace" aria-label="Bác sĩ và bệnh viện">
    <header className="coord-roster-heading"><div><h3>Bố trí bác sĩ theo bệnh viện</h3><p>Chọn khu vực của bệnh viện, sau đó cập nhật bác sĩ làm việc tại cơ sở đó. Danh sách này được dùng khi phân công bệnh nhân.</p></div>{onManageCatalog && <button type="button" className="coord-secondary" onClick={onManageCatalog} disabled={saving}>Quản lý bệnh viện</button>}</header>
    {error && <p className="coord-error" role="alert">{error}</p>}{notice && <p className="coord-success" role="status">{notice}</p>}
    <div className="coord-roster-selectors"><label>Phường của bệnh viện<select value={wardId} disabled={saving} onChange={event => { setWardId(event.target.value); setHospitalId(""); setDoctorId(""); setError(""); setNotice(""); }}><option value="">Tất cả phường</option>{wards.map(item => <option key={entityId(item)} value={entityId(item)}>{item.name}</option>)}</select></label><HospitalPicker label="Bệnh viện làm việc" mode="membership" hospitals={hospitalsInWard} wards={wards} value={hospitalId} disabled={saving} onChange={nextId => { setHospitalId(nextId); setDoctorId(""); setError(""); setNotice(""); }} /></div>
    {!hospital ? <div className="coord-roster-empty"><FaHospital aria-hidden="true" /><h4>Chọn bệnh viện</h4><p>{hospitalsInWard.length ? "Bạn sẽ thấy bác sĩ đang làm việc tại đây và có thể bổ sung bác sĩ từ hệ thống." : "Chưa có cơ sở trong phường này. Kiểm tra danh mục hoặc chọn phường khác."}</p></div> : <div className="coord-roster-grid">
      <section className="coord-roster-card"><div className="coord-hospital-identity"><span><FaHospital aria-hidden="true" /></span><div><h4>{hospital.name}</h4><p><FaMapMarkerAlt aria-hidden="true" /> {hospitalWard?.name || "Chưa đối chiếu phường"}</p></div></div><p>{hospital.address}</p><div className="coord-readiness-chips">{hospitalIssues(hospital, wards).length ? hospitalIssues(hospital, wards).map(issue => <span key={issue}>{issue}</span>) : <span className="is-ready">Đang tiếp nhận bệnh nhân</span>}</div><h4 className="coord-roster-count">Bác sĩ tại bệnh viện <span>{roster.length}</span></h4>{loading ? <p role="status">Đang tải bác sĩ…</p> : !roster.length ? <p className="coord-roster-empty-text">Chưa có bác sĩ được gắn với bệnh viện này.</p> : <ul className="coord-doctor-list">{roster.map(doctor => <li key={entityId(doctor)}><span className="coord-doctor-avatar"><FaUserMd aria-hidden="true" /></span><div><strong>{personName(doctor)}</strong><small>{doctor.patientCount || 0} bệnh nhân đang phụ trách</small></div></li>)}</ul>}</section>
      <form className="coord-roster-card" onSubmit={save}><h4>Bổ sung bác sĩ làm việc tại đây</h4><p>Tài khoản cần có quyền bác sĩ. Một tài khoản được gắn với một bệnh viện làm việc hiện tại.</p><label className="coord-roster-checkbox"><input type="checkbox" checked={sameWardOnly} disabled={saving} onChange={event => { setSameWardOnly(event.target.checked); setDoctorId(""); }} />Chỉ xem bác sĩ có địa chỉ cùng phường</label><label>Chọn bác sĩ<select value={doctorId} disabled={saving || loading || !membershipReady} onChange={event => setDoctorId(event.target.value)}><option value="">Chọn bác sĩ trong hệ thống</option>{candidates.map(doctor => <option key={entityId(doctor)} value={entityId(doctor)}>{personName(doctor)} — {(doctor.hospital || doctor.hospitalId)?.name || "Chưa có bệnh viện"}</option>)}</select></label>{selectedDoctor && <div className="coord-doctor-selection"><FaUserMd aria-hidden="true" /><div><strong>{personName(selectedDoctor)}</strong><small>Địa chỉ đăng ký: {selectedDoctor.ward?.name || wards.find(item => entityId(item) === entityId(selectedDoctor.wardId))?.name || "Chưa có phường"}</small><small>Đơn vị hiện tại: {(selectedDoctor.hospital || selectedDoctor.hospitalId)?.name || "Chưa bố trí bệnh viện"}</small></div></div>}
      {!membershipReady && <p className="coord-warning">{membershipIssues.join(" · ")}. Hoàn tất thông tin trong danh mục trước khi bố trí bác sĩ.</p>}{!loading && !candidates.length && membershipReady && <p className="coord-warning">Chưa có bác sĩ phù hợp với bộ lọc. Kiểm tra quyền tài khoản tại Người dùng hoặc bỏ lọc cùng phường.</p>}{selectedDoctor?.patientCount > 0 && <p className="coord-warning">Bác sĩ đang có bệnh nhân phụ trách. Cần xử lý các phân công hiện tại trước khi chuyển đơn vị.</p>}
      <p className="coord-roster-footnote">Phường nơi ở giúp lọc danh sách. Admin xác nhận đơn vị làm việc thực tế của bác sĩ trước khi lưu.</p><button type="submit" className="coord-primary" disabled={saving || loading || !doctorId || !membershipReady || Boolean(selectedDoctor?.patientCount > 0)}>{saving ? "Đang cập nhật…" : "Lưu bác sĩ vào bệnh viện"}</button></form>
    </div>}
  </section>;
}
