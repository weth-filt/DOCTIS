const Appointment =
  require("../models/Appointment");

const User =
  require("../models/User");

const {
  sendMail,
} = require("../utils/mailer");

// ========================================
// DOCTOR ONLY
// ========================================

const requireDoctor = (
  req,
  res
) => {
  if (
    req.user?.role !== "doctor"
  ) {
    res.status(403).json({
      msg:
        "Chỉ bác sĩ mới có quyền.",
    });

    return false;
  }

  return true;
};

// ========================================
// CREATE APPOINTMENT
// ========================================

exports.createAppointment =
  async (req, res) => {
    try {
      if (
        !requireDoctor(req, res)
      ) {
        return;
      }

      const {
        patientId,
        appointmentDate,
        note,
        type,
      } = req.body;

      if (
        !patientId ||
        !appointmentDate
      ) {
        return res.status(400).json({
          msg:
            "Thiếu patientId hoặc ngày hẹn.",
        });
      }

      const patient =
        await User.findOne({
          _id: patientId,
          role: "user",
        }).select(
          "username fullName email"
        );

      if (!patient) {
        return res.status(404).json({
          msg:
            "Không tìm thấy bệnh nhân.",
        });
      }

      const date =
        new Date(
          appointmentDate
        );

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return res.status(400).json({
          msg:
            "Ngày hẹn không hợp lệ.",
        });
      }

      const appointment =
        await Appointment.create({
          doctorId:
            req.user.id,

          patientId,

          appointmentDate:
            date,

          note:
            note || "",

          type:
            type ||
            "Tái khám",
        });

      return res.status(201).json({
        msg:
          "Tạo lịch hẹn thành công.",
        appointment,
      });
    } catch (err) {
      console.error(
        "CREATE APPOINTMENT ERROR =",
        err
      );

      return res.status(500).json({
        msg: err.message,
      });
    }
  };

// ========================================
// PATIENT APPOINTMENTS
// ========================================

exports.getPatientAppointments =
  async (req, res) => {
    try {
      const appointments =
        await Appointment.find({
          patientId:
            req.user.id,
        })
          .populate(
            "doctorId",
            "username fullName email"
          )
          .sort({
            appointmentDate: -1,
          });

      return res.json(
        appointments
      );
    } catch (err) {
      return res.status(500).json({
        msg: err.message,
      });
    }
  };

// ========================================
// DOCTOR APPOINTMENTS
// ========================================

exports.getDoctorAppointments =
  async (req, res) => {
    try {
      if (
        !requireDoctor(req, res)
      ) {
        return;
      }

      const appointments =
        await Appointment.find({
          doctorId:
            req.user.id,
        })
          .populate(
            "patientId",
            "username fullName email phone"
          )
          .sort({
            appointmentDate: -1,
          });

      return res.json(
        appointments
      );
    } catch (err) {
      console.error(
        "GET DOCTOR APPOINTMENTS ERROR =",
        err
      );

      return res.status(500).json({
        msg: err.message,
      });
    }
  };

// ========================================
// CANCEL
// ========================================

exports.cancelAppointment =
  async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          msg:
            "Chưa đăng nhập.",
        });
      }

      const appointment =
        await Appointment.findOne({
          _id: req.params.id,

          $or: [
            {
              doctorId:
                req.user.id,
            },
            {
              patientId:
                req.user.id,
            },
          ],
        });

      if (!appointment) {
        return res.status(404).json({
          msg:
            "Không tìm thấy lịch hẹn.",
        });
      }

      if (!["pending", "approved"].includes(appointment.status)) {
        return res.status(400).json({ msg: "Lịch này không còn ở trạng thái có thể hủy." });
      }

      appointment.status =
        "cancelled";

      appointment.cancelReason =
        req.body.reason ||
        "Không có lý do";

      await appointment.save();

      return res.json({
        msg:
          "Đã hủy lịch hẹn.",
      });
    } catch (err) {
      return res.status(500).json({
        msg: err.message,
      });
    }
  };

const updateAppointmentStatus = async (req, res, status) => {
  try {
    if (!requireDoctor(req, res)) return;

    const appointment = await Appointment.findOne({
      _id: req.params.id,
      doctorId: req.user.id,
    });

    if (!appointment) {
      return res.status(404).json({ msg: "Không tìm thấy lịch hẹn." });
    }

    const allowedFrom = status === "approved" ? "pending" : "approved";
    if (appointment.status !== allowedFrom) {
      return res.status(400).json({
        msg: status === "approved"
          ? "Chỉ có thể duyệt lịch đang chờ."
          : "Chỉ có thể hoàn tất lịch đã duyệt.",
      });
    }

    if (status === "completed" && appointment.appointmentDate > new Date()) {
      return res.status(400).json({ msg: "Chưa thể hoàn tất lịch hẹn trong tương lai." });
    }

    appointment.status = status;
    await appointment.save();
    return res.json({ msg: status === "approved" ? "Đã duyệt lịch hẹn." : "Đã đánh dấu hoàn thành.", appointment });
  } catch (err) {
    console.error("UPDATE APPOINTMENT STATUS ERROR =", err);
    return res.status(500).json({ msg: err.message || "Không thể cập nhật lịch hẹn." });
  }
};

exports.approveAppointment = (req, res) => updateAppointmentStatus(req, res, "approved");
exports.completeAppointment = (req, res) => updateAppointmentStatus(req, res, "completed");

// ========================================
// SEND APPOINTMENT REMINDER
// ========================================

exports.remindAppointment =
  async (req, res) => {
    try {
      if (
        !requireDoctor(req, res)
      ) {
        return;
      }

      const appointment =
        await Appointment.findOne({
          _id: req.params.id,

          doctorId:
            req.user.id,
        }).populate(
          "patientId",
          "username fullName email"
        );

      if (!appointment) {
        return res.status(404).json({
          msg:
            "Không tìm thấy lịch hẹn.",
        });
      }

      const email =
        String(
          appointment
            .patientId
            ?.email || ""
        ).trim();

      if (!email) {
        return res.status(400).json({
          msg:
            "Bệnh nhân chưa có email.",
        });
      }

      const when =
        new Date(
          appointment.appointmentDate
        ).toLocaleString(
          "vi-VN"
        );

      await sendMail({
        to: email,

        subject:
          "Nhắc lịch khám — DOCTIS",

        text:
          `Xin chào ${
            appointment.patientId
              .fullName ||
            appointment.patientId
              .username ||
            "bạn"
          },\n\n` +

          `Bạn có lịch khám vào ${when}.\n` +

          `Loại: ${
            appointment.type ||
            "Tái khám"
          }\n` +

          `${
            appointment.note
              ? `Nội dung: ${appointment.note}\n`
              : ""
          }\n` +

          "Vui lòng sắp xếp thời gian và đến đúng lịch.",
      });

      return res.json({
        msg:
          "Đã gửi email nhắc lịch.",
        email,
      });
    } catch (err) {
      console.error(
        "REMIND APPOINTMENT ERROR =",
        err
      );

      return res.status(500).json({
        msg:
          err.message ||
          "Không thể gửi email.",
      });
    }
  };
