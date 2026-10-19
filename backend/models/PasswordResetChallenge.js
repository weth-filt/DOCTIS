const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  codeHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
  sentAt: { type: Date, required: true },
  attempts: { type: Number, default: 0, min: 0 },
  consumedAt: { type: Date, default: null },
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model("PasswordResetChallenge", schema);
