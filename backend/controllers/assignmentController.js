const mongoose = require("mongoose");

const User = require("../models/User");
const DoctorAssignment = require("../models/DoctorAssignment");

/*
|--------------------------------------------------------------------------
| VALID OBJECT ID
|--------------------------------------------------------------------------
*/

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(
    String(id || "")
  );
};

/*
|--------------------------------------------------------------------------
| ADMIN CHECK
|--------------------------------------------------------------------------
*/

const adminOnly = (req, res) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({
      msg: "Chỉ admin mới có quyền.",
    });

    return false;
  }

  return true;
};

/*
|--------------------------------------------------------------------------
| GET ALL PATIENTS + CURRENT DOCTOR
|--------------------------------------------------------------------------
|
| GET /api/admin/assignments/patients
|
*/

exports.getPatientsWithAssignment =
  async (req, res) => {
    try {
      if (!adminOnly(req, res)) {
        return;
      }

      const patients =
        await User.find({
          role: "user",
        })
          .select(
            "_id username fullName email phone avatar gender dateOfBirth address bloodType allergies medicalHistory chronicDiseases"
          )
          .sort({
            fullName: 1,
            username: 1,
          })
          .lean();

      const assignments =
        await DoctorAssignment.find({
          status: "active",
        })
          .populate(
            "doctorId",
            "_id username fullName email phone avatar"
          )
          .populate(
            "assignedBy",
            "_id username fullName"
          )
          .lean();

      const assignmentMap =
        new Map();

      assignments.forEach(
        (assignment) => {
          assignmentMap.set(
            String(
              assignment.patientId
            ),
            assignment
          );
        }
      );

      const result =
        patients.map((patient) => {
          const assignment =
            assignmentMap.get(
              String(patient._id)
            );

          const doctor =
            assignment?.doctorId || null;

          return {
            ...patient,

            assigned: Boolean(
              assignment
            ),

            assignedDoctor:
              doctor,

            assignedDoctorId:
              doctor?._id || null,

            assignedAt:
              assignment?.assignedAt ||
              null,

            assignmentReason:
              assignment?.reason ||
              "",

            assignedBy:
              assignment?.assignedBy ||
              null,

            assignmentStatus:
              assignment
                ? "active"
                : "unassigned",
          };
        });

      return res.json(result);
    } catch (err) {
      console.error(
        "GET PATIENTS WITH ASSIGNMENT ERROR =",
        err
      );

      return res.status(500).json({
        msg:
          err.message ||
          "Không thể tải danh sách bệnh nhân.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| GET DOCTORS + PATIENT COUNT
|--------------------------------------------------------------------------
|
| GET /api/admin/assignments/doctors
|
*/

exports.getDoctorsForAssignment =
  async (req, res) => {
    try {
      if (!adminOnly(req, res)) {
        return;
      }

      const doctors =
        await User.find({
          role: "doctor",
        })
          .select(
            "_id username fullName email phone avatar"
          )
          .sort({
            fullName: 1,
            username: 1,
          })
          .lean();

      const counts =
        await DoctorAssignment.aggregate([
          {
            $match: {
              status: "active",
            },
          },
          {
            $group: {
              _id: "$doctorId",
              patientCount: {
                $sum: 1,
              },
            },
          },
        ]);

      const countMap =
        new Map(
          counts.map((item) => [
            String(item._id),
            item.patientCount,
          ])
        );

      const result =
        doctors.map((doctor) => ({
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

          patientCount:
            countMap.get(
              String(doctor._id)
            ) || 0,
        }));

      return res.json(result);
    } catch (err) {
      console.error(
        "GET DOCTORS FOR ASSIGNMENT ERROR =",
        err
      );

      return res.status(500).json({
        msg:
          err.message ||
          "Không thể tải danh sách bác sĩ.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| ASSIGNMENT SUMMARY
|--------------------------------------------------------------------------
|
| GET /api/admin/assignments/summary
|
*/

exports.getAssignmentSummary =
  async (req, res) => {
    try {
      if (!adminOnly(req, res)) {
        return;
      }

      const [
        totalPatients,
        totalDoctors,
        assignedPatients,
      ] =
        await Promise.all([
          User.countDocuments({
            role: "user",
          }),

          User.countDocuments({
            role: "doctor",
          }),

          DoctorAssignment.countDocuments({
            status: "active",
          }),
        ]);

      return res.json({
        totalPatients,
        totalDoctors,
        assignedPatients,
        unassignedPatients:
          Math.max(
            totalPatients -
              assignedPatients,
            0
          ),
        activeAssignments:
          assignedPatients,
      });
    } catch (err) {
      console.error(
        "GET ASSIGNMENT SUMMARY ERROR =",
        err
      );

      return res.status(500).json({
        msg:
          err.message ||
          "Không thể tải thống kê phân công.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| GET CURRENT ASSIGNMENT OF PATIENT
|--------------------------------------------------------------------------
|
| GET /api/admin/assignments/patient/:patientId
|
*/

exports.getPatientAssignment =
  async (req, res) => {
    try {
      if (!adminOnly(req, res)) {
        return;
      }

      const {
        patientId,
      } = req.params;

      if (
        !isValidObjectId(patientId)
      ) {
        return res.status(400).json({
          msg:
            "patientId không hợp lệ.",
        });
      }

      const assignment =
        await DoctorAssignment.findOne({
          patientId,
          status: "active",
        })
          .populate(
            "doctorId",
            "_id username fullName email phone avatar"
          )
          .populate(
            "assignedBy",
            "_id username fullName"
          )
          .lean();

      return res.json({
        assigned:
          Boolean(assignment),

        assignment:
          assignment || null,
      });
    } catch (err) {
      console.error(
        "GET PATIENT ASSIGNMENT ERROR =",
        err
      );

      return res.status(500).json({
        msg:
          err.message ||
          "Không thể lấy phân công hiện tại.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| ASSIGN / REASSIGN DOCTOR
|--------------------------------------------------------------------------
|
| POST /api/admin/assignments/assign
|
| body:
| {
|   patientId,
|   doctorId,
|   reason
| }
|
*/

exports.assignDoctor =
  async (req, res) => {
    try {
      if (!adminOnly(req, res)) {
        return;
      }

      const {
        patientId,
        doctorId,
        reason,
      } = req.body || {};

      if (
        !isValidObjectId(patientId) ||
        !isValidObjectId(doctorId)
      ) {
        return res.status(400).json({
          msg:
            "patientId hoặc doctorId không hợp lệ.",
        });
      }

      const [
        patient,
        doctor,
      ] = await Promise.all([
        User.findOne({
          _id: patientId,
          role: "user",
        }),

        User.findOne({
          _id: doctorId,
          role: "doctor",
        }),
      ]);

      if (!patient) {
        return res.status(404).json({
          msg:
            "Không tìm thấy bệnh nhân.",
        });
      }

      if (!doctor) {
        return res.status(404).json({
          msg:
            "Không tìm thấy bác sĩ.",
        });
      }

      const current =
        await DoctorAssignment.findOne({
          patientId,
          status: "active",
        });

      /*
      |--------------------------------------------------------------------------
      | CÙNG BÁC SĨ
      |--------------------------------------------------------------------------
      */

      if (
        current &&
        String(current.doctorId) ===
          String(doctorId)
      ) {
        return res.json({
          msg:
            "Bệnh nhân đã được phân công cho bác sĩ này.",
          assignment:
            current,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | ĐỔI BÁC SĨ
      |--------------------------------------------------------------------------
      */

      if (current) {
        current.status =
          "ended";

        current.endedAt =
          new Date();

        current.endedBy =
          req.user.id;

        current.reason =
          String(
            reason ||
              "Đổi bác sĩ phụ trách."
          ).trim();

        await current.save();
      }

      /*
      |--------------------------------------------------------------------------
      | CREATE NEW ACTIVE ASSIGNMENT
      |--------------------------------------------------------------------------
      */

      const assignment =
        await DoctorAssignment.create({
          doctorId,
          patientId,
          status: "active",
          assignedBy:
            req.user.id,
          assignedAt:
            new Date(),
          reason:
            String(
              reason ||
                "Phân công bác sĩ phụ trách."
            ).trim(),
        });

      const populated =
        await DoctorAssignment.findById(
          assignment._id
        )
          .populate(
            "doctorId",
            "_id username fullName email phone avatar"
          )
          .populate(
            "assignedBy",
            "_id username fullName"
          )
          .lean();

      return res.status(201).json({
        msg:
          current
            ? "Đã đổi bác sĩ phụ trách."
            : "Đã phân công bác sĩ.",
        assignment: populated,
      });
    } catch (err) {
      console.error(
        "ASSIGN DOCTOR ERROR =",
        err
      );

      if (err.code === 11000) {
        return res.status(409).json({
          msg:
            "Bệnh nhân hiện đã có bác sĩ phụ trách. Vui lòng tải lại dữ liệu rồi thử lại.",
        });
      }

      return res.status(500).json({
        msg:
          err.message ||
          "Không thể phân công bác sĩ.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| UNASSIGN DOCTOR
|--------------------------------------------------------------------------
|
| POST /api/admin/assignments/unassign
|
*/

exports.unassignDoctor =
  async (req, res) => {
    try {
      if (!adminOnly(req, res)) {
        return;
      }

      const {
        patientId,
        reason,
      } = req.body || {};

      if (
        !isValidObjectId(patientId)
      ) {
        return res.status(400).json({
          msg:
            "patientId không hợp lệ.",
        });
      }

      const assignment =
        await DoctorAssignment.findOne({
          patientId,
          status: "active",
        });

      if (!assignment) {
        return res.status(404).json({
          msg:
            "Bệnh nhân hiện không có bác sĩ phụ trách.",
        });
      }

      assignment.status =
        "ended";

      assignment.endedAt =
        new Date();

      assignment.endedBy =
        req.user.id;

      assignment.reason =
        String(
          reason ||
            "Admin gỡ bác sĩ phụ trách."
        ).trim();

      await assignment.save();

      return res.json({
        msg:
          "Đã gỡ bác sĩ phụ trách.",
        assignment,
      });
    } catch (err) {
      console.error(
        "UNASSIGN DOCTOR ERROR =",
        err
      );

      return res.status(500).json({
        msg:
          err.message ||
          "Không thể gỡ bác sĩ.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| ASSIGNMENT HISTORY
|--------------------------------------------------------------------------
|
| GET /api/admin/assignments/history/:patientId
|
*/

exports.getAssignmentHistory =
  async (req, res) => {
    try {
      if (!adminOnly(req, res)) {
        return;
      }

      const {
        patientId,
      } = req.params;

      if (
        !isValidObjectId(patientId)
      ) {
        return res.status(400).json({
          msg:
            "patientId không hợp lệ.",
        });
      }

      const history =
        await DoctorAssignment.find({
          patientId,
        })
          .populate(
            "doctorId",
            "_id username fullName email phone avatar"
          )
          .populate(
            "assignedBy",
            "_id username fullName"
          )
          .populate(
            "endedBy",
            "_id username fullName"
          )
          .sort({
            assignedAt: -1,
          })
          .lean();

      return res.json(history);
    } catch (err) {
      console.error(
        "GET ASSIGNMENT HISTORY ERROR =",
        err
      );

      return res.status(500).json({
        msg:
          err.message ||
          "Không thể lấy lịch sử phân công.",
      });
    }
  };

module.exports = exports;