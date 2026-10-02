require("dotenv").config({
  path: require("path").join(__dirname, ".env"),
});

const mongoose = require("mongoose");
const app = require("./app");
const startCron = require("./services/cronService");

const PORT =
  process.env.PORT || 5000;
const HOST =
  process.env.HOST || "0.0.0.0";

const MONGO_URI =
  process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error(
    "❌ MONGO_URI chưa được cấu hình trong .env"
  );
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error(
    "❌ JWT_SECRET chưa được cấu hình trong .env"
  );
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log(
      "✅ MongoDB connected"
    );

    try {
      startCron();
      console.log(
        "✅ Cron service started"
      );
    } catch (cronError) {
      console.error(
        "⚠️ Cron service error =",
        cronError
      );
    }

    app.listen(
      PORT,
      HOST,
      () => {
        console.log(
          `🚀 Server running on port ${PORT}`
        );
      }
    );
  })
  .catch((err) => {
    console.error(
      "❌ MongoDB connection error =",
      err
    );

    process.exit(1);
  });
