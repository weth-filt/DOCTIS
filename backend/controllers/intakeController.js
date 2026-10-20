const SupportRequest = require("../models/SupportRequest");
const User = require("../models/User");
const DoctorAssignment = require("../models/DoctorAssignment");
const coordination = require("../services/careCoordinationService");
const { clean, requireId, problem, sendProblem } = require("../services/coordinationUtils");
const { coordinationAssignmentState } = require("../services/coordinationAssignmentState");
const DOCTOR_FIELDS = "_id username fullName email phone avatar role hospitalId";
const PATIENT_FIELDS = "_id username fullName email phone address wardId ward city doctorId createdAt";
function intakeView(value, assignment = null) {
  const state = coordinationAssignmentState(value.patientId, value, assignment);
  const activeAssignment = state.activeAssignment;
  const assignedDoctor = state.doctor;
  const hospital = value.hospitalId?.name ? value.hospitalId : activeAssignment?.hospitalId?.name ? activeAssignment.hospitalId : null;
  return { id: String(value._id), _id: value._id, patientId: value.patientId?._id || value.patientId, patient: value.patientId && typeof value.patientId === "object" && value.patientId.username !== undefined ? value.patientId : null, wardId: value.wardId?._id || value.wardId, ward: value.wardId?.name ? value.wardId : null, address: value.address, city: value.city, status: value.status, queueStatus: assignedDoctor ? "assigned" : value.status, hospitalId: value.hospitalId?._id || value.hospitalId || hospital?._id || null, hospital, assignedDoctor, activeAssignment: Boolean(activeAssignment), legacyAssignment: state.legacyAssignment, legacyDoctorReference: state.legacyReference, needsReconciliation: state.needsReconciliation, assignmentHospital: state.hospital, currentAssignment: activeAssignment ? { id: String(activeAssignment._id), assignedAt: activeAssignment.assignedAt, doctorId: assignedDoctor?._id, hospitalId: activeAssignment.hospitalId?._id || activeAssignment.hospitalId || null } : null, acceptedAt: value.acceptedAt, revision: value.revision, history: value.history || [], createdAt: value.createdAt, updatedAt: value.updatedAt, distanceRanking: "not_available" };
}
function populateIntake(query) { return query.populate({ path: "patientId", select: PATIENT_FIELDS, populate: { path: "doctorId", select: DOCTOR_FIELDS } }).populate("wardId", "_id code name city active verified").populate("hospitalId", "_id name address phone wardId city acceptingPatients active verified sourceUrl").populate("assignedDoctorId", DOCTOR_FIELDS).populate("history.actorId", "_id username fullName"); }
function createIntakeController({ Intake = SupportRequest, UserModel = User, Assignment = DoctorAssignment, service = coordination } = {}) {
  const admin = req => { if (req.user?.role !== "admin") throw problem("ADMIN_REQUIRED", "Chỉ admin mới có quyền điều phối.", 403); requireId(req.user.id, "Tài khoản"); };
  const assignments = query => query.populate("doctorId", "_id username fullName email phone avatar role hospitalId").populate("hospitalId", "_id name address phone wardId city acceptingPatients active verified sourceUrl");
  const detail = async id => {
    requireId(id, "Hồ sơ tiếp nhận");
    const value = await populateIntake(Intake.findById(id)).lean().exec();
    if (!value) throw problem("INTAKE_NOT_FOUND", "Không tìm thấy hồ sơ tiếp nhận.", 404);
    const assignment = await assignments(Assignment.findOne({ patientId: value.patientId?._id || value.patientId, status: "active" })).lean().exec();
    return intakeView(value, assignment);
  };
  const wrap = handler => async (req, res) => { try { admin(req); return await handler(req, res); } catch (error) { return sendProblem(res, error); } };
  const action = (method, msg) => wrap(async (req, res) => { const result = await service[method](req.params.id, { ...(req.body || {}), actorId: req.user.id }); const intake = result.intake || result; return res.json({ msg, intake: await detail(String(intake._id)) }); });
  return {
    list: wrap(async (req, res) => {
      const filter = {}, limit = Math.max(1, Math.min(100, Number.parseInt(req.query?.limit, 10) || 50));
      const queue = req.query?.queue;
      if (queue && !["open", "assigned", "all"].includes(queue)) throw problem("INVALID_QUEUE", "Nhóm hồ sơ điều phối không hợp lệ.");
      const status = queue === "assigned" ? "assigned" : req.query?.status;
      if (status && !["waiting_hospital", "hospital_selected", "accepted", "assigned"].includes(status)) throw problem("INVALID_STATUS", "Trạng thái không hợp lệ.");
      const includeAssigned = req.query?.includeAssigned === "true" || queue === "all" || status === "assigned";
      const patientFilter = { role: "user" };
      if (req.query?.search) {
        const text = clean(req.query.search, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        patientFilter.$or = ["fullName", "username", "email", "phone", "address"].map(key => ({ [key]: { $regex: text, $options: "i" } }));
      }
      const [patients, activeRows] = await Promise.all([
        UserModel.find(patientFilter).select("_id doctorId").populate("doctorId", DOCTOR_FIELDS).lean().exec(),
        assignments(Assignment.find({ status: "active" })).lean().exec(),
      ]);
      const active = activeRows.filter(row => row.doctorId?.role === "doctor");
      const assignedPatientIds = [...active.map(row => row.patientId), ...patients.filter(patient => patient.doctorId?.role === "doctor").map(patient => patient._id)];
      const assignmentByPatient = new Map(active.map(row => [String(row.patientId), row]));
      filter.patientId = { $in: patients.map(value => value._id) };
      if (!includeAssigned) filter.patientId.$nin = assignedPatientIds;
      if (status === "assigned") filter.$or = [{ status: "assigned" }, { patientId: { $in: assignedPatientIds } }];
      else if (status) filter.status = status;
      else if (!includeAssigned) filter.status = { $ne: "assigned" };
      if (req.query?.wardId) filter.wardId = requireId(req.query.wardId, "Phường");
      if (req.query?.before) filter._id = { $lt: requireId(req.query.before, "Mốc danh sách") };
      const values = await populateIntake(Intake.find(filter)).sort({ _id: -1 }).limit(limit + 1).lean().exec();
      const page = values.slice(0, limit), hasMore = values.length > limit;
      return res.json({ intakes: page.map(value => intakeView(value, assignmentByPatient.get(String(value.patientId?._id || value.patientId)))), queue: status === "assigned" ? "assigned" : includeAssigned ? "all" : "open", hasMore, nextCursor: hasMore ? String(page.at(-1)._id) : null, distanceRanking: "not_available" });
    }),
    get: wrap(async (req, res) => res.json({ intake: await detail(req.params.id) })),
    selectHospital: action("selectHospital", "Đã cập nhật bệnh viện hỗ trợ; chưa tạo lịch khám hoặc phân công bác sĩ."),
    accept: action("accept", "Đã ghi nhận bệnh viện tiếp nhận. Chưa phân công bác sĩ."),
    assign: action("assign", "Đã ghi nhận phân công theo quyết định của bệnh viện."),
    unassign: action("unassign", "Đã kết thúc phân công và giữ lịch sử."),
  };
}
module.exports = { ...createIntakeController(), createIntakeController, intakeView, populateIntake };
