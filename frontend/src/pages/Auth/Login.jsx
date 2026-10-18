import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaHeartbeat,
  FaLock,
  FaEnvelope,
  FaExclamationCircle,
  FaArrowRight,
  FaSignInAlt,
} from "react-icons/fa";

import API from "../../services/api";
import Auth3DVisual from "../../components/Auth3DVisual";
import { beginPatientWelcome, completePatientWelcome } from "../../components/studio/patientWelcomeSession";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const nav = useNavigate();

  const login = async () => {
    if (loading) return;
    setErrorMessage("");

    const emailValue = email.trim().toLowerCase();

    if (!emailValue || !password) {
      const msg = "Vui lòng nhập đầy đủ email và mật khẩu.";
      setErrorMessage(msg);
      alert(msg);
      return;
    }

    try {
      setLoading(true);

      const res = await API.post("/auth/login", {
        email: emailValue,
        password,
      });

      const token = res.data?.token;
      const role = res.data?.role;

      if (!token) {
        const failMsg = "Đăng nhập thất bại: server không trả về token.";
        setErrorMessage(failMsg);
        alert(failMsg);
        return;
      }

      const returnedUser = res.data?.user || {};
      const userData = {
        id: res.data?.id || res.data?._id || returnedUser.id || returnedUser._id || "",
        _id: res.data?._id || res.data?.id || returnedUser._id || returnedUser.id || "",
        username: res.data?.username || returnedUser.username || "",
        fullName: res.data?.fullName || returnedUser.fullName || "",
        email: res.data?.email || returnedUser.email || emailValue,
        role: role || "user",
        token,
      };

      // Lưu token và user data
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(userData));

      if (role === "admin") {
        completePatientWelcome();
        nav("/admin", { replace: true });
      } else if (role === "doctor") {
        completePatientWelcome();
        nav("/doctor", { replace: true });
      } else {
        beginPatientWelcome();
        nav("/dashboard", { replace: true });
      }
    } catch (err) {
      const errText =
        err.response?.data?.msg ||
        err.response?.data?.message ||
        "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.";
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

      {/* Vùng thao tác đăng nhập bên phải */}
      <main className="doctis-auth-form-panel">
        <motion.div
          className="auth-form-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <header className="auth-header">
            <h1>Đăng nhập</h1>
            <p>Truy cập bảng điều khiển sức khỏe cá nhân của bạn</p>
          </header>

          {errorMessage && (
            <div className="doc-alert doc-alert-danger" role="alert">
              <FaExclamationCircle className="doc-alert-icon" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              login();
            }}
            noValidate
          >
            <div className="doc-field">
              <label className="doc-label" htmlFor="login-email">
                Địa chỉ Email
              </label>
              <div className="doc-input-wrapper">
                <FaEnvelope className="doc-input-icon" aria-hidden="true" />
                <input
                  id="login-email"
                  className="doc-input doc-input-with-icon"
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="doc-field">
              <label className="doc-label" htmlFor="login-password">
                <span>Mật khẩu</span>
                <button
                  type="button"
                  className="auth-link"
                  style={{ fontSize: "13px" }}
                  onClick={() => nav("/forgot")}
                >
                  Quên mật khẩu?
                </button>
              </label>
              <div className="doc-input-wrapper">
                <FaLock className="doc-input-icon" aria-hidden="true" />
                <input
                  id="login-password"
                  type="password"
                  className="doc-input doc-input-with-icon"
                  placeholder="Nhập mật khẩu"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="doc-btn doc-btn-primary auth-submit-btn"
              disabled={loading}
            >
              {loading ? (
                "Đang đăng nhập..."
              ) : (
                <>
                  <FaSignInAlt /> Đăng nhập
                </>
              )}
            </button>
          </form>

          <footer className="auth-footer-links">
            <p className="auth-link">
              Chưa có tài khoản?{" "}
              <button
                type="button"
                className="auth-link"
                onClick={() => nav("/register")}
              >
                <strong>Đăng ký ngay <FaArrowRight style={{ fontSize: "11px", marginLeft: "2px" }} /></strong>
              </button>
            </p>
          </footer>
        </motion.div>
      </main>
    </div>
  );
}
