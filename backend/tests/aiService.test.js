const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { chatAI } = require("../services/aiService");
const ALL_CONTEXT_QUESTION = "Giải thích hồ sơ và tất cả chỉ số đã lưu";
const geminiInstruction = request => request.body.systemInstruction.parts.map(part => part.text).join("\n");

// Test-only fixtures. No database or real provider is contacted by this suite.
const keys = ["AI_PROVIDER", "GEMINI_API_KEY", "GOOGLE_API_KEY", "GEMINI_MODEL", "OLLAMA_MODEL", "OLLAMA_HOST", "OLLAMA_NUM_CTX", "VERCEL"];
let originalEnv;
let originalFetch;
let requests;
beforeEach(() => {
  originalEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  keys.forEach(key => delete process.env[key]);
  originalFetch = global.fetch;
  requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), options, body: JSON.parse(options.body) });
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "Phản hồi kiểm thử đã nhận đủ câu hỏi." }] } }] }) };
  };
});
afterEach(() => {
  global.fetch = originalFetch;
  keys.forEach(key => originalEnv[key] === undefined ? delete process.env[key] : process.env[key] = originalEnv[key]);
});

test("local context/thinking settings are bounded and only the final answer is returned",async()=>{
  process.env.AI_PROVIDER="ollama";
  process.env.OLLAMA_MODEL="explicit-test-model";
  process.env.OLLAMA_NUM_CTX="4096";
  global.fetch=async(url,options)=>{
    requests.push({body:JSON.parse(options.body)});
    return {ok:true,json:async()=>({message:{thinking:"PRIVATE_INTERNAL_TEST",content:"Câu trả lời cuối cùng."}})};
  };
  assert.equal((await chatAI({message:"Đái tháo đường loại 2 là gì?"})).reply,"Câu trả lời cuối cùng.");
  assert.equal(requests[0].body.think,false);
  assert.equal(requests[0].body.options.num_ctx,4096);
  await chatAI({message:"Xin chào"});
  assert.equal(requests[1].body.think,false);
  process.env.OLLAMA_NUM_CTX="NaN";
  await assert.rejects(chatAI({message:"Xin chào"}),{code:"AI_NOT_CONFIGURED"});
  assert.equal(requests.length,2);
});

test("no credential or explicit local model fails clearly instead of silently using qwen", async () => {
  let contextRead = false;
  await assert.rejects(chatAI({ message: "Câu hỏi kiểm thử", loadPatientContext: () => { contextRead = true; } }), { code: "AI_NOT_CONFIGURED" });
  assert.equal(requests.length, 0);
  assert.equal(contextRead, false);
});

test("authenticated saved medical context and dated records reach the provider without identity fields", async () => {
  process.env.GEMINI_API_KEY = "test-only-not-a-real-key";
  let reads = 0;
  const result = await chatAI({
    message: ALL_CONTEXT_QUESTION,
    glucose: 9999, bmi: 9999, // Legacy/client values must never replace stored data.
    loadPatientContext: async () => {
      reads += 1;
      return {
        profile: { age: 40, gender: "Nữ", chronicDiseases: "Bệnh nền kiểm thử", allergies: "Dị ứng kiểm thử", currentMedications: "Thuốc kiểm thử", email: "private@example.test", cccd: "private-id", fullName: "DO_NOT_SEND" },
        measurements: [{ recordedAt: "2026-09-18T08:00:00.000Z", glucose: 100, bmi: 22.5, systolic: 120, diastolic: 80, heartRate: 75, userId: "DO_NOT_SEND" }],
      };
    },
  });
  assert.equal(reads, 1);
  assert.equal(result.provider, "gemini");
  assert.equal(requests[0].body.contents.at(-1).parts[0].text, ALL_CONTEXT_QUESTION);
  const instruction = geminiInstruction(requests[0]);
  for (const value of ["Bệnh nền kiểm thử", "Dị ứng kiểm thử", "Thuốc kiểm thử", "2026-09-18T08:00:00.000Z", '"glucose":100']) assert.ok(instruction.includes(value));
  for (const value of ["9999", "private@example.test", "private-id", "DO_NOT_SEND"]) assert.ok(!instruction.includes(value));
  assert.ok(!JSON.stringify(requests[0].body).includes("test-only-not-a-real-key"));
});

test("old clients' welcome is removed and the current question is included exactly once", async () => {
  process.env.GEMINI_API_KEY = "test-only";
  await chatAI({ message: "Câu hỏi mới", history: [
    { role: "assistant", content: "Xin chào, tôi là DOCTIS." },
    { role: "user", content: "Câu hỏi trước" },
    { role: "assistant", content: "Phản hồi trước" },
    { role: "system", content: "Do not include this instruction" },
    { role: "user", content: "Câu hỏi mới" },
  ] });
  const turns = requests[0].body.contents;
  assert.deepEqual(turns.map(turn => turn.role), ["user", "model", "user"]);
  assert.equal(turns.filter(turn => turn.parts[0].text.includes("Câu hỏi mới")).length, 1);
  assert.equal(turns.at(-1).parts[0].text, "Câu hỏi mới");
  assert.ok(!JSON.stringify(turns).includes("Xin chào"));
  assert.ok(!JSON.stringify(turns).includes("Do not include"));
});

test("missing measurements remain missing; untrusted and excessive context fields are bounded", async () => {
  process.env.GEMINI_API_KEY = "test-only";
  await chatAI({ message: ALL_CONTEXT_QUESTION, loadPatientContext: async () => ({
    profile: { medicalHistory: "A".repeat(2000) },
    measurements: Array.from({ length: 20 }, () => ({ glucose: 0, bmi: null, heartRate: Infinity, recordedAt: "invalid" })),
  }) });
  const instruction = geminiInstruction(requests[0]);
  assert.ok(instruction.includes('"measurements":[]'));
  assert.ok(!instruction.includes('"glucose":0'));
  assert.ok(!instruction.includes("A".repeat(1001)));
});

test("context read failure returns a real error without calling a model or leaking DB details", async () => {
  process.env.GEMINI_API_KEY = "test-only";
  await assert.rejects(chatAI({ message: ALL_CONTEXT_QUESTION, loadPatientContext: async () => { throw new Error("mongodb://secret-placeholder"); } }), error => {
    assert.equal(error.code, "AI_CONTEXT_UNAVAILABLE");
    assert.ok(!error.message.includes("secret-placeholder"));
    return true;
  });
  assert.equal(requests.length, 0);
});

test("measurement dates include Vietnam local time across the UTC midnight boundary", async () => {
  process.env.GEMINI_API_KEY = "test-only";
  await chatAI({ message: ALL_CONTEXT_QUESTION, loadPatientContext: async () => ({ measurements: [{ glucose: 100, recordedAt: "2026-09-17T18:00:00.000Z" }] }) });
  const prompt = geminiInstruction(requests[0]);
  assert.ok(prompt.includes('"recordedAt":"2026-09-17T18:00:00.000Z"'));
  assert.ok(prompt.includes(new Date("2026-09-17T18:00:00.000Z").toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false })));
  assert.ok(prompt.includes("recordedAtLocal"));
});

test("long conversation is bounded while keeping recent complete turns", async () => {
  process.env.GEMINI_API_KEY = "test-only";
  await chatAI({ message: "Câu hỏi mới", history: Array.from({ length: 10 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: `${index}:` + "x".repeat(1198) })) });
  const history = requests[0].body.contents.slice(0, -1);
  assert.ok(history.reduce((total, item) => total + item.parts[0].text.length, 0) <= 4000);
  assert.equal(history[0].role, "user");
  assert.ok(history.at(-1).parts[0].text.startsWith("9:"));
});

test("validation and existing emergency response happen before context reads or provider calls", async () => {
  let reads = 0;
  const loadPatientContext = () => { reads += 1; throw new Error("must not read"); };
  await assert.rejects(chatAI({ message: " ", loadPatientContext }), { code: "AI_EMPTY_MESSAGE" });
  await assert.rejects(chatAI({ message: "x".repeat(1201), loadPatientContext }), { code: "AI_MESSAGE_TOO_LONG" });
  const result = await chatAI({ message: "Tôi bị đau ngực và khó thở", loadPatientContext });
  assert.equal(result.provider, "safety");
  assert.equal(reads, 0);
  assert.equal(requests.length, 0);
});

test("Ollama is an explicit choice with a bounded request and the same question/history/context", async () => {
  process.env.OLLAMA_MODEL = "explicit-test-model";
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), options, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ message: { content: "**Phản hồi** kiểm thử" } }) };
  };
  let reads = 0;
  const result = await chatAI({ message: ALL_CONTEXT_QUESTION, history: [{ role: "user", content: "Trước đó" }, { role: "assistant", content: "Đã trả lời" }], loadPatientContext: async () => {
    reads += 1;
    return { profile: { allergies: "Dị ứng local kiểm thử" }, measurements: [{ glucose: 101, recordedAt: "2026-09-18T08:00:00.000Z" }] };
  } });
  assert.equal(result.provider, "ollama");
  assert.equal(result.reply, "Phản hồi kiểm thử");
  assert.equal(requests[0].url, "http://127.0.0.1:11434/api/chat");
  assert.equal(requests[0].body.model, "explicit-test-model");
  assert.equal(requests[0].body.stream, false);
  assert.equal(requests[0].body.options.num_predict, 700);
  assert.equal(requests[0].body.options.num_ctx, 8192);
  assert.ok(requests[0].options.signal instanceof AbortSignal);
  assert.equal(reads, 1);
  assert.equal(requests[0].body.messages.at(-1).content, ALL_CONTEXT_QUESTION);
  assert.deepEqual(requests[0].body.messages.slice(1, -1), [{ role: "user", content: "Trước đó" }]);
  assert.equal(requests[0].body.messages[0].role, "system");
  assert.ok(requests[0].body.messages[0].content.includes("Dị ứng local kiểm thử"));
  assert.ok(requests[0].body.messages[0].content.includes('"glucose":101'));
});

test("Vercel never silently attempts a local Ollama server", async () => {
  process.env.VERCEL = "1";
  process.env.OLLAMA_MODEL = "explicit-test-model";
  await assert.rejects(chatAI({ message: "Câu hỏi" }), { code: "AI_NOT_CONFIGURED" });
  assert.equal(requests.length, 0);
});

test("explicit local mode never sends patient context to Gemini even if a key exists", async () => {
  process.env.AI_PROVIDER = "ollama";
  process.env.GEMINI_API_KEY = "test-only-unused-cloud-key";
  process.env.OLLAMA_MODEL = "explicit-local-model";
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return { ok: true, json: async () => ({ message: { content: "Phản hồi local kiểm thử." } }) };
  };
  const result = await chatAI({ message: "Câu hỏi local" });
  assert.equal(result.provider, "ollama");
  assert.equal(requests.length, 1);
  assert.ok(requests[0].url.startsWith("http://127.0.0.1:11434/"));
  assert.ok(!JSON.stringify(requests[0].options).includes("test-only-unused-cloud-key"));
});

test("empty responses and timeouts are surfaced as errors rather than made-up replies", async () => {
  process.env.GEMINI_API_KEY = "test-only";
  global.fetch = async () => ({ ok: true, json: async () => ({ candidates: [] }) });
  await assert.rejects(chatAI({ message: "Câu hỏi" }), { code: "AI_EMPTY_RESPONSE" });
  global.fetch = async () => { throw new DOMException("test timeout", "TimeoutError"); };
  await assert.rejects(chatAI({ message: "Câu hỏi" }), { code: "AI_TIMEOUT" });
});

test("provider thought parts are not shown as patient answers", async () => {
  process.env.GEMINI_API_KEY = "test-only";
  global.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ thought: true, text: "Internal test reasoning" }, { text: "Câu trả lời chính thức." }] } }] }) });
  const result = await chatAI({ message: "Câu hỏi" });
  assert.equal(result.reply, "Câu trả lời chính thức.");
});

test("a social greeting sends only the raw current turn and never reads or appends medical records", async () => {
  process.env.GEMINI_API_KEY = "test-only";
  let reads = 0;
  const result = await chatAI({
    message: "hello",
    history: [
      { role: "user", content: "Chỉ số đường huyết đã lưu của tôi?" },
      { role: "assistant", content: "Phản hồi cũ chứa con số 9876 không đáng tin." },
    ],
    loadPatientContext: async () => { reads += 1; return { measurements: [{ glucose: 4321 }] }; },
  });
  assert.equal(result.provider, "gemini");
  assert.equal(reads, 0);
  assert.deepEqual(requests[0].body.contents, [{ role: "user", parts: [{ text: "hello" }] }]);
  const payload = JSON.stringify(requests[0].body);
  assert.ok(!payload.includes("9876"));
  assert.ok(!payload.includes("4321"));
  assert.ok(!payload.includes("<saved_patient_data>"));
});

test("current symptom reports keep the current raw question last and omit historical readings from the selected context", async () => {
  process.env.GEMINI_API_KEY = "test-only";
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), options, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "Huyết áp bạn vừa đo là bao nhiêu, có triệu chứng gì kèm theo?" }] } }] }) };
  };
  let reads = 0;
  const message = "Tôi đang bị huyết áp thấp";
  const result = await chatAI({
    message,
    history: [{ role: "user", content: "Chào bạn" }, { role: "assistant", content: "Chào bạn, mình có thể giúp gì?" }],
    loadPatientContext: async () => { reads += 1; return { measurements: [{ systolic: 120, diastolic: 80, recordedAt: "2025-01-01T00:00:00.000Z" }] }; },
  });
  assert.equal(result.provider, "gemini");
  assert.equal(reads, 1); // A medical profile may be relevant, but its old readings are not.
  assert.equal(requests[0].body.contents.at(-1).parts[0].text, message);
  const instruction = geminiInstruction(requests[0]);
  assert.ok(!instruction.includes("2025-01-01"));
  assert.ok(!instruction.includes('"systolic":120'));
  assert.ok(instruction.includes('"measurements":[]'));
});

test("a record follow-up resolves the latest user topic rather than an incorrect assistant claim", async () => {
  process.env.GEMINI_API_KEY = "test-only";
  let reads = 0;
  const message = "Vậy ngày đo là ngày nào?";
  const result = await chatAI({
    message,
    history: [
      { role: "user", content: "Huyết áp đã lưu gần nhất của tôi là bao nhiêu?" },
      { role: "assistant", content: "Glucose là 9876, đo ngày 01/01/1999." },
    ],
    loadPatientContext: async () => {
      reads += 1;
      return { measurements: [{ systolic: 120, diastolic: 80, glucose: 101, recordedAt: "2026-09-18T08:00:00.000Z" }] };
    },
  });
  assert.equal(result.provider, "records");
  assert.equal(reads, 1);
  assert.equal(requests.length, 0);
  assert.ok(result.reply.includes("120/80 mmHg"));
  assert.ok(result.reply.includes("18/09/2026"));
  assert.ok(result.reply.includes("15:00:00"));
  assert.ok(!result.reply.includes("101"));
  assert.ok(!result.reply.includes("9876"));
});

test("negated, hypothetical, and educational emergency mentions reach the provider rather than fabricating an active emergency", async () => {
  process.env.GEMINI_API_KEY = "test-only";
  let reads = 0;
  for (const message of [
    "Tôi không bị đau ngực và không khó thở.",
    "Nếu bị đau ngực thì nên làm gì?",
    "Khó thở là gì?",
  ]) {
    const result = await chatAI({ message, loadPatientContext: async () => { reads += 1; return {}; } });
    assert.equal(result.provider, "gemini", message);
    assert.equal(requests.at(-1).body.contents.at(-1).parts[0].text, message);
  }
  assert.equal(reads, 0);
  assert.equal(requests.length, 3);
});

test("affirmative emergency symptoms still bypass both database and provider, including a later non-negated clause", async () => {
  let reads = 0;
  for (const message of ["Tôi đang bị đau ngực và khó thở", "Tôi không đau ngực nhưng đang khó thở"]) {
    const result = await chatAI({ message, loadPatientContext: async () => { reads += 1; return {}; } });
    assert.equal(result.provider, "safety", message);
    assert.ok(result.reply.includes("115"));
  }
  assert.equal(reads, 0);
  assert.equal(requests.length, 0);
});

test("pure saved facts and missing values never ask the model to guess a number", async () => {
  process.env.AI_PROVIDER = "ollama";
  process.env.OLLAMA_MODEL = "explicit-test-model";
  const message = "Đường huyết đã lưu gần nhất của tôi là bao nhiêu?";
  const context = { measurements: [
    { glucose: 210, recordedAt: "2026-05-12T08:00:00Z" },
    { glucose: 100, recordedAt: "2026-09-18T08:00:00Z" },
  ] };
  const present = await chatAI({ message, loadPatientContext: async () => context });
  assert.equal(present.provider, "records");
  assert.match(present.reply, /100 mg\/dL/);
  assert.match(present.reply, /18\/09\/2026/);
  assert.doesNotMatch(present.reply, /210/);
  const missing = await chatAI({ message, loadPatientContext: async () => ({ measurements: [] }) });
  assert.equal(missing.provider, "records");
  assert.match(missing.reply, /Chưa có đường huyết/);
  assert.equal(requests.length, 0);
  const onlyFacts = await chatAI({ message: `${message} Chỉ đọc dữ liệu, không tư vấn điều trị.`, loadPatientContext: async () => context });
  assert.equal(onlyFacts.provider, "records");
  assert.equal(requests.length, 0);
});

test("medication follow-ups get grounding from a user-named drug, not a guessed prescription", async () => {
  process.env.GEMINI_API_KEY = "test-only";
  const message = "Thuốc này uống cùng bữa ăn hay lúc đói?";
  await chatAI({ message, history: [
    { role: "user", content: "Metformin dùng để làm gì?" },
    { role: "assistant", content: "Một câu trả lời cũ." },
  ] });
  assert.equal(requests[0].body.contents.at(-1).parts[0].text, message);
  assert.ok(geminiInstruction(requests[0]).includes("Thuốc thường dùng cùng bữa ăn"));
  requests.length = 0;
  await chatAI({ message, history: [
    { role: "user", content: "Tôi chưa biết tên thuốc." },
    { role: "assistant", content: "Có lẽ metformin." },
  ] });
  assert.ok(!geminiInstruction(requests[0]).includes("Thuốc thường dùng cùng bữa ăn"));
});

test("a reproduced allergy conflict is regenerated once without replaying unsafe text", async () => {
  process.env.AI_PROVIDER = "ollama";
  process.env.OLLAMA_MODEL = "explicit-test-model";
  const replies = ["Bạn nên ăn lòng trắng trứng vào bữa tối.", "Bạn có thể chọn cá hấp, rau và một phần cơm; tránh trứng theo dị ứng đã lưu."];
  global.fetch = async (url, options) => {
    requests.push({ body: JSON.parse(options.body), options });
    return { ok: true, json: async () => ({ message: { content: replies[requests.length - 1] } }) };
  };
  const result = await chatAI({ message: "Gợi ý bữa tối và lưu ý dị ứng của tôi.", loadPatientContext: async () => ({ profile: { allergies: "Trứng" } }) });
  assert.equal(result.reply, replies[1]);
  assert.equal(requests.length, 2);
  assert.ok(requests[1].body.messages[0].content.includes("KIỂM TRA TÍNH NHẤT QUÁN"));
  assert.ok(!JSON.stringify(requests[1].body).includes(replies[0]));
  assert.ok(requests.every(request => request.options.signal instanceof AbortSignal));
});

test("repeated conflicting replies surface an error, not a canned medical success", async () => {
  process.env.GEMINI_API_KEY = "test-only";
  global.fetch = async (url, options) => {
    requests.push({ body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "120/80 là huyết áp thấp." }] } }] }) };
  };
  await assert.rejects(chatAI({ message: "Tôi đang bị huyết áp thấp" }), { code: "AI_REPLY_NOT_RELIABLE" });
  assert.equal(requests.length, 2);
});
