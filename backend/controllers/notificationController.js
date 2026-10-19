const Notification = require("../models/Notification");
const { requireId, sendProblem, problem } = require("../services/coordinationUtils");
function createNotificationController({ Model = Notification } = {}) {
  const ownerFilter = req => { requireId(req.user?.id, "Tài khoản"); return { $or: [{ recipientId: req.user.id }, ...(req.user.role === "admin" ? [{ recipientId: null, recipientRole: "admin" }] : [])] }; };
  const view = (value, userId) => ({ id: String(value._id), type: value.type, title: value.title, message: value.message, entityType: value.entityType, entityId: value.entityId ? String(value.entityId) : null, readAt: (value.readBy || []).some(id => String(id) === userId) ? value.updatedAt : null, createdAt: value.createdAt });
  const wrap = action => async (req, res) => { try { return await action(req, res); } catch (error) { return sendProblem(res, error); } };
  return {
    list: wrap(async (req, res) => {
      const owner = ownerFilter(req), limit = Math.max(1, Math.min(100, Number.parseInt(req.query?.limit, 10) || 30));
      if (req.query?.before) requireId(req.query.before, "Mốc thông báo");
      const filter = { ...owner, ...(req.query?.unread === "true" ? { readBy: { $ne: req.user.id } } : {}), ...(req.query?.before ? { _id: { $lt: req.query.before } } : {}) };
      const [items, unreadCount] = await Promise.all([Model.find(filter).sort({ _id: -1 }).limit(limit + 1).lean().exec(), Model.countDocuments({ ...owner, readBy: { $ne: req.user.id } })]);
      const page = items.slice(0, limit), hasMore = items.length > limit;
      return res.json({ notifications: page.map(value => view(value, req.user.id)), unreadCount, hasMore, nextCursor: hasMore ? String(page.at(-1)._id) : null });
    }),
    read: wrap(async (req, res) => {
      const owner = ownerFilter(req); requireId(req.params.id, "Thông báo");
      const item = await Model.findOneAndUpdate({ ...owner, _id: req.params.id }, { $addToSet: { readBy: req.user.id } }, { returnDocument: "after" }).lean().exec();
      if (!item) throw problem("NOTIFICATION_NOT_FOUND", "Không tìm thấy thông báo.", 404);
      return res.json({ notification: view(item, req.user.id) });
    }),
    readAll: wrap(async (req, res) => { await Model.updateMany({ ...ownerFilter(req), readBy: { $ne: req.user.id } }, { $addToSet: { readBy: req.user.id } }); return res.json({ success: true }); }),
  };
}
module.exports = { ...createNotificationController(), createNotificationController };
