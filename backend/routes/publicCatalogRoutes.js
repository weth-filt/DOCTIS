const router = require("express").Router();
router.get("/wards", require("../controllers/publicCatalogController").wards);
module.exports = router;
