const User =
  require("../models/User");

const bcrypt =
  require("bcryptjs");

const jwt =
  require("jsonwebtoken");

const passwordReset = require("../services/passwordReset");

const createToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET chưa được cấu hình trong .env"
    );
  }

  return jwt.sign(
    {
      id: user._id,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
};

// =====================================================
// USER RESPONSE
// =====================================================

const userResponse = (user) => {
  return {
    id: user._id,
    _id: user._id,

    cccd: user.cccd || "",
    username: user.username || "",
    email: user.email || "",

    role:
      user.role || "user",

    fullName:
      user.fullName || "",

    phone:
      user.phone || "",

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
    hospitalId: user.hospitalId || null,
    wardId: user.wardId || null,
    city: user.city || "",
    addressDetail: user.addressDetail || user.address || ""
  };
};

// =====================================================
// REGISTER
// =====================================================

exports.register = (req, res) => require("./registrationController").register(req, res);

// =====================================================
// LOGIN
// =====================================================

exports.login = async (
  req,
  res
) => {
  try {
    const email =
      String(
        req.body.email || ""
      )
        .trim()
        .toLowerCase();

    const password =
      req.body.password;

    if (
      !email ||
      !password
    ) {
      return res.status(400).json({
        msg:
          "Vui lòng nhập email và mật khẩu"
      });
    }

    const user =
      await User.findOne({
        email
      });

    if (!user) {
      return res.status(400).json({
        msg:
          "Email không tồn tại"
      });
    }

    const match =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!match) {
      return res.status(400).json({
        msg:
          "Sai mật khẩu"
      });
    }

    const token =
      createToken(user);

    return res.json({
      token,

      role:
        user.role,

      username:
        user.username,

      email:
        user.email,

      user:
        userResponse(user)
    });
  } catch (err) {
    console.error("LOGIN ERROR =");

    return res.status(500).json({
      msg:
        "Đăng nhập thất bại"
    });
  }
};

// =====================================================
// FORGOT PASSWORD
// =====================================================

exports.forgotPassword = passwordReset.forgotPassword;
exports.verifyOTP = passwordReset.verifyOTP;
exports.resetPassword = passwordReset.resetPassword;
