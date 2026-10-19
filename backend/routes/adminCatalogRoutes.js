const router = require("express").Router();
const controller = require("../controllers/adminCatalogController");
router.use(require("../middlewares/auth"), require("../middlewares/role")("admin"));
for (const kind of ["wards", "hospitals"]) { router.get(`/${kind}`, controller[`list_${kind}`]); router.post(`/${kind}`, controller[`create_${kind}`]); router.patch(`/${kind}/:id`, controller[`update_${kind}`]); router.delete(`/${kind}/:id`, controller[`delete_${kind}`]); }
module.exports = router;
