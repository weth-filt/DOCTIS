const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Challenge = require("../models/PasswordResetChallenge");
const { sendMail, mailConfiguration } = require("../utils/mailer");
const generateOTP = require("../utils/generateOTP");

const OTP_LIFETIME_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const emailOf = req => typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
function digest(code) {
  if (!process.env.JWT_SECRET) throw Object.assign(new Error("Máy chủ chưa cấu hình khôi phục mật khẩu."), { status: 503 });
  return crypto.createHmac("sha256", process.env.JWT_SECRET).update(code).digest("hex");
}
function matchingHash(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== 64 || b.length !== 64) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
function createPasswordResetController({ UserModel = User, ChallengeModel = Challenge, mail = sendMail, assertMailConfigured = mailConfiguration, now = () => new Date(), makeCode = generateOTP, hashCode = digest, hashPassword = value => bcrypt.hash(value, 10) } = {}) {
  let initialization;
  const initialize = async () => {
    if (typeof ChallengeModel.init === "function") {
      if (!initialization) initialization = ChallengeModel.init().catch(error => { initialization = null; throw error; });
      await initialization;
    }
  };
  const errorResponse = (res, error) => res.status(error.status || 503).json({ msg: error.code === "EMAIL_NOT_CONFIGURED" ? "Máy chủ chưa cấu hình dịch vụ email. Vui lòng liên hệ quản trị viên." : error.status === 429 ? error.message : "Không thể hoàn tất khôi phục mật khẩu lúc này. Vui lòng thử lại sau.", code: error.code || "PASSWORD_RESET_UNAVAILABLE" });
  const findUser = email => UserModel.findOne({ email }).select("_id email").lean();
  const validChallenge = async (req, res) => {
    const email = emailOf(req), otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
    if (!email || !/^\d{6}$/.test(otp)) { res.status(400).json({ msg: "Vui lòng nhập email và mã OTP gồm 6 chữ số." }); return null; }
    const user = await findUser(email);
    const challenge = user ? await ChallengeModel.findOne({ userId: user._id }).select("+codeHash").lean() : null;
    const at = now();
    if (!challenge || challenge.consumedAt || !challenge.expiresAt || !Number.isFinite(new Date(challenge.expiresAt).getTime()) || new Date(challenge.expiresAt).getTime() <= at.getTime() || challenge.attempts >= MAX_ATTEMPTS) {
      res.status(400).json({ msg: "OTP không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu mã mới." }); return null;
    }
    if (!matchingHash(challenge.codeHash, hashCode(otp))) {
      await ChallengeModel.updateOne({ _id: challenge._id, codeHash: challenge.codeHash, consumedAt: null }, { $inc: { attempts: 1 } });
      res.status(400).json({ msg: "OTP không hợp lệ hoặc đã hết hạn." }); return null;
    }
    return { user, challenge, at };
  };
  const forgotPassword = async (req, res) => {
    let created, createdHash;
    try {
      const email = emailOf(req);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ msg: "Vui lòng nhập email hợp lệ." });
      assertMailConfigured();
      const user = await findUser(email);
      if (!user) return res.status(400).json({ msg: "Không tìm thấy tài khoản với email này." });
      await initialize();
      const at = now(), code = makeCode(), codeHash = hashCode(code);
      createdHash = codeHash;
      try {
        created = await ChallengeModel.findOneAndUpdate({ userId: user._id, $or: [{ sentAt: { $lte: new Date(at.getTime() - 60000) } }, { sentAt: null }] }, { $set: { codeHash, expiresAt: new Date(at.getTime() + OTP_LIFETIME_MS), sentAt: at, attempts: 0, consumedAt: null } }, { upsert: true, new: true, runValidators: true });
      } catch (error) {
        if (error.code === 11000) return res.status(429).json({ msg: "Vui lòng chờ 60 giây trước khi yêu cầu OTP mới.", code: "OTP_TOO_FREQUENT" });
        throw error;
      }
      const delivery = await mail({ to: user.email, subject: "Mã OTP đổi mật khẩu — DOCTIS", text: `Mã OTP của bạn là ${code}. Mã có hiệu lực trong 5 phút, chỉ dùng để đổi mật khẩu DOCTIS. Nếu không yêu cầu, bạn có thể bỏ qua email này.` });
      if (!delivery?.accepted?.length || delivery.rejected?.length) throw new Error("EMAIL_NOT_ACCEPTED");
      return res.json({ msg: "Đã gửi mã OTP đến email đã đăng ký.", expiresInSeconds: 300 });
    } catch (error) {
      if (created) await ChallengeModel.deleteOne({ _id: created._id, codeHash: createdHash }).catch(() => {});
      return errorResponse(res, error);
    }
  };
  const verifyOTP = async (req, res) => {
    try { if (!await validChallenge(req, res)) return; return res.json({ msg: "OTP hợp lệ. Vui lòng đặt mật khẩu mới." }); }
    catch (error) { return errorResponse(res, error); }
  };
  const resetPassword = async (req, res) => {
    try {
      const { password, confirmPassword } = req.body || {};
      if (typeof password !== "string" || password.length < 6 || password.length > 128 || typeof confirmPassword !== "string") return res.status(400).json({ msg: "Mật khẩu mới cần từ 6 đến 128 ký tự và có xác nhận mật khẩu." });
      if (password !== confirmPassword) return res.status(400).json({ msg: "Mật khẩu xác nhận không khớp." });
      const checked = await validChallenge(req, res);
      if (!checked) return;
      const passwordHash = await hashPassword(password);
      const claimed = await ChallengeModel.findOneAndUpdate({ _id: checked.challenge._id, codeHash: checked.challenge.codeHash, consumedAt: null, expiresAt: { $gt: now() }, attempts: { $lt: MAX_ATTEMPTS } }, { $set: { consumedAt: now() } }, { new: true });
      if (!claimed) return res.status(400).json({ msg: "OTP đã được sử dụng hoặc hết hạn. Vui lòng yêu cầu mã mới." });
      await UserModel.updateOne({ _id: checked.user._id }, { $set: { password: passwordHash, otp: "", otpExpire: null, resetToken: "" } });
      return res.json({ msg: "Đổi mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới." });
    } catch (error) { return errorResponse(res, error); }
  };
  return { forgotPassword, verifyOTP, resetPassword };
}
module.exports = { ...createPasswordResetController(), createPasswordResetController, matchingHash };
