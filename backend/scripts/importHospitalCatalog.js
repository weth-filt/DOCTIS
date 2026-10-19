/*
 * Offline by default. --apply requires an explicitly supplied CATALOG_MONGO_URI.
 * Never loads .env, overwrites an existing hospital, enables admissions, creates
 * doctors, or turns a historical district/ward into an assumed current ward.
 */
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Hospital = require('../models/Hospital');
const Ward = require('../models/Ward');
const catalog = require('../data/danang-hospitals.source.json');
const wardCatalog = require('../data/danang-wards.verified.json');

function fail(code) {
  const error = new Error(code);
  error.catalogCode = code;
  throw error;
}

function validUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function normalized(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function facilityId(sourceKey) {
  // Immutable namespace + source keys give repeat runs the same Mongo _id.
  const value = `doctis:hospital-catalog:v1:${catalog.datasetId}:${sourceKey}`;
  return new mongoose.Types.ObjectId(crypto.createHash('sha256').update(value).digest('hex').slice(0, 24));
}

function validateCatalog() {
  if (catalog.city !== 'Đà Nẵng' || !validUrl(catalog.sourceUrl)
      || !Array.isArray(catalog.facilities) || catalog.facilities.length !== 25
      || catalog.policy.acceptingPatients !== false) fail('INVALID_DATASET');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(catalog.checkedAt)
      || !Number.isFinite(Date.parse(catalog.checkedAt))) fail('INVALID_CHECK_DATE');
  const knownWards = new Set(wardCatalog.wards.map(row => row.code));
  const keys = new Set();
  const names = new Set();
  for (const row of catalog.facilities) {
    if (!/^[a-z0-9-]+$/.test(row.sourceKey) || keys.has(row.sourceKey)) fail('DUPLICATE_OR_INVALID_SOURCE_KEY');
    keys.add(row.sourceKey);
    if (!['hospital', 'clinic'].includes(row.facilityType)) fail('INVALID_FACILITY_TYPE');
    for (const [field, max] of [['name', 200], ['address', 500], ['sourceName', 200], ['sourceAddress', 500]]) {
      if (typeof row[field] !== 'string' || !row[field].trim() || row[field].length > max) fail('INVALID_FACILITY_FIELD');
    }
    if (names.has(normalized(row.name))) fail('DUPLICATE_FACILITY_NAME');
    names.add(normalized(row.name));
    if (typeof row.phone !== 'string' || row.phone.length > 100
        || (row.phone && !/^[0-9+() .\/-]+$/.test(row.phone))) fail('INVALID_PUBLIC_PHONE');
    if (!validUrl(row.sourceUrl) || !Array.isArray(row.aliases)
        || row.aliases.some(value => typeof value !== 'string' || value.length > 200)) fail('INVALID_PROVENANCE');
    if (!Array.isArray(row.verificationSources) || row.verificationSources.some(source => !validUrl(source.url)
        || !Array.isArray(source.fields))) fail('INVALID_VERIFICATION_SOURCE');
    if (row.verified === true) {
      const provenFields = new Set(row.verificationSources.flatMap(source => source.fields));
      if (!knownWards.has(row.wardCode) || !row.phone
          || !['name', 'address', 'currentWard', 'phone'].every(field => provenFields.has(field))) fail('INCOMPLETE_VERIFIED_FACILITY');
    } else if (row.verified !== false || row.wardCode !== null) {
      fail('DRAFT_MUST_NOT_ASSUME_WARD');
    }
  }
}

function sameFacility(existing, candidate) {
  const aliases = new Set([candidate.name, candidate.sourceName, ...candidate.aliases].map(normalized));
  if (aliases.has(normalized(existing.name))) return true;
  const phone = String(candidate.phone).replace(/\D/g, '');
  return phone.length >= 8 && phone === String(existing.phone || '').replace(/\D/g, '')
    && [candidate.address, candidate.sourceAddress].some(address => normalized(address) === normalized(existing.address));
}

function payloadFor(row, wards) {
  const ward = row.verified ? wards.get(row.wardCode) : null;
  if (row.verified && !ward) fail('VERIFIED_WARD_MISSING_IMPORT_WARDS_FIRST');
  return {
    _id: facilityId(row.sourceKey),
    name: row.name,
    address: row.address,
    wardId: ward ? ward._id : null,
    city: catalog.city,
    phone: row.phone,
    acceptingPatients: false,
    sourceUrl: row.sourceUrl,
    verified: row.verified,
    verifiedAt: row.verified ? new Date(`${catalog.checkedAt}T00:00:00.000Z`) : null,
    verifiedBy: null,
    active: true,
    revision: 0,
  };
}

async function main() {
  if (process.argv.slice(2).some(arg => !['--apply', '--help'].includes(arg))) fail('UNKNOWN_ARGUMENT');
  if (process.argv.includes('--help')) {
    console.log('node backend/scripts/importHospitalCatalog.js [--apply]\nDefault: offline review only. Apply requires CATALOG_MONGO_URI; no .env is loaded.');
    return;
  }
  validateCatalog();
  const verified = catalog.facilities.filter(row => row.verified).length;
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({
      dryRun: true,
      datasetId: catalog.datasetId,
      sourceUrl: catalog.sourceUrl,
      total: catalog.facilities.length,
      verified,
      drafts: catalog.facilities.length - verified,
      excludedUnits: catalog.excludedSourceUnits.length,
      acceptingPatients: false,
      action: 'Insert missing facilities only; preserve all existing records and relationships.',
      review: catalog.facilities.filter(row => !row.verified).map(row => ({ sourceKey: row.sourceKey, reasons: row.reviewNotes })),
    }, null, 2));
    return;
  }

  const uri = process.env.CATALOG_MONGO_URI;
  if (!uri) fail('EXPLICIT_CATALOG_MONGO_URI_REQUIRED');
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
  const requiredCodes = catalog.facilities.filter(row => row.verified).map(row => row.wardCode);
  const wards = new Map((await Ward.find({ code: { $in: requiredCodes }, city: catalog.city, verified: true, active: true })
    .select('_id code').lean()).map(row => [row.code, row]));
  // Preflight every payload before the first insert: an absent ward or old schema
  // fails the batch without partially inserting unsupported drafts.
  const entries = catalog.facilities.map(row => ({ row, payload: payloadFor(row, wards) }));
  for (const entry of entries) await new Hospital(entry.payload).validate();

  const existing = await Hospital.find({ city: catalog.city }).select('_id name address phone').lean();
  let inserted = 0;
  let preserved = 0;
  const rows = [];
  for (const { row, payload } of entries) {
    const match = existing.find(item => String(item._id) === String(payload._id) || sameFacility(item, row));
    if (match) {
      preserved += 1;
      rows.push({ sourceKey: row.sourceKey, action: 'preserved-existing', id: String(match._id) });
      continue;
    }
    try {
      const created = await Hospital.create(payload);
      existing.push(created.toObject());
      inserted += 1;
      rows.push({ sourceKey: row.sourceKey, action: 'inserted', id: String(created._id), verified: payload.verified });
    } catch (error) {
      // Concurrent runs use the same _id; never mutate a row inserted elsewhere.
      if (error.code !== 11000 || !await Hospital.exists({ _id: payload._id })) throw error;
      preserved += 1;
      rows.push({ sourceKey: row.sourceKey, action: 'preserved-concurrent-import', id: String(payload._id) });
    }
  }
  console.log(JSON.stringify({ datasetId: catalog.datasetId, inserted, preserved, total: entries.length, acceptingPatients: false, rows }, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    // Only controlled codes are emitted; never URI, credentials, database errors,
    // source documents, users or health data.
    console.error(`Hospital catalog import failed: ${error.catalogCode || 'IMPORT_FAILED'}. Connection details are not logged.`);
    process.exitCode = 1;
  }).finally(() => mongoose.disconnect());
}

module.exports = { validateCatalog, facilityId, sameFacility, payloadFor };
