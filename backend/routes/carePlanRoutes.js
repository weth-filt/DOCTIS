const router =
  require("express").Router();

const auth =
  require("../middlewares/auth");

const controller =
  require("../controllers/carePlanController");

// Doctor xem care plan của bệnh nhân
router.get(
  "/doctor/patient/:patientId",
  auth,
  controller.getDoctorPatientCarePlan
);

// Doctor tạo / cập nhật care plan
router.post(
  "/doctor",
  auth,
  controller.saveDoctorCarePlan
);

// Patient xem care plan đã confirmed
router.get(
  "/my",
  auth,
  controller.getMyConfirmedCarePlan
);

router.post(
  "/my",
  auth,
  controller.saveMyGeneratedCarePlan
);

module.exports = router;
