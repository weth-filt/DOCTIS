const Reminder = require("../models/Reminder");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const assignment = require("../middlewares/assignmentAccess");
const { sendMail } = require("../utils/mailer");
const { dateIsValid } = require("../services/carePlanPersistence");

function normalizeReminder(body, previous = {}) {
  const value = { ...previous };
  for (const field of ["title", "description", "time", "activityType", "dayLabel", "scheduleDate", "repeat", "enabled"]) if (Object.hasOwn(body, field)) value[field] = body[field];
  if (typeof value.title !== "string" || !value.title.trim() || value.title.trim().length > 160) throw new Error("Tiêu đề cần từ 1 đến 160 ký tự.");
  if (typeof value.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)) throw new Error("Thời gian phải có dạng HH:mm, từ 00:00 đến 23:59.");
  if (value.description !== undefined && (typeof value.description !== "string" || value.description.length > 2000)) throw new Error("Mô tả tối đa 2.000 ký tự.");
  if (value.enabled !== undefined && typeof value.enabled !== "boolean") throw new Error("Trạng thái bật nhắc không hợp lệ.");
  const scheduleDate = value.scheduleDate || null;
  if (scheduleDate && !dateIsValid(scheduleDate)) throw new Error("Ngày nhắc cần có dạng YYYY-MM-DD và là ngày hợp lệ.");
  const source = previous.source || "USER";
  const repeat = value.repeat || (scheduleDate ? "once" : "daily");
  if (!["once", "daily"].includes(repeat)) throw new Error("Chỉ hỗ trợ nhắc một lần hoặc hằng ngày.");
  if ((repeat === "once" || source.includes("CARE_PLAN") || source === "APPOINTMENT") && !scheduleDate) throw new Error("Lời nhắc của ngày hoặc kế hoạch cần có ngày cụ thể; không tự chuyển thành nhắc hằng ngày.");
  return { title: value.title.trim(), description: value.description || "", time: value.time, enabled: value.enabled !== false, source, activityType: typeof value.activityType === "string" ? value.activityType.slice(0, 50) : "HEALTH", dayLabel: typeof value.dayLabel === "string" ? value.dayLabel.slice(0, 100) : "", scheduleDate, repeat: scheduleDate ? "once" : repeat, timeZone: "Asia/Ho_Chi_Minh" };
}
function createReminderController({ ReminderModel = Reminder, UserModel = User, AppointmentModel = Appointment, access = assignment, mail = sendMail } = {}) {
  const failure = res => res.status(503).json({ msg: "Chưa thể cập nhật nhắc hoạt động. Vui lòng thử lại sau." });
  const my = async (req, res) => {
    try { return res.json(await ReminderModel.find({ userId: req.user.id }).sort({ createdAt: -1 })); }
    catch { return failure(res); }
  };
  const create = doctor => async (req, res) => {
    try {
      let userId = req.user.id, patient;
      if (doctor) {
        if (!await access.requireAssignedDoctor(req, res, req.body?.patientId)) return;
        userId = req.body.patientId;
        patient = await UserModel.findOne({ _id: userId, role: "user" }).select("_id email fullName username").lean();
        if (!patient) return res.status(404).json({ msg: "Không tìm thấy bệnh nhân." });
      } else if (req.user.role !== "user") return res.status(403).json({ msg: "Chỉ bệnh nhân tạo lời nhắc cá nhân." });
      const source = doctor ? "DOCTOR_CARE_PLAN" : req.body?.source === "CARE_PLAN" ? "CARE_PLAN" : req.body?.appointmentId ? "APPOINTMENT" : "USER";
      let normalized;
      try { normalized = normalizeReminder(req.body || {}, { source }); }
      catch (error) { return res.status(400).json({ msg: error.message }); }
      let appointmentId = null;
      if (req.body?.appointmentId) {
        if (!access.isValidObjectId(req.body.appointmentId)) return res.status(400).json({ msg: "Mã lịch hẹn không hợp lệ." });
        const appointment = await AppointmentModel.findOne({ _id: req.body.appointmentId, patientId: userId, ...(doctor ? { doctorId: req.user.id } : {}), status: { $in: ["pending", "approved"] } }).select("_id").lean();
        if (!appointment) return res.status(409).json({ msg: "Không thể nhắc lịch không thuộc quyền hoặc đã hủy/hoàn thành." });
        appointmentId = appointment._id;
      }
      const reminder = await ReminderModel.create({ ...normalized, userId, appointmentId, ...(doctor ? { createdByDoctorId: req.user.id } : {}) });
      if (!doctor) return res.status(201).json(reminder);
      let emailSent = false;
      if (patient.email) {
        try { await mail({ to: patient.email, subject: `Nhắc hoạt động — ${normalized.title}`, text: `Bác sĩ đã tạo lời nhắc: ${normalized.title}.\nThời gian: ${normalized.time}${normalized.scheduleDate ? ` ngày ${normalized.scheduleDate}` : " hằng ngày"} (giờ Việt Nam).\n${normalized.description}` }); emailSent = true; }
        catch { /* Saved reminder remains visible, without claiming email delivery. */ }
      }
      return res.status(201).json({ message: emailSent ? "Đã lưu lời nhắc và dịch vụ email đã chấp nhận gửi thông báo." : "Đã lưu lời nhắc. Chưa gửi được email thông báo; kiểm tra cấu hình email.", reminder, emailSent });
    } catch { return failure(res); }
  };
  const update = async (req, res) => {
    try {
      if (!access.isValidObjectId(req.params.id)) return res.status(400).json({ msg: "Mã nhắc không hợp lệ." });
      const existing = await ReminderModel.findOne({ _id: req.params.id, userId: req.user.id }).lean();
      if (!existing) return res.status(404).json({ msg: "Không tìm thấy lời nhắc." });
      let normalized;
      try { normalized = normalizeReminder(req.body || {}, existing); }
      catch (error) { return res.status(400).json({ msg: error.message }); }
      if (existing.appointmentId && normalized.enabled && !await AppointmentModel.exists({ _id: existing.appointmentId, patientId: req.user.id, status: { $in: ["pending", "approved"] } })) return res.status(409).json({ msg: "Lịch đã hủy hoặc hoàn thành, không thể bật nhắc." });
      return res.json(await ReminderModel.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { $set: normalized }, { new: true, runValidators: true }));
    } catch { return failure(res); }
  };
  const remove = async (req, res) => {
    try {
      if (!access.isValidObjectId(req.params.id)) return res.status(400).json({ msg: "Mã nhắc không hợp lệ." });
      if (!await ReminderModel.findOneAndDelete({ _id: req.params.id, userId: req.user.id })) return res.status(404).json({ msg: "Không tìm thấy lời nhắc." });
      return res.json({ message: "Đã xóa lời nhắc." });
    } catch { return failure(res); }
  };
  return { my, create: create(false), doctorCreate: create(true), update, remove };
}
module.exports = { ...createReminderController(), createReminderController, normalizeReminder };
