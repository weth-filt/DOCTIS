const router = require("express").Router();
const auth = require("../middlewares/auth");
const messageController = require("../controllers/messageController");

// Danh sách để hiển thị (kèm tin nhắn cuối + số chưa đọc)
router.get("/doctors", auth, messageController.getDoctorsForPatient);
router.get("/patients", auth, messageController.getPatientsForDoctor);

// Lịch sử tin nhắn của 1 cuộc hội thoại cụ thể
router.get("/doctor/:doctorId", auth, messageController.getMessagesWithDoctor);
router.get("/patient/:patientId", auth, messageController.getMessagesWithPatient);

// Gửi tin nhắn (dùng chung)
router.post("/send", auth, messageController.sendMessage);

module.exports = router;