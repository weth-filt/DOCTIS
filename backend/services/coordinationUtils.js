const mongoose = require("mongoose");
const CITY = "Đà Nẵng";
const validId = value => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
function problem(code, message, status = 400) { return Object.assign(new Error(message), { code, status }); }
function clean(value, max = 500) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function requireId(value, label = "ID") { if (!validId(value)) throw problem("INVALID_ID", `${label} không hợp lệ.`); return value; }
function requireRevision(value) { if (!Number.isInteger(value) || value < 0) throw problem("REVISION_REQUIRED", "Vui lòng tải lại hồ sơ trước khi lưu thay đổi.", 409); return value; }
function requireCity(value) { if (value !== undefined && value !== CITY) throw problem("OUTSIDE_SERVICE_AREA", "Hệ thống hiện chỉ tiếp nhận địa chỉ tại thành phố Đà Nẵng."); return CITY; }
function sourceUrl(value) { try { const url = new URL(value); if (url.protocol !== "https:" || url.username || url.password || url.href.length > 1000) throw new Error(); return url.href; } catch { throw problem("INVALID_SOURCE", "Cần URL nguồn HTTPS đã được người quản trị đối chiếu xác minh."); } }
let preparedIndexes;
async function prepareCoordinationIndexes() {
  if (!preparedIndexes) preparedIndexes = Promise.all(["User", "Ward", "Hospital", "SupportRequest", "Notification", "DoctorAssignment"].map(name => require(`../models/${name}`).init())).catch(error => { preparedIndexes = null; throw error; });
  await preparedIndexes;
}
async function runTransaction(work) {
  await prepareCoordinationIndexes();
  const session = await mongoose.startSession();
  let result;
  try { await session.withTransaction(async () => { result = await work(session); }); return result; }
  catch (error) { if (error.code === 20 || error.codeName === "IllegalOperation") throw problem("TRANSACTIONS_REQUIRED", "Cơ sở dữ liệu cần hỗ trợ transaction để lưu nhất quán. Chưa có thay đổi nào được xác nhận.", 503); throw error; }
  finally { await session.endSession(); }
}
function sendProblem(res, error) {
  if (error.code === 11000 || error.code === 112 || error.codeName === "WriteConflict") return res.status(409).json({ code: "CONCURRENT_UPDATE", msg: "Dữ liệu vừa được cập nhật hoặc đã tồn tại. Vui lòng tải lại trước khi thử lại." });
  const publicError = typeof error.code === "string" && error.status;
  return res.status(publicError ? error.status : 500).json({ code: publicError ? error.code : "COORDINATION_UNAVAILABLE", msg: publicError ? error.message : "Chưa thể lưu hoặc tải dữ liệu điều phối. Vui lòng thử lại sau." });
}
module.exports = { CITY, validId, problem, clean, requireId, requireRevision, requireCity, sourceUrl, runTransaction, sendProblem, prepareCoordinationIndexes };
