const nodemailer = require("nodemailer");
function mailConfiguration(env = process.env) {
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) return { transport: { host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), secure: env.SMTP_SECURE === "true", auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }, from: env.MAIL_FROM || env.SMTP_USER };
  if (env.EMAIL_USER && env.EMAIL_PASS) return { transport: { service: "gmail", auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS } }, from: env.MAIL_FROM || env.EMAIL_USER };
  throw Object.assign(new Error("Máy chủ chưa cấu hình dịch vụ email. Vui lòng liên hệ quản trị viên."), { code: "EMAIL_NOT_CONFIGURED", status: 503 });
}
async function sendMail({ to, subject, text, html }) {
  const configuration = mailConfiguration();
  if (typeof to !== "string" || !to.trim() || !subject) throw new Error("Thiếu người nhận hoặc tiêu đề email.");
  const result = await nodemailer.createTransport({ ...configuration.transport, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000 }).sendMail({ from: configuration.from, to: to.trim(), subject: String(subject).trim(), text: text || "", html: html || "" });
  if (!Array.isArray(result?.accepted) || !result.accepted.length || result.rejected?.length) throw Object.assign(new Error("Dịch vụ email chưa chấp nhận người nhận. Vui lòng thử lại sau."), { code: "EMAIL_NOT_ACCEPTED" });
  return result;
}
module.exports = { sendMail, mailConfiguration };
