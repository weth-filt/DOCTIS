import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FaCheck, FaChevronDown, FaHospital, FaMapMarkerAlt, FaSearch, FaTimes, FaUserMd } from "react-icons/fa";
import { entityId, hospitalIssues, hospitalMembershipIssues } from "./coordinationUtils";
import "../../CSS/hospital-picker.css";

const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
export default function HospitalPicker({ hospitals = [], wards = [], value = "", onChange, label = "Bệnh viện tiếp nhận", patientWardId = "", mode = "admission", disabled = false, loading = false, selectedHospital = null }) {
  const id = useId();
  const root = useRef(null), trigger = useRef(null), searchInput = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const selected = hospitals.find(item => entityId(item) === value) || selectedHospital;
  const wardName = hospital => wards.find(ward => entityId(ward) === entityId(hospital?.wardId))?.name || hospital?.ward?.name || "Chờ cập nhật phường";
  const issuesFor = hospital => mode === "membership" ? hospitalMembershipIssues(hospital, wards) : hospitalIssues(hospital, wards);
  const entries = useMemo(() => hospitals.filter(item => item.diabetesCare?.eligible !== false).map(hospital => ({ hospital, issues: mode === "membership" ? hospitalMembershipIssues(hospital, wards) : hospitalIssues(hospital, wards), sameWard: Boolean(patientWardId) && entityId(hospital.wardId) === patientWardId })), [hospitals, wards, mode, patientWardId]);
  const readyCount = entries.filter(item => !item.issues.length).length;
  const sameWardCount = entries.filter(item => item.sameWard).length;
  const visible = entries.filter(item => (filter !== "ready" || !item.issues.length) && (filter !== "ward" || item.sameWard) && normalize([item.hospital.name, item.hospital.address, wardName(item.hospital), item.hospital.diabetesCare?.focus].join(" ")).includes(normalize(search.trim())))
    .sort((a, b) => Number(entityId(b.hospital) === value) - Number(entityId(a.hospital) === value) || Number(a.issues.length > 0) - Number(b.issues.length > 0) || Number(b.sameWard) - Number(a.sameWard) || a.hospital.name.localeCompare(b.hospital.name, "vi"));
  useEffect(() => {
    if (!open) return undefined;
    searchInput.current?.focus();
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => { if (disabled || loading) setOpen(false); }, [disabled, loading]);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const choose = hospital => { onChange?.(entityId(hospital)); close(); };
  return <div className={`hospital-picker ${open ? "is-open" : ""}`} ref={root} onKeyDown={event => { if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); } }} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <span className="hp-field-label" id={`${id}-label`}>{label}</span>
    <button type="button" ref={trigger} className={`hp-trigger ${selected ? "has-selection" : ""}`} aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-controls={`${id}-panel`} disabled={disabled || loading} onClick={() => { setOpen(old => !old); setSearch(""); setFilter("all"); }}>
      <span className="hp-building"><FaHospital aria-hidden="true" /></span><span className="hp-trigger-copy"><strong id={`${id}-value`}>{loading ? "Đang tải bệnh viện…" : selected?.name || "Chọn bệnh viện chăm sóc"}</strong><small>{selected ? wardName(selected) : "Tìm theo tên, địa chỉ hoặc phường"}</small></span><span className="hp-trigger-end">{selected && <span className="hp-selected-mark"><FaCheck aria-hidden="true" /></span>}<FaChevronDown aria-hidden="true" /></span>
    </button>
    {open && <section className="hp-panel" id={`${id}-panel`} aria-label="Chọn bệnh viện chăm sóc đái tháo đường">
      <header className="hp-panel-head"><div><span className="hp-eyebrow">MẠNG LƯỚI CHĂM SÓC</span><h5>Bệnh viện điều trị đái tháo đường</h5><p>{entries.length} cơ sở trong danh sách đã chọn <span>·</span> {readyCount} {mode === "membership" ? "có thể bố trí bác sĩ" : "đang tiếp nhận"}</p></div><button type="button" className="hp-close" aria-label="Đóng danh sách bệnh viện" onClick={close}><FaTimes aria-hidden="true" /></button></header>
      <div className="hp-search"><FaSearch aria-hidden="true" /><input ref={searchInput} value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm bệnh viện, địa chỉ, phường…" aria-label="Tìm bệnh viện" autoComplete="off" onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); if (event.key === "ArrowDown") { event.preventDefault(); root.current?.querySelector(".hp-card:not(:disabled)")?.focus(); } }} />{search && <button type="button" aria-label="Xóa từ khóa" onClick={() => { setSearch(""); searchInput.current?.focus(); }}><FaTimes aria-hidden="true" /></button>}</div>
      <div className="hp-filters" role="group" aria-label="Lọc bệnh viện">{[["all", "Tất cả", entries.length], ["ready", mode === "membership" ? "Sẵn sàng" : "Đang tiếp nhận", readyCount], ...(patientWardId ? [["ward", "Cùng phường", sameWardCount]] : [])].map(([key, text, count]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{text}<span>{count}</span></button>)}</div>
      <div className="hp-results" aria-live="polite">{!visible.length ? <div className="hp-empty"><FaHospital aria-hidden="true" /><strong>Chưa có bệnh viện phù hợp</strong><p>Thử tên khác hoặc đổi bộ lọc.</p></div> : visible.map(({ hospital, issues, sameWard }) => {
        const chosen = entityId(hospital) === value;
        const blocked = issues.length > 0;
        const status = !blocked ? mode === "membership" ? "Có thể bố trí bác sĩ" : "Đang tiếp nhận" : !hospital.verified || !entityId(hospital.wardId) ? "Cần hoàn thiện thông tin" : "Chưa bật tiếp nhận";
        return <button type="button" className={`hp-card ${chosen ? "is-selected" : ""} ${blocked ? "is-unavailable" : ""}`} key={entityId(hospital)} aria-pressed={chosen} disabled={blocked} title={blocked ? issues.join(" ") : `Chọn ${hospital.name}`} onClick={() => choose(hospital)}>
          <span className="hp-card-icon"><FaHospital aria-hidden="true" /></span><span className="hp-card-body"><span className="hp-card-top"><small>{hospital.diabetesCare?.groupLabel || "Bệnh viện"}</small>{sameWard && <span className="hp-nearby">Cùng phường</span>}</span><strong>{hospital.name}</strong><span className="hp-address"><FaMapMarkerAlt aria-hidden="true" />{hospital.address || "Chờ cập nhật địa chỉ"}</span><span className="hp-specialty">{hospital.diabetesCare?.focus || "Chăm sóc đái tháo đường type 2"}{hospital.diabetesCare?.population === "pregnancy" && <em>Dành cho thai phụ</em>}</span><span className="hp-card-bottom"><span className={`hp-state ${blocked ? "is-pending" : "is-ready"}`}><i />{status}</span><span className="hp-doctors"><FaUserMd aria-hidden="true" />{hospital.doctorCount || 0} bác sĩ</span></span>{blocked && <span className="hp-issue">{issues.join(" ")}</span>}</span><span className="hp-radio" aria-hidden="true">{chosen && <FaCheck />}</span>
        </button>;
      })}</div>
      <footer className="hp-panel-foot"><span>{visible.length} bệnh viện hiển thị</span><span>Thông tin tiếp nhận do admin cập nhật</span></footer>
    </section>}
    {selected && !open && <div className="hp-selected-detail"><span>{selected.diabetesCare?.focus || "Chăm sóc đái tháo đường type 2"}</span><span className={issuesFor(selected).length ? "is-pending" : "is-ready"}>{issuesFor(selected).length ? "Cần kiểm tra điều kiện" : mode === "membership" ? "Sẵn sàng bố trí" : "Đang tiếp nhận"}</span></div>}
  </div>;
}
