// Preview the new workflow with an isolated, local database. Never loads .env.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const directory = path.resolve(__dirname, '../../.local-public-check');
const uri = 'mongodb://127.0.0.1:27028/doctis_public_preview?replicaSet=doctis-local-review';
async function main() {
  const build = path.join(directory, 'frontend-build');
  if (!fs.existsSync(path.join(build, 'index.html'))) throw new Error('Build the isolated frontend preview first.');
  fs.mkdirSync(directory, { recursive: true });
  const keyFile = path.join(directory, 'preview-session.key');
  if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(48).toString('hex'), { flag: 'wx' });
  process.env.JWT_SECRET = fs.readFileSync(keyFile, 'utf8').trim();
  process.env.MONGO_URI = uri;
  process.env.AI_PROVIDER = 'ollama';
  process.env.OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:4b-instruct-2507-q4_K_M';
  for (const key of ['VERCEL','GEMINI_API_KEY','SMTP_HOST','SMTP_USER','SMTP_PASS','EMAIL_USER','EMAIL_PASS','CRON_SECRET']) delete process.env[key];
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const preview = express();
  const api = require('../app');
  preview.use((req, res, next) => req.path === '/api' || req.path.startsWith('/api/') ? api(req, res, next) : next());
  preview.use(express.static(build, { dotfiles: 'allow' }));
  preview.use((req, res) => { if (req.method === 'GET') return res.sendFile(path.join(build, 'index.html'), { dotfiles: 'allow' }); return res.sendStatus(404); });
  preview.listen(5001, '127.0.0.1', () => console.log('Isolated DOCTIS preview: http://127.0.0.1:5001 — local data only; SMTP and scheduler disabled.'));
}
main().catch(() => { console.error('Preview unavailable. Check isolated Mongo port 27028 and frontend preview build. No connection details logged.'); process.exit(1); });
