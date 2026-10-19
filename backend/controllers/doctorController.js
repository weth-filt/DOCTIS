const User = require("../models/User");
const Health = require("../models/Health");
const Advice = require("../models/Advice");
const getRisk = require("../utils/riskAssessment");

const {
  requireAssignedDoctor,
  getAssignedPatientIds,
} = require("../middlewares/assignmentAccess");

/*
|--------------------------------------------------------------------------
| DOCTOR ONLY
|--------------------------------------------------------------------------
*/

const doctorOnly = (req, res) => {
  if (req.user?.role !== "doctor") {
    res.status(403).json({
      msg: "Chỉ bác sĩ mới có quyền thực hiện thao tác này.",
    });

    return false;
  }

  return true;
};

/*
|--------------------------------------------------------------------------
| RISK
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| GET ASSIGNED PATIENTS
|--------------------------------------------------------------------------
|
| GET /api/doctor/patients
|
*/

exports.getPatients = async (req, res) => {
  try {
    if (!doctorOnly(req, res)) {
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | CHỈ LẤY BỆNH NHÂN ĐƯỢC ADMIN PHÂN CÔNG
    |--------------------------------------------------------------------------
    */

    const patientIds = await getAssignedPatientIds(req.user.id);

    if (!patientIds.length) {
      return res.json([]);
    }

    /*
    |--------------------------------------------------------------------------
    | LẤY THÔNG TIN BỆNH NHÂN
    |--------------------------------------------------------------------------
    */

    const patients = await User.find({
      _id: {
        $in: patientIds,
      },
      role: "user",
    })
      .select(
        "_id username fullName email phone avatar gender dateOfBirth address bloodType allergies medicalHistory chronicDiseases underlyingDiseases underlyingDisease diseases"
      )
      .lean();

    /*
    |--------------------------------------------------------------------------
    | LẤY HEALTH
    |--------------------------------------------------------------------------
    |
    | QUAN TRỌNG:
    | Health của project đang lưu bằng:
    |
    | userId: req.user.id
    |
    | nên phải tìm bằng userId.
    |
    */

    const result = await Promise.all(
      patients.map(async (patient) => {
        const history = await Health.find({
          userId: patient._id,
        })
          .sort({
            createdAt: 1,
          })
          .lean();

        const latestHealth =
          history.length > 0
            ? history[history.length - 1]
            : null;

        /*
        | Nếu database cũ chưa có risk thì tính lại
        */

        if (latestHealth) latestHealth.risk = getRisk(latestHealth);

        return {
          ...patient,

          healthHistory: history,

          latestHealth,

          assignedDoctorId: req.user.id,

          assignmentStatus: "active",
        };
      })
    );

    /*
    |--------------------------------------------------------------------------
    | SORT THEO TÊN BỆNH NHÂN
    |--------------------------------------------------------------------------
    */

    result.sort((a, b) =>
      String(
        a.fullName ||
          a.username ||
          ""
      ).localeCompare(
        String(
          b.fullName ||
            b.username ||
            ""
        ),
        "vi"
      )
    );

    return res.json(result);
  } catch (err) {
    console.error("GET DOCTOR PATIENTS ERROR =");

    return res.status(500).json({
      msg:
        "Không thể tải bệnh nhân được phân công.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET PATIENT HEALTH
|--------------------------------------------------------------------------
|
| GET /api/doctor/patient-health/:id
|
*/

exports.getPatientHealth = async (req, res) => {
  try {
    const allowed = await requireAssignedDoctor(
      req,
      res,
      req.params.id
    );

    if (!allowed) {
      return;
    }

    const history = await Health.find({
      userId: req.params.id,
    })
      .sort({
        createdAt: 1,
      })
      .lean();

    history.forEach((item) => {
      item.risk = getRisk(item);
    });

    return res.json(history);
  } catch (err) {
    console.error("GET PATIENT HEALTH ERROR =");

    return res.status(500).json({
      msg:
        "Không thể lấy lịch sử sức khỏe.",
    });
  }
};

exports.getAIRisk = async (req, res) => {
  try {
    const allowed = await requireAssignedDoctor(
      req,
      res,
      req.params.id
    );

    if (!allowed) {
      return;
    }

    const latest = await Health.findOne({
      userId: req.params.id,
    })
      .sort({
        createdAt: -1,
      })
      .lean();

    if (!latest) {
      return res.json({
        risk: "Chưa có dữ liệu",
        health: null,
      });
    }

    /*
    | Nếu record chưa có risk thì tính tại đây
    */

    const calculatedRisk = getRisk(latest);

    latest.risk = calculatedRisk;

    return res.json({
      risk: calculatedRisk,
      health: latest,
    });
  } catch (err) {
    console.error("GET AI RISK ERROR =");

    return res.status(500).json({
      msg:
        "Không thể phân tích nguy cơ.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET ALL DOCTORS
|--------------------------------------------------------------------------
|
| GET /api/doctor/doctors
|
*/

exports.getDoctors = async (req, res) => {
  try {
    const doctors = await User.find({
      role: "doctor",
    })
      .select(
        "_id username fullName email phone avatar"
      )
      .sort({
        fullName: 1,
        username: 1,
      })
      .lean();

    return res.json(
      doctors.map((doctor) => ({
        ...doctor,

        displayName:
          `Doctor ${String(
            doctor.fullName ||
              doctor.username ||
              "Bác sĩ"
          ).replace(
            /^doctor\s+/i,
            ""
          )}`,
      }))
    );
  } catch (err) {
    console.error("GET DOCTORS ERROR =");

    return res.status(500).json({
      msg:
        "Không thể tải danh sách bác sĩ.",
    });
  }
};

exports.sendAdvice = async (req, res) => {
  try {
    const patientId =
      req.body?.patientId;

    const allowed =
      await requireAssignedDoctor(
        req,
        res,
        patientId
      );

    if (!allowed) {
      return;
    }

    const {
      title,
      message,
    } = req.body || {};

    if (
      !String(
        message || ""
      ).trim()
    ) {
      return res.status(400).json({
        msg:
          "Nội dung lời khuyên không được để trống.",
      });
    }

    const advice =
      await Advice.create({
        doctorId: req.user.id,

        patientId,

        title:
          String(
            title ||
              "Lời khuyên từ bác sĩ"
          ).trim(),

        message:
          String(
            message
          ).trim(),
      });

    return res.status(201).json({
      msg:
        "Đã gửi lời khuyên.",

      advice,
    });
  } catch (err) {
    console.error("SEND ADVICE ERROR =");

    return res.status(500).json({
      msg:
        "Không thể gửi lời khuyên.",
    });
  }
};

module.exports = exports;
