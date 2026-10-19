const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  address: { type: String, required: true, trim: true, maxlength: 500 },
  wardId: { type: mongoose.Schema.Types.ObjectId, ref: "Ward", default: null, required: function () { return this.verified; } },
  city: { type: String, enum: ["Đà Nẵng"], default: "Đà Nẵng" },
  phone: { type: String, default: "", required: function () { return this.verified; }, trim: true, maxlength: 100 },
  acceptingPatients: { type: Boolean, default: false },
  sourceUrl: { type: String, required: true, maxlength: 1000 },
  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  active: { type: Boolean, default: true },
  revision: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ active: 1, verified: 1, acceptingPatients: 1, wardId: 1 });
module.exports = mongoose.model("Hospital", schema);
