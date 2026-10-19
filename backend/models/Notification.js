const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  recipientRole: { type: String, enum: ["admin", "user", "doctor"], required: true },
  eventKey: { type: String, required: true, unique: true, maxlength: 200 },
  type: { type: String, required: true, maxlength: 80 },
  title: { type: String, required: true, maxlength: 180 },
  message: { type: String, default: "", maxlength: 700 },
  entityType: { type: String, default: "", maxlength: 60 },
  entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });
schema.index({ recipientRole: 1, recipientId: 1, createdAt: -1 });
module.exports = mongoose.model("Notification", schema);
