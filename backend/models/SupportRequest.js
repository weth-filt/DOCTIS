const mongoose = require("mongoose");
const historySchema = new mongoose.Schema({
  action: { type: String, required: true },
  fromStatus: String, toStatus: String,
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", default: null },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reason: { type: String, default: "", maxlength: 1000 },
  at: { type: Date, default: Date.now },
  revision: Number,
}, { _id: false });
const schema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  wardId: { type: mongoose.Schema.Types.ObjectId, ref: "Ward", required: true },
  address: { type: String, required: true, maxlength: 500 },
  city: { type: String, enum: ["Đà Nẵng"], default: "Đà Nẵng" },
  status: { type: String, enum: ["waiting_hospital", "hospital_selected", "accepted", "assigned"], default: "waiting_hospital" },
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", default: null },
  assignedDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  acceptedAt: { type: Date, default: null },
  revision: { type: Number, default: 0 },
  history: { type: [historySchema], default: [] },
  registrationKey: { type: String, default: undefined },
  registrationFingerprint: { type: String, default: undefined, select: false },
}, { timestamps: true });
schema.index({ registrationKey: 1 }, { unique: true, sparse: true });
schema.index({ status: 1, wardId: 1, createdAt: -1 });
module.exports = mongoose.model("SupportRequest", schema);
