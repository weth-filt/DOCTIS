const Ward = require("../models/Ward");
const { CITY, clean, requireCity, requireId, problem } = require("./coordinationUtils");
function createServiceArea({ WardModel = Ward } = {}) {
  return async function validateAddress(input = {}, session) {
    requireCity(input.city);
    requireId(input.wardId, "Phường");
    const address = clean(input.address ?? input.addressDetail, 501);
    if (address.length < 3 || address.length > 500) throw problem("ADDRESS_REQUIRED", "Vui lòng nhập địa chỉ chi tiết từ 3 đến 500 ký tự.");
    const query = WardModel.findOne({ _id: input.wardId, city: CITY, active: true, verified: true });
    if (session) query.session(session);
    const ward = await query.lean().exec();
    if (!ward) throw problem("INVALID_WARD", "Phường không thuộc danh mục Đà Nẵng đang được xác minh và tiếp nhận.");
    if (session) { const reserved = await WardModel.updateOne({ _id: ward._id, city: CITY, active: true, verified: true }, { $inc: { __v: 1 } }, { session }); if (!reserved.matchedCount) throw problem("INVALID_WARD", "Danh mục phường vừa thay đổi. Vui lòng chọn lại.", 409); }
    return { address, wardId: ward._id, ward: ward.name, city: CITY, province: CITY };
  };
}
module.exports = { validateAddress: createServiceArea(), createServiceArea };
