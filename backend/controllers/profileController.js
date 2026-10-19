const mongoose = require("mongoose");
const User = require("../models/User");

// =====================================================
// CÁC FIELD ĐƯỢC PHÉP CẬP NHẬT
// =====================================================

const PROFILE_FIELDS = [
  "fullName",
  "email",
  "phone",
  "fatherPhone",
  "motherPhone",
  "dateOfBirth",
  "gender",
  "cccd",
  "bloodType",
  "allergies",
  "medicalHistory",
  "chronicDiseases",
  "currentMedications",
  "emergencyContactName",
  "emergencyContactPhone",
  "emergencyContactRelation",
  "avatar"
];

// =====================================================
// HÀM LẤY USER ID TỪ JWT
// =====================================================

const getUserId = (req) => {
  if (!req.user || !req.user.id) {
    return null;
  }

  return req.user.id;
};

// =====================================================
// GET PROFILE
// GET /api/profile
// =====================================================

exports.getProfile = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        msg: "Không xác định được người dùng"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        msg: "User ID không hợp lệ"
      });
    }

    const user = await User.findById(userId)
      .select("-password -otp -otpExpire -resetToken");

    if (!user) {
      return res.status(404).json({
        msg: "Không tìm thấy người dùng"
      });
    }

    return res.json({
      id: user._id,
      _id: user._id,

      cccd: user.cccd || "",
      username: user.username || "",
      email: user.email || "",
      role: user.role || "user",

      fullName: user.fullName || "",
      phone: user.phone || "",

      fatherPhone: user.fatherPhone || "",
      motherPhone: user.motherPhone || "",

      dateOfBirth: user.dateOfBirth || "",
      gender: user.gender || "",

      address: user.address || "",
      province: user.province || "",
      district: user.district || "",
      ward: user.ward || "",
      wardId: user.wardId || null,
      city: user.city || "",

      bloodType: user.bloodType || "",
      allergies: user.allergies || "",
      medicalHistory: user.medicalHistory || "",
      chronicDiseases: user.chronicDiseases || "",
      currentMedications: user.currentMedications || "",

      emergencyContactName:
        user.emergencyContactName || "",

      emergencyContactPhone:
        user.emergencyContactPhone || "",

      emergencyContactRelation:
        user.emergencyContactRelation || "",

      avatar: user.avatar || "",

      doctorId: user.doctorId || null,

      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (err) {
    console.error("GET PROFILE ERROR =");

    return res.status(500).json({
      msg: "Không thể lấy hồ sơ"
    });
  }
};

// =====================================================
// UPDATE PROFILE
// PUT /api/profile
// =====================================================

exports.updateProfile = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        msg: "Không xác định được người dùng"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        msg: "User ID không hợp lệ"
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        msg: "Không tìm thấy người dùng"
      });
    }

    // ===================================================
    // LẤY DỮ LIỆU
    // ===================================================

    const data = {};

    // Service location updates must also update the intake snapshot atomically.
    // Old clients may send unchanged legacy strings; preserve that compatibility.
    const locationKeys = ["address", "province", "district", "ward", "wardId", "city"];
    if (locationKeys.some(key => Object.prototype.hasOwnProperty.call(req.body, key) && String(req.body[key] ?? "").trim() !== String(user[key] ?? "").trim())) {
      return res.status(409).json({ code: "USE_SERVICE_ADDRESS", msg: "Vui lòng cập nhật địa chỉ và phường tại mục Bệnh viện và bác sĩ phụ trách." });
    }

    PROFILE_FIELDS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        data[field] = req.body[field];
      }
    });

    // ===================================================
    // CHUẨN HÓA STRING
    // ===================================================

    Object.keys(data).forEach((key) => {
      if (typeof data[key] === "string") {
        data[key] = data[key].trim();
      }
    });

    // ===================================================
    // VALIDATE HỌ TÊN
    // ===================================================

    if (
      data.fullName !== undefined &&
      !data.fullName
    ) {
      return res.status(400).json({
        msg: "Họ và tên không được để trống"
      });
    }

    // ===================================================
    // VALIDATE EMAIL
    // ===================================================

    if (data.email !== undefined) {
      data.email = data.email.toLowerCase();

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(data.email)) {
        return res.status(400).json({
          msg: "Email không hợp lệ"
        });
      }

      const existingEmail =
        await User.findOne({
          email: data.email,
          _id: {
            $ne: userId
          }
        });

      if (existingEmail) {
        return res.status(400).json({
          msg: "Email đã được sử dụng bởi tài khoản khác"
        });
      }
    }

    // ===================================================
    // VALIDATE CCCD
    // ===================================================

    if (data.cccd !== undefined) {
      if (!data.cccd) {
        return res.status(400).json({
          msg: "CCCD không được để trống"
        });
      }

      const existingCccd =
        await User.findOne({
          cccd: data.cccd,
          _id: {
            $ne: userId
          }
        });

      if (existingCccd) {
        return res.status(400).json({
          msg: "CCCD đã được sử dụng bởi tài khoản khác"
        });
      }
    }

    // ===================================================
    // VALIDATE AVATAR
    // ===================================================

    if (data.avatar !== undefined) {
      if (
        data.avatar !== "" &&
        !data.avatar.startsWith("data:image/")
      ) {
        return res.status(400).json({
          msg: "Ảnh không đúng định dạng"
        });
      }

      // Base64 ước lượng dung lượng.
      // Giới hạn khoảng 8MB sau decode.
      if (data.avatar.startsWith("data:image/")) {
        const base64 = data.avatar.split(",")[1] || "";

        const estimatedBytes =
          Math.ceil(
            (base64.length * 3) / 4
          );

        if (estimatedBytes > 8 * 1024 * 1024) {
          return res.status(400).json({
            msg: "Ảnh không được vượt quá 8MB"
          });
        }
      }
    }

    // ===================================================
    // CẬP NHẬT
    // ===================================================

    Object.keys(data).forEach((key) => {
      user[key] = data[key];
    });

    await user.save();

    // ===================================================
    // RESPONSE
    // ===================================================

    return res.json({
      msg: "Cập nhật hồ sơ thành công",

      profile: {
        id: user._id,
        _id: user._id,

        cccd: user.cccd || "",
        username: user.username || "",
        email: user.email || "",
        role: user.role || "user",

        fullName: user.fullName || "",
        phone: user.phone || "",

        fatherPhone:
          user.fatherPhone || "",

        motherPhone:
          user.motherPhone || "",

        dateOfBirth:
          user.dateOfBirth || "",

        gender:
          user.gender || "",

        address:
          user.address || "",

        province:
          user.province || "",

        district:
          user.district || "",

        ward:
          user.ward || "",

        bloodType:
          user.bloodType || "",

        allergies:
          user.allergies || "",

        medicalHistory:
          user.medicalHistory || "",

        chronicDiseases:
          user.chronicDiseases || "",

        currentMedications:
          user.currentMedications || "",

        emergencyContactName:
          user.emergencyContactName || "",

        emergencyContactPhone:
          user.emergencyContactPhone || "",

        emergencyContactRelation:
          user.emergencyContactRelation || "",

        avatar:
          user.avatar || "",

        doctorId:
          user.doctorId || null,

        createdAt:
          user.createdAt,

        updatedAt:
          user.updatedAt
      }
    });
  } catch (err) {
    console.error("UPDATE PROFILE ERROR =");

    // Duplicate key
    if (err.code === 11000) {
      const duplicateField =
        Object.keys(err.keyPattern || {})[0];

      let message =
        "Thông tin đã tồn tại";

      if (duplicateField === "email") {
        message = "Email đã tồn tại";
      }

      if (duplicateField === "cccd") {
        message = "CCCD đã tồn tại";
      }

      if (duplicateField === "username") {
        message = "Username đã tồn tại";
      }

      return res.status(400).json({
        msg: message
      });
    }

    return res.status(500).json({
      msg:
        "Cập nhật hồ sơ thất bại"
    });
  }
};
