const cron = require("node-cron");
const crypto = require("node:crypto");
const Reminder = require("../models/Reminder");
const Appointment = require("../models/Appointment");
const sendReminderEmail = require("./emailService");
const TIME_ZONE = "Asia/Ho_Chi_Minh";
function vietnamClock(now) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const values = Object.fromEntries(parts.map(item => [item.type, item.value]));
  return { today: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}
function createReminderRunner({ ReminderModel = Reminder, AppointmentModel = Appointment, mail = sendReminderEmail, now = () => new Date() } = {}) {
  return async function runReminderTick() {
    const at = now(), { today, time } = vietnamClock(at);
    const rows = await ReminderModel.find({ time, enabled: true }).select("_id scheduleDate source repeat appointmentId").lean();
    let sent = 0, skipped = 0, failed = 0;
    for (const row of rows) {
      let leased, appointmentLock;
      const lease = crypto.randomUUID();
      try {
        if (row.scheduleDate && row.scheduleDate !== today) {
          if (row.scheduleDate < today) await ReminderModel.updateOne({ _id: row._id, enabled: true }, { $set: { enabled: false } });
          skipped += 1; continue;
        }
        if (!row.scheduleDate && (row.repeat === "once" || row.source?.includes("CARE_PLAN") || row.appointmentId)) { skipped += 1; continue; }
        leased = await ReminderModel.findOneAndUpdate({ _id: row._id, enabled: true, lastSentDate: { $ne: today }, $or: [{ sendLeaseUntil: null }, { sendLeaseUntil: { $lt: at } }] }, { $set: { sendLease: lease, sendLeaseUntil: new Date(at.getTime() + 120000) } }, { new: true }).populate("userId", "email username fullName").lean();
        if (!leased) { skipped += 1; continue; }
        if (leased.appointmentId) {
          const acquired = await AppointmentModel.findOneAndUpdate({ _id: leased.appointmentId, patientId: leased.userId?._id, status: { $in: ["pending", "approved"] }, $or: [{ operationLock: null }, { operationLockAt: { $lt: new Date(at.getTime() - 120000) } }] }, { $set: { operationLock: lease, operationLockAt: at } }, { new: true }).lean();
          if (!acquired) {
            if (!await AppointmentModel.exists({ _id: leased.appointmentId, status: { $in: ["pending", "approved"] } })) await ReminderModel.updateOne({ _id: leased._id }, { $set: { enabled: false } });
            skipped += 1; continue;
          }
          appointmentLock = acquired._id;
        }
        if (!leased.userId?.email) { skipped += 1; continue; }
        const successful = await mail(leased.userId.email, [leased], leased.userId.fullName || leased.userId.username);
        if (successful !== true) throw new Error("EMAIL_NOT_CONFIRMED");
        await ReminderModel.updateOne({ _id: leased._id, sendLease: lease }, { $set: { lastSentDate: today, ...(leased.scheduleDate || leased.repeat === "once" ? { enabled: false } : {}) } });
        sent += 1;
      } catch { failed += 1; }
      finally {
        if (appointmentLock) await AppointmentModel.updateOne({ _id: appointmentLock, operationLock: lease }, { $set: { operationLock: null, operationLockAt: null } }).catch(() => {});
        if (leased) await ReminderModel.updateOne({ _id: leased._id, sendLease: lease }, { $set: { sendLease: null, sendLeaseUntil: null } }).catch(() => {});
      }
    }
    return { sent, skipped, failed };
  };
}
const runReminderTick = createReminderRunner();
let started = false;
const startCron = () => {
  if (started) return;
  started = true;
  return cron.schedule("* * * * *", () => runReminderTick().catch(() => console.error("REMINDER_TICK_FAILED")), { timezone: TIME_ZONE });
};
module.exports = startCron;
module.exports.createReminderRunner = createReminderRunner;
module.exports.runReminderTick = runReminderTick;
module.exports.vietnamClock = vietnamClock;
