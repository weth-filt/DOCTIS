import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import API from "../../services/api";
import {
  FaBell, FaChartLine, FaChevronRight, FaCrown, FaExchangeAlt,
  FaHeartbeat, FaSearch, FaSignOutAlt, FaShieldAlt, FaStethoscope,
  FaTimes, FaUserCog, FaUserMd, FaUserPlus, FaUsers, FaUserShield,
  FaUserTimes, FaEdit, FaSave, FaPhone, FaEnvelope,
} from "react-icons/fa";

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

export default function AdminDashboard() {
  const [view, setView] = useState("dashboard");
  const [users, setUsers] = useState([]);
  const [assignPatients, setAssignPatients] = useState([]);
  const [assignDoctors, setAssignDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [savingPatientId, setSavingPatientId] = useState("");
  const [pendingChoice, setPendingChoice] = useState({});
  const [search, setSearch] = useState("");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [error, setError] = useState("");
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [doctorForm, setDoctorForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: ""
  });
  const [savingDoctor, setSavingDoctor] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await API.get("/admin/users", authConfig());
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("GET USERS ERROR =", err);
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
      console.error("GET ASSIGNMENTS ERROR =", err);
      setError(err.response?.data?.msg || "Không thể tải dữ liệu phân công. Kiểm tra /api/admin/assignments.");
    } finally { setAssignmentLoading(false); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { loadAssignmentData(); }, [loadAssignmentData]);

  const doctors = useMemo(() => users.filter(x => x.role?.trim() === "doctor"), [users]);
  const patients = useMemo(() => users.filter(x => x.role?.trim() === "user"), [users]);
  const admins = useMemo(() => users.filter(x => x.role?.trim() === "admin"), [users]);
  const unassignedCount = useMemo(() => assignPatients.filter(x => !x.assignedDoctor).length, [assignPatients]);
  const assignedCount = Math.max(assignPatients.length - unassignedCount, 0);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => [u.fullName,u.username,u.email,u.phone,u.role].filter(Boolean).some(v => String(v).toLowerCase().includes(q)));
  }, [users, search]);

  const filteredAssignments = useMemo(() => {
    const q = assignmentSearch.trim().toLowerCase();
    if (!q) return assignPatients;
    return assignPatients.filter(p => [p.fullName,p.username,p.email,displayName(p.assignedDoctor)].filter(Boolean).some(v => String(v).toLowerCase().includes(q)));
  }, [assignPatients, assignmentSearch]);

  const chosenDoctor = patient => pendingChoice[patient._id] ?? patient.assignedDoctorId ?? patient.assignedDoctor?._id ?? "";

  const changeRole = async (id, role) => {
    try {
      await API.put(`/admin/change-role/${id}`, { role }, authConfig());
      await Promise.all([loadUsers(), loadAssignmentData()]);
    } catch (err) { alert(err.response?.data?.msg || "Không thể đổi quyền."); }
  };

  const openDoctorEditor = (doctor) => {
    setEditingDoctor(doctor);
    setDoctorForm({
      fullName: doctor?.fullName || doctor?.username || "",
      username: doctor?.username || "",
      email: doctor?.email || "",
      phone: doctor?.phone || ""
    });
  };

  const closeDoctorEditor = () => {
    if (savingDoctor) return;
    setEditingDoctor(null);
  };

  const saveDoctorProfile = async () => {
    if (!editingDoctor?._id) return;
    const fullName = doctorForm.fullName.trim();
    const username = doctorForm.username.trim();
    const email = doctorForm.email.trim();
    const phone = doctorForm.phone.trim();

    if (!fullName) return alert("Vui lòng nhập tên hiển thị cho bác sĩ.");
    if (!username) return alert("Vui lòng nhập username.");

    setSavingDoctor(true);
    try {
      await API.put(`/admin/doctors/${editingDoctor._id}`, {
        fullName, username, email, phone
      }, authConfig());

      await Promise.all([loadUsers(), loadAssignmentData()]);
      setEditingDoctor(null);
      alert("Đã cập nhật hồ sơ bác sĩ.");
    } catch (err) {
      alert(err.response?.data?.msg || "Không thể cập nhật hồ sơ bác sĩ.");
    } finally {
      setSavingDoctor(false);
    }
  };

  const saveAssignment = async patient => {
    const doctorId = chosenDoctor(patient);
    if (!doctorId) return alert("Vui lòng chọn bác sĩ.");
    if (patient.assignedDoctor && String(patient.assignedDoctor._id) === String(doctorId)) return alert("Bệnh nhân đã thuộc bác sĩ này.");
    const reason = window.prompt("Lý do phân công / đổi bác sĩ (có thể để trống):", "");
    if (reason === null) return;
    setSavingPatientId(patient._id);
    try {
      await API.post("/admin/assignments/assign", { patientId: patient._id, doctorId, reason }, authConfig());
      setPendingChoice(prev => { const n = { ...prev }; delete n[patient._id]; return n; });
      await loadAssignmentData();
    } catch (err) { alert(err.response?.data?.msg || "Không thể phân công bác sĩ."); }
    finally { setSavingPatientId(""); }
  };

  const removeAssignment = async patient => {
    if (!patient.assignedDoctor) return;
    const reason = window.prompt("Lý do gỡ bác sĩ phụ trách (có thể để trống):", "");
    if (reason === null) return;
    setSavingPatientId(patient._id);
    try {
      await API.post("/admin/assignments/unassign", { patientId: patient._id, reason }, authConfig());
      await loadAssignmentData();
    } catch (err) { alert(err.response?.data?.msg || "Không thể gỡ phân công."); }
    finally { setSavingPatientId(""); }
  };

  const logout = () => {
    localStorage.removeItem("token"); localStorage.removeItem("user"); window.location.href = "/";
  };

  const nav = [
    { id: "dashboard", label: "Tổng quan", hint: "Hệ thống", icon: <FaChartLine /> },
    { id: "assignment", label: "Phân công bệnh nhân", hint: `${unassignedCount} chưa giao`, icon: <FaUserCog />, badge: unassignedCount },
    { id: "users", label: "Người dùng & quyền", hint: `${users.length} tài khoản`, icon: <FaUsers /> },
  ];

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark"><FaHeartbeat /></div>
          <div><strong>DOCTIS</strong><span>ADMIN CONTROL</span></div>
        </div>
        <div className="admin-sidebar-label">QUẢN TRỊ HỆ THỐNG</div>
        <nav className="admin-menu">
          {nav.map(item => (
            <button key={item.id} type="button" className={`admin-menu-item ${view === item.id ? "is-active" : ""}`} onClick={() => setView(item.id)}>
              <span className="admin-menu-icon">{item.icon}</span>
              <span className="admin-menu-copy"><strong>{item.label}</strong><small>{item.hint}</small></span>
              {item.badge > 0 ? <span className="admin-menu-badge">{item.badge}</span> : <FaChevronRight className="admin-menu-arrow" />}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-security-card"><FaShieldAlt /><div><strong>Admin bảo mật</strong><span>Phân quyền hoạt động</span></div></div>
          <button className="admin-logout" type="button" onClick={logout}><FaSignOutAlt />Đăng xuất</button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-eyebrow"><i /> SMART HEALTH PLATFORM</span>
            <h1>{view === "dashboard" ? "Trung tâm quản trị" : view === "assignment" ? "Phân công bệnh nhân" : "Người dùng & phân quyền"}</h1>
            <p>Quản lý người dùng, bác sĩ và mối quan hệ chăm sóc trong DOCTIS.</p>
          </div>
          <div className="admin-topbar-user">
            <div className="admin-avatar"><FaCrown /></div>
            <div><strong>{displayName(getStoredUser())}</strong><span>System Administrator</span></div>
            <FaBell className="admin-bell" />
          </div>
        </header>

        {error && <motion.div className="admin-error" initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}><FaTimes /><span>{error}</span><button type="button" onClick={() => setError("")}>Đóng</button></motion.div>}

        <AnimatePresence mode="wait">
          {view === "dashboard" && (
            <motion.section key="dashboard" className="admin-view" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}>
              <div className="admin-hero">
                <div><span className="hero-chip"><FaHeartbeat /> SYSTEM OVERVIEW</span><h2>Điều hành DOCTIS từ một nơi</h2><p>Theo dõi quy mô hệ thống và tình trạng phân công bác sĩ — bệnh nhân theo thời gian thực.</p></div>
                <div className="hero-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><FaStethoscope /></div></div>
              </div>

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
                    <div className="assignment-progress-copy"><h4>{assignedCount} bệnh nhân đã có bác sĩ</h4><p>{unassignedCount ? `${unassignedCount} bệnh nhân đang chờ được phân công.` : "Tất cả bệnh nhân đã có bác sĩ phụ trách."}</p><div className="mini-legend"><span><i className="dot assigned" /> Đã phân công</span><span><i className="dot waiting" /> Chưa phân công</span></div></div>
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
            </motion.section>
          )}

          {view === "assignment" && (
            <motion.section key="assignment" className="admin-view" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}>
              <div className="section-toolbar">
                <div><span className="admin-eyebrow small"><i /> CARE MANAGEMENT</span><h2>Phân công bệnh nhân cho bác sĩ</h2><p>Mỗi bệnh nhân chỉ có một bác sĩ phụ trách tại một thời điểm. Khi đổi bác sĩ, bản ghi cũ được giữ lại.</p></div>
                <div className="toolbar-search"><FaSearch /><input value={assignmentSearch} onChange={e => setAssignmentSearch(e.target.value)} placeholder="Tìm bệnh nhân..." /></div>
              </div>
              <div className="assignment-toolbar-stats"><div><span>Tổng bệnh nhân</span><strong>{assignPatients.length}</strong></div><div><span>Đã phân công</span><strong className="success">{assignedCount}</strong></div><div><span>Đang chờ</span><strong className="warning">{unassignedCount}</strong></div><div><span>Bác sĩ</span><strong>{assignDoctors.length}</strong></div></div>
              <section className="admin-panel assignment-panel">
                {assignmentLoading ? <LoadingState text="Đang tải mạng lưới bệnh nhân..." /> : !filteredAssignments.length ? <EmptyState icon={<FaUsers />} title="Không tìm thấy bệnh nhân" text="Hãy thử thay đổi từ khóa tìm kiếm." /> :
                  <div className="assignment-table-wrap"><table className="admin-table"><thead><tr><th>Bệnh nhân</th><th>Liên hệ</th><th>Bác sĩ hiện tại</th><th>Phân công mới</th><th>Trạng thái</th><th /></tr></thead><tbody>
                    {filteredAssignments.map(patient => {
                      const chosen = chosenDoctor(patient); const saving = savingPatientId === patient._id;
                      return <tr key={patient._id}>
                        <td><button type="button" className="patient-cell" onClick={() => setSelectedPatient(patient)}><span className="patient-avatar">{(displayName(patient)[0] || "P").toUpperCase()}</span><span><strong>{displayName(patient)}</strong><small>@{patient.username || "patient"}</small></span></button></td>
                        <td><span className="muted-cell">{patient.email || "—"}</span><small className="table-sub">{patient.phone || "Chưa có SĐT"}</small></td>
                        <td>{patient.assignedDoctor ? <div className="current-doctor"><span className="doctor-dot"><FaUserMd /></span><span><strong>{displayName(patient.assignedDoctor)}</strong><small>Bác sĩ phụ trách</small></span></div> : <span className="status-pill waiting"><i /> Chưa phân công</span>}</td>
                        <td><select className="doctor-select" value={chosen} onChange={e => setPendingChoice(prev => ({...prev,[patient._id]:e.target.value}))} disabled={saving}><option value="">-- Chọn bác sĩ --</option>{assignDoctors.map(d => <option key={d._id} value={d._id}>{displayName(d)} — {d.patientCount || 0} BN</option>)}</select></td>
                        <td><span className={`status-pill ${patient.assignedDoctor ? "assigned" : "waiting"}`}><i />{patient.assignedDoctor ? "Đang quản lý" : "Đang chờ"}</span></td>
                        <td><div className="table-actions"><button type="button" className="action-primary" disabled={saving || !chosen} onClick={() => saveAssignment(patient)}>{saving ? "..." : patient.assignedDoctor ? "Đổi BS" : "Giao BS"}</button>{patient.assignedDoctor && <button type="button" className="action-danger" disabled={saving} onClick={() => removeAssignment(patient)} title="Gỡ bác sĩ"><FaUserTimes /></button>}</div></td>
                      </tr>;
                    })}
                  </tbody></table></div>}
              </section>
            </motion.section>
          )}

          {view === "users" && (
            <motion.section key="users" className="admin-view" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}>
              <div className="section-toolbar"><div><span className="admin-eyebrow small"><i /> IDENTITY & ACCESS</span><h2>Người dùng & phân quyền</h2><p>Cấp hoặc thu quyền bác sĩ. Tài khoản admin không thể bị thay đổi từ màn hình này.</p></div><div className="toolbar-search"><FaSearch /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tài khoản..." /></div></div>
              <section className="admin-panel assignment-panel">
                {loading ? <LoadingState text="Đang tải danh sách tài khoản..." /> : !filteredUsers.length ? <EmptyState icon={<FaUsers />} title="Không có tài khoản phù hợp" text="Thử một tên, email hoặc role khác." /> :
                  <div className="assignment-table-wrap"><table className="admin-table"><thead><tr><th>Tài khoản</th><th>Liên hệ</th><th>Quyền</th><th>Hành động</th></tr></thead><tbody>
                    {filteredUsers.map(item => <tr key={item._id}><td><div className="patient-cell"><span className={`patient-avatar role-${item.role}`}>{item.role === "doctor" ? <FaUserMd /> : <FaUsers />}</span><span><strong>{displayName(item)}</strong><small>@{item.username || "account"}</small></span></div></td><td><span className="muted-cell">{item.email || "—"}</span><small className="table-sub">{item.phone || "Chưa có SĐT"}</small></td><td><RoleBadge role={item.role} /></td><td>{item.role === "admin" ? <span className="protected-label"><FaShieldAlt /> Tài khoản bảo vệ</span> : item.role === "doctor" ? <div className="doctor-user-actions"><button type="button" className="role-action edit" onClick={() => openDoctorEditor(item)}><FaEdit /> Chỉnh sửa</button><button type="button" className="role-action danger" onClick={() => changeRole(item._id,"user")}><FaUserTimes /> Thu quyền Doctor</button></div> : <button type="button" className="role-action primary" onClick={() => changeRole(item._id,"doctor")}><FaUserMd /> Cấp quyền Doctor</button>}</td></tr>)}
                  </tbody></table></div>}
              </section>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {selectedPatient && <motion.div className="admin-modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={e => { if (e.target === e.currentTarget) setSelectedPatient(null); }}>
          <motion.aside className="admin-patient-modal" initial={{opacity:0,x:40}} animate={{opacity:1,x:0}} exit={{opacity:0,x:40}}>
            <button type="button" className="modal-close" onClick={() => setSelectedPatient(null)}><FaTimes /></button>
            <span className="admin-eyebrow small"><i /> PATIENT PROFILE</span>
            <div className="modal-patient-head"><div className="modal-patient-avatar">{(displayName(selectedPatient)[0] || "P").toUpperCase()}</div><div><h2>{displayName(selectedPatient)}</h2><p>{selectedPatient.email || "Chưa có email"}</p></div></div>
            <div className="modal-detail-grid"><div><span>Username</span><strong>{selectedPatient.username || "—"}</strong></div><div><span>Số điện thoại</span><strong>{selectedPatient.phone || "—"}</strong></div><div><span>Bác sĩ hiện tại</span><strong>{selectedPatient.assignedDoctor ? displayName(selectedPatient.assignedDoctor) : "Chưa phân công"}</strong></div><div><span>Ngày phân công</span><strong>{selectedPatient.assignedAt ? new Date(selectedPatient.assignedAt).toLocaleDateString("vi-VN") : "—"}</strong></div></div>
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
            onMouseDown={(e) => { if (e.target === e.currentTarget) closeDoctorEditor(); }}
          >
            <motion.div
              className="admin-doctor-editor"
              initial={{ opacity: 0, y: 24, scale: .97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: .97 }}
            >
              <div className="doctor-editor-header">
                <div>
                  <span className="admin-eyebrow small"><i /> DOCTOR PROFILE</span>
                  <h2>Chỉnh sửa bác sĩ</h2>
                  <p>Cập nhật tên hiển thị và thông tin liên hệ của tài khoản Doctor.</p>
                </div>
                <button type="button" className="modal-close" onClick={closeDoctorEditor}><FaTimes /></button>
              </div>

              <div className="doctor-editor-identity">
                <div className="doctor-editor-avatar"><FaUserMd /></div>
                <div><strong>Doctor {doctorForm.fullName || doctorForm.username || "Bác sĩ"}</strong><span>Quyền: Doctor</span></div>
              </div>

              <div className="doctor-editor-grid">
                <label><span>Họ và tên *</span><div className="editor-input"><FaUserMd /><input value={doctorForm.fullName} onChange={e => setDoctorForm(p => ({ ...p, fullName: e.target.value }))} placeholder="Ví dụ: Nguyễn Văn An" /></div></label>
                <label><span>Username *</span><div className="editor-input"><FaUserCog /><input value={doctorForm.username} onChange={e => setDoctorForm(p => ({ ...p, username: e.target.value }))} placeholder="doctor01" /></div></label>
                <label><span>Email</span><div className="editor-input"><FaEnvelope /><input type="email" value={doctorForm.email} onChange={e => setDoctorForm(p => ({ ...p, email: e.target.value }))} placeholder="doctor@doctis.vn" /></div></label>
                <label><span>Số điện thoại</span><div className="editor-input"><FaPhone /><input value={doctorForm.phone} onChange={e => setDoctorForm(p => ({ ...p, phone: e.target.value }))} placeholder="09xxxxxxxx" /></div></label>
              </div>

              <div className="doctor-editor-note"><FaShieldAlt /><span>Thay đổi tên ở đây sẽ đồng bộ với danh sách bác sĩ và tên bác sĩ phụ trách của bệnh nhân.</span></div>

              <div className="doctor-editor-actions">
                <button type="button" className="editor-cancel" onClick={closeDoctorEditor} disabled={savingDoctor}>Hủy</button>
                <button type="button" className="editor-save" onClick={saveDoctorProfile} disabled={savingDoctor}><FaSave /> {savingDoctor ? "Đang lưu..." : "Lưu thay đổi"}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({icon,label,value,note,tone}) {
  return <motion.div className={`admin-stat-card tone-${tone}`} whileHover={{y:-5}} transition={{duration:.2}}><div className="stat-top"><span className="stat-icon">{icon}</span><span className="stat-live"><i /> LIVE</span></div><strong>{value}</strong><h3>{label}</h3><p>{note}</p></motion.div>;
}
function RoleBadge({role}) {
  const map={admin:["admin","Admin"],doctor:["doctor","Doctor"],user:["user","Bệnh nhân"]}; const [cls,label]=map[role] || ["user",role || "Unknown"];
  return <span className={`role-badge ${cls}`}><i />{label}</span>;
}
function LoadingState({text}) { return <div className="empty-state"><span className="loader-orb" /><strong>{text}</strong></div>; }
function EmptyState({icon,title,text}) { return <div className="empty-state"><span className="empty-icon">{icon}</span><strong>{title}</strong><span>{text}</span></div>; }
