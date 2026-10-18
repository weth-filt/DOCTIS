const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPatientContextLoader,
  isValidPatientId,
} = require("../services/aiPatientContext");

const USER_ID = "6513bfc2fdbda065e5a00001";
const TODAY = new Date("2026-10-18T10:00:00.000Z");

function createModels({ profile = null, records = [], fail } = {}) {
  const calls = [];
  function query(collection, value) {
    const chain = {};
    for (const method of ["select", "sort", "limit", "lean"]) {
      chain[method] = (...args) => {
        calls.push({ collection, method, args });
        return chain;
      };
    }
    chain.exec = async () => {
      calls.push({ collection, method: "exec", args: [] });
      if (fail === collection) throw new Error("Database unavailable");
      return value;
    };
    return chain;
  }
  return {
    calls,
    UserModel: { findById: (id) => { calls.push({ collection: "users", method: "findById", args: [id] }); return query("users", profile); } },
    HealthModel: { find: (filter) => { calls.push({ collection: "health", method: "find", args: [filter] }); return query("health", records); } },
    now: () => TODAY,
  };
}

test("loads only authenticated patient's projected profile and newest seven measurements with read queries", async () => {
  const models = createModels({
    profile: {
      _id: USER_ID, fullName: "Private name", email: "private@example.test", password: "private password",
      cccd: "private identifier", phone: "private contact", address: "private address", avatar: "private avatar",
      dateOfBirth: "1990-10-18", gender: "Nam", bloodType: "B+", allergies: " Penicillin ",
      medicalHistory: "Đã phẫu thuật", chronicDiseases: "Đái tháo đường type 2", currentMedications: "Thuốc đã lưu",
    },
    records: Array.from({ length: 8 }, (_, index) => ({
      _id: `private record ${index}`, userId: USER_ID, height: 170, weight: 65, bmi: 22.49,
      glucose: 120 - index, systolic: 120, diastolic: 80, heartRate: 75,
      createdAt: new Date(`2026-10-${String(18 - index).padStart(2, "0")}T10:00:00.000Z`),
      prediction: "must not forward", risk: "must not forward", recommendation: "must not forward",
    })),
  });
  const result = await createPatientContextLoader(models)(USER_ID);
  assert.deepEqual(models.calls.find((call) => call.method === "findById").args, [USER_ID]);
  assert.deepEqual(models.calls.find((call) => call.method === "find").args, [{ userId: USER_ID }]);
  assert.deepEqual(models.calls.find((call) => call.method === "sort").args, [{ createdAt: -1, _id: -1 }]);
  assert.deepEqual(models.calls.find((call) => call.method === "limit").args, [7]);
  assert.deepEqual(models.calls.find((call) => call.collection === "users" && call.method === "select").args, [{
    _id: 0, gender: 1, dateOfBirth: 1, allergies: 1, medicalHistory: 1,
    chronicDiseases: 1, currentMedications: 1, bloodType: 1,
  }]);
  assert.deepEqual(models.calls.find((call) => call.collection === "health" && call.method === "select").args, [{
    _id: 0, height: 1, weight: 1, bmi: 1, glucose: 1, systolic: 1, diastolic: 1, heartRate: 1, createdAt: 1,
  }]);
  assert.deepEqual(result.profile, {
    age: 36, gender: "Nam", allergies: "Penicillin", medicalHistory: "Đã phẫu thuật",
    chronicDiseases: "Đái tháo đường type 2", currentMedications: "Thuốc đã lưu", bloodType: "B+",
  });
  assert.equal(result.measurements.length, 7);
  assert.deepEqual(result.measurements[0], {
    height: 170, weight: 65, bmi: 22.49, glucose: 120, systolic: 120,
    diastolic: 80, heartRate: 75, recordedAt: "2026-10-18T10:00:00.000Z",
  });
  const serialized = JSON.stringify(result);
  for (const privateValue of [USER_ID, "private", "1990-10-18", "must not forward"]) assert.ok(!serialized.includes(privateValue));
  assert.equal(models.calls.filter((call) => call.method === "exec").length, 2);
  assert.ok(models.calls.every((call) => ["findById", "find", "select", "sort", "limit", "lean", "exec"].includes(call.method)));
});

test("rejects invalid IDs before constructing a database query", async () => {
  for (const id of [undefined, "", "not-an-id", "abcdefghijklmnopqrstuvwx", "6513bfc2fdbd", { $ne: null }, [USER_ID]]) {
    const models = createModels();
    assert.equal(isValidPatientId(id), false);
    await assert.rejects(createPatientContextLoader(models)(id), { code: "AI_INVALID_USER" });
    assert.equal(models.calls.length, 0);
  }
  assert.equal(isValidPatientId(USER_ID), true);
  assert.equal(isValidPatientId(USER_ID.toUpperCase()), true);
});

test("omits empty, ambiguous, future or invalid birthday values without exposing the birth date", async () => {
  for (const dateOfBirth of ["", "18/10/1990", "10/11/1990", "2001-02-29", "2030-01-01", "not a date"]) {
    const models = createModels({ profile: { dateOfBirth, gender: "", allergies: null, chronicDiseases: [] } });
    assert.deepEqual(await createPatientContextLoader(models)(USER_ID), { profile: {}, measurements: [] });
  }
  for (const [dateOfBirth, age] of [["1990-10-19", 35], ["1990-10-18", 36], ["1990-10-17T00:00:00.000Z", 36], ["2026-10-18", 0]]) {
    const models = createModels({ profile: { dateOfBirth } });
    assert.deepEqual((await createPatientContextLoader(models)(USER_ID)).profile, { age });
  }
});

test("missing profile or clinical values stay missing; no defaults or fake vitals are invented", async () => {
  const models = createModels({ records: [{ glucose: null, bmi: NaN, height: "170", heartRate: Infinity, weight: 0, createdAt: "invalid", userId: USER_ID }] });
  assert.deepEqual(await createPatientContextLoader(models)(USER_ID), { profile: {}, measurements: [{ weight: 0 }] });
});

test("database failures propagate so service can fail explicitly instead of claiming no saved data", async () => {
  for (const collection of ["users", "health"]) {
    const models = createModels({ fail: collection });
    await assert.rejects(createPatientContextLoader(models)(USER_ID), /Database unavailable/);
  }
});
