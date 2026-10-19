const router = require("express").Router();
const auth = require("../middlewares/auth");
const controller = require("../controllers/notificationController");
router.use(auth);
router.get("/", controller.list);
router.patch("/:id/read", controller.read);
router.post("/read-all", controller.readAll);
module.exports = router;
