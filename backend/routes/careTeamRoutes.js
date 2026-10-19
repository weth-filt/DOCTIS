const router = require("express").Router();
const controller = require("../controllers/careTeamController");
router.use(require("../middlewares/auth"));
router.get("/", controller.get);
router.patch("/address", controller.address);
module.exports = router;
