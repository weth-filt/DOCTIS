const User = require("../models/User");
const Hospital = require("../models/Hospital");
const Ward = require("../models/Ward");
const SupportRequest = require("../models/SupportRequest");
const DoctorAssignment = require("../models/DoctorAssignment");
const { createNotification } = require("./notificationService");
const { validateAddress } = require("./serviceArea");
const { clean, problem, requireId, requireRevision, runTransaction } = require("./coordinationUtils");
const { hospitalAvailability } = require("./hospitalAvailability");

function createCareCoordinationService({ UserModel = User, HospitalModel = Hospital, WardModel = Ward, Intake = SupportRequest, Assignment = DoctorAssignment, notify = createNotification, addressValidator = validateAddress, transaction = runTransaction, now = () => new Date() } = {}) {
  const getIntake = async (id, session) => {
    requireId(id, "Hồ sơ tiếp nhận");
    const value = await Intake.findById(id).session(session).lean().exec();
    if (!value) throw problem("INTAKE_NOT_FOUND", "Không tìm thấy hồ sơ tiếp nhận.", 404);
    const patient = await UserModel.updateOne({ _id: value.patientId, role: "user" }, { $inc: { __v: 1 } }, { session });
    if (!patient.matchedCount) throw problem("PATIENT_NOT_FOUND", "Tài khoản không còn vai trò bệnh nhân. Vui lòng tải lại hồ sơ.", 409);
    return value;
  };
  const version = (intake, revision) => { requireRevision(revision); if (intake.revision !== revision) throw problem("STALE_INTAKE", "Hồ sơ vừa được cập nhật. Vui lòng tải lại trước khi ghi nhận.", 409); };
  const hospital = async (id, session) => {
    requireId(String(id || ""), "Bệnh viện");
    const value = await HospitalModel.findOne({ _id: id, active: true, verified: true, acceptingPatients: true }).session(session).lean().exec();
    if (!value) throw problem("HOSPITAL_UNAVAILABLE", "Bệnh viện chưa được xác minh, đã ngừng hoạt động hoặc chưa tiếp nhận bệnh nhân.", 409);
    const ward = value.wardId ? await WardModel.findById(value.wardId).session(session).lean().exec() : null;
    const availability = hospitalAvailability(value, ward);
    if (!availability.coordinationEligible) throw problem("HOSPITAL_UNAVAILABLE", availability.coordinationIssues.map(issue => issue.message).join(" "), 409);
    const reservedWard = await WardModel.updateOne({ _id: value.wardId, active: true, verified: true }, { $inc: { __v: 1 } }, { session });
    if (!reservedWard.matchedCount) throw problem("HOSPITAL_UNAVAILABLE", "Danh mục phường của bệnh viện vừa thay đổi. Vui lòng tải lại.", 409);
    // Serialize catalog changes against admission/assignment without altering
    // the public revision used by the catalog editor.
    const reserved = await HospitalModel.updateOne({ _id: id, active: true, verified: true, acceptingPatients: true }, { $inc: { __v: 1 } }, { session });
    if (!reserved.matchedCount) throw problem("HOSPITAL_UNAVAILABLE", "Thông tin bệnh viện vừa thay đổi. Vui lòng tải lại.", 409);
    return value;
  };
  const change = async (intake, patch, action, actorId, reason, session, audit = {}) => {
    const revision = intake.revision + 1;
    const history = { action, fromStatus: intake.status, toStatus: patch.status || intake.status, actorId, hospitalId: patch.hospitalId ?? intake.hospitalId, doctorId: Object.prototype.hasOwnProperty.call(patch, "assignedDoctorId") ? patch.assignedDoctorId : intake.assignedDoctorId || null, ...(audit.previousDoctorId ? { previousDoctorId: audit.previousDoctorId } : {}), reason: clean(reason, 1000), at: now(), revision };
    const updated = await Intake.findOneAndUpdate({ _id: intake._id, revision: intake.revision }, { $set: patch, $inc: { revision: 1 }, $push: { history } }, { returnDocument: "after", session }).lean().exec();
    if (!updated) throw problem("STALE_INTAKE", "Hồ sơ vừa được cập nhật. Vui lòng tải lại.", 409);
    return updated;
  };
  const inform = async (intake, type, title, message, session, doctorId) => {
    await notify({ recipientId: intake.patientId, recipientRole: "user", eventKey: `intake:${intake._id}:${intake.revision}:${type}`, type, title, message, entityType: "intake", entityId: intake._id }, { session });
    if (doctorId) await notify({ recipientId: doctorId, recipientRole: "doctor", eventKey: `intake:${intake._id}:${intake.revision}:${type}:doctor:${doctorId}`, type, title, message: "Danh sách bệnh nhân phụ trách đã được cập nhật theo kết quả điều phối của bệnh viện.", entityType: "patient", entityId: intake.patientId }, { session });
  };
  const endActive = async (patientId, actorId, reason, session) => {
    const previous = await Assignment.find({ patientId, status: "active" }).session(session).lean().exec();
    await Assignment.updateMany({ patientId, status: "active" }, { $set: { status: "ended", endedAt: now(), endedBy: actorId, endReason: clean(reason, 1000) } }, { session });
    await UserModel.updateOne({ _id: patientId, role: "user" }, { $set: { doctorId: null }, $inc: { __v: 1 } }, { session });
    return previous;
  };
  return {
    selectHospital: (id, { hospitalId, reason, revision, actorId }) => transaction(async session => {
      const intake = await getIntake(id, session); version(intake, revision);
      await hospital(hospitalId, session);
      if (String(intake.hospitalId || "") === hospitalId) return intake;
      const previous = await endActive(intake.patientId, actorId, "Chuyển bệnh viện hỗ trợ; kết thúc quyền theo dõi tại bệnh viện cũ.", session);
      const updated = await change(intake, { status: "hospital_selected", hospitalId, acceptedAt: null, assignedDoctorId: null }, "select_hospital", actorId, reason, session);
      await UserModel.updateOne({ _id: intake.patientId, role: "user" }, { $set: { hospitalId, doctorId: null } }, { session });
      await inform(updated, "hospital_selected", "Bệnh viện hỗ trợ đã được cập nhật", "Admin đã cập nhật bệnh viện hỗ trợ. Vui lòng xem địa chỉ và đến bệnh viện để được tiếp nhận; đây không phải lịch hẹn khám.", session);
      for (const old of previous) await notify({ recipientId: old.doctorId, recipientRole: "doctor", eventKey: `assignment:${old._id}:hospital_changed`, type: "assignment_ended", title: "Đã kết thúc phân công", message: "Bệnh nhân đã được chuyển sang quy trình tiếp nhận tại bệnh viện khác.", entityType: "patient", entityId: intake.patientId }, { session });
      return updated;
    }),
    accept: (id, { revision, note, actorId }) => transaction(async session => {
      const intake = await getIntake(id, session); version(intake, revision);
      if (intake.status !== "hospital_selected") throw problem("HOSPITAL_NOT_SELECTED", "Cần cập nhật bệnh viện trước và chỉ ghi nhận tiếp nhận khi bệnh viện đã xác nhận.", 409);
      await hospital(String(intake.hospitalId), session);
      const updated = await change(intake, { status: "accepted", acceptedAt: now(), assignedDoctorId: null }, "accept_patient", actorId, note, session);
      await inform(updated, "hospital_accepted", "Bệnh viện đã tiếp nhận", "Admin đã ghi nhận bệnh viện tiếp nhận hồ sơ. Bệnh viện sẽ quyết định bác sĩ phụ trách; hiện chưa có phân công mới.", session);
      return updated;
    }),
    assign: (id, { revision, doctorId, reason, actorId }) => transaction(async session => {
      const intake = await getIntake(id, session); version(intake, revision); requireId(doctorId, "Bác sĩ");
      if (!["accepted", "assigned"].includes(intake.status) || !intake.acceptedAt || !intake.hospitalId) throw problem("PATIENT_NOT_ACCEPTED", "Chỉ ghi nhận phân công sau khi bệnh viện đã tiếp nhận và quyết định bác sĩ phụ trách.", 409);
      await hospital(String(intake.hospitalId), session);
      const doctor = await UserModel.findOne({ _id: doctorId, role: "doctor", hospitalId: intake.hospitalId }).select("_id hospitalId role").session(session).lean().exec();
      if (!doctor) throw problem("DOCTOR_HOSPITAL_MISMATCH", "Bác sĩ phải có quyền doctor và thuộc đúng bệnh viện đã tiếp nhận.", 409);
      const reserved = await UserModel.updateOne({ _id: doctorId, role: "doctor", hospitalId: intake.hospitalId }, { $inc: { __v: 1 } }, { session });
      if (!reserved.matchedCount) throw problem("DOCTOR_CHANGED", "Quyền hoặc bệnh viện của bác sĩ vừa thay đổi.", 409);
      const current = await Assignment.findOne({ patientId: intake.patientId, status: "active" }).session(session).lean().exec();
      if (current && String(current.doctorId) === doctorId && intake.status === "assigned" && String(current.hospitalId) === String(intake.hospitalId) && String(current.supportRequestId) === String(intake._id)) return { intake, assignment: current, unchanged: true };
      const previous = await endActive(intake.patientId, actorId, reason || "Bệnh viện quyết định thay đổi bác sĩ phụ trách.", session);
      const [assignment] = await Assignment.create([{ patientId: intake.patientId, doctorId, hospitalId: intake.hospitalId, supportRequestId: intake._id, status: "active", assignedBy: actorId, assignedAt: now(), reason: clean(reason, 1000) || "Admin ghi nhận bác sĩ do bệnh viện quyết định." }], { session });
      const updated = await change(intake, { status: "assigned", assignedDoctorId: doctorId }, "assign_doctor", actorId, reason, session);
      await UserModel.updateOne({ _id: intake.patientId, role: "user" }, { $set: { doctorId, hospitalId: intake.hospitalId } }, { session });
      await inform(updated, "doctor_assigned", "Bác sĩ phụ trách đã được cập nhật", "Admin đã ghi nhận bác sĩ phụ trách theo quyết định của bệnh viện. Bạn có thể xem thông tin bác sĩ trong mục bệnh viện và bác sĩ phụ trách.", session, doctorId);
      for (const old of previous.filter(value => String(value.doctorId) !== doctorId)) await notify({ recipientId: old.doctorId, recipientRole: "doctor", eventKey: `assignment:${old._id}:ended`, type: "assignment_ended", title: "Đã kết thúc phân công", entityType: "patient", entityId: intake.patientId }, { session });
      return { intake: updated, assignment, unchanged: false };
    }),
    unassign: (id, { revision, reason, actorId }) => transaction(async session => {
      const intake = await getIntake(id, session); version(intake, revision);
      const patient = await UserModel.findOne({ _id: intake.patientId, role: "user" }).select("doctorId").session(session).lean().exec();
      const auditReason = clean(reason, 1000) || "Admin ghi nhận kết thúc phân công hoặc tham chiếu bác sĩ cũ sau khi đối chiếu hồ sơ.";
      const previous = await endActive(intake.patientId, actorId, auditReason, session);
      if (!previous.length && intake.status !== "assigned" && !intake.assignedDoctorId && !patient?.doctorId) return intake;
      const legacyReferenceOnly = !previous.length && Boolean(patient?.doctorId);
      const previousDoctorId = previous[0]?.doctorId || patient?.doctorId || intake.assignedDoctorId || null;
      const updated = await change(intake, { status: intake.acceptedAt ? "accepted" : intake.hospitalId ? "hospital_selected" : "waiting_hospital", assignedDoctorId: null }, legacyReferenceOnly ? "unassign_legacy_doctor_reference" : "unassign_doctor", actorId, auditReason, session, { previousDoctorId });
      await inform(updated, "doctor_unassigned", "Đã cập nhật trạng thái bác sĩ phụ trách", legacyReferenceOnly ? "Admin đã gỡ thông tin bác sĩ cũ sau khi đối chiếu. Hồ sơ và lịch sử được giữ nguyên để tiếp tục điều phối." : "Phân công cũ đã kết thúc. Hồ sơ được giữ nguyên và đang chờ bệnh viện quyết định bác sĩ tiếp theo.", session);
      for (const old of previous) await notify({ recipientId: old.doctorId, recipientRole: "doctor", eventKey: `assignment:${old._id}:ended`, type: "assignment_ended", title: "Đã kết thúc phân công", entityType: "patient", entityId: intake.patientId }, { session });
      return updated;
    }),
    unassignLegacy: ({ patientId, actorId, reason }) => transaction(async session => {
      requireId(patientId, "Bệnh nhân");
      const intake = await Intake.findOne({ patientId }).session(session).lean().exec();
      if (intake) throw problem("USE_INTAKE_WORKFLOW", "Vui lòng gỡ phân công tại hồ sơ Tiếp nhận và điều phối với phiên bản mới nhất.", 409);
      const rows = await endActive(patientId, actorId, reason || "Admin kết thúc phân công dữ liệu cũ.", session);
      for (const row of rows) await notify({ recipientId: patientId, recipientRole: "user", eventKey: `assignment:${row._id}:ended`, type: "assignment_ended", title: "Đã kết thúc phân công bác sĩ", entityType: "assignment", entityId: row._id }, { session });
      return rows[0] || null;
    }),
    updateAddress: (patientId, input) => transaction(async session => {
      requireId(patientId, "Bệnh nhân");
      const address = await addressValidator(input, session);
      const patient = await UserModel.findOneAndUpdate({ _id: patientId, role: "user" }, { $set: address, $inc: { __v: 1 } }, { returnDocument: "after", session }).select("_id wardId address city").lean().exec();
      if (!patient) throw problem("PATIENT_NOT_FOUND", "Không tìm thấy tài khoản bệnh nhân.", 404);
      let intake = await Intake.findOne({ patientId }).session(session).lean().exec();
      if (intake) intake = await change(intake, { address: address.address, wardId: address.wardId, city: address.city }, "update_address", patientId, "Bệnh nhân cập nhật địa chỉ; không tự thay đổi bệnh viện hoặc bác sĩ.", session);
      else [intake] = await Intake.create([{ patientId, ...address, status: "waiting_hospital", history: [{ action: "complete_legacy_address", toStatus: "waiting_hospital", actorId: patientId, at: now(), revision: 0 }] }], { session });
      await notify({ recipientRole: "admin", eventKey: `intake:${intake._id}:${intake.revision}:address`, type: "patient_address_updated", title: "Bệnh nhân đã bổ sung địa chỉ", message: "Cần đối chiếu địa chỉ và cập nhật bệnh viện phù hợp. Phân công cũ nếu có vẫn được giữ đến khi admin chuyển bệnh viện rõ ràng.", entityType: "intake", entityId: intake._id }, { session });
      return intake;
    }),
  };
}
module.exports = { ...createCareCoordinationService(), createCareCoordinationService };
