const test = require("node:test");
const assert = require("node:assert/strict");
const { createAuth } = require("../middlewares/auth");
const { createPasswordResetController } = require("../services/passwordReset");
const { createAssignmentAccess } = require("../middlewares/assignmentAccess");
const generateOTP = require("../utils/generateOTP");
const USER = "6513bfc2fdbda065e5a00001", DOCTOR = "6513bfc2fdbda065e5a00002", HOSPITAL = "6513bfc2fdbda065e5a00003", INTAKE = "6513bfc2fdbda065e5a00004";
const at = new Date("2026-10-19T08:00:00Z");
const query = value => ({ select() { return this; }, lean: async () => value, populate() { return this; } });
const response = () => ({ statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } });

test("JWT authorization refreshes role on every request, preserving login sessions while revoking doctor permission", async () => {
  let role = "doctor", reads = 0;
  const middleware = createAuth({ UserModel: { findById() { reads += 1; return query({ _id: DOCTOR, role }); } }, verify: () => ({ id: DOCTOR, role: "doctor", iat: 1 }), secret: () => "test-only-secret" });
  let passed = 0;
  const first = { headers: { authorization: "Bearer fixture-token" } };
  await middleware(first, response(), () => { passed += 1; });
  assert.equal(first.user.role, "doctor");
  role = "user";
  const second = { headers: { authorization: "Bearer same-fixture-token" } };
  await middleware(second, response(), () => { passed += 1; });
  assert.equal(second.user.role, "user");
  assert.equal(passed, 2); assert.equal(reads, 2);
});

test("JWT rejects deleted accounts and fails closed when current role cannot be read", async () => {
  for (const mode of ["deleted", "offline"]) {
    const middleware = createAuth({ UserModel: { findById() { if (mode === "offline") throw new Error("fixture offline"); return query(null); } }, verify: () => ({ id: USER }), secret: () => "fixture" });
    const res = response(); let passed = false;
    await middleware({ headers: { authorization: "Bearer fixture" } }, res, () => { passed = true; });
    assert.equal(passed, false); assert.equal(res.statusCode, mode === "deleted" ? 401 : 503);
  }
});

function resetFixture({ configured = true, mailFails = false } = {}) {
  let challenge = null, passwordWrites = 0, mailCalls = 0;
  const hashCode = code => code === "123456" ? "a".repeat(64) : "b".repeat(64);
  const UserModel = { findOne: () => query({ _id: USER, email: "fixture@example.test" }), updateOne: async (filter, update) => { passwordWrites += 1; assert.equal(update.$set.password, "bcrypt-fixture"); return { matchedCount: 1 }; } };
  const ChallengeModel = {
    init: async () => {},
    findOne: () => query(challenge ? { ...challenge } : null),
    findOneAndUpdate: async (filter, update, options) => {
      if (options?.upsert) {
        if (challenge && challenge.sentAt > filter.$or[0].sentAt.$lte) throw Object.assign(new Error("fixture unique"), { code: 11000 });
        challenge = { _id: INTAKE, userId: USER, ...update.$set }; return { ...challenge };
      }
      if (!challenge || challenge.consumedAt || challenge.codeHash !== filter.codeHash || challenge.expiresAt <= filter.expiresAt.$gt || challenge.attempts >= filter.attempts.$lt) return null;
      Object.assign(challenge, update.$set); return { ...challenge };
    },
    updateOne: async (filter, update) => { if (challenge && challenge.codeHash === filter.codeHash && !challenge.consumedAt) challenge.attempts += update.$inc.attempts; },
    deleteOne: async filter => { if (challenge?._id === filter._id && challenge.codeHash === filter.codeHash) challenge = null; },
  };
  const controller = createPasswordResetController({ UserModel, ChallengeModel, hashCode, now: () => at, makeCode: () => "123456", hashPassword: async () => "bcrypt-fixture", assertMailConfigured: () => { if (!configured) throw Object.assign(new Error("not configured"), { status: 503 }); }, mail: async input => { mailCalls += 1; assert.match(input.text, /123456/); if (mailFails) throw new Error("fixture email failure"); return { accepted: ["fixture@example.test"] }; } });
  const req = body => ({ body: { email: "Fixture@example.test", ...body } });
  return { controller, req, challenge: () => challenge, setChallenge: value => { challenge = value; }, writes: () => passwordWrites, mails: () => mailCalls };
}

test("reset sends a crypto OTP only through configured mail and stores only its digest", async () => {
  const f = resetFixture(), res = response();
  await f.controller.forgotPassword(f.req({}), res);
  assert.equal(res.statusCode, 200); assert.equal(f.mails(), 1);
  assert.equal(f.challenge().codeHash, "a".repeat(64));
  assert.equal(f.challenge().expiresAt.getTime() - at.getTime(), 300000);
  assert.equal(JSON.stringify(res.body).includes("123456"), false);
  for (let i = 0; i < 30; i++) assert.match(generateOTP(), /^[1-9]\d{5}$/);
});

test("missing email configuration and delivery rejection never report success or retain an undelivered code", async () => {
  for (const options of [{ configured: false }, { mailFails: true }]) {
    const f = resetFixture(options), res = response();
    await f.controller.forgotPassword(f.req({}), res);
    assert.equal(res.statusCode, 503); assert.equal(f.challenge(), null);
    if (options.configured === false) assert.equal(f.mails(), 0);
  }
});

test("OTP resend is throttled and wrong codes are limited to five attempts", async () => {
  const f = resetFixture();
  await f.controller.forgotPassword(f.req({}), response());
  const repeated = response(); await f.controller.forgotPassword(f.req({}), repeated);
  assert.equal(repeated.statusCode, 429); assert.equal(f.mails(), 1);
  for (let i = 0; i < 5; i++) { const res = response(); await f.controller.verifyOTP(f.req({ otp: "999999" }), res); assert.equal(res.statusCode, 400); }
  const res = response(); await f.controller.verifyOTP(f.req({ otp: "123456" }), res);
  assert.equal(res.statusCode, 400); assert.equal(f.challenge().attempts, 5);
});

test("missing or expired OTP expiry cannot authorize password reset", async () => {
  for (const expiresAt of [null, new Date(at.getTime() - 1), new Date("invalid")]) {
    const f = resetFixture(); f.setChallenge({ _id: INTAKE, codeHash: "a".repeat(64), expiresAt, attempts: 0 });
    const res = response(); await f.controller.resetPassword(f.req({ otp: "123456", password: "fixture-password", confirmPassword: "fixture-password" }), res);
    assert.equal(res.statusCode, 400); assert.equal(f.writes(), 0);
  }
});

test("password reset requires confirmation and consumes its OTP exactly once without revoking all sessions", async () => {
  const f = resetFixture(); await f.controller.forgotPassword(f.req({}), response());
  const missing = response(); await f.controller.resetPassword(f.req({ otp: "123456", password: "fixture-password" }), missing);
  assert.equal(missing.statusCode, 400); assert.equal(f.writes(), 0);
  const valid = f.req({ otp: "123456", password: "fixture-password", confirmPassword: "fixture-password" });
  const first = response(); await f.controller.resetPassword(valid, first);
  const second = response(); await f.controller.resetPassword(valid, second);
  assert.equal(first.statusCode, 200); assert.equal(second.statusCode, 400); assert.equal(f.writes(), 1);
});

test("legacy assignments require a current doctor role, coordinated assignments also require accepted matching intake", async () => {
  let role = "doctor", intakeDoctor = DOCTOR, acceptedAt = at, active = true;
  const row = { doctorId: DOCTOR, patientId: USER };
  const access = createAssignmentAccess({ AssignmentModel: { findOne: () => query(row) }, UserModel: { findOne: () => query(role === "doctor" ? { _id: DOCTOR, role, hospitalId: HOSPITAL } : null) }, HospitalModel: { findOne: () => query(active ? { _id: HOSPITAL } : null) }, SupportRequestModel: { findOne: () => query({ hospitalId: HOSPITAL, assignedDoctorId: intakeDoctor, acceptedAt }) } });
  assert.equal(await access.isAssignedDoctor(DOCTOR, USER), true);
  role = "user"; assert.equal(await access.isAssignedDoctor(DOCTOR, USER), false);
  role = "doctor"; row.hospitalId = HOSPITAL; row.supportRequestId = INTAKE;
  assert.equal(await access.isAssignedDoctor(DOCTOR, USER), true);
  intakeDoctor = USER; assert.equal(await access.isAssignedDoctor(DOCTOR, USER), false);
  intakeDoctor = DOCTOR; acceptedAt = null; assert.equal(await access.isAssignedDoctor(DOCTOR, USER), false);
  acceptedAt = at; active = false; assert.equal(await access.isAssignedDoctor(DOCTOR, USER), false);
});
