// Deterministic display of authenticated server facts. This module does not
// retrieve records, infer a diagnosis, or turn a profile field into instructions.
const METRICS = Object.freeze({
  glucose: { label: "Đường huyết", unit: "mg/dL" },
  bmi: { label: "BMI", unit: "kg/m²" },
  height: { label: "Chiều cao", unit: "cm" },
  weight: { label: "Cân nặng", unit: "kg" },
  systolic: { label: "Huyết áp tâm thu", unit: "mmHg" },
  diastolic: { label: "Huyết áp tâm trương", unit: "mmHg" },
  heartRate: { label: "Nhịp tim", unit: "bpm" },
});
const PROFILE_LABELS = Object.freeze({
  age: "Tuổi", gender: "Giới tính", bloodType: "Nhóm máu", allergies: "Dị ứng",
  medicalHistory: "Tiền sử bệnh", chronicDiseases: "Bệnh nền", currentMedications: "Thuốc đang dùng",
});
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const positive = value => typeof value === "number" && Number.isFinite(value) && value > 0;
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().trim();
const calendar = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function dateLabel(date) {
  const parts = Object.fromEntries(calendar.formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${parts.day}/${parts.month}/${parts.year} lúc ${parts.hour}:${parts.minute}:${parts.second} (giờ Việt Nam)`;
}

function scopedDay(scope) {
  const value = scope?.requestedDate;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `, lọc ngày ${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)} theo giờ Việt Nam`
    : "";
}

function scopeLabel(scope) {
  const count = Number.isInteger(scope?.windowCount) && scope.windowCount >= 0 && scope.windowCount <= 7 ? scope.windowCount : null;
  return `Phạm vi: ${count === null ? "phần dữ liệu đã lưu" : `${count} bản ghi đã lưu gần đây`} được cung cấp${scopedDay(scope)}; không phải toàn bộ lịch sử.`;
}

function pureFactRequest(message, plan) {
  if (plan?.kind !== "records" || plan.thirdParty || plan.currentSymptoms) return false;
  if (["nutrition", "activity", "symptoms"].includes(plan.topic)) return false;
  const text = normalize(message).replace(/\bkhong (?:can )?(?:tu van(?: dieu tri)?|giai thich|dien giai|dieu tri)\b/g, "");
  // A mixed question still needs the conversational path to address its other
  // part; do not consume it with a value-only response.
  return !/\b(?:nen|can lam|lam gi|xu tri|dieu tri|tu van|loi khuyen|giai thich|y nghia|nguyen nhan|tai sao|vi sao|nguy hiem|an toan|binh thuong|on dinh|muc tieu|anh huong|tac dung|trieu chung|chong mat|choang|ngat|buon non|run tay|kho tho|dau nguc|co giat)\b|\b(?:co\s+)?(?:cao|thap|on|tot|xau)\s+(?:khong|ko)\b|\b(?:an gi|an uong|bua an|thuc don|dinh duong|van dong|the duc|di bo)\b/.test(text);
}

function safeRows(context, metrics) {
  return (Array.isArray(context?.measurements) ? context.measurements : []).slice(0, 7).map((record, index) => {
    const stamp = record?.recordedAt;
    const date = new Date(stamp instanceof Date || typeof stamp === "string" && stamp.trim() ? stamp : NaN);
    if (!Number.isFinite(date.getTime())) return null;
    const values = {};
    metrics.forEach(key => { if (positive(record?.[key])) values[key] = record[key]; });
    return Object.keys(values).length ? { date, time: date.getTime(), values, index } : null;
  }).filter(Boolean).sort((a, b) => b.time - a.time || a.index - b.index);
}

function valuesLabel(values, metrics) {
  const pair = metrics.includes("systolic") && metrics.includes("diastolic");
  const result = [];
  metrics.forEach(key => {
    if (!owns(values, key) || pair && key === "diastolic" && owns(values, "systolic")) return;
    if (pair && key === "systolic" && owns(values, "diastolic")) result.push(`Huyết áp: ${values.systolic}/${values.diastolic} mmHg`);
    else result.push(`${METRICS[key].label}: ${values[key]} ${METRICS[key].unit}${pair && ["systolic", "diastolic"].includes(key) ? ` (chưa có ${key === "systolic" ? "tâm trương" : "tâm thu"} trong cùng bản ghi)` : ""}`);
  });
  return result.join("; ");
}

function requestedOperations(text) {
  const operations = [];
  if (/\b(?:gan nhat|moi nhat|cuoi cung|lan cuoi)\b/.test(text)) operations.push("latest");
  if (/\b(?:cao nhat|lon nhat|nhieu nhat|maximum|max)\b/.test(text)) operations.push("highest");
  if (/\b(?:thap nhat|nho nhat|it nhat|minimum|min)\b/.test(text)) operations.push("lowest");
  return operations;
}

function compoundLines(rows, metrics, operations) {
  const lines = [];
  const pressurePair = metrics.includes("systolic") && metrics.includes("diastolic");
  for (const key of metrics.filter(key => !pressurePair || !["systolic", "diastolic"].includes(key))) {
    const available = rows.filter(row => owns(row.values, key));
    if (!available.length) continue;
    for (const operation of operations) {
      const row = operation === "latest" ? available[0] : available.reduce((best, candidate) =>
        operation === "highest" ? candidate.values[key] > best.values[key] ? candidate : best
          : candidate.values[key] < best.values[key] ? candidate : best);
      const description = operation === "latest" ? "gần nhất" : operation === "highest" ? "cao nhất trong phần dữ liệu được cung cấp" : "thấp nhất trong phần dữ liệu được cung cấp";
      lines.push(`• ${METRICS[key].label} ${description}: ${row.values[key]} ${METRICS[key].unit}; đo ngày ${dateLabel(row.date)}.`);
    }
  }
  if (pressurePair) {
    lines.push("Huyết áp theo từng lần đo được cung cấp (không ghép hoặc xếp hạng hai thành phần từ những lần đo khác nhau):");
    rows.filter(row => owns(row.values, "systolic") || owns(row.values, "diastolic")).forEach(row => {
      lines.push(`• ${dateLabel(row.date)} — ${valuesLabel(row.values, ["systolic", "diastolic"])}.`);
    });
  }
  return lines;
}

/** Return actual saved facts only, or null when a conversational answer is needed. */
function createSavedFactsReply(message, plan, selectedContext) {
  if (!pureFactRequest(message, plan) || !selectedContext || typeof selectedContext !== "object") return null;
  const metrics = [...new Set((Array.isArray(plan.metrics) ? plan.metrics : []).filter(key => owns(METRICS, key)))];
  const fields = [...new Set((Array.isArray(plan.profileFields) ? plan.profileFields : []).filter(key => owns(PROFILE_LABELS, key)))];
  if (!metrics.length && !fields.length) return null;
  const sections = [];
  if (fields.length) {
    const profile = selectedContext.profile || {};
    const lines = fields.map(key => {
      const value = profile[key];
      const available = key === "age" ? typeof value === "number" && Number.isFinite(value) && value >= 0 : typeof value === "string" && Boolean(value.trim());
      const displayed = available ? key === "age" ? `${value} tuổi` : value.trim().replace(/\s+/g, " ") : "chưa có thông tin trong hồ sơ được cung cấp";
      return `• ${PROFILE_LABELS[key]}: ${displayed}.`;
    });
    sections.push(`Thông tin hồ sơ đã lưu được cung cấp:\n${lines.join("\n")}`);
  }
  if (metrics.length) {
    const scope = selectedContext.recordScope || {};
    const rows = safeRows(selectedContext, metrics);
    const mode = scope.selection || plan.recordMode;
    const operations = requestedOperations(normalize(message));
    const lines = [];
    if (operations.length > 1 && mode === "recent") lines.push(...compoundLines(rows, metrics, operations));
    else {
      const heading = mode === "highest" && scope.operationApplied !== false ? "Giá trị cao nhất trong phần dữ liệu được cung cấp"
        : mode === "lowest" && scope.operationApplied !== false ? "Giá trị thấp nhất trong phần dữ liệu được cung cấp"
          : mode === "latest" ? "Số đo đã lưu gần nhất trong phần dữ liệu được cung cấp"
            : "Các lần đo đã lưu được cung cấp";
      if (rows.length) lines.push(`${heading}:`, ...rows.map(row => `• ${dateLabel(row.date)} — ${valuesLabel(row.values, metrics)}.`));
      if (scope.operationApplied === false && ["highest", "lowest"].includes(mode)) lines.push("Chưa xếp hạng cao/thấp nhất cho yêu cầu có nhiều chỉ số; các giá trị trên được giữ theo từng lần đo.");
    }
    const missing = metrics.filter(key => !rows.some(row => owns(row.values, key)));
    if (missing.length) lines.push(`Chưa có ${missing.map(key => METRICS[key].label.toLowerCase()).join(", ")} kèm ngày đo hợp lệ trong phần dữ liệu được cung cấp${scopedDay(scope)}.`);
    sections.push([scopeLabel(scope), ...lines].join("\n"));
  }
  return sections.join("\n\n");
}

module.exports = { createSavedFactsReply };
