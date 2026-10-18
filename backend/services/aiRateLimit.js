const AIRateLimit = require("../models/AIRateLimit");
const WINDOW_MS = 60 * 60 * 1000;

function configuredLimit() {
  const value = Number(process.env.AI_MESSAGES_PER_HOUR || 20);
  return Number.isInteger(value) && value >= 1 && value <= 1000 ? value : 20;
}

function createRateLimiter({ Model = AIRateLimit, now = () => new Date(), limit = configuredLimit } = {}) {
  let initialization;
  return async function consumeAIMessage(userId) {
    // A unique owner index must exist before concurrent first requests create
    // buckets on separate function instances. Never fail open on index errors.
    if (typeof Model.init === "function") {
      if (!initialization) initialization = Model.init().catch(error => { initialization = null; throw error; });
      await initialization;
    }
    const at = now();
    const cutoff = new Date(at.getTime() - WINDOW_MS);
    const expiresAt = new Date(at.getTime() + WINDOW_MS * 2);
    const max = limit();
    try { await Model.updateOne({ userId }, { $setOnInsert: { userId, timestamps: [], expiresAt } }, { upsert: true }); }
    catch (error) { if (error.code !== 11000) throw error; }
    const recent = { $filter: { input: { $ifNull: ["$timestamps", []] }, as: "at", cond: { $gt: ["$$at", cutoff] } } };
    const acquired = await Model.findOneAndUpdate(
      { userId, $expr: { $lt: [{ $size: recent }, max] } },
      [{ $set: { timestamps: { $concatArrays: [recent, [at]] }, expiresAt } }],
      { new: true, updatePipeline: true }
    ).lean().exec();
    if (acquired) return { remaining: Math.max(0, max - acquired.timestamps.length), limit: max };
    const bucket = await Model.findOne({ userId }).select("timestamps").lean().exec();
    const first = (bucket?.timestamps || []).map(value => new Date(value).getTime()).filter(value => value > cutoff.getTime()).sort((a, b) => a - b)[0];
    const retryAfterSeconds = Math.max(1, Math.ceil(((first || at.getTime()) + WINDOW_MS - at.getTime()) / 1000));
    const error = new Error(`Bạn đã dùng hết ${max} lượt AI trong một giờ. Vui lòng thử lại sau.`);
    error.code = "AI_RATE_LIMITED";
    error.status = 429;
    error.retryAfterSeconds = retryAfterSeconds;
    throw error;
  };
}

module.exports = { consumeAIMessage: createRateLimiter(), createRateLimiter, configuredLimit, WINDOW_MS };
