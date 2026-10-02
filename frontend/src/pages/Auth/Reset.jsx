import { useParams } from "react-router-dom";
import { useState } from "react";
import API from "../../services/api";

export default function Reset() {
  const { token } = useParams();
  const [password, setPassword] = useState("");

  const reset = async () => {
    await API.post("/auth/reset", { token, password });
    alert("Đổi mật khẩu thành công");
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>🔒 Reset Password</h2>

        <input className="input" placeholder="New Password" onChange={e=>setPassword(e.target.value)} />

        <button className="btn" onClick={reset}>
          Reset
        </button>
      </div>
    </div>
  );
}