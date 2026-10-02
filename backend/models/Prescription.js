const mongoose = require("mongoose");

const medicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    dosage: { type: String, default: "" },
    frequency: { type: String, default: "1 lần/ngày" },
    times: { type: [String], default: ["07:00"] },
    mealRelation: {
      type: String,
      enum: ["", "BEFORE_MEAL", "AFTER_MEAL"],
      default: "",
    },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    note: { type: String, default: "" },
    medicines: { type: [medicineSchema], default: [] },
    status: {
      type: String,
      enum: ["draft", "confirmed", "cancelled"],
      default: "draft",
      index: true,
    },
    confirmedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Prescription", prescriptionSchema);
