const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, default: "Cuộc trò chuyện mới", maxlength: 50 },
  lastMessageAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
  activeRequestId: { type: String, default: null },
  activeRequestAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ userId: 1, deletedAt: 1, updatedAt: -1, _id: -1 });
module.exports = mongoose.model("AIConversation", schema);
