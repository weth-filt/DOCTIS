const User = require("../models/User");
const DoctorAssignment = require("../models/DoctorAssignment");
const SupportRequest = require("../models/SupportRequest");
const coordination = require("../services/careCoordinationService");
const { requireId, problem, sendProblem } = require("../services/coordinationUtils");
const DOCTOR_FIELDS = "_id username fullName email phone avatar role hospitalId";
const decorate = query => query.populate("doctorId", DOCTOR_FIELDS).populate("assignedBy", "_id username fullName");
const wrap = handler => async (req, res) => { try { if (req.user?.role !== "admin") throw problem("ADMIN_REQUIRED", "Chỉ admin mới có quyền phân công.", 403); return await handler(req, res); } catch (error) { return sendProblem(res, error); } };
exports.getPatientsWithAssignment = wrap(async (req, res) => {
  const [patients, assignments, intakes] = await Promise.all([
    User.find({ role: "user" }).select("_id username fullName email phone avatar gender dateOfBirth address ward wardId city hospitalId bloodType allergies medicalHistory chronicDiseases").sort({ fullName: 1, username: 1 }).lean().exec(),
    decorate(DoctorAssignment.find({ status: "active" })).lean().exec(),
    SupportRequest.find().select("_id patientId hospitalId status revision acceptedAt assignedDoctorId").lean().exec(),
  ]);
  const result = patients.map(patient => {
    const assignment = assignments.find(row => String(row.patientId) === String(patient._id));
    const doctor = assignment?.doctorId?.role === "doctor" ? assignment.doctorId : null;
    const intake = intakes.find(row => String(row.patientId) === String(patient._id)) || null;
    return { ...patient, assigned: Boolean(doctor), assignedDoctor: doctor, currentDoctor: doctor, assignedDoctorId: doctor?._id || null, assignedAt: assignment?.assignedAt || null, assignmentReason: assignment?.reason || "", assignedBy: assignment?.assignedBy || null, assignmentStatus: doctor ? "active" : "unassigned", intake, legacyAssignment: Boolean(doctor && !assignment.supportRequestId) };
  });
  return res.json(result);
});
exports.getDoctorsForAssignment = wrap(async (req, res) => {
  const filter = { role: "doctor" }; if (req.query?.hospitalId) filter.hospitalId = requireId(req.query.hospitalId, "Bệnh viện");
  const [doctors, counts] = await Promise.all([User.find(filter).select(DOCTOR_FIELDS).sort({ fullName: 1, username: 1 }).lean().exec(), DoctorAssignment.aggregate([{ $match: { status: "active" } }, { $group: { _id: "$doctorId", patientCount: { $sum: 1 } } }])]);
  return res.json(doctors.map(doctor => ({ ...doctor, displayName: `Doctor ${String(doctor.fullName || doctor.username || "Bác sĩ").replace(/^doctor\s+/i, "")}`, patientCount: counts.find(value => String(value._id) === String(doctor._id))?.patientCount || 0 })));
});
exports.getAssignmentSummary = wrap(async (req, res) => {
  const [totalPatients, totalDoctors, assignedPatients] = await Promise.all([User.countDocuments({ role: "user" }), User.countDocuments({ role: "doctor" }), DoctorAssignment.countDocuments({ status: "active" })]);
  return res.json({ totalPatients, totalDoctors, assignedPatients, unassignedPatients: Math.max(totalPatients - assignedPatients, 0), activeAssignments: assignedPatients });
});
exports.getPatientAssignment = wrap(async (req, res) => {
  const patientId = requireId(req.params.patientId, "Bệnh nhân");
  const [assignment, intake] = await Promise.all([decorate(DoctorAssignment.findOne({ patientId, status: "active" })).lean().exec(), SupportRequest.findOne({ patientId }).select("_id status hospitalId assignedDoctorId revision acceptedAt").lean().exec()]);
  return res.json({ assigned: Boolean(assignment), assignment: assignment || null, currentDoctor: assignment?.doctorId || null, assignedDoctor: assignment?.doctorId || null, intake: intake || null });
});
exports.assignDoctor = wrap(async (req, res) => {
  const patientId = requireId(req.body?.patientId, "Bệnh nhân");
  const intake = await SupportRequest.findOne({ patientId }).select("_id").lean().exec();
  if (!intake) throw problem("USE_INTAKE_WORKFLOW", "Bệnh nhân cần bổ sung địa chỉ và được bệnh viện tiếp nhận trước khi phân công bác sĩ.", 409);
  const result = await coordination.assign(String(intake._id), { doctorId: req.body.doctorId, revision: req.body.revision, reason: req.body.reason, actorId: req.user.id });
  const assignment = await decorate(DoctorAssignment.findById(result.assignment._id)).lean().exec();
  return res.status(result.unchanged ? 200 : 201).json({ msg: "Đã ghi nhận phân công theo quyết định của bệnh viện.", assignment, intake: result.intake });
});
exports.unassignDoctor = wrap(async (req, res) => {
  const patientId = requireId(req.body?.patientId, "Bệnh nhân");
  const intake = await SupportRequest.findOne({ patientId }).select("_id").lean().exec();
  if (intake) { const updated = await coordination.unassign(String(intake._id), { revision: req.body.revision, reason: req.body.reason, actorId: req.user.id }); return res.json({ msg: "Đã kết thúc phân công và giữ lịch sử.", intake: updated }); }
  const assignment = await coordination.unassignLegacy({ patientId, actorId: req.user.id, reason: req.body.reason });
  return res.json({ msg: assignment ? "Đã kết thúc phân công cũ và giữ lịch sử." : "Bệnh nhân hiện không có phân công đang hoạt động.", assignment });
});
exports.getAssignmentHistory = wrap(async (req, res) => {
  const patientId = requireId(req.params.patientId, "Bệnh nhân");
  const rows = await decorate(DoctorAssignment.find({ patientId })).populate("endedBy", "_id username fullName").populate("hospitalId", "_id name address phone").sort({ assignedAt: -1 }).lean().exec();
  return res.json(rows);
});
module.exports = exports;
