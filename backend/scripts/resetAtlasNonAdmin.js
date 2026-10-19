"use strict";

// One-off operator CLI. No app bootstrap, model initialization, seed, or .env load.
// Never log MongoDB errors, connection strings, document contents, or document IDs.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const dotenv = require("dotenv");
const { MongoClient, BSON } = require("mongoose").mongo;

const CONFIG_FILE = path.resolve(__dirname, "../.env.maintenance.local");
const VERSION = "doctis-atlas-non-admin-reset-v1";
const MAX_DOCUMENTS = 100000;
const BATCH_SIZE = 500;
const BASE_PROJECTION = { _id: 1, createdAt: 1, updatedAt: 1, __v: 1, revision: 1 };
const TRANSACTION_OPTIONS = {
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority", j: true, wtimeoutMS: 20000 },
  readPreference: "primary",
  maxCommitTimeMS: 10000,
};

// Explicit collection names checked against every current backend/models schema.
// A different/new collection must be reviewed in source; there is no --force.
const SCOPE = {
  users: { preserve: true, fields: ["role", "doctorId"] },
  wards: { preserve: true, fields: ["verifiedBy"] },
  hospitals: { preserve: true, fields: ["verifiedBy", "wardId"] },
  health: { owners: ["userId"] },
  prescriptions: { owners: ["patientId", "doctorId"] },
  advice: { owners: ["patientId", "doctorId"] },
  appointments: { owners: ["patientId", "doctorId"], userRefs: ["cancelledBy"] },
  conversations: { owners: ["patientId", "doctorId"], userRefs: ["lastSenderId"] },
  messages: { owners: ["senderId", "receiverId"], links: [{ field: "conversationId", collection: "conversations", required: true }] },
  aiconversations: { owners: ["userId"] },
  aimessages: { owners: ["userId"], links: [{ field: "conversationId", collection: "aiconversations", required: true }, { field: "replyTo", collection: "aimessages" }, { field: "attachmentIds", collection: "aiattachments" }] },
  aiattachments: { owners: ["userId"], links: [{ field: "conversationId", collection: "aiconversations", required: true }, { field: "messageId", collection: "aimessages", required: true }] },
  airatelimits: { owners: ["userId"] },
  passwordresetchallenges: { owners: ["userId"] },
  careplans: {
    owners: ["patientId"], userRefs: ["doctorId"],
    links: [{ field: "previousPlanId", collection: "careplans" }, { field: "inputSnapshot.health.recordId", collection: "health" }, { field: "inputSnapshot.prescriptionIds", collection: "prescriptions" }, { field: "days.items.prescriptionId", collection: "prescriptions" }],
  },
  reminders: { owners: ["userId"], userRefs: ["createdByDoctorId"], links: [{ field: "appointmentId", collection: "appointments" }] },
  doctorassignments: { owners: ["patientId", "doctorId"], userRefs: ["assignedBy", "endedBy"], links: [{ field: "supportRequestId", collection: "supportrequests" }, { field: "hospitalId", collection: "hospitals" }] },
  supportrequests: { owners: ["patientId"], userRefs: ["assignedDoctorId", "history.doctorId", "history.actorId"], links: [{ field: "wardId", collection: "wards", required: true }, { field: "hospitalId", collection: "hospitals" }, { field: "history.hospitalId", collection: "hospitals" }] },
  notifications: { preserve: true, fields: ["recipientId", "recipientRole", "entityType", "entityId", "readBy"] },
};
const ENTITY_COLLECTIONS = {
  user: "users", patient: "users", doctor: "users", "care-team": "users",
  intake: "supportrequests", assignment: "doctorassignments", appointment: "appointments",
  conversation: "conversations", "ai-conversation": "aiconversations",
  hospital: "hospitals", ward: "wards",
};

class ResetProblem extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function refuse(code, message) { throw new ResetProblem(code, message); }
function stable(value) {
  const sort = item => Array.isArray(item) ? item.map(sort) : item && typeof item === "object" ? Object.fromEntries(Object.keys(item).sort().map(key => [key, sort(item[key])])) : item;
  return JSON.stringify(sort(BSON.EJSON.serialize(value, { relaxed: false })));
}
function digest(value) { return crypto.createHash("sha256").update(typeof value === "string" ? value : stable(value)).digest("hex"); }
function idKey(value) {
  if (value && typeof value.toHexString === "function") return value.toHexString().toLowerCase();
  if (typeof value === "string" && /^[a-f\d]{24}$/i.test(value)) return value.toLowerCase();
  return value === undefined || value === null || value === "" ? "" : stable(value);
}
function roleOf(row) { return typeof row.role === "string" ? row.role.trim().toLowerCase() : ""; }
function valuesAt(value, field) {
  const visit = (node, segments) => {
    if (Array.isArray(node)) return node.flatMap(item => visit(item, segments));
    if (!segments.length) return [node];
    return node && typeof node === "object" ? visit(node[segments[0]], segments.slice(1)) : [undefined];
  };
  return visit(value, field.split("."));
}
function present(value) { return value !== undefined && value !== null && value !== ""; }
function projectionFor(scope) {
  return Object.fromEntries([...Object.keys(BASE_PROJECTION), ...(scope.fields || []), ...(scope.owners || []), ...(scope.userRefs || []), ...(scope.links || []).map(link => link.field)].map(field => [field, 1]));
}
function optionsFromArgs(args) {
  let apply = false, dryRun = false, plan = "";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--apply" && !apply) apply = true;
    else if (arg === "--dry-run" && !dryRun) dryRun = true;
    else if (arg === "--plan" && !plan && /^[a-f\d]{64}$/i.test(args[index + 1] || "")) plan = args[++index].toLowerCase();
    else refuse("INVALID_ARGUMENTS", "Chi chap nhan --dry-run hoac --apply --plan <fingerprint>.");
  }
  if ((apply && dryRun) || (apply !== Boolean(plan))) refuse("INVALID_ARGUMENTS", "Apply can ca --apply va --plan <fingerprint tu dry-run>.");
  return { apply, plan };
}
function createClient() {
  let config;
  try { config = dotenv.parse(fs.readFileSync(CONFIG_FILE, "utf8")); }
  catch { refuse("CONFIG_REQUIRED", "Chua doc duoc backend/.env.maintenance.local; khong nap .env hoac URI tu dong lenh."); }
  const uri = String(config.ATLAS_MAINTENANCE_URI || "").trim();
  const expectedDb = String(config.ATLAS_RESET_EXPECTED_DB || "").trim();
  if (!uri || !expectedDb || !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,62}$/.test(expectedDb)) refuse("CONFIG_REQUIRED", "Can ATLAS_MAINTENANCE_URI va ATLAS_RESET_EXPECTED_DB hop le trong file maintenance rieng.");
  const uriParts = uri.match(/^mongodb(?:\+srv)?:\/\/[^/?#]+(?:\/([^?#]*))?(?:\?[^#]*)?$/i);
  if (!uriParts || /[\r\n]/.test(uri)) refuse("INVALID_ATLAS_CONFIG", "URI phai la MongoDB Atlas hop le; khong ghi chi tiet ket noi ra log.");
  let embeddedDb;
  try { embeddedDb = decodeURIComponent(uriParts[1] || ""); }
  catch { refuse("INVALID_ATLAS_CONFIG", "Ten database ma hoa trong URI khong hop le."); }
  if ((embeddedDb && embeddedDb !== expectedDb) || ["admin", "local", "config"].includes(expectedDb.toLowerCase())) refuse("DATABASE_MISMATCH", "Database trong URI khong khop ATLAS_RESET_EXPECTED_DB hoac la database he thong.");
  let client;
  try {
    client = new MongoClient(uri, {
      appName: "DOCTIS-reviewed-atlas-reset", dbName: expectedDb, tls: true, tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false, retryWrites: false,
      minPoolSize: 0, maxPoolSize: 2, serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000, socketTimeoutMS: 30000, readPreference: "primary",
      monitorCommands: false, mongodbLogComponentSeverities: { default: "off" },
    });
  } catch { refuse("INVALID_ATLAS_CONFIG", "Khong phan tich duoc cau hinh Atlas. Chi tiet ket noi khong duoc ghi log."); }
  const hosts = client.options.srvHost ? [client.options.srvHost] : client.options.hosts.map(host => host.host);
  if (!hosts.length || hosts.some(host => typeof host !== "string" || !/^[a-z0-9.-]+\.mongodb\.net$/i.test(host))) refuse("ATLAS_HOST_REQUIRED", "Tu choi host ngoai mongodb.net.");
  if (client.options.dbName !== expectedDb) refuse("DATABASE_MISMATCH", "Database ket noi khong khop ATLAS_RESET_EXPECTED_DB; khong duoc dung database mac dinh.");
  return { client, db: client.db(expectedDb), target: digest({ hosts: [...hosts].sort(), database: expectedDb }) };
}
async function inventoryOf(db) {
  const rows = await db.listCollections({}, { nameOnly: false }).toArray();
  const unknown = rows.filter(row => !Object.hasOwn(SCOPE, row.name) || row.type !== "collection");
  if (unknown.length) {
    process.stdout.write(JSON.stringify({ refused: true, reviewRequired: "unknown-collections-or-views", collections: unknown.map(row => ({ name: row.name, type: row.type })) }, null, 2) + "\n");
    refuse("UNKNOWN_COLLECTIONS", "Co collection/view ngoai danh sach da duyet. Khong thay doi du lieu; can review scope trong ma nguon.");
  }
  if (!rows.some(row => row.name === "users")) refuse("USERS_COLLECTION_REQUIRED", "Khong tim thay collection users; tu choi reset.");
  return rows.map(row => ({ name: row.name, type: row.type, uuid: row.info?.uuid || null })).sort((a, b) => a.name.localeCompare(b.name));
}
async function collectPlan(db, inventory, target, session) {
  const rows = {}, metadata = {}, keep = {};
  const existing = new Set(inventory.map(row => row.name));
  let total = 0;
  for (const [name, scope] of Object.entries(SCOPE)) {
    rows[name] = existing.has(name) ? await db.collection(name).find({}, { projection: projectionFor(scope), ...(session ? { session } : {}), maxTimeMS: 20000 }).sort({ _id: 1 }).limit(MAX_DOCUMENTS + 1).toArray() : [];
    total += rows[name].length;
    if (total > MAX_DOCUMENTS) refuse("REVIEW_SIZE_LIMIT", "Qua gioi han metadata cua CLI mot lan. Can review chien luoc reset rieng; chua ap dung thay doi.");
    metadata[name] = digest(rows[name]);
  }
  if (rows.users.some(row => row._id?._bsontype !== "ObjectId")) refuse("UNEXPECTED_USER_ID", "Phat hien user ID ngoai schema ObjectId. Can review du lieu cu truoc khi reset.");
  const admins = rows.users.filter(row => roleOf(row) === "admin");
  if (!admins.length) refuse("ADMIN_REQUIRED", "Database phai co it nhat mot admin duoc giu lai. Chua thay doi du lieu.");
  if (admins.some(row => Object.hasOwn(row, "__v") && (!Number.isSafeInteger(row.__v) || row.__v < 0))) refuse("INVALID_ADMIN_VERSION", "Version admin khong hop le cho CAS; can review, chua thay doi du lieu.");
  const adminKeys = new Set(admins.map(row => idKey(row._id)));
  const isAdminRef = value => adminKeys.has(idKey(value));
  for (const [name, scope] of Object.entries(SCOPE)) {
    keep[name] = new Set(rows[name].filter(row => name === "users" ? isAdminRef(row._id) : scope.preserve ||
      (scope.owners || []).every(field => { const owners = valuesAt(row, field); return owners.length && owners.every(isAdminRef); }) &&
      (scope.userRefs || []).every(field => valuesAt(row, field).filter(present).every(isAdminRef))).map(row => idKey(row._id)));
  }
  // Remove descendants of deleted/missing parents, including legacy orphans.
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, scope] of Object.entries(SCOPE)) {
      for (const row of rows[name]) {
        if (!keep[name].has(idKey(row._id))) continue;
        const valid = (scope.links || []).every(link => {
          const values = valuesAt(row, link.field).filter(present);
          return (!link.required || values.length > 0) && values.every(value => keep[link.collection].has(idKey(value)));
        });
        if (!valid) { keep[name].delete(idKey(row._id)); changed = true; }
      }
    }
  }
  // Keep admin/system notices only when their explicit target still exists.
  keep.notifications = new Set(rows.notifications.filter(row => {
    if (row.recipientRole !== "admin" || (present(row.recipientId) && !isAdminRef(row.recipientId))) return false;
    if (!present(row.entityId)) return !row.entityType;
    const collection = ENTITY_COLLECTIONS[row.entityType];
    return Boolean(collection && keep[collection].has(idKey(row.entityId)));
  }).map(row => idKey(row._id)));
  const remove = Object.fromEntries(Object.keys(SCOPE).map(name => [name, rows[name].filter(row => !keep[name].has(idKey(row._id)))]));
  const cleanNotificationReads = rows.notifications.filter(row => keep.notifications.has(idKey(row._id)) && Array.isArray(row.readBy) && row.readBy.some(value => !isAdminRef(value)));
  const clearAdminDoctorPointers = admins.filter(row => present(row.doctorId) && !isAdminRef(row.doctorId));
  const roleCounts = { admin: 0, doctor: 0, user: 0, other: 0, missing: 0 };
  rows.users.forEach(row => { const role = roleOf(row); roleCounts[Object.hasOwn(roleCounts, role) ? role : role ? "other" : "missing"] += 1; });
  const counts = Object.fromEntries(Object.keys(SCOPE).map(name => [name, { present: existing.has(name), total: rows[name].length, delete: remove[name].length, preserve: keep[name].size }]));
  const summary = {
    version: VERSION, targetFingerprint: target, mutationScope: "reviewed-existing-document-ids",
    concurrentInsertsLocked: false, roleCounts, adminCount: admins.length,
    counts, adminDoctorPointersToClear: clearAdminDoctorPointers.length,
    adminNotificationReadListsToClean: cleanNotificationReads.length,
    preservedCatalogVerifierReferencesNotAdmin: rows.wards.concat(rows.hospitals).filter(row => present(row.verifiedBy) && !isAdminRef(row.verifiedBy)).length,
  };
  const fingerprint = digest({ version: VERSION, target, inventory, metadata, summary });
  return { rows, admins, adminKeys, remove, cleanNotificationReads, clearAdminDoctorPointers, summary, fingerprint, metadata };
}
function casFilter(row) {
  return Object.fromEntries(["_id", "role", "updatedAt", "__v", "doctorId"].map(field => [field, Object.hasOwn(row, field) ? row[field] : { $exists: false }]));
}
async function deleteRows(db, name, rows, session, userCas = false) {
  let removed = 0;
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    const result = userCas
      ? await db.collection(name).bulkWrite(batch.map(row => ({ deleteOne: { filter: casFilter(row) } })), { session, ordered: true })
      : await db.collection(name).deleteMany({ _id: { $in: batch.map(row => row._id) } }, { session });
    removed += result.deletedCount;
  }
  if (removed !== rows.length) refuse("CONCURRENT_CHANGE", "So ban ghi xoa khong khop plan; transaction se huy toan bo.");
}
async function applyPlan(db, plan, session) {
  const clearPointers = new Set(plan.clearAdminDoctorPointers.map(row => idKey(row._id)));
  for (const row of plan.admins) {
    const result = await db.collection("users").updateOne(casFilter(row), { $inc: { __v: 1 }, ...(clearPointers.has(idKey(row._id)) ? { $set: { doctorId: null } } : {}) }, { session });
    if (result.matchedCount !== 1) refuse("CONCURRENT_ADMIN_CHANGE", "Tai khoan admin vua thay doi; transaction se huy toan bo.");
  }
  for (const name of Object.keys(SCOPE).filter(name => !["users", "wards", "hospitals"].includes(name))) await deleteRows(db, name, plan.remove[name], session);
  const adminRefs = plan.admins.flatMap(row => [row._id, row._id.toHexString()]).concat(
    plan.cleanNotificationReads.flatMap(row => row.readBy.filter(value => plan.adminKeys.has(idKey(value))))
  );
  for (let offset = 0; offset < plan.cleanNotificationReads.length; offset += BATCH_SIZE) {
    const ids = plan.cleanNotificationReads.slice(offset, offset + BATCH_SIZE).map(row => row._id);
    const result = await db.collection("notifications").updateMany({ _id: { $in: ids } }, { $pull: { readBy: { $nin: adminRefs } } }, { session });
    if (result.matchedCount !== ids.length) refuse("CONCURRENT_NOTIFICATION_CHANGE", "Thong bao vua thay doi; transaction se huy toan bo.");
  }
  await deleteRows(db, "users", plan.remove.users, session, true);
  const remaining = await db.collection("users").find({}, { projection: { _id: 1, role: 1 }, session }).toArray();
  if (remaining.length !== plan.admins.length || remaining.some(row => roleOf(row) !== "admin" || !plan.adminKeys.has(idKey(row._id)))) refuse("POSTCONDITION_FAILED", "Dieu kien giu nguyen toan bo admin khong dat; transaction se huy toan bo.");
}

async function main() {
  if (process.argv.slice(2).includes("--help")) {
    process.stdout.write("Dry-run: node backend/scripts/resetAtlasNonAdmin.js\nApply: node backend/scripts/resetAtlasNonAdmin.js --apply --plan <fingerprint>\nConfig: backend/.env.maintenance.local only. Keep all application writers and scheduled jobs stopped throughout both steps.\n");
    return;
  }
  const options = optionsFromArgs(process.argv.slice(2));
  const { client, db, target } = createClient();
  let session;
  try {
    await client.connect();
    const hello = await db.admin().command({ hello: 1 });
    if ((!hello.setName && hello.msg !== "isdbgrid") || typeof hello.logicalSessionTimeoutMinutes !== "number") refuse("TRANSACTIONS_REQUIRED", "Atlas phai ho tro transaction. Khong co fallback xoa khong transaction.");
    const inventory = await inventoryOf(db);
    session = client.startSession();
    session.startTransaction(TRANSACTION_OPTIONS);
    const plan = await collectPlan(db, inventory, target, session);
    process.stdout.write(JSON.stringify({ mode: options.apply ? "reviewed-apply" : "dry-run", applied: false, maintenanceRequired: true, ...plan.summary, fingerprint: plan.fingerprint }, null, 2) + "\n");
    if (!options.apply) { await session.abortTransaction(); return; }
    if (options.plan !== plan.fingerprint) refuse("PLAN_CHANGED", "Fingerprint khong khop dry-run. Chua ap dung; chay lai dry-run va review so luong.");
    await applyPlan(db, plan, session);
    // Snapshot transactions do not lock inserts. Quiescence is mandatory; this
    // additional independent primary read catches changes during this operation.
    const freshInventory = await inventoryOf(db);
    const fresh = await collectPlan(db, freshInventory, target);
    if (fresh.fingerprint !== plan.fingerprint) refuse("CONCURRENT_CHANGE", "Du lieu thay doi trong khi reset. Transaction se huy; dung app/jobs va review dry-run moi.");
    try { await session.commitTransaction(); }
    catch (error) {
      if (error.hasErrorLabel?.("UnknownTransactionCommitResult")) refuse("COMMIT_RESULT_UNKNOWN", "Chua xac nhan duoc ket qua commit. Khong tu dong apply lai; chay dry-run doc trang thai va doi chieu.");
      throw error;
    }
    process.stdout.write(JSON.stringify({ applied: true, fingerprint: plan.fingerprint, preservedAdminCount: plan.admins.length, deleted: Object.fromEntries(Object.entries(plan.remove).map(([name, rows]) => [name, rows.length])), catalogsUnchanged: true }, null, 2) + "\n");
  } finally {
    if (session?.inTransaction()) await session.abortTransaction().catch(() => {});
    if (session) await session.endSession().catch(() => {});
    await client.close().catch(() => {});
  }
}
if (require.main === module) main().catch(error => {
  const safe = error instanceof ResetProblem;
  process.stderr.write(JSON.stringify({ refused: true, code: safe ? error.code : "ATLAS_RESET_FAILED", message: safe ? error.message : "Khong hoan tat reset. Kiem tra ket noi/quyen/maintenance; chi tiet loi va URI khong duoc ghi log. Khong co fallback ngoai transaction." }) + "\n");
  process.exitCode = 1;
});
