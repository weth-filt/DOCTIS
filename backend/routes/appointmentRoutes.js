const router =
  require("express").Router();

const auth =
  require("../middlewares/auth");

const appointment =
  require("../controllers/appointmentController");

router.post(
  "/create",
  auth,
  appointment.createAppointment
);

router.get(
  "/patient",
  auth,
  appointment.getPatientAppointments
);

router.get(
  "/doctor",
  auth,
  appointment.getDoctorAppointments
);

router.put(
  "/cancel/:id",
  auth,
  appointment.cancelAppointment
);

router.post(
  "/remind/:id",
  auth,
  appointment.remindAppointment
);

module.exports = router;