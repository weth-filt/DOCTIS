const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const SupportRequest = require("../models/SupportRequest");
const { validateAddress } = require("./serviceArea");
const { createNotification } = require("./notificationService");
const { clean, problem, runTransaction } = require("./coordinationUtils");

function registrationInput(input = {}) {
  const cccd = clean(input.cccd, 41), username = clean(input.username, 101), email = clean(input.email, 255).toLowerCase();
  if (!cccd || cccd.length > 40 || !username || username.length > 100 || !email || email.length > 254 || typeof input.password !== "string" || !input.password || typeof input.confirmPassword !== "string") throw problem("REGISTRATION_REQUIRED", "Vui lòng nhập đầy đủ CCCD, tên đăng nhập, email, mật khẩu và xác nhận mật khẩu.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw problem("INVALID_EMAIL", "Địa chỉ email không hợp lệ.");
  if (input.password !== input.confirmPassword) throw problem("PASSWORD_MISMATCH", "Mật khẩu không khớp.");
  if (input.password.length < 6 || input.password.length > 128) throw problem("INVALID_PASSWORD", "Mật khẩu cần từ 6 đến 128 ký tự.");
  if (input.requestId !== undefined && (typeof input.requestId !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(input.requestId))) throw problem("INVALID_REQUEST_ID", "Mã đăng ký không hợp lệ.");
  return { cccd, username, email, password: input.password, fullName: clean(input.fullName, 150) || username, phone: clean(input.phone, 50), requestId: input.requestId };
}
function publicRegisteredUser(user) {
  return { id: user._id, _id: user._id, username: user.username, email: user.email, role: user.role || "user", fullName: user.fullName, address: user.address, wardId: user.wardId, ward: user.ward, city: user.city, province: user.province, hospitalId: user.hospitalId || null, doctorId: user.doctorId || null };
}
function createRegistrationService({ UserModel = User, Intake = SupportRequest, addressValidator = validateAddress, notify = createNotification, transaction = runTransaction, hashPassword = value => bcrypt.hash(value, 10), comparePassword = bcrypt.compare, now = () => new Date() } = {}) {
  return async function registerPatient(body) {
    const input = registrationInput(body);
    const password = await hashPassword(input.password);
    return transaction(async session => {
      const address = await addressValidator(body, session);
      const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ cccd: input.cccd, username: input.username, email: input.email, address: address.address, wardId: String(address.wardId), city: address.city })).digest("hex");
      const key = input.requestId ? crypto.createHash("sha256").update(input.requestId).digest("hex") : undefined;
      if (key) {
        const prior = await Intake.findOne({ registrationKey: key }).select("+registrationFingerprint").session(session).lean().exec();
        if (prior) {
          const owner = await UserModel.findById(prior.patientId).session(session).lean().exec();
          if (!owner || prior.registrationFingerprint !== fingerprint || !await comparePassword(input.password, owner.password)) throw problem("REGISTRATION_CONFLICT", "Yêu cầu đăng ký này đã được sử dụng. Vui lòng kiểm tra lại thông tin.", 409);
          return { user: publicRegisteredUser(owner), intakeId: prior._id, replayed: true };
        }
      }
      const exists = await UserModel.findOne({ $or: [{ cccd: input.cccd }, { username: input.username }, { email: input.email }] }).select("_id").session(session).lean().exec();
      if (exists) throw problem("REGISTRATION_EXISTS", "Email, username hoặc CCCD đã tồn tại.", 409);
      const [user] = await UserModel.create([{ cccd: input.cccd, username: input.username, email: input.email, password, fullName: input.fullName, phone: input.phone, role: "user", ...address }], { session });
      const [intake] = await Intake.create([{ patientId: user._id, wardId: address.wardId, address: address.address, city: address.city, status: "waiting_hospital", revision: 0, ...(key ? { registrationKey: key, registrationFingerprint: fingerprint } : {}), history: [{ action: "register", toStatus: "waiting_hospital", actorId: user._id, at: now(), revision: 0 }] }], { session });
      await notify({ recipientRole: "admin", eventKey: `registration:${user._id}`, type: "patient_registered", title: "Có bệnh nhân mới đăng ký", message: "Một bệnh nhân đã đăng ký địa chỉ trong phạm vi Đà Nẵng và đang chờ cập nhật bệnh viện.", entityType: "intake", entityId: intake._id }, { session });
      return { user: publicRegisteredUser(user), intakeId: intake._id, replayed: false };
    });
  };
}
module.exports = { registerPatient: createRegistrationService(), createRegistrationService, registrationInput, publicRegisteredUser };
