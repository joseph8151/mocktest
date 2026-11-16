// A student's later attempts avoid questions from earlier attempts while the pool allows.
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
const PW = 'Mock-test-2026', stamp = Date.now();
const admin = new C(); await admin.post('/api/auth/login', { email: process.env.ADMIN_EMAIL || 'admin@example.com', password: PW });
const u = new C(), r = await u.post('/api/auth/register', { email: `rep${stamp}@t.com`, name: 'R', password: PW, agree: true });
for (let i = 0; i < 3; i++) await admin.post(`/api/admin/users/${r.user.id}/grant`, { productId: 'p-krmath-1' }).then((x) => assert.ok(x.ok, JSON.stringify(x)));
for (let i = 0; i < 2; i++) await admin.post(`/api/admin/users/${r.user.id}/grant`, { productId: 'p-map-1' });
async function take(exam, level) {
  const s = await u.post('/api/attempts', { examType: exam, level }); assert.ok(s.id, JSON.stringify(s));
  let cur = await u.get(`/api/attempts/${s.id}/current`); const ids = [];
  while (cur.status === 'in_progress') {
    if (cur.mode === 'section') { for (const q of cur.questions) { ids.push(q.id); await u.post(`/api/attempts/${s.id}/save`, { questionId: q.id, ...(q.kind === 'num' ? { text: '1' } : { choice: 0 }) }); } cur = await u.post(`/api/attempts/${s.id}/submit-section`, { section: cur.section.index }); }
    else { ids.push(cur.question.id); cur = await u.post(`/api/attempts/${s.id}/answer`, { questionId: cur.question.id, choice: 0 }); }
  }
  return ids;
}
const t1 = await take('KR_MATH', 'a8'), t2 = await take('KR_MATH', 'a8');
const overlap = t2.filter((x) => t1.includes(x)).length;
console.log(`KR_MATH a8: test1 ${t1.length}q, test2 ${t2.length}q, repeated ${overlap}`);
assert.equal(overlap, 0, 'second test is all new');
const t3 = await take('KR_MATH', 'a8');
console.log(`third test: ${t3.length}q, repeated from earlier ${t3.filter((x) => t1.includes(x) || t2.includes(x)).length} (pool exhausted -> repeats allowed)`);
assert.equal(t3.length, t1.length, 'still a full test');
const m1 = await take('MAP', 'g5'), m2 = await take('MAP', 'g5');
console.log(`MAP g5 adaptive: ${m1.length}q then ${m2.length}q, repeated ${m2.filter((x) => m1.includes(x)).length}`);
assert.ok(m2.filter((x) => m1.includes(x)).length <= Math.ceil(m2.length * 0.1));
console.log('REPEAT AVOIDANCE OK');
