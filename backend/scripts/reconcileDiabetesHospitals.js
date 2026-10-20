// Reconcile only the hospital catalog with the user-supplied selection.
// Existing care, account, appointment and assignment documents are never changed.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { MongoClient, ObjectId } = require("mongodb");
const dotenv = require("dotenv");
const catalog = require("../data/danang-hospitals.source.json");
const { validateCatalog, facilityId, sameFacility, payloadFor } = require("./importHospitalCatalog");
const Hospital = require("../models/Hospital");
const { normalize } = require("../services/diabetesHospitalCatalog");
const fail = code => { const error = new Error(code); error.safeCode = code; throw error; };
const apply = process.argv.includes("--apply");
const local = process.argv.includes("--local");
const expectedPlan = process.argv.find(value => value.startsWith("--expected-plan="))?.split("=")[1];
const references = ["users", "supportrequests", "doctorassignments", "appointments", "prescriptions", "careplans"];

function connection() {
  if (local) return { uri: "mongodb://127.0.0.1:27028/doctis_public_preview?replicaSet=doctis-local-review", name: "doctis_public_preview" };
  const config = dotenv.parse(fs.readFileSync(path.resolve(__dirname, "../.env.maintenance.local")));
  const uri = config.ATLAS_MAINTENANCE_URI?.trim(), name = config.ATLAS_RESET_EXPECTED_DB?.trim();
  if (!uri || !name || name !== "health_ai") fail("EXPLICIT_ATLAS_HEALTH_AI_REQUIRED");
  const parsed = new URL(uri);
  if (parsed.protocol !== "mongodb+srv:" || !parsed.hostname.endsWith(".mongodb.net")) fail("ATLAS_SOURCE_REQUIRED");
  const uriDb = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (uriDb && uriDb !== name) fail("DATABASE_MISMATCH");
  return { uri, name };
}
async function prepare(db, session) {
  const options = session ? { session } : {};
  const hospitals = await db.collection("hospitals").find({}, options).sort({ _id: 1 }).toArray();
  const wards = new Map((await db.collection("wards").find({ active: true, verified: true, city: catalog.city }, options).toArray()).map(ward => [ward.code, ward]));
  const retained = new Set(), keep = [], insert = [];
  for (const row of catalog.facilities) {
    const matches = hospitals.filter(hospital => String(hospital._id) === String(facilityId(row.sourceKey)) || sameFacility(hospital, row));
    if (matches.length > 1) fail("AMBIGUOUS_EXISTING_HOSPITAL");
    if (matches[0]) { retained.add(String(matches[0]._id)); keep.push({ hospital: matches[0], row }); }
    else {
      const payload = payloadFor(row, wards);
      payload._id = new ObjectId(String(payload._id));
      await new Hospital(payload).validate(); insert.push({ row, payload });
    }
  }
  const retire = [];
  for (const hospital of hospitals.filter(item => !retained.has(String(item._id)))) {
    const usage = {};
    for (const collection of references) {
      const count = await db.collection(collection).countDocuments({ $or: [{ hospitalId: hospital._id }, { assignedHospitalId: hospital._id }, { "history.hospitalId": hospital._id }, { "history.previousHospitalId": hospital._id }] }, options);
      if (count) usage[collection] = count;
    }
    retire.push({ hospital, usage, action: Object.keys(usage).length ? "archive-from-selection" : "delete-unreferenced" });
  }
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ selection: catalog.selectionId, catalog: catalog.facilities, hospitals, retire: retire.map(item => ({ id: String(item.hospital._id), usage: item.usage })) })).digest("hex");
  return { hospitals, keep, insert, retire, fingerprint };
}
function summary(plan, database) {
  return { database, selected: catalog.facilities.length, keep: plan.keep.length, add: plan.insert.map(item => item.row.name), remove: plan.retire.filter(item => item.action === "delete-unreferenced").map(item => item.hospital.name), archive: plan.retire.filter(item => item.action !== "delete-unreferenced").map(item => ({ name: item.hospital.name, references: item.usage })), fingerprint: plan.fingerprint };
}
async function main() {
  validateCatalog();
  const target = connection();
  const client = new MongoClient(target.uri, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect(); const db = client.db(target.name);
    const plan = await prepare(db);
    if (!apply) { console.log(JSON.stringify({ dryRun: true, ...summary(plan, target.name) }, null, 2)); return; }
    if (!expectedPlan || expectedPlan !== plan.fingerprint) fail("REVIEWED_PLAN_REQUIRED_OR_CHANGED");
    const backupDir = path.resolve(__dirname, "../../.local-public-check/catalog-snapshots");
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(path.join(backupDir, `${target.name}-${Date.now()}.json`), JSON.stringify({ selectionId: catalog.selectionId, hospitals: plan.hospitals }, null, 2), { flag: "wx" });
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const current = await prepare(db, session);
        if (current.fingerprint !== expectedPlan) fail("CATALOG_OR_REFERENCES_CHANGED");
        for (const { hospital, row } of current.keep) {
          if (hospital.name !== row.name || JSON.stringify(hospital.diabetesCare) !== JSON.stringify(row.diabetesCare)) await db.collection("hospitals").updateOne({ _id: hospital._id }, { $set: { name: row.name, diabetesCare: row.diabetesCare, updatedAt: new Date() }, $inc: { revision: 1 } }, { session });
        }
        for (const { payload } of current.insert) await db.collection("hospitals").insertOne({ ...payload, createdAt: new Date(), updatedAt: new Date() }, { session });
        for (const item of current.retire) {
          if (item.action === "delete-unreferenced") await db.collection("hospitals").deleteOne({ _id: item.hospital._id }, { session });
          else await db.collection("hospitals").updateOne({ _id: item.hospital._id }, { $set: { "diabetesCare.eligible": false, "diabetesCare.selectionId": catalog.selectionId, acceptingPatients: false, updatedAt: new Date() }, $inc: { revision: 1 } }, { session });
        }
      });
    } finally { await session.endSession(); }
    const result = await db.collection("hospitals").find({ "diabetesCare.eligible": true, "diabetesCare.selectionId": catalog.selectionId }).toArray();
    if (result.length !== catalog.facilities.length || new Set(result.map(row => normalize(row.name))).size !== catalog.facilities.length) fail("POST_APPLY_CATALOG_MISMATCH");
    console.log(JSON.stringify({ applied: true, ...summary(plan, target.name), selectedAfter: result.length, relatedDocumentsChanged: 0 }, null, 2));
  } finally { await client.close(); }
}
main().catch(error => { console.error("DIABETES_CATALOG_RECONCILIATION_FAILED", error.safeCode || error.code || error.name); process.exitCode = 1; });
