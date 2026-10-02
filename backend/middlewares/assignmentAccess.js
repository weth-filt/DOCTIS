const mongoose = require("mongoose");
const DoctorAssignment = require("../models/DoctorAssignment");

/* ======================================================
   VALID OBJECT ID
====================================================== */

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
};

/* ======================================================
   GET ACTIVE ASSIGNMENT OF PATIENT
====================================================== */

const getActiveAssignment = async (patientId) => {
  if (!isValidObjectId(patientId)) {
    return null;
  }

  return DoctorAssignment.findOne({
    patientId,
    status: "active",
  })
    .populate(
      "doctorId",
      "_id username fullName email phone avatar"
    )
    .lean();
};

/* ======================================================
   CHECK DOCTOR -> PATIENT ASSIGNMENT
====================================================== */

const isAssignedDoctor = async (
  doctorId,
  patientId
) => {
  if (
    !isValidObjectId(doctorId) ||
    !isValidObjectId(patientId)
  ) {
    return false;
  }

  const assignment =
    await DoctorAssignment.findOne({
      doctorId,
      patientId,
      status: "active",
    })
      .select("_id")
      .lean();

  return Boolean(assignment);
};

/* ======================================================
   REQUIRE ASSIGNED DOCTOR
====================================================== */

const requireAssignedDoctor = async (
  req,
  res,
  patientId
) => {
  if (req.user?.role !== "doctor") {
    res.status(403).json({
      msg:
        "Chỉ bác sĩ mới có quyền thực hiện thao tác này.",
    });

    return false;
  }

  if (!isValidObjectId(patientId)) {
    res.status(400).json({
      msg: "patientId không hợp lệ.",
    });

    return false;
  }

  const allowed =
    await isAssignedDoctor(
      req.user.id,
      patientId
    );

  if (!allowed) {
    res.status(403).json({
      msg:
        "Bệnh nhân này chưa được phân công cho bác sĩ hiện tại.",
      code: "PATIENT_NOT_ASSIGNED",
    });

    return false;
  }

  return true;
};

/* ======================================================
   GET ALL ACTIVE PATIENT IDS OF DOCTOR
====================================================== */

const getAssignedPatientIds = async (
  doctorId
) => {
  if (!isValidObjectId(doctorId)) {
    return [];
  }

  const rows =
    await DoctorAssignment.find({
      doctorId,
      status: "active",
    })
      .select("patientId")
      .lean();

  return rows.map(
    (row) => row.patientId
  );
};

module.exports = {
  isValidObjectId,
  getActiveAssignment,
  isAssignedDoctor,
  requireAssignedDoctor,
  getAssignedPatientIds,
};