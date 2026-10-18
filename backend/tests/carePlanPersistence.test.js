const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const CarePlan = require("../models/CarePlan");
const { createCarePlanPersistence, normalizeDays, safeSnapshot, dateIsValid, localDate, presentPlan } = require("../services/carePlanPersistence");

// Synthetic records and injected model doubles only; never connect to MongoDB.
const OWNER = "6513bfc2fdbda065e5a00001", OTHER = "6513bfc2fdbda065e5a00002", PLAN = "6513bfc2fdbda065e5a00003";
const TODAY = new Date("2026-10-18T18:30:00.000Z");
const clone = value => value === undefined ? undefined : structuredClone(value);
const days = () => Array.from({ length: 7 }, (_, dayIndex) => ({ dayIndex, label: `Ngày ${dayIndex + 1}`, items: [{ id: "shared-id-per-day", type: "MEAL", time: "07:00", title: "Bữa sáng kiểm thử", description: "Nội dung kiểm thử" }] }));
const stored = extras => ({ _id: PLAN, patientId: OWNER, source: "AI", status: "draft", isCurrent: true, archivedAt: null, revision: 0, schemaVersion: 2, createdAt: new Date("2026-10-17T08:00:00Z"), days: normalizeDays(days(), "2026-10-17"), ...extras });

function equal(left, right) { return left instanceof Date || right instanceof Date ? new Date(left).getTime() === new Date(right).getTime() : String(left) === String(right); }
function matches(row, filter) {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === "$or") return condition.some(part => matches(row, part));
    if (key === "days") return row.days.some(day => day.dayIndex === condition.$elemMatch.dayIndex && day.items.some(item => item.id === condition.$elemMatch["items.id"]));
    const value = row[key];
    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      if ("$ne" in condition) return !equal(value, condition.$ne);
      if ("$exists" in condition) return (value !== undefined) === condition.$exists;
    }
    return condition === null ? value == null : equal(value, condition);
  });
}
function fixture(initial = []) {
  const db = clone(initial), calls = [];
  let sequence = 10, failCreate = false, failUpdate = false;
  const query = (rows, single = false) => {
    let data = rows;
    const chain = {
      select(fields) { calls.push({ op: "select", fields }); return chain; },
      sort(order) { data.sort((a, b) => { for (const [key, direction] of Object.entries(order)) { if (a[key] > b[key]) return direction; if (a[key] < b[key]) return -direction; } return 0; }); return chain; },
      limit(count) { data = data.slice(0, count); return chain; },
      async lean() { return clone(single ? data[0] || null : data); },
    };
    return chain;
  };
  const CarePlanModel = {
    findOne(filter) { calls.push({ op: "findOne", filter }); return query(db.filter(row => matches(row, filter)), true); },
    find(filter) { calls.push({ op: "find", filter }); return query(db.filter(row => matches(row, filter))); },
    async create(data) {
      calls.push({ op: "create", data: clone(data) });
      if (failCreate) { failCreate = false; throw new Error("Private database failure"); }
      if (db.some(row => row.patientId === data.patientId && row.source === "AI" && row.isCurrent === true)) { const error = new Error("Duplicate current plan"); error.code = 11000; throw error; }
      const row = { ...clone(data), _id: `6513bfc2fdbda065e5a${String(sequence++).padStart(5, "0")}`, createdAt: TODAY };
      db.push(row); return clone(row);
    },
    async findOneAndUpdate(filter, update, options) {
      calls.push({ op: "update", filter: clone(filter), update: clone(update), options: clone(options) });
      if (failUpdate) { failUpdate = false; return null; }
      const row = db.find(item => matches(item, filter));
      if (!row) return null;
      for (const [key, value] of Object.entries(update.$set || {})) {
        if (key.startsWith("days.$[day].items.$[item].")) {
          const dayIndex = options.arrayFilters.find(item => "day.dayIndex" in item)["day.dayIndex"];
          const itemId = options.arrayFilters.find(item => "item.id" in item)["item.id"];
          row.days.find(day => day.dayIndex === dayIndex).items.find(item => item.id === itemId)[key.split(".").at(-1)] = value;
        } else row[key] = value;
      }
      for (const [key, value] of Object.entries(update.$inc || {})) row[key] = (row[key] || 0) + value;
      return clone(row);
    },
  };
  const service = createCarePlanPersistence({ CarePlanModel,
    UserModel: { findById(id) { calls.push({ op: "user", id }); return query([{ _id: id, role: "user", doctorId: OTHER, allergies: "Dị ứng kiểm thử", chronicDiseases: "Bệnh nền kiểm thử", email: "private@example.test" }], true); } },
    HealthModel: { findOne(filter) { calls.push({ op: "health", filter }); return query([{ _id: PLAN, glucose: 101, bmi: 22, systolic: 120, diastolic: 80, createdAt: new Date("2026-10-18T10:00:00Z"), userId: OWNER, privateExtra: "must not snapshot" }], true); } },
    PrescriptionModel: { find(filter) { calls.push({ op: "prescriptions", filter }); return query([{ _id: OTHER, name: "must not snapshot" }]); } },
    now: () => TODAY,
  });
  return { service, db, calls, failNextCreate() { failCreate = true; }, failNextUpdate() { failUpdate = true; } };
}

test("patient plan normalization dates seven days and ignores forged completion/clinical metadata", () => {
  const input = days(); input[0].items[0].done = true; input[0].items[0].completedAt = TODAY; input[0].items[0].doctorNote = "forged";
  const normalized = normalizeDays(input, "2026-10-19");
  assert.equal(normalized[0].date, "2026-10-19"); assert.equal(normalized.at(-1).date, "2026-10-25");
  assert.equal(normalized[0].items[0].done, false); assert.equal(normalized[0].items[0].completedAt, null);
  assert.ok(!("doctorNote" in normalized[0].items[0]));
  assert.equal(normalized[0].items[0].id, normalized[1].items[0].id, "IDs are scoped to a day");
});
test("validation rejects malformed dates, duplicate day-item ids and invalid times without writes", async () => {
  assert.equal(dateIsValid("2026-02-30"), false); assert.equal(dateIsValid("2024-02-29"), true);
  assert.equal(localDate(TODAY), "2026-10-19");
  for (const invalid of [[], null, [{ dayIndex: 1, items: [] }], [{ dayIndex: 0, items: [{ id: "x", time: "25:00", title: "x" }] }]]) assert.throws(() => normalizeDays(invalid, "2026-10-19"));
  const duplicate = days(); duplicate[0].items.push({ ...duplicate[0].items[0] });
  assert.throws(() => normalizeDays(duplicate, "2026-10-19"), { code: "INVALID_ITEM" });
  const f = fixture(); await assert.rejects(f.service.create(OWNER, { days: days(), startDate: "2026-02-30" }), { code: "INVALID_START_DATE" });
  assert.equal(f.calls.length, 0);
});
test("snapshot uses explicit clinical allowlists without identities, zeros or malformed timestamps", () => {
  const snapshot = safeSnapshot({ allergies: "Trứng", chronicDiseases: "Đái tháo đường", email: "private@example.test", phone: "private", cccd: "private" }, { _id: PLAN, glucose: 100, bmi: 0, heartRate: Infinity, createdAt: null, privateField: "private" }, [{ _id: OTHER, note: "private" }], TODAY);
  assert.deepEqual(Object.keys(snapshot.profile).sort(), ["allergies", "chronicDiseases"]);
  assert.deepEqual(snapshot.health, { recordId: PLAN, glucose: 100 });
  assert.deepEqual(snapshot.prescriptionIds, [OTHER]); assert.ok(!JSON.stringify(snapshot).includes("private"));
});
test("new patient plan is a server-owned draft snapshot, not a client supplied snapshot", async () => {
  const f = fixture();
  const plan = await f.service.create(OWNER, { patientId: OTHER, source: "DOCTOR", status: "confirmed", inputSnapshot: { glucose: 9999 }, days: days() });
  assert.equal(plan.patientId, OWNER); assert.equal(plan.source, "AI"); assert.equal(plan.status, "draft"); assert.equal(plan.startDate, "2026-10-19");
  assert.equal(plan.inputSnapshot.health.glucose, 101); assert.equal(plan.revision, 0); assert.equal(plan.isCurrent, true);
  assert.ok(!JSON.stringify(plan.inputSnapshot).includes("private"));
  assert.deepEqual(f.calls.find(call => call.op === "health").filter, { userId: OWNER });
  assert.deepEqual(f.calls.find(call => call.op === "prescriptions").filter, { patientId: OWNER, status: "confirmed" });
});
test("optional matching basedOn records the same saved inputs used by the client", async () => {
  const f = fixture();
  const plan = await f.service.create(OWNER, { days: days(), basedOn: { healthRecordId: PLAN, allergies: "  Dị ứng kiểm thử  ", chronicDiseases: "Bệnh nền kiểm thử" } });
  assert.equal(plan.inputSnapshot.health.recordId, PLAN);
  assert.equal(plan.inputSnapshot.profile.allergies, "Dị ứng kiểm thử");
  assert.equal(f.db.length, 1);
});
test("stale health record, allergy or chronic-disease input returns INPUTS_CHANGED before archiving", async () => {
  for (const difference of [{ healthRecordId: OTHER }, { allergies: "Hồ sơ cũ" }, { chronicDiseases: "Bệnh nền cũ" }]) {
    const f = fixture([stored()]);
    const basedOn = { healthRecordId: PLAN, allergies: "Dị ứng kiểm thử", chronicDiseases: "Bệnh nền kiểm thử", ...difference };
    await assert.rejects(f.service.create(OWNER, { days: days(), confirmReplace: true, replacePlanId: PLAN, expectedRevision: 0, basedOn }), { status: 409, code: "INPUTS_CHANGED" });
    assert.equal(f.db.length, 1); assert.equal(f.db[0].isCurrent, true); assert.equal(f.db[0].archivedAt, null);
    assert.equal(f.db[0].revision, 0);
    assert.ok(!f.calls.some(call => call.op === "create" || call.op === "update"));
  }
});
test("malformed basedOn values are rejected before model reads or writes", async () => {
  for (const basedOn of [null, [], { healthRecordId: { $ne: null }, allergies: "", chronicDiseases: "" }, { healthRecordId: PLAN, allergies: [], chronicDiseases: "" }]) {
    const f = fixture();
    await assert.rejects(f.service.create(OWNER, { days: days(), basedOn }), { code: "INVALID_BASED_ON", status: 400 });
    assert.equal(f.calls.length, 0);
  }
});
test("doctor medication source is assigned only for the patient's server-confirmed prescription IDs", async () => {
  const f = fixture(), input = days();
  input[0].items = [
    { id: "verified-med", type: "MEDICATION", time: "07:00", title: "Thuốc theo đơn", prescriptionId: OTHER, medicineId: "medicine-1", source: "AI" },
    { id: "foreign-med", type: "MEDICATION", time: "07:00", title: "Nội dung không xác minh", prescriptionId: PLAN, source: "DOCTOR" },
    { id: "forged-meal", type: "MEAL", time: "07:00", title: "Bữa sáng", prescriptionId: OTHER, source: "DOCTOR" },
  ];
  const plan = await f.service.create(OWNER, { days: input });
  assert.equal(plan.days[0].items[0].source, "DOCTOR"); assert.equal(plan.days[0].items[0].prescriptionId, OTHER);
  for (const item of plan.days[0].items.slice(1)) { assert.equal(item.source, ""); assert.equal(item.prescriptionId, undefined); }
});
test("a current plan requires explicit matching replacement confirmation and current revision", async () => {
  const f = fixture([stored()]);
  for (const extra of [{}, { confirmReplace: true, replacePlanId: OTHER }, { confirmReplace: true, replacePlanId: PLAN, expectedRevision: 9 }]) {
    await assert.rejects(f.service.create(OWNER, { days: days(), ...extra }), error => error.status === 409);
  }
  assert.equal(f.db.length, 1); assert.ok(!f.calls.some(call => call.op === "create" || call.op === "update"));
});
test("replacement archives instead of overwriting old content, completion and snapshots", async () => {
  const old = stored(); old.days[0].items[0].done = true; old.days[0].items[0].completedAt = new Date("2026-10-17T08:00:00Z");
  const f = fixture([old]);
  const next = await f.service.create(OWNER, { days: days(), confirmReplace: true, replacePlanId: PLAN, expectedRevision: 0 });
  assert.equal(f.db.length, 2); assert.notEqual(next._id, PLAN); assert.equal(next.previousPlanId, PLAN);
  assert.equal(f.db[0].isCurrent, false); assert.equal(f.db[0].days[0].items[0].done, true); assert.ok(f.db[0].archivedAt);
  assert.equal(next.days[0].items[0].done, false);
  assert.deepEqual((await f.service.history(OWNER)).map(plan => plan._id), [PLAN]);
});
test("atomic item update scopes duplicate item ids by day and survives a fresh read", async () => {
  const f = fixture([stored()]);
  const updated = await f.service.toggle(OWNER, "shared-id-per-day", { planId: PLAN, dayIndex: 3, done: true, expectedRevision: 0 });
  assert.equal(updated.revision, 1); assert.equal(updated.days[3].items[0].done, true); assert.equal(updated.days[2].items[0].done, false);
  assert.equal((await f.service.current(OWNER)).days[3].items[0].done, true);
  const undone = await f.service.toggle(OWNER, "shared-id-per-day", { planId: PLAN, dayIndex: 3, done: false, expectedRevision: 1 });
  assert.equal(undone.days[3].items[0].completedAt, null); assert.equal(undone.revision, 2);
  const write = f.calls.find(call => call.op === "update");
  assert.equal(write.filter.patientId, OWNER); assert.equal(write.options.upsert, undefined);
});
test("completion rejects foreign/archived plans, bad bodies and stale revisions", async () => {
  const f = fixture([stored(), stored({ _id: OTHER, patientId: OTHER })]);
  for (const extra of [{ planId: OTHER }, { done: "true" }, { expectedRevision: 2 }, { dayIndex: 30 }]) await assert.rejects(f.service.toggle(OWNER, "shared-id-per-day", { planId: PLAN, dayIndex: 0, done: true, expectedRevision: 0, ...extra }));
  f.db[0].isCurrent = false; f.db[0].archivedAt = TODAY;
  await assert.rejects(f.service.toggle(OWNER, "shared-id-per-day", { planId: PLAN, dayIndex: 0, done: true, expectedRevision: 0 }), { code: "PLAN_NOT_CURRENT" });
  assert.ok(!f.calls.some(call => call.op === "update"));
});
test("compare-and-set loss returns conflict without falsely marking success", async () => {
  const f = fixture([stored()]); f.failNextUpdate();
  await assert.rejects(f.service.toggle(OWNER, "shared-id-per-day", { planId: PLAN, dayIndex: 0, done: true, expectedRevision: 0 }), { code: "REVISION_CONFLICT" });
  assert.equal(f.db[0].days[0].items[0].done, false);
});
test("failed replacement insertion restores the old current plan without deleting history", async () => {
  const f = fixture([stored()]); f.failNextCreate();
  await assert.rejects(f.service.create(OWNER, { days: days(), confirmReplace: true, replacePlanId: PLAN, expectedRevision: 0 }));
  assert.equal(f.db.length, 1); assert.equal(f.db[0].isCurrent, true); assert.equal(f.db[0].archivedAt, null);
  assert.equal(f.db[0].revision, 2);
});
test("a concurrent creation unique-key error becomes a retryable conflict", async () => {
  const f = fixture();
  const first = f.service.create(OWNER, { days: days() });
  const second = f.service.create(OWNER, { days: days() });
  const results = await Promise.allSettled([first, second]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.find(result => result.status === "rejected").reason.code, "CURRENT_PLAN_EXISTS");
  assert.equal(f.db.filter(plan => plan.isCurrent).length, 1);
});
test("legacy docs are read with completion defaults and revision zero without invented dates or writes", async () => {
  const old = stored(); delete old.revision; delete old.schemaVersion; delete old.startDate; delete old.isCurrent;
  delete old.days[0].items[0].done; delete old.days[0].items[0].completedAt;
  const f = fixture([old]); const plan = await f.service.current(OWNER);
  assert.equal(plan.revision, 0); assert.equal(plan.legacy, true); assert.equal(plan.days[0].items[0].done, false); assert.equal(plan.startDate, undefined);
  assert.ok(!f.calls.some(call => call.op === "create" || call.op === "update"));
  assert.equal(presentPlan(null), null);
});
test("CarePlan model preserves doctor payloads and declares only a partial current-AI unique index", () => {
  const plan = new CarePlan({ patientId: OWNER, doctorId: OTHER, source: "DOCTOR", status: "confirmed", days: days(), doctorNote: "Lưu ý kiểm thử", confirmedAt: TODAY });
  assert.equal(plan.validateSync(), undefined); assert.equal(plan.source, "DOCTOR"); assert.equal(plan.status, "confirmed");
  assert.equal(plan.days[0].items[0].done, false); assert.equal(plan.days[0].items[0].completedAt, null);
  const index = CarePlan.schema.indexes().find(([, options]) => options.name === "one_current_generated_care_plan");
  assert.equal(index[1].unique, true); assert.deepEqual(index[1].partialFilterExpression, { source: "AI", isCurrent: true });
});

function controllerWith(service) {
  const controller = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../controllers/carePlanController.js"), "utf8"), { exports: controller, console: { error() {} }, require(name) {
    if (name === "../models/CarePlan" || name === "../models/User") return {};
    if (name === "../services/carePlanPersistence") return { createCarePlanPersistence: () => service };
    if (name === "../middlewares/assignmentAccess") return { isValidObjectId: id => typeof id === "string" && /^[a-f\d]{24}$/i.test(id), requireAssignedDoctor: async () => false };
    throw new Error(`Unexpected dependency ${name}`);
  } });
  return controller;
}
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
test("new controller endpoints enforce patient role, bind token identity, and return generic internal failures", async () => {
  const calls = [];
  const controller = controllerWith({ current: async id => { calls.push(id); return null; }, create: async (id, body) => { calls.push({ id, body }); return { revision: 0 }; }, history: async () => { throw new Error("private database details"); }, toggle: async () => ({}) });
  for (const role of [undefined, "doctor", "admin"]) { const res = response(); await controller.getMyCurrentGeneratedCarePlan({ user: { id: OWNER, role } }, res); assert.equal(res.statusCode, 403); }
  const res = response(); await controller.saveMyGeneratedCarePlan({ user: { id: OWNER, role: "user" }, body: { patientId: OTHER, days: [] } }, res);
  assert.equal(res.statusCode, 201); assert.equal(calls[0].id, OWNER);
  const failed = response(); await controller.getMyCarePlanHistory({ user: { id: OWNER, role: "user" } }, failed);
  assert.equal(failed.statusCode, 500); assert.ok(!JSON.stringify(failed.body).includes("private"));
});
