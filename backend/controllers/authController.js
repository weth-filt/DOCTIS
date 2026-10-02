const User =
  require("../models/User");

const bcrypt =
  require("bcryptjs");

const jwt =
  require("jsonwebtoken");

const nodemailer =
  require("nodemailer");

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
      user.doctorId || null
  };
};

// =====================================================
// REGISTER
// =====================================================

exports.register = async (
  req,
  res
) => {
  try {
    const {
      cccd,
      username,
      email,
      password,
      confirmPassword
    } = req.body;

    const normalizedCccd =
      String(cccd || "")
        .trim();

    const normalizedUsername =
      String(username || "")
        .trim();

    const normalizedEmail =
      String(email || "")
        .trim()
        .toLowerCase();

    if (
      !normalizedCccd ||
      !normalizedUsername ||
      !normalizedEmail ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({
        msg:
          "Vui lòng nhập đầy đủ thông tin"
      });
    }

    if (
      password !==
      confirmPassword
    ) {
      return res.status(400).json({
        msg:
          "Mật khẩu không khớp"
      });
    }

    const exist =
      await User.findOne({
        $or: [
          {
            email:
              normalizedEmail
          },
          {
            username:
              normalizedUsername
          },
          {
            cccd:
              normalizedCccd
          }
        ]
      });

    if (exist) {
      return res.status(400).json({
        msg:
          "Email, username hoặc CCCD đã tồn tại"
      });
    }

    const hash =
      await bcrypt.hash(
        password,
        10
      );

    const user =
      await User.create({
        cccd:
          normalizedCccd,

        username:
          normalizedUsername,

        email:
          normalizedEmail,

        password:
          hash,

        fullName:
          normalizedUsername
      });

    return res.status(201).json({
      msg:
        "Đăng ký thành công",

      user:
        userResponse(user)
    });
  } catch (err) {
    console.error(
      "REGISTER ERROR =",
      err
    );

    return res.status(500).json({
      msg:
        err.message ||
        "Đăng ký thất bại"
    });
  }
};

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
    console.error(
      "LOGIN ERROR =",
      err
    );

    return res.status(500).json({
      msg:
        err.message ||
        "Đăng nhập thất bại"
    });
  }
};

// =====================================================
// FORGOT PASSWORD
// =====================================================

exports.forgotPassword =
  async (req, res) => {
    try {
      const email =
        String(
          req.body.email || ""
        )
          .trim()
          .toLowerCase();

      if (!email) {
        return res.status(400).json({
          msg:
            "Vui lòng nhập email"
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

      const otp =
        String(
          Math.floor(
            100000 +
              Math.random() *
                900000
          )
        );

      user.otp =
        otp;

      user.otpExpire =
        new Date(
          Date.now() +
            5 * 60 * 1000
        );

      await user.save();

      if (
        !process.env.EMAIL_USER ||
        !process.env.EMAIL_PASS
      ) {
        return res.json({
          msg:
            "Đã tạo OTP. Hãy cấu hình EMAIL_USER và EMAIL_PASS để gửi email."
        });
      }

      const transporter =
        nodemailer.createTransport({
          service: "gmail",

          auth: {
            user:
              process.env.EMAIL_USER,

            pass:
              process.env.EMAIL_PASS
          }
        });

      await transporter.sendMail({
        from:
          process.env.EMAIL_USER,

        to:
          email,

        subject:
          "Mã OTP đổi mật khẩu",

        html: `
          <div style="font-family:Arial,sans-serif">
            <h2>DOCTIS</h2>
            <h3>Mã OTP của bạn:</h3>
            <h1>${otp}</h1>
            <p>OTP có hiệu lực trong 5 phút.</p>
          </div>
        `
      });

      return res.json({
        msg:
          "Đã gửi OTP"
      });
    } catch (err) {
      console.error(
        "FORGOT PASSWORD ERROR =",
        err
      );

      return res.status(500).json({
        msg:
          err.message ||
          "Không thể gửi OTP"
      });
    }
  };

// =====================================================
// VERIFY OTP
// =====================================================

exports.verifyOTP =
  async (req, res) => {
    try {
      const email =
        String(
          req.body.email || ""
        )
          .trim()
          .toLowerCase();

      const otp =
        String(
          req.body.otp || ""
        ).trim();

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

      if (
        !user.otp ||
        user.otp !== otp
      ) {
        return res.status(400).json({
          msg:
            "OTP không đúng"
        });
      }

      if (
        user.otpExpire &&
        user.otpExpire.getTime() <
          Date.now()
      ) {
        user.otp = "";
        user.otpExpire = null;

        await user.save();

        return res.status(400).json({
          msg:
            "OTP đã hết hạn"
        });
      }

      return res.json({
        msg:
          "OTP chính xác"
      });
    } catch (err) {
      console.error(
        "VERIFY OTP ERROR =",
        err
      );

      return res.status(500).json({
        msg:
          err.message ||
          "Không thể xác thực OTP"
      });
    }
  };

// =====================================================
// RESET PASSWORD
// =====================================================

exports.resetPassword =
  async (req, res) => {
    try {
      const email =
        String(
          req.body.email || ""
        )
          .trim()
          .toLowerCase();

      const otp =
        String(
          req.body.otp || ""
        ).trim();

      const {
        password,
        confirmPassword
      } = req.body;

      if (
        !email ||
        !otp ||
        !password ||
        !confirmPassword
      ) {
        return res.status(400).json({
          msg:
            "Vui lòng nhập đầy đủ thông tin"
        });
      }

      if (
        password !==
        confirmPassword
      ) {
        return res.status(400).json({
          msg:
            "Mật khẩu không khớp"
        });
      }

      const user =
        await User.findOne({
          email
        });

      if (!user) {
        return res.status(400).json({
          msg:
            "User không tồn tại"
        });
      }

      if (
        !user.otp ||
        user.otp !== otp
      ) {
        return res.status(400).json({
          msg:
            "OTP không đúng"
        });
      }

      if (
        user.otpExpire &&
        user.otpExpire.getTime() <
          Date.now()
      ) {
        return res.status(400).json({
          msg:
            "OTP đã hết hạn"
        });
      }

      user.password =
        await bcrypt.hash(
          password,
          10
        );

      user.otp = "";
      user.otpExpire = null;

      await user.save();

      return res.json({
        msg:
          "Đổi mật khẩu thành công"
      });
    } catch (err) {
      console.error(
        "RESET PASSWORD ERROR =",
        err
      );

      return res.status(500).json({
        msg:
          err.message ||
          "Không thể đổi mật khẩu"
      });
    }
  };
