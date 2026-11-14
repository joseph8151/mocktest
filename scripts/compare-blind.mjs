// Usage: node scripts/compare-blind.mjs <bank.json> <myAnswers.json>   (myAnswers: {"0":"B","1":"A",...} or {"0":1,...})
import { readFileSync } from 'node:fs';
const [file, mine] = process.argv.slice(2);
const items = JSON.parse(readFileSync(file, 'utf8')), ans = JSON.parse(readFileSync(mine, 'utf8'));
const idx = (v) => (typeof v === 'string' ? 'ABCD'.indexOf(v.toUpperCase()) : v);
let agree = 0, bad = [];
for (const [i, v] of Object.entries(ans)) { if (idx(v) === items[i].answer) agree++; else bad.push(+i); }
console.log(`answered ${Object.keys(ans).length}/${items.length}, agree ${agree}, MISMATCH indices: ${JSON.stringify(bad)}`);
for (const i of bad) console.log(`#${i}: bank key=${'ABCD'[items[i].answer]} | verifier=${'ABCD'[idx(ans[i])] ?? '?'} | ${items[i].stem.slice(0, 90)}\n   explanation: ${items[i].explanation}`);
