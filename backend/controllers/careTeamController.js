const User = require("../models/User");
const Ward = require("../models/Ward");
const SupportRequest = require("../models/SupportRequest");
const DoctorAssignment = require("../models/DoctorAssignment");
const { updateAddress } = require("../services/careCoordinationService");
const { CITY, requireId, problem, sendProblem } = require("../services/coordinationUtils");
function createCareTeamController({ UserModel = User, WardModel = Ward, Intake = SupportRequest, Assignment = DoctorAssignment, saveAddress = updateAddress } = {}) {
  const data = async req => {
    if (req.user?.role !== "user") throw problem("PATIENT_REQUIRED", "Chỉ bệnh nhân mới sử dụng mục bệnh viện và bác sĩ phụ trách.", 403);
    const patientId = requireId(req.user.id, "Bệnh nhân");
    const [user, intake, assignment] = await Promise.all([UserModel.findOne({ _id: patientId, role: "user" }).select("_id address ward wardId city hospitalId").lean().exec(), Intake.findOne({ patientId }).populate("hospitalId", "_id name address phone wardId city active verified acceptingPatients sourceUrl").lean().exec(), Assignment.findOne({ patientId, status: "active" }).populate("doctorId", "_id username fullName email phone avatar role hospitalId").lean().exec()]);
    if (!user) throw problem("PATIENT_NOT_FOUND", "Không tìm thấy tài khoản bệnh nhân.", 404);
    const ward = user.wardId ? await WardModel.findOne({ _id: user.wardId, city: CITY, verified: true, active: true }).select("_id code name city").lean().exec() : null;
    const coordinated = Boolean(assignment?.supportRequestId);
    const allowed = assignment?.doctorId?.role === "doctor" && (!coordinated || (intake?.status === "assigned" && intake.acceptedAt && String(assignment.supportRequestId) === String(intake._id) && String(intake.assignedDoctorId) === String(assignment.doctorId._id) && String(intake.hospitalId?._id) === String(assignment.hospitalId) && String(assignment.doctorId.hospitalId) === String(assignment.hospitalId) && intake.hospitalId?.active && intake.hospitalId?.verified));
    return { status: intake?.status || "waiting_hospital", intake: intake ? { id: String(intake._id), status: intake.status, revision: intake.revision, acceptedAt: intake.acceptedAt, createdAt: intake.createdAt, updatedAt: intake.updatedAt } : null, hospital: intake?.hospitalId?.name ? intake.hospitalId : null, doctor: allowed ? assignment.doctorId : null, legacyAssignment: Boolean(allowed && !coordinated), address: { address: user.address || "", wardId: ward?._id || user.wardId || null, ward: ward?.name || user.ward || "", city: user.city || "" }, requiresAddressUpdate: !ward || user.city !== CITY || !user.address?.trim(), distanceRanking: "not_available" };
  };
  return { get: async (req, res) => { try { return res.json(await data(req)); } catch (error) { return sendProblem(res, error); } }, address: async (req, res) => { try { if (req.user?.role !== "user") throw problem("PATIENT_REQUIRED", "Chỉ bệnh nhân mới được bổ sung địa chỉ của mình.", 403); await saveAddress(req.user.id, req.body || {}); return res.json({ msg: "Đã lưu địa chỉ. Bệnh viện và phân công hiện có không bị tự động thay thế.", ...await data(req) }); } catch (error) { return sendProblem(res, error); } } };
}
module.exports = { ...createCareTeamController(), createCareTeamController };
