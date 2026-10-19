const axios = require("axios");
const Health = require("../models/Health");
const Advice = require("../models/Advice");
const getRisk = require("../utils/riskAssessment");

// =====================================================
// AI SERVICE URL
// =====================================================
// Nếu có .env:
// AI_SERVICE_URL=http://127.0.0.1:8000
//
// Nếu không có .env thì mặc định dùng port 8000.
const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

// =====================================================
// THÊM DỮ LIỆU SỨC KHỎE
// =====================================================
exports.addHealth = async (req, res) => {
  try {
    const {
      height,
      weight,
      glucose,
      systolic,
      diastolic,
      heartRate
    } = req.body;

    // =================================================
    // KIỂM TRA USER
    // =================================================
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        msg: "Không xác định được người dùng"
      });
    }

    // =================================================
    // KIỂM TRA CHIỀU CAO + CÂN NẶNG
    // =================================================
    if (
      height === undefined ||
      height === null ||
      height === "" ||
      weight === undefined ||
      weight === null ||
      weight === ""
    ) {
      return res.status(400).json({
        msg: "Vui lòng nhập chiều cao và cân nặng"
      });
    }

    // =================================================
    // CHUYỂN KIỂU DỮ LIỆU
    // =================================================
    const heightNumber = Number(height);
    const weightNumber = Number(weight);

    const glucoseNumber =
      glucose === undefined ||
      glucose === null ||
      glucose === ""
        ? null
        : Number(glucose);

    const systolicNumber =
      systolic === undefined ||
      systolic === null ||
      systolic === ""
        ? null
        : Number(systolic);

    const diastolicNumber =
      diastolic === undefined ||
      diastolic === null ||
      diastolic === ""
        ? null
        : Number(diastolic);

    const heartRateNumber =
      heartRate === undefined ||
      heartRate === null ||
      heartRate === ""
        ? null
        : Number(heartRate);

    // =================================================
    // KIỂM TRA SỐ
    // =================================================
    if (
      !Number.isFinite(heightNumber) ||
      !Number.isFinite(weightNumber)
    ) {
      return res.status(400).json({
        msg: "Chiều cao và cân nặng phải là số hợp lệ"
      });
    }

    if (glucoseNumber !== null && !Number.isFinite(glucoseNumber)) {
      return res.status(400).json({
        msg: "Glucose phải là số hợp lệ"
      });
    }

    if (systolicNumber !== null && !Number.isFinite(systolicNumber)) {
      return res.status(400).json({
        msg: "Huyết áp tâm thu không hợp lệ"
      });
    }

    if (diastolicNumber !== null && !Number.isFinite(diastolicNumber)) {
      return res.status(400).json({
        msg: "Huyết áp tâm trương không hợp lệ"
      });
    }

    if (heartRateNumber !== null && !Number.isFinite(heartRateNumber)) {
      return res.status(400).json({
        msg: "Nhịp tim phải là số hợp lệ"
      });
    }

    // =================================================
    // KIỂM TRA GIÁ TRỊ
    // =================================================
    if (
      heightNumber <= 0 ||
      weightNumber <= 0
    ) {
      return res.status(400).json({
        msg: "Chiều cao và cân nặng phải lớn hơn 0"
      });
    }

    // =================================================
    // TÍNH BMI
    // =================================================
    const heightMeter = heightNumber / 100;

    const bmi =
      weightNumber /
      (heightMeter * heightMeter);

    const roundedBMI =
      Number(bmi.toFixed(2));

    // =================================================
    // GIÁ TRỊ AI MẶC ĐỊNH
    // =================================================
    let aiPrediction = "Không xác định";

    let aiRisk = getRisk({
      glucose: glucoseNumber,
      bmi: roundedBMI,
      systolic: systolicNumber,
      diastolic: diastolicNumber,
      heartRate: heartRateNumber,
    });

    let aiRecommendation =
      "Dữ liệu đã được lưu. " +
      "Hiện chưa thể phân tích bằng AI.";

    // Missing glucose is not zero: the ML model requires both real features.
    let predictionStatus = glucoseNumber === null ? "insufficient_data" : "unavailable";
    if (glucoseNumber !== null && glucoseNumber > 0) {
      try {
        const ai = await axios.post(
          `${AI_SERVICE_URL}/predict`,
          { glucose: glucoseNumber, bmi: roundedBMI },
          { timeout: 5000 }
        );
        if (ai.data?.prediction !== undefined && !ai.data?.error) {
          aiPrediction = String(ai.data.prediction);
          aiRecommendation = ai.data.recommendation || "Không có khuyến nghị";
          predictionStatus = "available";
        }
      } catch (error) {
        // Do not log medical payloads, service URLs or connection strings.
        console.warn("Prediction service unavailable; health record will retain its monitoring alert.");
      }
    }

    // =================================================
    // LƯU DATABASE
    // =================================================
    const health = await Health.create({
      userId: req.user.id,

      height: heightNumber,

      weight: weightNumber,

      bmi: roundedBMI,

      glucose: glucoseNumber,

      systolic: systolicNumber,

      diastolic: diastolicNumber,

      heartRate: heartRateNumber,

      prediction: aiPrediction,
      predictionStatus,
      predictionSource: predictionStatus === "available" ? "python-model" : null,
      riskSource: "monitoring-rule",
      monitoringRuleVersion: getRisk.ruleVersion,

      risk: aiRisk,

      recommendation: aiRecommendation
    });

    // =================================================
    // TRẢ KẾT QUẢ
    // =================================================
    return res.status(201).json(health);
  }

  catch (err) {
    console.error("Health operation failed.");

    return res.status(500).json({
      msg:
        err.message ||
        "Không thể lưu dữ liệu sức khỏe"
    });
  }
};

// =====================================================
// LẤY LỊCH SỬ SỨC KHỎE
// =====================================================
exports.getHistory = async (
  req,
  res
) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        msg: "Không xác định được người dùng"
      });
    }

    const data =
      await Health.find({
        userId: req.user.id
      }).sort({
        createdAt: -1
      });

    return res.json(data);
  }

  catch (err) {
    console.error("Health operation failed.");

    return res.status(500).json({
      msg: err.message
    });
  }
};

// =====================================================
// LẤY DỮ LIỆU MỚI NHẤT
// =====================================================
exports.getLatest = async (
  req,
  res
) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        msg: "Không xác định được người dùng"
      });
    }

    const latest =
      await Health.findOne({
        userId: req.user.id
      }).sort({
        createdAt: -1
      });

    return res.json(
      latest || null
    );
  }

  catch (err) {
    console.error("Health operation failed.");

    return res.status(500).json({
      msg: err.message
    });
  }
};

// =====================================================
// LẤY LỜI KHUYÊN TỪ BÁC SĨ
// =====================================================
exports.getAdvices = async (
  req,
  res
) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        msg: "Không xác định được người dùng"
      });
    }


    const advices =
      await Advice.find({
        patientId: req.user.id
      })
        .populate(
          "doctorId",
          "username"
        )
        .sort({
          createdAt: -1
        });


    return res.json(advices);
  }

  catch (err) {
    console.error("Health operation failed.");

    return res.status(500).json({
      message:
        "Server error"
    });
  }
};
