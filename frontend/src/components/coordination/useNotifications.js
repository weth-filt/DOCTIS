import { useCallback, useEffect, useRef, useState } from "react";
import API from "../../services/api";
import { entityId, errorText } from "./coordinationUtils";

// Controlled polling, not a persistent socket. Hidden pages do not request
// notifications; a visible page refreshes immediately after returning.
export default function useNotifications(enabled = true) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const reload = useRef(null);
  const alive = useRef(false);
  useEffect(() => {
    if (!enabled) return undefined;
    alive.current = true;
    let timer, controller, running = false, failures = 0, disposed = false;
    const schedule = delay => { clearTimeout(timer); timer = setTimeout(read, delay); };
    const read = async () => {
      if (disposed || running) return;
      if (document.visibilityState === "hidden") { schedule(60000); return; }
      running = true; controller = new AbortController(); setLoading(true);
      try {
        const response = await API.get("/notifications", { params: { limit: 30 }, signal: controller.signal });
        if (disposed || controller.signal.aborted) return;
        setNotifications(Array.isArray(response.data?.notifications) ? response.data.notifications : []);
        setUnreadCount(Number.isFinite(response.data?.unreadCount) ? response.data.unreadCount : 0);
        setError(""); failures = 0;
      } catch (failure) {
        if (!disposed && !controller.signal.aborted) { setError(errorText(failure, "Chưa tải được thông báo. Hệ thống sẽ thử lại.")); failures += 1; }
      } finally {
        running = false;
        if (!disposed) { setLoading(false); schedule(Math.min(120000, 10000 * 2 ** failures)); }
      }
    };
    const visible = () => { if (document.visibilityState !== "hidden") { clearTimeout(timer); read(); } };
    reload.current = read;
    read(); document.addEventListener("visibilitychange", visible);
    return () => { disposed = true; alive.current = false; reload.current = null; clearTimeout(timer); controller?.abort(); document.removeEventListener("visibilitychange", visible); };
  }, [enabled]);
  const refresh = useCallback(() => reload.current?.(), []);
  const markRead = useCallback(async notification => {
    const id = entityId(notification);
    if (!id || notification.readAt) return;
    try {
      const response = await API.patch(`/notifications/${encodeURIComponent(id)}/read`, {});
      if (!alive.current) return;
      const updated = response.data?.notification;
      if (updated?.readAt) {
        setNotifications(old => old.map(item => entityId(item) === id ? updated : item));
        setUnreadCount(count => Math.max(0, count - 1));
      }
    } catch (failure) { if (alive.current) setError(errorText(failure, "Chưa đánh dấu được thông báo đã đọc.")); }
  }, []);
  return { notifications, unreadCount, loading, error, refresh, markRead };
}
