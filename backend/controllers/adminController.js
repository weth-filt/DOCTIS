const mongoose = require("mongoose");

const User = require("../models/User");
const DoctorAssignment = require("../models/DoctorAssignment");

const adminOnly = (req, res) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({
      msg: "Chỉ admin mới có quyền quản trị.",
    });

    return false;
  }

  return true;
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(
    String(id || "")
  );
};

exports.getUsers = async (req, res) => {
  try {
    if (!adminOnly(req, res)) {
      return;
    }

    const users =
      await User.find()
        .select("-password")
        .sort({
          createdAt: -1,
        })
        .lean();

    return res.json(users);
  } catch (err) {
    console.error(
      "GET USERS ERROR =",
      err
    );

    return res.status(500).json({
      msg:
        err.message ||
        "Không thể tải danh sách người dùng.",
    });
  }
};

exports.changeRole = async (req, res) => {
  try {
    if (!adminOnly(req, res)) {
      return;
    }

    const { role } = req.body || {};

    const allowedRoles = [
      "user",
      "doctor",
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        msg:
          "Role không hợp lệ. Chỉ được chọn user hoặc doctor.",
      });
    }

    if (
      !isValidObjectId(req.params.id)
    ) {
      return res.status(400).json({
        msg: "ID tài khoản không hợp lệ.",
      });
    }

    const user =
      await User.findById(
        req.params.id
      );

    if (!user) {
      return res.status(404).json({
        msg:
          "Tài khoản không tồn tại.",
      });
    }

    if (user.role === "admin") {
      return res.status(400).json({
        msg:
          "Không thể thay đổi quyền của admin.",
      });
    }

    const oldRole = user.role;

    user.role = role;

    await user.save();

    if (
      oldRole === "doctor" &&
      role !== "doctor"
    ) {
      await DoctorAssignment.updateMany(
        {
          doctorId: user._id,
          status: "active",
        },
        {
          $set: {
            status: "ended",
            endedAt: new Date(),
            endedBy: req.user.id,
            reason:
              "Doctor đã bị thu quyền bởi admin.",
          },
        }
      );
    }

    return res.json({
      msg: "Đổi quyền thành công.",
      role: user.role,

      user: {
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(
      "CHANGE ROLE ERROR =",
      err
    );

    return res.status(500).json({
      msg:
        err.message ||
        "Không thể đổi quyền.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE DOCTOR PROFILE
|--------------------------------------------------------------------------
|
| PUT /api/admin/doctors/:id
|
| Admin được sửa:
| - fullName
| - username
| - email
| - phone
| - avatar
|
*/

exports.updateDoctorProfile =
  async (req, res) => {
    try {
      if (!adminOnly(req, res)) {
        return;
      }

      const doctorId =
        req.params.id;

      if (
        !isValidObjectId(doctorId)
      ) {
        return res.status(400).json({
          msg:
            "ID bác sĩ không hợp lệ.",
        });
      }

      const doctor =
        await User.findOne({
          _id: doctorId,
          role: "doctor",
        });

      if (!doctor) {
        return res.status(404).json({
          msg:
            "Không tìm thấy tài khoản bác sĩ.",
        });
      }

      const {
        fullName,
        username,
        email,
        phone,
        avatar,
      } = req.body || {};

      const cleanFullName =
        String(
          fullName ??
            doctor.fullName ??
            ""
        ).trim();

      const cleanUsername =
        String(
          username ??
            doctor.username ??
            ""
        ).trim();

      const cleanEmail =
        String(
          email ??
            doctor.email ??
            ""
        )
          .trim()
          .toLowerCase();

      const cleanPhone =
        String(
          phone ??
            doctor.phone ??
            ""
        ).trim();

      /*
      |--------------------------------------------------------------------------
      | VALIDATE
      |--------------------------------------------------------------------------
      */

      if (!cleanFullName) {
        return res.status(400).json({
          msg:
            "Họ và tên bác sĩ không được để trống.",
        });
      }

      if (!cleanUsername) {
        return res.status(400).json({
          msg:
            "Username không được để trống.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | USERNAME UNIQUE
      |--------------------------------------------------------------------------
      */

      const usernameExists =
        await User.findOne({
          username: cleanUsername,
          _id: {
            $ne: doctor._id,
          },
        })
          .select("_id")
          .lean();

      if (usernameExists) {
        return res.status(409).json({
          msg:
            "Username này đã được sử dụng.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | EMAIL UNIQUE
      |--------------------------------------------------------------------------
      */

      if (cleanEmail) {
        const emailExists =
          await User.findOne({
            email: cleanEmail,
            _id: {
              $ne: doctor._id,
            },
          })
            .select("_id")
            .lean();

        if (emailExists) {
          return res.status(409).json({
            msg:
              "Email này đã được sử dụng.",
          });
        }
      }

      /*
      |--------------------------------------------------------------------------
      | UPDATE
      |--------------------------------------------------------------------------
      */

      doctor.fullName =
        cleanFullName;

      doctor.username =
        cleanUsername;

      doctor.email =
        cleanEmail;

      doctor.phone =
        cleanPhone;

      if (
        avatar !== undefined
      ) {
        doctor.avatar =
          String(
            avatar || ""
          ).trim();
      }

      await doctor.save();

      /*
      |--------------------------------------------------------------------------
      | RETURN CLEAN DATA
      |--------------------------------------------------------------------------
      */

      const result =
        await User.findById(
          doctor._id
        )
          .select(
            "_id username fullName email phone avatar role"
          )
          .lean();

      return res.json({
        msg:
          "Đã cập nhật thông tin bác sĩ.",

        doctor: {
          ...result,

          displayName:
            `Doctor ${String(
              result.fullName ||
                result.username ||
                "Bác sĩ"
            ).replace(
              /^doctor\s+/i,
              ""
            )}`,
        },
      });
    } catch (err) {
      console.error(
        "UPDATE DOCTOR PROFILE ERROR =",
        err
      );

      if (err.code === 11000) {
        return res.status(409).json({
          msg:
            "Username hoặc email đã tồn tại.",
        });
      }

      return res.status(500).json({
        msg:
          err.message ||
          "Không thể cập nhật thông tin bác sĩ.",
      });
    }
  };

module.exports = exports;