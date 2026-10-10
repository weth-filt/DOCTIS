import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
} from "react-router-dom";

/* =========================================================
   AUTH PAGES
   ========================================================= */

import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";
import Forgot from "./pages/Auth/Forgot";

/* =========================================================
   DASHBOARDS
   ========================================================= */

import Dashboard from "./pages/Dashboard/Dashboard";
import DoctorDashboard from "./pages/Dashboard/DoctorDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";

/* =========================================================
   ROUTE GUARDS
   ========================================================= */

import DoctorRoute from "./components/DoctorRoute";
import AdminRoute from "./components/AdminRoute";

/* =========================================================
   GLOBAL STYLES
   ========================================================= */

import "./CSS/index.css";
import "./CSS/auth.css";
import "./CSS/dashboard.css";
import "./CSS/doctor.css";
import "./CSS/dashboard-modern.css";
import "./CSS/health-clarity.css";

/*
|--------------------------------------------------------------------------
| ADMIN STYLE
|--------------------------------------------------------------------------
|
| CSS riêng cho:
| - Admin Dashboard
| - Assignment
| - User management
| - Doctor editor
| - Admin modal
|
|--------------------------------------------------------------------------
*/

import "./CSS/admin.css";
import "./CSS/clinical-theme.css";


function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* =================================================
            AUTH
        ================================================= */}

        <Route
          path="/"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/forgot"
          element={<Forgot />}
        />

        <Route
          path="/reset/:token"
          element={<Navigate to="/forgot" replace />}
        />


        {/* =================================================
            PATIENT
        ================================================= */}

        <Route
          path="/dashboard"
          element={<Dashboard />}
        />


        {/* =================================================
            DOCTOR
        ================================================= */}

        <Route
          path="/doctor"
          element={
            <DoctorRoute>
              <DoctorDashboard />
            </DoctorRoute>
          }
        />


        {/* =================================================
            ADMIN
        ================================================= */}

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
