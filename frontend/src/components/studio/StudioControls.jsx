import { useEffect, useRef, useState } from "react";
import { FaAdjust, FaColumns, FaMoon, FaSun, FaMobileAlt } from "react-icons/fa";
import { useStudioPreferences } from "./StudioPreferences";
import useLiveReducedMotion from "../useLiveReducedMotion";

export default function StudioControls() {
  const preferences = useStudioPreferences();
  const reduced = useLiveReducedMotion();
  const [tiltSupported, setTiltSupported] = useState(false);
  const [tiltPending, setTiltPending] = useState(false);
  const [tiltStatus, setTiltStatus] = useState("");
  const alive = useRef(true);
  const available = useRef(false);
  available.current = tiltSupported && !reduced;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!window.matchMedia || typeof window.DeviceOrientationEvent === "undefined") return;
    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setTiltSupported(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  const toggleDeviceTilt = async () => {
    if (preferences.deviceTilt) { preferences.setDeviceTilt(false); setTiltStatus("Đã tắt nghiêng theo điện thoại."); return; }
    if (!available.current || tiltPending) return;
    setTiltPending(true);
    try {
      // This call runs only from an explicit button click, never on mount.
      if (typeof window.DeviceOrientationEvent.requestPermission === "function") {
        const permission = await window.DeviceOrientationEvent.requestPermission();
        if (permission !== "granted") { if (alive.current) setTiltStatus("Chưa được cấp quyền cảm biến. Bạn vẫn dùng giao diện bình thường."); return; }
      }
      if (alive.current && available.current) { preferences.setDeviceTilt(true); setTiltStatus("Đã bật nghiêng theo chuyển động điện thoại."); }
    } catch { if (alive.current) setTiltStatus("Không thể bật cảm biến trên trình duyệt này."); }
    finally { if (alive.current) setTiltPending(false); }
  };
  return <div className="studio-experience-controls" role="group" aria-label="Tùy chọn giao diện">
    <button type="button" className="studio-control-sidebar" onClick={preferences.toggleSidebarCollapsed} aria-pressed={preferences.sidebarCollapsed} aria-label={preferences.sidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"} title={preferences.sidebarCollapsed ? "Mở rộng điều hướng" : "Thu gọn điều hướng"}><FaColumns aria-hidden="true" /></button>
    <button type="button" onClick={preferences.toggleTheme} aria-pressed={preferences.theme === "dark"} aria-label={preferences.theme === "dark" ? "Bật giao diện sáng" : "Bật giao diện tối"} title={preferences.theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}>{preferences.theme === "dark" ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}</button>
    <button type="button" className="studio-control-simple" onClick={preferences.toggleSimpleUI} aria-pressed={preferences.simpleUI} title="Tắt 3D và chuyển động trang trí"><FaAdjust aria-hidden="true" /><span>Giao diện đơn giản</span></button>
    {tiltSupported && !reduced && <button type="button" className="studio-control-tilt" onClick={toggleDeviceTilt} disabled={tiltPending} aria-busy={tiltPending} aria-pressed={preferences.deviceTilt} aria-label={preferences.deviceTilt ? "Tắt nghiêng theo chuyển động điện thoại" : "Bật nghiêng theo chuyển động điện thoại"} title="Nghiêng trái tim theo điện thoại"><FaMobileAlt aria-hidden="true" /></button>}
    {tiltStatus && <p className="studio-control-status" role="status">{tiltStatus}</p>}
  </div>;
}
