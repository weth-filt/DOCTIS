import { useEffect, useRef, useState } from "react";
import { FaBell, FaSyncAlt, FaTimes } from "react-icons/fa";
import useNotifications from "./useNotifications";
import { entityId, localDate } from "./coordinationUtils";
import "../../CSS/coordination.css";

export default function NotificationInbox({ onOpen, enabled = true }) {
  const inbox = useNotifications(enabled);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const trigger = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const outside = event => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const key = event => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("mousedown", outside); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", key); };
  }, [open]);
  return <div className="coord-notifications" ref={ref}>
    <button ref={trigger} type="button" className="coord-bell" aria-label={`Thông báo${inbox.unreadCount ? `, ${inbox.unreadCount} chưa đọc` : ""}`} aria-expanded={open} onClick={() => setOpen(value => !value)}><FaBell aria-hidden="true" />{inbox.unreadCount > 0 && <span>{inbox.unreadCount > 99 ? "99+" : inbox.unreadCount}</span>}</button>
    {open && <section className="coord-inbox" aria-label="Danh sách thông báo"><header><div><strong>Thông báo của bạn</strong><small>Tự cập nhật khi trang đang hiển thị</small></div><button type="button" aria-label="Đóng thông báo" onClick={() => setOpen(false)}><FaTimes /></button></header>
      {inbox.error && <p className="coord-error" role="alert">{inbox.error}</p>}
      {inbox.loading && !inbox.notifications.length && <p role="status">Đang tải thông báo…</p>}
      {!inbox.loading && !inbox.notifications.length && <p className="coord-empty">Chưa có thông báo.</p>}
      <div className="coord-notification-list">{inbox.notifications.map(item => <button type="button" className={item.readAt ? "" : "is-unread"} key={entityId(item)} onClick={() => { inbox.markRead(item); setOpen(false); onOpen?.(item); }}><strong>{item.title || "Cập nhật DOCTIS"}</strong><span>{item.message}</span><time dateTime={item.createdAt}>{localDate(item.createdAt)}</time></button>)}</div>
      <footer><button type="button" onClick={inbox.refresh} disabled={inbox.loading}><FaSyncAlt aria-hidden="true" />{inbox.loading ? "Đang tải…" : "Cập nhật thông báo"}</button></footer>
    </section>}
  </div>;
}
