// Local preview entry point: the normal app and authentication, with no email
// reminder scheduler. Production continues to use backend/server.js unchanged.
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env"), quiet: true });
const mongoose = require("mongoose");
const app = require("../app");

if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  console.error("Local preview requires the existing database and authentication configuration.");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => {
    const server = app.listen(process.env.PORT || 5000, "127.0.0.1", () => console.log("DOCTIS local API ready."));
    const stop = () => server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  })
  .catch(() => {
    console.error("DOCTIS local API could not connect to the database.");
    process.exit(1);
  });
