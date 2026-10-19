const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const User = require("../models/User");
const Ward = require("../models/Ward");
const Hospital = require("../models/Hospital");
const Intake = require("../models/SupportRequest");
const Assignment = require("../models/DoctorAssignment");
const Notification = require("../models/Notification");
const CarePlan = require("../models/CarePlan");
const Prescription = require("../models/Prescription");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const { registerPatient, createRegistrationService } = require("../services/registrationService");
const care = require("../services/careCoordinationService");
const accounts = require("../services/adminAccountService");
const { createNotification } = require("../services/notificationService");
const { createNotificationController } = require("../controllers/notificationController");
const { createCareTeamController } = require("../controllers/careTeamController");
const { isAssignedDoctor } = require("../middlewares/assignmentAccess");
const ENABLED = process.env.DOCTIS_RUN_COORDINATION_DB_TESTS === "1";
// Deliberately not configurable: this suite must never use backend/.env or the
// deployed Atlas database. All disposable fixtures have a unique test prefix.
const URI = "mongodb://127.0.0.1:27028/doctis_coordination_test?replicaSet=doctis-local-review";
const prefix = `coord-test-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const response = () => ({ statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } });
let ward, hospitalA, hospitalB, admin, admin2, doctorA, doctorB, doctorB2, doctorB3, server, origin, oldSecret, oldVercel, sequence = 0;
async function user(role, extras = {}) { const suffix = `${prefix}-${++sequence}`; return User.create({ cccd: suffix, username: suffix, email: `${suffix}@coordination.test`, password: await bcrypt.hash("fixture-test-password", 6), fullName: "Isolated coordination fixture", role, ...extras }); }
function body(extras = {}) { const suffix = `${prefix}-${++sequence}`; return { cccd: suffix, username: suffix, email: `${suffix}@coordination.test`, password: "fixture-test-password", confirmPassword: "fixture-test-password", wardId: String(ward._id), address: "Địa chỉ chỉ dùng trong cơ sở dữ liệu kiểm thử cô lập", city: "Đà Nẵng", requestId: suffix, ...extras }; }
async function load(id) { return Intake.findById(id).lean().exec(); }
async function register(extras) { return registerPatient(body(extras)); }

before(async () => {
  if (!ENABLED) return;
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await Promise.all([User, Ward, Hospital, Intake, Assignment, Notification].map(Model => Model.init()));
  admin = await user("admin"); admin2 = await user("admin");
  ward = await Ward.create({ code: `${prefix}-ward`, name: `${prefix}-TEST_ONLY_WARD`, city: "Đà Nẵng", sourceUrl: "https://example.test/fixture-not-public-data", active: true, verified: true, verifiedAt: new Date(), verifiedBy: admin._id });
  hospitalA = await Hospital.create({ name: `${prefix}-TEST_ONLY_HOSPITAL_A`, wardId: ward._id, address: "Isolated test address A", phone: "TEST_ONLY", acceptingPatients: true, sourceUrl: "https://example.test/fixture-not-public-data", active: true, verified: true });
  hospitalB = await Hospital.create({ name: `${prefix}-TEST_ONLY_HOSPITAL_B`, wardId: ward._id, address: "Isolated test address B", phone: "TEST_ONLY", acceptingPatients: true, sourceUrl: "https://example.test/fixture-not-public-data", active: true, verified: true });
  doctorA = await user("doctor", { hospitalId: hospitalA._id }); doctorB = await user("doctor", { hospitalId: hospitalB._id }); doctorB2 = await user("doctor", { hospitalId: hospitalB._id }); doctorB3 = await user("doctor", { hospitalId: hospitalB._id });
  oldSecret = process.env.JWT_SECRET; oldVercel = process.env.VERCEL;
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex"); delete process.env.VERCEL;
  const app = require("../app");
  server = await new Promise(resolve => { const listening = app.listen(0, "127.0.0.1", () => resolve(listening)); });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (!ENABLED || mongoose.connection.readyState !== 1) return;
  try {
    const users = await User.find({ username: { $regex: `^${prefix}` } }).select("_id").lean();
    const ids = users.map(value => value._id);
    const intakes = await Intake.find({ patientId: { $in: ids } }).select("_id").lean();
    const assignments = await Assignment.find({ $or: [{ patientId: { $in: ids } }, { doctorId: { $in: ids } }] }).select("_id").lean();
    const conversations = await Conversation.find({ $or: [{ patientId: { $in: ids } }, { doctorId: { $in: ids } }] }).select("_id").lean();
    await Message.deleteMany({ conversationId: { $in: conversations.map(value => value._id) } });
    await Conversation.deleteMany({ _id: { $in: conversations.map(value => value._id) } });
    await CarePlan.deleteMany({ patientId: { $in: ids } });
    await Prescription.deleteMany({ patientId: { $in: ids } });
    await Notification.deleteMany({ $or: [{ recipientId: { $in: ids } }, { entityId: { $in: [...ids, ...intakes.map(value => value._id), ...assignments.map(value => value._id)] } }, { eventKey: { $regex: `^${prefix}` } }] });
    await Assignment.deleteMany({ $or: [{ patientId: { $in: ids } }, { doctorId: { $in: ids } }] });
    await Intake.deleteMany({ patientId: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids } });
    await Hospital.deleteMany({ name: { $regex: `^${prefix}` } });
    await Ward.deleteMany({ code: { $regex: `^${prefix}` } });
  } finally {
    if (server) { const closed = new Promise(resolve => server.close(resolve)); server.closeAllConnections(); await closed; }
    if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
    if (oldVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = oldVercel;
    await mongoose.disconnect();
  }
});

async function http(path, { method = "GET", token, data } = {}) {
  const result = await fetch(`${origin}/api${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data !== undefined ? { "Content-Type": "application/json" } : {}) }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
  return { status: result.status, body: await result.json() };
}
async function login(account) {
  const result = await http("/auth/login", { method: "POST", data: { email: account.email, password: "fixture-test-password" } });
  assert.equal(result.status, 200); assert.equal(typeof result.body.token, "string");
  return result.body.token;
}

test("isolated Mongo: registration atomically creates one user/intake/admin notification and replays safely", { skip: !ENABLED }, async () => {
  const input = body();
  const results = await Promise.all([registerPatient(input), registerPatient(input)]);
  assert.equal(results.filter(value => value.replayed).length, 1);
  assert.equal(String(results[0].user.id), String(results[1].user.id));
  assert.equal(await User.countDocuments({ username: input.username }), 1);
  assert.equal(await Intake.countDocuments({ patientId: results[0].user.id }), 1);
  assert.equal(await Notification.countDocuments({ eventKey: `registration:${results[0].user.id}` }), 1);
  assert.equal((await load(results[0].intakeId)).status, "waiting_hospital");
  assert.equal(await Assignment.countDocuments({ patientId: results[0].user.id }), 0);
  await assert.rejects(registerPatient({ ...input, requestId: `${input.requestId}-another` }), { code: "REGISTRATION_EXISTS" });
});

test("isolated Mongo: missing/out-of-area/unverified wards fail without creating patients", { skip: !ENABLED }, async () => {
  for (const extras of [{ wardId: "" }, { wardId: String(new mongoose.Types.ObjectId()) }, { city: "Hà Nội" }, { address: "" }]) {
    const input = body(extras);
    await assert.rejects(registerPatient(input));
    assert.equal(await User.countDocuments({ username: input.username }), 0);
  }
});

test("isolated Mongo: notification failure rolls back user and intake instead of partial registration", { skip: !ENABLED }, async () => {
  const service = createRegistrationService({ notify: async () => { throw new Error("fixture rollback"); } });
  const input = body();
  await assert.rejects(service(input));
  assert.equal(await User.countDocuments({ username: input.username }), 0);
});

test("isolated Mongo: hospital selection, acceptance and assignment are distinct; outside doctor is rejected", { skip: !ENABLED }, async () => {
  const result = await register(); const id = String(result.intakeId), actorId = String(admin._id);
  let intake = await care.selectHospital(id, { hospitalId: String(hospitalA._id), revision: 0, actorId });
  assert.equal(intake.status, "hospital_selected");
  assert.equal(await Assignment.countDocuments({ patientId: result.user.id, status: "active" }), 0);
  await assert.rejects(care.assign(id, { doctorId: String(doctorA._id), revision: intake.revision, actorId }), { code: "PATIENT_NOT_ACCEPTED" });
  intake = await care.accept(id, { revision: intake.revision, actorId });
  assert.equal(intake.status, "accepted");
  await assert.rejects(care.assign(id, { doctorId: String(doctorB._id), revision: intake.revision, actorId }), { code: "DOCTOR_HOSPITAL_MISMATCH" });
  const assigned = await care.assign(id, { doctorId: String(doctorA._id), revision: intake.revision, actorId });
  assert.equal(assigned.intake.status, "assigned");
  assert.equal(String((await User.findById(result.user.id)).doctorId), String(doctorA._id));
  assert.equal(await isAssignedDoctor(String(doctorA._id), String(result.user.id)), true);
  intake = await care.selectHospital(id, { hospitalId: String(hospitalB._id), revision: assigned.intake.revision, actorId });
  assert.equal(intake.status, "hospital_selected"); assert.equal(intake.acceptedAt, null);
  assert.equal((await User.findById(result.user.id)).doctorId, null);
  assert.equal(await isAssignedDoctor(String(doctorA._id), String(result.user.id)), false);
  assert.equal(await Assignment.countDocuments({ patientId: result.user.id, status: "ended" }), 1);
});

test("isolated Mongo: concurrent assignments use revision CAS and retain exactly one active doctor", { skip: !ENABLED }, async () => {
  const result = await register(), id = String(result.intakeId), actorId = String(admin._id);
  let intake = await care.selectHospital(id, { hospitalId: String(hospitalB._id), revision: 0, actorId });
  intake = await care.accept(id, { revision: intake.revision, actorId });
  const attempts = await Promise.allSettled([doctorB2, doctorB3].map(doctor => care.assign(id, { doctorId: String(doctor._id), revision: intake.revision, actorId })));
  assert.equal(attempts.filter(value => value.status === "fulfilled").length, 1);
  assert.equal(attempts.filter(value => value.status === "rejected").length, 1);
  assert.equal(await Assignment.countDocuments({ patientId: result.user.id, status: "active" }), 1);
  const current = await load(id), patient = await User.findById(result.user.id);
  assert.equal(String(patient.doctorId), String(current.assignedDoctorId));
  await assert.rejects(accounts.updateDoctor(String(current.assignedDoctorId), { hospitalId: String(hospitalA._id) }, actorId), { code: "DOCTOR_HAS_PATIENTS" });
  await accounts.changeRole(String(current.assignedDoctorId), "user", actorId);
  assert.equal(await Assignment.countDocuments({ patientId: result.user.id, status: "active" }), 0);
  assert.equal((await User.findById(result.user.id)).doctorId, null);
  assert.equal((await load(id)).status, "accepted");
});

test("isolated Mongo: legacy address repair preserves active assignment until explicit hospital transition", { skip: !ENABLED }, async () => {
  const patient = await user("user", { address: "Legacy test address", doctorId: doctorA._id });
  await Assignment.create({ patientId: patient._id, doctorId: doctorA._id, assignedBy: admin._id });
  const controller = createCareTeamController();
  const res = response(); await controller.get({ user: { id: String(patient._id), role: "user" } }, res);
  assert.equal(res.body.requiresAddressUpdate, true); assert.equal(res.body.legacyAssignment, true);
  const intake = await care.updateAddress(String(patient._id), { wardId: String(ward._id), address: "Isolated repaired test address", city: "Đà Nẵng" });
  assert.equal(intake.status, "waiting_hospital");
  assert.equal(await Assignment.countDocuments({ patientId: patient._id, status: "active" }), 1);
  await care.selectHospital(String(intake._id), { hospitalId: String(hospitalB._id), revision: intake.revision, actorId: String(admin._id) });
  assert.equal(await Assignment.countDocuments({ patientId: patient._id, status: "active" }), 0);
});

test("isolated Mongo: notifications are durable, idempotent, and broadcast read state is per admin", { skip: !ENABLED }, async () => {
  const input = { recipientRole: "admin", eventKey: `${prefix}:broadcast`, type: "test", title: "Isolated notification fixture" };
  const [one, two] = await Promise.all([createNotification(input), createNotification(input)]);
  assert.equal(String(one._id), String(two._id));
  const controller = createNotificationController();
  const read = response(); await controller.read({ user: { id: String(admin._id), role: "admin" }, params: { id: String(one._id) } }, read);
  assert.ok(read.body.notification.readAt);
  const other = response(); await controller.list({ user: { id: String(admin2._id), role: "admin" }, query: { unread: "true", limit: "100" } }, other);
  assert.ok(other.body.notifications.some(value => value.id === String(one._id) && !value.readAt));
  const stranger = response(); await controller.read({ user: { id: String(doctorA._id), role: "doctor" }, params: { id: String(one._id) } }, stranger);
  assert.equal(stranger.statusCode, 404);
});

test("isolated HTTP: register/login/JWT catalogs, coordination, care team and legacy assignment API enforce workflow", { skip: !ENABLED }, async () => {
  const adminToken = await login(admin), doctorToken = await login(doctorA);
  assert.equal((await http("/admin/intakes")).status, 401);
  const publicWards = await http("/public/wards");
  assert.equal(publicWards.status, 200); assert.ok(publicWards.body.wards.some(value => value.id === String(ward._id)));
  const input = body();
  const created = await http("/auth/register", { method: "POST", data: input });
  assert.equal(created.status, 201);
  assert.equal(created.body.user.role, "user");
  const patientId = String(created.body.user.id), intakeId = String(created.body.intakeId);
  const replay = await http("/auth/register", { method: "POST", data: input });
  assert.equal(replay.status, 200); assert.equal(String(replay.body.user.id), patientId);
  const wrongPasswordReplay = await http("/auth/register", { method: "POST", data: { ...input, password: "different-password", confirmPassword: "different-password" } });
  assert.equal(wrongPasswordReplay.status, 409); assert.equal(wrongPasswordReplay.body.user, undefined);
  const forgedIdentityReplay = await http("/auth/register", { method: "POST", data: { ...input, username: `${input.username}-forged` } });
  assert.equal(forgedIdentityReplay.status, 409); assert.equal(forgedIdentityReplay.body.user, undefined);
  const patientToken = await login(created.body.user);
  assert.equal((await http("/admin/intakes", { token: patientToken })).status, 403);
  assert.equal((await http("/care-team", { token: doctorToken })).status, 403);
  let team = await http("/care-team", { token: patientToken });
  assert.equal(team.status, 200); assert.equal(team.body.status, "waiting_hospital"); assert.equal(team.body.doctor, null); assert.equal(team.body.requiresAddressUpdate, false);
  const listed = await http(`/admin/intakes?search=${encodeURIComponent(input.username)}`, { token: adminToken });
  assert.equal(listed.status, 200); assert.ok(listed.body.intakes.some(value => value.id === intakeId));
  const notifications = await http("/notifications?limit=100", { token: adminToken });
  const registeredNotice = notifications.body.notifications.find(value => value.entityId === intakeId && value.type === "patient_registered");
  assert.ok(registeredNotice);
  assert.equal((await http(`/notifications/${registeredNotice.id}/read`, { method: "PATCH", token: patientToken })).status, 404);
  assert.equal((await http(`/notifications/${registeredNotice.id}/read`, { method: "PATCH", token: adminToken })).status, 200);
  const newWard = await http("/admin/catalog/wards", { method: "POST", token: adminToken, data: { code: `${prefix}-http-ward`, name: `${prefix}-HTTP_TEST_ONLY_WARD`, city: "Đà Nẵng", sourceUrl: "https://example.test/test-only-source", verified: true, active: true } });
  assert.equal(newWard.status, 201);
  const hospital = await http("/admin/catalog/hospitals", { method: "POST", token: adminToken, data: { name: `${prefix}-HTTP_TEST_ONLY_HOSPITAL`, wardId: String(ward._id), address: "Isolated HTTP fixture address", phone: "TEST_ONLY", sourceUrl: "https://example.test/test-only-source", verified: true, active: true, acceptingPatients: true } });
  assert.equal(hospital.status, 201);
  const hospitalId = hospital.body.hospital.id;
  const invalidCatalog = await http("/admin/catalog/hospitals", { method: "POST", token: adminToken, data: { name: "Incomplete fixture", sourceUrl: "javascript:invalid", verified: true } });
  assert.equal(invalidCatalog.status, 400);
  const member = await http(`/admin/doctors/${doctorA._id}`, { method: "PUT", token: adminToken, data: { hospitalId } });
  assert.equal(member.status, 200); assert.equal(String(member.body.doctor.hospitalId), hospitalId);
  const doctorList = await http(`/admin/assignments/doctors?hospitalId=${hospitalId}`, { token: adminToken });
  assert.equal(doctorList.status, 200); assert.ok(doctorList.body.some(value => String(value._id) === String(doctorA._id) && value.role === "doctor" && String(value.hospitalId) === hospitalId));
  const bypass = await http("/admin/assignments/assign", { method: "POST", token: adminToken, data: { patientId, doctorId: String(doctorA._id), revision: 0 } });
  assert.equal(bypass.status, 409); assert.equal(bypass.body.code, "PATIENT_NOT_ACCEPTED");
  let selected = await http(`/admin/intakes/${intakeId}/hospital`, { method: "POST", token: adminToken, data: { hospitalId, revision: 0, reason: "Isolated test selection" } });
  assert.equal(selected.status, 200); assert.equal(selected.body.intake.status, "hospital_selected");
  assert.equal(await Assignment.countDocuments({ patientId, status: "active" }), 0);
  const premature = await http(`/admin/intakes/${intakeId}/assign`, { method: "POST", token: adminToken, data: { doctorId: String(doctorA._id), revision: selected.body.intake.revision } });
  assert.equal(premature.status, 409);
  const accepted = await http(`/admin/intakes/${intakeId}/accept`, { method: "POST", token: adminToken, data: { revision: selected.body.intake.revision, note: "Test hospital acceptance" } });
  assert.equal(accepted.status, 200); assert.equal(accepted.body.intake.status, "accepted");
  const wrongHospital = await http(`/admin/intakes/${intakeId}/assign`, { method: "POST", token: adminToken, data: { doctorId: String(doctorB._id), revision: accepted.body.intake.revision } });
  assert.equal(wrongHospital.status, 409); assert.equal(wrongHospital.body.code, "DOCTOR_HOSPITAL_MISMATCH");
  const assigned = await http("/admin/assignments/assign", { method: "POST", token: adminToken, data: { patientId, doctorId: String(doctorA._id), revision: accepted.body.intake.revision } });
  assert.equal(assigned.status, 201); assert.equal(assigned.body.intake.status, "assigned");
  const patientList = await http("/admin/assignments/patients", { token: adminToken });
  const row = patientList.body.find(value => String(value._id) === patientId);
  assert.equal(String(row.assignedDoctor._id), String(row.currentDoctor._id));
  team = await http("/care-team", { token: patientToken });
  assert.equal(team.body.status, "assigned"); assert.equal(String(team.body.doctor._id), String(doctorA._id)); assert.equal(String(team.body.hospital._id), hospitalId);
  const foreignHealth = await http(`/doctor/patient-health/${patientId}`, { token: await login(doctorB) });
  assert.equal(foreignHealth.status, 403);
  // Existing doctor chat, prescription and clinician-authored care-plan flows
  // use the same new assignment gate. These fixtures are not clinical advice.
  const patientMessage = await http("/messages/send", { method: "POST", token: patientToken, data: { receiverId: String(doctorA._id), content: "Isolated patient chat fixture" } });
  assert.equal(patientMessage.status, 201);
  const doctorMessages = await http(`/messages/patient/${patientId}`, { token: doctorToken });
  assert.equal(doctorMessages.status, 200); assert.ok(doctorMessages.body.some(value => String(value._id) === String(patientMessage.body._id)));
  const doctorMessage = await http("/messages/send", { method: "POST", token: doctorToken, data: { receiverId: patientId, content: "Isolated doctor chat fixture" } });
  assert.equal(doctorMessage.status, 201);
  const patientMessages = await http(`/messages/doctor/${doctorA._id}`, { token: patientToken });
  assert.equal(patientMessages.status, 200); assert.ok(patientMessages.body.some(value => String(value._id) === String(doctorMessage.body._id)));
  assert.equal((await http(`/messages/patient/${patientId}`, { token: await login(doctorB) })).status, 403);
  const days = [{ dayIndex: 1, label: "Ngày kiểm thử cô lập", items: [{ id: "fixture-activity-1", type: "NOTE", time: "08:00", title: "Hoạt động kiểm thử", description: "Dữ liệu kiểm thử, không phải hướng dẫn điều trị." }] }];
  const draftPlan = await http("/care-plans/doctor", { method: "POST", token: doctorToken, data: { patientId, days, status: "draft", doctorNote: "Isolated fixture" } });
  assert.equal(draftPlan.status, 201); assert.equal(draftPlan.body.status, "draft");
  assert.equal((await http("/care-plans/my", { token: patientToken })).status, 404);
  const readDraft = await http(`/care-plans/doctor/patient/${patientId}`, { token: doctorToken });
  assert.equal(readDraft.status, 200); assert.equal(String(readDraft.body._id), String(draftPlan.body._id));
  assert.equal((await http(`/care-plans/doctor/patient/${patientId}`, { token: await login(doctorB) })).status, 403);
  const confirmedPlan = await http("/care-plans/doctor", { method: "POST", token: doctorToken, data: { patientId, days, status: "confirmed", doctorNote: "Isolated confirmed fixture" } });
  assert.equal(confirmedPlan.status, 201); assert.equal(confirmedPlan.body.status, "confirmed"); assert.equal(String(confirmedPlan.body._id), String(draftPlan.body._id));
  const patientPlan = await http("/care-plans/my", { token: patientToken });
  assert.equal(patientPlan.status, 200); assert.equal(patientPlan.body.source, "DOCTOR"); assert.equal(String(patientPlan.body._id), String(confirmedPlan.body._id));
  const prescriptionData = { patientId, title: "TEST_ONLY_PRESCRIPTION", note: "Isolated fixture; not medical advice", medicines: [{ name: "TEST_ONLY_MEDICINE", dosage: "Fixture only", frequency: "Fixture only", times: ["08:00"], mealRelation: "AFTER_MEAL" }] };
  const draftPrescription = await http("/prescriptions/doctor", { method: "POST", token: doctorToken, data: { ...prescriptionData, status: "draft" } });
  assert.equal(draftPrescription.status, 201); assert.equal(draftPrescription.body.status, "draft");
  assert.equal((await http("/prescriptions/my", { token: patientToken })).body.length, 0);
  // This API confirms at creation; it has no separate confirm-existing-draft
  // endpoint. Exercise its actual supported contract without inventing one.
  const confirmedPrescription = await http("/prescriptions/doctor", { method: "POST", token: doctorToken, data: { ...prescriptionData, status: "confirmed" } });
  assert.equal(confirmedPrescription.status, 201); assert.equal(confirmedPrescription.body.status, "confirmed");
  const patientPrescriptions = await http("/prescriptions/my", { token: patientToken });
  assert.equal(patientPrescriptions.status, 200); assert.ok(patientPrescriptions.body.some(value => String(value._id) === String(confirmedPrescription.body._id))); assert.ok(!patientPrescriptions.body.some(value => String(value._id) === String(draftPrescription.body._id)));
  assert.equal((await http("/prescriptions/doctor", { method: "POST", token: await login(doctorB), data: { ...prescriptionData, status: "confirmed" } })).status, 403);
  const syncedPlan = await http("/care-plans/my", { token: patientToken });
  assert.ok(syncedPlan.body.days[0].items.some(value => value.id.startsWith(`PRESCRIPTION:${confirmedPrescription.body._id}:`)));
  const addressUpdate = await http("/care-team/address", { method: "PATCH", token: patientToken, data: { wardId: String(ward._id), address: "Updated isolated fixture address", city: "Đà Nẵng", userId: String(admin._id) } });
  assert.equal(addressUpdate.status, 200); assert.equal(addressUpdate.body.status, "assigned"); assert.equal(String(addressUpdate.body.doctor._id), String(doctorA._id));
  const addressHistory = await load(intakeId);
  assert.equal(String(addressHistory.history.at(-1).doctorId), String(doctorA._id));
  const moved = await http(`/admin/intakes/${intakeId}/hospital`, { method: "POST", token: adminToken, data: { hospitalId: String(hospitalB._id), revision: addressUpdate.body.intake.revision } });
  assert.equal(moved.status, 200); assert.equal(moved.body.intake.status, "hospital_selected");
  assert.equal((await http(`/doctor/patient-health/${patientId}`, { token: doctorToken })).status, 403);
  assert.equal((await http(`/messages/patient/${patientId}`, { token: doctorToken })).status, 403);
  assert.equal((await http(`/care-plans/doctor/patient/${patientId}`, { token: doctorToken })).status, 403);
  assert.equal((await http("/messages/send", { method: "POST", token: doctorToken, data: { receiverId: patientId, content: "Blocked old-doctor fixture" } })).status, 403);
  assert.equal((await http("/prescriptions/doctor", { method: "POST", token: doctorToken, data: { ...prescriptionData, status: "confirmed" } })).status, 403);
  assert.ok((await http("/prescriptions/my", { token: patientToken })).body.some(value => String(value._id) === String(confirmedPrescription.body._id)));
  assert.equal((await http("/care-plans/my", { token: patientToken })).status, 200);
  team = await http("/care-team", { token: patientToken }); assert.equal(team.body.doctor, null); assert.equal(String(team.body.hospital._id), String(hospitalB._id));
  const edited = await http(`/admin/catalog/hospitals/${hospitalId}`, { method: "PATCH", token: adminToken, data: { revision: 0, phone: "TEST_UPDATED" } });
  assert.equal(edited.status, 200);
  assert.equal((await http(`/admin/catalog/hospitals/${hospitalId}`, { method: "PATCH", token: adminToken, data: { revision: 0, phone: "STALE" } })).status, 409);
  assert.equal((await http(`/admin/catalog/hospitals/${hospitalId}`, { method: "DELETE", token: adminToken, data: { revision: edited.body.hospital.revision } })).status, 200);
  assert.equal((await Hospital.findById(hospitalId)).active, false);
  assert.equal((await http(`/admin/catalog/wards/${newWard.body.ward.id}`, { method: "DELETE", token: adminToken, data: { revision: 0 } })).status, 200);
  assert.ok(!(await http("/public/wards")).body.wards.some(value => value.id === newWard.body.ward.id));
  const oldPatient = await user("user", { doctorId: doctorA._id });
  const oldAssignment = await Assignment.create({ patientId: oldPatient._id, doctorId: doctorA._id, assignedBy: admin._id });
  const unassigned = await http("/admin/assignments/unassign", { method: "POST", token: adminToken, data: { patientId: String(oldPatient._id), reason: "Isolated legacy cleanup" } });
  assert.equal(unassigned.status, 200); assert.equal((await Assignment.findById(oldAssignment._id)).status, "ended"); assert.equal((await User.findById(oldPatient._id)).doctorId, null);
  const revokedDoctor = await user("doctor", { hospitalId: hospitalB._id });
  const oldToken = await login(revokedDoctor);
  const revoke = await http(`/admin/change-role/${revokedDoctor._id}`, { method: "PUT", token: adminToken, data: { role: "user" } });
  assert.equal(revoke.status, 200); assert.equal(revoke.body.user.password, undefined);
  assert.equal((await http("/doctor/patients", { token: oldToken })).status, 403);
});
