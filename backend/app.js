const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");

const app = express();

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

const defaultOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:80",
];

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  defaultOrigins.join(",")
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Permit local development servers on any port, including CRA's fallback
  // port when the preferred port is already occupied. This does not permit
  // arbitrary public origins.
  try {
    const { protocol, hostname } = new URL(origin);
    const isLocalHost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1";
    const isProjectDomain =
      hostname === "doctis.vn" ||
      hostname.endsWith(".doctis.vn");
    const isQuickTunnelDomain =
      hostname.endsWith(".trycloudflare.com");

    return (
      ["http:", "https:"].includes(protocol) &&
      (isLocalHost ||
        (!process.env.VERCEL && (isProjectDomain || isQuickTunnelDomain)))
    );
  } catch (err) {
    return false;
  }
};

app.use((req, res, next) => {
  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0].trim();
  const requestHost = forwardedHost || req.get("host");
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0].trim();
  const requestProtocol = forwardedProto || req.protocol;
  const requestOrigin = requestHost
    ? `${requestProtocol}://${requestHost}`
    : "";

  cors({
    origin: (origin, callback) => {
      // Requests from the same public hostname (including Cloudflare Tunnel)
      // are same-origin and should not be rejected by the CORS allowlist.
      if (!origin || origin === requestOrigin || isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      console.log("CORS BLOCKED:", origin);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-auth-token"],
  })(req, res, next);
});

/*
|--------------------------------------------------------------------------
| BODY PARSER
|--------------------------------------------------------------------------
|
| Cho phép dữ liệu JSON lớn hơn vì:
| - avatar
| - ảnh
| - file attachment trong chat
|
*/

app.use(
  express.json({
    // Vercel Functions have a 4.5 MB request body limit. Keep local development
    // more permissive while ensuring the hosted API returns a useful 413 first.
    limit: process.env.VERCEL ? "4mb" : "12mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.VERCEL ? "4mb" : "12mb",
  })
);

// A Vercel Function may be invoked before the database connection exists.
// Reuse the connection while the function instance stays warm.
let mongoConnectionPromise;
const connectMongoForVercel = async (req, res, next) => {
  // Vercel can normalize a request path before handing it to Express, so a
  // req.path prefix check can silently skip MongoDB on API requests.
  if (!process.env.VERCEL) {
    return next();
  }

  const mongoUri = process.env.MONGO_URI?.trim();
  if (!mongoUri) {
    return res.status(503).json({
      success: false,
      msg: "Máy chủ chưa được cấu hình MONGO_URI.",
    });
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      // A warm serverless instance can lose a connection after a promise has
      // already resolved. Clear that promise and allow the next request to retry.
      if (mongoose.connection.readyState === 0) {
        mongoConnectionPromise = undefined;
      }
      if (!mongoConnectionPromise) {
        mongoConnectionPromise = mongoose.connect(mongoUri, {
          serverSelectionTimeoutMS: 10000,
        });
      }
      await mongoConnectionPromise;
    }
    if (mongoose.connection.readyState !== 1) {
      throw new Error("MongoDB connection is not ready.");
    }
    return next();
  } catch (error) {
    mongoConnectionPromise = undefined;
    console.error("MongoDB connection failed.");
    return res.status(503).json({
      success: false,
      msg: "Không thể kết nối cơ sở dữ liệu. Vui lòng thử lại sau.",
    });
  }
};

app.use(connectMongoForVercel);
app.use("/api/public", require("./routes/publicCatalogRoutes"));
app.use("/api/admin/catalog", require("./routes/adminCatalogRoutes"));
app.use("/api/admin/intakes", require("./routes/intakeRoutes"));
app.use("/api/care-team", require("./routes/careTeamRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/internal/scheduler", require("./routes/schedulerRoutes"));

/*
|--------------------------------------------------------------------------
| API ROUTES
|--------------------------------------------------------------------------
*/

/*
| AUTH
| /api/auth/...
*/
app.use(
  "/api/auth",
  require("./routes/authRoutes")
);

// Lightweight endpoint for checking that the deployed API and database respond.
app.get("/api/health", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  return res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    api: "ok",
    database: databaseConnected ? "connected" : "disconnected",
  });
});

/*
| HEALTH
| /api/health/...
*/
app.use(
  "/api/health",
  require("./routes/healthRoutes")
);

/*
| AI
| /api/ai/...
*/
app.use(
  "/api/ai",
  require("./routes/aiRoutes")
);

/*
| REMINDERS
| /api/reminders/...
*/
app.use(
  "/api/reminders",
  require("./routes/reminderRoutes")
);

/*
| DOCTOR
| /api/doctor/...
*/
app.use(
  "/api/doctor",
  require("./routes/doctorRoutes")
);

/*
| APPOINTMENTS
| /api/appointments/...
*/
app.use(
  "/api/appointments",
  require("./routes/appointmentRoutes")
);

/*
| CARE PLANS
| /api/care-plans/...
*/
app.use(
  "/api/care-plans",
  require("./routes/carePlanRoutes")
);

/*
| PRESCRIPTIONS
| /api/prescriptions/...
*/
app.use(
  "/api/prescriptions",
  require("./routes/prescriptionRoutes")
);

/*
|--------------------------------------------------------------------------
| ADMIN
|--------------------------------------------------------------------------
|
| QUAN TRỌNG:
|
| assignmentRoutes đã được mount bên trong adminRoutes:
|
| adminRoutes
|   └── /assignments
|         ├── /patients
|         ├── /doctors
|         ├── /summary
|         ├── /patient/:patientId
|         ├── /assign
|         ├── /unassign
|         └── /history/:patientId
|
| Vì vậy app.js CHỈ mount:
|
| /api/admin
|
| KHÔNG mount assignmentRoutes lần nữa.
|
*/

app.use(
  "/api/admin",
  require("./routes/adminRoutes")
);

/*
| PROFILE
| /api/profile/...
*/
app.use(
  "/api/profile",
  require("./routes/profileRoutes")
);

/*
| MESSAGES
| /api/messages/...
*/
app.use(
  "/api/messages",
  require("./routes/messageRoutes")
);

/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/

app.get("/api", (req, res) => {
  return res.json({
    success: true,
    message: "DOCTIS API đang hoạt động.",
  });
});

app.get("/api/health-check", (req, res) => {
  return res.json({
    success: true,
    message: "Backend DOCTIS đang hoạt động.",
    time: new Date().toISOString(),
  });
});

/*
|--------------------------------------------------------------------------
| PRODUCTION FRONTEND
|--------------------------------------------------------------------------
|
| In production, serve React from the same origin as the API. This keeps
| browser API requests on /api and avoids localhost URLs on remote devices.
|
*/

const frontendBuildPath = path.resolve(__dirname, "../frontend/build");
if (!process.env.VERCEL) {
  app.use(express.static(frontendBuildPath));
}

if (!process.env.VERCEL) {
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) {
      return next();
    }

    return res.sendFile(path.join(frontendBuildPath, "index.html"), (err) => {
      if (err) next();
    });
  });
}

/*
|--------------------------------------------------------------------------
| 404 API
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    msg: "API endpoint không tồn tại.",
    path: req.originalUrl,
  });
});

/*
|--------------------------------------------------------------------------
| GLOBAL ERROR HANDLER
|--------------------------------------------------------------------------
*/

app.use((err, req, res, next) => {
  console.error("Request failed.");

  /*
  | File / JSON quá lớn
  */
  if (
    err?.type === "entity.too.large" ||
    err?.status === 413
  ) {
    return res.status(413).json({
      success: false,
      msg:
        "Dữ liệu quá lớn. Vui lòng chọn ảnh hoặc tệp nhỏ hơn 8MB.",
    });
  }

  /*
  | CORS
  */
  if (
    String(err?.message || "")
      .toLowerCase()
      .includes("cors")
  ) {
    return res.status(403).json({
      success: false,
      msg: err.message || "CORS bị từ chối.",
    });
  }

  /*
  | JSON sai format
  */
  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    err.type === "entity.parse.failed"
  ) {
    return res.status(400).json({
      success: false,
      msg: "Dữ liệu JSON không hợp lệ.",
    });
  }

  /*
  | Error mặc định
  */
  return res.status(err?.status || 500).json({
    success: false,
    msg:
      err?.message ||
      "Lỗi máy chủ.",
  });
});

module.exports = app;
