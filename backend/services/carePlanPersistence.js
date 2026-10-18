const CarePlan = require("../models/CarePlan");
const User = require("../models/User");
const Health = require("../models/Health");
const Prescription = require("../models/Prescription");

class CarePlanError extends Error {
  constructor(status, code, message, currentPlan) {
    super(message); this.status = status; this.code = code;
    if (currentPlan) this.currentPlan = presentPlan(currentPlan);
  }
}
const validId = value => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
const text = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
const revisionOf = plan => Number.isInteger(plan?.revision) ? plan.revision : 0;
const dateIsValid = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
function localDate(value) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function datePlus(value, days) {
  const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function normalizeDays(days, startDate) {
  if (!Array.isArray(days) || days.length < 1 || days.length > 31) throw new CarePlanError(400, "INVALID_DAYS", "Kế hoạch cần từ 1 đến 31 ngày.");
  return days.map((day, index) => {
    if (!day || day.dayIndex !== index || !Array.isArray(day.items) || day.items.length > 60) throw new CarePlanError(400, "INVALID_DAYS", "Thứ tự ngày hoặc danh sách hoạt động không hợp lệ.");
    const ids = new Set();
    return {
      dayIndex: index, label: text(day.label, 100) || `Ngày ${index + 1}`, date: datePlus(startDate, index), status: "draft",
      items: day.items.map(item => {
        const id = text(item?.id, 150), title = text(item?.title, 300), time = text(item?.time, 5);
        if (!id || ids.has(id) || !title || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new CarePlanError(400, "INVALID_ITEM", "Mỗi hoạt động cần mã riêng trong ngày, giờ HH:mm và tên.");
        ids.add(id);
        const type = ["MEAL", "EXERCISE", "MEDICATION", "NOTE"].includes(item.type) ? item.type : "NOTE";
        return { id, type, time, title, description: text(item.description, 2000), done: false, completedAt: null,
          ...(validId(item.prescriptionId) ? { prescriptionId: item.prescriptionId } : {}), medicineId: text(item.medicineId, 150), source: "" };
      }),
    };
  });
}
function presentPlan(value) {
  const plan = typeof value?.toObject === "function" ? value.toObject() : value;
  if (!plan) return null;
  return { ...plan, revision: revisionOf(plan), legacy: !plan.schemaVersion,
    days: (Array.isArray(plan.days) ? plan.days : []).map(day => ({ ...day,
      items: (Array.isArray(day.items) ? day.items : []).map(item => ({ ...item, done: item.done === true, completedAt: item.completedAt || null })),
    })) };
}
const activeFilter = patientId => ({ patientId, source: "AI", status: { $ne: "cancelled" }, archivedAt: null, isCurrent: { $ne: false } });
const revisionFilter = revision => revision === 0 ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] } : { revision };
function safeSnapshot(user, health, prescriptions, capturedAt) {
  const profile = {};
  for (const field of ["allergies", "chronicDiseases", "medicalHistory"]) if (typeof user?.[field] === "string") profile[field] = text(user[field], 2000);
  const measurement = {};
  if (health) {
    if (validId(String(health._id || ""))) measurement.recordId = health._id;
    if (health.createdAt != null && Number.isFinite(new Date(health.createdAt).getTime())) measurement.recordedAt = new Date(health.createdAt);
    for (const field of ["height", "weight", "bmi", "glucose", "systolic", "diastolic", "heartRate"]) if (typeof health[field] === "number" && Number.isFinite(health[field]) && health[field] > 0) measurement[field] = health[field];
  }
  return { capturedAt, profile, health: measurement,
    prescriptionIds: (Array.isArray(prescriptions) ? prescriptions : []).map(rx => rx._id).filter(id => validId(String(id))).slice(0, 100) };
}

function validateBasedOn(value) {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !(value.healthRecordId == null || value.healthRecordId === "" || validId(value.healthRecordId))
    || typeof value.allergies !== "string" || typeof value.chronicDiseases !== "string"
    || value.allergies.length > 20000 || value.chronicDiseases.length > 20000) {
    throw new CarePlanError(400, "INVALID_BASED_ON", "Thông tin phiên bản dữ liệu đầu vào không hợp lệ.");
  }
}
function verifyBasedOn(value, user, health) {
  if (value === undefined) return;
  const id = String(health?._id || "").toLowerCase();
  if (String(value.healthRecordId || "").toLowerCase() !== id
    || value.allergies.trim() !== String(user?.allergies || "").trim()
    || value.chronicDiseases.trim() !== String(user?.chronicDiseases || "").trim()) {
    throw new CarePlanError(409, "INPUTS_CHANGED", "Chỉ số hoặc hồ sơ đã thay đổi. Hãy tải lại dữ liệu trước khi tạo kế hoạch.");
  }
}
function verifyPrescriptionSources(days, prescriptions) {
  const confirmedIds = new Set((Array.isArray(prescriptions) ? prescriptions : []).map(rx => String(rx._id)));
  return days.map(day => ({ ...day, items: day.items.map(item => {
    const verified = item.type === "MEDICATION" && confirmedIds.has(String(item.prescriptionId));
    const { prescriptionId, medicineId, ...rest } = item;
    return { ...rest, ...(verified ? { prescriptionId, medicineId } : {}), source: verified ? "DOCTOR" : "" };
  }) }));
}

function createCarePlanPersistence({ CarePlanModel = CarePlan, UserModel = User, HealthModel = Health, PrescriptionModel = Prescription, now = () => new Date() } = {}) {
  const current = async patientId => presentPlan(await CarePlanModel.findOne(activeFilter(patientId)).sort({ createdAt: -1, updatedAt: -1, _id: -1 }).lean());
  async function create(patientId, body = {}) {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new CarePlanError(400, "INVALID_PLAN", "Kế hoạch không hợp lệ.");
    validateBasedOn(body.basedOn);
    const today = now(), startDate = body.startDate === undefined ? localDate(today) : body.startDate;
    if (!dateIsValid(startDate)) throw new CarePlanError(400, "INVALID_START_DATE", "Ngày bắt đầu phải có dạng YYYY-MM-DD hợp lệ.");
    const days = normalizeDays(body.days, startDate);
    const previous = await current(patientId);
    if (previous && (body.confirmReplace !== true || body.replacePlanId !== String(previous._id))) throw new CarePlanError(409, "CURRENT_PLAN_EXISTS", "Bạn đã có kế hoạch. Xác nhận tạo kế hoạch mới để lưu kế hoạch cũ vào lịch sử.", previous);
    if (previous && (!Number.isInteger(body.expectedRevision) || body.expectedRevision !== revisionOf(previous))) throw new CarePlanError(409, "REVISION_CONFLICT", "Kế hoạch vừa thay đổi. Hãy tải lại trước khi tạo kế hoạch mới.", previous);
    const user = await UserModel.findById(patientId).select("_id doctorId role allergies chronicDiseases medicalHistory").lean();
    if (!user || user.role !== "user") throw new CarePlanError(404, "PATIENT_NOT_FOUND", "Không tìm thấy hồ sơ bệnh nhân.");
    const [health, prescriptions] = await Promise.all([
      HealthModel.findOne({ userId: patientId }).select("_id createdAt height weight bmi glucose systolic diastolic heartRate").sort({ createdAt: -1, _id: -1 }).lean(),
      PrescriptionModel.find({ patientId, status: "confirmed" }).select("_id").limit(100).lean(),
    ]);
    verifyBasedOn(body.basedOn, user, health);
    const data = { patientId, doctorId: user.doctorId || null, source: "AI", status: "draft", days: verifyPrescriptionSources(days, prescriptions), doctorNote: "", confirmedAt: null,
      schemaVersion: 2, startDate, endDate: datePlus(startDate, days.length - 1), timeZone: "Asia/Ho_Chi_Minh", revision: 0, isCurrent: true, archivedAt: null,
      previousPlanId: previous?._id || null, inputSnapshot: safeSnapshot(user, health, prescriptions, today) };
    let archived;
    if (previous) {
      archived = await CarePlanModel.findOneAndUpdate({ ...activeFilter(patientId), _id: previous._id, ...revisionFilter(revisionOf(previous)) },
        { $set: { isCurrent: false, archivedAt: today }, $inc: { revision: 1 } }, { new: true, runValidators: true });
      if (!archived) throw new CarePlanError(409, "REVISION_CONFLICT", "Kế hoạch vừa thay đổi. Hãy tải lại trước khi tạo kế hoạch mới.");
    }
    try {
      return presentPlan(await CarePlanModel.create(data));
    } catch (error) {
      // A unique partial index arbitrates concurrent creation. If insertion
      // fails, restore the archived plan only when another current plan has
      // not won that slot. No document or completion history is deleted.
      if (archived) {
        try {
          if (!(await current(patientId))) await CarePlanModel.findOneAndUpdate({ _id: previous._id, patientId, isCurrent: false, archivedAt: today, revision: revisionOf(previous) + 1 },
            { $set: { isCurrent: true, archivedAt: null }, $inc: { revision: 1 } }, { new: true, runValidators: true });
        } catch { /* A competing insert may have acquired the unique slot. */ }
      }
      if (error.code === 11000) throw new CarePlanError(409, "CURRENT_PLAN_EXISTS", "Một kế hoạch mới vừa được lưu. Hãy tải lại để xem.", await current(patientId));
      throw error;
    }
  }
  async function history(patientId) {
    const active = await current(patientId);
    const filter = { patientId, source: "AI", ...(active ? { _id: { $ne: active._id } } : {}) };
    const plans = await CarePlanModel.find(filter).sort({ createdAt: -1, _id: -1 }).limit(50).lean();
    return plans.map(plan => ({ ...presentPlan(plan), isCurrent: false }));
  }
  async function toggle(patientId, itemId, body = {}) {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new CarePlanError(400, "INVALID_COMPLETION", "Trạng thái hoàn thành không hợp lệ.");
    if (!validId(body.planId) || typeof itemId !== "string" || !itemId || itemId.length > 150 || !Number.isInteger(body.dayIndex) || body.dayIndex < 0 || body.dayIndex > 30 || typeof body.done !== "boolean" || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 0) throw new CarePlanError(400, "INVALID_COMPLETION", "Thiếu kế hoạch, ngày, trạng thái hoàn thành hoặc phiên bản hợp lệ.");
    const plan = await current(patientId);
    if (!plan || String(plan._id) !== body.planId) throw new CarePlanError(404, "PLAN_NOT_CURRENT", "Kế hoạch không còn hiện hành hoặc không thuộc tài khoản này.");
    if (revisionOf(plan) !== body.expectedRevision) throw new CarePlanError(409, "REVISION_CONFLICT", "Tiến độ vừa thay đổi. Hãy tải lại kế hoạch.", plan);
    const day = plan.days.find(row => row.dayIndex === body.dayIndex);
    if (!day?.items.some(item => item.id === itemId)) throw new CarePlanError(404, "ITEM_NOT_FOUND", "Không tìm thấy hoạt động trong ngày này.");
    const updated = await CarePlanModel.findOneAndUpdate({ ...activeFilter(patientId), _id: body.planId, ...revisionFilter(body.expectedRevision), days: { $elemMatch: { dayIndex: body.dayIndex, "items.id": itemId } } },
      { $set: { "days.$[day].items.$[item].done": body.done, "days.$[day].items.$[item].completedAt": body.done ? now() : null }, $inc: { revision: 1 } },
      { new: true, runValidators: true, arrayFilters: [{ "day.dayIndex": body.dayIndex }, { "item.id": itemId }] });
    if (!updated) throw new CarePlanError(409, "REVISION_CONFLICT", "Tiến độ vừa thay đổi. Hãy tải lại kế hoạch.");
    return presentPlan(updated);
  }
  return { current, create, history, toggle };
}
module.exports = { CarePlanError, createCarePlanPersistence, normalizeDays, safeSnapshot, presentPlan, dateIsValid, localDate };
