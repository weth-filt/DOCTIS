import { useCallback, useEffect, useRef, useState } from "react";
import { FaHospital, FaMapMarkerAlt, FaPhone, FaUserMd } from "react-icons/fa";
import API from "../../services/api";
import { errorText, intakeLabel, personName } from "./coordinationUtils";
import "../../CSS/coordination.css";

export default function CareTeamPanel({ active = true, refreshKey = 0, onEditAddress }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);
  const load = useCallback(async signal => {
    const version = ++requestVersion.current;
    setLoading(true); setError("");
    try {
      const response = await API.get("/care-team", { signal });
      if (signal?.aborted || version !== requestVersion.current) return;
      const value = response.data || {};
      setData(value);
    } catch (failure) { if (!signal?.aborted && version === requestVersion.current) setError(errorText(failure, "Chưa tải được thông tin bệnh viện và bác sĩ phụ trách.")); }
    finally { if (!signal?.aborted && version === requestVersion.current) setLoading(false); }
  }, []);
  useEffect(() => { if (!active) return undefined; const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [active, refreshKey, load]);
  const hospital = data?.hospital || data?.intake?.hospital;
  const doctor = data?.doctor || data?.intake?.assignedDoctor;
  const status = data?.status || data?.intake?.status;
  return <section className="coord-panel patient-care-team" hidden={!active}>
    <header className="coord-heading"><div><span className="coord-kicker">KẾT NỐI CHĂM SÓC</span><h2>Bệnh viện và bác sĩ phụ trách</h2><p>Theo dõi thông tin điều phối và kết quả tiếp nhận của bệnh viện.</p></div><FaHospital aria-hidden="true" /></header>
    {error && <div className="coord-error" role="alert"><p>{error}</p><button type="button" className="coord-secondary" disabled={loading} onClick={() => load()}>Tải lại thông tin chăm sóc</button></div>}
    {loading && !data ? <p role="status">Đang tải thông tin chăm sóc…</p> : data && <>
      <div className="coord-status-line"><span className={`coord-status ${status || "waiting_hospital"}`}>{intakeLabel(status)}</span>{data.legacyAssignment && <small>Phân công từ hồ sơ cũ · admin cần xác minh bệnh viện.</small>}</div>
      {data.requiresAddressUpdate && <div className="coord-warning care-team-profile-link"><p>Hồ sơ cần bổ sung thông tin địa chỉ để admin đối chiếu và hỗ trợ điều phối. Bạn cập nhật tại mục Thông tin địa chỉ trong Hồ sơ bệnh nhân.</p>{onEditAddress && <button type="button" className="coord-secondary" onClick={onEditAddress}>Mở thông tin địa chỉ trong hồ sơ</button>}</div>}
      <div className="coord-care-grid"><article><span className="coord-large-icon"><FaHospital /></span><h3>{hospital?.name || "Chờ cập nhật bệnh viện"}</h3>{hospital ? <><p><FaMapMarkerAlt aria-hidden="true" />{hospital.address || "Admin cần bổ sung địa chỉ bệnh viện."}</p>{hospital.phone && <p><FaPhone aria-hidden="true" /><a href={`tel:${String(hospital.phone).replace(/[^+\d]/g, "")}`}>{hospital.phone}</a></p>}<p className="coord-note">Mang thông tin hồ sơ và giấy tờ cần thiết đến bệnh viện để được tiếp nhận. Thông tin điều phối này chưa phải lịch hẹn khám; bạn xem lịch đã tạo tại mục Lịch hẹn.</p></> : <p>Admin sẽ đối chiếu địa chỉ của bạn và cập nhật bệnh viện phù hợp. Thông báo sẽ được lưu trong tài khoản.</p>}</article>
      <article><span className="coord-large-icon"><FaUserMd /></span><h3>{doctor ? personName(doctor) : "Chờ bác sĩ phụ trách"}</h3>{doctor ? <><p>Bác sĩ phụ trách theo phân công đang được hệ thống ghi nhận.</p>{doctor.phone && <p><FaPhone aria-hidden="true" />{doctor.phone}</p>}</> : <p>{status === "accepted" ? "Bệnh viện đã tiếp nhận. Admin sẽ ghi nhận bác sĩ do bệnh viện quyết định." : "Bác sĩ chỉ được ghi nhận sau khi bệnh viện tiếp nhận và quyết định phân công."}</p>}</article></div>
    </>}
  </section>;
}
