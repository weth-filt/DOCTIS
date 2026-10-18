const test = require("node:test");
const assert = require("node:assert/strict");
const { createRateLimiter, configuredLimit, WINDOW_MS } = require("../services/aiRateLimit");

function storage() {
  const buckets = new Map();
  const Model = {
    async updateOne({ userId }, update) { if (!buckets.has(userId)) buckets.set(userId, { ...update.$setOnInsert }); },
    findOneAndUpdate(query, pipeline, options) {
      assert.equal(options.updatePipeline, true);
      return { lean() { return this; }, async exec() {
        const value = buckets.get(query.userId);
        const cutoff = query.$expr.$lt[0].$size.$filter.cond.$gt[1];
        const recent = value.timestamps.filter(at => at > cutoff);
        if (recent.length >= query.$expr.$lt[1]) return null;
        value.timestamps = [...recent, pipeline[0].$set.timestamps.$concatArrays[1][0]];
        value.expiresAt = pipeline[0].$set.expiresAt;
        return { ...value };
      } };
    },
    findOne({ userId }) { return { select() { return this; }, lean() { return this; }, async exec() { return buckets.get(userId); } }; },
  };
  return { Model, buckets };
}

test("sliding rate limiter reserves exactly20 across concurrent calls and isolates owners", async () => {
  const { Model, buckets } = storage();
  const consume = createRateLimiter({ Model, now: () => new Date("2026-10-19T00:00:00Z"), limit: () => 20 });
  const attempts = await Promise.allSettled(Array.from({ length: 35 }, () => consume("user-a")));
  assert.equal(attempts.filter(value => value.status === "fulfilled").length, 20);
  for (const result of attempts.filter(value => value.status === "rejected")) {
    assert.equal(result.reason.code, "AI_RATE_LIMITED");
    assert.equal(result.reason.status, 429);
    assert.equal(result.reason.retryAfterSeconds, 3600);
  }
  assert.equal(buckets.get("user-a").timestamps.length, 20);
  assert.equal((await consume("user-b")).remaining, 19);
});

test("sliding window expires individual events rather than resetting at wall-clock hour", async () => {
  const { Model } = storage();
  let timestamp = new Date("2026-10-19T00:59:00Z").getTime();
  const consume = createRateLimiter({ Model, now: () => new Date(timestamp), limit: () => 1 });
  await consume("user-a");
  timestamp += 60000;
  await assert.rejects(consume("user-a"), { code: "AI_RATE_LIMITED", retryAfterSeconds: 3540 });
  timestamp += WINDOW_MS - 60000;
  assert.equal((await consume("user-a")).remaining, 0);
});

test("configured rate limit uses bounded environment setting with default20", () => {
  const old = process.env.AI_MESSAGES_PER_HOUR;
  try {
    for (const invalid of ["", "NaN", "0", "1001", "2.5"]) { process.env.AI_MESSAGES_PER_HOUR = invalid; assert.equal(configuredLimit(), 20); }
    process.env.AI_MESSAGES_PER_HOUR = "7";
    assert.equal(configuredLimit(), 7);
  } finally { if (old === undefined) delete process.env.AI_MESSAGES_PER_HOUR; else process.env.AI_MESSAGES_PER_HOUR = old; }
});
