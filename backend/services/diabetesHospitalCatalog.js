const crypto = require("node:crypto");
const catalog = require("../data/danang-hospitals.source.json");
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const idFor = row => crypto.createHash("sha256").update(`doctis:hospital-catalog:v1:${catalog.datasetId}:${row.sourceKey}`).digest("hex").slice(0, 24);
function selectedHospitalCare(hospital) {
  const row = catalog.facilities.find(item => idFor(item) === String(hospital?._id || hospital?.id || "") || [item.name, item.sourceName, ...(item.aliases || [])].some(name => normalize(name) === normalize(hospital?.name)));
  if (!row || hospital?.diabetesCare?.eligible === false && hospital?.diabetesCare?.selectionId === catalog.selectionId) return null;
  return row.diabetesCare;
}
module.exports = { selectedHospitalCare, normalize, idFor };
