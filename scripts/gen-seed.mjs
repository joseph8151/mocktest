// Generates seed/seed.sql: products + ORIGINAL sample questions (format-inspired, not copied).
import { writeFileSync } from 'node:fs';
import { barChart, lineChart, pieChart, rectFig, rightTriangle, circleFig, coordPlane, angleFig, numberLine, gridShape, scatterPlot, groupedBar, histogram, pictograph, venn, clockFace, fractionShade, tableSvg, reflectGrid, fnGraph, sectorFig, trigTriangle } from './svgcharts.mjs';

let seedState = 12345;
const rnd = () => ((seedState = (seedState * 1664525 + 1013904223) % 4294967296) / 4294967296);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const Q = [];
const seen = new Set();
let dropIds = new Set(); try { dropIds = new Set(JSON.parse(readFileSync(new URL('./bank/_generated.drop.json', import.meta.url), 'utf8'))); } catch {} // ids a reviewer rejected
// Content-hash ids: re-generating the seed never renumbers existing questions, so deployed databases can sync incrementally.
const hash = (str) => { let a = 0x811c9dc5, b = 0x1b873593; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b + c, 2246822519) ^ (b >>> 13); } return ((a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0')).slice(0, 12); };
function add(exam_type, section, difficulty, stem, choices, answer, explanation, extra = {}) {
  const key = hash([exam_type, section, stem, extra.passage || '', extra.image_svg ? 'img' : '', [...choices].sort().join('|')].join('\u0001'));
  const tkey = extra.image_svg || choices.some((c) => String(c).startsWith('svg:')) ? null : `t|${exam_type}|${section}|${extra.passage || ''}|${stem.trim().toLowerCase()}${extra._sameStemOk ? '|' + [...choices].sort().join('|') : ''}`; // newer banks reuse generic stems with different choices
  if (tkey && seen.has(tkey)) return; if (tkey) seen.add(tkey);
  if (seen.has(key) || dropIds.has(`seed-${exam_type.toLowerCase()}-${section}-${key}`)) return; // identical generated item: keep one / reviewer-rejected
  seen.add(key);
  Q.push({ id: `seed-${exam_type.toLowerCase()}-${section}-${key}`, exam_type, section, kind: 'mcq', difficulty, stem, choices, answer, explanation, ...extra });
}
/** Explanation that quotes the sentence of the passage that best supports the answer. */
function evidence(passage, answer) {
  const words = String(answer).toLowerCase().match(/[a-z]{4,}/g) || [];
  const sents = String(passage).split(/(?<=[.!?"])\s+/);
  let best = sents[0], score = -1;
  for (const t of sents) { const lw = t.toLowerCase(); const sc = words.filter((w) => lw.includes(w.slice(0, 5))).length; if (sc > score) { best = t; score = sc; } }
  return `Key line: "${best.replace(/^"|"$/g, '').trim()}" So the answer is "${answer}".`;
}
/** Build a shuffled MCQ from a correct value and distractors. */
function mcq(exam_type, section, difficulty, stem, correct, distractors, explanation, extra) {
  const uniq = [...new Set(distractors.map(String))].filter((d) => d !== String(correct)).slice(0, 3);
  const all = shuffle([String(correct), ...uniq]);
  add(exam_type, section, difficulty, stem, all, all.indexOf(String(correct)), explanation, extra);
}

/* ---------- MAP Math (generated) ---------- */
for (let i = 0; i < 12; i++) { const a = ri(12, 89), b = ri(11, 78); mcq('MAP', 'math', 1, `What is ${a} + ${b}?`, a + b, [a + b + 10, a + b - 10, a + b + 1, a + b - 1], `${a} + ${b} = ${a + b}.`); }
for (let i = 0; i < 12; i++) { const a = ri(3, 9), b = ri(12, 49); mcq('MAP', 'math', 2, `What is ${a} × ${b}?`, a * b, [a * b + a, a * b - a, a * b + 10, a * b - 10], `${a} × ${b} = ${a * b}.`); }
for (let i = 0; i < 12; i++) { const p = pick([10, 20, 25, 50]), v = pick([40, 60, 80, 120, 200, 240]); const r = (p * v) / 100; mcq('MAP', 'math', 3, `What is ${p}% of ${v}?`, r, [r + 5, r * 2, r - 4, v - r], `${p}% of ${v} = ${r}.`); }
for (let i = 0; i < 12; i++) { const x = ri(3, 15), a = ri(2, 6), b = ri(2, 20); mcq('MAP', 'math', 4, `Solve for x: ${a}x + ${b} = ${a * x + b}`, x, [x + 1, x - 1, x + 2, x * 2], `Subtract ${b}, then divide by ${a}: x = ${x}.`); }
for (let i = 0; i < 12; i++) { const w = ri(4, 12), h = ri(3, 9), s = ri(2, 4); mcq('MAP', 'math', 5, `A rectangle is ${w} cm by ${h} cm. If both sides are multiplied by ${s}, by what factor does the area grow?`, s * s, [s, 2 * s, s * s + 1, s + 2], `Area scales by the square of the scale factor: ${s}² = ${s * s}.`); }

/* ---------- MAP Reading (hand-written) ---------- */
const P1 = 'Mira kept a small notebook in her backpack. Every evening she wrote down one thing she had noticed that day: a spider finishing its web, the way the bus driver hummed, a cloud shaped like a boot. "Small things add up," she told her brother. By June the notebook was full, and Mira realized that she had never once felt bored all year.';
add('MAP', 'reading', 2, 'What is the main idea of the passage?', ['Mira dislikes riding the bus.', 'Paying attention to small details can make life more interesting.', 'Spiders are important to the school year.', 'Mira wants to become a bus driver.'], 1, 'The notebook habit kept Mira from feeling bored.', { passage: P1 });
add('MAP', 'reading', 3, 'What does the word "realized" mean as used in the passage?', ['forgot', 'suddenly understood', 'argued', 'wished'], 1, '"Realized" means came to understand.', { passage: P1 });
add('MAP', 'reading', 3, 'Which detail best supports the idea that Mira was observant?', ['She carried a backpack.', 'She talked to her brother.', 'She wrote down things like a cloud shaped like a boot.', 'The notebook was full by June.'], 2, 'Noticing odd details shows she is observant.', { passage: P1 });
const P2 = 'Honeybees communicate through movement. When a scout bee finds flowers, she returns to the hive and performs a "waggle dance." The angle of the dance shows the direction of the flowers relative to the sun, and the length of the waggle shows how far away they are. Other bees watch closely and then fly straight to the food.';
add('MAP', 'reading', 3, 'According to the passage, what does the length of the waggle tell other bees?', ['The type of flower', 'How far away the flowers are', 'The time of day', 'The size of the hive'], 1, 'Length shows distance.', { passage: P2 });
add('MAP', 'reading', 4, 'Which sentence best describes how the passage is organized?', ['It compares two kinds of insects.', 'It tells a story in time order.', 'It explains how a behavior works.', 'It argues that bees are better than ants.'], 2, 'The passage explains the waggle dance.', { passage: P2 });
add('MAP', 'reading', 4, 'What can the reader infer about the bees that watch the dance?', ['They cannot fly.', 'They use the information to find food.', 'They are guards of the hive.', 'They dislike the scout.'], 1, 'They fly straight to the food afterwards.', { passage: P2 });
const P3 = 'The lighthouse keeper had not spoken to another person in three weeks. When the supply boat finally appeared, he waved so wildly that his hat sailed into the sea. He laughed, and the sound surprised him; it was rusty, like a door that had not been opened in years.';
add('MAP', 'reading', 4, 'The comparison of his laugh to "a door that had not been opened in years" suggests that his laugh was', ['loud and angry', 'unused and a little strange', 'quiet and sad', 'quick and nervous'], 1, 'A rusty door = unused.', { passage: P3 });
add('MAP', 'reading', 5, 'Which word best describes the keeper when the boat arrived?', ['indifferent', 'overjoyed', 'suspicious', 'embarrassed'], 1, 'Wild waving and laughing show joy.', { passage: P3 });
add('MAP', 'reading', 1, 'Choose the word that means the OPPOSITE of "ancient".', ['modern', 'old', 'broken', 'huge'], 0, 'Ancient = very old; opposite = modern.');
add('MAP', 'reading', 2, 'Which word is a synonym for "tiny"?', ['enormous', 'minute', 'average', 'heavy'], 1, 'Minute (my-NOOT) means very small.');

/* ---------- MAP Language Usage ---------- */
const L = [
  [1, 'Choose the correct sentence.', ['She don\'t like apples.', 'She doesn\'t like apples.', 'She not like apples.', 'She doesn\'t likes apples.'], 1, '"Doesn\'t" + base verb.'],
  [1, 'Which word is spelled correctly?', ['recieve', 'receive', 'receeve', 'riceive'], 1, 'i before e except after c.'],
  [2, 'Choose the best word: "The team ___ practicing every day."', ['are', 'is', 'were', 'be'], 1, '"Team" is a singular collective noun here.'],
  [2, 'Which sentence has correct punctuation?', ['Its a lovely day, isn\'t it.', 'It\'s a lovely day, isn\'t it?', 'Its a lovely day isn\'t it?', 'It\'s a lovely day, isnt it?'], 1, 'Contraction + question mark.'],
  [2, 'Choose the correct pronoun: "Maya and ___ went to the park."', ['me', 'I', 'myself', 'mine'], 1, 'Subject pronoun "I".'],
  [3, 'Which sentence is a run-on?', ['I was tired, so I slept.', 'I was tired I slept early the alarm rang.', 'Tired, I slept.', 'I slept because I was tired.'], 1, 'Missing punctuation/conjunctions.'],
  [3, 'Choose the best revision: "Walking down the street, the rain started."', ['Walking down the street, it started raining.', 'While I was walking down the street, the rain started.', 'The rain, walking down the street, started.', 'Walking, the rain started down the street.'], 1, 'Avoids a dangling modifier.'],
  [3, 'Which word correctly completes: "Neither of the boys ___ ready."', ['are', 'is', 'were', 'have been'], 1, '"Neither" takes a singular verb.'],
  [4, 'Which sentence uses a semicolon correctly?', ['I like tea; and coffee.', 'I like tea; she prefers coffee.', 'I like; tea she prefers coffee.', 'I like tea, she prefers; coffee.'], 1, 'Semicolon joins two independent clauses.'],
  [4, 'Choose the sentence with parallel structure.', ['He likes hiking, to swim, and biking.', 'He likes hiking, swimming, and biking.', 'He likes to hike, swimming, and bike.', 'He likes hike, swim, and biking.'], 1, 'All gerunds.'],
  [5, 'Which sentence uses "whom" correctly?', ['Whom is at the door?', 'To whom did you give the book?', 'Whom wrote this letter?', 'Whom you are is important.'], 1, '"Whom" is the object of the preposition "to".'],
  [5, 'Select the sentence that is most concise without changing meaning.', ['Due to the fact that it rained, the game was cancelled.', 'Because it rained, the game was cancelled.', 'The game was cancelled on account of the fact of rain.', 'It rained, and for that reason the game got cancelled.'], 1, 'Fewest unnecessary words.'],
];
for (const [d, s, c, a, e] of L) add('MAP', 'language', d, s, c, a, e);

/* ---------- CAT4 Verbal ---------- */
const V = [
  [1, 'Hot is to cold as up is to ___', ['high', 'down', 'sky', 'warm'], 1],
  [1, 'Which word does NOT belong? apple, banana, carrot, grape', ['apple', 'banana', 'carrot', 'grape'], 2],
  [2, 'Bird is to nest as bee is to ___', ['honey', 'hive', 'flower', 'wing'], 1],
  [2, 'Which word does NOT belong? river, lake, ocean, mountain', ['river', 'lake', 'ocean', 'mountain'], 3],
  [2, 'Pen is to write as knife is to ___', ['cut', 'sharp', 'kitchen', 'fork'], 0],
  [3, 'Author is to book as composer is to ___', ['song', 'piano', 'concert', 'singer'], 0],
  [3, 'Which word is closest in meaning to "reluctant"?', ['eager', 'unwilling', 'tired', 'careful'], 1],
  [3, 'Which word does NOT belong? sprint, jog, stroll, whisper', ['sprint', 'jog', 'stroll', 'whisper'], 3],
  [3, 'Drought is to water as famine is to ___', ['food', 'hunger', 'farm', 'rain'], 0],
  [4, 'Which word is the OPPOSITE of "scarce"?', ['rare', 'plentiful', 'valuable', 'hidden'], 1],
  [4, 'Glove is to hand as sock is to ___', ['shoe', 'foot', 'leg', 'wool'], 1],
  [4, 'Which pair has the same relationship as "pebble : boulder"?', ['puddle : lake', 'tree : leaf', 'road : car', 'cloud : rain'], 0],
  [4, 'All roses are flowers. Some flowers are red. Which MUST be true?', ['All roses are red.', 'Some roses are red.', 'No roses are red.', 'None of these must be true.'], 3],
  [5, 'Which word is closest in meaning to "ephemeral"?', ['lasting', 'brief', 'colourful', 'distant'], 1],
  [5, 'Candid is to frank as cautious is to ___', ['wary', 'bold', 'careless', 'quiet'], 0],
  [5, 'If no teachers are bored and Sam is bored, which MUST be true?', ['Sam is a teacher.', 'Sam is not a teacher.', 'Sam likes teachers.', 'Teachers like Sam.'], 1],
];
const VE = ['Hot and cold are opposites; so are up and down.', 'Apple, banana and grape are fruits; a carrot is a vegetable.', 'A bird lives in a nest; a bee lives in a hive.', 'River, lake and ocean are bodies of water; a mountain is a landform.', 'A pen is used to write; a knife is used to cut (tool and function).', 'An author creates a book; a composer creates a song.', '"Reluctant" means unwilling to do something.', 'Sprint, jog and stroll are ways of moving; whisper is a way of speaking.', 'A drought is a shortage of water; a famine is a shortage of food.', '"Scarce" means hard to find; the opposite is plentiful.', 'A glove covers a hand; a sock covers a foot.', 'A pebble is a small stone and a boulder a large one; a puddle is small water and a lake large water.', 'Nothing says the red flowers are roses, so none of the statements must be true.', '"Ephemeral" means lasting only a short time, i.e. brief.', '"Candid" and "frank" are synonyms; so are "cautious" and "wary".', 'Teachers are never bored, so a bored person cannot be a teacher.'];
V.forEach(([d, s, c, a], i) => add('CAT4', 'verbal', d, s, c, a, VE[i]));

/* ---------- CAT4 Quantitative (number series, generated) ---------- */
for (let i = 0; i < 8; i++) { const s = ri(2, 9), k = ri(2, 6); const seq = [0, 1, 2, 3, 4].map((j) => s + j * k); mcq('CAT4', 'quantitative', 1, `What comes next? ${seq.join(', ')}, ?`, s + 5 * k, [s + 5 * k + 1, s + 6 * k, s + 4 * k, s + 5 * k - 1], `Add ${k} each time.`); }
for (let i = 0; i < 8; i++) { const s = ri(2, 5), m = pick([2, 3]); const seq = [0, 1, 2, 3].map((j) => s * m ** j); mcq('CAT4', 'quantitative', 2, `What comes next? ${seq.join(', ')}, ?`, s * m ** 4, [s * m ** 4 + m, s * m ** 3 + m, seq[3] * 2 + 1, seq[3] + m], `Multiply by ${m} each time.`); }
for (let i = 0; i < 8; i++) { const s = ri(1, 6), a = ri(2, 4), b = ri(5, 9); const seq = [s]; for (let j = 1; j < 6; j++) seq.push(seq[j - 1] + (j % 2 ? a : b)); mcq('CAT4', 'quantitative', 3, `What comes next? ${seq.slice(0, 5).join(', ')}, ?`, seq[5], [seq[5] + 1, seq[5] - 1, seq[4] + a + b, seq[4] + 2], `The step alternates +${a}, +${b}.`); }
for (let i = 0; i < 8; i++) { const s = ri(1, 4); const seq = [0, 1, 2, 3, 4].map((j) => (j + s) ** 2); mcq('CAT4', 'quantitative', 4, `What comes next? ${seq.join(', ')}, ?`, (5 + s) ** 2, [(5 + s) ** 2 + 1, (5 + s) ** 2 - (5 + s), seq[4] + 2 * (4 + s), seq[4] * 2], 'These are consecutive square numbers.'); }
for (let i = 0; i < 8; i++) { const a = ri(3, 8), b = ri(2, 5); const seq = [a]; let d = b; for (let j = 1; j < 6; j++) { seq.push(seq[j - 1] + d); d += 2; } mcq('CAT4', 'quantitative', 5, `What comes next? ${seq.slice(0, 5).join(', ')}, ?`, seq[5], [seq[5] + 1, seq[5] - 2, seq[4] + d - 4, seq[4] + d], 'The difference grows by 2 each step.'); }

/* ---------- SVG helpers ---------- */
const svg = (inner, w = 60, h = 60) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${inner}</svg>`;
const poly = (sides, rot = 0, fill = '#4f46e5', r = 22, cx = 30, cy = 30) => {
  const pts = Array.from({ length: sides }, (_, i) => { const a = ((rot + (360 / sides) * i - 90) * Math.PI) / 180; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
  return `<polygon points="${pts}" fill="${fill}" stroke="#111" stroke-width="2"/>`;
};
const strip = (cells) => svg(cells.map((c, i) => `<g transform="translate(${i * 64},0)">${c}</g>`).join('') , cells.length * 64, 60);

/* ---------- CAT4 Non-verbal (generated) ---------- */
for (let i = 0; i < 12; i++) { // growing number of sides
  const s = Math.min(ri(3, 5), 4), shown = [0, 1, 2].map((j) => poly(s + j)).concat(['<text x="30" y="42" font-size="36" text-anchor="middle">?</text>']);
  const ans = s + 3; const opts = shuffle([ans, ans + 1, ans - 1, Math.max(3, s)]).filter((v, k, a) => a.indexOf(v) === k);
  while (opts.length < 4) opts.push(ans + opts.length + 1);
  add('CAT4', 'nonverbal', 2, 'Which shape comes next in the pattern?', opts.map((o) => 'svg:' + svg(poly(o))), opts.indexOf(ans), `Each shape has one more side: next has ${ans}.`, { image_svg: strip(shown) });
}
for (let i = 0; i < 10; i++) { // rotating triangle
  const step = pick([45, 90, 30]), start = pick([0, 30]); // a 120-degree step is invisible on an equilateral triangle
  const shown = [0, 1, 2].map((j) => poly(3, start + step * j, '#0ea5e9')).concat(['<text x="30" y="42" font-size="36" text-anchor="middle">?</text>']);
  const ans = (start + step * 3) % 360; const cand = [ans, (ans + 30) % 360, (ans + 60) % 360, (ans + 90) % 360].filter((v, k, a) => a.indexOf(v) === k); // offsets that are distinct for a 3-fold symmetric shape
  const opts = shuffle(cand);
  add('CAT4', 'nonverbal', 3, 'The triangle keeps turning by the same amount. Which comes next?', opts.map((o) => 'svg:' + svg(poly(3, o, '#0ea5e9'))), opts.indexOf(ans), `It turns ${step}° each step.`, { image_svg: strip(shown) });
}
for (let i = 0; i < 10; i++) { // dots increasing by k
  const k = ri(1, 2), dots = (c) => Array.from({ length: c }, (_, j) => `<circle cx="${12 + (j % 4) * 12}" cy="${18 + Math.floor(j / 4) * 14}" r="4.5" fill="#ef4444"/>`).join('');
  const shown = [1, 2, 3].map((j) => dots(j * k)).concat(['<text x="30" y="42" font-size="36" text-anchor="middle">?</text>']);
  const ans = 4 * k, opts = shuffle([ans, ans + 1, ans - 1, ans + 2]);
  add('CAT4', 'nonverbal', 1, 'How many dots come next?', opts.map((o) => 'svg:' + svg(dots(o))), opts.indexOf(ans), `Dots increase by ${k} each time.`, { image_svg: strip(shown) });
}

/* ---------- CAT4 Spatial (generated) ---------- */
const F = (tr, fill = '#16a34a') => `<g transform="${tr}"><path d="M-10 -16 H12 V-8 H-2 V-2 H8 V6 H-2 V16 H-10 Z" fill="${fill}" stroke="#111" stroke-width="2"/></g>`;
for (let i = 0; i < 32; i++) {
  const base = svg(F('translate(30,30)'), 60, 60);
  const angs = shuffle([0, 45, 90, 135, 180, 225, 270, 315]);
  if (angs[0] === 0) [angs[0], angs[1]] = [angs[1], angs[0]]; // the keyed option must really be turned
  const correctAng = angs[0];
  const items = shuffle([
    { s: F(`translate(30,30) rotate(${correctAng})`), ok: true },
    { s: F(`translate(30,30) rotate(${angs[1]}) scale(-1,1)`), ok: false },
    { s: F(`translate(30,30) rotate(${angs[2]}) scale(-1,1)`), ok: false },
    { s: F(`translate(30,30) rotate(${angs[3]}) scale(-1,1)`), ok: false },
  ]);
  add('CAT4', 'spatial', 2 + (i % 4), 'Which option shows the same shape turned (rotated) but NOT flipped?', items.map((x) => 'svg:' + svg(x.s, 60, 60)), items.findIndex((x) => x.ok), 'A flipped (mirror) shape can never be made by turning.', { image_svg: base });
}

/* ---------- WIDA ---------- */
const WL = [
  [1, 'The teacher said: "Please open your books to page twelve and read the first paragraph quietly."', 'What should the students do first?', ['Close their books', 'Open their books to page twelve', 'Talk to a partner', 'Write a story'], 1],
  [1, 'Sam says: "I\'m hungry. I want an apple and a glass of milk."', 'What does Sam want?', ['An apple and milk', 'Bread and juice', 'Pizza', 'Water only'], 0],
  [2, 'Announcement: "The school library will close early today at two o\'clock because of a meeting. Please return your books before then."', 'Why will the library close early?', ['It is a holiday', 'There is a meeting', 'The books are missing', 'It is raining'], 1],
  [2, 'Lena tells her friend: "I couldn\'t come to practice yesterday because my little brother was sick, so I stayed home with him."', 'Why did Lena miss practice?', ['She was tired', 'She forgot', 'Her brother was sick', 'She had a test'], 2],
  [3, 'The science teacher explains: "Plants make their own food using sunlight, water, and air. This process is called photosynthesis."', 'What is photosynthesis?', ['A way plants make food', 'A kind of weather', 'A type of soil', 'A way animals sleep'], 0],
  [3, 'Coach: "We\'ll meet at the north gate, not the main entrance. The bus leaves at eight, so please don\'t be late."', 'Where will the students meet?', ['At the main entrance', 'At the north gate', 'On the bus', 'In the gym'], 1],
  [3, 'A guide says: "Please stay with the group, and do not touch the exhibits. If you have a question, raise your hand."', 'What should visitors do if they have a question?', ['Touch the exhibit', 'Leave the group', 'Raise their hand', 'Wait outside'], 2],
  [4, 'Radio: "Tomorrow will start cloudy, but by afternoon the clouds should clear and the temperature will rise to twenty-five degrees."', 'What will the weather be like tomorrow afternoon?', ['Rainy and cold', 'Clear and warmer', 'Cloudy all day', 'Snowy'], 1],
  [4, 'Teacher: "Although the experiment failed, we learned that the metal expands when heated, which is useful information."', 'What did the class learn?', ['The experiment was perfect', 'Metal expands when heated', 'Metal melts at once', 'Heat is dangerous'], 1],
  [5, 'Speaker: "Contrary to popular belief, goldfish can remember things for months, not seconds, which is why they can be trained to recognize feeding times."', 'What is the speaker\'s main point?', ['Goldfish have poor memories', 'Goldfish can remember for months', 'Goldfish dislike feeding', 'Goldfish cannot be trained'], 1],
];
for (const [d, script, stem, c, a] of WL) add('WIDA', 'listening', d, stem, c, a, evidence(script, c[a]), { passage: script });
const WR = [
  [1, 'Tom has a red ball. He plays with it at the park every day after school.', 'Where does Tom play with his ball?', ['At school', 'At the park', 'At home', 'At the beach'], 1],
  [2, 'Rosa planted seeds in a small pot. She watered them every morning. After two weeks, tiny green leaves appeared.', 'What happened after two weeks?', ['The pot broke', 'Green leaves appeared', 'Rosa stopped watering', 'The seeds disappeared'], 1],
  [2, 'The class went to the zoo. They saw lions, monkeys, and a very tall giraffe. Everyone liked the monkeys best.', 'Which animal did everyone like best?', ['Lions', 'Giraffe', 'Monkeys', 'Elephants'], 2],
  [3, 'Recycling means turning old things into new things. When we recycle paper, fewer trees are cut down, and less energy is used.', 'What is one benefit of recycling paper?', ['It makes more trash', 'Fewer trees are cut down', 'It costs more energy', 'It makes paper heavier'], 1],
  [3, 'Because the river flooded last spring, the villagers built a wall of stones along its bank. Since then, the houses have stayed dry.', 'Why did the villagers build the wall?', ['To make a road', 'To stop the river flooding their homes', 'To catch fish', 'To start a market'], 1],
  [4, 'Volcanoes form where hot melted rock, called magma, rises through cracks in the Earth\'s crust. When pressure builds up, the magma can erupt as lava.', 'What causes a volcano to erupt?', ['Heavy rain', 'Pressure from rising magma', 'Strong wind', 'Ocean waves'], 1],
  [4, 'The word "transparent" means that light can pass through something so you can see clearly. Glass windows are usually transparent.', 'Which object is most likely transparent?', ['A wooden door', 'A glass window', 'A brick wall', 'A metal box'], 1],
  [5, 'Although the festival was small when it began, word of mouth gradually drew visitors from neighbouring towns, and within a decade it had become the region\'s most anticipated event.', 'What can be inferred about the festival?', ['It stopped after ten years', 'It grew because people told others', 'It was always large', 'It only had local visitors'], 1],
];
for (const [d, p, stem, c, a] of WR) add('WIDA', 'reading', d, stem, c, a, evidence(p, c[a]), { passage: p });
Q.push({ id: 'seed-wida-writing-1', exam_type: 'WIDA', section: 'writing', kind: 'text', difficulty: 2, stem: 'Write 4–6 sentences about your favorite place at school. Tell what it looks like and why you like it.', choices: null, answer: null });
Q.push({ id: 'seed-wida-writing-2', exam_type: 'WIDA', section: 'writing', kind: 'text', difficulty: 4, stem: 'Some people think students should wear uniforms; others disagree. Write a paragraph giving your opinion with at least two reasons.', choices: null, answer: null });
Q.push({ id: 'seed-wida-speaking-1', exam_type: 'WIDA', section: 'speaking', kind: 'audio', difficulty: 2, stem: 'Introduce yourself. Say your name, your age, and two things you like to do. (Record for about 30 seconds.)', choices: null, answer: null });
Q.push({ id: 'seed-wida-speaking-2', exam_type: 'WIDA', section: 'speaking', kind: 'audio', difficulty: 4, stem: 'Describe a time you helped someone. What happened and how did you feel? (Record for about 60 seconds.)', choices: null, answer: null });


/* ---------- additional hand-written items ---------- */
const P4 = 'When the town planted trees along Maple Street, many residents complained about the cost. Ten years later, the shade lowered summer temperatures by several degrees, and neighbours began gathering under the branches each evening. The mayor admitted that the trees had paid for themselves in ways no budget could measure.';
add('MAP', 'reading', 3, 'What is the mayor\'s attitude toward the trees by the end of the passage?', ['Regretful', 'Appreciative', 'Confused', 'Angry'], 1, 'He admits they paid for themselves.', { passage: P4 });
add('MAP', 'reading', 4, 'Which sentence best states a theme of the passage?', ['Costs should never be questioned.', 'Some investments bring benefits that are hard to measure.', 'Trees grow slowly.', 'Neighbours dislike change.'], 1, 'Benefits beyond budget.', { passage: P4 });
add('MAP', 'reading', 2, 'According to the passage, what happened ten years later?', ['The trees were cut down', 'Summers became cooler and neighbours gathered', 'The street was closed', 'The mayor resigned'], 1, 'Stated directly.', { passage: P4 });
const P5 = 'Scientists studying coral reefs have noticed that reefs near busy harbours often recover more slowly after storms. The researchers suspect that pollution weakens the coral, but they caution that more data is needed before the cause can be confirmed.';
add('MAP', 'reading', 4, 'Which word best describes the researchers\' conclusion?', ['Certain', 'Tentative', 'Careless', 'Hostile'], 1, '"Suspect" and "more data is needed" signal caution.', { passage: P5 });
add('MAP', 'reading', 5, 'What does "caution" mean as used in the passage?', ['to hurry', 'to warn', 'to celebrate', 'to ignore'], 1, 'To caution = to warn.', { passage: P5 });
add('MAP', 'reading', 3, 'What is the passage mainly about?', ['How storms form', 'A possible link between harbours and slow reef recovery', 'Why harbours are busy', 'How to build harbours'], 1, 'Main idea.', { passage: P5 });
add('MAP', 'reading', 5, 'Choose the best meaning of "meticulous".', ['careless', 'extremely careful about details', 'quick', 'noisy'], 1, 'Meticulous = very careful and precise.');
add('MAP', 'reading', 3, 'Which word is closest in meaning to "abundant"?', ['plentiful', 'empty', 'fragile', 'ordinary'], 0, 'Abundant = plentiful.');
add('MAP', 'reading', 4, '"The wind whispered through the trees." This sentence is an example of', ['simile', 'personification', 'exaggeration', 'rhyme'], 1, 'The wind is given a human action.');
for (const [d, s, c, a, e] of [
  [1, 'Choose the correct word: "They ___ going to the zoo."', ['is', 'am', 'are', 'be'], 2, '"They" takes "are".'],
  [1, 'Which sentence begins with a capital letter and ends correctly?', ['we like pizza.', 'We like pizza.', 'We like pizza', 'we Like pizza?'], 1, 'Capital + period.'],
  [2, 'Choose the correct plural: one child, two ___', ['childs', 'childes', 'children', 'childrens'], 2, 'Irregular plural.'],
  [2, 'Which word completes the sentence? "She ran ___ than her brother."', ['fast', 'faster', 'fastest', 'more fast'], 1, 'Comparative of two.'],
  [3, 'Which sentence is in the past perfect tense?', ['I eat lunch.', 'I had eaten lunch before she arrived.', 'I will eat lunch.', 'I am eating lunch.'], 1, 'had + past participle.'],
  [3, 'Choose the correct possessive: "The ___ toys were everywhere."', ['childrens', 'children\'s', 'childrens\'', 'childrens\'s'], 1, 'Irregular plural possessive.'],
  [4, 'Which sentence contains a misplaced modifier?', ['She nearly drove her kids to school every day.', 'She drove her kids to school every day.', 'Every day, she drove her kids to school.', 'She drove her kids to school daily.'], 0, '"Nearly" should modify "every day" or be placed differently.'],
  [4, 'Choose the correct sentence.', ['Between you and I, it is a secret.', 'Between you and me, it is a secret.', 'Between you and myself, it is a secret.', 'Between I and you, it is a secret.'], 1, 'Object pronoun after a preposition.'],
  [5, 'Which is the best transition: "The experiment failed. ___, the team learned something useful."', ['Therefore', 'Nevertheless', 'Similarly', 'Meanwhile'], 1, 'Contrast.'],
]) add('MAP', 'language', d, s, c, a, e);
[
  [1, 'Day is to night as summer is to ___', ['sun', 'winter', 'hot', 'season'], 1],
  [1, 'Which word does NOT belong? dog, cat, horse, chair', ['dog', 'cat', 'horse', 'chair'], 3],
  [2, 'Eye is to see as ear is to ___', ['hear', 'sound', 'head', 'listen to'], 0],
  [2, 'Which word means the same as "huge"?', ['tiny', 'enormous', 'quiet', 'quick'], 1],
  [3, 'Chapter is to book as scene is to ___', ['actor', 'play', 'stage', 'ticket'], 1],
  [3, 'Which word is the OPPOSITE of "generous"?', ['kind', 'selfish', 'wealthy', 'shy'], 1],
  [3, 'Which word does NOT belong? triangle, square, circle, cube', ['triangle', 'square', 'circle', 'cube'], 3],
  [4, 'Thermometer is to temperature as ruler is to ___', ['length', 'paper', 'wood', 'draw'], 0],
  [4, 'All birds have feathers. A penguin is a bird. Which MUST be true?', ['A penguin has feathers.', 'A penguin can fly.', 'All feathered animals are birds.', 'Penguins live in cold places only.'], 0],
  [5, 'Which word is closest in meaning to "ambiguous"?', ['clear', 'unclear', 'loud', 'rude'], 1],
  [5, 'Prudent is to reckless as frugal is to ___', ['thrifty', 'wasteful', 'poor', 'careful'], 1],
].map((x, i) => [...x, ['Day and night are opposites; so are summer and winter.', 'Dog, cat and horse are animals; a chair is furniture.', 'The eye is used to see; the ear is used to hear.', '"Huge" and "enormous" both mean very large.', 'A chapter is a part of a book; a scene is a part of a play.', '"Generous" means giving; the opposite is selfish.', 'Triangle, square and circle are flat (2-D); a cube is solid (3-D).', 'A thermometer measures temperature; a ruler measures length.', 'Penguins are birds and all birds have feathers, so penguins have feathers.', '"Ambiguous" means open to more than one meaning, i.e. unclear.', '"Prudent" is the opposite of "reckless"; "frugal" is the opposite of "wasteful".'][i]]).forEach(([d, s, c, a, e]) => add('CAT4', 'verbal', d, s, c, a, e));
for (const [d, script, stem, c, a] of [
  [1, 'Anna says: "My birthday is on Saturday. I\'m having a party at my house."', 'Where is Anna\'s party?', ['At school', 'At her house', 'At the park', 'At a restaurant'], 1],
  [2, 'Teacher: "Tomorrow is picture day. Please wear your school shirt and bring your homework."', 'What should students wear tomorrow?', ['A costume', 'Their school shirt', 'A jacket', 'Sports clothes'], 1],
  [2, 'Dad: "We\'re out of milk, so I\'m going to the store. Do you need anything?"', 'Why is Dad going to the store?', ['To buy milk', 'To meet a friend', 'To return a book', 'To get gas'], 0],
  [3, 'Principal: "The assembly will begin at ten, but students from Room 4 should arrive early to help set up chairs."', 'Who should come early?', ['All students', 'Teachers only', 'Students from Room 4', 'Parents'], 2],
  [4, 'Ranger: "Because the trail is muddy after the rain, we will take the lower path, which is longer but safer."', 'Why will the group take the lower path?', ['It is shorter', 'It is safer', 'It has a view', 'It is closed'], 1],
  [5, 'Lecturer: "Although electric cars produce no exhaust, their overall environmental benefit depends on how the electricity is generated."', 'What does the lecturer suggest?', ['Electric cars are always clean', 'Benefits depend on the electricity source', 'Exhaust is harmless', 'Electric cars are expensive'], 1],
]) add('WIDA', 'listening', d, stem, c, a, evidence(script, c[a]), { passage: script });
for (const [d, p, stem, c, a] of [
  [1, 'Mia has a cat named Pepper. Pepper likes to sleep on the sofa and drink milk.', 'What does Pepper like to drink?', ['Water', 'Milk', 'Juice', 'Tea'], 1],
  [2, 'On Monday, the class started a garden. They planted beans, carrots, and corn. Each student has a job.', 'What did the class start on Monday?', ['A garden', 'A game', 'A play', 'A trip'], 0],
  [3, 'The library offers free programs during the summer. Children can join a reading club, and older students can volunteer as helpers.', 'Who can volunteer as helpers?', ['Younger children', 'Older students', 'Teachers only', 'Nobody'], 1],
  [3, 'Rain forests are home to millions of species. Many of these plants and animals cannot live anywhere else on Earth.', 'Why are rain forests important?', ['They are cold', 'They shelter species found nowhere else', 'They have no animals', 'They are small'], 1],
  [4, 'The inventor tested hundreds of materials before finding one strong enough. "Every failure," she said, "taught me what not to do."', 'What does the inventor\'s statement show?', ['She gave up easily', 'She learned from failures', 'She disliked testing', 'She worked alone'], 1],
  [5, 'Economists note that when a product becomes scarce, its price typically rises unless demand falls at the same time.', 'What usually happens to the price of a scarce product?', ['It falls', 'It rises', 'It stays the same', 'It disappears'], 1],
]) add('WIDA', 'reading', d, stem, c, a, evidence(p, c[a]), { passage: p });
Q.push({ id: 'seed-wida-writing-3', exam_type: 'WIDA', section: 'writing', kind: 'text', difficulty: 3, stem: 'Describe what you do on a typical weekend. Use at least five sentences and words like "first", "then", and "finally".', choices: null, answer: null });
Q.push({ id: 'seed-wida-speaking-3', exam_type: 'WIDA', section: 'speaking', kind: 'audio', difficulty: 3, stem: 'Talk about your favorite food. What is it, how is it made, and why do you like it? (Record for about 45 seconds.)', choices: null, answer: null });


/* =====================================================================
   Graph / geometry items drawn as SVG + SCAT / SSAT / ISEE sets
   ===================================================================== */
const QC = ['Quantity A is greater', 'Quantity B is greater', 'The two quantities are equal', 'The relationship cannot be determined'];
const SETS = [['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], ['Red', 'Blue', 'Green', 'Pink', 'Gray'], ['Soccer', 'Chess', 'Art', 'Music', 'Drama'], ['Cats', 'Dogs', 'Birds', 'Fish', 'Frogs']];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const uniq = (a) => new Set(a).size === a.length;

/** returns {stem, svg, correct, wrong[], expl} */
function graphItem(kind) {
  switch (kind) {
    case 'bar': {
      const labels = pick(SETS), title = pick(['Students in each club', 'Books read this month', 'Votes for favorite pet', 'Tickets sold per day']);
      let vals; do vals = labels.map(() => 5 * ri(2, 9)); while (!uniq(vals));
      const svg = barChart({ title, labels, values: vals, yMax: 50, yStep: 5, yLabel: 'Count' }), t = ri(0, 2);
      const [i, j] = shuffle([0, 1, 2, 3, 4]).slice(0, 2);
      if (t === 0) return { stem: `According to the graph, how many more are there for "${labels[i]}" than for "${labels[j]}"? (Use the absolute difference.)`, svg, correct: Math.abs(vals[i] - vals[j]), wrong: [Math.abs(vals[i] - vals[j]) + 5, vals[i] + vals[j], Math.abs(vals[i] - vals[j]) - 5, 5], expl: `Read both bars and subtract: |${vals[i]} − ${vals[j]}|.` };
      if (t === 1) return { stem: `What is the total for "${labels[i]}" and "${labels[j]}" together?`, svg, correct: vals[i] + vals[j], wrong: [vals[i] + vals[j] + 5, vals[i] + vals[j] - 5, Math.abs(vals[i] - vals[j]), vals[i] * 2], expl: `${vals[i]} + ${vals[j]} = ${vals[i] + vals[j]}.` };
      const k = ri(0, 4); return { stem: `Which category has exactly ${vals[k]}?`, svg, correct: labels[k], wrong: labels.filter((_, x) => x !== k), expl: `Only "${labels[k]}" reaches ${vals[k]}.` };
    }
    case 'line': {
      let vals; do vals = MONTHS.map(() => 5 * ri(1, 7)); while (!uniq(vals.slice(1).map((v, i) => v - vals[i])));
      const svg = lineChart({ title: 'Average temperature (°C)', labels: MONTHS, values: vals, yMax: 40, yStep: 5, yLabel: '°C' });
      const diffs = vals.slice(1).map((v, i) => v - vals[i]), best = diffs.indexOf(Math.max(...diffs));
      const names = diffs.map((_, i) => `${MONTHS[i]}–${MONTHS[i + 1]}`);
      return { stem: 'Between which two consecutive months did the temperature increase the most?', svg, correct: names[best], wrong: names.filter((_, i) => i !== best).slice(0, 3), expl: `The largest rise is ${Math.max(...diffs)}°C, from ${names[best].replace('–', ' to ')}.` };
    }
    case 'pie': {
      let pct; do pct = [0, 0, 0, 0].map(() => 5 * ri(2, 8)); while (pct.reduce((a, b) => a + b) !== 100 || !uniq(pct));
      const labels = pick([['Pizza', 'Pasta', 'Salad', 'Soup'], ['Math', 'Art', 'Music', 'Sports'], ['Bus', 'Walk', 'Car', 'Bike']]), n = pick([200, 240, 300, 400]), k = ri(0, 3);
      return { stem: `${n} students were surveyed. How many students chose "${labels[k]}"?`, svg: pieChart({ title: 'Survey results', parts: labels.map((l, i) => ({ label: l, pct: pct[i] })) }), correct: (pct[k] * n) / 100, wrong: [(pct[k] * n) / 100 + 10, (pct[k] * n) / 100 - 10, pct[k], n - (pct[k] * n) / 100], expl: `${pct[k]}% of ${n} = ${(pct[k] * n) / 100}.` };
    }
    case 'rect': {
      const w = ri(3, 12), h = ri(3, 9), ask = pick(['area', 'perimeter']);
      return { stem: `What is the ${ask} of the rectangle, in ${ask === 'area' ? 'square centimeters' : 'centimeters'}?`, svg: rectFig(w, h), correct: ask === 'area' ? w * h : 2 * (w + h), wrong: ask === 'area' ? [2 * (w + h), w + h, w * h + w, w * h - h] : [w * h, w + h, 2 * (w + h) + 2, 2 * w + h], expl: ask === 'area' ? `Area = ${w} × ${h}.` : `Perimeter = 2 × (${w} + ${h}).` };
    }
    case 'tri': {
      const [a, b, c] = pick([[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15], [7, 24, 25]]);
      return { stem: 'In the right triangle shown, what is the length of the hypotenuse (the side marked ?)', svg: rightTriangle(a, b), correct: c, wrong: [a + b, c + 1, c - 1, Math.abs(b - a)], expl: `${a}² + ${b}² = ${c}², so the hypotenuse is ${c}.` };
    }
    case 'circle': {
      const r = ri(2, 9), ask = pick(['circumference', 'area']);
      return { stem: `The circle has radius ${r}. What is its ${ask}?`, svg: circleFig(r), correct: ask === 'area' ? `${r * r}π` : `${2 * r}π`, wrong: ask === 'area' ? [`${2 * r}π`, `${r}π`, `${2 * r * r}π`, `${4 * r}π`] : [`${r * r}π`, `${r}π`, `${4 * r}π`, `${r * 2 + 2}π`], expl: ask === 'area' ? 'Area = πr².' : 'Circumference = 2πr.' };
    }
    case 'coord': {
      let x, y; do { x = ri(-5, 5); y = ri(-5, 5); } while (!x || !y || x === y || x === -y);
      return { stem: 'What are the coordinates of point P?', svg: coordPlane([{ x, y, label: 'P' }]), correct: `(${x}, ${y})`, wrong: [`(${y}, ${x})`, `(${-x}, ${y})`, `(${x}, ${-y})`, `(${-y}, ${-x})`], expl: 'Read x (left/right) first, then y (up/down).' };
    }
    case 'angle': {
      const d = 5 * ri(8, 32);
      return { stem: 'The figure shows two angles on a straight line. What is the value of x?', svg: angleFig(d), correct: 180 - d, wrong: [d, 90 - (d % 90), 360 - d, 180 - d + 10], expl: `Angles on a line sum to 180°: 180 − ${d} = ${180 - d}.` };
    }
    case 'numline': {
      const v = ri(-5, 5), svg = numberLine(-6, 6, v);
      return { stem: 'What number does point P represent on the number line?', svg, correct: v, wrong: [-v, v + 1, v - 1, v === 0 ? 2 : v * 2], expl: `P is at ${v}.` };
    }
    case 'scatter': {
      const m = ri(1, 3), b = ri(0, 3), yMax = 5 * Math.ceil((10 * m + b + 1) / 5), pts = [];
      for (let x = 1; x <= 9; x++) pts.push([x, Math.max(0, Math.min(yMax, m * x + b + ri(-1, 1)))]);
      const xq = ri(5, 9), ans = m * xq + b;
      return { stem: `The scatterplot shows data with a line of best fit. According to the line, what is the predicted value of y when x = ${xq}?`, svg: scatterPlot({ title: 'Line of best fit', points: pts, xMax: 10, yMax, step: yMax <= 20 ? 2 : 5, line: { m, b } }), correct: ans, wrong: [ans + m, ans - m, m * xq, ans + 2], expl: `The line has slope ${m} and y-intercept ${b}: y = ${m}(${xq}) + ${b}.` };
    }
    case 'scatter2': {
      const type = pick(['positive', 'negative', 'none']), pts = [];
      for (let x = 1; x <= 9; x++) pts.push([x, Math.max(0, Math.min(10, type === 'positive' ? x + ri(-1, 1) : type === 'negative' ? 10 - x + ri(-1, 1) : ri(1, 9)))]);
      const labels = { positive: 'a positive association', negative: 'a negative association', none: 'little or no association' };
      return { stem: 'Which statement best describes the relationship between x and y in the scatterplot?', svg: scatterPlot({ title: 'Scatterplot', points: pts }), correct: labels[type], wrong: Object.entries(labels).filter(([k]) => k !== type).map(([, v]) => v).concat(['an exact linear relationship with slope 0']), expl: `The points trend ${type === 'none' ? 'in no clear direction' : type === 'positive' ? 'upward' : 'downward'}.` };
    }
    case 'gbar': {
      const [s1, s2] = pick([['2023', '2024'], ['Boys', 'Girls'], ['Class A', 'Class B']]), labels = pick([['Math', 'Art', 'Music', 'Sports'], ['Fall', 'Winter', 'Spring', 'Summer'], ['Grade 5', 'Grade 6', 'Grade 7', 'Grade 8']]);
      let a, c, diffs; do { a = labels.map(() => 5 * ri(2, 9)); c = labels.map(() => 5 * ri(2, 9)); diffs = a.map((v, i) => Math.abs(v - c[i])); } while (!uniq(diffs) || Math.min(...diffs) === 0);
      const svg = groupedBar({ title: `${s1} vs ${s2}`, labels, series: [{ name: s1, values: a }, { name: s2, values: c }], yMax: 50, yStep: 5, yLabel: 'Count' }), t = ri(0, 1);
      if (t === 0) { const k = diffs.indexOf(Math.max(...diffs)); return { stem: `In which category is the difference between ${s1} and ${s2} the greatest?`, svg, correct: labels[k], wrong: labels.filter((_, i) => i !== k), expl: `The largest gap is ${Math.max(...diffs)} in ${labels[k]}.` }; }
      const k = ri(0, 3); return { stem: `What is the combined total of ${s1} and ${s2} for "${labels[k]}"?`, svg, correct: a[k] + c[k], wrong: [a[k] + c[k] + 5, a[k] + c[k] - 5, Math.abs(a[k] - c[k]), a[k] * 2], expl: `${a[k]} + ${c[k]}.` };
    }
    case 'hist': {
      const bins = ['50–59', '60–69', '70–79', '80–89', '90–100'], vals = bins.map(() => 2 * ri(1, 7)), k = ri(1, 3), sum = vals.slice(k).reduce((x, y) => x + y, 0), from = ['60', '70', '80'][k - 1];
      return { stem: `The histogram shows test scores. How many students scored ${from} or higher?`, svg: histogram({ title: 'Test scores', bins, values: vals, yMax: 16, yStep: 2, xLabel: 'Score' }), correct: sum, wrong: [sum + 2, sum - 2, vals.slice(0, k).reduce((x, y) => x + y, 0), vals[k]], expl: `Add the bars from ${from} up: ${vals.slice(k).join(' + ')}.` };
    }
    case 'pict': {
      const labels = pick([['Mon', 'Tue', 'Wed', 'Thu'], ['Apples', 'Pears', 'Plums', 'Figs'], ['Team A', 'Team B', 'Team C', 'Team D']]), unit = pick([2, 5, 10]); let cnt; do cnt = labels.map(() => ri(1, 7)); while (!uniq(cnt));
      const [i, j] = shuffle([0, 1, 2, 3]).slice(0, 2), t = ri(0, 1);
      if (t === 0) return { stem: `How many in total are shown for "${labels[i]}" and "${labels[j]}" together?`, svg: pictograph({ title: 'Picture graph', rows: labels.map((l, k) => ({ label: l, count: cnt[k] })), unit }), correct: (cnt[i] + cnt[j]) * unit, wrong: [(cnt[i] + cnt[j]) * unit + unit, (cnt[i] + cnt[j]), Math.abs(cnt[i] - cnt[j]) * unit, (cnt[i] + cnt[j]) * unit - unit], expl: `(${cnt[i]} + ${cnt[j]}) stars × ${unit}.` };
      return { stem: `Each star stands for ${unit}. How many more does "${labels[i]}" have than "${labels[j]}"? (Use the absolute difference.)`, svg: pictograph({ title: 'Picture graph', rows: labels.map((l, k) => ({ label: l, count: cnt[k] })), unit }), correct: Math.abs(cnt[i] - cnt[j]) * unit, wrong: [Math.abs(cnt[i] - cnt[j]), (cnt[i] + cnt[j]) * unit, Math.abs(cnt[i] - cnt[j]) * unit + unit, cnt[i] * unit], expl: `${Math.abs(cnt[i] - cnt[j])} stars × ${unit}.` };
    }
    case 'venn': {
      const [A, B] = pick([['Soccer', 'Chess'], ['Choir', 'Band'], ['Math Club', 'Art Club']]), oa = ri(3, 14), bo = ri(2, 9), ob = ri(3, 14), out = ri(2, 10), t = ri(0, 2);
      const svg = venn({ title: 'Students in clubs', aLabel: A, bLabel: B, onlyA: oa, both: bo, onlyB: ob, outside: out });
      if (t === 0) return { stem: `How many students are in exactly one of the two clubs?`, svg, correct: oa + ob, wrong: [oa + ob + bo, oa + bo + ob + out, bo, oa + bo], expl: `Exactly one club means ${A} only (${oa}) plus ${B} only (${ob}): ${oa} + ${ob} = ${oa + ob}. The ${bo} students in both are not counted.` };
      if (t === 1) return { stem: `How many students are in ${A}? (Include those in both clubs.)`, svg, correct: oa + bo, wrong: [oa, oa + bo + ob, bo, oa + ob], expl: `Everyone inside the ${A} circle counts: ${oa} in ${A} only + ${bo} in both = ${oa + bo}.` };
      return { stem: 'How many students are shown in total, including the students outside both circles?', svg, correct: oa + bo + ob + out, wrong: [oa + bo + ob, oa + ob + out, oa + bo + ob + out + bo, bo + out], expl: `Add every region: ${oa} + ${bo} + ${ob} + ${out} outside = ${oa + bo + ob + out}.` };
    }
    case 'clock': {
      const h = ri(1, 12), m = 5 * ri(0, 11), fmt = (hh, mm) => `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')}`;
      return { stem: 'What time does the clock show?', svg: clockFace(h, m), correct: fmt(h, m), wrong: [fmt(m / 5 || 12, h * 5 % 60), fmt(h + 1, m), fmt(h - 1, m), fmt(h, (m + 5) % 60)], expl: 'The short hand shows the hour and the long hand shows the minutes.' };
    }
    case 'fraction': {
      const total = pick([4, 5, 6, 8, 10, 12]), sh = ri(1, total - 1), shape = pick(['bar', 'circle']);
      return { stem: 'What fraction of the figure is shaded?', svg: fractionShade(total, sh, shape), correct: `${sh}/${total}`, wrong: [`${total - sh}/${total}`, `${sh}/${total - sh}`, `${Math.min(total, sh + 1)}/${total}`, `${total}/${sh}`], expl: `${sh} of ${total} equal parts are shaded.` };
    }
    case 'table': {
      const items = shuffle(['Notebook', 'Pencil', 'Ruler', 'Eraser', 'Marker']).slice(0, 3), price = items.map(() => ri(1, 6)), qty = items.map(() => ri(2, 6));
      const total = price.reduce((a, p, i) => a + p * qty[i], 0), k = ri(0, 2);
      if (ri(0, 1)) return { stem: 'Based on the table, what is the total cost of all the items?', svg: tableSvg({ title: 'School supplies', headers: ['Item', 'Price ($)', 'Qty'], rows: items.map((n, i) => [n, price[i], qty[i]]) }), correct: `$${total}`, wrong: [`$${total + 3}`, `$${total - 2}`, `$${price.reduce((a, b) => a + b, 0)}`, `$${qty.reduce((a, b) => a + b, 0)}`], expl: `Multiply price × quantity for each row and add.` };
      return { stem: `Based on the table, how much do the ${items[k].toLowerCase()}s cost altogether?`, svg: tableSvg({ title: 'School supplies', headers: ['Item', 'Price ($)', 'Qty'], rows: items.map((n, i) => [n, price[i], qty[i]]) }), correct: `$${price[k] * qty[k]}`, wrong: [`$${price[k] + qty[k]}`, `$${price[k] * qty[k] + price[k]}`, `$${price[k]}`, `$${price[k] * qty[k] - qty[k]}`], expl: `Cost = price × quantity = $${price[k]} × ${qty[k]} = $${price[k] * qty[k]}.` };
    }
    case 'reflect': {
      let x, y, pts; do { x = ri(1, 5) * pick([-1, 1]); y = ri(1, 5) * pick([-1, 1]); pts = [{ x, y, label: 'A' }, { x: x + pick([-2, 2]), y: y + pick([-2, 2]), label: 'B' }, { x: x + pick([-3, 3]), y, label: 'C' }]; } while (pts.some((p) => Math.abs(p.x) > 6 || Math.abs(p.y) > 6) || x === y || x === -y);
      const axis = pick(['y-axis', 'x-axis']), cor = axis === 'y-axis' ? `(${-x}, ${y})` : `(${x}, ${-y})`;
      return { stem: `Triangle ABC is reflected across the ${axis}. What are the coordinates of the image of point A?`, svg: reflectGrid(pts), correct: cor, wrong: [axis === 'y-axis' ? `(${x}, ${-y})` : `(${-x}, ${y})`, `(${-x}, ${-y})`, `(${y}, ${x})`, `(${x}, ${y})`], expl: `Reflecting across the ${axis} changes the sign of the ${axis === 'y-axis' ? 'x' : 'y'}-coordinate.` };
    }
    default: { // grid area
      const all = []; for (let c = 0; c < 6; c++) for (let r = 0; r < 6; r++) all.push([c, r]);
      const cells = shuffle(all).slice(0, ri(7, 16));
      return { stem: 'Each small square has an area of 1 square unit. What is the total shaded area?', svg: gridShape(cells), correct: cells.length, wrong: [cells.length + 1, cells.length - 1, cells.length + 2, cells.length * 2], expl: 'Count the shaded squares.' };
    }
  }
}
const GKINDS = ['bar', 'line', 'pie', 'rect', 'tri', 'circle', 'coord', 'angle', 'numline', 'grid', 'scatter', 'scatter2', 'gbar', 'hist', 'pict', 'venn', 'clock', 'fraction', 'table', 'reflect'];
function addGraph(exam, section, kinds, count, dMin, dMax) {
  for (let i = 0; i < count; i++) {
    const kind = kinds[i % kinds.length], g = graphItem(kind);
    const d = Math.min(dMax, dMin + (['tri', 'circle', 'angle', 'line'].includes(kind) ? 1 : 0) + (i % (dMax - dMin + 1)));
    mcq(exam, section, Math.min(5, d), g.stem, g.correct, g.wrong, g.expl, { image_svg: g.svg });
  }
}

/** Word / arithmetic problems for SSAT & ISEE (text only). */
function wordMath(d) {
  const t = ri(0, 7);
  if (t === 0) { const den = pick([3, 4, 5, 8]), num = ri(1, den - 1), m = den * ri(3, 9); return [`What is ${num}/${den} of ${m}?`, (num * m) / den, [(num * m) / den + den, m - (num * m) / den + 1, num * den, m / den + 1], `${m} ÷ ${den} × ${num}.`]; }
  if (t === 1) { const a = ri(2, 5), b0 = ri(2, 7), b = b0 === a ? b0 + 1 : b0, k = ri(3, 9); return [`The ratio of boys to girls in a class is ${a}:${b}. If there are ${a * k} boys, how many girls are there?`, b * k, [b * k + a, a * k + b, b + k, a * b], `${a * k} ÷ ${a} = ${k} groups, and ${k} × ${b} = ${b * k}.`]; }
  if (t === 2) { const x = ri(8, 15), y = ri(8, 15), z = ri(8, 15), mean = ri(10, 14), fourth = 4 * mean - x - y - z; if (fourth < 1) return wordMath(d); return [`The average of four numbers is ${mean}. Three of the numbers are ${x}, ${y}, and ${z}. What is the fourth number?`, fourth, [fourth + 4, fourth - 2, mean, 4 * mean], `Total = 4 × ${mean} = ${4 * mean}; subtract ${x + y + z}.`]; }
  if (t === 3) { const p = pick([60, 80, 120, 200]), off = pick([10, 20, 25, 50]), sale = p - (p * off) / 100; return [`A jacket that costs $${p} is on sale for ${off}% off. What is the sale price?`, `$${sale}`, [`$${(p * off) / 100}`, `$${sale + 10}`, `$${p - off}`, `$${sale - 5}`], `${off}% of ${p} = ${(p * off) / 100}, so ${p} − ${(p * off) / 100} = ${sale}.`]; }
  if (t === 4) { const x = ri(3, 14), a = ri(2, 6), b = ri(1, 12); return [`If ${a}x − ${b} = ${a * x - b}, what is the value of x?`, x, [x + 1, x - 1, x + a, a * x], `Add ${b}, divide by ${a}.`]; }
  if (t === 5) { const s = pick([40, 45, 50, 60]), hrs = pick([1.5, 2, 2.5, 3]); return [`A car travels at ${s} miles per hour for ${hrs} hours. How many miles does it travel?`, s * hrs, [s + hrs, s * hrs + 10, Math.round((s / hrs) * 10) / 10, s * hrs - 10], `Distance = rate × time = ${s} × ${hrs}.`]; }
  if (t === 6) { const a = ri(4, 12), b = ri(2, 4); return [`What is the value of √${a * a} + ${b}²?`, a + b * b, [a * a + b * b, a + 2 * b, a * a + b, a + b], `√${a * a} = ${a} and ${b}² = ${b * b}.`]; }
  const n = ri(5, 25); return [`The sum of three consecutive integers is ${3 * n}. What is the greatest of the three integers?`, n + 1, [n, n + 2, n - 1, 3 * n - 2], `The middle integer is ${n}, so the greatest is ${n + 1}.`];
}
function addWordMath(exam, section, count, dMin) { for (let i = 0; i < count; i++) { const [stem, c, w, e] = wordMath(); mcq(exam, section, Math.min(5, dMin + (i % 3)), stem, c, w, e); } }

/** SCAT / ISEE style quantity comparisons */
function qcItem(figure) {
  const t = figure ? pick(['rect', 'bar']) : pick(['frac', 'var', 'expr', 'pow', 'pct']);
  let A, B, expl, extra = {}, forced = null, stem;
  if (t === 'frac') { const [a, b, c, d] = [ri(1, 7), ri(2, 9), ri(1, 7), ri(2, 9)]; A = a / b; B = c / d; stem = `Quantity A: ${a}/${b}\nQuantity B: ${c}/${d}`; expl = `Compare ${a}×${d} with ${c}×${b}.`; }
  else if (t === 'var') { const k = ri(2, 6); const c = pick([0, 1]); if (c) { A = null; forced = 0; stem = `x > ${k}\nQuantity A: x + 2\nQuantity B: ${k + 2}`; expl = `Since x > ${k}, x + 2 > ${k + 2}.`; } else { forced = 3; stem = `x is an integer and 0 < x < ${k + 3}\nQuantity A: x\nQuantity B: ${k}`; expl = `x could be smaller or larger than ${k}, so it cannot be determined.`; } }
  else if (t === 'expr') { const n = ri(2, 9), m = ri(2, 6); A = m * (n + 4); B = m * n + pick([m * 4, m * 4, m * 4 + 2, m * 4 - 3]); stem = `n = ${n}\nQuantity A: ${m}(n + 4)\nQuantity B: ${m}n + ${B - m * n}`; expl = `Quantity A = ${A}; Quantity B = ${B}.`; }
  else if (t === 'pow') { const a = ri(2, 4), b0 = ri(3, 6), b = b0 === a ? b0 + 1 : b0; A = a ** b; B = b ** a; stem = `Quantity A: ${a}^${b}\nQuantity B: ${b}^${a}`; expl = `${a}^${b} = ${A}; ${b}^${a} = ${B}.`; }
  else if (t === 'pct') { const [p, v, q, w] = [pick([10, 20, 25, 50]), pick([40, 60, 80, 120]), pick([10, 20, 30, 40]), pick([30, 50, 70, 90])]; A = (p * v) / 100; B = (q * w) / 100; stem = `Quantity A: ${p}% of ${v}\nQuantity B: ${q}% of ${w}`; expl = `A = ${A}, B = ${B}.`; }
  else if (t === 'rect') { const w = ri(3, 12), h = ri(3, 9); A = w * h; B = A + pick([-6, 0, 4, 9]); stem = `Quantity A: The area of the rectangle (in cm²)\nQuantity B: ${B}`; extra = { image_svg: rectFig(w, h) }; expl = `Area = ${w} × ${h} = ${A}.`; }
  else { const labels = pick(SETS); let vals; do vals = labels.map(() => 5 * ri(2, 9)); while (!uniq(vals)); const [i, j] = shuffle([0, 1, 2, 3, 4]).slice(0, 2); A = vals[i]; B = vals[j]; stem = `Quantity A: The value of "${labels[i]}" in the graph\nQuantity B: The value of "${labels[j]}" in the graph`; extra = { image_svg: barChart({ title: 'Graph', labels, values: vals, yMax: 50, yStep: 5 }) }; expl = `${labels[i]} = ${A}, ${labels[j]} = ${B}.`; }
  const ans = forced !== null ? forced : A > B ? 0 : A < B ? 1 : 2;
  return { stem, ans, expl, extra };
}
function addQC(exam, section, count, figEvery) {
  for (let i = 0; i < count; i++) { const q = qcItem(figEvery && i % figEvery === 0); add(exam, section, 1 + (i % 5), q.stem, QC, q.ans, q.expl, q.extra); }
}

/* ---- graph/geometry samples in existing exams ---- */
addGraph('MAP', 'math', ['bar', 'line', 'pie', 'rect', 'tri', 'coord', 'angle', 'numline', 'grid', 'circle'], 20, 2, 4);
addGraph('CAT4', 'quantitative', ['bar', 'pie', 'numline'], 6, 2, 4);
addGraph('WIDA', 'reading', ['bar', 'pie'], 3, 2, 3);

/* ---------------- SCAT ---------------- */
[
  [1, 'Hot : Cold :: Light : ?', ['Lamp', 'Dark', 'Bright', 'Sun'], 1], [1, 'Puppy : Dog :: Kitten : ?', ['Cat', 'Mouse', 'Bird', 'Milk'], 0],
  [2, 'Pilot : Airplane :: Captain : ?', ['Ship', 'Wheel', 'Army', 'Ocean'], 0], [2, 'Seed : Plant :: Egg : ?', ['Nest', 'Chicken', 'Shell', 'Yolk'], 1],
  [2, 'Whisper : Shout :: Stroll : ?', ['Walk', 'Sprint', 'Rest', 'Slow'], 1], [3, 'Architect : Blueprint :: Composer : ?', ['Orchestra', 'Score', 'Piano', 'Concert'], 1],
  [3, 'Barometer : Pressure :: Odometer : ?', ['Speed', 'Distance', 'Fuel', 'Weather'], 1], [3, 'Frugal : Wasteful :: Humble : ?', ['Modest', 'Arrogant', 'Poor', 'Quiet'], 1],
  [4, 'Eulogy : Praise :: Satire : ?', ['Mockery', 'Sadness', 'Poetry', 'Funeral'], 0], [4, 'Gregarious : Solitary :: Verbose : ?', ['Talkative', 'Concise', 'Loud', 'Friendly'], 1],
  [4, 'Lighthouse : Warning :: Bell : ?', ['Ring', 'Signal', 'Church', 'Metal'], 1], [5, 'Obsolete : Modern :: Transparent : ?', ['Clear', 'Opaque', 'Glass', 'Fragile'], 1],
  [5, 'Zenith : Nadir :: Apex : ?', ['Peak', 'Base', 'Cone', 'Summit'], 1], [5, 'Skeptic : Doubt :: Optimist : ?', ['Hope', 'Fear', 'Think', 'Argue'], 0],
  [3, 'Chef : Kitchen :: Surgeon : ?', ['Hospital', 'Scalpel', 'Doctor', 'Mask'], 0], [4, 'Brevity : Lengthy :: Clarity : ?', ['Obscure', 'Bright', 'Simple', 'Short'], 0],
].map((x, i) => [...x, ['Opposites: hot/cold, light/dark.', 'A young animal and its adult: puppy/dog, kitten/cat.', 'The person who operates the vehicle: pilot/airplane, captain/ship.', 'What the first becomes: seed/plant, egg/chicken.', 'Low versus high intensity of the same action: whisper/shout, stroll/sprint.', 'The plan a professional produces: architect/blueprint, composer/score.', 'An instrument and what it measures: barometer/pressure, odometer/distance.', 'Antonyms: frugal/wasteful, humble/arrogant.', 'A eulogy is meant to praise; satire is meant to mock.', 'Antonyms: gregarious/solitary, verbose/concise.', 'The function of the object: a lighthouse warns, a bell signals.', 'Antonyms: obsolete/modern, transparent/opaque.', 'Opposite extremes: zenith/nadir, apex/base.', 'A skeptic tends to doubt; an optimist tends to hope.', 'A worker and the place they work: chef/kitchen, surgeon/hospital.', 'Antonyms: brevity/lengthy, clarity/obscure.'][i]]).forEach(([d, s, c, a, e]) => add('SCAT', 'verbal', d, s, c, a, e));
addQC('SCAT', 'quantitative', 24, 4);

/* ---------------- SSAT ---------------- */
for (const [d, w, c, a] of [
  [1, 'HAPPY', ['sad', 'joyful', 'tired', 'angry'], 1], [1, 'BEGIN', ['finish', 'start', 'wait', 'hide'], 1], [2, 'ANCIENT', ['modern', 'old', 'small', 'noisy'], 1],
  [2, 'REPLY', ['answer', 'ask', 'repeat', 'listen'], 0], [3, 'SCARCE', ['rare', 'plentiful', 'costly', 'heavy'], 0], [3, 'CAUTIOUS', ['careful', 'bold', 'quick', 'angry'], 0],
  [3, 'RELUCTANT', ['eager', 'unwilling', 'helpful', 'tired'], 1], [4, 'TENACIOUS', ['persistent', 'timid', 'clever', 'generous'], 0], [4, 'CANDID', ['honest', 'sweet', 'secretive', 'bright'], 0],
  [4, 'MEAGER', ['plentiful', 'scanty', 'noble', 'hungry'], 1], [5, 'LUCID', ['clear', 'confusing', 'lucky', 'bright'], 0], [5, 'PRUDENT', ['wise', 'rude', 'loud', 'greedy'], 0],
  [5, 'ABYSS', ['hill', 'chasm', 'river', 'tower'], 1], [4, 'ARDENT', ['passionate', 'cold', 'lazy', 'small'], 0],
]) add('SSAT', 'verbal', d, `Choose the word closest in meaning to ${w}.`, c, a, `${w} means ${c[a]}.`);
for (const [d, s, c, a] of [
  [2, 'Finger is to hand as toe is to ___', ['foot', 'shoe', 'nail', 'leg'], 0], [2, 'Teacher is to school as doctor is to ___', ['patient', 'hospital', 'medicine', 'nurse'], 1],
  [3, 'Tame is to wild as calm is to ___', ['peaceful', 'stormy', 'quiet', 'gentle'], 1], [3, 'Wheat is to bread as grape is to ___', ['vine', 'wine', 'purple', 'juicy'], 1],
  [4, 'Philanthropist is to generosity as miser is to ___', ['wealth', 'greed', 'poverty', 'kindness'], 1], [5, 'Verdict is to jury as diagnosis is to ___', ['patient', 'physician', 'illness', 'prescription'], 1],
]) add('SSAT', 'verbal', d, s, c, a, 'Define the relationship between the first two words.');
addWordMath('SSAT', 'quantitative', 16, 1);
addGraph('SSAT', 'quantitative', GKINDS, 20, 2, 4);
const SP1 = 'Every morning before sunrise, Tomás walked to the harbor to help his uncle sort the night\'s catch. At first the cold bit through his gloves and the smell made his eyes water. But as weeks passed he learned to tell a mackerel from a herring by touch alone, and the fishermen began to nod at him as one of their own. By spring, he no longer dreaded the alarm clock.';
add('SSAT', 'reading', 2, 'Why did Tomás stop dreading the alarm clock?', ['He bought a better coat.', 'He grew skilled and accepted at the harbor.', 'His uncle paid him more.', 'The harbor moved closer.'], 1, 'His skills and acceptance grew.', { passage: SP1 });
add('SSAT', 'reading', 3, 'The phrase "one of their own" suggests that the fishermen', ['felt sorry for him', 'treated him as part of their group', 'wanted him to leave', 'were competing with him'], 1, 'Belonging.', { passage: SP1 });
add('SSAT', 'reading', 4, 'Which best describes how Tomás changes in the passage?', ['From uncomfortable to confident', 'From rich to poor', 'From angry to forgiving', 'From lazy to bored'], 0, 'Discomfort → competence.', { passage: SP1 });
const SP2 = 'Bridges are often built with arches because of how an arch handles weight. Instead of letting a load press straight down on a single span, an arch spreads the force outward along its curve and into the ground at each end. Engineers in ancient Rome used this principle to build aqueducts that still stand today, while flat beams of the same age have long since cracked.';
add('SSAT', 'reading', 3, 'What is the main purpose of the passage?', ['To describe the history of Rome', 'To explain why arches are strong', 'To compare bridges and aqueducts', 'To argue that beams are useless'], 1, 'Explains arch strength.', { passage: SP2 });
add('SSAT', 'reading', 4, 'According to the passage, an arch handles weight by', ['pressing it straight down', 'spreading force along its curve into the ground', 'absorbing it with the beam', 'reflecting it upward'], 1, 'Stated directly.', { passage: SP2 });
add('SSAT', 'reading', 5, 'What can be inferred about Roman aqueducts?', ['They were built with flat beams.', 'Their design has proven durable.', 'They no longer exist.', 'They were never used.'], 1, 'They still stand.', { passage: SP2 });
add('SSAT', 'reading', 4, 'The word "span" as used in the passage most nearly means', ['a length of time', 'the part of a bridge between supports', 'a small insect', 'to cross over'], 1, 'Bridge section.', { passage: SP2 });
Q.push({ id: 'seed-ssat-writing-1', exam_type: 'SSAT', section: 'writing', kind: 'text', difficulty: 2, stem: 'Choose ONE prompt. (A) "The door was open, but nobody was home." Continue the story. (B) Describe a rule you would change at school, and explain why.', choices: null, answer: null });
Q.push({ id: 'seed-ssat-writing-2', exam_type: 'SSAT', section: 'writing', kind: 'text', difficulty: 3, stem: 'Choose ONE prompt. (A) "It was the best mistake I ever made." (B) Is it more important to be honest or kind? Support your opinion with examples.', choices: null, answer: null });

/* ---------------- ISEE ---------------- */
for (const [d, w, c, a] of [
  [1, 'RAPID', ['slow', 'fast', 'loud', 'late'], 1], [2, 'CONCEAL', ['reveal', 'hide', 'carry', 'repair'], 1], [2, 'FRAGILE', ['strong', 'delicate', 'bright', 'heavy'], 1],
  [3, 'ABUNDANT', ['plentiful', 'rare', 'tiny', 'ugly'], 0], [3, 'DILIGENT', ['hardworking', 'careless', 'shy', 'angry'], 0], [3, 'HOSTILE', ['friendly', 'unfriendly', 'hungry', 'tall'], 1],
  [4, 'BENEVOLENT', ['kind', 'cruel', 'lazy', 'proud'], 0], [4, 'SCRUTINIZE', ['ignore', 'examine closely', 'praise', 'forget'], 1], [5, 'EPHEMERAL', ['lasting', 'short-lived', 'enormous', 'hidden'], 1],
  [5, 'AUDACIOUS', ['timid', 'bold', 'quiet', 'ordinary'], 1], [4, 'DEARTH', ['shortage', 'surplus', 'celebration', 'warmth'], 0],
]) add('ISEE', 'verbal', d, `Select the word whose meaning is closest to ${w}.`, c, a, `${w} means ${c[a]}.`);
for (const [d, s, c, a] of [
  [2, 'The soup was so ___ that she had to wait before tasting it.', ['cold', 'hot', 'salty', 'thin'], 1], [2, 'Because the road was icy, drivers moved ___.', ['quickly', 'carelessly', 'slowly', 'loudly'], 2],
  [3, 'Although the plan seemed ___ at first, it proved surprisingly effective.', ['brilliant', 'flawed', 'famous', 'obvious'], 1], [3, 'The scientist\'s ___ approach ensured that no detail was overlooked.', ['careless', 'meticulous', 'hasty', 'casual'], 1],
  [4, 'The speaker was so ___ that the audience grew restless.', ['concise', 'tedious', 'witty', 'brief'], 1], [4, 'Despite her ___ , she never lost her sense of humor.', ['hardships', 'victories', 'friends', 'talents'], 0],
  [5, 'His ___ remarks, though meant to help, only offended the guests.', ['tactless', 'gracious', 'brief', 'delightful'], 0], [5, 'The senator\'s speech was ___ ; it avoided taking any clear position.', ['equivocal', 'emphatic', 'candid', 'decisive'], 0],
]) add('ISEE', 'verbal', d, s, c, a, 'Pick the word that makes the sentence logical.');
addQC('ISEE', 'quantitative', 14, 4);
addGraph('ISEE', 'quantitative', ['bar', 'line', 'pie', 'grid'], 8, 2, 4);
addWordMath('ISEE', 'math', 16, 1);
addGraph('ISEE', 'math', GKINDS, 20, 2, 5);
const IP1 = 'In many coastal cities, rising sea levels are forcing planners to rethink where people can safely live. Some propose walls and pumps to hold the water back, while others argue that it is wiser to move neighborhoods inland and restore marshes that naturally absorb floods. Each approach is costly, but supporters of the second note that it can also create parks and wildlife habitat.';
add('ISEE', 'reading', 3, 'The passage is primarily concerned with', ['the cost of building walls', 'different responses to rising sea levels', 'the history of coastal cities', 'how marshes support wildlife'], 1, 'Compares responses.', { passage: IP1 });
add('ISEE', 'reading', 4, 'Supporters of moving neighborhoods inland believe that this approach', ['is cheaper than pumps', 'could also provide parks and habitat', 'will stop sea levels rising', 'is unpopular'], 1, 'Stated at the end.', { passage: IP1 });
add('ISEE', 'reading', 5, 'The word "restore" in the passage most nearly means', ['destroy', 'bring back to a former condition', 'measure', 'sell'], 1, 'Restore = bring back.', { passage: IP1 });
const IP2 = 'The first time Mara played the violin in front of an audience, her hands trembled so badly that the opening notes wobbled. She considered stopping, but the old man in the front row smiled and gave a tiny nod. Her breathing slowed. By the second page, the music seemed to play itself, and when she finally lowered her bow, the applause startled her.';
add('ISEE', 'reading', 2, 'Why did Mara\'s breathing slow?', ['The piece became easier.', 'A listener gave her an encouraging nod.', 'She stopped playing.', 'The audience left.'], 1, 'The nod calmed her.', { passage: IP2 });
add('ISEE', 'reading', 3, 'The word "startled" suggests that Mara felt', ['bored', 'surprised', 'embarrassed', 'furious'], 1, 'Surprised by applause.', { passage: IP2 });
add('ISEE', 'reading', 4, 'Which sentence best states a theme of the passage?', ['Practice is unnecessary.', 'Support can help us overcome fear.', 'Audiences are unkind.', 'Violins are difficult.'], 1, 'Encouragement.', { passage: IP2 });
Q.push({ id: 'seed-isee-essay-1', exam_type: 'ISEE', section: 'essay', kind: 'text', difficulty: 2, stem: 'Write an essay (about 200 words) in response to: "What is the most important quality of a good friend?" Use specific examples.', choices: null, answer: null });
Q.push({ id: 'seed-isee-essay-2', exam_type: 'ISEE', section: 'essay', kind: 'text', difficulty: 3, stem: 'Write an essay (about 200 words): "If you could change one thing about your town, what would it be and why?"', choices: null, answer: null });


/* =====================================================================
   Round 3: CogAT / SAT / TOEFL Junior + larger banks
   ===================================================================== */
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';

/** number-series items (5 rule types, difficulty 1..5) */
function seriesItems(exam, section, per) {
  for (let i = 0; i < per; i++) { const s = ri(2, 9), k = ri(2, 6); const q = [0, 1, 2, 3, 4].map((j) => s + j * k); mcq(exam, section, 1, `What number comes next?  ${q.join(', ')}, ?`, s + 5 * k, [s + 5 * k + 1, s + 6 * k, s + 4 * k, s + 5 * k - 1], `Add ${k} each time.`); }
  for (let i = 0; i < per; i++) { const s = ri(2, 5), m = pick([2, 3]); const q = [0, 1, 2, 3].map((j) => s * m ** j); mcq(exam, section, 2, `What number comes next?  ${q.join(', ')}, ?`, s * m ** 4, [s * m ** 4 + m, s * m ** 3 + m, q[3] * 2 + 1, q[3] + m], `Multiply by ${m} each time.`); }
  for (let i = 0; i < per; i++) { const s = ri(1, 6), a = ri(2, 4), b = ri(5, 9); const q = [s]; for (let j = 1; j < 6; j++) q.push(q[j - 1] + (j % 2 ? a : b)); mcq(exam, section, 3, `What number comes next?  ${q.slice(0, 5).join(', ')}, ?`, q[5], [q[5] + 1, q[5] - 1, q[4] + a + b, q[4] + 2], `The step alternates +${a}, +${b}.`); }
  for (let i = 0; i < per; i++) { const s = ri(1, 5); const q = [0, 1, 2, 3, 4].map((j) => (j + s) ** 2); mcq(exam, section, 4, `What number comes next?  ${q.join(', ')}, ?`, (5 + s) ** 2, [(5 + s) ** 2 + 1, (5 + s) ** 2 - (5 + s), q[4] + 2 * (4 + s), q[4] * 2], 'Consecutive square numbers.'); }
  for (let i = 0; i < per; i++) { const a = ri(3, 8), b = ri(2, 5); const q = [a]; let d = b; for (let j = 1; j < 6; j++) { q.push(q[j - 1] + d); d += 2; } mcq(exam, section, 5, `What number comes next?  ${q.slice(0, 5).join(', ')}, ?`, q[5], [q[5] + 1, q[5] - 2, q[4] + d - 4, q[4] + d], 'The difference grows by 2 each step.'); }
}
/** CogAT number analogies  a : b :: c : ?   and number puzzles  a ? b = c */
/** distractors for "a : b :: c : ?" that no other simple rule (x -> m*x + n, x -> x*b/a, x -> x + (b-a)) would also give */
function analogyDistractors(a, b, c, corr, cands) {
  const alts = new Set([c + (b - a)]); for (const m of [2, 3]) alts.add(m * c + (b - m * a)); if (b % a === 0) alts.add((c * b) / a);
  alts.delete(corr);
  return [...cands, corr + 5, corr - 5, corr + 7, corr + 10, corr + 3, corr - 3, corr + 12].filter((v, i, arr) => v > 0 && v !== corr && !alts.has(v) && arr.indexOf(v) === i).slice(0, 3);
}
function cogatQuant(count) {
  for (let i = 0; i < count; i++) {
    const t = ri(0, 3), c = ri(3, 12);
    if (t === 0) { const a = ri(2, 9), k = ri(2, 5), a2 = a + 1 + (c % 3), c2 = c === a || c === a2 ? c + 13 : c; mcq('COGAT', 'quantitative', 2 + (i % 3), `Number analogy:  ${a} → ${a * k},   ${a2} → ${a2 * k},   ${c2} → ?`, c2 * k, analogyDistractors(a, a * k, c2, c2 * k, [c2 + k, c2 * k + k, c2 * k - 1, c2 + a * k]), `Each number is multiplied by ${k}: ${a}×${k} = ${a * k} and ${a2}×${k} = ${a2 * k}, so ${c2} × ${k} = ${c2 * k}.`); }
    else if (t === 1) { const a = ri(2, 15), k = ri(3, 12), a2 = a + 2 + (c % 4), c2 = c === a || c === a2 ? c + 17 : c; mcq('COGAT', 'quantitative', 1 + (i % 3), `Number analogy:  ${a} → ${a + k},   ${a2} → ${a2 + k},   ${c2} → ?`, c2 + k, analogyDistractors(a, a + k, c2, c2 + k, [c2 * k, c2 + k + 1, c2 + k - 2, c2 - k]), `Each number increases by ${k}: ${a} + ${k} = ${a + k} and ${a2} + ${k} = ${a2 + k}, so ${c2} + ${k} = ${c2 + k}.`); }
    else if (t === 2) { const a = ri(2, 9), b = ri(2, 9); mcq('COGAT', 'quantitative', 3 + (i % 3), `Number analogy:  ${a}, ${b} → ${a * b}  ::  ${c}, ${b + 1} → ?`, c * (b + 1), [c + b + 1, c * b, c * (b + 1) + c, c * (b + 1) - 1], 'Multiply the two numbers.'); }
    else {
      const ops = { '+': (x, y) => x + y, '−': (x, y) => x - y, '×': (x, y) => x * y, '÷': (x, y) => (y ? x / y : NaN) };
      const x = ri(4, 18), y = ri(2, 9), op = pick(['+', '−', '×']); const r = ops[op](x, y);
      const works = Object.keys(ops).filter((o) => ops[o](x, y) === r);
      if (works.length === 1) add('COGAT', 'quantitative', 2 + (i % 4), `Which sign makes the equation true?   ${x}  ?  ${y}  =  ${r}`, ['+', '−', '×', '÷'], ['+', '−', '×', '÷'].indexOf(op), `${x} ${op} ${y} = ${r}.`);
    }
  }
}
/** figure items (shapes): polygon-side sequences, rotations, dot counts, plus rotated "F" spatial items */
function figureSet(exam, section, count) {
  const q = (s) => 'svg:' + s;
  const PAL = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0a3161', '#b31942', '#14b8a6', '#d97706'];
  for (let i = 0; i < count; i++) {
    const t = i % 4;
    if (t === 0) { const col = pick(PAL), s0 = Math.min(ri(3, 6), 4), shown = [0, 1, 2].map((j) => poly(s0 + j, ri(0, 1) * 0, col)).concat(['<text x="30" y="42" font-size="36" text-anchor="middle">?</text>']), ans = s0 + 3; const opts = shuffle([ans, ans + 1, ans - 1, Math.max(3, s0)]).filter((v, k, a) => a.indexOf(v) === k); while (opts.length < 4) opts.push(ans + opts.length + 1); add(exam, section, 2, 'Which shape comes next in the pattern?', opts.map((o) => q(svg(poly(o, 0, col)))), opts.indexOf(ans), `Each shape gains one side.`, { image_svg: strip(shown) }); }
    else if (t === 1) { const col = pick(PAL), sides = pick([3, 4, 5]), step = pick([30, 45, 60, 90, 120]), st = pick([0, 15, 30, 45]), symm = 360 / sides; const shown = [0, 1, 2].map((j) => poly(sides, st + step * j, col)).concat(['<text x="30" y="42" font-size="36" text-anchor="middle">?</text>']); const ans = (st + step * 3) % 360, per = 360 / sides; const cand = [ans, ans + per / 2, ans + per / 3, ans + per * 0.8].map((v) => ((Math.round(v) % 360) + 360) % 360); const opts = shuffle(cand.filter((v, k, a) => a.indexOf(v) === k && (v % per) !== (cand[0] % per) || k === 0)); if (step % symm !== 0 && (2 * step) % symm !== 0 && opts.length === 4 && new Set(opts.map((v) => v % per)).size === 4) add(exam, section, 3, 'The shape keeps turning by the same amount. Which comes next?', opts.map((o) => q(svg(poly(sides, o, col)))), opts.indexOf(ans), `Turns ${step}° each step.`, { image_svg: strip(shown) }); }
    else if (t === 2) { const col = pick(PAL), k = Math.min(ri(1, 3), 2), dots = (c) => Array.from({ length: c }, (_, j) => `<circle cx="${12 + (j % 4) * 12}" cy="${14 + Math.floor(j / 4) * 14}" r="4.5" fill="${col}"/>`).join(''); const shown = [1, 2, 3].map((j) => dots(j * k)).concat(['<text x="30" y="42" font-size="36" text-anchor="middle">?</text>']); const ans = 4 * k, opts = shuffle([ans, ans + 1, ans - 1, ans + 2]); add(exam, section, 1, 'How many dots come next?', opts.map((o) => q(svg(dots(o)))), opts.indexOf(ans), `Dots increase by ${k}.`, { image_svg: strip(shown) }); }
    else { const base = svg(F('translate(30,30)'), 60, 60), angs = shuffle([0, 45, 90, 135, 180, 225, 270, 315]); if (angs[0] === 0) [angs[0], angs[1]] = [angs[1], angs[0]]; const items = shuffle([{ s: F(`translate(30,30) rotate(${angs[0]})`), ok: true }, { s: F(`translate(30,30) rotate(${angs[1]}) scale(-1,1)`) }, { s: F(`translate(30,30) rotate(${angs[2]}) scale(-1,1)`) }, { s: F(`translate(30,30) rotate(${angs[3]}) scale(-1,1)`) }]); add(exam, section, 2 + (i % 4), 'Which option shows the same shape turned (rotated) but NOT flipped?', items.map((x) => q(svg(x.s, 60, 60))), items.findIndex((x) => x.ok), 'A mirrored shape cannot be made by turning.', { image_svg: base }); }
  }
}
/** SAT Math (digital SAT domains: algebra, advanced math, problem-solving & data analysis, geometry & trigonometry) */
function satMath(count) {
  const kinds = ['lin', 'func', 'sys', 'pct', 'ratio', 'quad', 'exp', 'slope', 'mean', 'prob', 'circ', 'rate', 'ineq', 'abs', 'vol', 'trig', 'data', 'geo', 'age', 'inv'];
  for (let i = 0; i < count; i++) {
    const t = kinds[i % kinds.length]; let d = 2, st, cor, wr, ex, img;
    if (t === 'lin') { const x = ri(2, 15), a = ri(2, 9), b = ri(1, 20); st = `If ${a}x + ${b} = ${a * x + b}, what is the value of x?`; cor = x; wr = [x + 1, x - 1, x + a, a * x]; ex = `Subtract ${b}, divide by ${a}.`; d = 1; }
    else if (t === 'func') { const a = ri(2, 7), b = ri(1, 12), x = ri(2, 9); st = `The function f is defined by f(x) = ${a}x − ${b}. What is f(${x})?`; cor = a * x - b; wr = [a * x + b, a + x - b, a * (x - b), a * x]; ex = `${a}(${x}) − ${b}.`; d = 1; }
    else if (t === 'sys') { const x = ri(3, 12), y = ri(1, x - 1); st = `x + y = ${x + y} and x − y = ${x - y}. What is the value of x?`; cor = x; wr = [y, x + 1, x + y, x - 1]; ex = 'Add the two equations: 2x = ' + 2 * x + '.'; d = 2; }
    else if (t === 'pct') { const a = pick([40, 50, 60, 80, 120]), pc = pick([10, 20, 25, 30, 50]); const b = a + (a * pc) / 100; st = `A price increased from $${a} to $${b}. By what percent did the price increase?`; cor = `${pc}%`; wr = [`${pc + 5}%`, `${pc - 5}%`, `${Math.round((pc / (100 + pc)) * 100)}%`, `${pc * 2}%`]; ex = `(${b} − ${a}) ÷ ${a} = ${pc / 100}.`; d = 2; }
    else if (t === 'ratio') { const a = ri(2, 5), b0 = ri(2, 7), b = b0 === a ? b0 + 1 : b0, k = ri(3, 9); st = `A mixture contains red paint and blue paint in the ratio ${a} : ${b}. If it contains ${a * k} liters of red paint, how many liters of blue paint does it contain?`; cor = b * k; wr = [b * k + a, a * b, b + k, a * k + b]; ex = `${a * k}/${a} = ${k}; ${k} × ${b}.`; d = 2; }
    else if (t === 'quad') { const r1 = ri(1, 6), r2 = ri(r1 + 1, 9); st = `What are the solutions to x² − ${r1 + r2}x + ${r1 * r2} = 0?`; cor = `${r1} and ${r2}`; wr = [`${-r1} and ${-r2}`, `${r1} and ${-r2}`, `${r1 + 1} and ${r2 - 1}`, `${r1 * r2} and 1`]; ex = `(x − ${r1})(x − ${r2}) = 0.`; d = 3; }
    else if (t === 'exp') { const b = pick([2, 3, 5]), e = ri(2, 5); st = `If ${b}^x = ${b ** e}, what is the value of x?`; cor = e; wr = [e + 1, e - 1, b * e, b ** e / b]; ex = `${b}^${e} = ${b ** e}.`; d = 2; }
    else if (t === 'slope') { const m = ri(2, 6), x1 = ri(0, 4), y1 = ri(-3, 5), dx = ri(1, 4); st = `A line passes through the points (${x1}, ${y1}) and (${x1 + dx}, ${y1 + m * dx}). What is the slope of the line?`; cor = m; wr = [m + 1, 1 / m < 1 ? `1/${m}` : m + 2, -m, m * dx]; ex = `Rise over run = ${m * dx}/${dx}.`; d = 2; }
    else if (t === 'mean') { const arr = Array.from({ length: 5 }, () => ri(4, 30)); const sum = arr.reduce((a, b) => a + b, 0), m = Math.round(sum / 5); const fix = m * 5 - (sum - arr[4]); arr[4] = fix; if (fix < 1) continue; st = `The mean of the five numbers ${arr.join(', ')} is ${m}. (Assume the mean is exactly ${m}.) What is the sum of the five numbers?`; cor = m * 5; wr = [m * 5 + 5, m * 4, m + 5, m * 6]; ex = `Sum = mean × count = ${m} × 5.`; d = 2; }
    else if (t === 'prob') { const r = ri(2, 8), b = ri(2, 8), g = ri(2, 8), tot = r + b + g; const gcd = (x, y) => (y ? gcd(y, x % y) : x); const g1 = gcd(b, tot); st = `A bag contains ${r} red marbles, ${b} blue marbles, and ${g} green marbles. One marble is chosen at random. What is the probability that it is blue?`; cor = `${b / g1}/${tot / g1}`; wr = [`${r}/${tot}`, `${b}/${tot - b}`, `${g}/${tot}`, `${b}/${r + g + 1}`].filter((x) => x !== cor); ex = `${b} of ${tot} marbles are blue.`; d = 2; }
    else if (t === 'circ') { const h = ri(-5, 6), k = ri(-5, 6), r = ri(2, 9); st = `The equation of a circle in the xy-plane is (x ${h >= 0 ? '−' : '+'} ${Math.abs(h)})² + (y ${k >= 0 ? '−' : '+'} ${Math.abs(k)})² = ${r * r}. What is the radius of the circle?`; cor = r; wr = [r * r, r * 2, r + 1, Math.abs(h) + r]; ex = `r² = ${r * r}, so r = ${r}.`; d = 3; }
    else if (t === 'rate') { const base = ri(20, 60), per = ri(10, 35), hrs = ri(2, 6); st = `A technician charges a $${base} fee plus $${per} per hour. What is the total charge, in dollars, for a ${hrs}-hour job?`; cor = base + per * hrs; wr = [(base + per) * hrs, base * hrs + per, base + per + hrs, base + per * (hrs + 1)]; ex = `${base} + ${per} × ${hrs}.`; d = 1; }
    else if (t === 'ineq') { const a = ri(2, 6), b = ri(1, 9), c = ri(10, 40); const x = Math.floor((c + b) / a) + 1; st = `What is the least integer x that satisfies ${a}x − ${b} > ${c}?`; cor = x; wr = [x - 1, x + 1, Math.floor((c + b) / a), Math.ceil((c - b) / a)]; ex = `Add ${b} and divide by ${a}: x > ${((c + b) / a).toFixed(2).replace(/\.?0+$/, '')}, so the least integer is ${x}.`; d = 3; }
    else if (t === 'abs') { const c = ri(1, 9), k = ri(2, 12); st = `What is the sum of the solutions to |x − ${c}| = ${k}?`; cor = 2 * c; wr = [c, 2 * k, c + k, 0]; ex = `x = ${c + k} or x = ${c - k}; the sum is ${2 * c}.`; d = 3; }
    else if (t === 'vol') { const r = ri(2, 7), h = ri(3, 12); st = `A right circular cylinder has radius ${r} and height ${h}. What is its volume?`; cor = `${r * r * h}π`; wr = [`${2 * r * h}π`, `${r * h}π`, `${r * r * h * 2}π`, `${r * r + h}π`]; ex = `V = πr²h = π(${r})²(${h}).`; d = 3; }
    else if (t === 'trig') { const [a, b, c] = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]]); st = `In right triangle ABC, the right angle is at B, AB = ${a}, BC = ${b}, and AC = ${c}. What is sin A?`; cor = `${b}/${c}`; wr = [`${a}/${c}`, `${a}/${b}`, `${b}/${a}`, `${c}/${b}`]; ex = `sin A = opposite/hypotenuse = BC/AC.`; d = 4; }
    else if (t === 'data') { const kind = pick(['bar', 'line', 'pie', 'scatter', 'scatter2', 'gbar', 'hist', 'table']); const g = graphItem(kind); st = g.stem; cor = g.correct; wr = g.wrong; ex = g.expl; img = g.svg; d = 2; }
    else if (t === 'geo') { const kind = pick(['rect', 'tri', 'circle', 'angle', 'coord', 'grid', 'reflect']); const g = graphItem(kind); st = g.stem; cor = g.correct; wr = g.wrong; ex = g.expl; img = g.svg; d = 2; }
    else if (t === 'age') { const a = ri(4, 12), k = ri(2, 4), y = ri(2, 6); st = `Maya is ${k} times as old as her brother. In ${y} years, the sum of their ages will be ${a * (k + 1) + 2 * y}. How old is Maya now?`; cor = a * k; wr = [a, a * k + y, a * (k + 1), a * k - 1]; ex = `Let her brother be ${a}; Maya is ${k} × ${a}.`; d = 4; }
    else { const p0 = ri(1, 5) * 1000, rate = pick([2, 3, 4, 5]), yrs = ri(2, 4); st = `An account starts with $${p0} and earns simple interest of ${rate}% per year. How much interest, in dollars, is earned after ${yrs} years?`; cor = (p0 * rate * yrs) / 100; wr = [(p0 * rate) / 100, p0 + (p0 * rate * yrs) / 100, (p0 * rate * (yrs + 1)) / 100, p0 * rate * yrs]; ex = `I = P·r·t = ${p0} × ${rate / 100} × ${yrs}.`; d = 2; }
    if (cor === undefined || !wr) continue;
    mcq('SAT', 'math', Math.min(5, d + (i % 2)), st, cor, wr, ex, img ? { image_svg: img } : undefined);
  }
}

/** SAT Reading & Writing "data" questions: a chart plus a sentence to complete accurately from the chart */
function satRwChart(count) {
  for (let i = 0; i < count; i++) {
    const t = i % 3, d = 2 + (i % 3);
    if (t < 2) {
      const topic = pick([['favorite after-school activity', ['Soccer', 'Chess', 'Art', 'Music', 'Drama'], 'students'], ['preferred way to read', ['Print', 'E-book', 'Audio', 'Comic', 'Online'], 'readers'], ['school lunch choice', ['Pizza', 'Salad', 'Pasta', 'Soup', 'Tacos'], 'students']]);
      let vals; do vals = topic[1].map(() => 5 * ri(2, 9)); while (!uniq(vals));
      const order = vals.map((v, k) => k).sort((a, b) => vals[b] - vals[a]), top = order[0], second = order[1], low = order[4];
      const svg = barChart({ title: `Survey: ${topic[0]}`, labels: topic[1], values: vals, yMax: 50, yStep: 10, showValues: true });
      const most = t === 0;
      const key = most ? top : low;
      const phr = (k, v) => `${topic[1][k]} was chosen ${most ? 'most often' : 'least often'}, by ${v} ${topic[2]}.`;
      add('SAT', 'rw', d, 'Which choice most effectively uses data from the graph to complete the statement?', [phr(key, vals[key]), phr(most ? second : order[3], vals[key]), phr(key, vals[most ? second : order[3]]), phr(most ? low : top, vals[most ? low : top])].filter((v, k, a) => a.indexOf(v) === k), 0, `The graph shows ${topic[1][key]} = ${vals[key]}.`, { passage: `A student is writing about a survey of students' ${topic[0]}. She wants to complete the following sentence accurately using the graph: "In the survey, ______"`, image_svg: svg });
      const q = Q[Q.length - 1]; if (q && q.choices.length === 4) { const sh = shuffle([0, 1, 2, 3]); q.choices = sh.map((k) => q.choices[k]); q.answer = sh.indexOf(0); }
    } else {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']; let vals = [ri(1, 4) * 5]; for (let k = 1; k < 6; k++) vals.push(vals[k - 1] + 5 * ri(1, 2)); if (vals[5] > 40) { vals = vals.map((v, k) => 5 + k * 5); }
      const svg = lineChart({ title: 'Monthly visitors (hundreds)', labels: months, values: vals, yMax: 40, yStep: 5, showValues: true });
      const a = `Visitors rose every month, from ${vals[0]} hundred in January to ${vals[5]} hundred in June.`;
      const ch = [a, `Visitors fell every month, from ${vals[0]} hundred in January to ${vals[5]} hundred in June.`, `Visitors rose every month, from ${vals[5]} hundred in January to ${vals[0]} hundred in June.`, `Visitors stayed about the same, near ${vals[0]} hundred, throughout the period.`];
      const sh = shuffle([0, 1, 2, 3]);
      add('SAT', 'rw', d, 'Which choice most accurately describes data from the graph?', sh.map((k) => ch[k]), sh.indexOf(0), 'The line rises each month.', { passage: 'A park manager is summarizing visitor numbers for the first half of the year using the graph.', image_svg: svg });
    }
  }
}
/** Schedules / price tables as images for reading-comprehension sections */
function tableReading(exam, section, count) {
  for (let i = 0; i < count; i++) {
    const rows = [], base = ri(7, 10);
    for (let k = 0; k < 3; k++) { const dep = base * 60 + ri(0, 5) * 10 + k * 40, dur = ri(2, 9) * 5 + 10; rows.push({ name: `Bus ${['A', 'B', 'C'][k]}`, dep, arr: dep + dur, dur }); }
    if (!uniq(rows.map((r) => r.dur))) continue;
    const f = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`, short = rows.reduce((a, b) => (b.dur < a.dur ? b : a));
    const svg = tableSvg({ title: 'School trip bus schedule (morning)', headers: ['Bus', 'Leaves', 'Arrives'], rows: rows.map((r) => [r.name, f(r.dep), f(r.arr)]) });
    mcq(exam, section, 2 + (i % 3), 'Which bus takes the least time to reach the museum?', short.name, rows.filter((r) => r !== short).map((r) => r.name).concat(['They all take the same time']), `${short.name} takes ${short.dur} minutes, the shortest trip.`, { image_svg: svg });
  }
}


/** More SAT Math templates (added last so earlier generated items keep their ids) */
function satMath2(count) {
  const kinds = ['tickets', 'median', 'growth', 'vertex', 'similar', 'model', 'pctof', 'units', 'budget', 'spinner', 'scale', 'comp'];
  const gcd = (x, y) => (y ? gcd(y, x % y) : x);
  for (let i = 0; i < count; i++) {
    const t = kinds[i % kinds.length]; let st, cor, wr, ex, d = 2;
    if (t === 'tickets') { const x = ri(5, 25), y = ri(4, 22), a = ri(9, 15), b = ri(4, a - 2); st = `A theater sold adult tickets for $${a} each and child tickets for $${b} each. In all, ${x + y} tickets were sold for $${a * x + b * y}. How many adult tickets were sold?`; cor = x; wr = [y, x + 1, x - 1, x + y]; ex = `Let x be the adult tickets: x + y = ${x + y} and ${a}x + ${b}y = ${a * x + b * y}. Solving gives x = ${x}.`; d = 3; }
    else if (t === 'median') { const base = ri(3, 9), arr = shuffle(Array.from({ length: 7 }, (_, k) => base + k * 2 + ri(0, 1))); const sorted = [...arr].sort((m, n) => m - n); st = `What is the median of the data set ${arr.join(', ')}?`; cor = sorted[3]; wr = [sorted[2], sorted[4], Math.round(arr.reduce((m, n) => m + n, 0) / 7) + 1, sorted[1]]; ex = `Order the values: ${sorted.join(', ')}. The middle (4th) value is ${sorted[3]}.`; d = 2; }
    else if (t === 'growth') { const p0 = pick([20, 50, 100, 200]), every = pick([2, 3, 4]), n = ri(2, 4); st = `A colony starts with ${p0} bacteria and doubles every ${every} hours. How many bacteria are there after ${every * n} hours?`; cor = p0 * 2 ** n; wr = [p0 * 2 * n, p0 + 2 * n, p0 * 2 ** (n + 1), p0 * n * n]; ex = `${n} doublings: ${p0} × 2^${n}.`; d = 3; }
    else if (t === 'vertex') { const h = ri(-4, 5), k = ri(1, 12); st = `The function f(x) = −(x ${h >= 0 ? '−' : '+'} ${Math.abs(h)})² + ${k} is graphed in the xy-plane. What is the maximum value of f?`; cor = k; wr = [h === 0 ? k + 2 : h, k + Math.abs(h), -k, k * k]; ex = `The squared term is never positive, so the maximum value is the constant ${k}.`; d = 4; }
    else if (t === 'similar') { const ab = ri(2, 6), r = pick([2, 3]), bc = ri(3, 9); st = `Triangle ABC is similar to triangle DEF, with AB = ${ab}, DE = ${ab * r}, and BC = ${bc}. What is the length of EF?`; cor = bc * r; wr = [bc + (ab * r - ab), bc * r + ab, bc + r, ab * r]; ex = `The scale factor is DE/AB = ${r}, so EF = ${bc} × ${r}.`; d = 3; }
    else if (t === 'model') { const m = ri(5, 25), b = ri(20, 80), ctx = pick([['cost, in dollars, of renting a bike for x hours', 'the cost for each additional hour', 'the fixed fee charged regardless of hours', 'the total cost for one hour', 'the number of hours rented'], ['height, in centimeters, of a plant x weeks after planting', "the plant's growth in height each week", "the plant's height when it was planted", "the plant's height after one week", 'the number of weeks since planting']]); st = `The equation y = ${m}x + ${b} models the ${ctx[0]}. What does the number ${m} represent in this context?`; cor = ctx[1]; wr = [ctx[2], ctx[3], ctx[4]]; ex = 'In y = mx + b, m is the rate of change of y for each 1-unit increase in x.'; d = 3; }
    else if (t === 'pctof') { const w = pick([20, 25, 40, 50, 60, 75]), pc = pick([10, 20, 25, 30, 40]), whole = w * 10, part = (whole * pc) / 100; st = `${pc}% of a number is ${part}. What is the number?`; cor = whole; wr = [part * 2, whole + pc, (whole * (100 - pc)) / 100, whole / 10]; ex = `${part} ÷ ${pc / 100} = ${whole}.`; d = 2; }
    else if (t === 'units') { const v = 3 * ri(12, 30), mins = pick([20, 40]); st = `A train travels at a constant speed of ${v} kilometers per hour. How many kilometers does it travel in ${mins} minutes?`; cor = (v * mins) / 60; wr = [v * mins, Math.round(v / mins), (v * mins) / 100, v / 2]; ex = `${mins} minutes = ${mins}/60 hour, so the distance is ${v} × ${mins}/60 = ${(v * mins) / 60}.`; d = 2; }
    else if (t === 'budget') { const money = ri(40, 120), each = ri(3, 9), fee = ri(4, 15), n = Math.floor((money - fee) / each); st = `Dana has $${money}. She pays a $${fee} entry fee and then buys snacks that cost $${each} each. What is the greatest number of snacks she can buy?`; cor = n; wr = [n + 1, n - 1, Math.floor(money / each), n + 2]; ex = `${each}n + ${fee} ≤ ${money}, so n ≤ ${((money - fee) / each).toFixed(2)}; the greatest whole number is ${n}.`; d = 3; }
    else if (t === 'spinner') { const tot = pick([8, 10, 12]), red = ri(2, tot - 3), g = gcd(tot - red, tot), gr = gcd(red, tot); st = `A spinner has ${tot} equal sections, ${red} of which are red. What is the probability that a spin does NOT land on red?`; cor = `${(tot - red) / g}/${tot / g}`; wr = [`${red / gr}/${tot / gr}`, `${tot - red}/${red}`, `${tot - red + 1}/${tot}`, `${red}/${tot - red}`]; ex = `${tot - red} of the ${tot} sections are not red.`; d = 2; }
    else if (t === 'scale') { const sc = pick([5, 10, 25, 50]), cm = ri(3, 12) + pick([0, 0.5]); st = `On a map, 1 centimeter represents ${sc} kilometers. Two towns are ${cm} centimeters apart on the map. What is the actual distance, in kilometers, between the towns?`; cor = cm * sc; wr = [cm + sc, Math.round((cm / sc) * 100) / 100, sc * 2, cm * sc + sc]; ex = `${cm} × ${sc} = ${cm * sc}.`; d = 1; }
    else { const w = ri(6, 14), h = ri(5, 10), cw = ri(2, w - 3), ch = ri(2, h - 3); st = `A rectangular poster is ${w} inches wide and ${h} inches tall. A rectangular ${cw}-inch by ${ch}-inch photo is placed on it. What is the area, in square inches, of the part of the poster NOT covered by the photo?`; cor = w * h - cw * ch; wr = [w * h, cw * ch, w * h + cw * ch, (w - cw) * (h - ch)]; ex = `${w} × ${h} − ${cw} × ${ch} = ${w * h - cw * ch}.`; d = 2; }
    mcq('SAT', 'math', d, st, cor, wr, ex);
  }
}

const LEGACY_BANKS = new Set(['cat4-scat-verbal.json', 'isee-verbal-reading.json', 'map-early.json', 'map-upper.json', 'map-verbal.json', 'sat-rw.json', 'ssat-verbal-2.json', 'ssat-verbal-reading.json', 'toefl-primary.json', 'toeflj-listening-lfm.json', 'toeflj-reading-cogat-verbal.json', 'wida-listening-reading.json']);
function localShuffle(arr, h) { let st = parseInt(h.slice(0, 8), 16) || 1; const r = () => ((st = (st * 1664525 + 1013904223) % 4294967296) / 4294967296); const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** Merge the hand-written banks that were authored by writers in scripts/bank/*.json */
function mergeBanks() {
  const dir = new URL('./bank/', import.meta.url);
  let listed = []; try { listed = JSON.parse(readFileSync(new URL('_pending.json', dir), 'utf8')); } catch {}
  const pending = new Set([...listed, ...(process.env.BANK_PENDING || '').split(',').filter(Boolean)]); // banks still awaiting blind verification (scripts/bank/_pending.json)
  let files = []; try { files = readdirSync(dir).filter((f) => f.endsWith('.json') && !f.endsWith('.drop.json') && !f.startsWith('_') && !pending.has(f)).sort(); } catch {}
  let total = 0, shortSat = 0;
  for (const f of files) {
    let drop = new Set(); try { drop = new Set(JSON.parse(readFileSync(new URL(f.replace(/\.json$/, '.drop.json'), dir), 'utf8'))); } catch {} // items a blind verifier found wrong/ambiguous
    JSON.parse(readFileSync(new URL(f, dir), 'utf8')).forEach((it, i) => { if (drop.has(i)) return;
    if (it.kind === 'text' || it.kind === 'num') { // writing prompts (teacher-graded) and short numeric answers
      const id = `seed-${it.exam_type.toLowerCase()}-${it.section}-${hash([it.exam_type, it.section, it.kind, it.stem, it.passage || '', (it.choices || []).join('|')].join('\u0001'))}`;
      if (!seen.has(id)) { seen.add(id); Q.push({ id, exam_type: it.exam_type, section: it.section, kind: it.kind, difficulty: it.difficulty, stem: it.stem, ...(it.passage ? { passage: it.passage } : {}), ...(it.image_svg ? { image_svg: it.image_svg } : {}), choices: it.kind === 'num' ? it.choices.map(String) : null, answer: null, explanation: it.explanation || null }); total++; }
      return;
    }
    // Writers tended to place the key in a rotating A-B-C-D pattern: shuffle choices (deterministically) unless an option refers to another option.
    let ch = it.choices.map(String), ans = it.answer;
    if (!ch.some((c) => /\b(all|none|both|neither|either)\b.*\b(above|these)\b|\b(A|B|C|D)\b\s*(and|&|or)\s*\b(A|B|C|D)\b|^(A|B|C|D)\)?$/i.test(c))) {
      // Banks added after the generated items were reviewed shuffle with their own per-item RNG, so they do not shift the
      // shared random stream (which would re-roll every generated question that comes after this point).
      const idx = LEGACY_BANKS.has(f) ? shuffle([0, 1, 2, 3]) : localShuffle([0, 1, 2, 3], hash(it.stem + '|' + (it.passage || '').slice(0, 200)));
      ch = idx.map((k) => ch[k]); ans = idx.indexOf(it.answer);
    }
    // Digital SAT: every R&W question has a 25–150-word text. Older one-sentence items are retired (after the shuffle, so the random stream is unchanged).
    if (it.exam_type === 'SAT' && it.section === 'rw' && (String(it.passage || '').match(/[A-Za-z0-9'’-]+/g) || []).length < 25) { shortSat++; return; }
    add(it.exam_type, it.section, it.difficulty, it.stem, ch, ans, it.explanation, { ...(it.passage ? { passage: it.passage } : {}), ...(it.image_svg ? { image_svg: it.image_svg } : {}), _src: 'bank', ...(LEGACY_BANKS.has(f) ? {} : { _sameStemOk: true }) }); total++;
    });
  }
  console.log('merged', total, 'hand-written items from', files.length, 'files; retired', shortSat, 'SAT R&W items with passages under 25 words');
}

// ---- volume boosts for existing exams ----
addWordMath('MAP', 'math', 20, 2); addGraph('MAP', 'math', GKINDS, 20, 2, 5);
seriesItems('CAT4', 'quantitative', 3); figureSet('CAT4', 'nonverbal', 24); figureSet('CAT4', 'spatial', 12);
addQC('SCAT', 'quantitative', 24, 4);
addWordMath('SSAT', 'quantitative', 12, 2); addGraph('SSAT', 'quantitative', GKINDS, 12, 2, 5);
addQC('ISEE', 'quantitative', 12, 4); addWordMath('ISEE', 'math', 14, 2); addGraph('ISEE', 'math', GKINDS, 14, 2, 5);
// ---- new exams ----
seriesItems('COGAT', 'quantitative', 5); cogatQuant(30); figureSet('COGAT', 'nonverbal', 48);
satMath(140); satRwChart(36);
addGraph('CAT4', 'quantitative', ['hist', 'pict', 'venn', 'clock', 'fraction', 'gbar'], 14, 2, 4); addGraph('COGAT', 'quantitative', ['pict', 'venn', 'fraction', 'hist', 'clock'], 10, 2, 4);
addGraph('WIDA', 'reading', ['bar', 'pie', 'table', 'pict', 'clock'], 8, 1, 3); addGraph('TOEFLJ', 'reading', ['table', 'bar', 'pict', 'line'], 8, 2, 4); tableReading('TOEFLJ', 'reading', 8);
mergeBanks();
satMath2(72);

/** Harder figure items for upper levels: two rules at once (sides + colour), and growing steps of dots. */
function figureHard(exam, section, count) {
  const q = (x) => 'svg:' + x, PAL2 = [['#0a3161', '#b31942'], ['#4f46e5', '#f59e0b'], ['#059669', '#ef4444'], ['#0ea5e9', '#8b5cf6']];
  for (let i = 0; i < count; i++) {
    if (i % 2 === 0) { // sides +1 each step AND colours alternate
      const [c1, c2] = pick(PAL2), s0 = ri(3, 4), col = (j) => (j % 2 ? c2 : c1);
      const shown = [0, 1, 2].map((j) => poly(s0 + j, 0, col(j))).concat(['<text x="30" y="42" font-size="36" text-anchor="middle">?</text>']);
      const ans = { n: s0 + 3, c: col(3) }, cands = shuffle([ans, { n: s0 + 3, c: col(2) }, { n: s0 + 2, c: col(3) }, { n: s0 + 4, c: col(3) }]);
      add(exam, section, 4 + (i % 4 === 0 ? 1 : 0), 'Two things change in this pattern. Which shape comes next?', cands.map((o) => q(svg(poly(o.n, 0, o.c)))), cands.indexOf(ans), `Each shape gains one side and the colour alternates, so the next has ${ans.n} sides in the colour of the first shape.`, { image_svg: strip(shown) });
    } else { // dots grow by 1, 2, 3, ... (triangular numbers)
      const col = pick(['#ef4444', '#0a3161', '#059669']), st = ri(1, 2), seq = [st, st + 1, st + 3], ans = st + 6;
      const dots = (c) => Array.from({ length: c }, (_, j) => `<circle cx="${10 + (j % 5) * 10}" cy="${12 + Math.floor(j / 5) * 11}" r="3.8" fill="${col}"/>`).join('');
      const shown = seq.map(dots).concat(['<text x="30" y="42" font-size="36" text-anchor="middle">?</text>']);
      const opts = shuffle([ans, ans - 1, ans + 1, st + 5 === ans - 1 ? ans + 2 : st + 5]);
      add(exam, section, 4, 'The number of dots grows by a changing amount. How many dots come next?', opts.map((o) => q(svg(dots(o)))), opts.indexOf(ans), `The increases are +1, +2, so the next increase is +3: ${seq[2]} + 3 = ${ans}.`, { image_svg: strip(shown) });
    }
  }
}
figureHard('CAT4', 'nonverbal', 16); figureHard('COGAT', 'nonverbal', 14);
addQC('ISEE', 'quantitative', 20, 3); addQC('SCAT', 'quantitative', 16, 3);

/* =====================================================================
   Missing real-test item types: figure matrices, figure classification, paper folding (CAT4/CogAT),
   number analogies (CAT4), SAT student-produced responses (grid-ins).  Appended last: earlier ids are unchanged.
   ===================================================================== */
function shapeSvg({ sides = 3, fill = true, size = 1, rot = 0, count = 1, color = '#0a3161' }) {
  const r = 17 * size, pos = count === 1 ? [[30, 30]] : count === 2 ? [[19, 30], [41, 30]] : [[19, 20], [41, 20], [30, 42]];
  const rr = count === 1 ? r : r * 0.62;
  return svg(pos.map(([cx, cy]) => {
    const pts = Array.from({ length: sides }, (_, i) => { const a = ((rot + (360 / sides) * i - 90) * Math.PI) / 180; return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`; }).join(' ');
    return `<polygon points="${pts}" fill="${fill ? color : '#fff'}" stroke="${color}" stroke-width="2.4"/>`;
  }).join(''));
}
const cell = (inner, x, y) => `<g transform="translate(${x},${y})"><rect width="60" height="60" fill="#fff" stroke="#9ca3af"/>${inner.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`;
/** 2x2 figure matrix: A -> A' (one change), B -> ? (same change). */
function figureMatrix(exam, section, count) {
  const RULES = ['fill', 'size', 'rotate', 'count'];
  for (let i = 0; i < count; i++) {
    const rule = RULES[i % 4], color = pick(['#0a3161', '#b31942', '#059669', '#7c3aed']);
    const A = { sides: pick([3, 5]), fill: true, size: 1, rot: 0, count: 1, color }, B = { ...A, sides: A.sides === 3 ? 5 : 3, color: pick(['#0a3161', '#b31942', '#059669', '#7c3aed'].filter((c) => c !== color)) };
    const t = (s) => (rule === 'fill' ? { ...s, fill: !s.fill } : rule === 'size' ? { ...s, size: 0.55 } : rule === 'rotate' ? { ...s, rot: 180 } : { ...s, count: 2 });
    const wrongs = RULES.filter((x) => x !== rule).map((x) => (x === 'fill' ? { ...B, fill: !B.fill } : x === 'size' ? { ...B, size: 0.55 } : x === 'rotate' ? { ...B, rot: 180 } : { ...B, count: 2 }));
    const grid = svg(cell(shapeSvg(A), 0, 0) + cell(shapeSvg(t(A)), 64, 0) + cell(shapeSvg(B), 0, 64) + `<g transform="translate(64,64)"><rect width="60" height="60" fill="#fff" stroke="#9ca3af"/><text x="30" y="42" font-size="34" text-anchor="middle">?</text></g>`, 128, 128);
    const opts = shuffle([{ s: t(B), ok: true }, ...shuffle(wrongs).slice(0, 2).map((s) => ({ s })), { s: B }]);
    const why = { fill: 'the shading is reversed', size: 'the shape becomes smaller', rotate: 'the shape turns upside down', count: 'the shape is doubled' }[rule];
    add(exam, section, 3 + (i % 3 === 0 ? 1 : 0), 'The top row shows a change. Apply the same change to the bottom row. Which picture goes in the empty box?', opts.map((o) => 'svg:' + shapeSvg(o.s)), opts.findIndex((o) => o.ok), `In the top row ${why}, so the bottom shape changes the same way.`, { image_svg: grid });
  }
}
/** Three shapes share a property (number of sides); pick the one that belongs. */
function figureClassify(exam, section, count) {
  for (let i = 0; i < count; i++) {
    const sides = pick([3, 4, 5, 6]), others = shuffle([3, 4, 5, 6].filter((x) => x !== sides));
    const look = () => ({ fill: rnd() < 0.5, size: pick([0.7, 0.85, 1]), rot: pick([0, 15, 30, 45]), color: pick(['#0a3161', '#b31942', '#059669', '#7c3aed']) });
    const shown = [0, 1, 2].map(() => shapeSvg({ sides, ...look() }));
    const strip3 = svg(shown.map((s3, k) => `<g transform="translate(${k * 64},0)">${s3.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`).join(''), 192, 60);
    const opts = shuffle([{ s: { sides, ...look() }, ok: true }, ...others.map((o) => ({ s: { sides: o, ...look() } }))]);
    add(exam, section, 2 + (i % 3), 'The three figures are alike in some way. Which option belongs with them?', opts.map((o) => 'svg:' + shapeSvg(o.s)), opts.findIndex((o) => o.ok), `All three figures have ${sides} sides (colour, size and turn do not matter); only one option also has ${sides} sides.`, { image_svg: strip3 });
  }
}
/** Paper folding: fold a square once, punch one hole, unfold. */
function paperFold(exam, section, count) {
  const sq = (holes, extra = '') => svg(`<rect x="6" y="6" width="48" height="48" fill="#fff" stroke="#111" stroke-width="2"/>${extra}${holes.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#111"/>`).join('')}`);
  for (let i = 0; i < count; i++) {
    const vertical = i % 2 === 0; // vertical fold line: right half folded over the left half
    const a = vertical ? [pick([12, 16, 20]), pick([14, 24, 34, 44])] : [pick([14, 24, 34, 44]), pick([12, 16, 20])];
    const mirror = vertical ? [60 - a[0], a[1]] : [a[0], 60 - a[1]], wrongMirror = vertical ? [a[0], 60 - a[1]] : [60 - a[0], a[1]];
    const foldLine = vertical ? '<line x1="30" y1="6" x2="30" y2="54" stroke="#6b7280" stroke-dasharray="4 3"/>' : '<line x1="6" y1="30" x2="54" y2="30" stroke="#6b7280" stroke-dasharray="4 3"/>';
    const folded = vertical ? `<rect x="6" y="6" width="24" height="48" fill="#e5e7eb" stroke="#111" stroke-width="2"/><circle cx="${a[0]}" cy="${a[1]}" r="4" fill="#111"/>` : `<rect x="6" y="6" width="48" height="24" fill="#e5e7eb" stroke="#111" stroke-width="2"/><circle cx="${a[0]}" cy="${a[1]}" r="4" fill="#111"/>`;
    const steps = svg(`<g>${sq([], foldLine).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g><text x="72" y="36" font-size="18" text-anchor="middle">→</text><g transform="translate(84,0)">${svg(folded).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`, 150, 60);
    const opts = shuffle([{ h: [a, mirror], ok: true }, { h: [a] }, { h: [a, wrongMirror] }, { h: [mirror, [60 - a[0], 60 - a[1]]] }].filter((o, k, arr) => arr.findIndex((p) => JSON.stringify(p.h.slice().sort()) === JSON.stringify(o.h.slice().sort())) === k));
    if (opts.length < 4) continue;
    add(exam, section, 3 + (i % 3 === 2 ? 1 : 0), `A square sheet is folded along the dashed line (the ${vertical ? 'right half onto the left' : 'bottom half onto the top'}), and one hole is punched through both layers. What does the sheet look like when it is unfolded?`, opts.map((o) => 'svg:' + sq(o.h)), opts.findIndex((o) => o.ok), `The hole goes through both layers, so after unfolding there are two holes, mirror images across the ${vertical ? 'vertical' : 'horizontal'} fold line.`, { image_svg: steps });
  }
}
/** Number analogies with two worked examples (CAT4 quantitative). */
function numberAnalogies(exam, section, count) {
  for (let i = 0; i < count; i++) {
    const mul = i % 2 === 0, a = ri(2, 9), k = mul ? ri(2, 5) : ri(3, 12), a2 = a + 1 + (i % 3), c = a2 + 2 + (i % 4);
    const f = (x) => (mul ? x * k : x + k);
    mcq(exam, section, mul ? 3 : 2, `Number analogy:  ${a} → ${f(a)},   ${a2} → ${f(a2)},   ${c} → ?`, f(c), analogyDistractors(a, f(a), c, f(c), mul ? [c + k, f(c) + k, f(c) - 1] : [c * k, f(c) + 1, f(c) - 2]),
      mul ? `Each number is multiplied by ${k}: ${c} × ${k} = ${f(c)}.` : `Each number increases by ${k}: ${c} + ${k} = ${f(c)}.`);
  }
}
/** SAT student-produced responses: no choices; any equivalent number (fraction or decimal) is accepted. */
function satGridIn(count) {
  const T = ['lin', 'func', 'pct', 'mean', 'area', 'sys', 'frac', 'rate'];
  for (let i = 0; i < count; i++) {
    const t = T[i % T.length]; let st, ans, ex, d = 2;
    if (t === 'lin') { const x = ri(2, 20), a = ri(2, 9), b = ri(1, 30); st = `If ${a}x − ${b} = ${a * x - b}, what is the value of x?`; ans = x; ex = `Add ${b} to both sides and divide by ${a}.`; }
    else if (t === 'func') { const a = ri(2, 6), b = ri(1, 9), c = ri(1, 5), x = ri(2, 6); st = `The function g is defined by g(x) = ${a}x² − ${b === 1 ? '' : b}x + ${c}. What is the value of g(${x})?`; ans = a * x * x - b * x + c; ex = `${a}(${x})² − ${b}(${x}) + ${c} = ${ans}.`; d = 3; }
    else if (t === 'pct') { const base = pick([80, 120, 150, 240, 320]), p = pick([15, 35, 45, 65, 85]); st = `What is ${p}% of ${base}?`; ans = (base * p) / 100; ex = `${p}/100 × ${base} = ${ans}.`; }
    else if (t === 'mean') { const xs = Array.from({ length: 4 }, () => ri(10, 40)), m = ri(20, 30), x5 = 5 * m - xs.reduce((s2, v) => s2 + v, 0); if (x5 <= 0) continue; st = `The mean of five numbers is ${m}. Four of the numbers are ${xs.join(', ')}. What is the fifth number?`; ans = x5; ex = `The total is 5 × ${m} = ${5 * m}; subtract the four known numbers.`; d = 3; }
    else if (t === 'area') { const b = ri(4, 16), hh = 2 * ri(2, 9); st = `A triangle has a base of ${b} centimeters and a height of ${hh} centimeters. What is its area, in square centimeters?`; ans = (b * hh) / 2; ex = `Area = ½ × ${b} × ${hh}.`; }
    else if (t === 'sys') { const x = ri(1, 9), y = ri(1, 9); st = `If 2x + y = ${2 * x + y} and x − y = ${x - y}, what is the value of y?`; ans = y; ex = `Adding the equations gives 3x = ${3 * x}, so x = ${x} and y = ${y}.`; d = 3; }
    else if (t === 'frac') { const n = ri(1, 6), dd = ri(n + 1, 9), gcd = (u, v) => (v ? gcd(v, u % v) : u), g2 = gcd(n, dd); st = `A recipe uses ${n} cup${n > 1 ? 's' : ''} of oats for every ${dd} cups of flour. How many cups of oats are used for each cup of flour? (Answer as a fraction or decimal.)`; ans = `${n / g2}/${dd / g2}`; ex = `${n} ÷ ${dd} = ${n / g2}/${dd / g2}${dd / g2 <= 10 && Number.isInteger((n / dd) * 1000) ? ` = ${n / dd}` : ''}.`; d = 3; }
    else { const r = ri(40, 75), tt = pick([1.5, 2.5, 3]); st = `A cyclist rides at a constant ${r} kilometers per hour for ${tt} hours. How many kilometers does she ride?`; ans = r * tt; ex = `${r} × ${tt} = ${r * tt}.`; }
    const key = `grid|${st}`; if (seen.has(key)) continue; seen.add(key);
    Q.push({ id: `seed-sat-math-g${hash(st)}`, exam_type: 'SAT', section: 'math', kind: 'num', difficulty: d + (i % 3 === 2 ? 1 : 0), stem: st + '  (Enter your answer.)', choices: [String(ans)], answer: null, explanation: ex });
  }
}
figureMatrix('CAT4', 'nonverbal', 16); figureMatrix('COGAT', 'nonverbal', 16);
figureClassify('CAT4', 'nonverbal', 10); figureClassify('COGAT', 'nonverbal', 10);
paperFold('CAT4', 'spatial', 16); paperFold('COGAT', 'nonverbal', 10);
numberAnalogies('CAT4', 'quantitative', 14);
satGridIn(48);

/* ---------- SAT / PSAT math with figures: graphs of functions, systems, scatterplots, tables, circles, trigonometry ---------- */
function satFigures(count) {
  const kinds = ['slope', 'intercept', 'system', 'vertex', 'roots', 'expo', 'scatter', 'table', 'sector', 'trig', 'histo', 'shift'];
  const frac = (n, d) => { const g = (a, b) => (b ? g(b, a % b) : a); const k = g(Math.abs(n), Math.abs(d)) || 1; const s = n * d < 0 ? '−' : ''; n = Math.abs(n) / k; d = Math.abs(d) / k; return d === 1 ? `${s}${n}` : `${s}${n}/${d}`; };
  const sg = (v) => (v < 0 ? `− ${-v}` : `+ ${v}`);
  let retries = 0;
  for (let i = 0; i < count; i++) {
    const t = kinds[i % kinds.length]; let st, cor, wr, ex, d, svg;
    if (t === 'slope') { // line through two lattice points
      let x1, y1, x2, y2; do { x1 = ri(-5, 0); y1 = ri(-4, 4); x2 = ri(1, 5); y2 = ri(-5, 5); } while (y2 === y1);
      svg = fnGraph({ fns: [{ f: (x) => y1 + ((y2 - y1) / (x2 - x1)) * (x - x1) }], pts: [{ x: x1, y: y1, label: `(${x1}, ${y1})` }, { x: x2, y: y2, label: `(${x2}, ${y2})` }] });
      st = 'The graph of a line in the xy-plane is shown. What is the slope of the line?'; cor = frac(y2 - y1, x2 - x1);
      wr = [frac(x2 - x1, y2 - y1), frac(-(y2 - y1), x2 - x1), frac(y2 - y1 + (y2 > y1 ? 1 : -1), x2 - x1), `${y2 - y1}`];
      ex = `Slope = (${y2} − ${y1 < 0 ? `(${y1})` : y1}) / (${x2} − ${x1 < 0 ? `(${x1})` : x1}) = ${cor}.`; d = 1 + (Math.abs(x2 - x1) > 1 && (y2 - y1) % (x2 - x1) !== 0 ? 1 : 0);
    } else if (t === 'intercept') { // pick equation of the graphed line
      const m = pick([-3, -2, -1, 1, 2, 3, 0.5, -0.5]), b = ri(-4, 4);
      svg = fnGraph({ fns: [{ f: (x) => m * x + b }], pts: [{ x: 0, y: b }] });
      const ms = m === 1 ? '' : m === -1 ? '−' : m === 0.5 ? '(1/2)' : m === -0.5 ? '−(1/2)' : `${m}`.replace('-', '−');
      const eq = (mm, bb) => `y = ${mm}x ${bb === 0 ? '' : sg(bb)}`.trim();
      st = 'Which equation defines the line shown in the xy-plane?'; cor = eq(ms, b);
      wr = [eq(ms, b === 0 ? 2 : -b), eq(ms.startsWith('−') ? ms.slice(1) : '−' + ms, b), eq(m === 0.5 || m === -0.5 ? (m > 0 ? '2' : '−2') : `(1/${Math.abs(m)})`.replace('(1/1)', '2'), b), eq(ms, b + (b >= 0 ? 2 : -2))];
      ex = `The line crosses the y-axis at (0, ${b}), and rises ${m} unit(s) for each unit to the right, so the slope is ${m} and the equation is ${cor}.`; d = 2;
    } else if (t === 'system') { // two lines intersecting at a lattice point
      const x0 = ri(-3, 3), y0 = ri(-3, 3); let m1 = pick([1, 2, -1, 3]), m2 = pick([-2, -1, 0.5, -3]); if (m1 === m2) m2 = -m1 - 1;
      svg = fnGraph({ fns: [{ f: (x) => y0 + m1 * (x - x0), label: 'ℓ', lx: x0 + (m1 > 0 ? 2 : -2) }, { f: (x) => y0 + m2 * (x - x0), label: 'k', lx: x0 - (m1 > 0 ? 3 : -3) }] });
      st = 'Lines ℓ and k are graphed in the xy-plane. If (x, y) is the solution to the system of equations represented by the two lines, what is the value of x + y?';
      cor = x0 + y0; wr = [x0 - y0, x0 * y0 === x0 + y0 ? x0 + y0 + 2 : x0 * y0, x0 + y0 + 1, y0 - x0];
      ex = `The lines intersect at (${x0}, ${y0}), so x + y = ${x0 + y0}.`; d = 3;
    } else if (t === 'vertex') { // parabola, read min/max
      const a = pick([1, -1, 0.5, -0.5]), h = ri(-3, 3), k = a > 0 ? ri(-5, 0) : ri(0, 5);
      svg = fnGraph({ fns: [{ f: (x) => a * (x - h) ** 2 + k, label: 'y = f(x)', lx: h + 1.6 }] });
      const mx = a > 0 ? 'minimum' : 'maximum';
      st = `The graph of the quadratic function y = f(x) is shown. What is the ${mx} value of f?`; cor = k; wr = [h, k === 0 ? 1 : -k, a > 0 ? k + 1 : k - 1, h + k === k ? k + 2 : h + k];
      ex = `The vertex of the parabola is (${h}, ${k}); its y-coordinate ${k} is the ${mx} value of f.`; d = 3;
    } else if (t === 'roots') { // parabola with integer x-intercepts
      let r1 = ri(-5, -1), r2 = ri(1, 5); if (r1 === -r2) r2 = r2 === 5 ? 4 : r2 + 1; const a = pick([0.5, -0.5, 1, -1]); const f = (x) => a * (x - r1) * (x - r2); // symmetric roots would make the sign-flipped factors equivalent
      const vy = f((r1 + r2) / 2); const span = Math.max(6, Math.ceil(Math.abs(vy)) + 1);
      svg = fnGraph({ fns: [{ f }], xr: [-6, 6], yr: [-span, span], step: 1, labelEvery: span > 8 ? 4 : 2 });
      st = 'The graph of y = f(x) is shown, where f is a quadratic function. Which of the following could define f?';
      const fx = (p, q) => `f(x) = ${a < 0 ? '−' : ''}${Math.abs(a) === 0.5 ? '(1/2)' : ''}(x ${sg(-p)})(x ${sg(-q)})`;
      cor = fx(r1, r2); wr = [fx(-r1, -r2), fx(r1, -r2), fx(-r1, r2)];
      ex = `The graph crosses the x-axis at x = ${r1} and x = ${r2}, so (x ${sg(-r1)}) and (x ${sg(-r2)}) are factors of f(x); the graph opens ${a > 0 ? 'upward' : 'downward'}.`; d = 4;
    } else if (t === 'expo') { // exponential through (0,a) and (1,ab)
      const a0 = pick([1, 2, 3]), b = pick([2, 3]);
      svg = fnGraph({ fns: [{ f: (x) => a0 * b ** x, label: 'y = f(x)', lx: 0.6 }], pts: [{ x: 0, y: a0, label: `(0, ${a0})` }, { x: 1, y: a0 * b, label: `(1, ${a0 * b})` }], xr: [-4, 4], yr: [-2, 10], step: 1 });
      const ef = (a, base) => (a === 1 ? `f(x) = ${base}^x` : `f(x) = ${a}(${base})^x`);
      st = 'The graph of the exponential function f is shown. Which equation could define f?'; cor = ef(a0, b);
      wr = [`f(x) = ${b}^x + ${a0}`, ef(a0, b + 1), ef(a0 * b, b), `f(x) = ${a0}x^${b}`];
      ex = `f(0) = ${a0} gives the initial value, and f(1)/f(0) = ${b} gives the growth factor: f(x) = ${a0}·${b}^x.`; d = 4;
    } else if (t === 'scatter') { // line of best fit prediction
      const m = pick([0.5, 1, 1.5, 2]), b = ri(1, 3), pts = Array.from({ length: 9 }, (_, k) => { const x = k + 1; return [x, Math.max(0.5, Math.min(19, Math.round((m * x + b + (rnd() - 0.5) * 2) * 2) / 2))]; });
      const x0 = pick([4, 6, 8]); const yhat = m * x0 + b;
      svg = scatterPlot({ title: 'Study time and quiz score points gained', points: pts, xMax: 10, yMax: 20, step: 2, line: { m, b }, xLabel: 'Hours of study', yLabel: 'Points gained' });
      st = `The scatterplot shows 9 students and a line of best fit. Based on the line of best fit, what is the predicted number of points gained by a student who studies ${x0} hours?`;
      cor = yhat; wr = [yhat + 2, yhat - 2, m * (x0 + 1) + b === yhat + 2 ? yhat + 3 : m * (x0 + 1) + b];
      ex = `The line passes through (0, ${b}) with slope ${m}: ${m} × ${x0} + ${b} = ${yhat}.`; d = 2;
    } else if (t === 'table') { // linear table → equation
      const m = ri(2, 6), b = ri(-5, 9), xs = [1, 2, 3, 4];
      svg = tableSvg({ title: 'Values of x and f(x)', headers: ['x', 'f(x)'], rows: xs.map((x) => [x, m * x + b]) });
      const eq = (mm, bb) => { const t = mm === 0 ? '' : `${mm === 1 ? '' : mm === -1 ? '−' : String(mm).replace('-', '−')}x`; return t ? `f(x) = ${t}${bb === 0 ? '' : ' ' + sg(bb)}` : `f(x) = ${String(bb).replace('-', '−')}`; };
      st = 'The table shows four values of x and their corresponding values of the linear function f. Which equation defines f?'; cor = eq(m, b);
      wr = [eq(m + b, 0), eq(b === 0 ? m + 1 : b, m), eq(m, m + b)].map((w) => (w === cor ? eq(m, b + 1) : w));
      ex = `Each increase of 1 in x increases f(x) by ${m}, so the slope is ${m}; f(1) = ${m + b} gives the constant ${b}.`; d = 2;
    } else if (t === 'sector') { // sector area in terms of pi
      const r = pick([3, 4, 6, 9, 12]), deg = pick([30, 45, 60, 90, 120, 150]); const num = r * r * deg, den = 360;
      svg = sectorFig(r, deg);
      const piF = (n, dd) => { const f = frac(n, dd); return f === '1' ? 'π' : f.includes('/') ? `(${f})π` : `${f}π`; };
      st = `In the circle with center O shown, the radius is ${r} and the shaded sector has a central angle of ${deg}°. What is the area of the shaded sector?`;
      cor = piF(num, den); wr = [piF(2 * r * deg, den), piF(r * r * (360 - deg), den), piF(r * deg, den)];
      ex = `Sector area = (${deg}/360) × π × ${r}² = ${cor}.`; d = 4 + (deg % 45 === 0 && deg !== 90 ? 0 : 0);
    } else if (t === 'trig') { // right triangle trig
      const [p, q, h] = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10], [7, 24, 25]]); const fn = pick(['sin', 'cos', 'tan']);
      svg = trigTriangle({ ac: q, bc: p, ab: h, show: ['ac', 'bc', 'ab'] });
      const val = { sin: [p, h], cos: [q, h], tan: [p, q] }[fn];
      st = `In right triangle ABC shown, angle C is a right angle. What is the value of ${fn}(A)?`; cor = frac(...val);
      wr = shuffle([[q, h], [p, h], [p, q], [q, p], [h, p], [h, q]].map((r) => frac(...r)).filter((w) => w !== cor)); // the other five side ratios
      ex = `${fn}(A) = ${fn === 'sin' ? 'opposite/hypotenuse' : fn === 'cos' ? 'adjacent/hypotenuse' : 'opposite/adjacent'}. Side BC (${p}) is opposite A, AC (${q}) is adjacent, AB (${h}) is the hypotenuse, so ${fn}(A) = ${cor}.`; d = 3;
    } else if (t === 'histo') { // mean from frequency bar chart
      const base = ri(0, 3), vals = [0, 1, 2, 3, 4].map((v) => v + base), fr = vals.map((_, k) => ri(k < 2 ? 0 : 1, 7)); const n = fr.reduce((a, b) => a + b, 0), sum = vals.reduce((a, v, k) => a + v * fr[k], 0);
      if (sum % n) { if (++retries < 200) { i--; continue; } } // keep integer means only
      svg = barChart({ title: 'Number of books read in a month', labels: vals.map(String), values: fr, yMax: 8, yStep: 1, yLabel: 'Number of students' });
      st = 'The bar graph shows how many books each student in a club read last month. What is the mean number of books read per student?';
      cor = sum / n; wr = [n / 5, Math.max(...fr), sum / 5].map((w) => (w === cor ? cor + 1 : w));
      ex = `Total books = ${vals.map((v, k) => `${v}×${fr[k]}`).join(' + ')} = ${sum}; students = ${n}; mean = ${sum}/${n} = ${cor}.`; d = 3;
    } else { // shift: graph of f and translated g
      const h = pick([-3, -2, 2, 3]), k = pick([-2, 1, 2, 3]), f = (x) => 0.5 * x * x - 2;
      svg = fnGraph({ fns: [{ f, label: 'f', lx: -2.6 }, { f: (x) => f(x - h) + k, label: 'g', lx: h + 2.4 }] });
      const gx = (hh, kk) => `g(x) = f(x ${hh === 0 ? '' : sg(-hh)})${kk === 0 ? '' : ' ' + sg(kk)}`.replace('f(x )', 'f(x)');
      st = 'The graphs of y = f(x) and y = g(x) are shown in the xy-plane. The graph of g is the graph of f shifted. Which equation defines g?';
      cor = gx(h, k); wr = [gx(-h, k), gx(h, -k), gx(-h, -k)];
      ex = `The vertex moves from (0, −2) to (${h}, ${-2 + k}): ${Math.abs(h)} unit(s) ${h > 0 ? 'right' : 'left'} and ${Math.abs(k)} unit(s) ${k > 0 ? 'up' : 'down'}, so g(x) = ${cor.slice(7)}.`; d = 5;
    }
    const uniq = [...new Set(wr.map(String))].filter((w) => w !== String(cor));
    if (uniq.length < 3) { if (++retries < 200) { i--; continue; } throw new Error(`satFigures: not enough distractors for ${t}`); }
    mcq('SAT', 'math', d, st, cor, wr, ex, { image_svg: svg });
  }
}
satFigures(72);


/* ---------- reading calibration: a passage that reads above a level cannot be served at that level ----------
   Flesch-Kincaid grade of the passage sets a minimum difficulty (only ever raises). Thresholds follow each exam's level windows. */
function calibrateReading() {
  const syl = (w) => { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (w.length <= 3) return 1; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); return Math.max(1, (w.match(/[aeiouy]{1,2}/g) || []).length); };
  const fk = (t) => { const ws = String(t).match(/[A-Za-z]+/g) || []; if (ws.length < 20) return 0; const se = Math.max(1, (String(t).match(/[.!?]+(["”’)]*)(\s|$)/g) || []).length); return 0.39 * (ws.length / se) + 11.8 * (ws.reduce((a, w) => a + syl(w), 0) / ws.length) - 15.59; };
  // [FK grade, minimum difficulty] steps per exam
  const STEPS = { MAP: [[3.5, 2], [6, 3], [8, 4], [10, 5]], SSAT: [[5.5, 2], [7, 3], [8.5, 4], [10.5, 5]], ISEE: [[6, 2], [7.5, 3], [9, 4], [11, 5]], TOEFLJ: [[5, 2], [6.5, 3], [8, 4]], WIDA: [[4.5, 2], [6.5, 3], [8.5, 4]] };
  let moved = 0;
  for (const q of Q) {
    const steps = STEPS[q.exam_type]; if (!steps || !q.passage || !['reading'].includes(q.section)) continue;
    const g = fk(q.passage); let min = 1; for (const [t, d] of steps) if (g >= t) min = d;
    if (q.difficulty < min) { q.difficulty = min; moved++; }
  }
  console.log('reading calibration: raised difficulty of', moved, 'items');
}
calibrateReading();

/* ---------- review export (REVIEW_DIR=...): sets for blind verification of generated questions ---------- */
if (process.env.REVIEW_DIR) {
  const dir = process.env.REVIEW_DIR; mkdirSync(dir + '/keys', { recursive: true });
  const skip = process.env.REVIEW_SKIP ? new Set(JSON.parse(readFileSync(process.env.REVIEW_SKIP, 'utf8'))) : new Set(); // ids that were already reviewed
  const gen = Q.filter((r) => r.kind === 'mcq' && r._src !== 'bank' && !skip.has(r.id));
  const isImg = (r) => r.image_svg || r.choices.some((c) => String(c).startsWith('svg:'));
  const text = gen.filter((r) => !isImg(r)), img = gen.filter(isImg);
  const uri = (x) => 'data:image/svg+xml;utf8,' + encodeURIComponent(x);
  for (let k = 0, i = 0; i < text.length; k++, i += 150) {
    const part = text.slice(i, i + 150);
    writeFileSync(`${dir}/text-${k}.json`, JSON.stringify(part.map((r) => ({ exam_type: r.exam_type, section: r.section, difficulty: r.difficulty, passage: r.passage, stem: r.stem, choices: r.choices, answer: r.answer, explanation: r.explanation }))));
    writeFileSync(`${dir}/keys/text-${k}.ids.json`, JSON.stringify(part.map((r) => r.id)));
  }
  for (let k = 0, i = 0; i < img.length; k++, i += 8) {
    const part = img.slice(i, i + 8);
    const html = '<body style="margin:0;font:14px sans-serif;background:#fff;width:1300px;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px">' + part.map((r, j) => `<div style="border:2px solid #444;padding:10px"><b>Item ${k}-${j + 1}</b> <span style="color:#777">[${r.exam_type}/${r.section}]</span>${r.passage ? `<div style="margin:6px 0;color:#333">${String(r.passage).replace(/</g, '&lt;')}</div>` : ''}${r.image_svg ? `<div><img src="${uri(r.image_svg)}" style="max-width:100%;max-height:260px;border:1px solid #ddd"></div>` : ''}<div style="margin:8px 0;white-space:pre-wrap"><b>${r.stem.replace(/</g, '&lt;')}</b></div>${r.choices.map((c, x) => `<div style="margin:3px 0;display:flex;gap:8px;align-items:center"><b>${'ABCD'[x]})</b>${String(c).startsWith('svg:') ? `<img src="${uri(String(c).slice(4))}" style="height:64px;border:1px solid #ddd">` : String(c).replace(/</g, '&lt;')}</div>`).join('')}</div>`).join('') + '</body>';
    writeFileSync(`${dir}/img-${k}.html`, html);
    writeFileSync(`${dir}/keys/img-${k}.key.json`, JSON.stringify(part.map((r, j) => ({ n: `${k}-${j + 1}`, id: r.id, answer: r.answer, stem: r.stem.slice(0, 80), explanation: r.explanation }))));
  }
  console.log('review export:', text.length, 'text items in', Math.ceil(text.length / 150), 'files;', img.length, 'image items in', Math.ceil(img.length / 8), 'galleries');
}

/* ---------- sanity checks ---------- */
{
  const bad = [];
  for (const r of Q) if (r.kind === 'mcq') {
    const c = r.choices || [];
    if (c.length < 3 || new Set(c).size !== c.length || !(r.answer >= 0 && r.answer < c.length) || !r.stem) bad.push(r.id + ' ' + JSON.stringify(c));
  }
  if (new Set(Q.map((r) => r.id)).size !== Q.length) bad.push('duplicate ids');
  if (bad.length) { console.error('INVALID QUESTIONS:\n' + bad.slice(0, 15).join('\n')); process.exit(1); }
}

/* ---------- SQL ---------- */
const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
let sql = '-- generated by scripts/gen-seed.mjs\n';
for (const r of Q) {
  sql += `INSERT OR IGNORE INTO questions (id,exam_type,section,kind,difficulty,passage,stem,image_svg,choices,answer,explanation,active,created_at) VALUES (${[
    q(r.id), q(r.exam_type), q(r.section), q(r.kind), r.difficulty, q(r.passage ?? null), q(r.stem), q(r.image_svg ?? null),
    q(r.choices ? JSON.stringify(r.choices) : null), q(r.answer ?? null), q(r.explanation ?? null), 1, 0].join(',')});\n`;
}
const products = [
  // 1회권 ≈ 4~5만원, 3회권 ≈ 15% 할인 (USD cents는 환율 약 1,300원 기준)
  ['p-map-1', 'MAP', 'MAP 모의고사 1회권', 'Reading · Language Usage · Mathematics (적응형)', 45000, 3500, 1, 90, 1],
  ['p-map-3', 'MAP', 'MAP 모의고사 3회권', '3회 응시 · 성장 추이 비교', 115000, 8900, 3, 180, 2],
  ['p-cat4-1', 'CAT4', 'CAT4 모의고사 1회권', 'Verbal · Quantitative · Non-Verbal · Spatial', 45000, 3500, 1, 90, 3],
  ['p-cat4-3', 'CAT4', 'CAT4 모의고사 3회권', '3회 응시', 115000, 8900, 3, 180, 4],
  ['p-scat-1', 'SCAT', 'SCAT 모의고사 1회권', 'Verbal · Quantitative (그래프/도형 SVG 문항 포함)', 39000, 3000, 1, 90, 5],
  ['p-scat-3', 'SCAT', 'SCAT 모의고사 3회권', '3회 응시', 99000, 7700, 3, 180, 6],
  ['p-ssat-1', 'SSAT', 'SSAT 모의고사 1회권', 'Writing · Quantitative · Reading · Verbal', 49000, 3900, 1, 90, 7],
  ['p-ssat-3', 'SSAT', 'SSAT 모의고사 3회권', '3회 응시', 125000, 9900, 3, 180, 8],
  ['p-isee-1', 'ISEE', 'ISEE 모의고사 1회권', 'Verbal · Quantitative · Reading · Math · Essay', 49000, 3900, 1, 90, 9],
  ['p-isee-3', 'ISEE', 'ISEE 모의고사 3회권', '3회 응시', 125000, 9900, 3, 180, 10],
  ['p-wida-1', 'WIDA', 'WIDA 모의고사 1회권', 'Listening · Reading · Writing · Speaking (쓰기/말하기 채점 포함)', 49000, 3900, 1, 90, 11],
  ['p-wida-3', 'WIDA', 'WIDA 모의고사 3회권', '3회 응시', 125000, 9900, 3, 180, 12],
  ['p-cogat-1', 'COGAT', 'CogAT 모의고사 1회권', 'Verbal · Quantitative · Nonverbal (도형 SVG 문항 포함)', 45000, 3500, 1, 90, 13],
  ['p-cogat-3', 'COGAT', 'CogAT 모의고사 3회권', '3회 응시', 115000, 8900, 3, 180, 14],
  ['p-sat-1', 'SAT', 'SAT 모의고사 1회권', 'Reading & Writing · Math (그래프/도형 SVG 문항 포함)', 49000, 3900, 1, 90, 15],
  ['p-sat-3', 'SAT', 'SAT 모의고사 3회권', '3회 응시', 125000, 9900, 3, 180, 16],
  ['p-toeflj-1', 'TOEFLJ', 'TOEFL Junior 모의고사 1회권', 'Listening · Language Form & Meaning · Reading', 45000, 3500, 1, 90, 17],
  ['p-toeflj-3', 'TOEFLJ', 'TOEFL Junior 모의고사 3회권', '3회 응시', 115000, 8900, 3, 180, 18],
  ['p-toeicb-1', 'TOEICB', 'TOEIC Bridge 모의고사 1회권', 'Listening · Reading (파트별 실전 구성)', 39000, 3000, 1, 90, 19],
  ['p-toeicb-3', 'TOEICB', 'TOEIC Bridge 모의고사 3회권', '3회 응시', 99000, 7700, 3, 180, 20],
  ['p-kreng-1', 'KR_ENG', '영어 레테 1회권', 'Reading · Vocabulary · Grammar · Writing(교사 채점) · 9–12세 SR 3.5–6.5', 47000, 3700, 1, 90, 30],
  ['p-kreng-3', 'KR_ENG', '영어 레테 3회권', '3회 응시', 119000, 9300, 3, 180, 31],
  ['p-krkor-1', 'KR_KOR', '국어 문해력 레테 1회권', '비문학 · 문학 · 어휘 · 서술형 · 7–12세', 39000, 3100, 1, 90, 32],
  ['p-krkor-3', 'KR_KOR', '국어 문해력 레테 3회권', '3회 응시', 99000, 7900, 3, 180, 33],
  ['p-krmath-1', 'KR_MATH', '수학 사고력 레테 1회권', '수·연산 · 도형·공간 · 규칙·추론 · 문제해결 · 7–12세', 43000, 3400, 1, 90, 34],
  ['p-krmath-3', 'KR_MATH', '수학 사고력 레테 3회권', '3회 응시', 109000, 8700, 3, 180, 35],
];
// One-time data migration so already-deployed databases get the three new exams' products.
writeFileSync(new URL('../migrations/0006_new_exams.sql', import.meta.url), '-- generated by scripts/gen-seed.mjs: products for CogAT / SAT / TOEFL Junior\n' + products.filter((p) => /cogat|sat-|toeflj/.test(p[0]) && !/ssat|isee/.test(p[0])).map((p) =>
  `INSERT OR IGNORE INTO products (id,exam_type,title,description,price_krw,price_usd_cents,attempts,valid_days,active,sort) VALUES (${[...p.slice(0, 8), 1, p[8]].map((v) => q(v)).join(',')});`).join('\n') + '\n');
writeFileSync(new URL('../migrations/0011_kr_tests.sql', import.meta.url), '-- generated by scripts/gen-seed.mjs: products for the 국내 레벨테스트(레테) category\n' + products.filter((p) => /^KR_/.test(p[1])).map((p) =>
  `INSERT OR IGNORE INTO products (id,exam_type,title,description,price_krw,price_usd_cents,attempts,valid_days,active,sort) VALUES (${[...p.slice(0, 8), 1, p[8]].map((v) => q(v)).join(',')});`).join('\n') + '\n');
// One-time data migration so already-deployed databases pick up the new price list.
writeFileSync(new URL('../migrations/0015_toeic_bridge.sql', import.meta.url), '-- generated by scripts/gen-seed.mjs: products for TOEIC Bridge\n' + products.filter((p) => p[1] === 'TOEICB').map((p) =>
  `INSERT OR IGNORE INTO products (id,exam_type,title,description,price_krw,price_usd_cents,attempts,valid_days,active,sort) VALUES (${[...p.slice(0, 8), 1, p[8]].map((v) => q(v)).join(',')});`).join('\n') + '\n');
writeFileSync(new URL('../migrations/0004_prices.sql', import.meta.url), '-- generated by scripts/gen-seed.mjs: price list update (adds missing products)\n' + products.map((p) =>
  `INSERT INTO products (id,exam_type,title,description,price_krw,price_usd_cents,attempts,valid_days,active,sort) VALUES (${[...p.slice(0, 8), 1, p[8]].map((v) => q(v)).join(',')}) ON CONFLICT(id) DO UPDATE SET price_krw=excluded.price_krw, price_usd_cents=excluded.price_usd_cents, sort=excluded.sort;`).join('\n') + '\n');
for (const p of products) sql += `INSERT OR REPLACE INTO products (id,exam_type,title,description,price_krw,price_usd_cents,attempts,valid_days,active,sort) VALUES (${[...p.slice(0, 8), 1, p[8]].map((v) => q(v)).join(',')});\n`;
writeFileSync(new URL('../seed/seed.sql', import.meta.url), sql);
// The question bank is NOT bundled into the Worker (that made every cold start parse ~4 MB). It is shipped as a static
// file that only the Worker can read (/_seed/* is blocked for visitors) and fetched once per new version.
{
  const seedJson = {
    version: hash(Q.map((r) => `${r.id}:${r.difficulty}${r.image_svg ? ':' + hash(r.image_svg) : ''}`).join(',')), // difficulty and figures are part of the version so re-calibrations and redrawn figures reach live databases
    questions: Q.map((r) => [r.id, r.exam_type, r.section, r.kind, r.difficulty, r.passage ?? null, r.stem, r.image_svg ?? null, r.choices ? JSON.stringify(r.choices) : null, r.answer ?? null, r.explanation ?? null]),
    products: products.map((p) => [...p.slice(0, 8), 1, p[8]]),
  };
  mkdirSync(new URL('../public/_seed/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../public/_seed/seed.json', import.meta.url), JSON.stringify(seedJson));
  writeFileSync(new URL('../seed/manifest.json', import.meta.url), JSON.stringify({ version: seedJson.version, questions: seedJson.questions.length, products: seedJson.products }));
}
const by = {}; for (const r of Q) by[`${r.exam_type}/${r.section}`] = (by[`${r.exam_type}/${r.section}`] || 0) + 1;
console.log(by);
