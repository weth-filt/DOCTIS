const router = require("express").Router();

const auth = require("../middlewares/auth");
const role = require("../middlewares/role");

const adminController =
  require("../controllers/adminController");

const assignmentRoutes =
  require("./assignmentRoutes");

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
| USERS
|--------------------------------------------------------------------------
*/

router.get(
  "/users",
  adminController.getUsers
);

/*
|--------------------------------------------------------------------------
| CHANGE ROLE
|--------------------------------------------------------------------------
*/

router.put(
  "/change-role/:id",
  adminController.changeRole
);

/*
|--------------------------------------------------------------------------
| EDIT DOCTOR
|--------------------------------------------------------------------------
*/

router.put(
  "/doctors/:id",
  adminController.updateDoctorProfile
);

/*
|--------------------------------------------------------------------------
| DOCTOR ASSIGNMENT
|--------------------------------------------------------------------------
*/

router.use(
  "/assignments",
  assignmentRoutes
);

module.exports = router;