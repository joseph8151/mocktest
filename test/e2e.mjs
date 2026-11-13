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
assert.equal((await kid.post('/api/pay/stripe/checkout', { productId: 'p-map-1' })).status, 503, 'stripe unconfigured');

const kidId = r.user.id;
assert.ok((await admin.post(`/api/admin/users/${kidId}/grant`, { productId: 'p-cat4-1' })).ok);
assert.ok((await admin.post(`/api/admin/users/${kidId}/grant`, { productId: 'p-wida-1' })).ok);
assert.ok((await admin.post(`/api/admin/users/${kidId}/grant`, { productId: 'p-map-1' })).ok);

async function take(examType, answerFor) {
  const s = await kid.post('/api/attempts', { examType });
  assert.ok(s.id, JSON.stringify(s));
  let cur = await kid.get(`/api/attempts/${s.id}/current`), n = 0;
  const seen = new Set();
  while (cur.status === 'in_progress') {
    assert.ok(!('answer' in cur.question) && !('explanation' in cur.question), 'answers must not leak');
    assert.ok(!seen.has(cur.question.id), 'no repeated question'); seen.add(cur.question.id);
    cur = await kid.post(`/api/attempts/${s.id}/answer`, { questionId: cur.question.id, ...answerFor(cur.question) }); n++;
  }
  return { id: s.id, n };
}
// "cheat" by reading answers from admin API so we can verify scoring
const key = async (id) => (await admin.get(`/api/admin/questions/${id}`)).answer;
const cheat = new Map();
const qs = (await Promise.all(['MAP', 'CAT4', 'WIDA', 'SCAT', 'SSAT', 'ISEE'].map((e) => admin.get(`/api/admin/questions?exam=${e}`)))).flatMap((r) => r.questions);
for (const q of qs) if (q.kind === 'mcq') cheat.set(q.id, await key(q.id));

for (const ex of ['CAT4', 'MAP']) {
  const { id, n } = await take(ex, () => ({ choice: 0 }));
  const rep = await kid.get(`/api/attempts/${id}/report`);
  console.log(ex, 'answered', n, 'overall', rep.score.overall, Object.values(rep.score.sections).map((s) => `${s.name}:${s.correct}/${s.total}`).join(' '));
  assert.ok(rep.score.overall);
}
// perfect run on a second CAT4 attempt is impossible (1 attempt) -> grant again
await admin.post(`/api/admin/users/${kidId}/grant`, { productId: 'p-cat4-1' });
// resume check
const s2 = await kid.post('/api/attempts', { examType: 'CAT4' });
const first = await kid.get(`/api/attempts/${s2.id}/current`);
const again = await kid.post('/api/attempts', { examType: 'CAT4' });
assert.equal(again.resumed, true); assert.equal(again.id, s2.id);
let cur = first;
while (cur.status === 'in_progress') cur = await kid.post(`/api/attempts/${s2.id}/answer`, { questionId: cur.question.id, choice: cheat.get(cur.question.id) });
const perfect = await kid.get(`/api/attempts/${s2.id}/report`);
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
// stranger cannot read someone else's report
const other = new Client(); await other.post('/api/auth/register', { email: `o${stamp}@t.com`, name: 'O', password: 'password123', agree: true });
assert.equal((await other.get(`/api/attempts/${w.id}/report`)).status, 404);
// webhook signature enforced
assert.equal((await kid.post('/api/webhooks/stripe', { id: 'evt_x' })).status, 400);
assert.equal((await kid.post('/api/webhooks/portone', {})).status, 400);
console.log('ALL OK');
