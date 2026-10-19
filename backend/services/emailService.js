const { sendMail } = require("../utils/mailer");
async function sendReminderEmail(to, reminders, username) {
  const text = [`Xin chào ${username || "bạn"},`, "Các lời nhắc sức khỏe của bạn:", ...reminders.map(item => `${item.title}\n${item.description || ""}\nThời gian: ${item.time} (giờ Việt Nam).`)].join("\n\n");
  const result = await sendMail({ to, subject: "Nhắc hoạt động sức khỏe — DOCTIS", text });
  if (!result?.accepted?.length) throw new Error("EMAIL_NOT_ACCEPTED");
  return true;
}
module.exports = sendReminderEmail;
