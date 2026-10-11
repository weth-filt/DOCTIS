const mongoose = require("mongoose");

const careItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, default: "NOTE" },
    time: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
  },
  { _id: false }
);

const careDaySchema = new mongoose.Schema(
  {
    dayIndex: { type: Number, required: true },
    label: { type: String, required: true },
    status: { type: String, default: "draft" },
    items: { type: [careItemSchema], default: [] },
  },
  { _id: false }
);

const carePlanSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    source: { type: String, enum: ["AI", "DOCTOR"], default: "DOCTOR" },
    status: { type: String, enum: ["draft", "confirmed", "cancelled"], default: "draft", index: true },
    days: { type: [careDaySchema], default: [] },
    doctorNote: { type: String, default: "" },
    confirmedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CarePlan", carePlanSchema);
