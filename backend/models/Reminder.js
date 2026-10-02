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
    createdByDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Reminder", reminderSchema);
