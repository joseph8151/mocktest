// Question-pool depth: for every exam / level / section, how many complete NON-REPEATING tests the paid pool supports.
// (passage sections are counted in passages: a test uses whole passages.) Usage: node scripts/audit-pool.mjs [--all]
import fs from 'node:fs';
import { EXAMS, levelBank } from '../src/lib/exam.js';
const seed = JSON.parse(fs.readFileSync(new URL('../public/_seed/seed.json', import.meta.url)));
const Q = seed.questions.map(([id, exam, section, kind, difficulty, passage]) => ({ id, exam, section, kind, difficulty, pk: passage ? passage.slice(0, 160) : null }))
  .filter((q) => !/[08]$/.test(q.id));
const rows = [];
for (const [exam, ex] of Object.entries(EXAMS)) {
  for (const lv of ex.levels || [{ key: 'all', name: 'All', dmin: 1, dmax: 5 }]) {
    let worst = Infinity, detail = [];
    for (const sec of ex.sections) {
      if (sec.manual) continue;
      const bank = Q.filter((q) => q.exam === exam && q.section === sec.key);
      const { pool, lo, hi } = levelBank(bank, lv, sec.n);
      const passages = new Set(pool.map((q) => q.pk).filter(Boolean)).size, grouped = pool.filter((q) => q.pk).length * 2 > pool.length;
      let tests;
      if (ex.adaptive) tests = Math.floor(pool.length / sec.n); // adaptive: ~n served per section from the level band
      else if (grouped) { const perTest = Math.max(1, Math.round(sec.n / (pool.filter((q) => q.pk).length / passages))); tests = Math.floor(passages / perTest); }
      else tests = Math.floor(pool.length / sec.n);
      worst = Math.min(worst, tests);
      detail.push(`${sec.key} ${pool.length}q${grouped ? `/${passages}p` : ''} d${lo}-${hi}${lo !== lv.dmin || hi !== lv.dmax ? '*' : ''} →${tests}`);
    }
    rows.push({ exam, level: lv.key, tests: worst, detail: detail.join(' · ') });
  }
}
const all = process.argv.includes('--all');
console.log('exam/level | full non-repeating tests (weakest section) | per section: pool q [/passages] difficulty band (* = band widened) → tests');
for (const r of rows) if (all || r.tests < 10) console.log(`${r.exam}/${r.level} | ${r.tests} | ${r.detail}`);
const dist = {}; for (const r of rows) { const b = r.tests >= 10 ? '10+' : r.tests >= 5 ? '5-9' : r.tests >= 3 ? '3-4' : '<3'; dist[b] = (dist[b] || 0) + 1; }
console.log('\nlevels by depth:', JSON.stringify(dist), `of ${rows.length}`);
