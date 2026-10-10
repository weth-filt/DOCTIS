const router = require("express").Router();
const Reminder = require("../models/Reminder");
const User = require("../models/User");
const auth = require("../middlewares/auth");
const { sendMail } = require("../utils/mailer");

router.get("/my", auth, async (req, res) => {
  try {
    const reminders = await Reminder.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(reminders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/create", auth, async (req, res) => {
  try {
    const { title, description, time, source, activityType, dayLabel, scheduleDate } = req.body;
    if (!title || !time) return res.status(400).json({ msg: "Thiếu title hoặc time." });
    if (!/^\d{2}:\d{2}$/.test(String(time))) return res.status(400).json({ msg: "time phải có dạng HH:mm." });
    if (scheduleDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(scheduleDate))) return res.status(400).json({ msg: "scheduleDate phải có dạng YYYY-MM-DD." });

    const reminder = await Reminder.create({
      userId: req.user.id,
      title,
      description,
      time,
      enabled: true,
      source: source === "CARE_PLAN" ? "CARE_PLAN" : "USER",
      activityType: activityType || "HEALTH",
      dayLabel: dayLabel || "",
      scheduleDate: scheduleDate || null,
    });

    res.status(201).json(reminder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Create failed" });
  }
});

router.post("/doctor/create", auth, async (req, res) => {
  try {
    if (req.user?.role !== "doctor") return res.status(403).json({ msg: "Chỉ bác sĩ mới có quyền." });

    const { patientId, title, description, time, source, activityType, dayLabel } = req.body;
    if (!patientId || !title || !time) return res.status(400).json({ msg: "Thiếu patientId, title hoặc time." });

    const patient = await User.findOne({ _id: patientId, role: "user" }).select("username fullName email");
    if (!patient) return res.status(404).json({ msg: "Không tìm thấy bệnh nhân." });

    const reminder = await Reminder.create({
      userId: patient._id,
      title,
      description,
      time,
      enabled: true,
      source: source || "DOCTOR_CARE_PLAN",
      activityType: activityType || "HEALTH",
      dayLabel: dayLabel || "",
      createdByDoctorId: req.user.id,
    });

    if (patient.email) {
      await sendMail({
        to: patient.email,
        subject: `Nhắc nhở sức khỏe — ${title}`,
        text: `Xin chào ${patient.fullName || patient.username || "bạn"},\n\nBác sĩ đã bật nhắc nhở cho bạn:\n${title}\nThời gian: ${time}\n${description || ""}\n\nBạn có thể xem và quản lý nhắc nhở trong Dashboard.`,
      });
    }

    res.status(201).json({
      message: patient.email
        ? `Đã bật nhắc nhở và gửi email tới ${patient.email}.`
        : "Đã bật nhắc nhở, nhưng bệnh nhân chưa có email.",
      reminder,
    });
  } catch (err) {
    console.error("DOCTOR CREATE REMINDER ERROR =", err);
    res.status(500).json({ msg: err.message || "Không thể tạo nhắc nhở." });
  }
});

router.put("/update/:id", auth, async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!reminder) return res.status(404).json({ msg: "Không tìm thấy nhắc nhở." });
    res.json(reminder);
  } catch (err) {
    res.status(500).json({ msg: "Update failed" });
  }
});

router.delete("/delete/:id", auth, async (req, res) => {
  try {
    const result = await Reminder.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!result) return res.status(404).json({ msg: "Không tìm thấy nhắc nhở." });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Delete failed" });
  }
});

module.exports = router;
