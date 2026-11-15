// Whole-bank audit: structural checks on every question + level coverage. Usage: node scripts/audit-bank.mjs
import { readFileSync } from 'node:fs';
import { EXAMS, getLevel } from '../src/lib/exam.js';

const seed = JSON.parse(readFileSync(new URL('../public/_seed/seed.json', import.meta.url), 'utf8'));
const Q = seed.questions.map(([id, exam, section, kind, difficulty, passage, stem, image_svg, choices, answer, explanation]) => ({ id, exam, section, kind, difficulty, passage, stem, image_svg, choices: choices ? JSON.parse(choices) : null, answer, explanation }));
const issues = [];
const flag = (q, msg) => issues.push(`${q.exam}/${q.section} ${q.id}: ${msg} | ${q.stem.slice(0, 70).replace(/\n/g, ' ')}`);
const GENERIC = /^(think about the relationship|find the answer in the text|listen for the key detail|find the relationship)/i;

const stemSeen = new Map();
for (const q of Q) {
  if (!EXAMS[q.exam] || !EXAMS[q.exam].sections.some((s) => s.key === q.section)) flag(q, 'unknown exam/section');
  if (!(q.difficulty >= 1 && q.difficulty <= (q.exam_type.startsWith('KR_') ? 6 : 5))) flag(q, 'difficulty out of range');
  if (q.kind !== 'mcq') continue;
  const c = q.choices || [];
  if (c.length < 3) flag(q, `only ${c.length} choices`);
  if (new Set(c.map((x) => String(x).trim())).size !== c.length) flag(q, 'duplicate choices');
  if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < c.length)) flag(q, 'answer index out of range');
  if (c.some((x) => /\d\.\d{4,}/.test(String(x)))) flag(q, 'floating-point noise in a choice');
  if (c.some((x) => /undefined|NaN|null|\[object/.test(String(x))) || /undefined|NaN|\[object/.test(q.stem)) flag(q, 'broken value (undefined/NaN)');
  if (!q.explanation || q.explanation.trim().length < 8) flag(q, 'missing/short explanation');
  else if (GENERIC.test(q.explanation.trim())) flag(q, 'generic explanation');
  const needsPicture = /\b(the graph|the chart|the histogram|the scatterplot|the figure|picture graph|the table|the clock|is shaded|the number line|reflected across|shown)\b/i.test(q.stem) && !/described|in the passage/i.test(q.stem);
  if (needsPicture && !q.image_svg && !q.passage) flag(q, 'stem refers to a picture/table but none is attached');
  if (/\b(the passage|the text|according to the speaker|the announcement|the talk|the conversation)\b/i.test(q.stem) && !q.passage) flag(q, 'stem refers to a passage but none is attached');
  if ((q.section === 'listening') && !q.passage) flag(q, 'listening item without a script');
  if (q.image_svg || c.some((x) => String(x).startsWith('svg:'))) continue; // figure items share generic stems on purpose
  const key = `${q.exam}|${q.section}|${q.passage || ''}|${q.stem.trim().toLowerCase()}`;
  if (stemSeen.has(key)) flag(q, `same stem as ${stemSeen.get(key)}`); else stemSeen.set(key, q.id);
}

// Level coverage: for every exam/level/section, how many questions fall in the level's difficulty window vs. section length
const coverage = [];
for (const [exam, ex] of Object.entries(EXAMS)) {
  for (const lv of ex.levels || [getLevel(exam)]) {
    for (const sec of ex.sections.filter((s) => !s.manual)) {
      const inWin = Q.filter((q) => q.exam === exam && q.section === sec.key && !/[08]$/.test(q.id) && q.difficulty >= lv.dmin && q.difficulty <= lv.dmax).length; // paid pool only
      if (inWin < sec.n * 1.5) coverage.push(`${exam} ${lv.name} / ${sec.name}: ${inWin} questions in difficulty ${lv.dmin}-${lv.dmax} for a ${sec.n}-question section${inWin < sec.n ? ' (window will widen)' : ' (thin: little variety on retakes)'}`);
    }
  }
}

const pos = [0, 0, 0, 0]; for (const q of Q) if (q.kind === 'mcq' && q.answer < 4) pos[q.answer]++;
console.log(`questions: ${Q.length} | answer positions A-D: ${pos.join('/')}`);
console.log(`\n== item issues (${issues.length}) ==\n` + (issues.slice(0, process.env.ALL ? 1e9 : 60).join('\n') || 'none'));
console.log(`\n== level coverage warnings (${coverage.length}) ==\n` + (coverage.join('\n') || 'none'));
process.exitCode = issues.length ? 1 : 0;
