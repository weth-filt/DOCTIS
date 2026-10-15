import { useState } from "react";
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
} from "react-icons/fa";

import API from "../../services/api";
import Auth3DVisual from "../../components/Auth3DVisual";

export default function Register() {
  const nav = useNavigate();

  const [form, setForm] = useState({
    cccd: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const change = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const register = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;

    setErrorMessage("");
    setSuccessMessage("");

    if (!form.cccd || !form.username || !form.email || !form.password) {
      const msg = "Vui lòng điền đầy đủ các thông tin bắt buộc.";
      setErrorMessage(msg);
      alert(msg);
      return;
    }

    if (form.password !== form.confirmPassword) {
      const msg = "Mật khẩu xác nhận không khớp.";
      setErrorMessage(msg);
      alert(msg);
      return;
    }

    try {
      setLoading(true);
      const res = await API.post("/auth/register", form);
      const okMsg = res.data?.msg || "Đăng ký tài khoản thành công!";
      setSuccessMessage(okMsg);
      alert(okMsg);
      nav("/");
    } catch (err) {
      const errText =
        err.response?.data?.msg ||
        err.response?.data?.message ||
        "Đăng ký thất bại. Vui lòng thử lại.";
      setErrorMessage(errText);
      alert(errText);
    } finally {
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

          <form onSubmit={register} noValidate>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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

            <button
              type="submit"
              className="doc-btn doc-btn-primary auth-submit-btn"
              disabled={loading}
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
