const { registerPatient } = require("../services/registrationService");
const { sendProblem } = require("../services/coordinationUtils");
function createRegistrationController({ register = registerPatient } = {}) {
  return async (req, res) => { try { const result = await register(req.body || {}); return res.status(result.replayed ? 200 : 201).json({ msg: "Đăng ký thành công. Hồ sơ đang chờ admin cập nhật bệnh viện hỗ trợ.", ...result }); } catch (error) { return sendProblem(res, error); } };
}
module.exports = { register: createRegistrationController(), createRegistrationController };
