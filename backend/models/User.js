const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    cccd: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },

    password: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["user", "doctor", "admin"],
      default: "user"
    },

    fullName: {
      type: String,
      default: "",
      trim: true
    },

    phone: {
      type: String,
      default: "",
      trim: true
    },

    dateOfBirth: {
      type: String,
      default: ""
    },

    gender: {
      type: String,
      default: ""
    },

    fatherPhone: {
      type: String,
      default: ""
    },

    motherPhone: {
      type: String,
      default: ""
    },

    address: {
      type: String,
      default: ""
    },

    province: {
      type: String,
      default: ""
    },

    district: {
      type: String,
      default: ""
    },

    ward: {
      type: String,
      default: ""
    },

    bloodType: {
      type: String,
      default: ""
    },

    allergies: {
      type: String,
      default: ""
    },

    medicalHistory: {
      type: String,
      default: ""
    },

    chronicDiseases: {
      type: String,
      default: ""
    },

    currentMedications: {
      type: String,
      default: ""
    },

    emergencyContactName: {
      type: String,
      default: ""
    },

    emergencyContactPhone: {
      type: String,
      default: ""
    },

    emergencyContactRelation: {
      type: String,
      default: ""
    },

    avatar: {
      type: String,
      default: ""
    },

    otp: {
      type: String,
      default: ""
    },

    otpExpire: {
      type: Date,
      default: null
    },

    resetToken: {
      type: String,
      default: ""
    },

    isVerified: {
      type: Boolean,
      default: false
    },

    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);