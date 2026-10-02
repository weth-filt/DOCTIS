const mongoose = require("mongoose");

const healthSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    height: {
      type: Number,
      required: true
    },

    weight: {
      type: Number,
      required: true
    },

    // BMI được tính từ height + weight
    bmi: {
      type: Number,
      required: true
    },

    glucose: {
      type: Number
    },

    systolic: {
      type: Number
    },

    diastolic: {
      type: Number
    },

    heartRate: {
      type: Number
    },

    prediction: {
      type: String
    },

    risk: {
      type: String
    },

    recommendation: {
      type: String
    },

    createdAt: {
      type: Date,
      default: Date.now
    }
  }
);

module.exports = mongoose.model(
  "Health",
  healthSchema
);