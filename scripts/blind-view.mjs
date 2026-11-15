// Prints bank items WITHOUT answer/explanation so a verifier can solve them blind.
// Usage: node scripts/blind-view.mjs <bank.json> <startIndex> <count>
import { readFileSync } from 'node:fs';
const [file, start = '0', count = '25'] = process.argv.slice(2);
const items = JSON.parse(readFileSync(file, 'utf8'));
for (let i = +start; i < Math.min(items.length, +start + +count); i++) {
  const q = items[i];
  console.log(`--- #${i} [${q.exam_type}/${q.section} d${q.difficulty}]`);
  if (q.passage) console.log('PASSAGE: ' + q.passage);
  console.log('Q: ' + q.stem);
  if (q.image_svg) console.log('  [FIGURE: this item has an image — render its image_svg to look at it]');
  if (q.kind === 'num') console.log('  (short answer: give a number — accepted answers are hidden)');
  else if (q.kind === 'text') console.log('  (writing prompt — teacher-graded, nothing to solve)');
  else q.choices.forEach((c, j) => console.log(`  ${'ABCD'[j]}) ${c}`));
}
