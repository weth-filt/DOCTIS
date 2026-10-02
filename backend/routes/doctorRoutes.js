const router =
  require("express").Router();

const auth =
  require("../middlewares/auth");

const doctor =
  require("../controllers/doctorController");

// Danh sách bệnh nhân
router.get(
  "/patients",
  auth,
  doctor.getPatients
);

// Lịch sử sức khỏe bệnh nhân
router.get(
  "/patient-health/:id",
  auth,
  doctor.getPatientHealth
);

// Phân tích nguy cơ
router.get(
  "/ai-risk/:id",
  auth,
  doctor.getAIRisk
);

// Danh sách bác sĩ
// Patient cũng có thể cần API này
router.get(
  "/doctors",
  auth,
  doctor.getDoctors
);

// Gửi lời khuyên
router.post(
  "/send-advice",
  auth,
  doctor.sendAdvice
);

module.exports = router;