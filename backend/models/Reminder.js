const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "Nhắc nhở sức khỏe" },
    time: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    lastSentDate: { type: String, default: null },
    source: { type: String, default: "USER" },
    activityType: { type: String, default: "HEALTH" },
    dayLabel: { type: String, default: "" },
    scheduleDate: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
    repeat: { type: String, enum: ["once", "daily"], default: "daily" },
    timeZone: { type: String, enum: ["Asia/Ho_Chi_Minh"], default: "Asia/Ho_Chi_Minh" },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", default: null, index: true },
    cancelledAt: { type: Date, default: null },
    sendLease: { type: String, default: null },
    sendLeaseUntil: { type: Date, default: null },
    createdByDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

reminderSchema.index({ enabled: 1, time: 1, scheduleDate: 1 });

module.exports = mongoose.model("Reminder", reminderSchema);
