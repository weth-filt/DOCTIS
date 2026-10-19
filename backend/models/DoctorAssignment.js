const mongoose = require("mongoose");

const doctorAssignmentSchema =
  new mongoose.Schema(
    {
      doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      status: {
        type: String,
        enum: ["active", "ended"],
        default: "active",
        index: true,
      },

      assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", default: null },
      supportRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "SupportRequest", default: null },

      assignedAt: {
        type: Date,
        default: Date.now,
      },

      endedAt: {
        type: Date,
        default: null,
      },

      endedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      reason: {
        type: String,
        default: "",
        trim: true,
      },
      endReason: { type: String, default: "", trim: true },
    },
    {
      timestamps: true,
    }
  );

doctorAssignmentSchema.index(
  {
    patientId: 1,
    status: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: "active",
    },
  }
);

module.exports =
  mongoose.model(
    "DoctorAssignment",
    doctorAssignmentSchema
  );
