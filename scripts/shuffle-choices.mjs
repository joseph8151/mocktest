// Re-shuffle answer positions of a NEW bank before release (writers tend to place answers in a cycle).
// Only for banks not yet live: reordering choices of released items would break stored answers.
// Leaves fixed-order formats alone (quantitative comparisons) and refuses items whose text refers to choice letters
// or to other choices ("all of the above"). Seeded by the file name, so re-running gives the same result.
// Usage: node scripts/shuffle-choices.mjs scripts/bank/<file>.json
import fs from 'node:fs';
const file = process.argv[2];
const items = JSON.parse(fs.readFileSync(file, 'utf8'));
let seed = [...file].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 2166136261);
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const FIXED = 'Quantity A is greater';
const letterRef = /\b(choice|option|answer) [A-D]\b|\([A-D]\)|\b(all|none) of the above\b|\bboth [A-D] and [A-D]\b/i;
let moved = 0, kept = 0;
for (const q of items) {
  if (!Array.isArray(q.choices) || q.choices.length !== 4 || !Number.isInteger(q.answer) || q.kind === 'num' || q.kind === 'text') { kept++; continue; }
  if (q.choices[0] === FIXED || letterRef.test(`${q.stem} ${q.explanation} ${q.choices.join(' ')}`)) { kept++; continue; }
  const right = q.choices[q.answer], c = [...q.choices];
  for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
  q.choices = c; q.answer = c.indexOf(right); moved++;
}
fs.writeFileSync(file, JSON.stringify(items, null, 1));
// report: position counts and the strongest repeating period left
const k = items.map((q) => q.answer);
let worst = [0, 0];
for (let p = 2; p <= 30; p++) { let m = 0, t = 0; for (let i = p; i < k.length; i++) { if (k[i] == null || k[i - p] == null) continue; t++; if (k[i] === k[i - p]) m++; } if (t && m / t > worst[1]) worst = [p, m / t]; }
const pos = [0, 0, 0, 0]; k.forEach((a) => a != null && pos[a]++);
console.log(`${file}: reshuffled ${moved}, kept order ${kept} · positions ${pos.join('/')} · strongest period ${worst[0]} at ${(worst[1] * 100).toFixed(0)}%`);
