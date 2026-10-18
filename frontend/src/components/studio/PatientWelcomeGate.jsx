import { useEffect, useRef, useState } from "react";
import { FaHeartbeat } from "react-icons/fa";
import HeartScene from "../3d/HeartScene";
import { useStudioPreferences } from "./StudioPreferences";
import { completePatientWelcome, hasPendingPatientWelcome } from "./patientWelcomeSession";

function signedInPatient() {
  try {
    if (!window.localStorage.getItem("token")) return null;
    const user = JSON.parse(window.localStorage.getItem("user") || "null");
    if (!user || typeof user !== "object" || Array.isArray(user) || ["doctor", "admin"].includes(user.role)) return null;
    return user;
  } catch { return null; }
}

export function PatientWelcomeScreen({ name, onContinue }) {
  const skip = useRef(null);
  const { theme, simpleUI } = useStudioPreferences();
  useEffect(() => { skip.current?.focus({ preventScroll: true }); }, []);
  return <main className="patient-welcome-page" data-studio-theme={theme} data-studio-simple={String(simpleUI)} aria-labelledby="patient-welcome-title">
    <div className="studio-intro-door studio-intro-door-left" aria-hidden="true" />
    <div className="studio-intro-door studio-intro-door-right" aria-hidden="true" />
    <div className="studio-intro-glow" aria-hidden="true" />
    <div className="studio-intro-content">
      <span className="studio-intro-brand"><FaHeartbeat aria-hidden="true" /> DOCTIS</span>
      <div className="studio-intro-heart"><HeartScene priority={100} status="neutral" /></div>
      <p>KHÔNG GIAN CHĂM SÓC CỦA BẠN</p>
      <h2 id="patient-welcome-title">Xin chào, <span>{name}</span></h2>
      <small>Tiếp tục hành trình sức khỏe.</small>
    </div>
    <button ref={skip} type="button" className="studio-intro-skip" onClick={onContinue}>Bỏ qua <span aria-hidden="true">→</span></button>
  </main>;
}

export default function PatientWelcomeGate({ children }) {
  const [pending, setPending] = useState(hasPendingPatientWelcome);
  const [patient] = useState(signedInPatient);
  const continueToDashboard = () => {
    completePatientWelcome();
    setPending(false);
  };
  // The dashboard (including its effects/data requests) is not mounted behind
  // this welcome. Reloading a pending welcome does not dismiss it.
  if (pending && patient) return <PatientWelcomeScreen name={patient.fullName || patient.username || "bạn"} onContinue={continueToDashboard} />;
  return children;
}
