const test = require("node:test");
const assert = require("node:assert/strict");
const { createAppointmentController } = require("../controllers/appointmentController");
const { normalizeReminder, createReminderController } = require("../controllers/reminderController");
const { createReminderRunner, vietnamClock } = require("../services/cronService");
const USER = "6513bfc2fdbda065e5a00001", DOCTOR = "6513bfc2fdbda065e5a00002", OTHER = "6513bfc2fdbda065e5a00003", ID = "6513bfc2fdbda065e5a00004";
const at = new Date("2026-10-19T01:30:00Z");
const query = value => ({ select() { return this; }, lean: async () => value, populate() { return this; } });
const response = () => ({ statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } });

function fixture({ status = "approved", allowed = true, locked = false } = {}) {
  const appointment = { _id: ID, patientId: USER, doctorId: DOCTOR, appointmentDate: new Date("2026-10-20T08:00:00Z"), type: "Tái khám", status, operationLock: locked ? "active-email" : null, operationLockAt: locked ? at : null };
  const notifications = new Map(); let remindersDisabled = 0, mailCalls = 0;
  const matchesOwner = filter => (!filter.patientId || String(filter.patientId) === USER) && (!filter.doctorId || String(filter.doctorId) === DOCTOR);
  const AppointmentModel = {
    findOne: filter => query(matchesOwner(filter) ? { ...appointment } : null),
    findOneAndUpdate(filter, update) {
      const statusMatches = !filter.status || (typeof filter.status === "object" ? filter.status.$in.includes(appointment.status) : filter.status === appointment.status);
      if (!matchesOwner(filter) || !statusMatches || (filter.$or && appointment.operationLock && appointment.operationLockAt >= filter.$or[1].operationLockAt.$lt)) return query(null);
      Object.assign(appointment, update.$set); return query({ ...appointment });
    },
    updateOne: async (filter, update) => { if (!filter.operationLock || filter.operationLock === appointment.operationLock) Object.assign(appointment, update.$set); },
  };
  const access = { isValidObjectId: id => /^[a-f\d]{24}$/i.test(String(id)), requireAssignedDoctor: async (req, res) => { if (!allowed) res.status(403).json({ code: "PATIENT_NOT_ASSIGNED" }); return allowed; }, getAssignedPatientIds: async () => allowed ? [USER] : [] };
  const controller = createAppointmentController({ AppointmentModel, ReminderModel: { updateMany: async () => { remindersDisabled += 1; } }, UserModel: {}, assignment: access, notify: async value => { if (!notifications.has(value.eventKey)) notifications.set(value.eventKey, value); }, mail: async () => { mailCalls += 1; }, now: () => at });
  const request = (role = "user", id = role === "doctor" ? DOCTOR : USER) => ({ user: { id, role }, params: { id: ID }, body: { reason: "Không thể đến đúng giờ" } });
  return { controller, request, appointment, notifications, remindersDisabled: () => remindersDisabled, mailCalls: () => mailCalls };
}

test("patient owner and assigned doctor can cancel pending or approved appointments with audited metadata", async () => {
  for (const role of ["user", "doctor"]) for (const status of ["pending", "approved"]) {
    const f = fixture({ status }), res = response(); await f.controller.cancelAppointment(f.request(role), res);
    assert.equal(res.statusCode, 200); assert.equal(f.appointment.status, "cancelled");
    assert.equal(f.appointment.cancelledByRole, role); assert.equal(f.appointment.cancelledBy, role === "doctor" ? DOCTOR : USER);
    assert.equal(f.appointment.cancelledAt, at); assert.equal(f.appointment.cancelReason, "Không thể đến đúng giờ");
    assert.equal(f.notifications.size, 1); assert.equal([...f.notifications.values()][0].recipientId, role === "doctor" ? USER : DOCTOR);
    assert.equal(f.remindersDisabled(), 1);
  }
});

test("cancellation rejects another patient, unassigned doctor, admin, completed state and absent reason", async () => {
  for (const scenario of ["other", "unassigned", "admin", "completed", "reason"]) {
    const f = fixture({ status: scenario === "completed" ? "completed" : "pending", allowed: scenario !== "unassigned" });
    const req = f.request(scenario === "unassigned" ? "doctor" : scenario === "admin" ? "admin" : "user", scenario === "other" ? OTHER : undefined);
    if (scenario === "reason") req.body.reason = " ";
    const res = response(); await f.controller.cancelAppointment(req, res);
    assert.ok(res.statusCode >= 400, scenario); assert.notEqual(f.appointment.status, "cancelled"); assert.equal(f.notifications.size, 0);
  }
});

test("simultaneous and repeated cancellation retain one event and the first reason", async () => {
  const f = fixture(), first = response(), second = response();
  const later = f.request(); later.body.reason = "Lý do từ lượt gửi sau";
  await Promise.all([f.controller.cancelAppointment(f.request(), first), f.controller.cancelAppointment(later, second)]);
  const retry = response(); await f.controller.cancelAppointment(later, retry);
  assert.equal(first.statusCode, 200); assert.equal(second.statusCode, 200); assert.equal(retry.body.alreadyCancelled, true);
  assert.equal(f.notifications.size, 1); assert.equal(f.appointment.cancelReason, "Không thể đến đúng giờ");
});

test("completed or cancelled appointments do not send email reminders", async () => {
  for (const status of ["completed", "cancelled"]) {
    const f = fixture({ status }), res = response(); await f.controller.remindAppointment(f.request("doctor"), res);
    assert.equal(res.statusCode, 409); assert.equal(f.mailCalls(), 0);
  }
});

test("cancellation cannot race through an active email operation", async () => {
  const f = fixture({ locked: true }), res = response(); await f.controller.cancelAppointment(f.request(), res);
  assert.equal(res.statusCode, 409); assert.equal(f.appointment.status, "approved"); assert.equal(f.notifications.size, 0);
});

test("reminder validation distinguishes one date from daily and rejects clock/date overflow", () => {
  assert.equal(normalizeReminder({ title: "Đi bộ", time: "08:30", scheduleDate: "2026-10-20" }, { source: "CARE_PLAN" }).repeat, "once");
  assert.equal(normalizeReminder({ title: "Uống nước", time: "08:30" }).repeat, "daily");
  for (const body of [{ title: "Đi bộ", time: "25:70" }, { title: "Đi bộ", time: "08:30", scheduleDate: "2026-02-30" }, { title: "Đi bộ", time: "08:30", repeat: "once" }]) assert.throws(() => normalizeReminder(body));
  assert.throws(() => normalizeReminder({ title: "Đi bộ", time: "08:30" }, { source: "CARE_PLAN" }));
  const safe = normalizeReminder({ title: "Đi bộ", time: "08:30", userId: OTHER, createdByDoctorId: OTHER, enabled: true });
  assert.equal(safe.userId, undefined); assert.equal(safe.createdByDoctorId, undefined);
});

test("Vietnam reminder clock is independent of the process timezone including midnight", () => {
  assert.deepEqual(vietnamClock(at), { today: "2026-10-19", time: "08:30" });
  assert.deepEqual(vietnamClock(new Date("2026-10-18T17:05:00Z")), { today: "2026-10-19", time: "00:05" });
});

function runnerFixture({ source = "USER", scheduleDate = null, appointmentId = null, appointmentStatus = "approved", result = true } = {}) {
  const row = { _id: ID, source, scheduleDate, appointmentId, enabled: true, repeat: scheduleDate ? "once" : "daily", time: "08:30", userId: { _id: USER, email: "fixture@example.test", username: "Fixture" }, lastSentDate: null, sendLeaseUntil: null };
  let sends = 0;
  const ReminderModel = {
    find: () => query(row.enabled ? [{ ...row }] : []),
    findOneAndUpdate(filter, update) {
      if (!row.enabled || row.lastSentDate === filter.lastSentDate.$ne || row.sendLeaseUntil && row.sendLeaseUntil >= at) return query(null);
      Object.assign(row, update.$set); return query({ ...row });
    },
    updateOne: async (filter, update) => { if (!filter.sendLease || filter.sendLease === row.sendLease) Object.assign(row, update.$set); },
  };
  const AppointmentModel = { findOneAndUpdate: () => query(["pending", "approved"].includes(appointmentStatus) ? { _id: appointmentId } : null), exists: async () => ["pending", "approved"].includes(appointmentStatus), updateOne: async () => {} };
  const run = createReminderRunner({ ReminderModel, AppointmentModel, now: () => at, mail: async () => { sends += 1; if (result instanceof Error) throw result; return result; } });
  return { run, row, sends: () => sends };
}

test("scheduler only marks confirmed sends and retries failures without recording false success", async () => {
  for (const result of [false, new Error("fixture mail failure")]) {
    const f = runnerFixture({ result }); const report = await f.run();
    assert.equal(report.failed, 1); assert.equal(report.sent, 0); assert.equal(f.row.lastSentDate, null); assert.equal(f.row.sendLease, null);
  }
});

test("one-date reminders disable after one send and same-day repeated ticks cannot duplicate", async () => {
  const f = runnerFixture({ source: "CARE_PLAN", scheduleDate: "2026-10-19" });
  await Promise.all([f.run(), f.run()]); await f.run();
  assert.equal(f.sends(), 1); assert.equal(f.row.lastSentDate, "2026-10-19"); assert.equal(f.row.enabled, false);
});

test("scheduler skips missing-date care activities and cancelled appointment reminders", async () => {
  for (const options of [{ source: "CARE_PLAN" }, { scheduleDate: "2026-10-20" }, { scheduleDate: "2026-10-19", appointmentId: OTHER, appointmentStatus: "cancelled" }]) {
    const f = runnerFixture(options); await f.run(); assert.equal(f.sends(), 0); assert.equal(f.row.lastSentDate, null);
    if (options.appointmentStatus === "cancelled") assert.equal(f.row.enabled, false);
  }
});

test("doctor reminder creation checks active assignment before reading or storing a patient", async () => {
  let writes = 0;
  const controller = createReminderController({ ReminderModel: { create: async () => { writes += 1; } }, UserModel: { findOne: () => { throw new Error("Must not read"); } }, access: { requireAssignedDoctor: async (req, res) => { res.status(403).json({ msg: "No assignment" }); return false; } } });
  const res = response(); await controller.doctorCreate({ user: { id: DOCTOR, role: "doctor" }, body: { patientId: USER, title: "Đi bộ", time: "08:30" } }, res);
  assert.equal(res.statusCode, 403); assert.equal(writes, 0);
});
