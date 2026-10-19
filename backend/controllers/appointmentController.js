const Appointment = require("../models/Appointment");
const Reminder = require("../models/Reminder");
const User = require("../models/User");
const { sendMail } = require("../utils/mailer");
const access = require("../middlewares/assignmentAccess");
const crypto = require("node:crypto");

function createAppointmentController({ AppointmentModel = Appointment, ReminderModel = Reminder, UserModel = User, assignment = access, mail = sendMail, notify = input => require("../services/notificationService").createNotification(input), now = () => new Date() } = {}) {
  const doctorOnly = (req, res) => { if (req.user?.role === "doctor") return true; res.status(403).json({ msg: "Chỉ bác sĩ mới có quyền." }); return false; };
  const validId = (id, res) => { if (assignment.isValidObjectId(id)) return true; res.status(400).json({ msg: "Mã lịch hẹn không hợp lệ." }); return false; };
  const failure = (res, error) => res.status(error?.status || 503).json({ msg: "Không thể hoàn tất thao tác lịch hẹn. Vui lòng thử lại sau." });
  const availableLock = at => ({ $or: [{ operationLock: null }, { operationLockAt: { $lt: new Date(at.getTime() - 120000) } }] });
  const cancellationNotice = async appointment => {
    if (!appointment.cancelledBy || !["user", "doctor"].includes(appointment.cancelledByRole)) return;
    const recipientId = appointment.cancelledByRole === "user" ? appointment.doctorId : appointment.patientId;
    const recipientRole = appointment.cancelledByRole === "user" ? "doctor" : "user";
    await notify({ recipientId, recipientRole, eventKey: `appointment:${appointment._id}:cancelled`, type: "appointment_cancelled", title: "Lịch hẹn đã được hủy", message: `Lịch hẹn ngày ${new Date(appointment.appointmentDate).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} đã được ${appointment.cancelledByRole === "user" ? "bệnh nhân" : "bác sĩ"} hủy. Lý do: ${appointment.cancelReason}`, entityType: "appointment", entityId: appointment._id });
  };
  const createAppointment = async (req, res) => {
    try {
      if (!doctorOnly(req, res)) return;
      const { patientId, appointmentDate, note, type } = req.body || {};
      if (!await assignment.requireAssignedDoctor(req, res, patientId)) return;
      const date = new Date(appointmentDate);
      if (!appointmentDate || !Number.isFinite(date.getTime()) || date <= now()) return res.status(400).json({ msg: "Ngày hẹn cần hợp lệ và ở trong tương lai." });
      if (note !== undefined && (typeof note !== "string" || note.length > 2000)) return res.status(400).json({ msg: "Nội dung lịch hẹn tối đa 2.000 ký tự." });
      const patient = await UserModel.findOne({ _id: patientId, role: "user" }).select("_id").lean();
      if (!patient) return res.status(404).json({ msg: "Không tìm thấy bệnh nhân." });
      if (type && !["Tái khám", "Khám tổng quát", "Theo dõi tim mạch", "Khẩn cấp"].includes(type)) return res.status(400).json({ msg: "Loại lịch hẹn không hợp lệ." });
      const appointment = await AppointmentModel.create({ doctorId: req.user.id, patientId, appointmentDate: date, note: note?.trim() || "", type: type || "Tái khám" });
      return res.status(201).json({ msg: "Tạo lịch hẹn thành công.", appointment });
    } catch (error) { return failure(res, error); }
  };
  const getPatientAppointments = async (req, res) => {
    try {
      if (req.user?.role !== "user") return res.status(403).json({ msg: "Chỉ bệnh nhân xem lịch cá nhân." });
      return res.json(await AppointmentModel.find({ patientId: req.user.id }).populate("doctorId", "username fullName email").sort({ appointmentDate: -1 }));
    } catch (error) { return failure(res, error); }
  };
  const getDoctorAppointments = async (req, res) => {
    try {
      if (!doctorOnly(req, res)) return;
      const patientIds = await assignment.getAssignedPatientIds(req.user.id);
      return res.json(await AppointmentModel.find({ doctorId: req.user.id, patientId: { $in: patientIds } }).populate("patientId", "username fullName email phone").sort({ appointmentDate: -1 }));
    } catch (error) { return failure(res, error); }
  };
  const cancelAppointment = async (req, res) => {
    try {
      if (!req.user?.id) return res.status(401).json({ msg: "Vui lòng đăng nhập." });
      if (!["user", "doctor"].includes(req.user.role)) return res.status(403).json({ msg: "Chỉ bệnh nhân hoặc bác sĩ phụ trách được hủy lịch." });
      if (!validId(req.params?.id, res)) return;
      const owner = req.user.role === "user" ? { patientId: req.user.id } : { doctorId: req.user.id };
      let appointment = await AppointmentModel.findOne({ _id: req.params.id, ...owner }).lean();
      if (!appointment) return res.status(404).json({ msg: "Không tìm thấy lịch hẹn thuộc quyền của bạn." });
      if (req.user.role === "doctor" && !await assignment.requireAssignedDoctor(req, res, String(appointment.patientId))) return;
      let alreadyCancelled = appointment.status === "cancelled";
      if (!alreadyCancelled) {
        if (!["pending", "approved"].includes(appointment.status)) return res.status(409).json({ msg: "Chỉ có thể hủy lịch đang chờ hoặc đã duyệt.", appointment });
        const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
        if (reason.length < 3 || reason.length > 1000) return res.status(400).json({ msg: "Vui lòng nhập lý do hủy từ 3 đến 1.000 ký tự." });
        const at = now();
        const updated = await AppointmentModel.findOneAndUpdate({ _id: appointment._id, ...owner, status: { $in: ["pending", "approved"] }, ...availableLock(at) }, { $set: { status: "cancelled", cancelReason: reason, cancelledBy: req.user.id, cancelledByRole: req.user.role, cancelledAt: at, operationLock: null, operationLockAt: null } }, { new: true, runValidators: true }).lean();
        if (updated) appointment = updated;
        else {
          appointment = await AppointmentModel.findOne({ _id: appointment._id, ...owner }).lean();
          if (appointment?.status !== "cancelled") return res.status(409).json({ msg: "Lịch hẹn vừa thay đổi hoặc đang xử lý nhắc lịch. Vui lòng thử lại.", appointment });
          alreadyCancelled = true;
        }
      }
      await ReminderModel.updateMany({ appointmentId: appointment._id, enabled: true }, { $set: { enabled: false, cancelledAt: appointment.cancelledAt || now() } });
      await cancellationNotice(appointment);
      return res.json({ msg: alreadyCancelled ? "Lịch hẹn này đã được hủy." : "Đã hủy lịch hẹn.", appointment, alreadyCancelled });
    } catch (error) { return failure(res, error); }
  };
  const changeStatus = status => async (req, res) => {
    try {
      if (!doctorOnly(req, res) || !validId(req.params?.id, res)) return;
      const appointment = await AppointmentModel.findOne({ _id: req.params.id, doctorId: req.user.id }).lean();
      if (!appointment) return res.status(404).json({ msg: "Không tìm thấy lịch hẹn." });
      if (!await assignment.requireAssignedDoctor(req, res, String(appointment.patientId))) return;
      const from = status === "approved" ? "pending" : "approved";
      const success = (value, alreadyUpdated = false) => res.json({ msg: alreadyUpdated ? status === "approved" ? "Lịch hẹn này đã được duyệt." : "Lịch hẹn này đã hoàn thành." : status === "approved" ? "Đã duyệt lịch hẹn." : "Đã đánh dấu hoàn thành.", appointment: value, alreadyUpdated });
      const transitionError = (value, at) => {
        if (value.status !== from) {
          const label = { pending: "đang chờ duyệt", approved: "đã duyệt", completed: "đã hoàn thành", cancelled: "đã hủy" }[value.status] || "không xác định";
          return { code: "APPOINTMENT_STATUS_CONFLICT", msg: `${status === "approved" ? "Chỉ có thể duyệt lịch đang chờ." : "Chỉ có thể hoàn tất lịch đã duyệt."} Lịch hiện ${label}. Vui lòng tải lại danh sách.` };
        }
        if (status === "completed") {
          const date = new Date(value.appointmentDate);
          if (!value.appointmentDate || !Number.isFinite(date.getTime())) return { code: "APPOINTMENT_DATE_INVALID", msg: "Lịch hẹn chưa có thời gian hợp lệ nên không thể đánh dấu hoàn thành. Vui lòng kiểm tra lại thông tin lịch." };
          if (date > at) return { code: "APPOINTMENT_IN_FUTURE", msg: `Chưa thể hoàn tất lịch hẹn trong tương lai. Lịch diễn ra lúc ${date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} (giờ Việt Nam).` };
        }
        return null;
      };
      // A retry must not turn a successful transition into a misleading error.
      // Authorization above still applies to every replay.
      if (appointment.status === status) return success(appointment, true);
      const at = now();
      const invalid = transitionError(appointment, at);
      if (invalid) return res.status(409).json({ ...invalid, appointment });
      const updated = await AppointmentModel.findOneAndUpdate({ _id: appointment._id, doctorId: req.user.id, status: from, ...(status === "completed" ? { appointmentDate: { $lte: at } } : {}), ...availableLock(at) }, { $set: { status } }, { new: true, runValidators: true }).lean();
      if (updated) return success(updated);
      const latest = await AppointmentModel.findOne({ _id: appointment._id, doctorId: req.user.id }).lean();
      if (!latest) return res.status(404).json({ code: "APPOINTMENT_NOT_FOUND", msg: "Không tìm thấy lịch hẹn thuộc quyền của bạn." });
      if (latest.status === status) return success(latest, true);
      const changed = transitionError(latest, now());
      if (changed) return res.status(409).json({ ...changed, appointment: latest });
      if (latest.operationLock && !(new Date(latest.operationLockAt).getTime() < now().getTime() - 120000)) return res.status(409).json({ code: "APPOINTMENT_BUSY", msg: "Lịch hẹn đang được xử lý nhắc lịch. Vui lòng chờ thao tác này hoàn tất rồi thử lại.", appointment: latest });
      return res.status(409).json({ code: "APPOINTMENT_CHANGED", msg: "Lịch hẹn vừa được cập nhật. Vui lòng tải lại danh sách trước khi thao tác.", appointment: latest });
    } catch (error) { return failure(res, error); }
  };
  const remindAppointment = async (req, res) => {
    let lockedId, lock;
    try {
      if (!doctorOnly(req, res) || !validId(req.params?.id, res)) return;
      const appointment = await AppointmentModel.findOne({ _id: req.params.id, doctorId: req.user.id }).populate("patientId", "username fullName email").lean();
      if (!appointment) return res.status(404).json({ msg: "Không tìm thấy lịch hẹn." });
      if (!await assignment.requireAssignedDoctor(req, res, String(appointment.patientId?._id || appointment.patientId))) return;
      if (!["pending", "approved"].includes(appointment.status)) return res.status(409).json({ msg: "Không gửi nhắc cho lịch đã hủy hoặc đã hoàn thành." });
      if (!appointment.patientId?.email) return res.status(400).json({ msg: "Bệnh nhân chưa có email." });
      lock = crypto.randomUUID();
      const acquired = await AppointmentModel.findOneAndUpdate({ _id: appointment._id, doctorId: req.user.id, status: { $in: ["pending", "approved"] }, ...availableLock(now()) }, { $set: { operationLock: lock, operationLockAt: now() } }, { new: true }).lean();
      if (!acquired) return res.status(409).json({ msg: "Lịch hẹn vừa thay đổi hoặc đang gửi nhắc. Vui lòng thử lại." });
      lockedId = appointment._id;
      const when = new Date(appointment.appointmentDate).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
      await mail({ to: appointment.patientId.email, subject: "Nhắc lịch khám — DOCTIS", text: `Xin chào ${appointment.patientId.fullName || appointment.patientId.username || "bạn"},\nBạn có lịch khám vào ${when}.\nLoại: ${appointment.type || "Tái khám"}.\n${appointment.note || ""}\nVui lòng đến đúng lịch.` });
      await AppointmentModel.updateOne({ _id: lockedId, operationLock: lock }, { $set: { lastReminderAt: now() } });
      return res.json({ msg: "Dịch vụ email đã chấp nhận gửi nhắc lịch." });
    } catch (error) { return failure(res, error); }
    finally { if (lockedId) await AppointmentModel.updateOne({ _id: lockedId, operationLock: lock }, { $set: { operationLock: null, operationLockAt: null } }).catch(() => {}); }
  };
  return { createAppointment, getPatientAppointments, getDoctorAppointments, cancelAppointment, approveAppointment: changeStatus("approved"), completeAppointment: changeStatus("completed"), remindAppointment };
}
module.exports = { ...createAppointmentController(), createAppointmentController };
