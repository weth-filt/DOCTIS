import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.clear();
    navigate("/");
  };

  return (
    <div style={{ padding: 15, background: "#111", color: "#fff" }}>
      <span>DOCTIS</span>
      <button onClick={logout} style={{ float: "right" }}>Logout</button>
    </div>
  );
}
