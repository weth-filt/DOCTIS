const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null },
    lastSenderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    unreadForDoctor: { type: Number, default: 0 },
    unreadForPatient: { type: Number, default: 0 },
  },
  { timestamps: true }
);

conversationSchema.index({ doctorId: 1, patientId: 1 }, { unique: true });

module.exports = mongoose.model("Conversation", conversationSchema);