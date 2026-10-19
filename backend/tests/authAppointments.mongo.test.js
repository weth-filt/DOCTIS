const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Reminder = require("../models/Reminder");
const Assignment = require("../models/DoctorAssignment");
const Notification = require("../models/Notification");
const Challenge = require("../models/PasswordResetChallenge");
const { createAppointmentController } = require("../controllers/appointmentController");
const { createPasswordResetController } = require("../services/passwordReset");
const { createAuth } = require("../middlewares/auth");
const response = () => ({ statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } });

// Explicit opt-in, hardcoded isolated local replica set; never read .env/Atlas.
test("isolated Mongo persists reset challenges and concurrent audited cancellation with one durable notification", { skip: process.env.DOCTIS_MONGO_TEST !== "1", timeout: 20000 }, async () => {
  await mongoose.connect("mongodb://127.0.0.1:27028/doctis_auth_appointments_test?replicaSet=doctis-local-review", { serverSelectionTimeoutMS: 3000 });
  const patientId = new mongoose.Types.ObjectId(), doctorId = new mongoose.Types.ObjectId(), otherId = new mongoose.Types.ObjectId();
  const userIds = [patientId, doctorId, otherId];
  let appointment, server;
  const previousSecret = process.env.JWT_SECRET;
  const suffix = String(patientId);
  try {
    await Promise.all([User.init(), Appointment.init(), Reminder.init(), Assignment.init(), Notification.init(), Challenge.init()]);
    const initialHash = await bcrypt.hash("fixture-login-password", 4);
    await User.insertMany(userIds.map((id, index) => ({ _id: id, cccd: `fixture-${suffix}-${index}`, username: `fixture-${suffix}-${index}`, email: `fixture-${suffix}-${index}@example.test`, password: initialHash, role: index === 1 ? "doctor" : "user" })));
    await Assignment.create({ patientId, doctorId, status: "active" });
    process.env.JWT_SECRET = "isolated-local-auth-test-only-secret";
    const app = require("../app");
    server = await new Promise(resolve => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (route, { method = "GET", token, body } = {}) => {
      const result = await fetch(`${base}${route}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: result.status, body: await result.json() };
    };
    const login = async index => {
      const result = await request("/api/auth/login", { method: "POST", body: { email: `fixture-${suffix}-${index}@example.test`, password: "fixture-login-password" } });
      assert.equal(result.status, 200); assert.ok(result.body.token); return result.body.token;
    };
    const [patientToken, doctorToken, otherToken] = await Promise.all([login(0), login(1), login(2)]);
    const initialPatients = await request("/api/doctor/patients", { token: doctorToken });
    assert.equal(initialPatients.status, 200); assert.equal(initialPatients.body.length, 1);
    let mailCalls = 0;
    const reset = createPasswordResetController({ mail: async () => { mailCalls += 1; return { accepted: ["fixture@example.test"] }; }, assertMailConfigured: () => {}, makeCode: () => "123456", hashCode: code => code === "123456" ? "a".repeat(64) : "b".repeat(64), hashPassword: async () => "fixture-new-password-hash" });
    const email = `fixture-${suffix}-0@example.test`;
    const forgot = response(); await reset.forgotPassword({ body: { email } }, forgot);
    assert.equal(forgot.statusCode, 200); assert.equal(mailCalls, 1);
    const stored = await Challenge.findOne({ userId: patientId }).select("+codeHash").lean();
    assert.equal(stored.codeHash, "a".repeat(64)); assert.ok(stored.expiresAt > new Date());
    const resetResult = response(); await reset.resetPassword({ body: { email, otp: "123456", password: "fixture-password", confirmPassword: "fixture-password" } }, resetResult);
    assert.equal(resetResult.statusCode, 200); assert.equal((await User.findById(patientId).lean()).password, "fixture-new-password-hash");
    const repeatedReset = response(); await reset.resetPassword({ body: { email, otp: "123456", password: "fixture-password", confirmPassword: "fixture-password" } }, repeatedReset);
    assert.equal(repeatedReset.statusCode, 400);

    appointment = await Appointment.create({ patientId, doctorId, appointmentDate: new Date(Date.now() + 86400000), status: "approved" });
    await Reminder.create({ userId: patientId, title: "Fixture appointment", time: "08:30", scheduleDate: "2026-10-20", repeat: "once", appointmentId: appointment._id });
    const controller = createAppointmentController();
    const req = actorId => ({ user: { id: String(actorId), role: "user" }, params: { id: String(appointment._id) }, body: { reason: "Lý do hủy trong DB kiểm thử" } });
    const denied = await request(`/api/appointments/cancel/${appointment._id}`, { method: "PUT", token: otherToken, body: req(otherId).body });
    assert.equal(denied.status, 404);
    const [a, b] = await Promise.all([0, 1].map(() => request(`/api/appointments/cancel/${appointment._id}`, { method: "PUT", token: patientToken, body: req(patientId).body })));
    assert.equal(a.status, 200); assert.equal(b.status, 200);
    const cancelled = await Appointment.findById(appointment._id).lean();
    assert.equal(cancelled.status, "cancelled"); assert.equal(String(cancelled.cancelledBy), String(patientId)); assert.ok(cancelled.cancelledAt);
    assert.equal(await Notification.countDocuments({ eventKey: `appointment:${appointment._id}:cancelled` }), 1);
    assert.equal((await Reminder.findOne({ appointmentId: appointment._id }).lean()).enabled, false);

    await User.updateOne({ _id: doctorId }, { $set: { role: "user" } });
    const revoked = await request("/api/doctor/patients", { token: doctorToken });
    assert.equal(revoked.status, 403);
    const auth = createAuth({ verify: () => ({ id: String(doctorId), role: "doctor" }), secret: () => "fixture-secret" });
    const authRequest = { headers: { authorization: "Bearer fixture-token" } }; let continued = false;
    await auth(authRequest, response(), () => { continued = true; });
    assert.equal(continued, true); assert.equal(authRequest.user.role, "user");
    const forbidden = response(); await controller.cancelAppointment({ ...req(doctorId), user: authRequest.user }, forbidden);
    assert.equal(forbidden.statusCode, 404);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
    if (appointment) {
      await Notification.deleteMany({ eventKey: `appointment:${appointment._id}:cancelled` });
      await Reminder.deleteMany({ appointmentId: appointment._id });
      await Appointment.deleteOne({ _id: appointment._id });
    }
    await Challenge.deleteMany({ userId: { $in: userIds } });
    await Assignment.deleteMany({ patientId });
    await User.deleteMany({ _id: { $in: userIds } });
    await mongoose.disconnect();
  }
});
