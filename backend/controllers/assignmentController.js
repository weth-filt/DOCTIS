const User = require("../models/User");
const DoctorAssignment = require("../models/DoctorAssignment");
const SupportRequest = require("../models/SupportRequest");
const Hospital = require("../models/Hospital");
const Ward = require("../models/Ward");
const coordination = require("../services/careCoordinationService");
const { requireId, problem, sendProblem } = require("../services/coordinationUtils");
const { coordinationAssignmentState, idOf } = require("../services/coordinationAssignmentState");
const DOCTOR_FIELDS = "_id username fullName email phone avatar role hospitalId wardId ward city";
const HOSPITAL_FIELDS = "_id name address phone wardId city acceptingPatients active verified sourceUrl";
const decorate = query => query.populate("doctorId", DOCTOR_FIELDS).populate("assignedBy", "_id username fullName");
const wrap = handler => async (req, res) => { try { if (req.user?.role !== "admin") throw problem("ADMIN_REQUIRED", "Chỉ admin mới có quyền phân công.", 403); return await handler(req, res); } catch (error) { return sendProblem(res, error); } };
exports.getPatientsWithAssignment = wrap(async (req, res) => {
  const [patients, assignments, intakes] = await Promise.all([
    User.find({ role: "user" }).select("_id username fullName email phone avatar gender dateOfBirth address ward wardId city hospitalId doctorId bloodType allergies medicalHistory chronicDiseases").populate("doctorId", DOCTOR_FIELDS).sort({ fullName: 1, username: 1 }).lean().exec(),
    decorate(DoctorAssignment.find({ status: "active" })).populate("hospitalId", HOSPITAL_FIELDS).lean().exec(),
    SupportRequest.find().select("_id patientId hospitalId status revision acceptedAt assignedDoctorId").populate("hospitalId", HOSPITAL_FIELDS).lean().exec(),
  ]);
  const assignmentByPatient = new Map();
  assignments.forEach(row => { const key = String(row.patientId); if (!assignmentByPatient.has(key)) assignmentByPatient.set(key, row); });
  const intakeByPatient = new Map(intakes.map(row => [String(row.patientId), row]));
  const result = patients.map(patient => {
    const assignment = assignmentByPatient.get(String(patient._id));
    const sourceIntake = intakeByPatient.get(String(patient._id)) || null;
    const state = coordinationAssignmentState(patient, sourceIntake, assignment);
    const doctor = state.doctor, hospital = state.hospital;
    const intake = sourceIntake ? { ...sourceIntake, hospitalId: idOf(sourceIntake.hospitalId), hospital: sourceIntake.hospitalId?.name ? sourceIntake.hospitalId : null } : null;
    return { ...patient, doctorId: idOf(patient.doctorId), assigned: Boolean(doctor), assignedDoctor: doctor, currentDoctor: doctor, assignedDoctorId: doctor?._id || null, assignedHospital: hospital, hospital, assignedHospitalId: hospital?._id || null, assignedAt: assignment?.assignedAt || null, assignmentReason: assignment?.reason || "", assignedBy: assignment?.assignedBy || null, assignmentStatus: doctor ? state.needsReconciliation ? "needs_reconciliation" : "active" : "unassigned", intake, legacyAssignment: state.legacyAssignment, legacyDoctorReference: state.legacyReference, needsReconciliation: state.needsReconciliation };
  });
  return res.json(result);
});
exports.getDoctorsForAssignment = wrap(async (req, res) => {
  const filter = { role: "doctor" }; if (req.query?.hospitalId) filter.hospitalId = requireId(req.query.hospitalId, "Bệnh viện");
  const [doctors, counts] = await Promise.all([User.find(filter).select(DOCTOR_FIELDS).sort({ fullName: 1, username: 1 }).lean().exec(), DoctorAssignment.aggregate([{ $match: { status: "active" } }, { $group: { _id: "$doctorId", patientCount: { $sum: 1 } } }])]);
  const hospitals = await Hospital.find({ _id: { $in: doctors.map(doctor => doctor.hospitalId).filter(Boolean) } }).select(HOSPITAL_FIELDS).lean().exec();
  const wards = await Ward.find({ _id: { $in: hospitals.map(hospital => hospital.wardId).filter(Boolean) } }).select("_id name code city active verified").lean().exec();
  const wardById = new Map(wards.map(ward => [String(ward._id), ward]));
  const hospitalById = new Map(hospitals.map(hospital => [String(hospital._id), { ...hospital, ward: wardById.get(String(hospital.wardId)) || null }]));
  const countByDoctor = new Map(counts.map(row => [String(row._id), row.patientCount]));
  return res.json(doctors.map(doctor => ({ ...doctor, hospital: hospitalById.get(String(doctor.hospitalId)) || null, displayName: `Doctor ${String(doctor.fullName || doctor.username || "Bác sĩ").replace(/^doctor\s+/i, "")}`, patientCount: countByDoctor.get(String(doctor._id)) || 0 })));
});
exports.getAssignmentSummary = wrap(async (req, res) => {
  const [patients, totalDoctors, assignments] = await Promise.all([
    User.find({ role: "user" }).select("_id doctorId").populate("doctorId", "_id role").lean().exec(),
    User.countDocuments({ role: "doctor" }),
    DoctorAssignment.find({ status: "active" }).select("patientId doctorId").populate("doctorId", "_id role").lean().exec(),
  ]);
  const patientIds = new Set(patients.map(patient => String(patient._id)));
  const active = assignments.filter(assignment => assignment.doctorId?.role === "doctor" && patientIds.has(String(assignment.patientId)));
  const assignedIds = new Set([...active.map(assignment => String(assignment.patientId)), ...patients.filter(patient => patient.doctorId?.role === "doctor").map(patient => String(patient._id))]);
  return res.json({ totalPatients: patients.length, totalDoctors, assignedPatients: assignedIds.size, unassignedPatients: patients.length - assignedIds.size, activeAssignments: active.length });
});
exports.getPatientAssignment = wrap(async (req, res) => {
  const patientId = requireId(req.params.patientId, "Bệnh nhân");
  const [assignment, intake, patient] = await Promise.all([
    decorate(DoctorAssignment.findOne({ patientId, status: "active" })).populate("hospitalId", HOSPITAL_FIELDS).lean().exec(),
    SupportRequest.findOne({ patientId }).select("_id status hospitalId assignedDoctorId revision acceptedAt").populate("hospitalId", HOSPITAL_FIELDS).lean().exec(),
    User.findOne({ _id: patientId, role: "user" }).select("_id doctorId").populate("doctorId", DOCTOR_FIELDS).lean().exec(),
  ]);
  if (!patient) throw problem("PATIENT_NOT_FOUND", "Không tìm thấy tài khoản bệnh nhân.", 404);
  const state = coordinationAssignmentState(patient, intake, assignment), hospital = state.hospital;
  return res.json({ assigned: Boolean(state.doctor), assignment: assignment ? { ...assignment, hospitalId: idOf(assignment.hospitalId), hospital: assignment.hospitalId?.name ? assignment.hospitalId : null } : null, currentDoctor: state.doctor, assignedDoctor: state.doctor, hospital, legacyAssignment: state.legacyAssignment, legacyDoctorReference: state.legacyReference, needsReconciliation: state.needsReconciliation, intake: intake ? { ...intake, hospitalId: idOf(intake.hospitalId), hospital: intake.hospitalId?.name ? intake.hospitalId : null } : null });
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
