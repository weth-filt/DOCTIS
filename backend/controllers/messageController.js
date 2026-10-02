const User = require("../models/User");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

const {
  isValidObjectId,
  isAssignedDoctor,
  getActiveAssignment,
  getAssignedPatientIds,
} = require("../middlewares/assignmentAccess");

/*
|--------------------------------------------------------------------------
| GET / CREATE CONVERSATION
|--------------------------------------------------------------------------
*/

const getOrCreateConversation =
  async (
    doctorId,
    patientId
  ) => {
    let convo =
      await Conversation.findOne({
        doctorId,
        patientId,
      });

    if (!convo) {
      convo =
        await Conversation.create({
          doctorId,
          patientId,
        });
    }

    return convo;
  };

/*
|--------------------------------------------------------------------------
| MESSAGE ROLE
|--------------------------------------------------------------------------
*/

const messageRole = (role) => {
  return role === "doctor"
    ? "doctor"
    : "patient";
};

/*
|--------------------------------------------------------------------------
| NORMALIZE ATTACHMENT
|--------------------------------------------------------------------------
*/

const normalizeAttachment = (
  attachment
) => {
  if (!attachment) {
    return null;
  }

  const name = String(
    attachment.name ||
      "Tệp đính kèm"
  ).trim();

  const type = String(
    attachment.type ||
      "application/octet-stream"
  ).trim();

  const size = Number(
    attachment.size || 0
  );

  const dataUrl = String(
    attachment.dataUrl || ""
  ).trim();

  if (!dataUrl) {
    return null;
  }

  return {
    name,
    type,
    size,
    dataUrl,
  };
};

/*
|--------------------------------------------------------------------------
| VALIDATE ATTACHMENT
|--------------------------------------------------------------------------
*/

const validateAttachment = (
  attachment,
  res
) => {
  if (!attachment) {
    return true;
  }

  if (!attachment.dataUrl) {
    res.status(400).json({
      msg:
        "Tệp đính kèm không có dữ liệu.",
    });

    return false;
  }

  if (
    attachment.size >
    8 * 1024 * 1024
  ) {
    res.status(400).json({
      msg:
        "Tệp đính kèm không được vượt quá 8MB.",
    });

    return false;
  }

  /*
  | Dữ liệu thực tế cũng không được vượt quá giới hạn
  */

  if (
    attachment.dataUrl.length >
    11 * 1024 * 1024
  ) {
    res.status(400).json({
      msg:
        "Dữ liệu tệp quá lớn.",
    });

    return false;
  }

  return true;
};

/*
|--------------------------------------------------------------------------
| PATIENT: GET DOCTOR
|--------------------------------------------------------------------------
|
| Chỉ trả bác sĩ active hiện tại.
|
*/

exports.getDoctorsForPatient =
  async (req, res) => {
    try {
      const patientId =
        req.user.id;

      const assignment =
        await getActiveAssignment(
          patientId
        );

      if (!assignment) {
        return res.json([]);
      }

      /*
      | Vì getActiveAssignment populate doctorId
      | nên lấy đúng ObjectId.
      */

      const doctorId =
        assignment.doctorId?._id ||
        assignment.doctorId;

      const doctor =
        await User.findOne({
          _id: doctorId,
          role: "doctor",
        })
          .select(
            "_id username fullName email phone avatar"
          )
          .lean();

      if (!doctor) {
        return res.json([]);
      }

      const convo =
        await Conversation.findOne({
          doctorId: doctor._id,
          patientId,
        }).lean();

      return res.json([
        {
          ...doctor,

          displayName:
            `Doctor ${String(
              doctor.fullName ||
                doctor.username ||
                "Bác sĩ"
            ).replace(
              /^doctor\s+/i,
              ""
            )}`,

          conversationId:
            convo?._id || null,

          lastMessage:
            convo?.lastMessage || "",

          lastMessageAt:
            convo?.lastMessageAt ||
            null,

          unread:
            convo?.unreadForPatient ||
            0,
        },
      ]);
    } catch (err) {
      console.error(
        "GET DOCTORS FOR PATIENT ERROR =",
        err
      );

      return res.status(500).json({
        msg:
          err.message ||
          "Không thể lấy bác sĩ phụ trách.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| DOCTOR: GET ASSIGNED PATIENTS
|--------------------------------------------------------------------------
*/

exports.getPatientsForDoctor =
  async (req, res) => {
    try {
      if (
        req.user?.role !== "doctor"
      ) {
        return res.status(403).json({
          msg:
            "Chỉ bác sĩ mới có quyền.",
        });
      }

      const patientIds =
        await getAssignedPatientIds(
          req.user.id
        );

      if (!patientIds.length) {
        return res.json([]);
      }

      const patients =
        await User.find({
          _id: {
            $in: patientIds,
          },
          role: "user",
        })
          .select(
            "_id username fullName email phone avatar"
          )
          .lean();

      const convos =
        await Conversation.find({
          doctorId: req.user.id,
          patientId: {
            $in: patientIds,
          },
        }).lean();

      const convoMap =
        new Map(
          convos.map(
            (c) => [
              String(
                c.patientId
              ),
              c,
            ]
          )
        );

      const result =
        patients.map(
          (patient) => {
            const convo =
              convoMap.get(
                String(
                  patient._id
                )
              );

            return {
              ...patient,

              conversationId:
                convo?._id || null,

              lastMessage:
                convo?.lastMessage ||
                "",

              lastMessageAt:
                convo?.lastMessageAt ||
                null,

              unread:
                convo?.unreadForDoctor ||
                0,
            };
          }
        );

      result.sort(
        (a, b) =>
          new Date(
            b.lastMessageAt || 0
          ) -
          new Date(
            a.lastMessageAt || 0
          )
      );

      return res.json(result);
    } catch (err) {
      console.error(
        "GET PATIENTS FOR DOCTOR ERROR =",
        err
      );

      return res.status(500).json({
        msg:
          err.message ||
          "Không thể lấy bệnh nhân được phân công.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| PATIENT: GET MESSAGES WITH DOCTOR
|--------------------------------------------------------------------------
*/

exports.getMessagesWithDoctor =
  async (req, res) => {
    try {
      const patientId =
        req.user.id;

      const {
        doctorId,
      } = req.params;

      if (
        !isValidObjectId(
          doctorId
        )
      ) {
        return res.status(400).json({
          msg:
            "doctorId không hợp lệ.",
        });
      }

      const assignment =
        await getActiveAssignment(
          patientId
        );

      const assignedDoctorId =
        assignment?.doctorId?._id ||
        assignment?.doctorId;

      if (
        !assignment ||
        String(
          assignedDoctorId
        ) !== String(doctorId)
      ) {
        return res.status(403).json({
          msg:
            "Bạn chỉ có thể nhắn tin với bác sĩ đang phụ trách.",
          code:
            "DOCTOR_NOT_ASSIGNED",
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
            "Không tìm thấy bác sĩ.",
        });
      }

      const convo =
        await getOrCreateConversation(
          doctorId,
          patientId
        );

      const messages =
        await Message.find({
          conversationId:
            convo._id,
        })
          .sort({
            createdAt: 1,
          })
          .lean();

      await Message.updateMany(
        {
          conversationId:
            convo._id,

          senderRole:
            "doctor",

          read: false,
        },
        {
          $set: {
            read: true,
          },
        }
      );

      await Conversation.updateOne(
        {
          _id: convo._id,
        },
        {
          $set: {
            unreadForPatient: 0,
          },
        }
      );

      return res.json(messages);
    } catch (err) {
      console.error(
        "GET MESSAGES WITH DOCTOR ERROR =",
        err
      );

      return res.status(500).json({
        msg:
          err.message ||
          "Không thể lấy tin nhắn.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| DOCTOR: GET MESSAGES WITH PATIENT
|--------------------------------------------------------------------------
*/

exports.getMessagesWithPatient =
  async (req, res) => {
    try {
      if (
        req.user?.role !== "doctor"
      ) {
        return res.status(403).json({
          msg:
            "Chỉ bác sĩ mới có quyền.",
        });
      }

      const doctorId =
        req.user.id;

      const {
        patientId,
      } = req.params;

      if (
        !isValidObjectId(
          patientId
        )
      ) {
        return res.status(400).json({
          msg:
            "patientId không hợp lệ.",
        });
      }

      const assigned =
        await isAssignedDoctor(
          doctorId,
          patientId
        );

      if (!assigned) {
        return res.status(403).json({
          msg:
            "Bệnh nhân này chưa được phân công cho bác sĩ hiện tại.",
          code:
            "PATIENT_NOT_ASSIGNED",
        });
      }

      const patient =
        await User.findOne({
          _id: patientId,
          role: "user",
        });

      if (!patient) {
        return res.status(404).json({
          msg:
            "Không tìm thấy bệnh nhân.",
        });
      }

      const convo =
        await getOrCreateConversation(
          doctorId,
          patientId
        );

      const messages =
        await Message.find({
          conversationId:
            convo._id,
        })
          .sort({
            createdAt: 1,
          })
          .lean();

      await Message.updateMany(
        {
          conversationId:
            convo._id,

          senderRole:
            "patient",

          read: false,
        },
        {
          $set: {
            read: true,
          },
        }
      );

      await Conversation.updateOne(
        {
          _id: convo._id,
        },
        {
          $set: {
            unreadForDoctor: 0,
          },
        }
      );

      return res.json(messages);
    } catch (err) {
      console.error(
        "GET MESSAGES WITH PATIENT ERROR =",
        err
      );

      return res.status(500).json({
        msg:
          err.message ||
          "Không thể lấy tin nhắn.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| SEND MESSAGE
|--------------------------------------------------------------------------
|
| Có thể:
|
| 1. TEXT
| 2. IMAGE
| 3. FILE
| 4. TEXT + IMAGE
| 5. TEXT + FILE
|
| Không bắt buộc content nếu có attachment.
|
*/

exports.sendMessage =
  async (req, res) => {
    try {
      const senderId =
        req.user.id;

      const senderRole =
        messageRole(
          req.user?.role
        );

      const {
        receiverId,
        content,
        attachment,
      } = req.body || {};

      if (
        !isValidObjectId(
          receiverId
        )
      ) {
        return res.status(400).json({
          msg:
            "Thiếu receiverId hoặc receiverId không hợp lệ.",
        });
      }

      const cleanContent =
        String(
          content || ""
        ).trim();

      const normalizedAttachment =
        normalizeAttachment(
          attachment
        );

      if (
        !cleanContent &&
        !normalizedAttachment
      ) {
        return res.status(400).json({
          msg:
            "Tin nhắn phải có nội dung hoặc tệp đính kèm.",
        });
      }

      if (
        String(senderId) ===
        String(receiverId)
      ) {
        return res.status(400).json({
          msg:
            "Không thể gửi tin nhắn cho chính mình.",
        });
      }

      if (
        !validateAttachment(
          normalizedAttachment,
          res
        )
      ) {
        return;
      }

      const receiver =
        await User.findById(
          receiverId
        )
          .select("_id role")
          .lean();

      if (!receiver) {
        return res.status(404).json({
          msg:
            "Không tìm thấy người nhận.",
        });
      }

      const validPair =
        (senderRole === "doctor" &&
          receiver.role === "user") ||
        (senderRole === "patient" &&
          receiver.role === "doctor");

      if (!validPair) {
        return res.status(403).json({
          msg:
            "Chỉ cho phép bác sĩ và bệnh nhân trao đổi.",
        });
      }

      let doctorId;
      let patientId;

      if (
        senderRole === "doctor"
      ) {
        doctorId = senderId;
        patientId = receiverId;
      } else {
        doctorId = receiverId;
        patientId = senderId;
      }

      /*
      |--------------------------------------------------------------------------
      | ASSIGNMENT SECURITY
      |--------------------------------------------------------------------------
      */

      const assigned =
        await isAssignedDoctor(
          doctorId,
          patientId
        );

      if (!assigned) {
        return res.status(403).json({
          msg:
            "Cuộc trò chuyện này không được phép vì bệnh nhân chưa được phân công cho bác sĩ.",
          code:
            "PATIENT_NOT_ASSIGNED",
        });
      }

      const convo =
        await getOrCreateConversation(
          doctorId,
          patientId
        );

      const message =
        await Message.create({
          conversationId:
            convo._id,

          senderId,

          receiverId,

          senderRole,

          content:
            cleanContent,

          attachment:
            normalizedAttachment,

          read: false,
        });

      const lastMessage =
        cleanContent ||
        (normalizedAttachment
          ? normalizedAttachment.type.startsWith(
              "image/"
            )
            ? "📷 Hình ảnh"
            : `📎 ${normalizedAttachment.name}`
          : "");

      if (
        senderRole === "doctor"
      ) {
        await Conversation.updateOne(
          {
            _id: convo._id,
          },
          {
            $set: {
              lastMessage,
              lastMessageAt:
                new Date(),
            },

            $inc: {
              unreadForPatient: 1,
            },
          }
        );
      } else {
        await Conversation.updateOne(
          {
            _id: convo._id,
          },
          {
            $set: {
              lastMessage,
              lastMessageAt:
                new Date(),
            },

            $inc: {
              unreadForDoctor: 1,
            },
          }
        );
      }

      return res.status(201).json(
        message
      );
    } catch (err) {
      console.error(
        "SEND MESSAGE ERROR =",
        err
      );

      return res.status(500).json({
        msg:
          err.message ||
          "Không thể gửi tin nhắn.",
      });
    }
  };

module.exports = exports;