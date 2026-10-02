const router =
  require("express").Router();

const ctrl =
  require("../controllers/authController");

router.post(
  "/register",
  ctrl.register
);

router.post(
  "/verify",
  ctrl.verifyOTP
);

router.post(
  "/login",
  ctrl.login
);

router.post(
  "/forgot",
  ctrl.forgotPassword
);

router.post(
  "/reset",
  ctrl.resetPassword
);

module.exports = router;