// Passage statistics for a hand-written bank: words, Flesch-Kincaid grade, questions per passage, difficulties.
// Usage: node scripts/passage-stats.mjs scripts/bank/<file>.json
import fs from 'node:fs';
const items = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const words = (t) => (String(t || '').match(/[A-Za-z0-9'’-]+/g) || []).length;
const sentences = (t) => Math.max(1, (String(t || '').match(/[.!?]+(["”’)]*)(\s|$)/g) || []).length);
const syl = (w) => { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (w.length <= 3) return 1; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); return Math.max(1, (w.match(/[aeiouy]{1,2}/g) || []).length); };
export const fk = (t) => { const ws = String(t || '').match(/[A-Za-z]+/g) || []; if (!ws.length) return 0; return 0.39 * (ws.length / sentences(t)) + 11.8 * (ws.reduce((a, w) => a + syl(w), 0) / ws.length) - 15.59; };
const groups = new Map();
items.forEach((it, i) => { const k = it.passage || `(no passage #${i})`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push({ i, ...it }); });
let n = 0;
for (const [p, qs] of groups) {
  n++;
  const ds = [...new Set(qs.map((q) => q.difficulty))].join(',');
  console.log(`#${n} [${qs[0].exam_type}/${qs[0].section}] words ${words(p)} · FK ${Math.round(fk(p) * 10) / 10} · ${qs.length} Q (items ${qs.map((q) => q.i).join(',')}) · difficulty ${ds} · "${p.slice(0, 60).replace(/\n/g, ' ')}…"`);
}
const bad = items.map((it, i) => [i, it]).filter(([, it]) => !(Array.isArray(it.choices) && it.choices.length === 4 && Number.isInteger(it.answer) && it.answer >= 0 && it.answer < 4 && it.stem && it.explanation && it.difficulty >= 1 && it.difficulty <= 5));
console.log(`\n${items.length} items, ${groups.size} passages${bad.length ? ` · INVALID items: ${bad.map(([i]) => i).join(',')}` : ' · all items structurally valid'}`);
