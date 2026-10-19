const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'backend/config/monitoringRules.json'), 'utf8');
const targets = ['frontend/src/config/monitoringRules.json', 'AI/monitoring_rules.json'];
for (const target of targets) {
  const file = path.join(root, target);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== source) throw new Error(`Rule mirror is out of date: ${target}`);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, source);
  }
}
console.log(process.argv.includes('--check') ? 'Monitoring rule mirrors match.' : 'Monitoring rule mirrors synchronized.');
