const router = require("express").Router();
const ctrl = require("../controllers/aiController");

router.post("/analyze", ctrl.analyze);

module.exports = router;