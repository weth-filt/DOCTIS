import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaHeartbeat,
  FaEnvelope,
  FaLock,
  FaUser,
  FaIdCard,
  FaUserPlus,
  FaExclamationCircle,
  FaCheckCircle,
  FaCity,
  FaMapMarkerAlt,
} from "react-icons/fa";

import API from "../../services/api";
import Auth3DVisual from "../../components/Auth3DVisual";
import { createRequestKey, entityId } from "../../components/coordination/coordinationUtils";
import "../../CSS/register.css";

export default function Register() {
  const nav = useNavigate();

  const [form, setForm] = useState({
    cccd: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    address: "",
    wardId: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [wards, setWards] = useState([]);
  const [wardsLoading, setWardsLoading] = useState(true);
  const [wardsError, setWardsError] = useState("");
  const submitLock = useRef(false);
  const registrationAttempt = useRef(null);
  const loadWards = useCallback(async signal => {
    setWardsLoading(true); setWardsError("");
    try { const response = await API.get("/public/wards", { signal }); if (!signal?.aborted) setWards(response.data?.wards || []); }
    catch { if (!signal?.aborted) setWardsError("Chưa tải được danh mục phường. Bạn hãy thử lại."); }
    finally { if (!signal?.aborted) setWardsLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); loadWards(controller.signal); return () => controller.abort(); }, [loadWards]);

  const change = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const register = async (e) => {
    if (e) e.preventDefault();
    if (submitLock.current || loading) return;

    setErrorMessage("");
    setSuccessMessage("");

    if (!form.cccd.trim() || !form.username.trim() || !form.email.trim() || !form.password || !form.address.trim() || !wards.some(ward => entityId(ward) === form.wardId)) {
      const msg = "Vui lòng điền đầy đủ các thông tin bắt buộc.";
      setErrorMessage(msg);
      return;
    }

    if (form.password !== form.confirmPassword) {
      const msg = "Mật khẩu xác nhận không khớp.";
      setErrorMessage(msg);
      return;
    }
    if (!/^\d{12}$/.test(form.cccd.trim())) { setErrorMessage("Số CCCD / định danh cần đủ 12 chữ số."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setErrorMessage("Vui lòng nhập email hợp lệ."); return; }
    if (form.password.length < 6) { setErrorMessage("Mật khẩu cần ít nhất 6 ký tự."); return; }

    submitLock.current = true;
    try {
      setLoading(true);
      const payload = { ...form, cccd: form.cccd.trim(), username: form.username.trim(), email: form.email.trim(), address: form.address.trim(), city: "Đà Nẵng" };
      const signature = JSON.stringify(payload);
      if (registrationAttempt.current?.signature !== signature) registrationAttempt.current = { signature, requestId: createRequestKey() };
      const res = await API.post("/auth/register", { ...payload, requestId: registrationAttempt.current.requestId });
      const okMsg = res.data?.msg || "Đăng ký tài khoản thành công!";
      setSuccessMessage(okMsg);
      nav("/");
    } catch (err) {
      const errText =
        err.response?.data?.msg ||
        err.response?.data?.message ||
        "Đăng ký thất bại. Vui lòng thử lại.";
      setErrorMessage(errText);
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="doctis-auth-page">
      {/* Vùng thương hiệu & 3D Visual bên trái */}
      <section className="doctis-auth-brand-panel" aria-label="Giới thiệu DOCTIS">
        <header className="auth-brand-top">
          <div className="auth-logo-badge">
            <div className="auth-logo-icon-box">
              <FaHeartbeat />
            </div>
            <div>
              <div className="auth-logo-text">DOCTIS</div>
              <div className="auth-logo-tagline">Nền tảng Y tế Thông minh</div>
            </div>
          </div>
        </header>

        <Auth3DVisual />

        <footer className="auth-brand-footer">
          <small style={{ color: "rgba(255, 255, 255, 0.7)", fontSize: "13px" }}>
            © {new Date().getFullYear()} DOCTIS Healthcare. Đồng hành cùng sức khỏe của bạn.
          </small>
        </footer>
      </section>

      {/* Vùng form đăng ký bên phải */}
      <main className="doctis-auth-form-panel">
        <motion.div
          className="auth-form-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <header className="auth-header">
            <h1>Tạo tài khoản mới</h1>
            <p>Bắt đầu hành trình theo dõi và chăm sóc sức khỏe thông minh</p>
          </header>

          {errorMessage && (
            <div className="doc-alert doc-alert-danger" role="alert">
              <FaExclamationCircle className="doc-alert-icon" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="doc-alert doc-alert-success" role="alert">
              <FaCheckCircle className="doc-alert-icon" />
              <span>{successMessage}</span>
            </div>
          )}

          <form className="auth-register-form" onSubmit={register} noValidate>
            <div className="register-field-row">
              <div className="doc-field">
                <label className="doc-label" htmlFor="reg-cccd">
                  Số CCCD / Định danh
                </label>
                <div className="doc-input-wrapper">
                  <FaIdCard className="doc-input-icon" aria-hidden="true" />
                  <input
                    id="reg-cccd"
                    className="doc-input doc-input-with-icon"
                    placeholder="12 chữ số"
                    name="cccd"
                    value={form.cccd}
                    onChange={change}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="doc-field">
                <label className="doc-label" htmlFor="reg-username">
                  Tên người dùng
                </label>
                <div className="doc-input-wrapper">
                  <FaUser className="doc-input-icon" aria-hidden="true" />
                  <input
                    id="reg-username"
                    className="doc-input doc-input-with-icon"
                    placeholder="nguyenvana"
                    name="username"
                    value={form.username}
                    onChange={change}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="doc-field">
              <label className="doc-label" htmlFor="reg-email">
                Địa chỉ Email
              </label>
              <div className="doc-input-wrapper">
                <FaEnvelope className="doc-input-icon" aria-hidden="true" />
                <input
                  id="reg-email"
                  type="email"
                  className="doc-input doc-input-with-icon"
                  placeholder="name@example.com"
                  name="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={change}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="register-field-row">
              <div className="doc-field">
                <label className="doc-label" htmlFor="reg-password">
                  Mật khẩu
                </label>
                <div className="doc-input-wrapper">
                  <FaLock className="doc-input-icon" aria-hidden="true" />
                  <input
                    id="reg-password"
                    type="password"
                    className="doc-input doc-input-with-icon"
                    placeholder="Tối thiểu 6 ký tự"
                    name="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={change}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="doc-field">
                <label className="doc-label" htmlFor="reg-confirm">
                  Xác nhận
                </label>
                <div className="doc-input-wrapper">
                  <FaLock className="doc-input-icon" aria-hidden="true" />
                  <input
                    id="reg-confirm"
                    type="password"
                    className="doc-input doc-input-with-icon"
                    placeholder="Nhập lại mật khẩu"
                    name="confirmPassword"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={change}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="register-field-row">
              <div className="doc-field">
                <label className="doc-label" htmlFor="reg-city">Thành phố</label>
                <div className="doc-input-wrapper">
                  <FaCity className="doc-input-icon" aria-hidden="true" />
                  <input id="reg-city" className="doc-input doc-input-with-icon" value="Đà Nẵng" readOnly />
                </div>
              </div>
              <div className="doc-field">
                <label className="doc-label" htmlFor="reg-ward">Phường *</label>
                <div className="doc-input-wrapper">
                  <FaMapMarkerAlt className="doc-input-icon" aria-hidden="true" />
                  <select id="reg-ward" className="doc-input doc-input-with-icon" name="wardId" value={form.wardId} onChange={change} disabled={loading || wardsLoading || !wards.length} aria-describedby="reg-ward-feedback">
                    <option value="">{wardsLoading ? "Đang tải phường…" : "Chọn phường"}</option>
                    {wards.map(ward => <option key={entityId(ward)} value={entityId(ward)}>{ward.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="doc-field">
              <label className="doc-label" htmlFor="reg-address">Địa chỉ chi tiết *</label>
              <div className="doc-input-wrapper">
                <FaMapMarkerAlt className="doc-input-icon" aria-hidden="true" />
                <input id="reg-address" className="doc-input doc-input-with-icon" name="address" value={form.address} onChange={change} maxLength={500} autoComplete="street-address" placeholder="Số nhà, tên đường, tổ hoặc khu dân cư" disabled={loading} />
              </div>
            </div>

            <div id="reg-ward-feedback" className="register-catalog-feedback" aria-live="polite">
              {wardsError && <p className="register-catalog-error" role="alert">{wardsError}</p>}
              {!wardsLoading && !wards.length && <p>Danh mục phường chưa được cấu hình. Admin cần bổ sung dữ liệu đã xác minh trước khi tiếp nhận đăng ký mới.</p>}
              {(wardsError || !wards.length) && !wardsLoading && <button className="auth-link" type="button" onClick={() => loadWards()}>Tải lại danh mục phường</button>}
            </div>
            <p className="register-service-note">Admin sẽ đối chiếu địa chỉ và cập nhật bệnh viện hỗ trợ sau khi bạn đăng ký. Bác sĩ được ghi nhận sau bước bệnh viện tiếp nhận.</p>

            <button
              type="submit"
              className="doc-btn doc-btn-primary auth-submit-btn"
              disabled={loading || wardsLoading || !wards.length}
            >
              {loading ? (
                "Đang đăng ký..."
              ) : (
                <>
                  <FaUserPlus /> Hoàn tất đăng ký
                </>
              )}
            </button>
          </form>

          <footer className="auth-footer-links">
            <p className="auth-link">
              Đã có tài khoản DOCTIS?{" "}
              <button
                type="button"
                className="auth-link"
                onClick={() => nav("/")}
              >
                <strong>Đăng nhập ngay</strong>
              </button>
            </p>
          </footer>
        </motion.div>
      </main>
    </div>
  );
}
