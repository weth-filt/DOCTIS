// Explicitly promote an account the reviewer registered in the isolated preview.
// No account is created, no password is read or changed, and Atlas is unreachable here.
const mongoose = require('mongoose');
const User = require('../models/User');
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !process.argv.includes('--apply')) {
    console.log('Dry run. Register your own account in http://127.0.0.1:5001/register, then use: node backend/scripts/promoteLocalPreviewAdmin.js <your-email> --apply');
    return;
  }
  await mongoose.connect('mongodb://127.0.0.1:27028/doctis_public_preview?replicaSet=doctis-local-review', { serverSelectionTimeoutMS: 3000 });
  const user = await User.findOne({ email, role: { $in: ['user','admin'] } });
  if (!user) throw new Error();
  if (await require('../models/DoctorAssignment').exists({ patientId: user._id, status: 'active' })) throw new Error();
  user.role = 'admin'; await user.save();
  console.log('Local preview account promoted. Sign in again. No production account changed.');
}
main().catch(() => { console.error('Local promotion failed. Verify the registered preview account and local Mongo.'); process.exitCode=1; }).finally(()=>mongoose.disconnect());
