// 결과지 이메일: permissions and validation (actual delivery needs RESEND_API_KEY, so locally it answers 503).
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
const admin = new C();
assert.ok((await admin.post('/api/auth/login', { email: process.env.ADMIN_EMAIL || 'admin@example.com', password: PW })).user);
const u = new C(), r = await u.post('/api/auth/register', { email: `rm${stamp}@t.com`, name: '이하늘', password: PW, agree: true });
await admin.post(`/api/admin/users/${r.user.id}/grant`, { productId: 'p-cat4-1' });
const att = await u.post('/api/attempts', { examType: 'CAT4' });
assert.ok(att.id);
assert.equal((await u.post(`/api/attempts/${att.id}/email`, { to: 'mom@t.com' })).status, 409, 'not before the exam is finished');
await u.post(`/api/attempts/${att.id}/finish`);
const send = (who, body) => who.post(`/api/attempts/${att.id}/email`, body);
assert.equal((await send(u, { to: '' })).status, 400);
assert.equal((await send(u, { to: 'a@t.com, b@t.com, c@t.com, d@t.com' })).status, 400, 'max 3');
assert.equal((await send(u, { to: 'not-an-email' })).status, 400);
assert.equal((await send(u, { to: 'x@t.com<script>' })).status, 400);
const stranger = new C(); await stranger.post('/api/auth/register', { email: `rs${stamp}@t.com`, name: 'S', password: PW, agree: true });
assert.equal((await send(stranger, { to: 'x@t.com' })).status, 404, 'only people who may view the report');
assert.equal((await send(new C(), { to: 'x@t.com' })).status, 401);
const ok = await send(u, { to: 'mom@t.com, teacher@t.com', message: '이번 결과입니다' });
assert.equal(ok.status, 503, 'no RESEND_API_KEY locally -> clear error'); assert.match(ok.error, /이메일 발송/);
assert.equal((await send(admin, { to: 'x@t.com' })).status, 503, 'admin may send too');
console.log('REPORT EMAIL OK');
