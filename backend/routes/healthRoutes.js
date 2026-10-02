const express = require("express");

const router = express.Router();

const auth =
require("../middlewares/auth");

const {

  addHealth,

  getHistory,

  getLatest,

  getAdvices

} = require("../controllers/healthController");


// ================= ADD HEALTH =================

router.post(
  "/add",
  auth,
  addHealth
);


// ================= HISTORY =================

router.get(
  "/history",
  auth,
  getHistory
);


// ================= LATEST =================

router.get(
  "/latest",
  auth,
  getLatest
);


// ================= ADVICES =================

router.get(
  "/advices",
  auth,
  getAdvices
);

module.exports = router;