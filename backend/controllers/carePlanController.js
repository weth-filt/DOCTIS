const CarePlan = require("../models/CarePlan");
const User = require("../models/User");
const { createCarePlanPersistence } = require("../services/carePlanPersistence");
const generatedPlans = createCarePlanPersistence();

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
      .lean() || await CarePlan.findOne({ patientId, source: "AI", archivedAt: null, isCurrent: { $ne: false } })
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
    if (!patientOnly(req, res)) return;
    return res.status(201).json(await generatedPlans.create(req.user.id, req.body));
  } catch (err) {
    return generatedPlanError(res, err);
  }
};

const patientOnly = (req, res) => {
  if (req.user?.role !== "user") { res.status(403).json({ msg: "Chỉ bệnh nhân mới quản lý kế hoạch cá nhân." }); return false; }
  if (typeof req.user.id !== "string" || !/^[a-f\d]{24}$/i.test(req.user.id)) { res.status(400).json({ msg: "Không xác định được tài khoản hợp lệ." }); return false; }
  return true;
};
const generatedPlanError = (res, err) => {
  if (err.status && err.code) return res.status(err.status).json({ code: err.code, msg: err.message, ...(err.currentPlan ? { currentPlan: err.currentPlan } : {}) });
  console.error("GENERATED CARE PLAN ERROR =", err.name || "Error");
  return res.status(500).json({ code: "CARE_PLAN_UNAVAILABLE", msg: "Chưa thể đồng bộ kế hoạch. Vui lòng thử lại." });
};
exports.getMyCurrentGeneratedCarePlan = async (req, res) => {
  try {
    if (!patientOnly(req, res)) return;
    const plan = await generatedPlans.current(req.user.id);
    if (!plan) return res.status(404).json({ code: "NO_CURRENT_PLAN", msg: "Chưa có kế hoạch cá nhân hiện hành." });
    return res.json(plan);
  } catch (err) { return generatedPlanError(res, err); }
};
exports.getMyCarePlanHistory = async (req, res) => {
  try {
    if (!patientOnly(req, res)) return;
    return res.json(await generatedPlans.history(req.user.id));
  } catch (err) { return generatedPlanError(res, err); }
};
exports.updateMyCarePlanItem = async (req, res) => {
  try {
    if (!patientOnly(req, res)) return;
    return res.json(await generatedPlans.toggle(req.user.id, req.params.itemId, req.body));
  } catch (err) { return generatedPlanError(res, err); }
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
      archivedAt: null,
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

// GET /care-plans/my/mobile
// Mobile displays the doctor's confirmed plan first, then the patient's saved AI draft.
exports.getMyMobileCarePlan = async (req, res) => {
  try {
    if (req.user?.role !== "user") {
      return res.status(403).json({ msg: "Chỉ bệnh nhân mới xem được kế hoạch chăm sóc." });
    }

    const doctorPlan = await CarePlan.findOne({
      patientId: req.user.id,
      source: "DOCTOR",
      status: "confirmed",
    }).sort({ confirmedAt: -1, updatedAt: -1 }).lean();

    const plan = doctorPlan || await CarePlan.findOne({
      patientId: req.user.id,
      source: "AI",
      archivedAt: null,
      isCurrent: { $ne: false },
    }).sort({ updatedAt: -1 }).lean();

    if (!plan) {
      return res.status(404).json({ msg: "Chưa có kế hoạch chăm sóc." });
    }

    return res.json(plan);
  } catch (err) {
    console.error("GET MOBILE CARE PLAN ERROR =", err);
    return res.status(500).json({ msg: err.message || "Không thể tải kế hoạch chăm sóc." });
  }
};
