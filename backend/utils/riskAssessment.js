const rules = require('../config/monitoringRules.json');
const compare = { '>': (a, b) => a > b, '<': (a, b) => a < b, '>=': (a, b) => a >= b };
function getRisk(health) {
  const values = {};
  for (const [key] of rules.levels.flatMap((level) => level.conditions)) {
    const raw = health?.[key];
    values[key] = raw === null || raw === undefined || raw === '' || !Number.isFinite(Number(raw)) ? null : Number(raw);
  }
  for (const level of rules.levels) {
    if (level.conditions.some(([key, op, threshold]) => values[key] !== null && compare[op](values[key], threshold))) return level.label;
  }
  return Object.values(values).some((value) => value !== null) ? rules.stableLabel : rules.missingLabel;
}
getRisk.ruleVersion = rules.version;
module.exports = getRisk;
