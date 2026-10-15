import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaHeartbeat,
  FaEnvelope,
  FaKey,
  FaLock,
  FaCheckCircle,
  FaExclamationCircle,
  FaArrowLeft,
} from "react-icons/fa";

import API from "../../services/api";
import Auth3DVisual from "../../components/Auth3DVisual";

export default function Forgot() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [form, setForm] = useState({
    email: "",
    otp: "",
    password: "",
    confirmPassword: "",
  });

  const change = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // BƯỚC 1: GỬI OTP
  const sendOTP = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;

    setErrorMessage("");
    setSuccessMessage("");

    if (!form.email.trim()) {
      const msg = "Vui lòng nhập địa chỉ email đã đăng ký.";
      setErrorMessage(msg);
      alert(msg);
      return;
    }

    try {
      setLoading(true);
      const res = await API.post("/auth/forgot", { email: form.email.trim() });
      const okMsg = res.data?.msg || "Mã xác thực OTP đã được gửi đến email của bạn.";
      setSuccessMessage(okMsg);
      alert(okMsg);
      setStep(2);
    } catch (err) {
      const errText = err.response?.data?.msg || "Lỗi gửi mã OTP. Vui lòng kiểm tra lại email.";
      setErrorMessage(errText);
      alert(errText);
    } finally {
      setLoading(false);
    }
  };

  // BƯỚC 2: XÁC THỰC OTP
  const verifyOTP = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;

    setErrorMessage("");
    setSuccessMessage("");

    if (!form.otp.trim()) {
      const msg = "Vui lòng nhập mã OTP nhận được trong email.";
      setErrorMessage(msg);
      alert(msg);
      return;
    }

    try {
      setLoading(true);
      const res = await API.post("/auth/verify", {
        email: form.email.trim(),
        otp: form.otp.trim(),
      });
      const okMsg = res.data?.msg || "Mã OTP hợp lệ! Vui lòng đặt mật khẩu mới.";
      setSuccessMessage(okMsg);
      alert(okMsg);
      setStep(3);
    } catch (err) {
      const errText = err.response?.data?.msg || "Mã OTP không chính xác hoặc đã hết hạn.";
      setErrorMessage(errText);
      alert(errText);
    } finally {
      setLoading(false);
    }
  };

  // BƯỚC 3: ĐỔI MẬT KHẨU
  const resetPassword = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;

    setErrorMessage("");
    setSuccessMessage("");

    if (!form.password || !form.confirmPassword) {
      const msg = "Vui lòng nhập đầy đủ mật khẩu mới và xác nhận mật khẩu.";
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
      const res = await API.post("/auth/reset", {
        email: form.email.trim(),
        otp: form.otp.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      const okMsg = res.data?.msg || "Đặt lại mật khẩu thành công!";
      setSuccessMessage(okMsg);
      alert(okMsg);
      window.location.href = "/";
    } catch (err) {
      const errText = err.response?.data?.msg || "Đổi mật khẩu thất bại. Vui lòng thử lại.";
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
            © {new Date().getFullYear()} DOCTIS Healthcare. Quy trình khôi phục tài khoản an toàn.
          </small>
        </footer>
      </section>

      {/* Vùng form khôi phục mật khẩu bên phải */}
      <main className="doctis-auth-form-panel">
        <motion.div
          className="auth-form-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <header className="auth-header">
            <h1>Khôi phục mật khẩu</h1>
            <p>
              {step === 1 && "Nhập email của bạn để nhận mã xác thực một lần (OTP)"}
              {step === 2 && "Nhập mã OTP gồm 6 chữ số đã gửi tới hòm thư của bạn"}
              {step === 3 && "Thiết lập mật khẩu bảo mật mới cho tài khoản DOCTIS"}
            </p>

            {/* Step Progress Pills */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "16px",
                marginBottom: "8px",
              }}
            >
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  style={{
                    flex: 1,
                    height: "4px",
                    borderRadius: "2px",
                    background:
                      s === step
                        ? "var(--doc-primary)"
                        : s < step
                        ? "var(--doc-success)"
                        : "var(--doc-border)",
                    transition: "background 0.25s ease",
                  }}
                />
              ))}
            </div>
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

          {/* BƯỚC 1: NHẬP EMAIL */}
          {step === 1 && (
            <form onSubmit={sendOTP} noValidate>
              <div className="doc-field">
                <label className="doc-label" htmlFor="forgot-email">
                  Địa chỉ Email tài khoản
                </label>
                <div className="doc-input-wrapper">
                  <FaEnvelope className="doc-input-icon" aria-hidden="true" />
                  <input
                    id="forgot-email"
                    type="email"
                    className="doc-input doc-input-with-icon"
                    placeholder="name@example.com"
                    name="email"
                    value={form.email}
                    onChange={change}
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="doc-btn doc-btn-primary auth-submit-btn"
                disabled={loading}
              >
                {loading ? "Đang gửi mã OTP..." : "Gửi mã xác thực OTP"}
              </button>
            </form>
          )}

          {/* BƯỚC 2: NHẬP OTP */}
          {step === 2 && (
            <form onSubmit={verifyOTP} noValidate>
              <div className="doc-field">
                <label className="doc-label" htmlFor="forgot-otp">
                  Mã xác thực OTP
                </label>
                <div className="doc-input-wrapper">
                  <FaKey className="doc-input-icon" aria-hidden="true" />
                  <input
                    id="forgot-otp"
                    className="doc-input doc-input-with-icon"
                    placeholder="Nhập mã OTP"
                    name="otp"
                    value={form.otp}
                    onChange={change}
                    disabled={loading}
                    autoComplete="one-time-code"
                  />
                </div>
                <small style={{ color: "var(--doc-subtext)", fontSize: "12px", marginTop: "4px" }}>
                  Mã đã được gửi tới <strong>{form.email}</strong>. Vui lòng kiểm tra cả hòm thư spam.
                </small>
              </div>

              <button
                type="submit"
                className="doc-btn doc-btn-primary auth-submit-btn"
                disabled={loading}
              >
                {loading ? "Đang xác thực..." : "Xác nhận mã OTP"}
              </button>

              <button
                type="button"
                className="doc-btn doc-btn-ghost"
                style={{ width: "100%", marginTop: "10px" }}
                onClick={() => setStep(1)}
              >
                Gửi lại mã OTP
              </button>
            </form>
          )}

          {/* BƯỚC 3: MẬT KHẨU MỚI */}
          {step === 3 && (
            <form onSubmit={resetPassword} noValidate>
              <div className="doc-field">
                <label className="doc-label" htmlFor="forgot-new-pwd">
                  Mật khẩu mới
                </label>
                <div className="doc-input-wrapper">
                  <FaLock className="doc-input-icon" aria-hidden="true" />
                  <input
                    id="forgot-new-pwd"
                    type="password"
                    className="doc-input doc-input-with-icon"
                    placeholder="Nhập mật khẩu mới"
                    name="password"
                    value={form.password}
                    onChange={change}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="doc-field">
                <label className="doc-label" htmlFor="forgot-confirm-pwd">
                  Xác nhận mật khẩu mới
                </label>
                <div className="doc-input-wrapper">
                  <FaLock className="doc-input-icon" aria-hidden="true" />
                  <input
                    id="forgot-confirm-pwd"
                    type="password"
                    className="doc-input doc-input-with-icon"
                    placeholder="Nhập lại mật khẩu mới"
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={change}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="doc-btn doc-btn-primary auth-submit-btn"
                disabled={loading}
              >
                {loading ? "Đang lưu..." : "Lưu mật khẩu mới"}
              </button>
            </form>
          )}

          <footer className="auth-footer-links">
            <button
              type="button"
              className="auth-link"
              onClick={() => nav("/")}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
            >
              <FaArrowLeft style={{ fontSize: "12px" }} /> Quay lại Đăng nhập
            </button>
          </footer>
        </motion.div>
      </main>
    </div>
  );
}
