// End-to-end smoke test against a running `wrangler dev` (BASE=http://localhost:8787).
import assert from 'node:assert/strict';
const BASE = process.env.BASE || 'http://localhost:8787';
class Client {
  cookie = '';
  async req(method, path, body) {
    const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', cookie: this.cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) this.cookie = sc.split(';')[0];
    const j = await r.json().catch(() => ({})); return { status: r.status, ...j };
  }
  get = (p) => this.req('GET', p); post = (p, b) => this.req('POST', p, b);
}
const stamp = Date.now();
const admin = new Client(), kid = new Client();
const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
let r = await admin.post('/api/auth/register', { email: adminEmail, name: 'Admin', password: 'password123', agree: true });
if (r.status === 409) r = await admin.post('/api/auth/login', { email: adminEmail, password: 'password123' });
assert.equal(r.user.role, 'admin', 'admin bootstrap');
r = await kid.post('/api/auth/register', { email: `kid${stamp}@t.com`, name: 'Kid', password: 'password123', agree: true });
assert.equal(r.user.role, 'student');
assert.equal((await kid.get('/api/admin/stats')).status, 403, 'student blocked from admin');
assert.equal((await new Client().get('/api/me/overview')).status, 401);
assert.equal((await kid.post('/api/attempts', { examType: 'CAT4' })).status, 402, 'no entitlement yet');

const kidId = r.user.id;
assert.ok((await admin.post(`/api/admin/users/${kidId}/grant`, { productId: 'p-cat4-1' })).ok);
assert.ok((await admin.post(`/api/admin/users/${kidId}/grant`, { productId: 'p-wida-1' })).ok);
assert.ok((await admin.post(`/api/admin/users/${kidId}/grant`, { productId: 'p-map-1' })).ok);

async function take(examType, answerFor, who = kid, level) {
  const s = await who.post('/api/attempts', { examType, level });
  assert.ok(s.id, JSON.stringify(s));
  let cur = await who.get(`/api/attempts/${s.id}/current`), n = 0;
  const seen = new Set();
  while (cur.status === 'in_progress') {
    if (cur.mode === 'section') { // navigable exams: save every answer, then submit the section
      for (const q of cur.questions) {
        assert.ok(!('answer' in q) && !('explanation' in q), 'answers must not leak');
        assert.ok(!seen.has(q.id), 'no repeated question'); seen.add(q.id);
        const body = answerFor(q); if (body === null) continue; // skipped on purpose
        assert.ok((await who.post(`/api/attempts/${s.id}/save`, { questionId: q.id, ...body })).ok); n++;
      }
      cur = await who.post(`/api/attempts/${s.id}/submit-section`, { section: cur.section.index });
    } else {
      assert.ok(!('answer' in cur.question) && !('explanation' in cur.question), 'answers must not leak');
      assert.ok(!seen.has(cur.question.id), 'no repeated question'); seen.add(cur.question.id);
      cur = await who.post(`/api/attempts/${s.id}/answer`, { questionId: cur.question.id, ...answerFor(cur.question) }); n++;
    }
  }
  return { id: s.id, n };
}
// "cheat" by reading answers from admin API so we can verify scoring
const key = async (id) => (await admin.get(`/api/admin/questions/${id}`)).answer;
const cheat = new Map();
const qs = (await Promise.all(['MAP', 'CAT4', 'WIDA', 'SCAT', 'SSAT', 'ISEE', 'COGAT', 'SAT', 'TOEFLJ'].map((e) => admin.get(`/api/admin/questions?exam=${e}&limit=1000`)))).flatMap((r) => r.questions);
for (const q of qs) if (q.kind === 'mcq') cheat.set(q.id, await key(q.id));

for (const ex of ['CAT4', 'MAP']) {
  const { id, n } = await take(ex, () => ({ choice: 0 }));
  const rep = await kid.get(`/api/attempts/${id}/report`);
  console.log(ex, 'answered', n, 'overall', rep.score.overall, Object.values(rep.score.sections).map((s) => `${s.name}:${s.correct}/${s.total}`).join(' '));
  assert.ok(ex === 'MAP' ? rep.score.sections.reading.rit >= 100 && rep.score.sections.math.rit >= 100 : rep.score.overall, 'score present');
}
// perfect run on a second CAT4 attempt is impossible (1 attempt) -> grant again
await admin.post(`/api/admin/users/${kidId}/grant`, { productId: 'p-cat4-1' });
const s2 = await take('CAT4', (q) => ({ choice: cheat.get(q.id) }));
const perfect = await kid.get(`/api/attempts/${s2.id}/report`);
assert.equal((await kid.post('/api/attempts', { examType: 'CAT4' })).status, 402, 'attempts exhausted');
console.log('CAT4 perfect', perfect.score.overall, perfect.score.sections.verbal);
assert.ok(perfect.score.overall >= 130);
assert.equal((await kid.post('/api/attempts', { examType: 'CAT4' })).status, 402, 'attempts exhausted');

// WIDA with manual grading
const w = await take('WIDA', (q) => (q.kind === 'text' ? { text: 'My favorite place is the library. It is quiet.' } : q.kind === 'audio' ? { audioKey: null } : { choice: cheat.get(q.id) }));
let rep = await kid.get(`/api/attempts/${w.id}/report`);
assert.equal(rep.attempt.status, 'submitted'); assert.equal(rep.score.pendingManual, true);
const queue = (await admin.get('/api/admin/grading')).items.filter((i) => i.attempt_id === w.id);
assert.equal(queue.length, 4);
for (const it of queue) assert.ok((await admin.post(`/api/admin/grading/${it.id}`, { score: 4, feedback: 'ok' })).ok);
rep = await kid.get(`/api/attempts/${w.id}/report`);
console.log('WIDA', rep.attempt.status, rep.score.composites);
assert.equal(rep.attempt.status, 'graded'); assert.ok(rep.score.composites.overall);
// SCAT / SSAT / ISEE: scaled scores, SVG questions, essay grading
for (const pid of ['p-scat-1', 'p-ssat-1', 'p-isee-1']) assert.ok((await admin.post(`/api/admin/users/${kidId}/grant`, { productId: pid })).ok);
let svgSeen = 0;
const smart = (q) => { if (q.image_svg) { svgSeen++; assert.ok(q.image_svg.startsWith('<svg'), 'svg question'); } return q.kind === 'text' ? { text: 'A short essay about friendship and honesty.' } : { choice: cheat.get(q.id) }; };
for (const [ex, minOverall] of [['SCAT', 400], ['SSAT', 1300], ['ISEE', 3000]]) {
  const t = await take(ex, smart);
  const r2 = await kid.get(`/api/attempts/${t.id}/report`);
  console.log(ex, 'answered', t.n, 'overall', r2.score.overall, 'status', r2.attempt.status);
  assert.ok(r2.score.overall >= minOverall, `${ex} perfect-run total`);
  if (ex !== 'SCAT') {
    assert.equal(r2.attempt.status, 'submitted'); assert.equal(r2.score.pendingManual, true);
    const item = (await admin.get('/api/admin/grading')).items.find((i) => i.attempt_id === t.id);
    assert.ok((await admin.post(`/api/admin/grading/${item.id}`, { score: 5, feedback: 'Nice' })).ok);
    assert.equal((await kid.get(`/api/attempts/${t.id}/report`)).attempt.status, 'graded');
  } else assert.equal(r2.attempt.status, 'graded');
}
assert.ok(svgSeen > 0, 'graph/figure questions were served');
// Admin can try every exam without paying (trial ticket); students still cannot
assert.equal((await new Client().post('/api/attempts', { examType: 'SAT' })).status, 401);
assert.equal((await kid.post('/api/attempts', { examType: 'COGAT' })).status, 402, 'student needs a ticket');
for (const [ex, minOverall] of [['COGAT', 140], ['SAT', 1600], ['TOEFLJ', 900]]) {
  const t = await take(ex, (q) => ({ choice: cheat.get(q.id) }), admin, { SAT: 'sat', TOEFLJ: 'std' }[ex]);
  const r3 = await admin.get(`/api/attempts/${t.id}/report`);
  console.log(ex, '(admin trial) answered', t.n, 'overall', r3.score.overall);
  assert.ok(r3.score.overall >= minOverall, `${ex} perfect admin run`);
}
const adminOv = await admin.get('/api/me/overview'); assert.ok(adminOv.entitlements.some((e) => e.trial), 'trial ticket flagged');
const stuProducts = (await new Client().get('/api/products')).products; assert.ok(!stuProducts.some((p) => p.id === 'p-test'), 'test product hidden from students');
assert.ok((await admin.get('/api/products')).products.some((p) => p.id === 'p-test'), 'test product visible to admin');
// levels: invalid level rejected; level sets the difficulty window and the score scale
assert.equal((await admin.post('/api/attempts', { examType: 'SSAT', level: 'nope' })).status, 400);
for (const [lvl, maxD, perfect] of [['elem', 3, 1800], ['upper', 5, 2400]]) {
  const t = await take('SSAT', (q) => (q.kind === 'text' ? { text: 'An essay.' } : { choice: cheat.get(q.id) }), admin, lvl);
  const rep = await admin.get(`/api/attempts/${t.id}/report`);
  assert.equal(rep.attempt.level.key, lvl); assert.equal(rep.score.overall, perfect, `SSAT ${lvl} perfect total`);
  const ds = rep.items.filter((i) => i.kind === 'mcq').map((i) => i.difficulty);
  if (lvl === 'elem') assert.ok(ds.filter((d) => d > maxD).length <= ds.length * 0.25, 'elementary stays mostly within difficulty 1-3');
  else assert.ok(ds.some((d) => d >= 4), 'upper reaches hard items');
  console.log(`SSAT ${lvl}: difficulties ${[1, 2, 3, 4, 5].map((d) => ds.filter((x) => x === d).length).join('/')} total ${rep.score.overall}`);
}
const exList = await kid.get('/api/exams'); assert.ok(exList.exams.find((e) => e.type === 'SAT').levels.length === 3);
// section navigation: change an answer, clear one, skip some, then submit; submitted sections are locked
{
  const st = await admin.post('/api/attempts', { examType: 'ISEE', level: 'middle' });
  let cur = await admin.get(`/api/attempts/${st.id}/current`); assert.equal(cur.mode, 'section');
  const [q1, q2, q3] = cur.questions;
  await admin.post(`/api/attempts/${st.id}/save`, { questionId: q1.id, choice: (cheat.get(q1.id) + 1) % q1.choices.length });
  await admin.post(`/api/attempts/${st.id}/save`, { questionId: q1.id, choice: cheat.get(q1.id) }); // changed to the right answer
  await admin.post(`/api/attempts/${st.id}/save`, { questionId: q2.id, choice: cheat.get(q2.id) });
  await admin.post(`/api/attempts/${st.id}/save`, { questionId: q2.id, clear: true }); // cleared -> omitted
  await admin.post(`/api/attempts/${st.id}/save`, { questionId: q3.id, choice: cheat.get(q3.id) });
  cur = await admin.get(`/api/attempts/${st.id}/current`); assert.equal(cur.saved[q1.id].choice, cheat.get(q1.id)); assert.ok(!cur.saved[q2.id]);
  const secIdx = cur.section.index; cur = await admin.post(`/api/attempts/${st.id}/submit-section`, { section: secIdx });
  assert.equal(cur.section.index, secIdx + 1);
  assert.equal((await admin.post(`/api/attempts/${st.id}/save`, { questionId: q1.id, choice: 0 })).status, 409, 'submitted section is locked');
  await admin.post(`/api/attempts/${st.id}/finish`);
  const rep = await admin.get(`/api/attempts/${st.id}/report`), v = rep.score.sections.verbal;
  assert.equal(v.correct, 2); assert.equal(v.total, 16, 'unanswered questions count in the section total');
  console.log('navigation: verbal', v.correct, '/', v.total, 'omitted', v.omitted);
}
// SSAT upper: wrong answers cost 1/4, omissions cost nothing
{
  const t = await take('SSAT', (q) => (q.kind === 'text' ? { text: 'Essay.' } : q.section === 'verbal' ? null : { choice: cheat.get(q.id) }), admin, 'upper');
  const rep = await admin.get(`/api/attempts/${t.id}/report`);
  assert.equal(rep.score.sections.verbal.omitted, rep.score.sections.verbal.total); assert.equal(rep.score.sections.verbal.scaled, 500, 'all omitted -> bottom of scale, no negative');
  assert.equal(rep.score.sections.reading.scaled, 800);
}
// public exam guide + free sample (no login) + wrong-answer notebook
const guide = await new Client().get('/api/exam-info'); assert.equal(guide.exams.length, 9); assert.ok(guide.exams.find((e) => e.type === 'SAT').sections.some((x) => x.key === 'math'));
for (const ex of ['MAP', 'CAT4', 'COGAT', 'SAT', 'TOEFLJ', 'WIDA']) {
  const smp = await new Client().get(`/api/sample/${ex}`); assert.equal(smp.questions.length, 5, `${ex} sample size`);
  assert.ok(smp.questions.every((q) => !('answer' in q) && !('explanation' in q) && q.choices.length >= 3), 'sample must not leak answers');
  const g = await new Client().post('/api/sample/grade', { answers: smp.questions.map((q) => ({ id: q.id, choice: cheat.get(q.id) })) });
  assert.equal(g.score, 5, `${ex} sample graded`); assert.ok(g.results.every((x) => typeof x.explanation === 'string'));
}
assert.equal((await new Client().get('/api/sample/NOPE')).status, 404);
const mist = await kid.get('/api/me/mistakes?exam=CAT4'); assert.ok(mist.items.length > 10, 'wrong answers collected'); assert.ok(mist.items.every((i) => i.exam_type === 'CAT4' && i.explanation && i.choices.length >= 3));
assert.equal(new Set(mist.items.map((i) => i.id)).size, mist.items.length, 'one entry per question');
assert.equal((await new Client().get('/api/me/mistakes')).status, 401);
// stranger cannot read someone else's report
const other = new Client(); await other.post('/api/auth/register', { email: `o${stamp}@t.com`, name: 'O', password: 'password123', agree: true });
assert.equal((await other.get(`/api/attempts/${w.id}/report`)).status, 404);
// webhook signature enforced
assert.equal((await kid.post('/api/webhooks/stripe', { id: 'evt_x' })).status, 400);
assert.equal((await kid.post('/api/webhooks/portone', {})).status, 400);
console.log('ALL OK');
