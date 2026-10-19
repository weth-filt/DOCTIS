const router = require("express").Router();
const auth = require("../middlewares/auth");
const controller = require("../controllers/reminderController");
router.get("/my", auth, controller.my);
router.post("/create", auth, controller.create);
router.post("/doctor/create", auth, controller.doctorCreate);
router.put("/update/:id", auth, controller.update);
router.delete("/delete/:id", auth, controller.remove);
module.exports = router;
