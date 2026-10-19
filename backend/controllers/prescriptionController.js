const mongoose = require("mongoose");
const Prescription = require("../models/Prescription");
const User = require("../models/User");
const CarePlan = require("../models/CarePlan");

const {
  requireAssignedDoctor,
  isValidObjectId,
} = require("../middlewares/assignmentAccess");

const doctorOnly = (req, res) => {
  if (req.user?.role !== "doctor") {
    res.status(403).json({
      msg: "Chỉ bác sĩ mới có quyền.",
    });
    return false;
  }

  return true;
};

const buildPrescriptionCareItems = (prescription) => {
  const items = [];

  for (const medicine of prescription.medicines || []) {
    const times =
      Array.isArray(medicine.times) &&
      medicine.times.length
        ? medicine.times
        : ["07:00"];

    for (const time of times) {
      const mealText =
        medicine.mealRelation === "BEFORE_MEAL"
          ? " · Trước ăn"
          : medicine.mealRelation === "AFTER_MEAL"
          ? " · Sau ăn"
          : "";

      items.push({
        id: `PRESCRIPTION:${prescription._id}:${medicine.name}:${time}`,
        type: "MEDICINE",
        time,
        title: `💊 ${medicine.name}`,
        description:
          `${medicine.dosage || "Theo chỉ định"} · ${
            medicine.frequency || "Theo chỉ định"
          }${mealText}`,
      });
    }
  }

  return items;
};

const syncPrescriptionToCarePlan = async (prescription) => {
  const plan = await CarePlan.findOne({
    patientId: prescription.patientId,
    doctorId: prescription.doctorId,
  });

  // Nếu chưa có care plan thì vẫn giữ đơn thuốc.
  if (!plan) return;

  for (const day of plan.days || []) {
    day.items = (day.items || []).filter(
      (item) =>
        !String(item.id || "").startsWith(
          `PRESCRIPTION:${prescription._id}:`
        )
    );
  }

  const medicationItems =
    buildPrescriptionCareItems(prescription);

  for (const day of plan.days || []) {
    for (const item of medicationItems) {
      day.items.push({ ...item });
    }

    day.items.sort((a, b) =>
      String(a.time || "").localeCompare(
        String(b.time || "")
      )
    );
  }

  await plan.save();
};

const removePrescriptionFromCarePlan = async (
  prescription
) => {
  const plan = await CarePlan.findOne({
    patientId: prescription.patientId,
    doctorId: prescription.doctorId,
  });

  if (!plan) return;

  for (const day of plan.days || []) {
    day.items = (day.items || []).filter(
      (item) =>
        !String(item.id || "").startsWith(
          `PRESCRIPTION:${prescription._id}:`
        )
    );
  }

  await plan.save();
};

// ======================================================
// GET /prescriptions/doctor/patient/:patientId
// ======================================================
exports.getDoctorPatientPrescriptions = async (
  req,
  res
) => {
  try {
    if (!doctorOnly(req, res)) return;

    const { patientId } = req.params;

    if (!isValidObjectId(patientId)) {
      return res.status(400).json({
        msg: "patientId không hợp lệ.",
      });
    }

    if (
      !(await requireAssignedDoctor(
        req,
        res,
        patientId
      ))
    ) {
      return;
    }

    const list = await Prescription.find({
      patientId,
      doctorId: req.user.id,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(list);
  } catch (err) {
    console.error(
      "GET DOCTOR PATIENT PRESCRIPTIONS ERROR =",
      err
    );

    return res.status(500).json({
      msg:
        err.message ||
        "Không thể lấy đơn thuốc.",
    });
  }
};

// ======================================================
// POST /prescriptions/doctor
// ======================================================
exports.createDoctorPrescription = async (
  req,
  res
) => {
  try {
    if (!doctorOnly(req, res)) return;

    const {
      patientId,
      title,
      note,
      medicines,
      status,
    } = req.body;

    if (
      !patientId ||
      !title ||
      !Array.isArray(medicines) ||
      !medicines.length
    ) {
      return res.status(400).json({
        msg: "Thiếu thông tin đơn thuốc.",
      });
    }

    if (!isValidObjectId(patientId)) {
      return res.status(400).json({
        msg: "patientId không hợp lệ.",
      });
    }

    if (
      !(await requireAssignedDoctor(
        req,
        res,
        patientId
      ))
    ) {
      return;
    }

    const patient = await User.findOne({
      _id: patientId,
      role: "user",
    }).select("_id");

    if (!patient) {
      return res.status(404).json({
        msg: "Không tìm thấy bệnh nhân.",
      });
    }

    const normalizedMedicines = medicines
      .map((m) => ({
        name: String(m?.name || "").trim(),
        dosage: String(
          m?.dosage || ""
        ).trim(),
        frequency: String(
          m?.frequency || "1 lần/ngày"
        ).trim(),
        times:
          Array.isArray(m?.times) &&
          m.times.length
            ? m.times
                .map((t) => String(t).trim())
                .filter(Boolean)
            : ["07:00"],
        mealRelation: [
          "BEFORE_MEAL",
          "AFTER_MEAL",
        ].includes(m?.mealRelation)
          ? m.mealRelation
          : "",
      }))
      .filter((m) => m.name);

    if (!normalizedMedicines.length) {
      return res.status(400).json({
        msg:
          "Phải có ít nhất một thuốc hợp lệ.",
      });
    }

    const finalStatus =
      status === "confirmed"
        ? "confirmed"
        : "draft";

    const prescription =
      await Prescription.create({
        patientId,
        doctorId: req.user.id,
        title: String(title).trim(),
        note: String(note || "").trim(),
        medicines: normalizedMedicines,
        status: finalStatus,
        confirmedAt:
          finalStatus === "confirmed"
            ? new Date()
            : null,
      });

    if (finalStatus === "confirmed") {
      await syncPrescriptionToCarePlan(
        prescription
      );
    }

    return res.status(201).json(
      prescription
    );
  } catch (err) {
    console.error(
      "CREATE PRESCRIPTION ERROR =",
      err
    );

    return res.status(500).json({
      msg:
        err.message ||
        "Không thể lưu đơn thuốc.",
    });
  }
};

// ======================================================
// PUT /prescriptions/doctor/:id/cancel
// Không DELETE. Chuyển status -> cancelled.
// ======================================================
exports.cancelDoctorPrescription = async (
  req,
  res
) => {
  try {
    if (!doctorOnly(req, res)) return;

    const { id } = req.params;
    const { reason } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        msg: "ID đơn thuốc không hợp lệ.",
      });
    }

    const prescription =
      await Prescription.findOne({
        _id: id,
        doctorId: req.user.id,
      });

    if (!prescription) {
      return res.status(404).json({
        msg:
          "Không tìm thấy đơn thuốc.",
      });
    }

    if (
      !(await requireAssignedDoctor(
        req,
        res,
        prescription.patientId
      ))
    ) {
      return;
    }

    if (
      prescription.status === "cancelled"
    ) {
      return res.json({
        msg:
          "Đơn thuốc đã được hủy trước đó.",
        prescription,
      });
    }

    prescription.status = "cancelled";

    const cleanReason =
      String(reason || "").trim();

    if (cleanReason) {
      prescription.note = `${
        prescription.note
          ? `${prescription.note} | `
          : ""
      }Hủy thuốc: ${cleanReason}`;
    }

    await prescription.save();

    await removePrescriptionFromCarePlan(
      prescription
    );

    return res.json({
      msg:
        "Đã hủy đơn thuốc và cập nhật kế hoạch chăm sóc.",
      prescription,
    });
  } catch (err) {
    console.error(
      "CANCEL PRESCRIPTION ERROR =",
      err
    );

    return res.status(500).json({
      msg:
        err.message ||
        "Không thể hủy đơn thuốc.",
    });
  }
};

// ======================================================
// GET /prescriptions/my
// Patient chỉ xem đơn confirmed của chính mình.
// ======================================================
exports.getMyConfirmedPrescriptions = async (
  req,
  res
) => {
  try {
    if (req.user?.role !== "user") return res.status(403).json({ msg: "Chỉ bệnh nhân xem đơn thuốc cá nhân." });
    const list = await Prescription.find({
      patientId: req.user.id,
      status: "confirmed",
    })
      .populate(
        "doctorId",
        "username fullName email specialty specialization"
      )
      .sort({
        confirmedAt: -1,
        createdAt: -1,
      })
      .lean();

    return res.json(list);
  } catch (err) {
    console.error(
      "GET MY PRESCRIPTIONS ERROR =",
      err
    );

    return res.status(500).json({
      msg:
        err.message ||
        "Không thể lấy đơn thuốc.",
    });
  }
};

module.exports = exports;
