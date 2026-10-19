const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, maxlength: 40 },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  city: { type: String, enum: ["Đà Nẵng"], default: "Đà Nẵng", required: true },
  sourceUrl: { type: String, required: true, maxlength: 1000 },
  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  active: { type: Boolean, default: true },
  revision: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ city: 1, active: 1, verified: 1, name: 1 });
module.exports = mongoose.model("Ward", schema);
