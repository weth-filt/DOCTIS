// Copy one existing Atlas admin into the isolated preview. Atlas is read only.
// Credentials stay in memory; no password, hash or connection URI is logged.
const fs = require("node:fs");
const path = require("node:path");
const { MongoClient } = require("mongodb");
const dotenv = require("dotenv");

const LOCAL_URI = "mongodb://127.0.0.1:27028/doctis_public_preview?replicaSet=doctis-local-review";
const LOCAL_DB = "doctis_public_preview";
const fail = code => { const error = new Error(code); error.safeCode = code; throw error; };

async function main() {
  const emailIndex = process.argv.indexOf("--email");
  const email = emailIndex >= 0 ? process.argv[emailIndex + 1]?.trim().toLowerCase() : "";
  const apply = process.argv.includes("--apply");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.log("Usage: node backend/scripts/copyAdminToLocalPreview.js --email <existing-admin-email> [--apply]");
    return;
  }
  const configPath = path.resolve(__dirname, "../.env.maintenance.local");
  if (!fs.existsSync(configPath)) fail("MAINTENANCE_CONFIG_MISSING");
  const config = dotenv.parse(fs.readFileSync(configPath));
  const sourceUri = config.ATLAS_MAINTENANCE_URI?.trim();
  const sourceDbName = config.ATLAS_RESET_EXPECTED_DB?.trim();
  if (!sourceUri || !sourceDbName || !/^[A-Za-z0-9_-]+$/.test(sourceDbName)) fail("ATLAS_SOURCE_CONFIG_INCOMPLETE");
  let sourceUrl;
  try { sourceUrl = new URL(sourceUri); } catch { fail("ATLAS_SOURCE_URI_INVALID"); }
  if (sourceUrl.protocol !== "mongodb+srv:" || !sourceUrl.hostname.endsWith(".mongodb.net")) fail("ATLAS_SOURCE_REQUIRED");
  const uriDbName = decodeURIComponent(sourceUrl.pathname.replace(/^\//, ""));
  if (uriDbName && uriDbName !== sourceDbName) fail("ATLAS_DATABASE_MISMATCH");
  if (sourceDbName === LOCAL_DB) fail("SOURCE_AND_TARGET_MUST_DIFFER");

  const source = new MongoClient(sourceUri, { serverSelectionTimeoutMS: 10000 });
  const target = new MongoClient(LOCAL_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await source.connect();
    const candidates = await source.db(sourceDbName).collection("users").find(
      { email, role: "admin" },
      { projection: { _id: 0, cccd: 1, username: 1, email: 1, password: 1, role: 1, fullName: 1, isVerified: 1 } }
    ).limit(2).toArray();
    if (candidates.length !== 1) fail("EXACTLY_ONE_SOURCE_ADMIN_REQUIRED");
    const admin = candidates[0];
    if (!admin.cccd || !admin.username || admin.email !== email || !/^\$2[aby]\$\d{2}\$.{53}$/.test(admin.password || "")) fail("SOURCE_ADMIN_INVALID");
    await target.connect();
    const local = target.db(LOCAL_DB);
    if (local.databaseName !== LOCAL_DB) fail("LOCAL_TARGET_MISMATCH");
    const users = local.collection("users");
    const collisions = await users.find({ $or: [{ email }, { username: admin.username }, { cccd: admin.cccd }] }, { projection: { _id: 1, email: 1, username: 1, cccd: 1, role: 1, password: 1 } }).limit(2).toArray();
    if (collisions.length) {
      const existing = collisions[0];
      if (collisions.length === 1 && existing.email === email && existing.username === admin.username && existing.cccd === admin.cccd && existing.role === "admin" && existing.password === admin.password) {
        console.log(JSON.stringify({ state: "already_available", target: LOCAL_DB, role: "admin", passwordHashMatches: true, atlasWrites: 0 }));
        return;
      }
      fail("LOCAL_ACCOUNT_COLLISION_NO_OVERWRITE");
    }
    if (!apply) {
      console.log(JSON.stringify({ state: "ready_to_copy", target: LOCAL_DB, sourceAdminFound: true, localCollision: false, atlasWrites: 0, localWrites: 0 }));
      return;
    }
    const now = new Date();
    const inserted = await users.insertOne({ cccd: admin.cccd, username: admin.username, email, password: admin.password, role: "admin", fullName: admin.fullName || admin.username, isVerified: Boolean(admin.isVerified), doctorId: null, hospitalId: null, createdAt: now, updatedAt: now });
    const copied = await users.findOne({ _id: inserted.insertedId }, { projection: { email: 1, role: 1, password: 1 } });
    if (copied?.email !== email || copied.role !== "admin" || copied.password !== admin.password) fail("LOCAL_COPY_VERIFICATION_FAILED");
    console.log(JSON.stringify({ state: "copied", target: LOCAL_DB, role: copied.role, passwordHashMatches: true, atlasWrites: 0, localWrites: 1 }));
  } finally { await Promise.allSettled([source.close(), target.close()]); }
}

main().catch(error => { console.error("ADMIN_PREVIEW_COPY_FAILED", error.safeCode || error.code || error.name); process.exitCode = 1; });
