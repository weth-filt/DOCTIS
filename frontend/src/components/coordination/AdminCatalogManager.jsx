import { useCallback, useEffect, useRef, useState } from "react";
import API from "../../services/api";
import { entityId, errorText, validSource } from "./coordinationUtils";
import "../../CSS/coordination.css";

const blankWard = () => ({ code: "", name: "", city: "Đà Nẵng", sourceUrl: "", verified: false, active: true });
const blankHospital = () => ({ name: "", address: "", wardId: "", phone: "", acceptingPatients: false, sourceUrl: "", verified: false, active: true });
export default function AdminCatalogManager({ onChanged }) {
  const [tab, setTab] = useState("wards");
  const [wards, setWards] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankWard);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const load = useCallback(async signal => {
    setLoading(true); setError("");
    try {
      const [wardResponse, hospitalResponse] = await Promise.all([API.get("/admin/catalog/wards", { signal }), API.get("/admin/catalog/hospitals", { signal })]);
      if (!signal?.aborted) { setWards(wardResponse.data?.wards || []); setHospitals(hospitalResponse.data?.hospitals || []); }
    } catch (failure) { if (!signal?.aborted) setError(errorText(failure, "Chưa tải được danh mục.")); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);
  const start = (kind, item = null) => { if (saving) return; setTab(kind); setEditing(item); setForm(item ? { ...(kind === "wards" ? blankWard() : blankHospital()), ...item, wardId: entityId(item.wardId) } : kind === "wards" ? blankWard() : blankHospital()); setError(""); setNotice(""); };
  const change = event => { const { name, value, type, checked } = event.target; setForm(old => ({ ...old, [name]: type === "checkbox" ? checked : value, ...(tab === "hospitals" && name === "verified" && !checked ? { acceptingPatients: false } : {}) })); };
  const save = async event => {
    event.preventDefault(); if (lock.current) return;
    if (!form.name.trim() || !validSource(form.sourceUrl)) { setError("Nhập tên và đường dẫn nguồn HTTPS để lưu danh mục."); return; }
    if (tab === "wards" && !form.verified) { setError("Cần đối chiếu dữ liệu phường với nguồn chính thức trước khi lưu."); return; }
    if (tab === "wards" && !form.code.trim()) { setError("Phường cần mã danh mục chính thức."); return; }
    if (tab === "hospitals" && (!form.address.trim() || (form.verified && (!form.wardId || !form.phone.trim())))) { setError(form.verified ? "Cần địa chỉ, phường hiện tại và số liên hệ trước khi xác minh bệnh viện." : "Cần địa chỉ bệnh viện theo nguồn để lưu bản chờ đối chiếu."); return; }
    lock.current = true; setSaving(true); setError(""); setNotice("");
    const payload = tab === "wards" ? { code: form.code.trim(), name: form.name.trim(), city: "Đà Nẵng", sourceUrl: form.sourceUrl.trim(), verified: form.verified, active: form.active }
      : { name: form.name.trim(), address: form.address.trim(), wardId: form.wardId || null, phone: form.phone.trim(), acceptingPatients: Boolean(form.verified && form.acceptingPatients), sourceUrl: form.sourceUrl.trim(), verified: form.verified, active: form.active };
    try {
      if (editing) await API.patch(`/admin/catalog/${tab}/${encodeURIComponent(entityId(editing))}`, { ...payload, revision: editing.revision });
      else await API.post(`/admin/catalog/${tab}`, payload);
      await load(); setEditing(null); setForm(tab === "wards" ? blankWard() : blankHospital()); setNotice(form.verified ? "Đã lưu danh mục đã đối chiếu." : "Đã lưu cơ sở chờ đối chiếu; chưa dùng để điều phối bệnh nhân."); onChanged?.();
    } catch (failure) { setError(errorText(failure, "Chưa lưu được danh mục. Hãy kiểm tra dữ liệu và thử lại.")); }
    finally { lock.current = false; setSaving(false); }
  };
  return <section className="coord-panel coord-catalog"><header className="coord-heading"><div><span className="coord-kicker">DỮ LIỆU DÙNG CHUNG</span><h2>Danh mục phường và bệnh viện</h2><p>Cơ sở lấy từ nguồn tham khảo được lưu để đối chiếu. Xác minh thông tin và bật tiếp nhận trước khi điều phối bệnh nhân.</p></div></header><div className="coord-tabs" role="tablist" aria-label="Danh mục"><button type="button" role="tab" aria-selected={tab === "wards"} onClick={() => start("wards")} disabled={saving}>Phường tại Đà Nẵng</button><button type="button" role="tab" aria-selected={tab === "hospitals"} onClick={() => start("hospitals")} disabled={saving}>Bệnh viện</button></div>
    {error && <p className="coord-error" role="alert">{error}</p>}{notice && <p className="coord-success" role="status">{notice}</p>}
    <div className="coord-catalog-grid"><section><h3>{tab === "wards" ? "Phường đã cấu hình" : "Bệnh viện đã cấu hình"}</h3>{loading && <p role="status">Đang tải danh mục…</p>}{!(tab === "wards" ? wards : hospitals).length && !loading && <p className="coord-empty">Chưa có dữ liệu. Nhập thông tin từ nguồn chính thức ở biểu mẫu bên cạnh.</p>}<div className="coord-catalog-list">{(tab === "wards" ? wards : hospitals).map(item => <button key={entityId(item)} type="button" onClick={() => start(tab, item)} disabled={saving}><strong>{item.name}</strong><span>{tab === "wards" ? item.code : item.address}</span><small>{item.active === false ? "Ngừng sử dụng" : item.verified ? "Đã xác minh" : "Chờ xác minh"}{tab === "hospitals" ? item.acceptingPatients ? " · Có tiếp nhận" : " · Tạm ngừng tiếp nhận" : ""}</small></button>)}</div></section>
    <form className="coord-catalog-form" onSubmit={save}><h3>{editing ? "Chỉnh sửa dữ liệu" : tab === "wards" ? "Bổ sung phường" : "Bổ sung bệnh viện"}</h3><label>{tab === "wards" ? "Tên phường" : "Tên bệnh viện / phòng khám"} *<input name="name" value={form.name} maxLength={200} onChange={change} disabled={saving} /></label>{tab === "wards" ? <><label>Mã danh mục phường *<input name="code" value={form.code} maxLength={40} onChange={change} disabled={saving} /></label><label>Thành phố<input value="Đà Nẵng" readOnly /></label></> : <><label>Địa chỉ bệnh viện *<input name="address" value={form.address} maxLength={500} onChange={change} disabled={saving} /></label><label>Phường hiện tại{form.verified ? " *" : ""}<select name="wardId" value={form.wardId} onChange={change} disabled={saving}><option value="">Chưa đối chiếu phường hiện tại</option>{wards.filter(ward => ward.active !== false && ward.verified).map(ward => <option key={entityId(ward)} value={entityId(ward)}>{ward.name}</option>)}</select></label><label>Số liên hệ công khai{form.verified ? " *" : ""}<input name="phone" value={form.phone} maxLength={100} onChange={change} disabled={saving} /></label>{!form.verified && <p className="coord-warning">Có thể lưu chờ đối chiếu khi nguồn còn dùng địa chỉ cũ. Cần phường hiện tại và số liên hệ để xác minh và bật tiếp nhận.</p>}<label className="coord-check"><input type="checkbox" name="acceptingPatients" checked={form.acceptingPatients} onChange={change} disabled={saving || !form.verified} />Bệnh viện hiện có tiếp nhận trong danh mục DOCTIS</label></>}
    <label>Đường dẫn nguồn tham khảo (HTTPS) *<input name="sourceUrl" type="url" value={form.sourceUrl} placeholder="https://…" maxLength={1000} onChange={change} disabled={saving} /></label><label className="coord-check"><input name="verified" type="checkbox" checked={form.verified} onChange={change} disabled={saving} />Tôi đã đối chiếu tên, địa chỉ hiện tại và thông tin liên hệ với nguồn đáng tin cậy.</label><label className="coord-check"><input name="active" type="checkbox" checked={form.active} onChange={change} disabled={saving} />Sử dụng trong danh mục hệ thống</label><div className="coord-actions"><button className="coord-primary" type="submit" disabled={saving}>{saving ? "Đang lưu…" : tab === "hospitals" && !form.verified ? "Lưu chờ đối chiếu" : "Lưu danh mục"}</button>{editing && <button type="button" className="coord-secondary" onClick={() => start(tab)} disabled={saving}>Hủy chỉnh sửa</button>}</div></form></div>
  </section>;
}
