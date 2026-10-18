const User = require("../models/User");
const Health = require("../models/Health");

const PROFILE_PROJECTION = {
  _id: 0,
  gender: 1,
  dateOfBirth: 1,
  allergies: 1,
  medicalHistory: 1,
  chronicDiseases: 1,
  currentMedications: 1,
  bloodType: 1,
};
const HEALTH_PROJECTION = {
  _id: 0,
  height: 1,
  weight: 1,
  bmi: 1,
  glucose: 1,
  systolic: 1,
  diastolic: 1,
  heartRate: 1,
  createdAt: 1,
};
const PROFILE_TEXT_FIELDS = [
  "gender",
  "allergies",
  "medicalHistory",
  "chronicDiseases",
  "currentMedications",
  "bloodType",
];
const MEASUREMENT_FIELDS = [
  "height", "weight", "bmi", "glucose", "systolic", "diastolic", "heartRate",
];

// Authentication supplies a string ID. Do not accept castable objects or query operators.
function isValidPatientId(value) {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
}

function ageFromBirthDate(value, today) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value)
  ) return undefined;

  const datePart = value.slice(0, 10);
  const birthDate = new Date(`${datePart}T00:00:00.000Z`);
  if (
    !Number.isFinite(birthDate.getTime()) ||
    birthDate.toISOString().slice(0, 10) !== datePart ||
    !Number.isFinite(Date.parse(value)) ||
    birthDate > today
  ) return undefined;

  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  if (
    today.getUTCMonth() < birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() < birthDate.getUTCDate())
  ) age -= 1;
  return age;
}

function projectProfile(user, today) {
  const profile = {};
  if (!user) return profile;
  const age = ageFromBirthDate(user.dateOfBirth, today);
  if (age !== undefined) profile.age = age;
  for (const field of PROFILE_TEXT_FIELDS) {
    if (typeof user[field] === "string" && user[field].trim()) {
      profile[field] = user[field].trim();
    }
  }
  return profile;
}

function projectMeasurement(record) {
  const measurement = {};
  for (const field of MEASUREMENT_FIELDS) {
    if (typeof record[field] === "number" && Number.isFinite(record[field])) {
      measurement[field] = record[field];
    }
  }
  if (record.createdAt instanceof Date || typeof record.createdAt === "string") {
    const recordedAt = new Date(record.createdAt);
    if (Number.isFinite(recordedAt.getTime())) measurement.recordedAt = recordedAt.toISOString();
  }
  return measurement;
}

// Dependencies are injectable for isolated tests; production uses only read queries.
function createPatientContextLoader({ UserModel = User, HealthModel = Health, now = () => new Date() } = {}) {
  return async function loadPatientContext(userId) {
    if (!isValidPatientId(userId)) {
      const error = new Error("Không xác định được tài khoản hợp lệ.");
      error.code = "AI_INVALID_USER";
      throw error;
    }

    const [user, records] = await Promise.all([
      UserModel.findById(userId).select(PROFILE_PROJECTION).lean().exec(),
      HealthModel.find({ userId })
        .select(HEALTH_PROJECTION)
        .sort({ createdAt: -1, _id: -1 })
        .limit(7)
        .lean()
        .exec(),
    ]);

    // Explicit allowlists also protect against accidental over-selection in future queries.
    return {
      profile: projectProfile(user, now()),
      measurements: (Array.isArray(records) ? records : []).slice(0, 7).map(projectMeasurement),
    };
  };
}

exports.loadPatientContext = createPatientContextLoader();
exports.createPatientContextLoader = createPatientContextLoader;
exports.isValidPatientId = isValidPatientId;
