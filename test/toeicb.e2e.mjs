// TOEIC Bridge: two sections of 25, every part in the real test's order with its fixed count, picture choices,
// scores on the 15–50 scale per section (30–100 total), products on sale, free sample.
import assert from 'node:assert/strict';
const BASE = process.env.BASE || 'http://localhost:8787';
class C {
  cookie = '';
  async req(m, p, b) {
    const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', cookie: this.cookie }, body: b ? JSON.stringify(b) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) { const v = sc.split(';')[0]; this.cookie = v.endsWith('=') ? '' : v; }
    return { status: r.status, ...(await r.json().catch(() => ({}))) };
  }
  get = (p) => this.req('GET', p); post = (p, b) => this.req('POST', p, b);
}
const admin = new C(), anon = new C();
assert.ok((await admin.post('/api/auth/login', { email: process.env.ADMIN_EMAIL || 'admin@example.com', password: 'Mock-test-2026' })).user);

const prods = (await anon.get('/api/products')).products.filter((p) => p.exam_type === 'TOEICB');
assert.deepEqual(prods.map((p) => p.attempts).sort(), [1, 3], 'TOEIC Bridge 1회권 / 3회권 on sale');
const info = (await anon.get('/api/exam-info')).exams.find((e) => e.type === 'TOEICB');
assert.deepEqual(info.sections.map((s) => [s.key, s.n]), [['listening', 25], ['reading', 25]]);

const ORDER = { listening: ['Part 1 · Four Pictures', 'Part 2 · Question-Response', 'Part 3 · Conversations', 'Part 4 · Talks'], reading: ['Part 1 · Sentence Completion', 'Part 2 · Text Completion', 'Part 3 · Reading Comprehension'] };
const COUNT = { 'Part 1 · Four Pictures': 3, 'Part 2 · Question-Response': 10, 'Part 3 · Conversations': 6, 'Part 4 · Talks': 6, 'Part 1 · Sentence Completion': 8, 'Part 2 · Text Completion': 8, 'Part 3 · Reading Comprehension': 9 };
const allSeen = new Set();
// a fresh student with a 3회권 (the admin account keeps history between runs, which would shrink the unseen pool)
const stu = new C(), reg = await stu.post('/api/auth/register', { email: `tb${Date.now()}@t.com`, name: 'TB', password: 'Mock-test-2026', agree: true });
assert.ok((await admin.post(`/api/admin/users/${reg.user.id}/grant`, { productId: 'p-toeicb-3' })).ok, 'grant 3회권');
async function take(right) {
  const admin = stu; // the student takes the tests
  const s = await admin.post('/api/attempts', { examType: 'TOEICB' });
  assert.ok(s.id, JSON.stringify(s));
  let cur = await admin.get(`/api/attempts/${s.id}/current`); const keys = [];
  while (cur.status === 'in_progress') {
    const sec = cur.section.key; keys.push(sec);
    assert.equal(cur.questions.length, 25, `${sec}: 25 questions`);
    const parts = cur.questions.map((q) => q.part);
    assert.ok(parts.every(Boolean), `${sec}: every question has a part`);
    const runs = parts.filter((p, i) => p !== parts[i - 1]);
    assert.deepEqual(runs, ORDER[sec], `${sec}: parts in order`);
    for (const p of ORDER[sec]) assert.equal(parts.filter((x) => x === p).length, COUNT[p], `${p} count`);
    if (sec === 'listening') {
      assert.ok(cur.questions.every((q) => q.passage), 'listening has scripts');
      assert.ok(cur.questions.filter((q) => q.part === ORDER.listening[0]).every((q) => q.choices.every((c) => c.startsWith('svg:'))), 'picture choices');
    }
    for (const q of cur.questions) { allSeen.add(q.id); await admin.post(`/api/attempts/${s.id}/save`, { questionId: q.id, choice: right ? 0 : 1 }); }
    cur = await admin.post(`/api/attempts/${s.id}/submit-section`, { section: cur.section.index });
  }
  assert.deepEqual(keys, ['listening', 'reading']);
  return admin.get(`/api/attempts/${s.id}/report`);
}
const rep = await take(true);
assert.equal(rep.attempt.status, 'graded');
for (const k of ['listening', 'reading']) { const sc = rep.score.sections[k].scaled; assert.ok(sc >= 15 && sc <= 50, `${k} scaled ${sc}`); }
assert.equal(rep.score.overall, rep.score.sections.listening.scaled + rep.score.sections.reading.scaled, 'total = sum (30–100)');
// second and third tests: fresh questions while the pool allows
const before = allSeen.size; await take(false); await take(false);
assert.equal(allSeen.size, 150, `three tests drew ${allSeen.size} distinct questions (no repeats)`);

let ok = false;
for (let i = 0; i < 5 && !ok; i++) ok = (await anon.get('/api/sample/TOEICB')).questions?.length === 5;
assert.ok(ok, 'free sample has 5 questions');
console.log('TOEIC BRIDGE OK', { distinct: allSeen.size });
