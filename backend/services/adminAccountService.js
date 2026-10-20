const User = require("../models/User");
const Hospital = require("../models/Hospital");
const Ward = require("../models/Ward");
const SupportRequest = require("../models/SupportRequest");
const DoctorAssignment = require("../models/DoctorAssignment");
const { createNotification } = require("./notificationService");
const { clean, requireId, problem, runTransaction } = require("./coordinationUtils");
const { hospitalAvailability } = require("./hospitalAvailability");
const DOCTOR_FIELDS = "_id username fullName email phone avatar role hospitalId wardId ward city";
function createAdminAccountService({ UserModel = User, HospitalModel = Hospital, WardModel = Ward, Intake = SupportRequest, Assignment = DoctorAssignment, notify = createNotification, transaction = runTransaction, now = () => new Date() } = {}) {
  return {
    changeRole: (id, role, actorId) => transaction(async session => {
      requireId(id, "Tài khoản");
      if (!["user", "doctor"].includes(role)) throw problem("INVALID_ROLE", "Chỉ được chọn quyền user hoặc doctor.");
      const account = await UserModel.findById(id).session(session).lean().exec();
      if (!account) throw problem("USER_NOT_FOUND", "Không tìm thấy tài khoản.", 404);
      if (account.role === "admin") throw problem("ADMIN_ROLE_PROTECTED", "Không thể thay đổi quyền của admin.");
      if (account.role === role) return UserModel.findById(id).select(DOCTOR_FIELDS).session(session).lean().exec();
      // This write serializes with coordinated assignments, which also reserve
      // the doctor's User document before granting access.
      await UserModel.updateOne({ _id: id, role: account.role }, { $set: { role, hospitalId: null, doctorId: null }, $inc: { __v: 1 } }, { session });
      const affected = await Assignment.find({ status: "active", $or: [{ doctorId: id }, { patientId: id }] }).session(session).lean().exec();
      await Assignment.updateMany({ status: "active", $or: [{ doctorId: id }, { patientId: id }] }, { $set: { status: "ended", endedAt: now(), endedBy: actorId, endReason: "Kết thúc phân công do admin thay đổi vai trò tài khoản." } }, { session });
      for (const assignment of affected) {
        await UserModel.updateOne({ _id: assignment.patientId, doctorId: assignment.doctorId }, { $set: { doctorId: null }, $inc: { __v: 1 } }, { session });
        const intake = await Intake.findOne({ patientId: assignment.patientId, assignedDoctorId: assignment.doctorId }).session(session).lean().exec();
        if (intake) await Intake.updateOne({ _id: intake._id, revision: intake.revision }, { $set: { assignedDoctorId: null, status: intake.acceptedAt ? "accepted" : intake.hospitalId ? "hospital_selected" : "waiting_hospital" }, $inc: { revision: 1 }, $push: { history: { action: "revoke_role", fromStatus: intake.status, toStatus: intake.acceptedAt ? "accepted" : intake.hospitalId ? "hospital_selected" : "waiting_hospital", actorId, at: now(), revision: intake.revision + 1, hospitalId: intake.hospitalId, doctorId: null, reason: "Admin thu hoặc thay đổi quyền tài khoản; phân công cũ kết thúc." } } }, { session });
        await notify({ recipientId: assignment.patientId, recipientRole: "user", eventKey: `assignment:${assignment._id}:role_changed`, type: "assignment_ended", title: "Đã kết thúc phân công bác sĩ", message: "Quyền tài khoản phụ trách đã thay đổi. Hồ sơ và lịch sử của bạn được giữ nguyên; admin sẽ ghi nhận bác sĩ tiếp theo theo quyết định của bệnh viện.", entityType: "care-team", entityId: assignment.patientId }, { session });
      }
      return UserModel.findById(id).select(DOCTOR_FIELDS).session(session).lean().exec();
    }),
    updateDoctor: (id, body, actorId) => transaction(async session => {
      requireId(id, "Bác sĩ");
      const doctor = await UserModel.findOne({ _id: id, role: "doctor" }).session(session).lean().exec();
      if (!doctor) throw problem("DOCTOR_NOT_FOUND", "Không tìm thấy tài khoản bác sĩ.", 404);
      const fullName = clean(body.fullName ?? doctor.fullName, 150), username = clean(body.username ?? doctor.username, 100), email = clean(body.email ?? doctor.email, 254).toLowerCase();
      if ((body.fullName !== undefined && !fullName) || !username) throw problem("DOCTOR_NAME_REQUIRED", "Họ tên và tên đăng nhập bác sĩ không được trống.");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw problem("INVALID_EMAIL", "Địa chỉ email không hợp lệ.");
      const duplicate = await UserModel.findOne({ _id: { $ne: id }, $or: [{ username }, ...(email ? [{ email }] : [])] }).select("_id").session(session).lean().exec();
      if (duplicate) throw problem("DOCTOR_IDENTITY_EXISTS", "Tên đăng nhập hoặc email đã được sử dụng.", 409);
      const fields = { fullName, username, email, phone: clean(body.phone ?? doctor.phone, 50), ...(body.avatar !== undefined ? { avatar: clean(body.avatar, 1000000) } : {}) };
      if (body.hospitalId !== undefined) {
        const hospitalId = body.hospitalId === null || body.hospitalId === "" ? null : requireId(body.hospitalId, "Bệnh viện");
        if (String(hospitalId || "") !== String(doctor.hospitalId || "")) {
          if (await Assignment.exists({ doctorId: id, status: "active" }).session(session)) throw problem("DOCTOR_HAS_PATIENTS", "Cần kết thúc hoặc chuyển các phân công đang hoạt động trước khi đổi bệnh viện của bác sĩ.", 409);
          if (hospitalId) {
            const hospital = await HospitalModel.findOne({ _id: hospitalId, active: true, verified: true }).session(session).lean().exec();
            if (!hospital) throw problem("HOSPITAL_UNAVAILABLE", "Bệnh viện chưa được xác minh hoặc không còn hoạt động.", 409);
            const ward = hospital.wardId ? await WardModel.findById(hospital.wardId).session(session).lean().exec() : null;
            const issues = hospitalAvailability(hospital, ward).coordinationIssues.filter(issue => issue.code !== "NOT_ACCEPTING");
            if (issues.length) throw problem("HOSPITAL_UNAVAILABLE", issues.map(issue => issue.message).join(" "), 409);
            const reservedWard = await WardModel.updateOne({ _id: hospital.wardId, active: true, verified: true, city: ward.city }, { $inc: { __v: 1 } }, { session });
            if (!reservedWard.matchedCount) throw problem("HOSPITAL_UNAVAILABLE", "Danh mục phường của bệnh viện vừa thay đổi. Vui lòng tải lại.", 409);
            // Membership and catalog edits reserve the same hospital document,
            // so a concurrent deactivation cannot leave a new invalid roster.
            const reserved = await HospitalModel.updateOne({ _id: hospitalId, active: true, verified: true }, { $inc: { __v: 1 } }, { session });
            if (!reserved.matchedCount) throw problem("HOSPITAL_UNAVAILABLE", "Thông tin bệnh viện vừa thay đổi. Vui lòng tải lại.", 409);
          }
          fields.hospitalId = hospitalId;
        }
      }
      const updated = await UserModel.findOneAndUpdate({ _id: id, role: "doctor" }, { $set: fields, $inc: { __v: 1 } }, { returnDocument: "after", session, runValidators: true }).select(DOCTOR_FIELDS).lean().exec();
      if (!updated) throw problem("DOCTOR_CHANGED", "Quyền tài khoản vừa thay đổi. Vui lòng tải lại.", 409);
      return { ...updated, displayName: `Doctor ${updated.fullName || updated.username || "Bác sĩ"}` };
    }),
  };
}
module.exports = { ...createAdminAccountService(), createAdminAccountService, DOCTOR_FIELDS };
