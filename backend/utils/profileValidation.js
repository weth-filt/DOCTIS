// Keep these format rules aligned with frontend/src/utils/profileValidation.js.
const PHONE_FIELDS = ["phone", "fatherPhone", "motherPhone", "emergencyContactPhone"];
const PHONE_MESSAGE = "Nhập SĐT Việt Nam hợp lệ: di động 10 số (03/05/07/08/09), hoặc số bàn 11 số (02). Có thể dùng +84 thay số 0 đầu.";

function validateProfileFormats(data) {
  const errors = {};
  if (Object.hasOwn(data, "cccd") && (typeof data.cccd !== "string" || !/^\d{12}$/.test(data.cccd.trim()))) {
    errors.cccd = "CCCD / Căn cước phải gồm đúng 12 chữ số.";
  }
  if (Object.hasOwn(data, "email") && (typeof data.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))) {
    errors.email = "Email không đúng định dạng. Ví dụ: ten@example.com.";
  }
  for (const field of PHONE_FIELDS) {
    if (!Object.hasOwn(data, field)) continue;
    const value = data[field];
    // Empty optional contacts are allowed. Do not coerce numbers: leading zeros matter.
    if (typeof value !== "string") { errors[field] = PHONE_MESSAGE; continue; }
    const trimmed = value.trim();
    if (!trimmed && field !== "phone") continue;
    const compact = trimmed.replace(/[\s.()-]/g, "");
    if (!/^(?:0|\+84)(?:[35789]\d{8}|2\d{9})$/.test(compact)) errors[field] = PHONE_MESSAGE;
  }
  return errors;
}

module.exports = { validateProfileFormats };
