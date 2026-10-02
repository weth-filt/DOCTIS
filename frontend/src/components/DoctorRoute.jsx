import { Navigate } from "react-router-dom";

export default function DoctorRoute({
  children,
}) {
  let user = null;

  try {
    user = JSON.parse(
      localStorage.getItem("user") ||
        "null"
    );
  } catch {
    user = null;
  }

  const token =
    localStorage.getItem("token");

  // Chưa đăng nhập
  if (!token || !user) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  // Không phải doctor
  if (user.role !== "doctor") {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return children;
}