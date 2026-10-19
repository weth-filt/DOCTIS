const User = require("../models/User");
const accountService = require("../services/adminAccountService");
const { problem, sendProblem } = require("../services/coordinationUtils");
function adminOnly(req) { if (req.user?.role !== "admin") throw problem("ADMIN_REQUIRED", "Chỉ admin mới có quyền quản trị.", 403); }
exports.getUsers = async (req, res) => {
  try {
    adminOnly(req);
    const users = await User.find().select("_id username fullName email phone avatar role address ward wardId city hospitalId doctorId createdAt updatedAt").sort({ createdAt: -1 }).lean().exec();
    return res.json(users);
  } catch (error) { return sendProblem(res, error); }
};
exports.changeRole = async (req, res) => {
  try { adminOnly(req); const user = await accountService.changeRole(req.params.id, req.body?.role, req.user.id); return res.json({ msg: "Đã cập nhật vai trò và kết thúc các phân công không còn phù hợp.", role: user.role, user }); }
  catch (error) { return sendProblem(res, error); }
};
exports.updateDoctorProfile = async (req, res) => {
  try { adminOnly(req); const doctor = await accountService.updateDoctor(req.params.id, req.body || {}, req.user.id); return res.json({ msg: "Đã cập nhật thông tin bác sĩ.", doctor }); }
  catch (error) { return sendProblem(res, error); }
};
module.exports = exports;
