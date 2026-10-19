const jwt = require("jsonwebtoken");
const User = require("../models/User");
function createAuth({ UserModel = User, verify = jwt.verify, secret = () => process.env.JWT_SECRET } = {}) {
  return async (req, res, next) => {
    const authorization = req.headers.authorization;
    if (typeof authorization !== "string" || !/^Bearer\s+\S+$/.test(authorization)) return res.status(401).json({ msg: "Vui lòng đăng nhập bằng phiên hợp lệ." });
    if (!secret()) return res.status(503).json({ msg: "Máy chủ chưa cấu hình xác thực." });
    let decoded;
    try {
      decoded = verify(authorization.replace(/^Bearer\s+/, ""), secret());
      if (!decoded || typeof decoded !== "object" || !/^[a-f\d]{24}$/i.test(String(decoded.id || ""))) throw new Error("INVALID_ID");
    } catch { return res.status(401).json({ msg: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." }); }
    try {
      // A role embedded in a seven-day JWT is not a current authorization grant.
      const account = await UserModel.findById(decoded.id).select("_id role hospitalId").lean();
      if (!account || !["user", "doctor", "admin"].includes(account.role)) return res.status(401).json({ msg: "Tài khoản không còn khả dụng. Vui lòng đăng nhập lại." });
      req.user = { ...decoded, id: String(account._id), role: account.role, hospitalId: account.hospitalId || null };
      return next();
    } catch { return res.status(503).json({ msg: "Chưa thể kiểm tra quyền truy cập. Vui lòng thử lại sau." }); }
  };
}
module.exports = createAuth();
module.exports.createAuth = createAuth;
