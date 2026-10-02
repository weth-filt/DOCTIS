const router =
  require("express").Router();

const auth =
  require("../middlewares/auth");

const controller =
  require("../controllers/prescriptionController");

// Doctor xem đơn thuốc của bệnh nhân
router.get(
  "/doctor/patient/:patientId",
  auth,
  controller.getDoctorPatientPrescriptions
);

// Doctor tạo đơn thuốc
router.post(
  "/doctor",
  auth,
  controller.createDoctorPrescription
);

// Doctor hủy đơn thuốc
router.put(
  "/doctor/:id/cancel",
  auth,
  controller.cancelDoctorPrescription
);

// Patient xem đơn thuốc đã confirmed
router.get(
  "/my",
  auth,
  controller.getMyConfirmedPrescriptions
);

module.exports = router;