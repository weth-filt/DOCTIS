const test = require("node:test");
const assert = require("node:assert/strict");
const { createSavedFactsReply: reply } = require("../services/aiSavedFactsReply");
const { planConversation, selectPatientContext } = require("../services/aiConversation");

const record = (recordedAt, values) => ({ recordedAt, ...values });
const context = { profile: { age: 40, bloodType: "B+", allergies: "Trứng", chronicDiseases: "Thông tin đã lưu" }, measurements: [
  record("2026-09-17T18:00:00.000Z", { glucose: 94, systolic: 120, diastolic: 80 }),
  record("2026-09-17T15:00:00.000Z", { glucose: 210, heartRate: 78 }),
  record("2026-09-16T15:00:00.000Z", { glucose: 81 }),
] };
function answer(message, data = context, history = []) {
  const plan = planConversation(message, history);
  return reply(message, plan, selectPatientContext(data, plan));
}

test("latest values retain their actual Vietnam calendar date and unit", () => {
  const value = answer("Đường huyết gần nhất đã lưu bao nhiêu?");
  assert.match(value, /Đường huyết: 94 mg\/dL/);
  assert.match(value, /18\/09\/2026 lúc 01:00:00 \(giờ Việt Nam\)/);
  assert.doesNotMatch(value, /210|17\/09\/2026|ổn định|bình thường/);
});

test("a record-date followup uses the inherited server record, not an assistant value", () => {
  const value = answer("Ngày đo?", context, [
    { role: "user", content: "Đường huyết gần nhất đã lưu bao nhiêu?" },
    { role: "assistant", content: "Glucose 999 ngày 01/01/2000" },
  ]);
  assert.match(value, /18\/09\/2026/);
  assert.doesNotMatch(value, /999|2000/);
});

test("highest and lowest are scoped and never relabeled as latest", () => {
  const highest = answer("Đường huyết cao nhất đã lưu?");
  const lowest = answer("Đường huyết thấp nhất đã lưu?");
  assert.match(highest, /cao nhất trong phần dữ liệu được cung cấp/);
  assert.match(highest, /210 mg\/dL/);
  assert.match(highest, /3 bản ghi đã lưu gần đây/);
  assert.match(highest, /không phải toàn bộ lịch sử/);
  assert.doesNotMatch(highest, /gần nhất|94 mg\/dL/);
  assert.match(lowest, /81 mg\/dL/);
  assert.match(lowest, /thấp nhất trong phần dữ liệu được cung cấp/);
});

test("compound latest and extrema are derived independently from the supplied dated window", () => {
  const value = answer("Đường huyết gần nhất, cao nhất và thấp nhất đã lưu?");
  assert.match(value, /Đường huyết gần nhất: 94 mg\/dL/);
  assert.match(value, /Đường huyết cao nhất trong phần dữ liệu được cung cấp: 210 mg\/dL/);
  assert.match(value, /Đường huyết thấp nhất trong phần dữ liệu được cung cấp: 81 mg\/dL/);
});

test("latest values of multiple metrics retain distinct original timestamps", () => {
  const value = answer("Đường huyết và nhịp tim gần nhất đã lưu?");
  assert.match(value, /18\/09\/2026 lúc 01:00:00.*Đường huyết: 94 mg\/dL/);
  assert.match(value, /17\/09\/2026 lúc 22:00:00.*Nhịp tim: 78 bpm/);
});

test("blood pressure stays within an actual record, with missing components explicit", () => {
  assert.match(answer("Huyết áp gần nhất đã lưu?"), /120\/80 mmHg/);
  const value = answer("Huyết áp gần nhất đã lưu?", { measurements: [
    record("2026-09-18T10:00:00Z", { systolic: 125 }),
    record("2026-09-17T10:00:00Z", { diastolic: 75 }),
  ] });
  assert.match(value, /Huyết áp tâm thu: 125 mmHg/);
  assert.match(value, /chưa có tâm trương trong cùng bản ghi/);
  assert.doesNotMatch(value, /125\/75|125\/0/);
});

test("ambiguous pressure extrema list the dated actual pairs without manufacturing a maximum pair", () => {
  const value = answer("Huyết áp cao nhất đã lưu?", { measurements: [
    record("2026-09-18T10:00:00Z", { systolic: 130, diastolic: 70 }),
    record("2026-09-17T10:00:00Z", { systolic: 120, diastolic: 90 }),
  ] });
  assert.match(value, /130\/70/);
  assert.match(value, /120\/90/);
  assert.match(value, /Chưa xếp hạng/);
  assert.doesNotMatch(value, /130\/90|Giá trị cao nhất/);
});

test("missing and invalid values are scoped as unavailable, never replaced with zero or a number", () => {
  const plan = { kind: "records", topic: "glucose", metrics: ["glucose"], profileFields: [], recordMode: "latest" };
  const value = reply("Đường huyết gần nhất?", plan, { measurements: [
    { recordedAt: null, glucose: 98 }, record("2026-09-18T10:00:00Z", { glucose: "94" }),
    record("2026-09-17T10:00:00Z", { glucose: 0 }), record("2026-09-16T10:00:00Z", { glucose: Infinity }),
  ] });
  assert.match(value, /Chưa có đường huyết kèm ngày đo hợp lệ trong phần dữ liệu được cung cấp/);
  assert.doesNotMatch(value, /98|94|0 mg|1970|chưa có hồ sơ|chưa từng/);
});

test("a day-filtered empty window does not silently fall back to an older reading", () => {
  const plan = planConversation("Đường huyết hôm nay đã lưu bao nhiêu?");
  const value = reply("Đường huyết hôm nay đã lưu bao nhiêu?", plan, selectPatientContext(context, plan, new Date("2026-10-18T01:00:00Z")));
  assert.match(value, /lọc ngày 18\/10\/2026/);
  assert.match(value, /Chưa có đường huyết/);
  assert.doesNotMatch(value, /94 mg|210 mg|81 mg/);
});

test("profile facts have human labels and include missing fields without identity data", () => {
  const plan = { kind: "records", topic: "profile", metrics: [], profileFields: ["age", "bloodType", "allergies", "currentMedications", "email", "password", "fullName"] };
  const value = reply("Cho tôi xem hồ sơ", plan, { profile: { ...context.profile, email: "private@example.test", password: "secret", fullName: "Private identity" } });
  assert.match(value, /Tuổi: 40 tuổi/);
  assert.match(value, /Nhóm máu: B\+/);
  assert.match(value, /Dị ứng: Trứng/);
  assert.match(value, /Thuốc đang dùng: chưa có thông tin trong hồ sơ được cung cấp/);
  assert.doesNotMatch(value, /private|secret|identity/i);
});

test("a combined profile and record report is grounded in both selected sources", () => {
  const value = answer("Cho tôi xem hồ sơ và tất cả chỉ số đã lưu");
  assert.match(value, /Thông tin hồ sơ đã lưu/);
  assert.match(value, /Nhóm máu: B\+/);
  assert.match(value, /Các lần đo đã lưu/);
  assert.match(value, /94 mg\/dL/);
  assert.match(value, /210 mg\/dL/);
  assert.match(value, /120\/80 mmHg/);
});

test("interpretation, mixed advice, symptoms and new topics stay on the conversational path", () => {
  const base = { kind: "records", topic: "glucose", metrics: ["glucose"], profileFields: [], recordMode: "latest" };
  for (const message of ["Đường huyết gần nhất có cao không?", "Đường huyết đã lưu có bình thường không?", "Đường huyết gần nhất và tôi nên làm gì?", "Chỉ số đã lưu ảnh hưởng thế nào?", "Cho tôi xem số đo và thực đơn", "Đường huyết có an toàn không?", "Tôi đang chóng mặt, số đo đã lưu bao nhiêu?"]) {
    assert.equal(reply(message, base, context), null, message);
  }
  for (const plan of [{ ...base, kind: "conversation" }, { ...base, currentSymptoms: true }, { ...base, thirdParty: true }, { ...base, topic: "nutrition" }, { ...base, topic: "activity" }]) {
    assert.equal(reply("Giá trị đã lưu?", plan, context), null);
  }
});

test("no supplied context or no allowed requested fields returns null and does not mutate data", () => {
  const before = JSON.stringify(context);
  assert.equal(reply("Dữ liệu?", { kind: "records", metrics: ["_id", "email"], profileFields: ["password"] }, context), null);
  assert.equal(reply("Dữ liệu?", { kind: "records", metrics: ["glucose"] }, undefined), null);
  answer("Đường huyết gần nhất và cao nhất đã lưu?");
  assert.equal(JSON.stringify(context), before);
});
