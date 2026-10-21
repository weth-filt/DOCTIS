import "./workspaceStyles";
import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
} from "react-router-dom";
import { Component, lazy, Suspense } from "react";
import { loadPatientWorkspace, loadDoctorWorkspace, loadAdminWorkspace } from "./services/workspacePages";

/* =========================================================
   AUTH PAGES
   ========================================================= */

import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";
import Forgot from "./pages/Auth/Forgot";

/* =========================================================
   DASHBOARDS
   ========================================================= */

/* =========================================================
   ROUTE GUARDS
   ========================================================= */

import DoctorRoute from "./components/DoctorRoute";
import AdminRoute from "./components/AdminRoute";
import { StudioPreferencesProvider } from "./components/studio/StudioPreferences";
import { HeartSceneProvider } from "./components/3d/HeartScene";
import PatientWelcomeGate from "./components/studio/PatientWelcomeGate";

/* =========================================================
   GLOBAL STYLES
   ========================================================= */

import "./CSS/doctis-system.css";
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
import "./CSS/studio-experience.css";

const Dashboard = lazy(loadPatientWorkspace);
const DoctorDashboard = lazy(loadDoctorWorkspace);
const AdminDashboard = lazy(loadAdminWorkspace);

function WorkspaceLoading() {
  return <main className="workspace-loading" role="status" aria-live="polite"><span aria-hidden="true" /><h1>Đang mở không gian chăm sóc…</h1><p>Đang tải giao diện của bạn.</p></main>;
}

class WorkspaceBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="workspace-loading" role="alert"><h1>Chưa mở được giao diện</h1><p>Kiểm tra kết nối mạng rồi tải lại trang.</p><button type="button" onClick={() => window.location.reload()}>Tải lại</button></main>;
    return this.props.children;
  }
}

function WorkspaceReady({ children }) {
  return <WorkspaceBoundary><Suspense fallback={<WorkspaceLoading />}>{children}</Suspense></WorkspaceBoundary>;
}

function App() {
  return (
    <StudioPreferencesProvider><HeartSceneProvider><BrowserRouter>
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
          element={<PatientWelcomeGate><WorkspaceReady><Dashboard /></WorkspaceReady></PatientWelcomeGate>}
        />


        {/* =================================================
            DOCTOR
        ================================================= */}

        <Route
          path="/doctor"
          element={
            <DoctorRoute>
              <WorkspaceReady><DoctorDashboard /></WorkspaceReady>
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
              <WorkspaceReady><AdminDashboard /></WorkspaceReady>
            </AdminRoute>
          }
        />

      </Routes>
    </BrowserRouter></HeartSceneProvider></StudioPreferencesProvider>
  );
}

export default App;
