import { WorkspaceIntro, WorkspaceNotice, WorkspaceTabs } from "../../components/WorkspacePrimitives";
import { useWorkspaceMotion } from "../../components/WorkspaceMotion";
import AdminCoordination from "../../components/coordination/AdminCoordination";
import AdminCatalogManager from "../../components/coordination/AdminCatalogManager";
import HospitalPicker from "../../components/coordination/HospitalPicker";
import NotificationInbox from "../../components/coordination/NotificationInbox";
import LegacyUnassignDialog from "../../components/coordination/LegacyUnassignDialog";
import { entityId, verifiedActive } from "../../components/coordination/coordinationUtils";
import HeartScene from "../../components/3d/HeartScene";
import { useStudioPreferences } from "../../components/studio/StudioPreferences";
import StudioControls from "../../components/studio/StudioControls";
import StudioExperience from "../../components/studio/StudioExperience";
import useLiveReducedMotion from "../../components/useLiveReducedMotion";
import useWorkspaceDialog from "../../components/useWorkspaceDialog";
import "../../CSS/role-studio.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MotionConfig, motion, AnimatePresence } from "framer-motion";
import API from "../../services/api";
import {
  FaChartLine, FaChevronRight, FaCrown, FaExchangeAlt, FaHospital,
  FaHeartbeat, FaSearch, FaSignOutAlt, FaShieldAlt,
  FaTimes, FaUserCog, FaUserMd, FaUserPlus, FaUsers, FaUserShield,
  FaUserTimes, FaEdit, FaSave, FaPhone, FaEnvelope,
} from "react-icons/fa";

const ROLE_PAGE_ORDER = ["dashboard", "coordination", "catalog", "assignment", "users"];
const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "null"); }
  catch { return null; }
};
const getToken = () => localStorage.getItem("token") || getStoredUser()?.token || "";
const authConfig = () => ({ headers: { Authorization: `Bearer ${getToken()}` } });
const displayName = (x) => {
  if (x?.displayName) return x.displayName;
  const raw = x?.fullName || x?.username || x?.email || "Chưa có tên";
  if (String(x?.role || "").toLowerCase() === "doctor") {
    const clean = String(raw).replace(/^doctor\s+/i, "").trim();
    return `Doctor ${clean}`;
  }
  return raw;
};
const assignmentGroup = patient => patient.needsReconciliation || patient.legacyAssignment ? "legacy" : patient.assignedDoctor ? "assigned" : "waiting";
const assignmentHospital = patient => patient.hospital || patient.assignedHospital || (patient.intake?.hospitalId?.name ? patient.intake.hospitalId : null) || (patient.assignedDoctor?.hospitalId?.name ? patient.assignedDoctor.hospitalId : null);

export default function AdminDashboard() {
  const prefs = useStudioPreferences();
  const reducedMotion = useLiveReducedMotion();
  const [view, setViewState] = useState("dashboard");
  const [roleNavOpen, setRoleNavOpen] = useState(false);
  const { screenRef, navigate: navigateAdmin } = useWorkspaceMotion(view, setViewState, ROLE_PAGE_ORDER);
  const setView = next => { navigateAdmin(next); setRoleNavOpen(false); };
  const [users, setUsers] = useState([]);
  const [assignPatients, setAssignPatients] = useState([]);
  const [assignDoctors, setAssignDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [focusIntakeId, setFocusIntakeId] = useState("");
  const [focusRequestKey, setFocusRequestKey] = useState(0);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [hospitals, setHospitals] = useState([]);
  const [hospitalError, setHospitalError] = useState("");
  const [roleSavingId, setRoleSavingId] = useState("");
  const roleLock = useRef(false);
  const doctorLock = useRef(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("waiting");
  const [feedback, setFeedback] = useState(null);
  const showFeedback = (text, type = "error") => setFeedback({ text, type });
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [legacyEndPatient, setLegacyEndPatient] = useState(null);
  const [error, setError] = useState("");
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [doctorForm, setDoctorForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "", hospitalId: ""
  });
  const [savingDoctor, setSavingDoctor] = useState(false);
  const patientDialogRef = useWorkspaceDialog(Boolean(selectedPatient), () => setSelectedPatient(null));
  const doctorDialogRef = useWorkspaceDialog(Boolean(editingDoctor), () => { if (!savingDoctor) setEditingDoctor(null); });

  const loadUsers = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await API.get("/admin/users", authConfig());
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("GET USERS ERROR =", err);
      setError(err.response?.data?.msg || "Không thể tải danh sách người dùng.");
    } finally { setLoading(false); }
  }, []);

  const loadAssignmentData = useCallback(async () => {
    setAssignmentLoading(true);
    try {
      const [p, d] = await Promise.all([
        API.get("/admin/assignments/patients", authConfig()),
        API.get("/admin/assignments/doctors", authConfig()),
      ]);
      setAssignPatients(Array.isArray(p.data) ? p.data : []);
      setAssignDoctors(Array.isArray(d.data) ? d.data : []);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("GET ASSIGNMENTS ERROR =", err);
      setError(err.response?.data?.msg || "Không thể tải dữ liệu phân công. Kiểm tra /api/admin/assignments.");
    } finally { setAssignmentLoading(false); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { loadAssignmentData(); }, [loadAssignmentData]);

  const doctors = useMemo(() => users.filter(x => x.role?.trim() === "doctor"), [users]);
  const patients = useMemo(() => users.filter(x => x.role?.trim() === "user"), [users]);
  const admins = useMemo(() => users.filter(x => x.role?.trim() === "admin"), [users]);
  const unassignedCount = useMemo(() => assignPatients.filter(x => assignmentGroup(x) === "waiting").length, [assignPatients]);
  const assignedCount = useMemo(() => assignPatients.filter(x => assignmentGroup(x) === "assigned").length, [assignPatients]);
  const legacyCount = useMemo(() => assignPatients.filter(x => assignmentGroup(x) === "legacy").length, [assignPatients]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const visible = roleFilter === "all" ? users : users.filter(u => u.role?.trim() === roleFilter);
    if (!q) return visible;
    return visible.filter(u => [u.fullName,u.username,u.email,u.phone,u.role].filter(Boolean).some(v => String(v).toLowerCase().includes(q)));
  }, [users, search, roleFilter]);

  const filteredAssignments = useMemo(() => {
    const q = assignmentSearch.trim().toLowerCase();
    const visible = assignPatients.filter(p => assignmentFilter === "all" || assignmentGroup(p) === assignmentFilter);
    if (!q) return visible;
    return visible.filter(p => [p.fullName,p.username,p.email,p.ward,assignmentHospital(p)?.name,displayName(p.assignedDoctor)].filter(Boolean).some(v => String(v).toLowerCase().includes(q)));
  }, [assignPatients, assignmentSearch, assignmentFilter]);

  const changeRole = async (id, role) => {
    if (roleLock.current) return;
    roleLock.current = true; setRoleSavingId(id);
    try {
      await API.put(`/admin/change-role/${id}`, { role }, authConfig());
      await Promise.all([loadUsers(), loadAssignmentData()]);
    } catch (err) { showFeedback(err.response?.data?.msg || "Không thể đổi quyền."); }
    finally { roleLock.current = false; setRoleSavingId(""); }
  };

  const openDoctorEditor = async (doctor) => {
    setEditingDoctor(doctor);
    setDoctorForm({
      fullName: doctor?.fullName || doctor?.username || "",
      username: doctor?.username || "",
      email: doctor?.email || "",
      phone: doctor?.phone || "", hospitalId: entityId(doctor?.hospitalId)
    });
    setHospitalError("");
    try { const response = await API.get("/admin/catalog/hospitals"); setHospitals(response.data?.hospitals || []); }
    catch (failure) { setHospitalError(failure.response?.data?.msg || "Chưa tải được danh mục bệnh viện đã xác minh."); }
  };

  const closeDoctorEditor = () => {
    if (savingDoctor) return;
    setEditingDoctor(null);
  };

  const saveDoctorProfile = async () => {
    if (!editingDoctor?._id || doctorLock.current) return;
    const fullName = doctorForm.fullName.trim();
    const username = doctorForm.username.trim();
    const email = doctorForm.email.trim();
    const phone = doctorForm.phone.trim();

    if (!fullName) return showFeedback("Vui lòng nhập tên hiển thị cho bác sĩ.");
    if (!username) return showFeedback("Vui lòng nhập username.");
    if (doctorForm.hospitalId && !hospitals.some(hospital => entityId(hospital) === doctorForm.hospitalId && verifiedActive(hospital))) return showFeedback("Chọn bệnh viện đã xác minh và đang hoạt động.");

    doctorLock.current = true;
    setSavingDoctor(true);
    try {
      await API.put(`/admin/doctors/${editingDoctor._id}`, {
        fullName, username, email, phone, hospitalId: doctorForm.hospitalId || null
      }, authConfig());

      await Promise.all([loadUsers(), loadAssignmentData()]);
      setEditingDoctor(null);
      showFeedback("Đã cập nhật hồ sơ bác sĩ.", "success");
    } catch (err) {
      showFeedback(err.response?.data?.msg || "Không thể cập nhật hồ sơ bác sĩ.");
    } finally {
      doctorLock.current = false;
      setSavingDoctor(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token"); localStorage.removeItem("user"); window.location.href = "/";
  };

  const nav = [
    { id: "dashboard", label: "Tổng quan", hint: "Hệ thống", icon: <FaChartLine /> },
    { id: "coordination", label: "Điều phối chăm sóc", hint: "Bệnh viện và bác sĩ", icon: <FaHospital /> },
    { id: "catalog", label: "Danh mục bệnh viện", hint: "Cơ sở và phường phục vụ", icon: <FaHospital /> },
    { id: "assignment", label: "Phân công bệnh nhân", hint: "Bệnh nhân đang chờ", icon: <FaUserCog />, badge: unassignedCount },
    { id: "users", label: "Tài khoản & quyền", hint: `${users.length} tài khoản`, icon: <FaUsers /> },
  ];

  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "never"}><div className={`admin-page role-studio ${roleNavOpen ? "role-menu-open" : ""}`} data-studio-theme={prefs.theme} data-studio-simple={prefs.simpleUI} data-sidebar-collapsed={prefs.sidebarCollapsed}>
      <StudioExperience page={`admin-${view}`} name={displayName(getStoredUser())} />
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark"><FaHeartbeat /></div>
          <div><strong>DOCTIS</strong><span>ADMIN CONTROL</span></div>
        </div>
        <div className="admin-sidebar-label">QUẢN TRỊ HỆ THỐNG</div>
        <nav className="admin-menu" aria-label="Điều hướng quản trị">
          {nav.map(item => (
            <button key={item.id} type="button" className={`admin-menu-item ${view === item.id ? "is-active" : ""}`} title={item.label} aria-label={item.label} aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id)}>
              {view === item.id && <motion.i className="role-nav-light" layoutId="admin-navigation-light" />}
              <span className="admin-menu-icon">{item.icon}</span>
              <span className="admin-menu-copy"><strong>{item.label}</strong><span className="admin-menu-meta"><small>{item.hint}</small>{item.badge > 0 && <span className="admin-menu-badge" title={`${item.badge} bệnh nhân chưa được phân công`} aria-label={`${item.badge} bệnh nhân đang chờ`}>{item.badge}</span>}</span></span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-security-card"><FaShieldAlt /><div><strong>Admin bảo mật</strong><span>Phân quyền hoạt động</span></div></div>
          <button className="admin-logout" type="button" onClick={logout}><FaSignOutAlt />Đăng xuất</button>
        </div>
      </aside>

      {roleNavOpen && <button className="role-menu-backdrop" type="button" aria-label="Close menu" onClick={() => setRoleNavOpen(false)} />}
      <AnimatePresence><WorkspaceNotice feedback={feedback} onClose={() => setFeedback(null)} /></AnimatePresence>
      <main className="admin-main">
        <header className="admin-topbar">
          <button className="role-menu-toggle" type="button" onClick={() => setRoleNavOpen(v => !v)} aria-label="Menu" aria-expanded={roleNavOpen}>☰</button>
          <div>
            <span className="admin-eyebrow"><i /> SMART HEALTH PLATFORM</span>
            <h1>{view === "dashboard" ? "Trung tâm quản trị" : view === "assignment" ? "Phân công bệnh nhân" : view === "coordination" ? "Tiếp nhận và điều phối" : view === "catalog" ? "Danh mục phục vụ Đà Nẵng" : "Người dùng & phân quyền"}</h1>
            <p>Quản lý người dùng, bác sĩ và mối quan hệ chăm sóc trong DOCTIS.</p>
          </div>
          <div className="role-header-tools">{view !== "dashboard" && <div className="role-heart-slot"><HeartScene compact status="neutral" /></div>}<StudioControls /><NotificationInbox onOpen={notification => { if (notification.entityType === "intake") { setFocusIntakeId(notification.entityId); setFocusRequestKey(value => value + 1); setView("coordination"); } else setView("coordination"); }} /><div className="admin-topbar-user">
            <div className="admin-avatar"><FaCrown /></div>
            <div><strong>{displayName(getStoredUser())}</strong><span>System Administrator</span></div>
          </div>
          </div>
        </header>

        {error && <motion.div className="admin-error" initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}><FaTimes /><span>{error}</span><button type="button" onClick={() => setError("")}>Đóng</button></motion.div>}

        <div ref={screenRef} className="role-workspace-content">
          {view === "coordination" && <AdminCoordination reloadKey={catalogVersion} focusIntakeId={focusIntakeId} focusRequestKey={focusRequestKey} onManageCatalog={() => setView("catalog")} onChanged={() => loadAssignmentData()} />}
          {view === "catalog" && <AdminCatalogManager onChanged={() => setCatalogVersion(value => value + 1)} />}
          {view === "dashboard" && (
            <section key="dashboard" className="admin-view">
              <section className="role-overview-stage admin-overview-stage">
                <div className="role-stage-copy"><span className="role-stage-eyebrow">MẠNG LƯỚI DOCTIS</span><h2>Kết nối con người.<br /><em>Điều phối chăm sóc.</em></h2><p>Một góc nhìn chung về tài khoản, đội ngũ bác sĩ và mối quan hệ chăm sóc trong hệ thống.</p><div className="role-stage-actions"><button type="button" onClick={() => setView("assignment")}><FaUserCog /> Quản lý phân công <span aria-hidden="true">↗</span></button><button type="button" onClick={() => setView("users")}><FaUsers /> Danh bạ</button></div></div>
                <div className="role-stage-object"><span className="role-orbit role-orbit-one" /><span className="role-orbit role-orbit-two" /><HeartScene compact status="neutral" /><span className="role-scene-caption">CÔNG NGHỆ · CON NGƯỜI · CHĂM SÓC</span></div>
                <div className="care-network-map" aria-label="Tình trạng mạng lưới chăm sóc"><div className="care-network-center"><FaUserMd /><strong>{assignDoctors.length}</strong><span>Bác sĩ trong mạng lưới</span></div><div className="care-network-paths" aria-hidden="true"><i /><i /></div><div className="care-network-endpoints"><div><span className="network-dot assigned" /><strong>{assignedCount}</strong><span>Đã phân công</span></div><div><span className="network-dot waiting" /><strong>{unassignedCount}</strong><span>Đang chờ</span></div></div></div>
              </section>

              <div className="admin-stat-grid">
                <StatCard icon={<FaUsers />} label="Tổng tài khoản" value={users.length} note="Tất cả tài khoản" tone="blue" />
                <StatCard icon={<FaUserMd />} label="Bác sĩ" value={doctors.length} note="Đang có quyền doctor" tone="violet" />
                <StatCard icon={<FaUserPlus />} label="Bệnh nhân" value={patients.length} note="Tài khoản người dùng" tone="cyan" />
                <StatCard icon={<FaUserShield />} label="Admin" value={admins.length} note="Tài khoản quản trị" tone="rose" />
              </div>

              <div className="admin-dashboard-grid">
                <section className="admin-panel assignment-summary">
                  <div className="panel-heading"><div><span className="panel-kicker">CARE NETWORK</span><h3>Phân công bác sĩ</h3></div><button className="panel-link" type="button" onClick={() => setView("assignment")}>Quản lý <FaChevronRight /></button></div>
                  <div className="assignment-progress">
                    <div className="progress-ring"><svg viewBox="0 0 120 120"><circle className="progress-track" cx="60" cy="60" r="50" /><circle className="progress-value" cx="60" cy="60" r="50" style={{strokeDashoffset: 314 - 314 * (assignPatients.length ? assignedCount / assignPatients.length : 0)}} /></svg><strong>{assignPatients.length ? Math.round(assignedCount / assignPatients.length * 100) : 0}%</strong></div>
                    <div className="assignment-progress-copy"><h4>{assignedCount} bệnh nhân đang được phụ trách</h4><p>{unassignedCount ? `${unassignedCount} bệnh nhân đang chờ được phân công.` : "Không có bệnh nhân chờ phân công mới."}{legacyCount > 0 && ` ${legacyCount} phân công cũ cần đối chiếu bệnh viện.`}</p><div className="mini-legend"><span><i className="dot assigned" /> Đang phụ trách</span><span><i className="dot waiting" /> Chờ phân công</span></div></div>
                  </div>
                </section>

                <section className="admin-panel doctor-load">
                  <div className="panel-heading"><div><span className="panel-kicker">DOCTOR LOAD</span><h3>Tải bệnh nhân theo bác sĩ</h3></div><FaExchangeAlt className="panel-heading-icon" /></div>
                  <div className="doctor-load-list">
                    {assignDoctors.slice(0,5).map(d => <div className="doctor-load-row" key={d._id}><div className="doctor-mini-avatar"><FaUserMd /></div><div className="doctor-load-info"><strong>{displayName(d)}</strong><span>Bác sĩ phụ trách • {d.patientCount || 0} bệnh nhân</span></div><button type="button" className="doctor-edit-mini" onClick={() => openDoctorEditor(d)} title="Chỉnh sửa bác sĩ"><FaEdit /></button><div className="doctor-load-count"><strong>{d.patientCount || 0}</strong><span>BN</span></div></div>)}
                    {!assignDoctors.length && <div className="empty-state compact"><FaUserMd /><span>Chưa có dữ liệu phân công.</span></div>}
                  </div>
                </section>
              </div>

              <section className="admin-panel recent-users">
                <div className="panel-heading"><div><span className="panel-kicker">USER DIRECTORY</span><h3>Tài khoản trong hệ thống</h3></div><button className="panel-link" type="button" onClick={() => setView("users")}>Xem tất cả <FaChevronRight /></button></div>
                <div className="user-preview-grid">
                  {users.slice(0,6).map(item => <div className="user-preview" key={item._id}><div className={`user-preview-avatar role-${item.role}`}>{item.role === "doctor" ? <FaUserMd /> : <FaUsers />}</div><div><strong>{displayName(item)}</strong><span>{item.email || "Chưa có email"}</span></div><RoleBadge role={item.role} /></div>)}
                  {!users.length && !loading && <div className="empty-state"><FaUsers /><span>Chưa có người dùng.</span></div>}
                </div>
              </section>
            </section>
          )}

          {view === "assignment" && (
            <section key="assignment" className="admin-view">
              <WorkspaceIntro title="Phân công bệnh nhân" description="Bệnh nhân chờ phân công được hiển thị trước. Hồ sơ đã có bác sĩ và quan hệ cũ cần đối chiếu được theo dõi ở từng mục riêng." kind="chat">
                <WorkspaceTabs label="Lọc tình trạng phân công" value={assignmentFilter} onChange={setAssignmentFilter} options={[{value:"waiting",label:"Chờ phân công",count:unassignedCount},{value:"assigned",label:"Đang phụ trách",count:assignedCount},{value:"legacy",label:"Cần đối chiếu",count:legacyCount},{value:"all",label:"Tất cả",count:assignPatients.length}]} />
              </WorkspaceIntro>
              <div className="section-toolbar">
                <div><span className="admin-eyebrow small"><i /> CARE MANAGEMENT</span><h2>{assignmentFilter === "waiting" ? "Bệnh nhân chờ phân công" : assignmentFilter === "assigned" ? "Bệnh nhân đang được phụ trách" : assignmentFilter === "legacy" ? "Phân công cần đối chiếu" : "Mạng lưới chăm sóc"}</h2><p>Chọn bệnh viện theo khu vực sinh sống, sau đó chọn bác sĩ đang công tác tại bệnh viện đó.</p><button type="button" className="coord-primary" onClick={() => setView("coordination")}>Mở điều phối chăm sóc</button></div>
                <div className="toolbar-search"><FaSearch /><input value={assignmentSearch} onChange={e => setAssignmentSearch(e.target.value)} placeholder="Tìm tên, phường, bệnh viện..." /></div>
              </div>
              <div className="assignment-toolbar-stats"><div><span>Tổng bệnh nhân</span><strong>{assignPatients.length}</strong></div><div><span>Đang phụ trách</span><strong className="success">{assignedCount}</strong></div><div><span>Chờ phân công</span><strong className="warning">{unassignedCount}</strong></div><div><span>Cần đối chiếu</span><strong className="warning">{legacyCount}</strong></div></div>
              <section className="admin-panel assignment-panel">
                {assignmentLoading ? <LoadingState text="Đang tải mạng lưới bệnh nhân..." /> : !filteredAssignments.length ? <EmptyState icon={<FaUsers />} title={assignmentSearch ? "Không tìm thấy bệnh nhân" : assignmentFilter === "waiting" ? "Không có bệnh nhân chờ phân công" : assignmentFilter === "legacy" ? "Không có phân công cần đối chiếu" : "Chưa có bệnh nhân trong mục này"} text={assignmentSearch ? "Hãy thử thay đổi từ khóa tìm kiếm." : "Bạn có thể chọn mục khác để xem các hồ sơ đã được quản lý."} /> :
                  <div className="assignment-table-wrap"><table className="admin-table"><thead><tr><th>Bệnh nhân</th><th>Liên hệ</th><th>Bác sĩ hiện tại</th><th>Bệnh viện</th><th>Trạng thái</th><th className="assignment-actions-cell">Thao tác</th></tr></thead><tbody>
                    {filteredAssignments.map(patient => {
                      return <tr key={patient._id}>
                        <td data-label="Bệnh nhân"><button type="button" className="patient-cell" onClick={() => setSelectedPatient(patient)}><span className="patient-avatar">{(displayName(patient)[0] || "P").toUpperCase()}</span><span><strong>{displayName(patient)}</strong><small>@{patient.username || "patient"}</small></span></button></td>
                        <td data-label="Liên hệ"><span className="muted-cell">{patient.email || "—"}</span><small className="table-sub">{patient.phone || "Chưa có SĐT"}</small></td>
                        <td data-label="Bác sĩ hiện tại">{patient.assignedDoctor ? <div className="current-doctor"><span className="doctor-dot"><FaUserMd /></span><span><strong>{displayName(patient.assignedDoctor)}</strong><small>Bác sĩ phụ trách</small></span></div> : <span className="status-pill waiting"><i /> Chưa phân công</span>}</td>
                        <td data-label="Bệnh viện"><span className="muted-cell">{assignmentHospital(patient)?.name || "Chưa chọn bệnh viện"}</span>{assignmentHospital(patient)?.wardId?.name && <small className="table-sub">{assignmentHospital(patient).wardId.name}</small>}</td>
                        <td data-label="Trạng thái"><span className={`status-pill ${assignmentGroup(patient) === "assigned" ? "assigned" : "waiting"}`}><i />{assignmentGroup(patient) === "legacy" ? "Cần đối chiếu" : patient.assignedDoctor ? "Đang phụ trách" : "Chờ phân công"}</span></td>
                        <td className="assignment-actions-cell" data-label="Thao tác"><div className="table-actions assignment-actions"><button type="button" className="action-primary" onClick={() => { setFocusIntakeId(entityId(patient.intake)); setFocusRequestKey(value => value + 1); setView("coordination"); }}>{patient.assignedDoctor ? "Xem điều phối" : "Chọn bệnh viện & bác sĩ"}</button>{patient.assignedDoctor && patient.legacyAssignment && <button type="button" className="action-danger" onClick={() => setLegacyEndPatient(patient)}>Kết thúc phân công cũ</button>}</div></td>
                      </tr>;
                    })}
                  </tbody></table></div>}
              </section>
            </section>
          )}

          {view === "users" && (
            <section key="users" className="admin-view" aria-busy={Boolean(roleSavingId)}>
              <fieldset disabled={Boolean(roleSavingId)} style={{ display: "contents", border: 0, padding: 0, margin: 0 }}>
              <WorkspaceIntro title="Danh bạ DOCTIS" description="Tìm tài khoản, xem vai trò và cập nhật thông tin bác sĩ trong cùng một không gian." kind="profile">
                <WorkspaceTabs label="Lọc vai trò tài khoản" value={roleFilter} onChange={setRoleFilter} options={[{value:"all",label:"Tất cả",count:users.length},{value:"user",label:"Bệnh nhân",count:patients.length},{value:"doctor",label:"Bác sĩ",count:doctors.length},{value:"admin",label:"Admin",count:admins.length}]} />
              </WorkspaceIntro>
              <div className="section-toolbar"><div><span className="admin-eyebrow small"><i /> IDENTITY & ACCESS</span><h2>Người dùng & phân quyền</h2><p>Cấp hoặc thu quyền bác sĩ. Tài khoản admin không thể bị thay đổi từ màn hình này.</p></div><div className="toolbar-search"><FaSearch /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tài khoản..." /></div></div>
              <section className="admin-panel assignment-panel">
                {loading ? <LoadingState text="Đang tải danh sách tài khoản..." /> : !filteredUsers.length ? <EmptyState icon={<FaUsers />} title="Không có tài khoản phù hợp" text="Thử một tên, email hoặc role khác." /> :
                  <div className="assignment-table-wrap"><table className="admin-table"><thead><tr><th>Tài khoản</th><th>Liên hệ</th><th>Quyền</th><th>Hành động</th></tr></thead><tbody>
                    {filteredUsers.map(item => <tr key={item._id}><td data-label="Tài khoản"><div className="patient-cell"><span className={`patient-avatar role-${item.role}`}>{item.role === "doctor" ? <FaUserMd /> : <FaUsers />}</span><span><strong>{displayName(item)}</strong><small>@{item.username || "account"}</small></span></div></td><td data-label="Liên hệ"><span className="muted-cell">{item.email || "—"}</span><small className="table-sub">{item.phone || "Chưa có SĐT"}</small></td><td data-label="Vai trò"><RoleBadge role={item.role} /></td><td data-label="Thao tác">{item.role === "admin" ? <span className="protected-label"><FaShieldAlt /> Tài khoản bảo vệ</span> : item.role === "doctor" ? <div className="doctor-user-actions"><button type="button" className="role-action edit" onClick={() => openDoctorEditor(item)}><FaEdit /> Chỉnh sửa</button><button type="button" className="role-action danger" onClick={() => changeRole(item._id,"user")}><FaUserTimes /> Thu quyền Doctor</button></div> : <button type="button" className="role-action primary" onClick={() => changeRole(item._id,"doctor")}><FaUserMd /> Cấp quyền Doctor</button>}</td></tr>)}
                  </tbody></table></div>}
              </section>
              </fieldset>
            </section>
          )}
        </div>
      </main>

      <AnimatePresence>
        {selectedPatient && <motion.div className="admin-modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.2}} onMouseDown={e => { if (e.target === e.currentTarget) setSelectedPatient(null); }}>
          <motion.aside ref={patientDialogRef} role="dialog" aria-modal="true" aria-label="Thông tin bệnh nhân" tabIndex={-1} className="admin-patient-modal" initial={{opacity:0,x:40}} animate={{opacity:1,x:0}} exit={{opacity:0,x:40}} transition={{duration:.28,ease:[.22,1,.36,1]}}>
            <button type="button" className="modal-close" onClick={() => setSelectedPatient(null)}><FaTimes /></button>
            <span className="admin-eyebrow small"><i /> PATIENT PROFILE</span>
            <div className="modal-patient-head"><div className="modal-patient-avatar">{(displayName(selectedPatient)[0] || "P").toUpperCase()}</div><div><h2>{displayName(selectedPatient)}</h2><p>{selectedPatient.email || "Chưa có email"}</p></div></div>
            <div className="modal-detail-grid"><div><span>Username</span><strong>{selectedPatient.username || "—"}</strong></div><div><span>Số điện thoại</span><strong>{selectedPatient.phone || "—"}</strong></div><div><span>Bệnh viện phụ trách</span><strong>{assignmentHospital(selectedPatient)?.name || "Chưa chọn bệnh viện"}</strong></div><div><span>Bác sĩ hiện tại</span><strong>{selectedPatient.assignedDoctor ? displayName(selectedPatient.assignedDoctor) : "Chưa phân công"}</strong></div><div><span>Khu vực sinh sống</span><strong>{[selectedPatient.ward, selectedPatient.city].filter(Boolean).join(", ") || "Chưa có khu vực"}</strong></div><div><span>Ngày phân công</span><strong>{selectedPatient.assignedAt ? new Date(selectedPatient.assignedAt).toLocaleDateString("vi-VN") : "—"}</strong></div></div>
            <div className="modal-note"><FaShieldAlt /><p>Lịch sử phân công được lưu ở backend. Việc đổi bác sĩ không xóa bản ghi cũ.</p></div>
          </motion.aside>
        </motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {editingDoctor && (
          <motion.div
            className="admin-modal-backdrop doctor-editor-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: .2 }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) closeDoctorEditor(); }}
          >
            <motion.div
              ref={doctorDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="doctor-editor-title"
              aria-busy={savingDoctor}
              tabIndex={-1}
              className="admin-doctor-editor"
              initial={{ opacity: 0, y: 24, scale: .97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: .97 }}
              transition={{ duration: .28, ease: [.22, 1, .36, 1] }}
            >
              <div className="doctor-editor-header">
                <div>
                  <span className="admin-eyebrow small"><i /> DOCTOR PROFILE</span>
                  <h2 id="doctor-editor-title">Chỉnh sửa bác sĩ</h2>
                  <p>Cập nhật tên hiển thị và thông tin liên hệ của tài khoản Doctor.</p>
                </div>
                <button type="button" className="modal-close" onClick={closeDoctorEditor}><FaTimes /></button>
              </div>

              <div className="doctor-editor-identity">
                <div className="doctor-editor-avatar"><FaUserMd /></div>
                <div><strong>{doctorForm.fullName || doctorForm.username || "Bác sĩ"}</strong><span>Vai trò: Bác sĩ</span></div>
              </div>

              <div className="doctor-editor-grid">
                <label><span>Họ và tên *</span><div className="editor-input"><FaUserMd /><input value={doctorForm.fullName} onChange={e => setDoctorForm(p => ({ ...p, fullName: e.target.value }))} placeholder="Ví dụ: Nguyễn Văn An" /></div></label>
                <label><span>Username *</span><div className="editor-input"><FaUserCog /><input value={doctorForm.username} onChange={e => setDoctorForm(p => ({ ...p, username: e.target.value }))} placeholder="doctor01" /></div></label>
                <label><span>Email</span><div className="editor-input"><FaEnvelope /><input type="email" value={doctorForm.email} onChange={e => setDoctorForm(p => ({ ...p, email: e.target.value }))} placeholder="doctor@doctis.vn" /></div></label>
                <label><span>Số điện thoại</span><div className="editor-input"><FaPhone /><input value={doctorForm.phone} onChange={e => setDoctorForm(p => ({ ...p, phone: e.target.value }))} placeholder="09xxxxxxxx" /></div></label>
                <HospitalPicker label="Bệnh viện của bác sĩ" mode="membership" hospitals={hospitals} value={doctorForm.hospitalId} disabled={savingDoctor} onChange={nextId => setDoctorForm(old => ({ ...old, hospitalId: nextId }))} />
              </div>
              {hospitalError && <p className="coord-error" role="alert">{hospitalError}</p>}
              {!hospitals.filter(verifiedActive).length && <p className="coord-warning">Chưa có bệnh viện đã xác minh. Bổ sung danh mục trước khi gắn bác sĩ; không tự suy ra bệnh viện cho tài khoản cũ.</p>}

              <div className="doctor-editor-note"><FaShieldAlt /><span>Thay đổi tên ở đây sẽ đồng bộ với danh sách bác sĩ và tên bác sĩ phụ trách của bệnh nhân.</span></div>

              <div className="doctor-editor-actions">
                <button type="button" className="editor-cancel" onClick={closeDoctorEditor} disabled={savingDoctor}>Hủy</button>
                <button type="button" className="editor-save" onClick={saveDoctorProfile} disabled={savingDoctor}><FaSave /> {savingDoctor ? "Đang lưu..." : "Lưu thay đổi"}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {legacyEndPatient && <LegacyUnassignDialog patient={legacyEndPatient} onClose={() => setLegacyEndPatient(null)} onSaved={response => { showFeedback(response.msg || "Đã kết thúc phân công cũ.", "success"); loadAssignmentData(); }} />}
    </div></MotionConfig>
  );
}

function StatCard({icon,label,value,note,tone}) {
  const reducedMotion = useLiveReducedMotion();
  return <motion.div className={`admin-stat-card tone-${tone}`} whileHover={reducedMotion ? undefined : {y:-3}} whileTap={reducedMotion ? undefined : {scale:.99}} transition={{duration:.18}}><div className="stat-top"><span className="stat-icon">{icon}</span></div><strong>{value}</strong><h3>{label}</h3><p>{note}</p></motion.div>;
}
function RoleBadge({role}) {
  const map={admin:["admin","Admin"],doctor:["doctor","Doctor"],user:["user","Bệnh nhân"]}; const [cls,label]=map[role] || ["user",role || "Unknown"];
  return <span className={`role-badge ${cls}`}><i />{label}</span>;
}
function LoadingState({text}) { return <div className="empty-state"><span className="loader-orb" /><strong>{text}</strong></div>; }
function EmptyState({icon,title,text}) { return <div className="empty-state"><span className="empty-icon">{icon}</span><strong>{title}</strong><span>{text}</span></div>; }
