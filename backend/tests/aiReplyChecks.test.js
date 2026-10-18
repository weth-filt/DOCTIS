const { test } = require("node:test");
const assert = require("node:assert/strict");
const { assessReply, clarifyMissingReading } = require("../services/aiReplyChecks");

// Pure guard tests with synthetic text only. No database, HTTP client, provider,
// credentials, or model is used. Passing these is not a clinical quality review.
const check = (reply, message = "Gợi ý bữa tối", allergies = "", plan = {}) =>
  assessReply(reply, message, { profile: { allergies } }, { topic: "nutrition", thirdParty: false, ...plan });

test("unexpected CJK is flagged, while CJK in the user's own question is not newly assigned", () => {
  assert.equal(check("Xin chào 你好.").length, 1);
  assert.equal(check("Xin chào 你好.", "你好").length, 0);
});

for (const reply of [
  "120/80 là huyết áp thấp.",
  "120/80 mmHg được coi là huyết áp thấp.",
  "120/80 là huyết áp thấp, không cần đo lại.",
]) {
  test(`flags the observed incorrect affirmative classification: ${reply}`, () => {
    assert.equal(check(reply, "Huyết áp là gì?", "", { topic: "bloodPressure" }).length, 1);
  });
}

for (const reply of [
  "120/80 không phải là huyết áp thấp.",
  "120/80 khác với huyết áp thấp.",
  "Không thể kết luận huyết áp thấp từ câu hỏi này.",
]) {
  test(`does not flag a negated or distinguishing pressure statement: ${reply}`, () => {
    assert.equal(check(reply, "Huyết áp là gì?", "", { topic: "bloodPressure" }).length, 0);
  });
}

for (const reply of [
  "Bạn có thể ăn trứng.",
  "Hãy thêm lòng trắng vào bữa tối.",
  "Có thể dùng lòng đỏ.",
  "Gợi ý món salad kèm mayonnaise.",
  "Không nên bỏ bữa, hãy ăn trứng.",
]) {
  test(`flags a known egg allergen recommendation: ${reply}`, () => {
    assert.equal(check(reply, "Gợi ý bữa tối", "Trứng").length, 1);
  });
}

test("does not mistake tiệt trùng or chỉnh sửa for egg or milk allergens", () => {
  assert.equal(check("Nên dùng thực phẩm đã được tiệt trùng.", "Gợi ý bữa tối", "Trứng").length, 0);
  assert.equal(check("Bạn có thể dùng chức năng chỉnh sửa hồ sơ.", "Tôi muốn sửa hồ sơ", "Sữa", { topic: "allergies" }).length, 0);
});

test("avoiding a known allergen is not treated as recommending it", () => {
  assert.equal(check("Hãy tránh ăn trứng.", "Gợi ý bữa tối", "Trứng").length, 0);
  assert.equal(check("Không nên dùng mayonnaise.", "Gợi ý bữa tối", "Trứng").length, 0);
});

test("an unsupported assignment of milk allergy is flagged, while milk advice is not equated with egg allergy", () => {
  assert.equal(check("Bạn dị ứng sữa.", "Gợi ý bữa tối", "Trứng").length, 1);
  assert.equal(check("Bạn có thể uống sữa.", "Gợi ý bữa tối", "Trứng").length, 0);
  assert.equal(check("Người dị ứng sữa cần đọc nhãn thực phẩm.", "Dị ứng sữa là gì?", "Trứng", { topic: "allergies" }).length, 0);
});

test("an affirmative current allergy report is used even before a profile save", () => {
  const message = "Tôi dị ứng trứng, tối nên ăn gì?";
  assert.equal(check("Bạn có thể ăn trứng.", message, "Không có").length, 1);
  assert.equal(check("Vì bạn dị ứng trứng, hãy tránh món này.", message, "Không có").length, 0);
});

test("hypothetical or explicitly denied allergies are not converted to confirmed patient facts", () => {
  assert.equal(check("Bạn dị ứng trứng.", "Nếu tôi dị ứng trứng thì cần lưu ý gì?", "Không có").length, 1);
  assert.equal(check("Bạn dị ứng trứng.", "Tôi có dị ứng trứng không?", "Không có").length, 1);
  assert.equal(check("Bạn có thể ăn trứng.", "Tôi không dị ứng trứng.", "Không dị ứng trứng").length, 0);
});

test("the user's own allergy is not applied to a third party", () => {
  assert.equal(check("Người đó có thể ăn trứng.", "Gợi ý món ăn cho bạn tôi", "Trứng", { thirdParty: true }).length, 0);
});

test("a current denial does not silently erase a recorded positive allergy", () => {
  assert.equal(check("Bạn có thể ăn trứng.", "Tôi không dị ứng trứng.", "Trứng").length, 1);
});

test("current low pressure without a reading needs a concrete clarifying question", () => {
  const plan = { topic: "bloodPressure", currentSymptoms: true };
  const clarified = clarifyMissingReading("Bạn có chóng mặt không?", "Tôi đang bị huyết áp thấp", plan);
  assert.match(clarified, /số trên\/số dưới/);
  const question = "Huyết áp bạn vừa đo là bao nhiêu, có chóng mặt không?";
  assert.equal(clarifyMissingReading(question, "Tôi đang bị huyết áp thấp", plan), question);
  const response = "Bạn nên liên hệ bác sĩ nếu còn hoa mắt.";
  assert.equal(clarifyMissingReading(response, "Tôi vừa đo 88/58 và hoa mắt", plan), response);
});

test("metformin meal timing cannot contradict the supplied medication reference", () => {
  assert.equal(check("Metformin nên uống trước khi ăn.", "Thuốc này uống lúc nào?", "", { topic: "medication" }).length, 1);
  assert.equal(check("Metformin thường uống cùng bữa ăn theo đơn.", "Thuốc này uống lúc nào?", "", { topic: "medication" }).length, 0);
  assert.equal(check("Không nên uống metformin lúc đói; làm theo hướng dẫn trên đơn.", "Thuốc này uống lúc nào?", "", { topic: "medication" }).length, 0);
});

test("egg allergy is not a reason to assign a milk restriction", () => {
  assert.ok(check("Uống sữa đậu nành vì bạn dị ứng trứng, không dùng sữa bò hoặc phô mai.", "Gợi ý bữa tối", "Trứng").length >= 1);
  assert.equal(check("Vì bạn dị ứng trứng, hãy tránh trứng. Bạn có thể dùng sữa không đường nếu dung nạp được.", "Gợi ý bữa tối", "Trứng").length, 0);
});

test("current pressure symptoms do not imply an unsupervised salt treatment", () => {
  const plan = { topic: "bloodPressure", currentSymptoms: true };
  assert.equal(check("Bạn nên ăn thực phẩm giàu natri.", "Tôi vừa đo 88/58 và hoa mắt", "", plan).length, 1);
  assert.equal(check("Không tự tăng muối nếu chưa trao đổi với bác sĩ.", "Tôi vừa đo 88/58 và hoa mắt", "", plan).length, 0);
});

test("general type 2 tracking does not invent an unrequested daily urine test", () => {
  assert.equal(check("Bạn nên đo đường trong nước tiểu hằng ngày.", "Đái tháo đường loại 2 cần theo dõi gì?", "", { topic: "general" }).length, 1);
  assert.equal(check("Ghi lại glucose máu và giờ đo theo kế hoạch cá nhân.", "Đái tháo đường loại 2 cần theo dõi gì?", "", { topic: "general" }).length, 0);
});

test("a plant-based drink is not automatically a dairy allergen", () => {
  assert.equal(check("Bạn có thể uống sữa đậu nành không đường.", "Gợi ý bữa tối", "Sữa bò").length, 0);
  assert.ok(check("Bạn có thể uống sữa đậu nành không đường.", "Gợi ý bữa tối", "Đậu nành").length > 0);
});

test("uncertain metformin instructions are referred to the actual prescription", () => {
  assert.ok(check("Metformin thường dùng cùng bữa ăn. Nếu không chắc, hãy uống sau bữa ăn đầu tiên.", "Thuốc này uống lúc nào?", "", { topic: "medication" }).length > 0);
  assert.equal(check("Metformin thường dùng cùng bữa ăn. Nếu chưa rõ dạng thuốc, hãy hỏi dược sĩ về đơn.", "Thuốc này uống lúc nào?", "", { topic: "medication" }).length, 0);
});

test("cooking is not presented as removing a reported allergen", () => {
  assert.ok(check("Hãy nấu kỹ các thành phần để giảm nguy cơ dị ứng.", "Gợi ý bữa tối", "Trứng").length > 0);
  assert.equal(check("Nấu chín không có nghĩa thực phẩm chứa trứng an toàn với bạn.", "Gợi ý bữa tối", "Trứng").length, 0);
});

test("symptomatic low pressure does not invent a waiting period before care", () => {
  const plan = { topic: "bloodPressure", currentSymptoms: true };
  assert.ok(check("Nếu không cải thiện sau 10 phút, hãy đến bệnh viện.", "Tôi vừa đo 88/58 và hoa mắt", "", plan).length > 0);
  assert.equal(check("Nếu triệu chứng kéo dài hoặc nặng lên, cần liên hệ nhân viên y tế.", "Tôi vừa đo 88/58 và hoa mắt", "", plan).length, 0);
});
