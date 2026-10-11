const router = require("express").Router();
const ctrl = require("../controllers/aiController");
const requireAuth = require("../middlewares/auth");

router.post("/analyze", requireAuth, ctrl.analyze);

module.exports = router;
