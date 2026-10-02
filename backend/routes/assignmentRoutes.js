const router =
  require("express").Router();

const auth =
  require("../middlewares/auth");

const role =
  require("../middlewares/role");

const assignmentController =
  require("../controllers/assignmentController");

/*
|--------------------------------------------------------------------------
| ADMIN ONLY
|--------------------------------------------------------------------------
*/

router.use(
  auth,
  role("admin")
);

/*
|--------------------------------------------------------------------------
| PATIENTS + CURRENT DOCTOR
|--------------------------------------------------------------------------
*/

router.get(
  "/patients",
  assignmentController.getPatientsWithAssignment
);

/*
|--------------------------------------------------------------------------
| DOCTORS + PATIENT COUNT
|--------------------------------------------------------------------------
*/

router.get(
  "/doctors",
  assignmentController.getDoctorsForAssignment
);

/*
|--------------------------------------------------------------------------
| ASSIGNMENT SUMMARY
|--------------------------------------------------------------------------
*/

router.get(
  "/summary",
  assignmentController.getAssignmentSummary
);

/*
|--------------------------------------------------------------------------
| CURRENT ASSIGNMENT OF ONE PATIENT
|--------------------------------------------------------------------------
*/

router.get(
  "/patient/:patientId",
  assignmentController.getPatientAssignment
);

/*
|--------------------------------------------------------------------------
| ASSIGN / REASSIGN DOCTOR
|--------------------------------------------------------------------------
*/

router.post(
  "/assign",
  assignmentController.assignDoctor
);

/*
|--------------------------------------------------------------------------
| UNASSIGN DOCTOR
|--------------------------------------------------------------------------
*/

router.post(
  "/unassign",
  assignmentController.unassignDoctor
);

/*
|--------------------------------------------------------------------------
| ASSIGNMENT HISTORY
|--------------------------------------------------------------------------
*/

router.get(
  "/history/:patientId",
  assignmentController.getAssignmentHistory
);

module.exports = router;