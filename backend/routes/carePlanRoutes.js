const router =
  require("express").Router();

const auth =
  require("../middlewares/auth");

const controller =
  require("../controllers/carePlanController");

router.get("/current", auth, controller.getMyCurrentGeneratedCarePlan);
router.get("/history", auth, controller.getMyCarePlanHistory);
router.patch("/items/:itemId", auth, controller.updateMyCarePlanItem);

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

router.get("/my/mobile", auth, controller.getMyMobileCarePlan);

module.exports = router;
