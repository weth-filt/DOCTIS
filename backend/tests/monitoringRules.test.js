const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const getRisk = require('../utils/riskAssessment');
const rules = require('../config/monitoringRules.json');
const root = path.resolve(__dirname, '../..');
const cases = [null, {}, { glucose: null, bmi: '' }, { glucose: 'invalid' }];
for (const [key, values] of Object.entries({ glucose: [0, 69, 70, 126, 127, 180, 181], bmi: [24.9, 25, 29.9, 30], heartRate: [49, 50, 100, 101, 120, 121], systolic: [140, 141, 160, 161], diastolic: [90, 91, 100, 101] })) for (const value of values) cases.push({ [key]: value });
function original(health) {
  const v = key => health?.[key] === null || health?.[key] === undefined || health[key] === '' || !Number.isFinite(Number(health[key])) ? null : Number(health[key]);
  const g=v('glucose'), b=v('bmi'), h=v('heartRate'), s=v('systolic'), d=v('diastolic');
  if ((g!==null && (g>180 || g<70)) || (b!==null && b>=30) || (h!==null && (h>120 || h<50)) || (s!==null && s>160) || (d!==null && d>100)) return 'Nguy hiểm';
  if ((g!==null && g>126) || (b!==null && b>=25) || (h!==null && h>100) || (s!==null && s>140) || (d!==null && d>90)) return 'Cao';
  return [g,b,h,s,d].some(n=>n!==null) ? 'Ổn định' : 'Chưa có dữ liệu';
}
test('canonical rules retain every original boundary and missing-data result', () => {
  for (const row of cases) assert.equal(getRisk(row), original(row), JSON.stringify(row));
});
test('generated frontend and Python mirrors match the canonical JSON exactly', () => {
  const source=fs.readFileSync(path.join(root,'backend/config/monitoringRules.json'),'utf8');
  for(const file of ['frontend/src/config/monitoringRules.json','AI/monitoring_rules.json']) assert.equal(fs.readFileSync(path.join(root,file),'utf8'),source);
});
test('frontend evaluator returns the same alerts as backend', () => {
  const code=fs.readFileSync(path.join(root,'frontend/src/utils/riskAssessment.js'),'utf8').replace(/import rules[^\n]+\n/, '').replace('export default getRisk;', 'result = getRisk;');
  const context={rules,result:null}; vm.runInNewContext(code,context);
  for(const row of cases) assert.equal(context.result(row),getRisk(row));
});
test('Python rule evaluator matches JavaScript without loading/training a model', {skip: !process.env.PYTHON_EXE}, () => {
  const script='import sys,json; sys.path.insert(0,"AI"); from monitoring_rules import assess; print(json.dumps([assess(row) for row in json.load(sys.stdin)],ensure_ascii=True))';
  const run=spawnSync(process.env.PYTHON_EXE,['-c',script],{cwd:root,input:JSON.stringify(cases),encoding:'utf8'});
  assert.equal(run.status,0,run.stderr); assert.deepEqual(JSON.parse(run.stdout),cases.map(getRisk));
});
