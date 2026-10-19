const express = require('express');
const crypto = require('node:crypto');
const { runReminderTick } = require('../services/cronService');
const router = express.Router();
// External schedulers may call this once per minute. No scheduler is enabled here.
router.post('/reminders', async (req, res) => {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 32) return res.status(503).json({ msg: 'Tác vụ nhắc chưa được cấu hình.' });
  const provided = req.get('Authorization') || '';
  const wanted = `Bearer ${expected}`;
  const left = Buffer.from(provided), right = Buffer.from(wanted);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return res.status(401).json({ msg: 'Không có quyền chạy tác vụ.' });
  try { return res.json(await runReminderTick()); }
  catch { return res.status(503).json({ msg: 'Chưa chạy được tác vụ nhắc.' }); }
});
module.exports = router;
