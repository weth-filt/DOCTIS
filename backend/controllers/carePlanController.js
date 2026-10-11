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
      source: "DOCTOR",
    })
      .sort({ updatedAt: -1 })
      .lean() || await CarePlan.findOne({ patientId, source: "AI" })
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

    if (finalStatus === "confirmed" && !days.some((day) => Array.isArray(day?.items) && day.items.length > 0)) {
      return res.status(400).json({
        msg: "Hãy thêm ít nhất một hoạt động trước khi chốt kế hoạch.",
      });
    }

    const plan =
      await CarePlan.findOneAndUpdate(
        {
          patientId,
          doctorId: req.user.id,
          source: "DOCTOR",
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
// POST /care-plans/my — patient saves their generated plan
// It remains a draft until a doctor reviews and confirms it.
// ======================================================
exports.saveMyGeneratedCarePlan = async (req, res) => {
  try {
    if (req.user?.role !== "user") {
      return res.status(403).json({ msg: "Chỉ bệnh nhân mới lưu kế hoạch cá nhân." });
    }

    const days = req.body?.days;
    if (!Array.isArray(days) || days.length === 0) {
      return res.status(400).json({ msg: "Kế hoạch cần có danh sách ngày." });
    }

    const patient = await User.findById(req.user.id).select("_id doctorId role").lean();
    if (!patient || patient.role !== "user") {
      return res.status(404).json({ msg: "Không tìm thấy hồ sơ bệnh nhân." });
    }

    const plan = await CarePlan.findOneAndUpdate(
      { patientId: patient._id, source: "AI" },
      {
        patientId: patient._id,
        doctorId: patient.doctorId || null,
        source: "AI",
        status: "draft",
        days,
        doctorNote: "",
        confirmedAt: null,
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json(plan);
  } catch (err) {
    console.error("SAVE PATIENT GENERATED CARE PLAN ERROR =", err);
    return res.status(500).json({ msg: err.message || "Không thể lưu kế hoạch cá nhân." });
  }
};

// ======================================================
// GET /care-plans/my-confirmed
// Patient chỉ xem kế hoạch của chính mình.
// ======================================================
exports.getMyConfirmedCarePlan = async (req, res) => {
  try {
    if (req.user?.role !== "user") {
      return res.status(403).json({ msg: "Chỉ bệnh nhân mới xem được kế hoạch của tài khoản này." });
    }
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
