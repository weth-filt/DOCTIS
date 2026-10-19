const SupportRequest = require("../models/SupportRequest");
const User = require("../models/User");
const coordination = require("../services/careCoordinationService");
const { clean, requireId, problem, sendProblem } = require("../services/coordinationUtils");
const PATIENT_FIELDS = "_id username fullName email phone address wardId ward city createdAt";
function intakeView(value) {
  return { id: String(value._id), _id: value._id, patientId: value.patientId?._id || value.patientId, patient: value.patientId && typeof value.patientId === "object" && value.patientId.username !== undefined ? value.patientId : null, wardId: value.wardId?._id || value.wardId, ward: value.wardId?.name ? value.wardId : null, address: value.address, city: value.city, status: value.status, hospitalId: value.hospitalId?._id || value.hospitalId || null, hospital: value.hospitalId?.name ? value.hospitalId : null, assignedDoctor: value.assignedDoctorId?.role === "doctor" ? value.assignedDoctorId : null, acceptedAt: value.acceptedAt, revision: value.revision, history: value.history || [], createdAt: value.createdAt, updatedAt: value.updatedAt, distanceRanking: "not_available" };
}
function populateIntake(query) { return query.populate("patientId", PATIENT_FIELDS).populate("wardId", "_id code name city active verified").populate("hospitalId", "_id name address phone wardId city acceptingPatients active verified sourceUrl").populate("assignedDoctorId", "_id username fullName email phone avatar role hospitalId").populate("history.actorId", "_id username fullName"); }
function createIntakeController({ Intake = SupportRequest, UserModel = User, service = coordination } = {}) {
  const admin = req => { if (req.user?.role !== "admin") throw problem("ADMIN_REQUIRED", "Chỉ admin mới có quyền điều phối.", 403); requireId(req.user.id, "Tài khoản"); };
  const detail = async id => { requireId(id, "Hồ sơ tiếp nhận"); const value = await populateIntake(Intake.findById(id)).lean().exec(); if (!value) throw problem("INTAKE_NOT_FOUND", "Không tìm thấy hồ sơ tiếp nhận.", 404); return intakeView(value); };
  const wrap = handler => async (req, res) => { try { admin(req); return await handler(req, res); } catch (error) { return sendProblem(res, error); } };
  const action = (method, msg) => wrap(async (req, res) => { const result = await service[method](req.params.id, { ...(req.body || {}), actorId: req.user.id }); const intake = result.intake || result; return res.json({ msg, intake: await detail(String(intake._id)) }); });
  return {
    list: wrap(async (req, res) => {
      const filter = {}, limit = Math.max(1, Math.min(100, Number.parseInt(req.query?.limit, 10) || 50));
      if (req.query?.status) { if (!["waiting_hospital", "hospital_selected", "accepted", "assigned"].includes(req.query.status)) throw problem("INVALID_STATUS", "Trạng thái không hợp lệ."); filter.status = req.query.status; }
      if (req.query?.wardId) filter.wardId = requireId(req.query.wardId, "Phường");
      if (req.query?.before) filter._id = { $lt: requireId(req.query.before, "Mốc danh sách") };
      if (req.query?.search) { const text = clean(req.query.search, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); const users = await UserModel.find({ role: "user", $or: ["fullName", "username", "email", "phone", "address"].map(key => ({ [key]: { $regex: text, $options: "i" } })) }).select("_id").limit(1000).lean().exec(); filter.patientId = { $in: users.map(value => value._id) }; }
      const values = await populateIntake(Intake.find(filter)).sort({ _id: -1 }).limit(limit + 1).lean().exec();
      const page = values.slice(0, limit), hasMore = values.length > limit;
      return res.json({ intakes: page.map(intakeView), hasMore, nextCursor: hasMore ? String(page.at(-1)._id) : null, distanceRanking: "not_available" });
    }),
    get: wrap(async (req, res) => res.json({ intake: await detail(req.params.id) })),
    selectHospital: action("selectHospital", "Đã cập nhật bệnh viện hỗ trợ; chưa tạo lịch khám hoặc phân công bác sĩ."),
    accept: action("accept", "Đã ghi nhận bệnh viện tiếp nhận. Chưa phân công bác sĩ."),
    assign: action("assign", "Đã ghi nhận phân công theo quyết định của bệnh viện."),
    unassign: action("unassign", "Đã kết thúc phân công và giữ lịch sử."),
  };
}
module.exports = { ...createIntakeController(), createIntakeController, intakeView, populateIntake };
