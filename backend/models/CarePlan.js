const mongoose = require("mongoose");

const careItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, default: "NOTE" },
    time: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    done: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Prescription", default: null },
    medicineId: { type: String, default: "" },
    source: { type: String, default: "" },
  },
  { _id: false }
);

const careDaySchema = new mongoose.Schema(
  {
    dayIndex: { type: Number, required: true },
    label: { type: String, required: true },
    status: { type: String, default: "draft" },
    date: { type: String, default: "" },
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
    schemaVersion: { type: Number, default: 2 },
    startDate: { type: String, default: "" },
    endDate: { type: String, default: "" },
    timeZone: { type: String, default: "Asia/Ho_Chi_Minh" },
    revision: { type: Number, default: 0, min: 0 },
    isCurrent: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null },
    previousPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "CarePlan", default: null },
    inputSnapshot: {
      capturedAt: { type: Date, default: null },
      profile: {
        allergies: { type: String, default: "" },
        chronicDiseases: { type: String, default: "" },
        medicalHistory: { type: String, default: "" },
      },
      health: {
        recordId: { type: mongoose.Schema.Types.ObjectId, ref: "Health", default: null },
        recordedAt: { type: Date, default: null },
        height: Number, weight: Number, bmi: Number, glucose: Number,
        systolic: Number, diastolic: Number, heartRate: Number,
      },
      prescriptionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Prescription" }],
    },
  },
  { timestamps: true }
);

// Legacy plans without isCurrent remain readable. Only new current AI plans
// participate, so old histories need no destructive index migration.
carePlanSchema.index({ patientId: 1, source: 1, isCurrent: 1 }, {
  unique: true,
  partialFilterExpression: { source: "AI", isCurrent: true },
  name: "one_current_generated_care_plan",
});

module.exports = mongoose.model("CarePlan", carePlanSchema);
