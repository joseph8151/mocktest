// Generates seed/seed.sql: products + ORIGINAL sample questions (format-inspired, not copied).
import { writeFileSync } from 'node:fs';
import { barChart, lineChart, pieChart, rectFig, rightTriangle, circleFig, coordPlane, angleFig, numberLine, gridShape } from './svgcharts.mjs';

let seedState = 12345;
const rnd = () => ((seedState = (seedState * 1664525 + 1013904223) % 4294967296) / 4294967296);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const Q = [];
let n = 0;
function add(exam_type, section, difficulty, stem, choices, answer, explanation, extra = {}) {
  Q.push({ id: `seed-${exam_type.toLowerCase()}-${section}-${++n}`, exam_type, section, kind: 'mcq', difficulty, stem, choices, answer, explanation, ...extra });
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
for (const [d, s, c, a] of V) add('CAT4', 'verbal', d, s, c, a, 'Think about the relationship between the words.');

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
  const s = ri(3, 5), shown = [0, 1, 2].map((j) => poly(s + j)).concat(['<text x="30" y="42" font-size="36" text-anchor="middle">?</text>']);
  const ans = s + 3; const opts = shuffle([ans, ans + 1, ans - 1, Math.max(3, s)]).filter((v, k, a) => a.indexOf(v) === k);
  while (opts.length < 4) opts.push(ans + opts.length + 1);
  add('CAT4', 'nonverbal', 2, 'Which shape comes next in the pattern?', opts.map((o) => 'svg:' + svg(poly(o))), opts.indexOf(ans), `Each shape has one more side: next has ${ans}.`, { image_svg: strip(shown) });
}
for (let i = 0; i < 10; i++) { // rotating triangle
  const step = pick([45, 90, 120]), start = pick([0, 30]);
  const shown = [0, 1, 2].map((j) => poly(3, start + step * j, '#0ea5e9')).concat(['<text x="30" y="42" font-size="36" text-anchor="middle">?</text>']);
  const ans = (start + step * 3) % 360; const cand = [ans, (ans + 60) % 360, (ans + 180) % 360, (ans + 300) % 360].filter((v, k, a) => a.indexOf(v) === k);
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
const F = (tr) => `<g transform="${tr}"><path d="M-10 -16 H12 V-8 H-2 V-2 H8 V6 H-2 V16 H-10 Z" fill="#16a34a" stroke="#111" stroke-width="2"/></g>`;
for (let i = 0; i < 32; i++) {
  const base = svg(F('translate(30,30)'), 60, 60);
  const angs = shuffle([0, 45, 90, 135, 180, 225, 270, 315]);
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
for (const [d, script, stem, c, a] of WL) add('WIDA', 'listening', d, stem, c, a, 'Listen for the key detail.', { passage: script });
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
for (const [d, p, stem, c, a] of WR) add('WIDA', 'reading', d, stem, c, a, 'Find the answer in the text.', { passage: p });
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
for (const [d, s, c, a] of [
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
]) add('CAT4', 'verbal', d, s, c, a, 'Think about the relationship between the words.');
for (const [d, script, stem, c, a] of [
  [1, 'Anna says: "My birthday is on Saturday. I\'m having a party at my house."', 'Where is Anna\'s party?', ['At school', 'At her house', 'At the park', 'At a restaurant'], 1],
  [2, 'Teacher: "Tomorrow is picture day. Please wear your school shirt and bring your homework."', 'What should students wear tomorrow?', ['A costume', 'Their school shirt', 'A jacket', 'Sports clothes'], 1],
  [2, 'Dad: "We\'re out of milk, so I\'m going to the store. Do you need anything?"', 'Why is Dad going to the store?', ['To buy milk', 'To meet a friend', 'To return a book', 'To get gas'], 0],
  [3, 'Principal: "The assembly will begin at ten, but students from Room 4 should arrive early to help set up chairs."', 'Who should come early?', ['All students', 'Teachers only', 'Students from Room 4', 'Parents'], 2],
  [4, 'Ranger: "Because the trail is muddy after the rain, we will take the lower path, which is longer but safer."', 'Why will the group take the lower path?', ['It is shorter', 'It is safer', 'It has a view', 'It is closed'], 1],
  [5, 'Lecturer: "Although electric cars produce no exhaust, their overall environmental benefit depends on how the electricity is generated."', 'What does the lecturer suggest?', ['Electric cars are always clean', 'Benefits depend on the electricity source', 'Exhaust is harmless', 'Electric cars are expensive'], 1],
]) add('WIDA', 'listening', d, stem, c, a, 'Listen for the key detail.', { passage: script });
for (const [d, p, stem, c, a] of [
  [1, 'Mia has a cat named Pepper. Pepper likes to sleep on the sofa and drink milk.', 'What does Pepper like to drink?', ['Water', 'Milk', 'Juice', 'Tea'], 1],
  [2, 'On Monday, the class started a garden. They planted beans, carrots, and corn. Each student has a job.', 'What did the class start on Monday?', ['A garden', 'A game', 'A play', 'A trip'], 0],
  [3, 'The library offers free programs during the summer. Children can join a reading club, and older students can volunteer as helpers.', 'Who can volunteer as helpers?', ['Younger children', 'Older students', 'Teachers only', 'Nobody'], 1],
  [3, 'Rain forests are home to millions of species. Many of these plants and animals cannot live anywhere else on Earth.', 'Why are rain forests important?', ['They are cold', 'They shelter species found nowhere else', 'They have no animals', 'They are small'], 1],
  [4, 'The inventor tested hundreds of materials before finding one strong enough. "Every failure," she said, "taught me what not to do."', 'What does the inventor\'s statement show?', ['She gave up easily', 'She learned from failures', 'She disliked testing', 'She worked alone'], 1],
  [5, 'Economists note that when a product becomes scarce, its price typically rises unless demand falls at the same time.', 'What usually happens to the price of a scarce product?', ['It falls', 'It rises', 'It stays the same', 'It disappears'], 1],
]) add('WIDA', 'reading', d, stem, c, a, 'Find the answer in the text.', { passage: p });
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
    default: { // grid area
      const all = []; for (let c = 0; c < 6; c++) for (let r = 0; r < 6; r++) all.push([c, r]);
      const cells = shuffle(all).slice(0, ri(7, 16));
      return { stem: 'Each small square has an area of 1 square unit. What is the total shaded area?', svg: gridShape(cells), correct: cells.length, wrong: [cells.length + 1, cells.length - 1, cells.length + 2, cells.length * 2], expl: 'Count the shaded squares.' };
    }
  }
}
const GKINDS = ['bar', 'line', 'pie', 'rect', 'tri', 'circle', 'coord', 'angle', 'numline', 'grid'];
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
  if (t === 1) { const a = ri(2, 5), b = ri(2, 7), k = ri(3, 9); return [`The ratio of boys to girls in a class is ${a}:${b}. If there are ${a * k} boys, how many girls are there?`, b * k, [b * k + a, a * k + b, b + k, a * b], `${a * k} ÷ ${a} = ${k} groups, and ${k} × ${b} = ${b * k}.`]; }
  if (t === 2) { const x = ri(8, 15), y = ri(8, 15), z = ri(8, 15), mean = ri(10, 14), fourth = 4 * mean - x - y - z; if (fourth < 1) return wordMath(d); return [`The average of four numbers is ${mean}. Three of the numbers are ${x}, ${y}, and ${z}. What is the fourth number?`, fourth, [fourth + 4, fourth - 2, mean, 4 * mean], `Total = 4 × ${mean} = ${4 * mean}; subtract ${x + y + z}.`]; }
  if (t === 3) { const p = pick([60, 80, 120, 200]), off = pick([10, 20, 25, 50]), sale = p - (p * off) / 100; return [`A jacket that costs $${p} is on sale for ${off}% off. What is the sale price?`, `$${sale}`, [`$${(p * off) / 100}`, `$${sale + 10}`, `$${p - off}`, `$${sale - 5}`], `${off}% of ${p} = ${(p * off) / 100}, so ${p} − ${(p * off) / 100} = ${sale}.`]; }
  if (t === 4) { const x = ri(3, 14), a = ri(2, 6), b = ri(1, 12); return [`If ${a}x − ${b} = ${a * x - b}, what is the value of x?`, x, [x + 1, x - 1, x + a, a * x], `Add ${b}, divide by ${a}.`]; }
  if (t === 5) { const s = pick([40, 45, 50, 60]), hrs = pick([1.5, 2, 2.5, 3]); return [`A car travels at ${s} miles per hour for ${hrs} hours. How many miles does it travel?`, s * hrs, [s + hrs, s * hrs + 10, s / hrs, s * hrs - 10], `Distance = rate × time = ${s} × ${hrs}.`]; }
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
  else if (t === 'pow') { const a = ri(2, 4), b = ri(3, 6); A = a ** b; B = b ** a; stem = `Quantity A: ${a}^${b}\nQuantity B: ${b}^${a}`; expl = `${a}^${b} = ${A}; ${b}^${a} = ${B}.`; }
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
for (const [d, s, c, a] of [
  [1, 'Hot : Cold :: Light : ?', ['Lamp', 'Dark', 'Bright', 'Sun'], 1], [1, 'Puppy : Dog :: Kitten : ?', ['Cat', 'Mouse', 'Bird', 'Milk'], 0],
  [2, 'Pilot : Airplane :: Captain : ?', ['Ship', 'Wheel', 'Army', 'Ocean'], 0], [2, 'Seed : Plant :: Egg : ?', ['Nest', 'Chicken', 'Shell', 'Yolk'], 1],
  [2, 'Whisper : Shout :: Stroll : ?', ['Walk', 'Sprint', 'Rest', 'Slow'], 1], [3, 'Architect : Blueprint :: Composer : ?', ['Orchestra', 'Score', 'Piano', 'Concert'], 1],
  [3, 'Barometer : Pressure :: Odometer : ?', ['Speed', 'Distance', 'Fuel', 'Weather'], 1], [3, 'Frugal : Wasteful :: Humble : ?', ['Modest', 'Arrogant', 'Poor', 'Quiet'], 1],
  [4, 'Eulogy : Praise :: Satire : ?', ['Mockery', 'Sadness', 'Poetry', 'Funeral'], 0], [4, 'Gregarious : Solitary :: Verbose : ?', ['Talkative', 'Concise', 'Loud', 'Friendly'], 1],
  [4, 'Lighthouse : Warning :: Bell : ?', ['Ring', 'Signal', 'Church', 'Metal'], 1], [5, 'Obsolete : Modern :: Transparent : ?', ['Clear', 'Opaque', 'Glass', 'Fragile'], 1],
  [5, 'Zenith : Nadir :: Apex : ?', ['Peak', 'Base', 'Cone', 'Summit'], 1], [5, 'Skeptic : Doubt :: Optimist : ?', ['Hope', 'Fear', 'Think', 'Argue'], 0],
  [3, 'Chef : Kitchen :: Surgeon : ?', ['Hospital', 'Scalpel', 'Doctor', 'Mask'], 0], [4, 'Brevity : Lengthy :: Clarity : ?', ['Obscure', 'Bright', 'Simple', 'Short'], 0],
]) add('SCAT', 'verbal', d, s, c, a, 'Find the relationship in the first pair and apply it to the second.');
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
  ['p-map-1', 'MAP', 'MAP 모의고사 1회권', 'Reading · Language Usage · Mathematics (적응형)', 19000, 1400, 1, 90, 1],
  ['p-map-3', 'MAP', 'MAP 모의고사 3회권', '3회 응시 · 성장 추이 비교', 49000, 3600, 3, 180, 2],
  ['p-cat4-1', 'CAT4', 'CAT4 모의고사 1회권', 'Verbal · Quantitative · Non-Verbal · Spatial', 19000, 1400, 1, 90, 3],
  ['p-cat4-3', 'CAT4', 'CAT4 모의고사 3회권', '3회 응시', 49000, 3600, 3, 180, 4],
  ['p-scat-1', 'SCAT', 'SCAT 모의고사 1회권', 'Verbal · Quantitative (그래프/도형 SVG 문항 포함)', 15000, 1100, 1, 90, 5],
  ['p-ssat-1', 'SSAT', 'SSAT 모의고사 1회권', 'Writing · Quantitative · Reading · Verbal', 22000, 1600, 1, 90, 6],
  ['p-ssat-3', 'SSAT', 'SSAT 모의고사 3회권', '3회 응시', 59000, 4300, 3, 180, 7],
  ['p-isee-1', 'ISEE', 'ISEE 모의고사 1회권', 'Verbal · Quantitative · Reading · Math · Essay', 22000, 1600, 1, 90, 8],
  ['p-isee-3', 'ISEE', 'ISEE 모의고사 3회권', '3회 응시', 59000, 4300, 3, 180, 9],
  ['p-wida-1', 'WIDA', 'WIDA 모의고사 1회권', 'Listening · Reading · Writing · Speaking (쓰기/말하기 채점 포함)', 25000, 1900, 1, 90, 10],
];
for (const p of products) sql += `INSERT OR REPLACE INTO products (id,exam_type,title,description,price_krw,price_usd_cents,attempts,valid_days,active,sort) VALUES (${[...p.slice(0, 8), 1, p[8]].map((v) => q(v)).join(',')});\n`;
writeFileSync(new URL('../seed/seed.sql', import.meta.url), sql);
const by = {}; for (const r of Q) by[`${r.exam_type}/${r.section}`] = (by[`${r.exam_type}/${r.section}`] || 0) + 1;
console.log(by);
