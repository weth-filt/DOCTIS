const Ward = require("../models/Ward");
const Hospital = require("../models/Hospital");
const User = require("../models/User");
const SupportRequest = require("../models/SupportRequest");
const DoctorAssignment = require("../models/DoctorAssignment");
const { hospitalAvailability } = require("../services/hospitalAvailability");
const { selectedHospitalCare } = require("../services/diabetesHospitalCatalog");
const { CITY, clean, requireId, requireCity, requireRevision, sourceUrl, problem, runTransaction, sendProblem } = require("../services/coordinationUtils");
function createAdminCatalogController({ WardModel = Ward, HospitalModel = Hospital, UserModel = User, Intake = SupportRequest, Assignment = DoctorAssignment, transaction = runTransaction, now = () => new Date() } = {}) {
  const admin = req => { if (req.user?.role !== "admin") throw problem("ADMIN_REQUIRED", "Chỉ admin mới được quản lý danh mục.", 403); requireId(req.user.id, "Tài khoản"); };
  const wrap = handler => async (req, res) => { try { admin(req); return await handler(req, res); } catch (error) { return sendProblem(res, error); } };
  const controller = {};
  for (const kind of ["wards", "hospitals"]) {
    const Model = kind === "wards" ? WardModel : HospitalModel;
    controller[`list_${kind}`] = wrap(async (req, res) => {
      const values = await Model.find().sort({ name: 1 }).lean().exec();
      if (kind === "wards") return res.json({ wards: values.map(value => ({ ...value, id: String(value._id) })), distanceRanking: "not_available" });
      const [wards, doctors] = await Promise.all([
        WardModel.find({ _id: { $in: values.map(value => value.wardId).filter(Boolean) } }).select("_id code name city active verified").lean().exec(),
        UserModel.find({ role: "doctor", hospitalId: { $in: values.map(value => value._id) } }).select("_id hospitalId").lean().exec(),
      ]);
      const wardById = new Map(wards.map(ward => [String(ward._id), ward]));
      const doctorCounts = new Map();
      for (const doctor of doctors) doctorCounts.set(String(doctor.hospitalId), (doctorCounts.get(String(doctor.hospitalId)) || 0) + 1);
      const hospitals = values.map(value => {
        const ward = wardById.get(String(value.wardId)) || null;
        return { ...value, id: String(value._id), ward, diabetesCare: selectedHospitalCare(value) || { eligible: false }, doctorCount: doctorCounts.get(String(value._id)) || 0, ...hospitalAvailability(value, ward) };
      }).filter(value => value.diabetesCare.eligible || req.query?.includeExcluded === "true");
      return res.json({ hospitals, distanceRanking: "not_available" });
    });
    const save = create => wrap(async (req, res) => {
      const value = await transaction(async session => {
        const body = req.body || {}; requireCity(body.city);
        let current = null;
        if (!create) { requireId(req.params.id, "Danh mục"); requireRevision(body.revision); current = await Model.findById(req.params.id).session(session).lean().exec(); if (!current) throw problem("CATALOG_NOT_FOUND", "Không tìm thấy danh mục.", 404); if (current.revision !== body.revision) throw problem("STALE_CATALOG", "Danh mục vừa thay đổi. Vui lòng tải lại.", 409); }
        const input = { ...(current || {}), ...body };
        const name = clean(input.name, kind === "wards" ? 160 : 200);
        if (!name) throw problem("CATALOG_NAME_REQUIRED", "Vui lòng nhập tên danh mục đã được xác minh.");
        if (typeof input.verified !== "boolean") throw problem("VERIFICATION_REQUIRED", "Cần ghi rõ dữ liệu đã được đối chiếu xác minh hay chưa.");
        const fields = { name, city: CITY, sourceUrl: sourceUrl(input.sourceUrl), active: input.active !== false, verified: input.verified, verifiedAt: input.verified ? now() : null, verifiedBy: input.verified ? req.user.id : null };
        if (kind === "wards") { fields.code = clean(input.code, 40); if (!fields.code) throw problem("WARD_CODE_REQUIRED", "Cần mã phường từ nguồn đã xác minh."); }
        else {
          fields.address = clean(input.address, 500); fields.phone = clean(input.phone, 100);
          const wardId = body.wardId === undefined && current ? current.wardId : input.wardId;
          fields.wardId = wardId ? requireId(String(wardId), "Phường của bệnh viện") : null;
          if (!fields.address || typeof input.acceptingPatients !== "boolean") throw problem("HOSPITAL_FIELDS_REQUIRED", "Cần địa chỉ và trạng thái tiếp nhận của bệnh viện.");
          if (fields.verified && (!fields.phone || !fields.wardId)) throw problem("HOSPITAL_VERIFICATION_INCOMPLETE", "Cần đối chiếu phường hiện tại và số liên hệ trước khi xác minh bệnh viện.");
          if (input.acceptingPatients && !fields.verified) throw problem("HOSPITAL_NOT_VERIFIED", "Chỉ bật tiếp nhận sau khi thông tin bệnh viện đã được xác minh.");
          fields.acceptingPatients = input.acceptingPatients;
          if (fields.wardId && !await WardModel.findOne({ _id: fields.wardId, active: true, verified: true, city: CITY }).session(session).lean().exec()) throw problem("INVALID_WARD", "Phường bệnh viện phải thuộc danh mục Đà Nẵng đã xác minh.");
          if (current && (!fields.active || !fields.verified) && (await Assignment.exists({ hospitalId: current._id, status: "active" }).session(session) || await Intake.exists({ hospitalId: current._id, status: { $in: ["hospital_selected", "accepted", "assigned"] } }).session(session))) throw problem("HOSPITAL_IN_USE", "Cần chuyển hồ sơ và kết thúc phân công liên quan trước khi ngừng xác minh hoặc ngừng hoạt động bệnh viện.", 409);
        }
        if (create) { const [created] = await Model.create([fields], { session }); return created.toObject(); }
        const updated = await Model.findOneAndUpdate({ _id: current._id, revision: body.revision }, { $set: fields, $inc: { revision: 1 } }, { returnDocument: "after", session, runValidators: true }).lean().exec();
        if (!updated) throw problem("STALE_CATALOG", "Danh mục vừa thay đổi. Vui lòng tải lại.", 409); return updated;
      });
      return res.status(create ? 201 : 200).json({ [kind === "wards" ? "ward" : "hospital"]: { ...value, id: String(value._id) }, msg: "Đã lưu danh mục. Hệ thống không tự xếp hạng khoảng cách khi chưa có tọa độ được xác minh." });
    });
    controller[`create_${kind}`] = save(true); controller[`update_${kind}`] = save(false);
    controller[`delete_${kind}`] = wrap(async (req, res) => {
      req.body = { ...(req.body || {}), active: false };
      return controller[`update_${kind}`](req, res);
    });
  }
  return controller;
}
module.exports = { ...createAdminCatalogController(), createAdminCatalogController };
