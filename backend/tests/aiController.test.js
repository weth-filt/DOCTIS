const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const USER_ID = "6513bfc2fdbda065e5a00001";

function loadController({ chatAI, loadPatientContext = async () => ({ profile: {}, measurements: [] }), consumeAIMessage = async () => {} }) {
  const controller = {};
  const source = fs.readFileSync(path.join(__dirname, "../controllers/aiController.js"), "utf8");
  vm.runInNewContext(source, {
    exports: controller,
    console: { error() {} },
    require: (moduleName) => {
      if (moduleName === "../services/aiService") return { chatAI };
      if (moduleName === "../services/aiRateLimit") return { consumeAIMessage };
      if (moduleName === "../services/aiPatientContext") return {
        loadPatientContext,
        isValidPatientId: (value) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value),
      };
      throw new Error(`Unexpected dependency: ${moduleName}`);
    },
  });
  return controller;
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("controller binds lazy context to authenticated identity and ignores body identity, context and vitals", async () => {
  let received;
  const contextIds = [];
  const controller = loadController({
    chatAI: async (input) => { received = input; return { reply: "Trả lời thật", provider: "test" }; },
    loadPatientContext: async (id) => { contextIds.push(id); return { profile: { bloodType: "B+" }, measurements: [] }; },
  });
  const history = [{ role: "user", content: "Lần hỏi trước" }];
  const res = response();
  await controller.analyze({ user: { id: USER_ID }, body: {
    message: "Tôi đã lưu chỉ số nào?", history,
    userId: "6513bfc2fdbda065e5a99999", id: "forged", context: { glucose: 999 },
    patientContext: { gender: "forged" }, glucose: 999, bmi: 999, bloodPressure: "999/999",
    loadPatientContext: () => { throw new Error("Forged function should never be used"); },
  } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.reply, "Trả lời thật");
  assert.deepEqual(Object.keys(received).sort(), ["history", "loadPatientContext", "message"]);
  assert.equal(received.history, history);
  assert.equal(received.message, "Tôi đã lưu chỉ số nào?");
  assert.equal(contextIds.length, 0, "context is not read until the service opts in");
  assert.deepEqual(await received.loadPatientContext(), { profile: { bloodType: "B+" }, measurements: [] });
  assert.deepEqual(contextIds, [USER_ID]);
});

test("missing authentication or invalid authenticated ID cannot call the model or read context", async () => {
  let serviceCalls = 0;
  const controller = loadController({ chatAI: async () => { serviceCalls += 1; throw new Error("Unexpected model call"); } });
  for (const user of [undefined, {}, { id: "" }]) {
    const res = response();
    await controller.analyze({ user, body: { message: "Câu hỏi", userId: USER_ID } }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, "AI_UNAUTHORIZED");
  }
  for (const id of ["invalid", { $ne: null }, [USER_ID], "a".repeat(23)]) {
    const res = response();
    await controller.analyze({ user: { id }, body: { message: "Câu hỏi", userId: USER_ID } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, "AI_INVALID_USER");
  }
  assert.equal(serviceCalls, 0);
});

test("context failure uses explicit 503; existing validation and provider errors retain response shape", async () => {
  for (const [code, status] of [["AI_CONTEXT_UNAVAILABLE", 503], ["AI_NOT_CONFIGURED", 503], ["AI_EMPTY_MESSAGE", 400], ["AI_MESSAGE_TOO_LONG", 400], ["AI_UNAVAILABLE", 502]]) {
    const controller = loadController({ chatAI: async () => { const error = new Error("Thông báo an toàn"); error.code = code; throw error; } });
    const res = response();
    await controller.analyze({ user: { id: USER_ID }, body: { message: "Câu hỏi" } }, res);
    assert.equal(res.statusCode, status);
    assert.equal(res.body.code, code);
    assert.equal(res.body.msg, "Thông báo an toàn");
    assert.deepEqual(Object.keys(res.body).sort(), ["code", "msg"]);
  }
});

test("non-service exceptions return generic error without exposing details", async () => {
  const controller = loadController({ chatAI: async () => { throw new Error("Private connection details"); } });
  const res = response();
  await controller.analyze({ user: { id: USER_ID }, body: { message: "Câu hỏi" } }, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.code, "AI_UNAVAILABLE");
  assert.ok(!res.body.msg.includes("Private connection details"));
});

test("database error codes do not become public AI errors or reveal internal details", async () => {
  const controller = loadController({ chatAI: async () => { throw Object.assign(new Error("PRIVATE_DATABASE_DETAIL"), { code: 11000 }); } });
  const res = response();
  await controller.analyze({ user: { id: USER_ID }, body: { message: "Câu hỏi" } }, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.code, "AI_UNAVAILABLE");
  assert.ok(!JSON.stringify(res.body).includes("PRIVATE_DATABASE_DETAIL"));
});

test("legacy analyze shares the server-side quota and validates before reserving a slot", async () => {
  let calls = 0, generations = 0;
  const controller = loadController({ chatAI: async () => { generations++; return { reply: "Test" }; }, consumeAIMessage: async () => { calls++; throw Object.assign(new Error("Quota reached"), { code: "AI_RATE_LIMITED", status: 429, retryAfterSeconds: 60 }); } });
  const empty = response();
  await controller.analyze({ user: { id: USER_ID }, body: { message: "" } }, empty);
  assert.equal(empty.statusCode, 400);
  assert.equal(calls, 0);
  const full = response();
  await controller.analyze({ user: { id: USER_ID }, body: { message: "Câu hỏi" } }, full);
  assert.equal(full.statusCode, 429);
  assert.equal(full.body.retryAfterSeconds, 60);
  assert.equal(generations, 0);
  assert.equal(calls, 1);
});
