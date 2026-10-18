// Opt-in checks against the actual LOCAL model. All clinical values/names below
// are synthetic fixtures, never read from or written to the application DB.
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env"), quiet: true });
const { chatAI } = require("../services/aiService");
if (process.env.AI_PROVIDER !== "ollama") throw new Error("Local-only check requires AI_PROVIDER=ollama.");

const fixture = {
  profile: { chronicDiseases: "Đái tháo đường type 2", allergies: "Penicillin; trứng", currentMedications: "Chưa cung cấp" },
  measurements: [
    { glucose: 100, bmi: 22.5, systolic: 120, diastolic: 80, heartRate: 75, recordedAt: "2026-09-18T08:00:00.000Z" },
    { glucose: 94, systolic: 118, diastolic: 78, recordedAt: "2026-09-17T08:00:00.000Z" },
    { glucose: 210, systolic: 120, diastolic: 80, recordedAt: "2026-05-12T08:00:00.000Z" },
  ],
};
const staleHistory = [
  { role: "user", content: "Đường huyết gần nhất bao nhiêu?" },
  // Deliberately wrong past answer: the current server facts must take priority.
  { role: "assistant", content: "Gần nhất ngày 12/5/2026, đường huyết 210 mg/dL." },
];
const scenarios = [
  { id: "hello-after-stale-history", question: "hello bạn", history: staleHistory,
    check: text => /chào|hello/i.test(text) && !/210|120\/80|12\/5|mg\/dL/i.test(text) },
  { id: "current-low-pressure", question: "Tôi đang bị huyết áp thấp", history: staleHistory,
    check: text => /huyết áp/i.test(text) && /đo|bao nhiêu|triệu chứng|chóng|hoa mắt/i.test(text) && !/120\s*\/\s*80|210|12\/5|18\/9/.test(text) },
  { id: "type2-education", question: "Đái tháo đường loại 2 là gì, tôi cần theo dõi những gì hằng ngày?",
    check: text => /đường huyết|glucose/i.test(text) && /ăn|vận động|thuốc|theo dõi/.test(text) && !/210|12\/5|cường độ cao|7\.0|10\.0|dưới 100|đường trong nước/.test(text) },
  { id: "dinner-with-saved-allergy", question: "Tôi bị type 2, gợi ý một bữa tối dễ chuẩn bị và lưu ý dị ứng đã lưu của tôi.",
    check: text => /rau|cơm|cá|đậu|thịt/i.test(text) && /trứng/i.test(text) && !/210|12\/5/.test(text)
      && !text.split(/[.!?\n]/).some(clause => !/nếu|không có/i.test(clause) && /tránh[^\n]*sữa|dị ứng[^\n]*sữa/.test(clause))
      && (!/mayonnaise/i.test(text) || /mayonnaise không.*trứng|tránh.*mayonnaise|không.*mayonnaise/i.test(text)) },
  { id: "starting-walking", question: "Tôi ít vận động, muốn bắt đầu đi bộ nhẹ thì sắp xếp thế nào?",
    check: text => /đi bộ/i.test(text) && /bắt đầu|nhẹ|tăng dần|phút/i.test(text) && !/210|12\/5|3-4 lần một ngày|giúp bạn điều chỉnh lượng insulin/.test(text) },
  { id: "medication-education", question: "Metformin dùng để làm gì? Đường cao thì tôi tự tăng liều được không?",
    check: text => /metformin/i.test(text) && /đường|glucose|insulin/i.test(text) && /không.*tự|không nên|bác sĩ/i.test(text) },
  { id: "medication-followup", question: "Thuốc này uống cùng bữa ăn hay lúc đói?", historyFrom: "medication-education",
    check: text => /metformin|thuốc/i.test(text) && /bữa ăn|cùng.*ăn|sau.*ăn/i.test(text) && !/tăng liều lên|uống gấp đôi/i.test(text) },
  { id: "latest-not-highest", question: "Đường huyết đã lưu gần nhất của tôi bao nhiêu, đo ngày nào?", history: staleHistory,
    check: text => /100/.test(text) && /18/.test(text) && !/210|12\/5|đo huyết áp/i.test(text) },
  { id: "record-date-followup", question: "Ngày đo là ngày nào?", historyFrom: "latest-not-highest",
    check: text => /18/.test(text) && /9|chín/.test(text) && !/210|12\/5/.test(text) },
  { id: "highest-in-available-window", question: "Đường huyết cao nhất trong các bản ghi bạn đang có là bao nhiêu?",
    check: text => /210/.test(text) && /bản ghi|lần đo|được cung cấp|đang có|gần nhất|phạm vi/i.test(text) },
  { id: "negative-emergency-education", question: "Tôi không đau ngực, cũng không khó thở. Tôi chỉ muốn hỏi cách ghi nhật ký đường huyết.",
    check: (text, provider) => provider === "ollama" && /nhật ký|ghi lại|ghi chép/i.test(text) && !/cấp cứu ngay|gọi 115/.test(text) },
  { id: "current-symptom-followup", question: "Tôi vừa đo 88/58 và hơi hoa mắt.",
    history: [{ role: "user", content: "Tôi đang bị huyết áp thấp" }, { role: "assistant", content: "Bạn vừa đo huyết áp bao nhiêu, có chóng mặt hoặc hoa mắt không?" }],
    check: text => /huyết áp|88\s*\/\s*58|hoa mắt|chóng/i.test(text) && !/120\s*\/\s*80|210|12\/5/.test(text) },
  { id: "actual-emergency", question: "Tôi đang đau ngực và khó thở, tình trạng tăng lên.",
    check: (text, provider) => provider === "safety" && /115|cấp cứu/.test(text) },
  { id: "missing-glucose", question: "Đường huyết đã lưu gần nhất của tôi là bao nhiêu?", history: staleHistory,
    context: { profile: fixture.profile, measurements: fixture.measurements.map(({glucose, ...record}) => record) },
    check: text => /chưa|không.*có|thiếu/i.test(text) && !/210|100\s*mg/.test(text) },
];

async function main() {
  const baseline = process.argv.includes("--baseline");
  const requestedCases = process.argv.find(arg => arg.startsWith("--cases="))?.slice(8).split(",");
  const selected = requestedCases ? scenarios.filter(item => requestedCases.includes(item.id)) : baseline ? scenarios.slice(0, 2) : scenarios;
  let passed = 0;
  const completed = new Map();
  for (const scenario of selected) {
    const started = Date.now();
    let contextReads = 0;
    const prior = scenario.historyFrom ? completed.get(scenario.historyFrom) : null;
    if (scenario.historyFrom && !prior) throw new Error(`Include prerequisite scenario ${scenario.historyFrom} before ${scenario.id}.`);
    const history = prior ? [{ role: "user", content: prior.question }, { role: "assistant", content: prior.reply }] : scenario.history || [];
    const result = await chatAI({ message: scenario.question, history, loadPatientContext: async () => { contextReads++; return scenario.context || fixture; } });
    completed.set(scenario.id, {question:scenario.question, reply:result.reply});
    const ok = scenario.check(result.reply, result.provider);
    passed += Number(ok);
    console.log(JSON.stringify({ scenario: scenario.id, passed: ok, provider: result.provider, elapsedMs: Date.now()-started, contextReads, reply: result.reply }));
  }
  console.log(JSON.stringify({ model: process.env.OLLAMA_MODEL, passed, total: selected.length, baseline, note: "Automated checks plus manual semantic review; not a clinical validation." }));
  if (!baseline && passed !== selected.length) process.exitCode = 1;
}
main().catch(error => { console.error(JSON.stringify({ code: error.code || error.name, message: error.message })); process.exitCode = 1; });
