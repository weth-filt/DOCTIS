const nodemailer =
  require("nodemailer");

const transporter =
  nodemailer.createTransport({
    host:
      process.env.SMTP_HOST,

    port:
      Number(
        process.env.SMTP_PORT ||
          587
      ),

    secure:
      String(
        process.env.SMTP_SECURE ||
          "false"
      ) === "true",

    auth: {
      user:
        process.env.SMTP_USER,

      pass:
        process.env.SMTP_PASS,
    },
  });

// ========================================
// SEND MAIL
// ========================================

exports.sendMail = async ({
  to,
  subject,
  text,
  html,
}) => {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    throw new Error(
      "Chưa cấu hình SMTP_HOST / SMTP_USER / SMTP_PASS."
    );
  }

  if (!to) {
    throw new Error(
      "Thiếu email người nhận."
    );
  }

  if (!subject) {
    throw new Error(
      "Thiếu tiêu đề email."
    );
  }

  return transporter.sendMail({
    from:
      process.env.MAIL_FROM ||
      process.env.SMTP_USER,

    to:
      String(to).trim(),

    subject:
      String(subject).trim(),

    text:
      text || "",

    html:
      html || "",
  });
};