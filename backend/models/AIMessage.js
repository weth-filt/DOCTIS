const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "AIConversation", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, default: "", maxlength: 20000 },
  status: { type: String, enum: ["pending", "complete", "failed"], default: "complete" },
  requestId: { type: String, required: true, maxlength: 100 },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "AIMessage", default: null },
  attachmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "AIAttachment" }],
  provider: { type: String, default: "", maxlength: 40 },
  errorCode: { type: String, default: "", maxlength: 80 },
  errorMessage: { type: String, default: "", maxlength: 500 },
}, { timestamps: true });
schema.index({ userId: 1, conversationId: 1, _id: -1 });
schema.index({ userId: 1, conversationId: 1, requestId: 1, role: 1 }, { unique: true });
module.exports = mongoose.model("AIMessage", schema);
