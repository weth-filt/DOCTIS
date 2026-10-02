import { Navigate } from "react-router-dom";

const getUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "null"); }
  catch { return null; }
};

export default function AdminRoute({ children }) {
  const user = getUser();
  const token = localStorage.getItem("token") || user?.token || "";

  if (!token || !user) return <Navigate to="/" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}
