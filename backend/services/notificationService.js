const Notification = require("../models/Notification");
function createNotificationService({ Model = Notification } = {}) {
  let initialization;
  const ready = async () => { if (typeof Model.init !== "function") return; if (!initialization) initialization = Model.init().catch(error => { initialization = null; throw error; }); await initialization; };
  const create = async (input, { session } = {}) => {
    // Session callers prepare indexes BEFORE opening their transaction, so
    // index creation cannot wait on a collection lock held by that transaction.
    if (!session) await ready();
    return Model.findOneAndUpdate({ eventKey: input.eventKey }, { $setOnInsert: { recipientId: input.recipientId || null, recipientRole: input.recipientRole, eventKey: input.eventKey, type: input.type, title: input.title, message: input.message || "", entityType: input.entityType || "", entityId: input.entityId || null, readBy: [] } }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, ...(session ? { session } : {}) }).lean().exec();
  };
  create.ready = ready;
  return create;
}
const createNotification = createNotificationService();
module.exports = { createNotification, createNotificationService, ensureNotificationsReady: createNotification.ready };
