const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({

  service: "gmail",

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }

});

const sendReminderEmail = async (
  to,
  reminders,
  username
) => {

  try {

    const reminderHTML = reminders.map(item => `

      <div style="
        padding:15px;
        margin-bottom:12px;
        border-radius:12px;
        background:#f3f4f6;
      ">

        <h3 style="margin:0 0 10px 0;">
          ${item.title}
        </h3>

        <p style="margin:0 0 10px 0;">
          ${item.description}
        </p>

        <b>
          ⏰ ${item.time}
        </b>

      </div>

    `).join("");

    await transporter.sendMail({

      from: `"AI Health" <${process.env.EMAIL_USER}>`,

      to,

      subject: "🔔 Nhắc nhở sức khỏe hôm nay",

      html: `

        <div style="
          font-family:Arial;
          padding:20px;
        ">

          <h2>
            Xin chào ${username} 👋
          </h2>

          <p>
            Đây là các lời nhắc sức khỏe hôm nay:
          </p>

          ${reminderHTML}

          <hr />

          <p>
            AI Health Assistant
          </p>

        </div>

      `
    });

    console.log("EMAIL SENT:", to);

  }

  catch(err){

    console.log("SEND EMAIL ERROR =", err);

  }

};

module.exports = sendReminderEmail;