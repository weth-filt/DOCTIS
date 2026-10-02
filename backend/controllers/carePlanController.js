const CarePlan = require("../models/CarePlan");
const User = require("../models/User");

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

// ======================================================
// GET /care-plans/doctor/patient/:patientId
// ======================================================
exports.getDoctorPatientCarePlan = async (req, res) => {
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

    const plan = await CarePlan.findOne({
      patientId,
      doctorId: req.user.id,
    })
      .sort({ updatedAt: -1 })
      .lean();

    if (!plan) {
      return res.status(404).json({
        msg: "Chưa có kế hoạch chăm sóc.",
      });
    }

    return res.json(plan);
  } catch (err) {
    console.error("GET CARE PLAN ERROR =", err);

    return res.status(500).json({
      msg:
        err.message ||
        "Không thể lấy kế hoạch chăm sóc.",
    });
  }
};

// ======================================================
// POST /care-plans/doctor
// ======================================================
exports.saveDoctorCarePlan = async (req, res) => {
  try {
    if (!doctorOnly(req, res)) return;

    const {
      patientId,
      days,
      status,
      doctorNote,
    } = req.body;

    if (
      !patientId ||
      !Array.isArray(days)
    ) {
      return res.status(400).json({
        msg: "Thiếu patientId hoặc days.",
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

    const finalStatus =
      status === "confirmed"
        ? "confirmed"
        : "draft";

    const plan =
      await CarePlan.findOneAndUpdate(
        {
          patientId,
          doctorId: req.user.id,
        },
        {
          patientId,
          doctorId: req.user.id,
          source: "DOCTOR",
          status: finalStatus,
          days,
          doctorNote: String(
            doctorNote || ""
          ),
          confirmedAt:
            finalStatus === "confirmed"
              ? new Date()
              : null,
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );

    return res.status(201).json(plan);
  } catch (err) {
    console.error("SAVE CARE PLAN ERROR =", err);

    return res.status(500).json({
      msg:
        err.message ||
        "Không thể lưu kế hoạch chăm sóc.",
    });
  }
};

// ======================================================
// GET /care-plans/my-confirmed
// Patient chỉ xem kế hoạch của chính mình.
// ======================================================
exports.getMyConfirmedCarePlan = async (req, res) => {
  try {
    const plan = await CarePlan.findOne({
      patientId: req.user.id,
      status: "confirmed",
    })
      .sort({
        confirmedAt: -1,
        updatedAt: -1,
      })
      .lean();

    if (!plan) {
      return res.status(404).json({
        msg:
          "Chưa có kế hoạch chăm sóc đã chốt.",
      });
    }

    return res.json(plan);
  } catch (err) {
    console.error(
      "GET MY CONFIRMED CARE PLAN ERROR =",
      err
    );

    return res.status(500).json({
      msg:
        err.message ||
        "Không thể lấy kế hoạch chăm sóc.",
    });
  }
};
