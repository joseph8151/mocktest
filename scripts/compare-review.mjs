// Usage: node scripts/compare-review.mjs <imgKey.json> <answers.json>  (answers: {"3-1":"B",...})
import { readFileSync } from 'node:fs';
const [keyFile, ansFile] = process.argv.slice(2);
const key = JSON.parse(readFileSync(keyFile, 'utf8')), ans = JSON.parse(readFileSync(ansFile, 'utf8'));
let agree = 0; const bad = [];
for (const k of key) { const mine = ans[k.n]; if (mine === undefined) { bad.push(`${k.n}: NO ANSWER`); continue; } if ('ABCD'.indexOf(String(mine).toUpperCase()) === k.answer) agree++; else bad.push(`${k.n}: key=${'ABCD'[k.answer]} mine=${mine} | ${k.stem} | expl: ${k.explanation}`); }
console.log(`agree ${agree}/${key.length}`); bad.forEach((b) => console.log('MISMATCH ' + b));
