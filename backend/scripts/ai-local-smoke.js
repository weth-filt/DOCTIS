// Opt-in LIVE local-model smoke check. These fixtures never touch MongoDB and
// are never inserted into the application. Run from a UTF-8 source file so
// Windows PowerShell's legacy pipeline encoding cannot corrupt the questions.
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env"), quiet: true });
const { chatAI } = require("../services/aiService");

if (process.env.AI_PROVIDER !== "ollama") throw new Error("This smoke check requires AI_PROVIDER=ollama.");
const context = {
  profile: { chronicDiseases: "Đái tháo đường type 2", allergies: "Penicillin; trứng", currentMedications: "Chưa cung cấp" },
  measurements: [
    { glucose: 100, bmi: 22.5, systolic: 120, diastolic: 80, heartRate: 75, recordedAt: "2026-09-18T08:00:00.000Z" },
    { glucose: 94, bmi: 22.5, systolic: 118, diastolic: 78, heartRate: 74, recordedAt: "2026-09-17T08:00:00.000Z" },
  ],
};

async function main() {
  const firstQuestion = "Đường huyết đã lưu gần nhất của tôi là bao nhiêu, đo ngày nào? Chỉ đọc dữ liệu, không tư vấn điều trị.";
  const started = Date.now();
  const first = await chatAI({ message: firstQuestion, loadPatientContext: async () => context });
  console.log(JSON.stringify({ scenario: "synthetic-record-lookup", provider: first.provider, elapsedMs: Date.now() - started, reply: first.reply }));
  const followStarted = Date.now();
  const second = await chatAI({ message: "Còn dị ứng thì sao, tôi đã lưu những dị ứng nào?", history: [{ role: "user", content: firstQuestion }, { role: "assistant", content: first.reply }], loadPatientContext: async () => context });
  console.log(JSON.stringify({ scenario: "synthetic-profile-followup", provider: second.provider, elapsedMs: Date.now() - followStarted, reply: second.reply }));
  const recordGrounded = first.reply.includes("100") && /18/.test(first.reply) && !/xin chào|chào bạn/i.test(first.reply);
  const profileGrounded = /penicillin/i.test(second.reply) && /trứng/i.test(second.reply) && first.reply !== second.reply;
  const symptomStarted = Date.now();
  const symptoms = await chatAI({ message: "Tôi đang bị đau bụng và huyết áp thấp, tôi nên làm gì?", loadPatientContext: async () => context });
  console.log(JSON.stringify({ scenario: "synthetic-symptoms", provider: symptoms.provider, elapsedMs: Date.now() - symptomStarted, reply: symptoms.reply }));
  const symptomsAddressed = /bụng|huyết áp/i.test(symptoms.reply) && !/xin chào|chào bạn/i.test(symptoms.reply) && symptoms.reply !== first.reply;
  console.log(JSON.stringify({ recordGrounded, profileGrounded, symptomsAddressed, noCloudProvider: [first, second, symptoms].every(result => ["ollama", "records"].includes(result.provider)) }));
  if (!recordGrounded || !profileGrounded || !symptomsAddressed) process.exitCode = 1;
}
main().catch(error => { console.error(JSON.stringify({ code: error.code || error.name, message: error.message })); process.exitCode = 1; });
