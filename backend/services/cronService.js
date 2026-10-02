  const cron = require("node-cron");

  const Reminder =
  require("../models/Reminder");

  const sendReminderEmail =
  require("./emailService");

  const startCron = () => {

    cron.schedule("* * * * *", async () => {

      try {

        const now = new Date();

        const currentTime =
          `${String(now.getHours())
            .padStart(2,"0")}:${String(now.getMinutes())
            .padStart(2,"0")}`;

        const today =
          now.toISOString().split("T")[0];

        console.log(
          "CHECK:",
          currentTime
        );

        const reminders =
          await Reminder.find({

            time:currentTime,

            enabled:true

          }).populate("userId");

        for(const reminder of reminders){

          try {

            /* =========================
              ALREADY SENT TODAY
            ========================= */

            if(
              reminder.lastSentDate === today
            ){

              continue;

            }

            const user = reminder.userId;

            if(!user?.email){

              continue;

            }

            await sendReminderEmail(

              user.email,

              [reminder],

              user.username
            );

            reminder.lastSentDate = today;

            await reminder.save();

            console.log(
              "EMAIL SENT:",
              user.email
            );

          }

          catch(err){

            console.log(
              "SEND FAIL:",
              err
            );

          }

        }

      }

      catch(err){

        console.log(
          "CRON ERROR:",
          err
        );

      }

    });

  };

  module.exports = startCron;