// No dotenv loading. Dry run is offline; changes require --apply and an explicit URI.
const mongoose = require('mongoose');
const Ward = require('../models/Ward');
const catalog = require('../data/danang-wards.verified.json');
async function main() {
  if (new Set(catalog.wards.map(row => row.code)).size !== catalog.wards.length) throw new Error('Duplicate catalog code');
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({ dryRun: true, count: catalog.wards.length, city: catalog.city, sourceUrl: catalog.sourceUrl, action: 'Insert missing codes only. Existing records will be preserved.' }, null, 2));
    return;
  }
  const uri = process.env.CATALOG_MONGO_URI;
  if (!uri) throw new Error('CATALOG_MONGO_URI must be supplied explicitly. No .env is loaded.');
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
  let inserted = 0;
  for (const row of catalog.wards) {
    const result = await Ward.updateOne({ code: row.code }, { $setOnInsert: { ...row, city: catalog.city, sourceUrl: catalog.sourceUrl, verified: true, verifiedAt: new Date(catalog.checkedAt), active: true, revision: 0 } }, { upsert: true, runValidators: true });
    inserted += result.upsertedCount;
  }
  console.log(JSON.stringify({ inserted, preserved: catalog.wards.length - inserted }));
}
main().catch(() => { console.error('Catalog import failed. Connection details are not logged.'); process.exitCode = 1; }).finally(() => mongoose.disconnect());
