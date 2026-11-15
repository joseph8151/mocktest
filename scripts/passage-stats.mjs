// Passage statistics for a hand-written bank: words (English) / characters (Korean), Flesch-Kincaid grade (English),
// questions per passage, difficulties, and structural validation of every item.
// Usage: node scripts/passage-stats.mjs scripts/bank/<file>.json
import fs from 'node:fs';
const items = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const words = (t) => (String(t || '').match(/[A-Za-z0-9'’-]+/g) || []).length;
const hangul = (t) => (String(t || '').match(/[가-힣]/g) || []).length;
const sentences = (t) => Math.max(1, (String(t || '').match(/[.!?]+(["”’)]*)(\s|$)/g) || []).length);
const syl = (w) => { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (w.length <= 3) return 1; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); return Math.max(1, (w.match(/[aeiouy]{1,2}/g) || []).length); };
export const fk = (t) => { const ws = String(t || '').match(/[A-Za-z]+/g) || []; if (!ws.length) return 0; return 0.39 * (ws.length / sentences(t)) + 11.8 * (ws.reduce((a, w) => a + syl(w), 0) / ws.length) - 15.59; };
const groups = new Map();
items.forEach((it, i) => { const k = it.passage || `(no passage #${i})`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push({ i, ...it }); });
let n = 0;
for (const [p, qs] of groups) {
  if (!qs[0].passage) continue;
  n++;
  const ds = [...new Set(qs.map((q) => q.difficulty))].join(',');
  const ko = hangul(p) > words(p);
  const size = ko ? `${String(p).replace(/\s/g, '').length} chars (${p.length} with spaces)` : `words ${words(p)} · FK ${Math.round(fk(p) * 10) / 10}`;
  console.log(`#${n} [${qs[0].exam_type}/${qs[0].section}] ${size} · ${qs.length} Q (items ${qs.map((q) => q.i).join(',')}) · difficulty ${ds} · "${p.slice(0, 50).replace(/\n/g, ' ')}…"`);
}
const valid = (it) => {
  if (!it.exam_type || !it.section || !it.stem || !it.explanation) return false;
  if (!(Number.isInteger(it.difficulty) && it.difficulty >= 1 && it.difficulty <= 6)) return false;
  const kind = it.kind || 'mcq';
  if (kind === 'text') return !it.choices || it.choices.length === 0;
  if (kind === 'num') return Array.isArray(it.choices) && it.choices.length >= 1 && it.choices.every((c) => /^-?\d+(\.\d+)?$|^-?\d+\/\d+$/.test(String(c).trim()));
  return Array.isArray(it.choices) && it.choices.length === 4 && new Set(it.choices.map(String)).size === 4 && Number.isInteger(it.answer) && it.answer >= 0 && it.answer < 4
    && (!it.image_svg || /^<svg[\s\S]*viewBox=/.test(it.image_svg));
};
const bad = items.map((it, i) => [i, it]).filter(([, it]) => !valid(it));
const by = {}; for (const it of items) { const k = `${it.section}/d${it.difficulty}/${it.kind || 'mcq'}`; by[k] = (by[k] || 0) + 1; }
console.log('\ncounts:', JSON.stringify(by));
console.log(`${items.length} items, ${n} passages${bad.length ? ` · INVALID items: ${bad.map(([i]) => i).join(',')}` : ' · all items structurally valid'}`);
