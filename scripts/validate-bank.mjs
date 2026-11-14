// Usage: node scripts/validate-bank.mjs scripts/bank/<file>.json   (exit 1 on any problem)
import { readFileSync } from 'node:fs';
import { EXAMS } from '../src/lib/exam.js';
const file = process.argv[2];
const items = JSON.parse(readFileSync(file, 'utf8'));
const bad = [], seen = new Set(), pos = [0, 0, 0, 0], by = {};
if (!Array.isArray(items)) { console.error('top level must be an array'); process.exit(1); }
items.forEach((q, i) => {
  const w = (m) => bad.push(`#${i} ${m}`);
  const ex = EXAMS[q.exam_type];
  if (!ex) return w(`unknown exam_type ${q.exam_type}`);
  if (!ex.sections.some((s) => s.key === q.section)) w(`bad section ${q.section} for ${q.exam_type}`);
  if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 5) w('difficulty 1-5');
  if (typeof q.stem !== 'string' || q.stem.trim().length < 8) w('stem too short');
  if (!Array.isArray(q.choices) || q.choices.length !== 4) w('need exactly 4 choices');
  else {
    if (new Set(q.choices.map((c) => String(c).trim().toLowerCase())).size !== 4) w('duplicate choices');
    if (q.choices.some((c) => typeof c !== 'string' || !c.trim())) w('empty/non-string choice');
  }
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) w('answer must be 0-3'); else pos[q.answer]++;
  if (!q.explanation || q.explanation.length < 6) w('missing explanation');
  const key = (q.passage || '').slice(0, 60) + '|' + q.stem.trim().toLowerCase();
  if (seen.has(key)) w('duplicate question'); seen.add(key);
  by[`${q.exam_type}/${q.section}`] = (by[`${q.exam_type}/${q.section}`] || 0) + 1;
});
console.log(`${file}: ${items.length} items`, by, 'answer positions A-D:', pos.join('/'));
const total = pos.reduce((a, b) => a + b, 0);
if (total > 20 && Math.max(...pos) / total > 0.4) bad.push(`answer positions are skewed (${pos.join('/')}) - rebalance`);
if (bad.length) { console.error('PROBLEMS:\n' + bad.slice(0, 25).join('\n')); process.exit(1); }
