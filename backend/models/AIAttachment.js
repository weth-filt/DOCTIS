const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "AIConversation", required: true },
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: "AIMessage", required: true },
  name: { type: String, required: true, maxlength: 120 },
  mimeType: { type: String, required: true, maxlength: 80 },
  size: { type: Number, required: true, min: 1, max: 2 * 1024 * 1024 },
  sha256: { type: String, required: true, maxlength: 64 },
  data: { type: Buffer, required: true, select: false },
}, { timestamps: true });
schema.index({ userId: 1, conversationId: 1, messageId: 1 });
module.exports = mongoose.model("AIAttachment", schema);
