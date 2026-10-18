import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaArrowLeft, FaArrowRight, FaCalendarAlt, FaClock, FaUserMd } from "react-icons/fa";
import useLiveReducedMotion from "../useLiveReducedMotion";
import "../../CSS/patient-functions.css";

const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function AppointmentCountdown({ date }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const minutes = Math.ceil((new Date(date).getTime() - now) / 60000);
  if (!Number.isFinite(minutes)) return null;
  if (minutes <= 0) return <span className="appointment-countdown">Thời gian hẹn đã đến</span>;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return <span className="appointment-countdown"><FaClock aria-hidden="true" />{days ? `Còn ${days} ngày ${hours} giờ` : hours ? `Còn ${hours} giờ ${minutes % 60} phút` : `Còn ${minutes} phút`}</span>;
}

export default function AppointmentCalendar({ appointments = [], formatDate, formatTime, statusLabel }) {
  const reduced = useLiveReducedMotion();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(null);
  const [allDates, setAllDates] = useState(false);
  const records = useMemo(() => appointments.map((item) => ({ ...item, date: new Date(item.appointmentDate) })).filter((item) => Number.isFinite(item.date.getTime())).sort((a, b) => a.date - b.date), [appointments]);
  const [expanded, setExpanded] = useState(null);
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (month.getDay() + 6) % 7;
  const monthRecords = records.filter((item) => item.date.getFullYear() === month.getFullYear() && item.date.getMonth() === month.getMonth());
  const visible = allDates ? records : selectedDay ? monthRecords.filter((item) => dayKey(item.date) === selectedDay) : monthRecords;
  const today = dayKey(new Date());
  const changeMonth = (amount) => {
    setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1));
    setSelectedDay(null);
    setAllDates(false);
  };

  return <div className="appointment-studio">
    <section className="patient-function-intro appointment-intro"><span className="function-kicker">Kết nối chăm sóc</span><h2>Lịch hẹn của bạn</h2><p>Thời gian gặp bác sĩ, ghi chú và những cuộc hẹn đã được lưu.</p><span className="function-intro-count"><FaCalendarAlt /> {records.length} cuộc hẹn</span></section>
    <div className="appointment-workspace">
      <section className="appointment-month" aria-label="Lịch tháng">
        <div className="appointment-month-heading"><div><span>Lịch tháng</span><h3>{month.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}</h3></div><div><button type="button" onClick={() => changeMonth(-1)} aria-label="Tháng trước"><FaArrowLeft /></button><button type="button" onClick={() => changeMonth(1)} aria-label="Tháng sau"><FaArrowRight /></button></div></div>
        <div className="appointment-weekdays" aria-hidden="true">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label) => <span key={label}>{label}</span>)}</div>
        <AnimatePresence mode="wait" initial={false}><motion.div key={monthKey} className="appointment-days" initial={{ opacity: reduced ? 1 : 0, x: reduced ? 0 : 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: reduced ? 1 : 0 }} transition={{ duration: reduced ? 0 : .18 }}>
          {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const date = new Date(month.getFullYear(), month.getMonth(), index + 1);
            const key = dayKey(date);
            const count = monthRecords.filter((item) => dayKey(item.date) === key).length;
            return <button key={key} type="button" className={`${selectedDay === key && !allDates ? "selected " : ""}${today === key ? "is-today " : ""}${count ? "has-appointment" : ""}`} aria-pressed={selectedDay === key && !allDates} aria-label={`${date.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" })}${count ? `, ${count} cuộc hẹn` : ""}`} aria-current={today === key ? "date" : undefined} onClick={() => { setSelectedDay(selectedDay === key ? null : key); setAllDates(false); }}><span>{index + 1}</span>{count > 0 && <i aria-hidden="true" />}</button>;
          })}
        </motion.div></AnimatePresence>
        <div className="appointment-calendar-key"><span><i /> Có lịch hẹn</span><button type="button" onClick={() => { setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelectedDay(today); setAllDates(false); }}>Hôm nay</button></div>
      </section>
      <section className="appointment-agenda" aria-label="Danh sách lịch hẹn">
        <div className="appointment-agenda-heading"><div><span className="function-kicker">Cuộc hẹn đã lưu</span><h3>{allDates ? "Tất cả lịch hẹn" : selectedDay ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString("vi-VN", { day: "numeric", month: "long", year: "numeric" }) : "Trong tháng này"}</h3></div><button type="button" aria-pressed={allDates} onClick={() => { setAllDates(!allDates); setSelectedDay(null); }}>{allDates ? "Xem theo tháng" : "Xem tất cả"}</button></div>
        <div className="appointment-agenda-list"><AnimatePresence initial={false}>{visible.map((item, index) => {
          const id = item._id || `${item.appointmentDate}-${index}`;
          const opened = expanded === id;
          return <motion.article key={id} layout className="appointment-detail-card" initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .22 }}>
            <div className="appointment-date-block"><strong>{item.date.getDate()}</strong><span>{item.date.toLocaleDateString("vi-VN", { month: "short" })}</span></div>
            <div className="appointment-card-copy"><span className="appointment-status">{statusLabel?.(item.status) || item.status || "Chưa cập nhật"}</span><h4><FaUserMd /> {item.doctorId?.fullName || item.doctorId?.username || "Chưa cập nhật bác sĩ"}</h4><p><FaClock /> {formatTime ? formatTime(item.appointmentDate) : item.date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · {item.type || "Lịch khám"}</p>{item.date.getTime() >= Date.now() && <AppointmentCountdown date={item.appointmentDate} />}
              <button type="button" className="appointment-details-trigger" aria-expanded={opened} onClick={() => setExpanded(opened ? null : id)}>{opened ? "Thu gọn chi tiết" : "Xem chi tiết"}<FaArrowRight /></button>
              <AnimatePresence initial={false}>{opened && <motion.div className="appointment-more" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduced ? 0 : .22 }}><dl><div><dt>Ngày khám</dt><dd>{formatDate ? formatDate(item.appointmentDate) : item.date.toLocaleDateString("vi-VN")}</dd></div><div><dt>Ghi chú bác sĩ</dt><dd>{item.note || "Chưa có ghi chú."}</dd></div></dl></motion.div>}</AnimatePresence>
            </div>
          </motion.article>;
        })}</AnimatePresence>{!visible.length && <div className="appointment-empty-state"><FaCalendarAlt /><h4>Chưa có lịch hẹn{selectedDay ? " trong ngày này" : allDates ? "" : " trong tháng này"}</h4><p>Lịch hẹn được bác sĩ tạo sẽ xuất hiện tại đây.</p>{records.length > 0 && !allDates && <button type="button" onClick={() => setAllDates(true)}>Xem {records.length} cuộc hẹn đã lưu <FaArrowRight /></button>}</div>}</div>
      </section>
    </div>
  </div>;
}
