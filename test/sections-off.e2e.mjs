// Default: speaking and essay sections are switched off -> those sections are skipped and results are instant.
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
const admin = new C();
assert.ok((await admin.post('/api/auth/login', { email: process.env.ADMIN_EMAIL || 'admin@example.com', password: 'Mock-test-2026' })).user);
assert.ok((await admin.post('/api/admin/manual-sections', { speaking: false, essay: false })).ok);
const cfg = await (await fetch(BASE + '/api/config', { headers: { cookie: admin.cookie } })).json();
assert.deepEqual(cfg.manual, { speaking: false, essay: false });
const exams = (await admin.get('/api/exams')).exams;
assert.ok(exams.find((e) => e.type === 'WIDA').sections.filter((s) => s.off).length === 2);

async function take(exam, level) { // answer everything shown, return the report and the section keys seen
  const s = await admin.post('/api/attempts', { examType: exam, level });
  assert.ok(s.id, JSON.stringify(s));
  let cur = await admin.get(`/api/attempts/${s.id}/current`); const seen = [];
  while (cur.status === 'in_progress') {
    seen.push(`${cur.section.key}:${cur.section.pos}/${cur.section.count}`);
    for (const q of cur.questions) if (q.kind === 'mcq') await admin.post(`/api/attempts/${s.id}/save`, { questionId: q.id, choice: 0 });
    cur = await admin.post(`/api/attempts/${s.id}/submit-section`, { section: cur.section.index });
  }
  return { rep: await admin.get(`/api/attempts/${s.id}/report`), seen };
}
let t = await take('WIDA');
assert.deepEqual(t.seen, ['listening:1/2', 'reading:2/2']);
assert.equal(t.rep.attempt.status, 'graded', 'no 채점 대기');
assert.ok(!('writing' in t.rep.score.sections) && !('speaking' in t.rep.score.sections));
assert.ok(typeof t.rep.score.composites.overall === 'number', 'overall level from L+R');
t = await take('SSAT', 'middle'); // writing sample was the FIRST section
assert.deepEqual(t.seen.map((x) => x.split(':')[0]), ['quantitative', 'reading', 'verbal']);
assert.equal(t.rep.attempt.status, 'graded'); assert.ok(t.rep.score.overall > 0);
t = await take('ISEE', 'middle');
assert.ok(!t.seen.some((x) => x.startsWith('essay'))); assert.equal(t.rep.attempt.status, 'graded');
t = await take('KR_ENG', 'a10');
assert.deepEqual(t.seen.map((x) => x.split(':')[0]), ['reading', 'vocab', 'grammar']); assert.equal(t.rep.attempt.status, 'graded');
t = await take('KR_KOR', 'a9');
assert.ok(!t.seen.some((x) => x.startsWith('writing'))); assert.equal(t.rep.attempt.status, 'graded');

// speaking on, essays off -> WIDA has listening, reading, speaking
assert.ok((await admin.post('/api/admin/manual-sections', { speaking: true, essay: false })).ok);
const s = await admin.post('/api/attempts', { examType: 'WIDA' });
const st = await admin.get(`/api/attempts/${s.id}/current`);
assert.equal(st.section.count, 3);
await admin.post(`/api/attempts/${s.id}/finish`);
assert.ok((await admin.post('/api/admin/manual-sections', { speaking: false, essay: false })).ok);
assert.equal((await new C().post('/api/admin/manual-sections', { speaking: true })).status, 401);
console.log('SECTIONS OFF OK');
