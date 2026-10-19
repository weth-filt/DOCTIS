const Ward = require("../models/Ward");
const { CITY, sendProblem } = require("../services/coordinationUtils");
function createPublicCatalogController({ WardModel = Ward } = {}) {
  return { wards: async (req, res) => { try { const wards = await WardModel.find({ city: CITY, active: true, verified: true }).select("_id code name city sourceUrl verifiedAt").sort({ name: 1 }).lean().exec(); return res.json({ city: CITY, wards: wards.map(value => ({ ...value, id: String(value._id) })), configured: wards.length > 0 }); } catch (error) { return sendProblem(res, error); } } };
}
module.exports = { ...createPublicCatalogController(), createPublicCatalogController };
