// Manual, read-only authenticated LOCAL endpoint check. Supply the existing
// test account as JSON on stdin. Credentials/token/health values are never logged
// or persisted. This uses normal login; it does not forge or bypass a JWT.
const fs = require("fs");
const base = "http://127.0.0.1:5000/api";
const send = async (path, body, token) => {
  const response = await fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(150000),
  });
  return { status: response.status, data: await response.json() };
};

async function main() {
  const credentials = JSON.parse(fs.readFileSync(0, "utf8"));
  if (!credentials.email || !credentials.password) throw new Error("Credentials must be supplied via stdin.");
  const login = await send("/auth/login", { email: credentials.email, password: credentials.password });
  if (login.status !== 200 || typeof login.data.token !== "string") {
    console.log(JSON.stringify({ loginStatus: login.status, authenticated: false }));
    process.exitCode = 1;
    return;
  }
  const token = login.data.token;
  const [health, profile, unauthenticated] = await Promise.all([
    send("/health/history", null, token), send("/profile", null, token),
    send("/ai/analyze", { message: "Kiểm tra xác thực" }),
  ]);
  if (health.status !== 200 || profile.status !== 200 || !Array.isArray(health.data)) throw new Error("Authenticated saved context read failed.");
  const records = [...health.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const latest = records.slice(0, 7).find(record => Number.isFinite(record.glucose) && record.glucose > 0 && Number.isFinite(Date.parse(record.createdAt)));
  const started = Date.now();
  const result = await send("/ai/analyze", { message: "Đường huyết được lưu gần nhất của tôi là bao nhiêu, ngày nào? Chỉ trả lời theo dữ liệu đã lưu.", history: [] }, token);
  const reply = typeof result.data.reply === "string" ? result.data.reply : "";
  const checkedValue = typeof latest?.glucose === "number";
  const matchesLatestSavedValue = checkedValue ? reply.includes(String(latest.glucose)) : null;
  console.log(JSON.stringify({ authenticated: true, unauthenticatedStatus: unauthenticated.status, healthReadStatus: health.status, profileReadStatus: profile.status, hasSavedMeasurements: records.length > 0, aiStatus: result.status, provider: result.data.provider, elapsedMs: Date.now() - started, replyLength: reply.length, matchesLatestSavedValue, repeatedGreeting: /xin chào|chào bạn/i.test(reply) }));
  if (result.status !== 200 || result.data.provider !== "records" || !reply || matchesLatestSavedValue === false || unauthenticated.status !== 401) process.exitCode = 1;
  const symptomStarted = Date.now();
  const symptom = await send("/ai/analyze", {
    message: "Tôi đang bị đau bụng và huyết áp thấp, tôi nên làm gì?",
    history: [{ role: "user", content: "Đường huyết được lưu gần nhất của tôi là bao nhiêu, ngày nào? Chỉ trả lời theo dữ liệu đã lưu." }, { role: "assistant", content: reply }],
  }, token);
  const symptomReply = typeof symptom.data.reply === "string" ? symptom.data.reply : "";
  const symptomsAddressed = /bụng|huyết áp/i.test(symptomReply) && !/xin chào|chào bạn/i.test(symptomReply) && symptomReply !== reply;
  console.log(JSON.stringify({ scenario: "authenticated-symptom-followup", aiStatus: symptom.status, provider: symptom.data.provider, elapsedMs: Date.now() - symptomStarted, replyLength: symptomReply.length, symptomsAddressed, repeatedPreviousAnswer: symptomReply === reply }));
  if (symptom.status !== 200 || symptom.data.provider !== "ollama" || !symptomsAddressed) process.exitCode = 1;
}
main().catch(() => { console.error("Local authenticated AI endpoint check failed; no credential or response payload was logged."); process.exitCode = 1; });
