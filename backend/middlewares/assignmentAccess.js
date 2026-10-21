const mongoose = require("mongoose");
const DoctorAssignment = require("../models/DoctorAssignment");
const User = require("../models/User");
const isValidObjectId = id => mongoose.Types.ObjectId.isValid(String(id || ""));
const same = (a, b) => Boolean(a && b) && String(a?._id || a) === String(b?._id || b);

function createAssignmentAccess({ AssignmentModel = DoctorAssignment, UserModel = User, HospitalModel, SupportRequestModel } = {}) {
  async function allowed(assignment) {
    if (!assignment) return false;
    const doctorId = assignment.doctorId?._id || assignment.doctorId;
    const [doctor, patient] = await Promise.all([
      UserModel.findOne({ _id: doctorId, role: "doctor" }).select("_id role hospitalId").lean(),
      UserModel.findOne({ _id: assignment.patientId, role: "user" }).select("_id").lean(),
    ]);
    if (!doctor || !patient) return false;
    // Existing assignments remain usable until an explicit coordination change.
    if (!assignment.hospitalId && !assignment.supportRequestId) return true;
    if (!assignment.hospitalId || !assignment.supportRequestId || !same(doctor.hospitalId, assignment.hospitalId)) return false;
    const Hospital = HospitalModel || require("../models/Hospital");
    const Intake = SupportRequestModel || require("../models/SupportRequest");
    const [hospital, intake] = await Promise.all([
      Hospital.findOne({ _id: assignment.hospitalId, active: true, verified: true }).select("_id").lean(),
      Intake.findOne({ _id: assignment.supportRequestId, patientId: assignment.patientId, status: "assigned" }).select("hospitalId assignedDoctorId acceptedAt").lean(),
    ]);
    return Boolean(hospital && intake?.acceptedAt && same(intake.hospitalId, assignment.hospitalId) && same(intake.assignedDoctorId, doctorId));
  }
  const isAssignedDoctor = async (doctorId, patientId) => {
    if (!isValidObjectId(doctorId) || !isValidObjectId(patientId)) return false;
    return allowed(await AssignmentModel.findOne({ doctorId, patientId, status: "active" }).select("doctorId patientId hospitalId supportRequestId").lean());
  };
  const getActiveAssignment = async patientId => {
    if (!isValidObjectId(patientId)) return null;
    const row = await AssignmentModel.findOne({ patientId, status: "active" }).populate("doctorId", "_id username fullName email phone avatar").lean();
    return await allowed(row) ? row : null;
  };
  const requireAssignedDoctor = async (req, res, patientId) => {
    if (req.user?.role !== "doctor") { res.status(403).json({ msg: "Chỉ bác sĩ mới có quyền thực hiện thao tác này." }); return false; }
    if (!isValidObjectId(patientId)) { res.status(400).json({ msg: "patientId không hợp lệ." }); return false; }
    if (!await isAssignedDoctor(req.user.id, patientId)) { res.status(403).json({ msg: "Bệnh nhân không còn thuộc phân công hợp lệ của bác sĩ này.", code: "PATIENT_NOT_ASSIGNED" }); return false; }
    return true;
  };
  const getAssignedPatientIds = async doctorId => {
    if (!isValidObjectId(doctorId)) return [];
    const rows = await AssignmentModel.find({ doctorId, status: "active" }).select("doctorId patientId hospitalId supportRequestId").lean();
    if (!rows.length) return [];
    // Apply the same permission checks in batches. The previous per-row checks
    // repeated doctor, patient, hospital and intake reads for every patient.
    const [doctor, patients] = await Promise.all([
      UserModel.findOne({ _id: doctorId, role: "doctor" }).select("_id role hospitalId").lean(),
      UserModel.find({ _id: { $in: rows.map(row => row.patientId) }, role: "user" }).select("_id").lean(),
    ]);
    if (!doctor) return [];
    const patientIds = new Set(patients.map(patient => String(patient._id)));
    const coordinated = rows.filter(row => patientIds.has(String(row.patientId)) && row.hospitalId && row.supportRequestId && same(doctor.hospitalId, row.hospitalId));
    let hospitals = [], intakes = [];
    if (coordinated.length) {
      const Hospital = HospitalModel || require("../models/Hospital");
      const Intake = SupportRequestModel || require("../models/SupportRequest");
      [hospitals, intakes] = await Promise.all([
        Hospital.find({ _id: { $in: coordinated.map(row => row.hospitalId) }, active: true, verified: true }).select("_id").lean(),
        Intake.find({ _id: { $in: coordinated.map(row => row.supportRequestId) }, status: "assigned" }).select("_id patientId hospitalId assignedDoctorId acceptedAt").lean(),
      ]);
    }
    const hospitalIds = new Set(hospitals.map(hospital => String(hospital._id)));
    const intakeById = new Map(intakes.map(intake => [String(intake._id), intake]));
    return rows.filter(row => {
      if (!patientIds.has(String(row.patientId))) return false;
      if (!row.hospitalId && !row.supportRequestId) return true;
      if (!row.hospitalId || !row.supportRequestId || !same(doctor.hospitalId, row.hospitalId)) return false;
      const intake = intakeById.get(String(row.supportRequestId));
      return Boolean(hospitalIds.has(String(row.hospitalId)) && intake?.acceptedAt && same(intake.patientId, row.patientId) && same(intake.hospitalId, row.hospitalId) && same(intake.assignedDoctorId, doctorId));
    }).map(row => row.patientId);
  };
  return { isValidObjectId, isAssignedDoctor, getActiveAssignment, requireAssignedDoctor, getAssignedPatientIds };
}
module.exports = { ...createAssignmentAccess(), createAssignmentAccess };
