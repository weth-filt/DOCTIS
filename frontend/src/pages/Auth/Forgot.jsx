import { useState } from "react";
import API from "../../services/api";

export default function Forgot() {

  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    email: "",
    otp: "",
    password: "",
    confirmPassword: ""
  });

  const change = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  // GỬI OTP

  const sendOTP = async () => {

    try {

      const res = await API.post(
        "/auth/forgot",
        { email: form.email }
      );

      alert(res.data.msg);

      setStep(2);

    } catch (err) {

      alert(
        err.response?.data?.msg ||
        "Lỗi gửi OTP"
      );

    }

  };

  // XÁC THỰC OTP

  const verifyOTP = async () => {

    try {

      const res = await API.post(
        "/auth/verify",
        {
          email: form.email,
          otp: form.otp
        }
      );

      alert(res.data.msg);

      setStep(3);

    } catch (err) {

      alert(
        err.response?.data?.msg ||
        "OTP sai"
      );

    }

  };

  // ĐỔI MẬT KHẨU

  const resetPassword = async () => {

    try {

      const res = await API.post(
        "/auth/reset",
        {
          email: form.email,
          otp: form.otp,
          password: form.password,
          confirmPassword: form.confirmPassword
        }
      );

      alert(res.data.msg);

      window.location.href = "/";

    } catch (err) {

      alert(
        err.response?.data?.msg ||
        "Đổi mật khẩu thất bại"
      );

    }

  };

  return (

    <div className="auth-container">

      <div className="auth-card">

        <h2
          style={{
            marginBottom: "10px",
            textAlign: "center"
          }}
        >
          🔑 Forgot Password
        </h2>

        {/* STEP 1 */}

        {step === 1 && (
          <>
            <input
              className="input"
              placeholder="Nhập Gmail"
              name="email"
              value={form.email}
              onChange={change}
            />

            <button
              className="btn"
              onClick={sendOTP}
            >
              Gửi OTP
            </button>
          </>
        )}

        {/* STEP 2 */}

        {step === 2 && (
          <>
            <input
              className="input"
              placeholder="Nhập OTP"
              name="otp"
              value={form.otp}
              onChange={change}
            />

            <button
              className="btn"
              onClick={verifyOTP}
            >
              Xác thực OTP
            </button>
          </>
        )}

        {/* STEP 3 */}

        {step === 3 && (
          <>
            <input
              className="input"
              type="password"
              placeholder="Mật khẩu mới"
              name="password"
              value={form.password}
              onChange={change}
            />

            <input
              className="input"
              type="password"
              placeholder="Nhập lại mật khẩu"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={change}
              style={{ marginTop: "12px" }}
            />

            <button
              className="btn"
              onClick={resetPassword}
            >
              Đổi mật khẩu
            </button>
          </>
        )}

      </div>

    </div>

  );

}
