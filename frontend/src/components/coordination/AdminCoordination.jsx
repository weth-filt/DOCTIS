import { useCallback, useEffect, useRef, useState } from "react";
import { FaCheck, FaHospital, FaMapMarkerAlt, FaSearch, FaSyncAlt, FaUserMd } from "react-icons/fa";
import API from "../../services/api";
import HospitalDoctorRoster from "./HospitalDoctorRoster";
import HospitalPicker from "./HospitalPicker";
import { entityId, errorText, hospitalReady, INTAKE_LABELS, intakeLabel, localDate, personName } from "./coordinationUtils";
import "../../CSS/coordination.css";
import "../../CSS/hospital-routing.css";
import "../../CSS/coordination-workspace.css";

const assigned = intake => Boolean(intake?.queueStatus === "assigned" || intake?.status === "assigned" || intake?.activeAssignment || intake?.assignedDoctor);
const queueParams = (filters, scope) => ({ ...filters, queue: scope === "assigned" ? "assigned" : "open" });
const eventLabels = { unassign_legacy_doctor_reference: "Kết thúc tham chiếu bác sĩ cũ", select_hospital: "Chọn bệnh viện", accept_patient: "Ghi nhận tiếp nhận", assign_doctor: "Phân công bác sĩ", unassign_doctor: "Kết thúc phân công", update_address: "Cập nhật địa chỉ", complete_legacy_address: "Bổ sung địa chỉ hồ sơ cũ", register: "Đăng ký hỗ trợ", hospital_selected: "Chọn bệnh viện", hospital_changed: "Đổi bệnh viện", accepted: "Ghi nhận tiếp nhận", assigned: "Phân công bác sĩ", unassigned: "Kết thúc phân công", address_updated: "Bổ sung địa chỉ", registered: "Đăng ký hỗ trợ" };

export default function AdminCoordination({ focusIntakeId = "", focusRequestKey = 0, reloadKey = 0, onChanged, onManageCatalog }) {
  const [scope, setScope] = useState("open");
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
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rosterVersion, setRosterVersion] = useState(0);
  const lock = useRef(false);
  const listVersion = useRef(0);
  const onChangedRef = useRef(onChanged); onChangedRef.current = onChanged;
  const loadList = useCallback(async (values, signal) => {
    const version = ++listVersion.current; setLoading(true);
    try {
      const response = await API.get("/admin/intakes", { params: values, signal });
      if (!signal?.aborted && version === listVersion.current) {
        setIntakes(response.data?.intakes || []); setHasMore(Boolean(response.data?.hasMore)); setNextCursor(response.data?.nextCursor || null);
      }
    } catch (failure) { if (!signal?.aborted && version === listVersion.current) setError(errorText(failure, "Chưa tải được danh sách điều phối.")); }
    finally { if (!signal?.aborted && version === listVersion.current) setLoading(false); }
  }, []);
  const loadCatalog = useCallback(async signal => {
    setCatalogLoading(true);
    try {
      const [wardResponse, hospitalResponse] = await Promise.all([API.get("/admin/catalog/wards", { signal }), API.get("/admin/catalog/hospitals", { signal })]);
      if (!signal?.aborted) { setWards(wardResponse.data?.wards || []); setHospitals(hospitalResponse.data?.hospitals || []); }
    } catch (failure) { if (!signal?.aborted) setError(errorText(failure, "Chưa tải được danh mục phường và bệnh viện.")); }
    finally { if (!signal?.aborted) setCatalogLoading(false); }
  }, []);
  const loadMore = async () => {
    if (loadingMore || !nextCursor) return;
    const version = listVersion.current; setLoadingMore(true);
    try {
      const response = await API.get("/admin/intakes", { params: { ...queueParams(filters, scope), before: nextCursor } });
      if (version !== listVersion.current) return;
      setIntakes(old => [...old, ...(response.data?.intakes || []).filter(item => !old.some(existing => entityId(existing) === entityId(item)))]);
      setHasMore(Boolean(response.data?.hasMore)); setNextCursor(response.data?.nextCursor || null);
    } catch (failure) { if (version === listVersion.current) setError(errorText(failure, "Chưa tải được hồ sơ cũ hơn.")); }
    finally { setLoadingMore(false); }
  };
  useEffect(() => {
    if (scope === "team") { setLoading(false); return undefined; }
    const controller = new AbortController();
    const timer = setTimeout(() => loadList(queueParams(filters, scope), controller.signal), 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filters, scope, loadList, reloadKey]);
  useEffect(() => {
    const controller = new AbortController(); loadCatalog(controller.signal);
    return () => controller.abort();
  }, [loadCatalog, reloadKey]);
  useEffect(() => {
    if (!focusIntakeId) return undefined;
    const controller = new AbortController();
    API.get(`/admin/intakes/${encodeURIComponent(focusIntakeId)}`, { signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) {
        const intake = response.data?.intake || null; setSelected(intake); setScope(assigned(intake) ? "assigned" : "open"); setFilters(old => ({ ...old, status: "" }));
      }
    }).catch(failure => { if (!controller.signal.aborted) setError(errorText(failure, "Không mở được hồ sơ điều phối.")); });
    return () => controller.abort();
  }, [focusIntakeId, focusRequestKey]);

  const selectedId = entityId(selected);
  const acceptedHospitalId = entityId(selected?.hospital);
  const currentDoctorId = entityId(selected?.assignedDoctor);
  useEffect(() => { setHospitalId(acceptedHospitalId); setDoctorId(currentDoctorId); setReason(""); }, [selectedId, acceptedHospitalId, currentDoctorId, selected?.revision]);
  useEffect(() => {
    setDoctors([]);
    if (!hospitalId) { setDoctorsLoading(false); return undefined; }
    const controller = new AbortController(); setDoctorsLoading(true);
    API.get("/admin/assignments/doctors", { params: { hospitalId }, signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) setDoctors((Array.isArray(response.data) ? response.data : []).filter(doctor => doctor.role === "doctor" && entityId(doctor.hospitalId) === hospitalId));
    }).catch(failure => { if (!controller.signal.aborted) setError(errorText(failure, "Chưa tải được bác sĩ thuộc bệnh viện.")); })
      .finally(() => { if (!controller.signal.aborted) setDoctorsLoading(false); });
    return () => controller.abort();
  }, [hospitalId, reloadKey, scope, rosterVersion]);

  const mutate = async (action, payload) => {
    if (lock.current || !selectedId) return;
    if (["accept", "assign"].includes(action) && hospitalId !== acceptedHospitalId) { setError("Lưu bệnh viện ở bước 01 trước khi tiếp nhận hoặc phân công bác sĩ."); return; }
    lock.current = true; setBusy(action); setError(""); setNotice("");
    try {
      const response = await API.post(`/admin/intakes/${encodeURIComponent(selectedId)}/${action}`, { ...payload, revision: selected.revision });
      const value = response.data?.intake;
      if (!value) throw new Error("INTAKE_RESPONSE_MISSING");
      const nextScope = assigned(value) ? "assigned" : "open";
      const nextFilters = { ...filters, status: "" };
      setSelected(value); setScope(nextScope); setFilters(nextFilters);
      setNotice(response.data?.msg || "Đã lưu thay đổi điều phối.");
      await loadList(queueParams(nextFilters, nextScope)); onChangedRef.current?.(value);
    } catch (failure) {
      setError(errorText(failure, "Chưa lưu được thay đổi. Vui lòng thử lại."));
      if (failure.response?.status === 409) {
        try { const response = await API.get(`/admin/intakes/${encodeURIComponent(selectedId)}`); if (response.data?.intake) setSelected(response.data.intake); } catch { /* Preserve conflict feedback. */ }
      }
    } finally { lock.current = false; setBusy(""); }
  };
  const selectedPatient = selected?.patient || {};
  const patientWardId = entityId(selectedPatient.wardId) || entityId(selected?.ward);
  const patientWard = wards.find(item => entityId(item) === patientWardId) || selected?.ward;
  const addressReady = Boolean(selectedPatient.address?.trim() && patientWardId);
  const eligibleHospitals = hospitals.filter(item => hospitalReady(item, wards));
  const chosenHospital = hospitals.find(item => entityId(item) === hospitalId) || (hospitalId === acceptedHospitalId ? selected?.hospital : null);
  const chosenWard = wards.find(item => entityId(item) === entityId(chosenHospital?.wardId)) || chosenHospital?.ward;
  const routeUrl = addressReady && chosenHospital ? `https://www.google.com/maps/dir/?api=1&${new URLSearchParams({ origin: [selectedPatient.address, patientWard?.name, selectedPatient.city || "Đà Nẵng"].filter(Boolean).join(", "), destination: `${chosenHospital.name}, ${chosenHospital.address}, Đà Nẵng` }).toString()}` : "";
  const hospitalSelectionSaved = Boolean(hospitalId) && hospitalId === acceptedHospitalId;
  const hasAssignedDoctor = Boolean(selected?.assignedDoctor);
  const displayStatus = hasAssignedDoctor ? "assigned" : selected?.status;
  const recordHospital = event => {
    event.preventDefault();
    if (!addressReady) { setError("Cần bệnh nhân bổ sung địa chỉ và phường trước khi chọn bệnh viện."); return; }
    if (!eligibleHospitals.some(item => entityId(item) === hospitalId)) { setError("Chọn bệnh viện đã đối chiếu, đang hoạt động và có tiếp nhận."); return; }
    mutate("hospital", { hospitalId, reason: reason.trim() });
  };
  const assignDoctor = event => {
    event.preventDefault();
    const doctor = doctors.find(item => entityId(item) === doctorId);
    if (!doctor || doctor.role !== "doctor" || entityId(doctor.hospitalId) !== acceptedHospitalId) { setError("Chọn bác sĩ thuộc đúng bệnh viện đã tiếp nhận."); return; }
    mutate("assign", { doctorId, reason: reason.trim() });
  };
  const changeScope = next => {
    if (busy || scope === next) return;
    const keepPatient = next === "team" || (scope === "team" && selected && next === (assigned(selected) ? "assigned" : "open"));
    setScope(next); if (!keepPatient) setSelected(null);
    setIntakes([]); setFilters(old => ({ ...old, status: "" })); setError(""); setNotice("");
  };
  const refresh = () => { loadCatalog(); setRosterVersion(old => old + 1); if (scope !== "team") loadList(queueParams(filters, scope)); };

  return <section className="coord-admin-workspace coord-workflow">
    <header className="coord-heading"><div><span className="coord-kicker">MẠNG LƯỚI CHĂM SÓC</span><h2>Điều phối bệnh viện & bác sĩ</h2><p>Bố trí bác sĩ tại bệnh viện, chọn cơ sở phù hợp với địa chỉ bệnh nhân và phân công người phụ trách.</p></div><button type="button" className="coord-secondary" onClick={refresh} disabled={loading || catalogLoading || Boolean(busy)}><FaSyncAlt aria-hidden="true" />Cập nhật</button></header>
    <div className="coord-workflow-tabs" role="tablist" aria-label="Luồng điều phối">{[["open", "Chờ điều phối"], ["assigned", "Đã phân công"], ["team", "Bác sĩ & bệnh viện"]].map(([value, label]) => <button type="button" role="tab" key={value} aria-selected={scope === value} disabled={Boolean(busy)} onClick={() => changeScope(value)}>{label}</button>)}</div>
    {error && <p className="coord-error" role="alert">{error}</p>}{notice && <p className="coord-success" role="status">{notice}</p>}
    {scope === "team" ? <>{selected && <div className="coord-return-patient"><span>Hồ sơ đang xử lý: <strong>{personName(selected.patient)}</strong></span><button type="button" className="coord-secondary" onClick={() => changeScope(assigned(selected) ? "assigned" : "open")}>Tiếp tục phân công bệnh nhân</button></div>}<HospitalDoctorRoster hospitals={hospitals} wards={wards} initialHospitalId={hospitalId} reloadKey={`${reloadKey}-${rosterVersion}`} onManageCatalog={onManageCatalog} onChanged={() => { loadCatalog(); setRosterVersion(old => old + 1); onChangedRef.current?.(); }} /></> : <>
      <div className="coord-network-status"><FaHospital aria-hidden="true" /><div><strong>{catalogLoading ? "Đang tải bệnh viện…" : `${eligibleHospitals.length} / ${hospitals.length} cơ sở đang sẵn sàng tiếp nhận`}</strong><span>Bệnh viện chưa đủ điều kiện vẫn được hiển thị để admin đối chiếu.</span></div>{onManageCatalog && <button type="button" className="coord-secondary" onClick={onManageCatalog}>Mở danh mục bệnh viện</button>}</div>
      <div className="coord-filters"><label><FaSearch aria-hidden="true" /><input aria-label="Tìm hồ sơ điều phối" value={filters.search} onChange={event => setFilters(old => ({ ...old, search: event.target.value }))} placeholder="Tên, email hoặc số liên hệ" /></label><select aria-label="Lọc theo phường" value={filters.wardId} onChange={event => setFilters(old => ({ ...old, wardId: event.target.value }))}><option value="">Tất cả phường</option>{wards.map(ward => <option key={entityId(ward)} value={entityId(ward)}>{ward.name}</option>)}</select><select aria-label="Lọc trạng thái tiếp nhận" value={filters.status} onChange={event => setFilters(old => ({ ...old, status: event.target.value }))} disabled={scope === "assigned"}><option value="">{scope === "assigned" ? "Đã có bác sĩ phụ trách" : "Tất cả bước đang chờ"}</option>{Object.entries(INTAKE_LABELS).filter(([key]) => key !== "assigned").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      <div className="coord-admin-grid"><aside className="coord-intake-list" aria-label="Danh sách hồ sơ điều phối"><div className="coord-list-heading"><strong>{scope === "assigned" ? "Đang được chăm sóc" : "Cần xử lý"}</strong><span>{intakes.length}{hasMore ? "+" : ""}</span></div>{loading && <p role="status">Đang tải hồ sơ…</p>}{!loading && !intakes.length && <p className="coord-empty">{scope === "open" ? "Không có bệnh nhân chờ theo bộ lọc. Người đã có bác sĩ nằm tại Đã phân công." : "Chưa có hồ sơ đã phân công phù hợp."}</p>}{intakes.map(item => <button type="button" key={entityId(item)} className={entityId(item) === selectedId ? "is-selected" : ""} onClick={() => { if (!busy) { setSelected(item); setError(""); } }} disabled={Boolean(busy)}><strong>{personName(item.patient)}</strong><span><FaMapMarkerAlt aria-hidden="true" /> {item.ward?.name || "Chưa xác định phường"}</span><small className="coord-list-status">{item.needsReconciliation ? "Cần đối chiếu phân công" : intakeLabel(assigned(item) ? "assigned" : item.status)}</small>{item.hospital?.name && <span className="coord-list-hospital"><FaHospital aria-hidden="true" />{item.hospital.name}</span>}{item.assignedDoctor && <span className="coord-list-hospital"><FaUserMd aria-hidden="true" />{personName(item.assignedDoctor)}</span>}<time dateTime={item.createdAt}>{localDate(item.createdAt)}</time></button>)}{hasMore && <button type="button" className="coord-secondary" onClick={loadMore} disabled={loadingMore || loading}>{loadingMore ? "Đang tải…" : "Tải thêm hồ sơ"}</button>}</aside>
        <main className="coord-intake-detail">{!selected ? <div className="coord-empty coord-detail-empty"><FaHospital aria-hidden="true" /><h3>Chọn hồ sơ bệnh nhân</h3><p>Bệnh viện được gợi ý theo phường. Sau khi ghi nhận tiếp nhận, bạn chỉ chọn được bác sĩ làm việc tại bệnh viện đó.</p><button type="button" className="coord-secondary" onClick={() => changeScope("team")}>Bố trí bác sĩ vào bệnh viện</button></div> : <>
          <header><div><h3>{personName(selectedPatient)}</h3><p>{selectedPatient.phone || "Chưa có số điện thoại"} · {selectedPatient.email || "Chưa có email"}</p><p><FaMapMarkerAlt aria-hidden="true" /> {[selectedPatient.address, patientWard?.name, selectedPatient.city || "Đà Nẵng"].filter(Boolean).join(", ")}</p></div><span className={`coord-status ${displayStatus}`}>{selected.needsReconciliation ? "Cần đối chiếu phân công" : intakeLabel(displayStatus)}</span></header>
          <div className="coord-current-team"><div><span className="coord-summary-icon"><FaHospital aria-hidden="true" /></span><div><small>BỆNH VIỆN PHỤ TRÁCH</small><strong>{selected.hospital?.name || "Chưa chọn bệnh viện"}</strong></div></div><div><span className="coord-summary-icon"><FaUserMd aria-hidden="true" /></span><div><small>BÁC SĨ PHỤ TRÁCH</small><strong>{selected.assignedDoctor ? personName(selected.assignedDoctor) : "Chờ phân công bác sĩ"}</strong></div></div></div>
          {hasAssignedDoctor && <p className="coord-success"><FaCheck aria-hidden="true" /> Bệnh nhân đã có bác sĩ phụ trách và được tách khỏi hàng chờ điều phối.</p>}
          {(selected.legacyAssignment || selected.needsReconciliation) && <p className="coord-warning">Phân công hiện có cần được đối chiếu với bệnh viện và hồ sơ tiếp nhận. Thông tin cũ được giữ cho đến khi admin ghi nhận thay đổi.</p>}
          {!addressReady && <p className="coord-warning">Cần bổ sung địa chỉ/phường tại “Hồ sơ → Thông tin địa chỉ” trước khi chọn bệnh viện.</p>}
          <ol className="coord-stepper" aria-label="Tiến trình điều phối">{[["Chọn bệnh viện", Boolean(acceptedHospitalId)], ["Ghi nhận tiếp nhận", Boolean(selected.acceptedAt) && ["accepted", "assigned"].includes(selected.status)], ["Phân công bác sĩ", hasAssignedDoctor]].map(([label, complete], index) => <li key={label} className={complete ? "is-complete" : ""}><span>{complete ? <FaCheck aria-hidden="true" /> : `0${index + 1}`}</span>{label}</li>)}</ol>
          <form className="coord-step" onSubmit={recordHospital}><h4><span>01</span> Chọn bệnh viện phù hợp</h4><p>Ưu tiên cơ sở cùng phường {patientWard?.name || "với bệnh nhân"}. Đối chiếu địa chỉ và đường đi trước khi lưu.</p>
            <HospitalPicker hospitals={hospitals} wards={wards} value={hospitalId} selectedHospital={chosenHospital} patientWardId={patientWardId} disabled={Boolean(busy)} loading={catalogLoading} onChange={nextId => { setHospitalId(nextId); setDoctorId(""); }} />
            {chosenHospital && <section className="coord-hospital-preview" aria-label="Thông tin bệnh viện đang chọn"><div className="coord-hospital-preview-icon"><FaHospital aria-hidden="true" /></div><div><strong>{chosenHospital.name}</strong><p>{chosenHospital.address}</p><small>{chosenWard?.name ? `Phường ${chosenWard.name}` : "Chưa có phường"}{chosenHospital.phone ? ` · ${chosenHospital.phone}` : ""}</small><div className="coord-readiness-chips">{entityId(chosenHospital.wardId) === patientWardId && <span className="is-ready">Cùng phường bệnh nhân</span>}<span>{doctorsLoading ? "Đang tải đội ngũ…" : `${doctors.length} bác sĩ tại bệnh viện`}</span></div>{routeUrl && <a href={routeUrl} target="_blank" rel="noopener noreferrer">Mở đường đi để đối chiếu ↗</a>}</div></section>}
            {!catalogLoading && !eligibleHospitals.length && <p className="coord-warning">Đã tải {hospitals.length} cơ sở, hiện chưa có cơ sở đủ điều kiện tiếp nhận. Mở Danh mục bệnh viện để bổ sung phường, đối chiếu và bật tiếp nhận.</p>}
            <label>Ghi chú điều phối<textarea value={reason} maxLength={1000} onChange={event => setReason(event.target.value)} rows={2} disabled={Boolean(busy)} placeholder="Lý do chọn cơ sở, thông tin cần bàn giao…" /></label>
            {selected.assignedDoctor && hospitalId !== acceptedHospitalId && <p className="coord-warning">Đổi bệnh viện sẽ kết thúc phân công cũ và đưa hồ sơ về bước chờ tiếp nhận. Lịch sử được giữ nguyên.</p>}
            <button className="coord-primary" type="submit" disabled={Boolean(busy) || !addressReady || !hospitalReady(chosenHospital, wards) || hospitalId === acceptedHospitalId}>{busy === "hospital" ? "Đang lưu…" : "Lưu bệnh viện đã chọn"}</button>
          </form>
          <section className="coord-step"><h4><span>02</span> Ghi nhận bệnh viện tiếp nhận</h4><p>{selected.hospital?.name || "Chưa chọn bệnh viện"}. Xác nhận khi bệnh viện thực tế đã tiếp nhận bệnh nhân.</p><button type="button" className="coord-secondary" onClick={() => mutate("accept", { note: reason.trim() })} disabled={Boolean(busy) || !hospitalSelectionSaved || selected.status !== "hospital_selected"}>{busy === "accept" ? "Đang ghi nhận…" : ["accepted", "assigned"].includes(selected.status) ? "Đã ghi nhận tiếp nhận" : "Xác nhận đã tiếp nhận"}</button></section>
          <form className="coord-step" onSubmit={assignDoctor}><h4><span>03</span> Phân công bác sĩ tại bệnh viện</h4><label>Bác sĩ thuộc {selected.hospital?.name || "bệnh viện tiếp nhận"}<select value={doctorId} onChange={event => setDoctorId(event.target.value)} disabled={Boolean(busy) || doctorsLoading || !hospitalSelectionSaved || !["accepted", "assigned"].includes(selected.status)}><option value="">Chọn bác sĩ phụ trách bệnh nhân</option>{doctors.map(doctor => <option key={entityId(doctor)} value={entityId(doctor)}>{personName(doctor)} · {doctor.patientCount || 0} bệnh nhân</option>)}</select></label>
            {!hospitalSelectionSaved && <p className="coord-warning">Lưu bệnh viện ở bước 01 trước khi ghi nhận bác sĩ phụ trách.</p>}
            {hospitalId && !doctorsLoading && !doctors.length && <div className="coord-roster-prompt"><p>Chưa có bác sĩ làm việc tại bệnh viện đang chọn.</p><button type="button" className="coord-secondary" onClick={() => changeScope("team")} disabled={Boolean(busy)}>Mở Bác sĩ & bệnh viện</button></div>}
            <div className="coord-actions"><button type="submit" className="coord-primary" disabled={Boolean(busy) || !hospitalSelectionSaved || !["accepted", "assigned"].includes(selected.status) || !doctorId || doctorId === currentDoctorId}>{busy === "assign" ? "Đang lưu…" : "Lưu bác sĩ phụ trách"}</button>{(selected.assignedDoctor || selected.needsReconciliation) && <button type="button" className="coord-danger" disabled={Boolean(busy)} onClick={() => mutate("unassign", { reason: reason.trim() })}>Kết thúc phân công</button>}</div>
          </form>
          <section className="coord-history"><h4>Lịch sử điều phối</h4>{!selected.history?.length ? <p>Chưa có sự kiện điều phối.</p> : <ol>{selected.history.map((event, index) => <li key={entityId(event) || index}><strong>{event.label || eventLabels[event.action || event.type] || "Cập nhật điều phối"}</strong><span>{event.reason || event.note || ""}</span><small>{event.actorId?.fullName || event.actorId?.username || event.actor?.fullName || event.actor?.username || "Người thực hiện được ghi trong hệ thống"} · {localDate(event.at || event.createdAt)}</small></li>)}</ol>}</section>
        </>}</main>
      </div>
    </>}
  </section>;
}
