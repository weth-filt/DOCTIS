import { useCallback, useEffect, useRef, useState } from "react";
import { FaHospital, FaSearch, FaSyncAlt, FaUserMd } from "react-icons/fa";
import API from "../../services/api";
import { entityId, errorText, INTAKE_LABELS, intakeLabel, localDate, personName, verifiedActive } from "./coordinationUtils";
import "../../CSS/coordination.css";
import "../../CSS/hospital-routing.css";

export default function AdminCoordination({ focusIntakeId = "", focusRequestKey = 0, onChanged }) {
  const [intakes, setIntakes] = useState([]);
  const [wards, setWards] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ search: "", wardId: "", status: "" });
  const [hospitalId, setHospitalId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const listVersion = useRef(0);
  const onChangedRef = useRef(onChanged); onChangedRef.current = onChanged;
  const loadList = useCallback(async (values, signal) => {
    const version = ++listVersion.current;
    setLoading(true); setError("");
    try { const response = await API.get("/admin/intakes", { params: values, signal }); if (!signal?.aborted && version === listVersion.current) { setIntakes(response.data?.intakes || []); setHasMore(Boolean(response.data?.hasMore)); setNextCursor(response.data?.nextCursor || null); } }
    catch (failure) { if (!signal?.aborted) setError(errorText(failure, "Chưa tải được danh sách tiếp nhận.")); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  const loadMore = async () => {
    if (loadingMore || !nextCursor) return;
    const version = listVersion.current; setLoadingMore(true);
    try {
      const response = await API.get("/admin/intakes", { params: { ...filters, before: nextCursor } });
      if (version !== listVersion.current) return;
      setIntakes(old => [...old, ...(response.data?.intakes || []).filter(item => !old.some(existing => entityId(existing) === entityId(item)))]);
      setHasMore(Boolean(response.data?.hasMore)); setNextCursor(response.data?.nextCursor || null);
    } catch (failure) { if (version === listVersion.current) setError(errorText(failure, "Chưa tải được hồ sơ cũ hơn.")); }
    finally { setLoadingMore(false); }
  };
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => loadList(filters, controller.signal), 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filters, loadList]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([API.get("/admin/catalog/wards", { signal: controller.signal }), API.get("/admin/catalog/hospitals", { signal: controller.signal })]).then(([wardResponse, hospitalResponse]) => {
      if (!controller.signal.aborted) { setWards(wardResponse.data?.wards || []); setHospitals(hospitalResponse.data?.hospitals || []); }
    }).catch(failure => { if (!controller.signal.aborted) setError(errorText(failure, "Chưa tải được danh mục phường và bệnh viện.")); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!focusIntakeId) return undefined;
    const controller = new AbortController();
    API.get(`/admin/intakes/${encodeURIComponent(focusIntakeId)}`, { signal: controller.signal }).then(response => { if (!controller.signal.aborted) setSelected(response.data?.intake || null); }).catch(failure => { if (!controller.signal.aborted) setError(errorText(failure, "Không mở được hồ sơ từ thông báo.")); });
    return () => controller.abort();
  }, [focusIntakeId, focusRequestKey]);
  const selectedId = entityId(selected);
  const acceptedHospitalId = entityId(selected?.hospital);
  useEffect(() => {
    setHospitalId(acceptedHospitalId); setDoctorId(entityId(selected?.assignedDoctor)); setReason("");
  }, [selectedId, acceptedHospitalId, selected?.revision, selected?.assignedDoctor]);
  useEffect(() => {
    setDoctors([]);
    if (!acceptedHospitalId) return undefined;
    const controller = new AbortController();
    API.get("/admin/assignments/doctors", { params: { hospitalId: acceptedHospitalId }, signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) setDoctors((Array.isArray(response.data) ? response.data : []).filter(doctor => doctor.role === "doctor" && entityId(doctor.hospitalId) === acceptedHospitalId));
    }).catch(failure => { if (!controller.signal.aborted) setError(errorText(failure, "Chưa tải được bác sĩ thuộc bệnh viện.")); });
    return () => controller.abort();
  }, [acceptedHospitalId]);

  const mutate = async (action, payload) => {
    if (lock.current || !selectedId) return;
    if (["accept", "assign"].includes(action) && hospitalId !== acceptedHospitalId) { setError("Lưu bệnh viện đã chọn ở bước 01 trước khi tiếp nhận hoặc phân công bác sĩ."); return; }
    lock.current = true; setBusy(action); setError(""); setNotice("");
    try {
      const response = await API.post(`/admin/intakes/${encodeURIComponent(selectedId)}/${action}`, { ...payload, revision: selected.revision });
      const value = response.data?.intake;
      if (!value) throw new Error("INTAKE_RESPONSE_MISSING");
      setSelected(value); setIntakes(old => old.map(item => entityId(item) === entityId(value) ? value : item));
      setNotice(response.data?.msg || "Đã lưu thay đổi điều phối."); onChangedRef.current?.(value);
    } catch (failure) {
      setError(errorText(failure, "Chưa lưu được thay đổi. Vui lòng thử lại."));
      if (failure.response?.status === 409) {
        try { const response = await API.get(`/admin/intakes/${encodeURIComponent(selectedId)}`); if (response.data?.intake) setSelected(response.data.intake); } catch { /* Keep the conflict feedback visible. */ }
      }
    } finally { lock.current = false; setBusy(""); }
  };
  const eligibleHospitals = hospitals.filter(item => verifiedActive(item) && item.acceptingPatients);
  const selectedPatient = selected?.patient || {};
  const addressReady = Boolean(selectedPatient.address?.trim() && (entityId(selectedPatient.wardId) || entityId(selected?.ward)));
  const patientWardId = entityId(selectedPatient.wardId) || entityId(selected?.ward);
  const sameWardHospitals = eligibleHospitals.filter(item => entityId(item.wardId) === patientWardId);
  const otherHospitals = eligibleHospitals.filter(item => entityId(item.wardId) !== patientWardId);
  const chosenHospital = eligibleHospitals.find(item => entityId(item) === hospitalId);
  const chosenWard = chosenHospital && wards.find(item => entityId(item) === entityId(chosenHospital.wardId));
  const routeUrl = addressReady && chosenHospital ? `https://www.google.com/maps/dir/?api=1&${new URLSearchParams({ origin: [selectedPatient.address, selected.ward?.name, selectedPatient.city || "Đà Nẵng"].filter(Boolean).join(", "), destination: `${chosenHospital.name}, ${chosenHospital.address}, Đà Nẵng` }).toString()}` : "";
  const hospitalSelectionSaved = hospitalId === acceptedHospitalId;
  const recordHospital = event => { event.preventDefault(); if (!addressReady) { setError("Cần bệnh nhân bổ sung địa chỉ và phường trước khi chọn bệnh viện."); return; } if (!eligibleHospitals.some(item => entityId(item) === hospitalId)) { setError("Chọn bệnh viện đã xác minh, đang hoạt động và có tiếp nhận."); return; } mutate("hospital", { hospitalId, reason: reason.trim() }); };
  const assign = event => { event.preventDefault(); const doctor = doctors.find(item => entityId(item) === doctorId); if (!doctor || doctor.role !== "doctor" || entityId(doctor.hospitalId) !== acceptedHospitalId) { setError("Chọn bác sĩ có quyền doctor thuộc đúng bệnh viện đã tiếp nhận."); return; } mutate("assign", { doctorId, reason: reason.trim() }); };

  return <section className="coord-admin-workspace">
    <header className="coord-heading"><div><span className="coord-kicker">TIẾP NHẬN VÀ ĐIỀU PHỐI</span><h2>Từ địa chỉ đến đội ngũ chăm sóc</h2><p>Bệnh viện quyết định bác sĩ phụ trách; admin ghi nhận kết quả tiếp nhận và phân công.</p></div><button type="button" className="coord-secondary" onClick={() => loadList(filters)} disabled={loading}><FaSyncAlt aria-hidden="true" />Cập nhật</button></header>
    {error && <p className="coord-error" role="alert">{error}</p>}{notice && <p className="coord-success" role="status">{notice}</p>}
    <div className="coord-filters"><label><FaSearch aria-hidden="true" /><input aria-label="Tìm hồ sơ tiếp nhận" value={filters.search} onChange={event => setFilters(old => ({ ...old, search: event.target.value }))} placeholder="Tên, email hoặc số liên hệ" /></label><select aria-label="Lọc theo phường" value={filters.wardId} onChange={event => setFilters(old => ({ ...old, wardId: event.target.value }))}><option value="">Tất cả phường</option>{wards.map(ward => <option key={entityId(ward)} value={entityId(ward)}>{ward.name}</option>)}</select><select aria-label="Lọc trạng thái tiếp nhận" value={filters.status} onChange={event => setFilters(old => ({ ...old, status: event.target.value }))}><option value="">Tất cả trạng thái</option>{Object.entries(INTAKE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
    <div className="coord-admin-grid"><aside className="coord-intake-list" aria-label="Danh sách hồ sơ tiếp nhận">{loading && <p role="status">Đang tải hồ sơ…</p>}{!loading && !intakes.length && <p className="coord-empty">Chưa có hồ sơ phù hợp với bộ lọc.</p>}{intakes.map(item => <button type="button" key={entityId(item)} className={entityId(item) === selectedId ? "is-selected" : ""} onClick={() => { if (!busy) { setSelected(item); setError(""); } }} disabled={Boolean(busy)}><strong>{personName(item.patient)}</strong><span>{item.ward?.name || "Chưa xác định phường"}</span><span>{item.patient?.address || "Chưa có địa chỉ chi tiết"}</span><small>{intakeLabel(item.status)}</small><time dateTime={item.createdAt}>{localDate(item.createdAt)}</time></button>)}{hasMore && <button type="button" className="coord-secondary" onClick={loadMore} disabled={loadingMore || loading}>{loadingMore ? "Đang tải…" : "Tải thêm hồ sơ"}</button>}</aside>
    <main className="coord-intake-detail">{!selected ? <div className="coord-empty"><FaHospital aria-hidden="true" /><p>Chọn hồ sơ hoặc mở thông báo để tiếp tục.</p></div> : <>
      <header><div><h3>{personName(selectedPatient)}</h3><p>{selectedPatient.phone || "Chưa có số điện thoại"} · {selectedPatient.email || "Chưa có email"}</p><p>{selectedPatient.address || "Chưa có địa chỉ chi tiết"}, {selected.ward?.name || "Chưa xác định phường"}, {selectedPatient.city || "Chưa xác định thành phố"}</p></div><span className={`coord-status ${selected.status}`}>{intakeLabel(selected.status)}</span></header>
      {!addressReady && <p className="coord-warning">Hồ sơ cũ chưa đủ địa chỉ/phường. Bệnh nhân có thể bổ sung tại “Hồ sơ → Thông tin địa chỉ”, không cần đăng ký lại.</p>}
      <form className="coord-step" onSubmit={recordHospital}><h4><span>01</span> Cập nhật bệnh viện hỗ trợ</h4><p>Đối chiếu địa chỉ bệnh nhân với bệnh viện và đường đi thực tế. Nhóm cùng phường giúp tra cứu, không phải xếp hạng khoảng cách.</p><label>Bệnh viện hỗ trợ<select value={hospitalId} onChange={event => setHospitalId(event.target.value)} disabled={Boolean(busy)}><option value="">Chọn bệnh viện</option>{sameWardHospitals.length > 0 && <optgroup label="Cùng phường bệnh nhân">{sameWardHospitals.map(hospital => <option key={entityId(hospital)} value={entityId(hospital)}>{hospital.name} — {hospital.address}</option>)}</optgroup>}{otherHospitals.length > 0 && <optgroup label="Các phường khác">{otherHospitals.map(hospital => <option key={entityId(hospital)} value={entityId(hospital)}>{hospital.name} — {hospital.address}</option>)}</optgroup>}</select></label>{chosenHospital && <section className="coord-hospital-preview" aria-label="Thông tin bệnh viện đang chọn"><div className="coord-hospital-preview-icon"><FaHospital aria-hidden="true" /></div><div><strong>{chosenHospital.name}</strong><p>{chosenHospital.address}</p><small>{chosenWard?.name ? `Phường ${chosenWard.name} · ` : ""}{chosenHospital.phone}</small>{entityId(chosenHospital.wardId) === patientWardId && <span className="coord-hospital-same-ward">Cùng phường bệnh nhân</span>}{routeUrl && <a href={routeUrl} target="_blank" rel="noopener noreferrer">Xem đường đi từ địa chỉ bệnh nhân ↗</a>}</div></section>}{!eligibleHospitals.length && <p className="coord-warning">Chưa có bệnh viện hợp lệ đang tiếp nhận. Admin mở Danh mục phục vụ → Bệnh viện để đối chiếu và bật tiếp nhận cho cơ sở phù hợp.</p>}<label>Lý do / ghi chú điều phối<textarea value={reason} maxLength={1000} onChange={event => setReason(event.target.value)} rows={2} disabled={Boolean(busy)} /></label>{selected.assignedDoctor && hospitalId !== acceptedHospitalId && <p className="coord-warning">Đổi bệnh viện sẽ kết thúc phân công cũ và đưa hồ sơ về bước chờ tiếp nhận, giữ nguyên lịch sử.</p>}<button className="coord-primary" type="submit" disabled={Boolean(busy) || !addressReady || !hospitalId || hospitalId === acceptedHospitalId}>{busy === "hospital" ? "Đang lưu…" : "Lưu bệnh viện hỗ trợ"}</button></form>
      <section className="coord-step"><h4><span>02</span> Ghi nhận bệnh viện đã tiếp nhận</h4><p>{selected.hospital?.name || "Chưa cập nhật bệnh viện"}. Chỉ xác nhận sau khi bệnh viện thực tế đã tiếp nhận bệnh nhân.</p><button type="button" className="coord-secondary" onClick={() => mutate("accept", { note: reason.trim() })} disabled={Boolean(busy) || !hospitalSelectionSaved || selected.status !== "hospital_selected"}>{busy === "accept" ? "Đang ghi nhận…" : ["accepted", "assigned"].includes(selected.status) ? "Đã ghi nhận tiếp nhận" : "Xác nhận đã tiếp nhận"}</button></section>
      <form className="coord-step" onSubmit={assign}><h4><span>03</span> Ghi nhận bác sĩ do bệnh viện quyết định</h4>{selected.assignedDoctor && <p><FaUserMd aria-hidden="true" /> Bác sĩ đang phụ trách: <strong>{personName(selected.assignedDoctor)}</strong></p>}<label>Bác sĩ thuộc {selected.hospital?.name || "bệnh viện tiếp nhận"}<select value={doctorId} onChange={event => setDoctorId(event.target.value)} disabled={Boolean(busy) || !hospitalSelectionSaved || !["accepted", "assigned"].includes(selected.status)}><option value="">Chọn bác sĩ theo quyết định của bệnh viện</option>{doctors.map(doctor => <option key={entityId(doctor)} value={entityId(doctor)}>{personName(doctor)}</option>)}</select></label>{!hospitalSelectionSaved && <p className="coord-warning">Lưu bệnh viện đã chọn ở bước 01 trước khi ghi nhận bác sĩ phụ trách.</p>}{acceptedHospitalId && !doctors.length && <p className="coord-warning">Chưa có bác sĩ thuộc bệnh viện này. Admin cần cấp quyền bác sĩ và cập nhật bệnh viện trong hồ sơ bác sĩ.</p>}<div className="coord-actions"><button type="submit" className="coord-primary" disabled={Boolean(busy) || !hospitalSelectionSaved || !["accepted", "assigned"].includes(selected.status) || !doctorId || doctorId === entityId(selected.assignedDoctor)}>{busy === "assign" ? "Đang lưu…" : "Ghi nhận phân công"}</button>{selected.assignedDoctor && <button type="button" className="coord-danger" disabled={Boolean(busy)} onClick={() => mutate("unassign", { reason: reason.trim() })}>Gỡ phân công đang hoạt động</button>}</div></form>
      <section className="coord-history"><h4>Lịch sử điều phối</h4>{!selected.history?.length ? <p>Chưa có sự kiện điều phối được cung cấp.</p> : <ol>{selected.history.map((event, index) => <li key={entityId(event) || index}><strong>{event.label || ({ select_hospital: "Cập nhật bệnh viện", accept_patient: "Ghi nhận tiếp nhận", assign_doctor: "Ghi nhận phân công", unassign_doctor: "Kết thúc phân công", update_address: "Cập nhật địa chỉ", complete_legacy_address: "Bổ sung địa chỉ hồ sơ cũ", register: "Đăng ký hỗ trợ", hospital_selected: "Cập nhật bệnh viện", hospital_changed: "Đổi bệnh viện", accepted: "Ghi nhận tiếp nhận", assigned: "Ghi nhận phân công", unassigned: "Kết thúc phân công", address_updated: "Bổ sung địa chỉ", registered: "Đăng ký hỗ trợ" })[event.action || event.type] || "Cập nhật điều phối"}</strong><span>{event.reason || event.note || ""}</span><small>{event.actorId?.fullName || event.actorId?.username || event.actor?.fullName || event.actor?.username || "Người thực hiện được ghi trong hệ thống"} · {localDate(event.at || event.createdAt)}</small></li>)}</ol>}</section>
    </>}</main></div>
  </section>;
}
