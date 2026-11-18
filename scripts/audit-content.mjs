// Content audit: reading passages (length, readability, count per level) and math figures (SVG coverage per level).
// Usage: node scripts/audit-content.mjs [--json]
import fs from 'node:fs';
import { EXAMS } from '../src/lib/exam.js';

const seed = JSON.parse(fs.readFileSync(new URL('../public/_seed/seed.json', import.meta.url)));
const Q = seed.questions.map(([id, exam, section, kind, diff, passage, stem, svg, choices]) => ({ id, exam, section, kind, diff, passage, stem, svg, choices: choices ? JSON.parse(choices) : [] }))
  .filter((q) => !/[08]$/.test(q.id)); // paid pool only (ids ending 0/8 are the free sample pool)

const words = (t) => (String(t || '').match(/[A-Za-z0-9'’-]+/g) || []).length;
const sentences = (t) => Math.max(1, (String(t || '').match(/[.!?]+(\s|$)/g) || []).length);
const syl = (w) => { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (w.length <= 3) return 1; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); return Math.max(1, (w.match(/[aeiouy]{1,2}/g) || []).length); };
const fk = (t) => { const ws = String(t || '').match(/[A-Za-z]+/g) || []; if (!ws.length) return 0; return 0.39 * (ws.length / sentences(t)) + 11.8 * (ws.reduce((a, w) => a + syl(w), 0) / ws.length) - 15.59; };
const stat = (a) => { if (!a.length) return '-'; const s = [...a].sort((x, y) => x - y); return `${s[0]}/${s[Math.floor(s.length / 2)]}/${s[s.length - 1]}`; };
const r1 = (x) => Math.round(x * 10) / 10;

const READING = { MAP: ['reading'], WIDA: ['reading', 'listening'], SSAT: ['reading'], ISEE: ['reading'], SAT: ['rw'], TOEFLJ: ['reading', 'listening'], TOEICB: ['reading', 'listening'] };
const MATH = { MAP: ['math'], CAT4: ['quantitative', 'nonverbal', 'spatial'], SCAT: ['quantitative'], SSAT: ['quantitative'], ISEE: ['quantitative', 'math'], COGAT: ['quantitative', 'nonverbal'], SAT: ['math'] };

const out = { reading: [], math: [] };
console.log('== READING: passages per level (paid pool) ==');
console.log('exam/section | level (diff) | Qs | passages | words min/med/max | FK grade min/med/max | Q per passage');
for (const [exam, secs] of Object.entries(READING)) for (const sec of secs) {
  for (const lv of EXAMS[exam].levels || [{ key: 'all', dmin: 1, dmax: 5 }]) {
    const qs = Q.filter((q) => q.exam === exam && q.section === sec && q.diff >= lv.dmin && q.diff <= lv.dmax);
    const ps = [...new Set(qs.map((q) => q.passage).filter(Boolean))];
    const w = ps.map(words), g = ps.map((p) => r1(fk(p)));
    const row = { exam, sec, level: lv.key, dmin: lv.dmin, dmax: lv.dmax, qs: qs.length, passages: ps.length, words: stat(w), fk: stat(g), qpp: ps.length ? r1(qs.filter((q) => q.passage).length / ps.length) : 0 };
    out.reading.push(row);
    console.log(`${exam}/${sec} | ${lv.key} (${lv.dmin}-${lv.dmax}) | ${qs.length} | ${ps.length} | ${row.words} | ${row.fk} | ${row.qpp}`);
  }
}
console.log('\n== MATH / FIGURES: SVG coverage per level (paid pool) ==');
const kindOf = (q) => {
  const t = `${q.stem} ${q.svg || ''}`;
  if (/<polyline|<path[^>]*d="M[^"]*L/.test(q.svg || '') && /axis|graph|line|plot|slope|y\s*=|coordinate/i.test(t)) return 'graph';
  if (/bar|chart|pictograph|histogram|survey|tally/i.test(q.stem)) return 'chart';
  if (/table/i.test(q.stem)) return 'table';
  if (/triangle|angle|circle|rectangle|square|area|perimeter|polygon|radius|volume|cube|prism|shape|figure|fold|rotate|mirror|cut|grid/i.test(q.stem)) return 'geometry/figure';
  return 'other';
};
console.log('exam/section | level | Qs | with SVG | % | graph / chart / table / geometry / other');
for (const [exam, secs] of Object.entries(MATH)) for (const sec of secs) {
  for (const lv of EXAMS[exam].levels || [{ key: 'all', dmin: 1, dmax: 5 }]) {
    const qs = Q.filter((q) => q.exam === exam && q.section === sec && q.diff >= lv.dmin && q.diff <= lv.dmax);
    const sv = qs.filter((q) => q.svg || q.choices.some((c) => String(c).startsWith('svg:')));
    const k = {}; for (const q of sv) k[kindOf(q)] = (k[kindOf(q)] || 0) + 1;
    const row = { exam, sec, level: lv.key, qs: qs.length, svg: sv.length, pct: qs.length ? Math.round((sv.length / qs.length) * 100) : 0, kinds: k };
    out.math.push(row);
    console.log(`${exam}/${sec} | ${lv.key} | ${qs.length} | ${sv.length} | ${row.pct}% | ${['graph', 'chart', 'table', 'geometry/figure', 'other'].map((x) => k[x] || 0).join(' / ')}`);
  }
}
// SVG hygiene: every figure must scale (viewBox) and stay legible
const svgs = seed.questions.flatMap((q) => [q[7], ...(q[8] ? JSON.parse(q[8]) : []).filter((c) => String(c).startsWith('svg:')).map((c) => c.slice(4))]).filter(Boolean);
const noVB = svgs.filter((s) => !/viewBox=/.test(s)).length;
const fixedWide = svgs.filter((s) => { const m = s.match(/<svg[^>]*\swidth="(\d+)/); return m && +m[1] > 640; }).length;
const tinyText = svgs.filter((s) => (s.match(/font-size="(\d+(\.\d+)?)"/g) || []).some((f) => parseFloat(f.split('"')[1]) < 9)).length;
console.log(`\n== SVG hygiene == total ${svgs.length} · without viewBox ${noVB} · fixed width >640px ${fixedWide} · font-size <9 ${tinyText}`);
if (process.argv.includes('--json')) fs.writeFileSync('content-audit.json', JSON.stringify(out, null, 1));
