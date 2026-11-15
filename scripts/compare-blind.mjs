// Usage: node scripts/compare-blind.mjs <bank.json> <myAnswers.json>   (myAnswers: {"0":"B","1":"A",...} or {"0":1,...})
import { readFileSync } from 'node:fs';
const [file, mine] = process.argv.slice(2);
const items = JSON.parse(readFileSync(file, 'utf8')), ans = JSON.parse(readFileSync(mine, 'utf8'));
const idx = (v) => (typeof v === 'string' ? 'ABCD'.indexOf(v.toUpperCase()) : v);
let agree = 0, bad = [];
const num = (x) => { const t = String(x).trim(); const m = t.match(/^(-?\d+)\/(\d+)$/); return m ? +m[1] / +m[2] : Number(t); };
for (const [i, v] of Object.entries(ans)) {
  const it = items[i]; if (!it || it.kind === 'text') continue;
  const ok = it.kind === 'num' ? it.choices.some((c) => Math.abs(num(c) - num(v)) < 1e-9) : idx(v) === it.answer;
  if (ok) agree++; else bad.push(+i);
}
console.log(`answered ${Object.keys(ans).length}/${items.length}, agree ${agree}, MISMATCH indices: ${JSON.stringify(bad)}`);
for (const i of bad) console.log(`#${i}: bank key=${items[i].kind === 'num' ? items[i].choices.join(' or ') : 'ABCD'[items[i].answer]} | verifier=${items[i].kind === 'num' ? ans[i] : 'ABCD'[idx(ans[i])] ?? '?'} | ${items[i].stem.slice(0, 90)}\n   explanation: ${items[i].explanation}`);
