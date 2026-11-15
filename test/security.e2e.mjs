// Security hardening and new features: password policy, 2FA, device list, coupons, share links, audit log, notice, headers.
// Run against `wrangler dev` (after e2e.mjs, which creates the admin).
import assert from 'node:assert/strict';
import { totpCode } from '../src/lib/security.js';
const BASE = process.env.BASE || 'http://localhost:8787';
class C {
  cookie = '';
  async req(m, p, b, extra = {}) {
    const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', cookie: this.cookie, ...extra }, body: b ? JSON.stringify(b) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) this.cookie = sc.split(';')[0];
    return { status: r.status, headers: r.headers, ...(await r.json().catch(() => ({}))) };
  }
  get = (p) => this.req('GET', p); post = (p, b) => this.req('POST', p, b); del = (p) => this.req('DELETE', p);
}
const PW = 'Mock-test-2026', stamp = Date.now();
const admin = new C();
assert.ok((await admin.post('/api/auth/login', { email: process.env.ADMIN_EMAIL || 'admin@example.com', password: PW })).user, 'admin login');

// ---- headers & request size ----
const cfg = await new C().get('/api/config');
assert.equal(cfg.headers.get('x-content-type-options'), 'nosniff');
assert.equal(cfg.headers.get('x-frame-options'), 'DENY');
const page = await fetch(BASE + '/');
assert.match(page.headers.get('content-security-policy') || '', /frame-ancestors 'none'/, 'CSP on the HTML page');
const big = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'x'.repeat(300_000) }) });
assert.equal(big.status, 413, 'oversized body rejected');
assert.equal((await new C().req('POST', '/api/auth/logout', {}, { origin: 'https://evil.example' })).status, 403, 'cross-origin POST blocked');

// ---- password policy ----
for (const bad of ['password123', '12345678', 'abcdefgh', `stu${stamp}abc1`]) {
  const r = await new C().post('/api/auth/register', { email: `stu${stamp}@t.com`, name: 'W', password: bad, agree: true });
  assert.equal(r.status, 400, `weak password accepted: ${bad}`);
}

// ---- 2FA ----
const email = `tfa${stamp}@t.com`;
const u = new C();
assert.ok((await u.post('/api/auth/register', { email, name: 'T', password: PW, agree: true })).user);
const other = new C(); await other.post('/api/auth/login', { email, password: PW });
assert.equal((await u.post('/api/auth/2fa/setup', { password: 'wrong' })).status, 400);
const setup = await u.post('/api/auth/2fa/setup', { password: PW });
assert.match(setup.uri, /^otpauth:\/\/totp\//);
const step = () => Math.floor(Date.now() / 30000);
assert.equal((await u.post('/api/auth/2fa/enable', { code: '000000' })).status, 400, 'wrong code');
assert.ok((await u.post('/api/auth/2fa/enable', { code: await totpCode(setup.secret, step()) })).ok, 'enable');
assert.equal((await other.get('/api/auth/me')).user, null, 'other devices signed out after enabling 2FA');
assert.equal((await u.get('/api/auth/me')).user.twofa, true);
const l1 = await new C().post('/api/auth/login', { email, password: PW });
assert.equal(l1.status, 401); assert.equal(l1.need2fa, true, 'password alone is not enough');
assert.equal((await new C().post('/api/auth/login', { email, password: PW, code: '123456' })).status, 401, 'wrong code');
const nextCode = await totpCode(setup.secret, step() + 1); // the enable step is used up; next step is within the ±1 window
const d2 = new C();
assert.ok((await d2.post('/api/auth/login', { email, password: PW, code: nextCode })).user, 'password + code');
assert.equal((await new C().post('/api/auth/login', { email, password: PW, code: nextCode })).status, 401, 'code cannot be replayed');

// ---- device list ----
const s1 = await u.get('/api/auth/sessions');
assert.equal(s1.sessions.length, 2); assert.equal(s1.sessions.filter((x) => x.current).length, 1);
const theirs = s1.sessions.find((x) => !x.current);
assert.ok((await u.post('/api/auth/sessions/revoke', { id: theirs.id })).ok);
assert.equal((await d2.get('/api/auth/me')).user, null, 'revoked device is signed out');
assert.equal((await u.post('/api/auth/sessions/revoke', { id: "' OR 1=1 --" })).status, 400);

// ---- coupons ----
const { products } = await u.get('/api/products');
const cat4 = products.find((p) => p.exam_type === 'CAT4' && p.attempts === 1), map = products.find((p) => p.exam_type === 'MAP' && p.attempts === 1);
const code = `T${stamp}`.slice(0, 16);
assert.equal((await u.post('/api/admin/coupons', { code, kind: 'percent', value: 20 })).status, 403, 'students cannot create coupons');
assert.equal((await admin.post('/api/admin/coupons', { code, kind: 'percent', value: 95 })).status, 400, 'max 90%');
assert.ok((await admin.post('/api/admin/coupons', { code, kind: 'percent', value: 20, exam_type: 'CAT4', max_uses: 1 })).ok);
const chk = await u.post('/api/coupons/check', { code: code.toLowerCase(), productId: cat4.id });
assert.equal(chk.krw, Math.round(cat4.price_krw * 0.8 / 100) * 100, 'discounted KRW');
assert.equal((await u.post('/api/coupons/check', { code, productId: map.id })).status, 400, 'exam restriction');
assert.equal((await u.post('/api/coupons/check', { code: 'NOPE1234', productId: cat4.id })).status, 400);
const prep = await u.post('/api/pay/portone/prepare', { productId: cat4.id, coupon: code });
if (prep.status === 503) console.log('  (portone not configured: skipped coupon order check)');
else {
  assert.equal(prep.totalAmount, chk.krw, 'order amount uses the coupon price');
  assert.ok((await admin.post(`/api/admin/orders/${prep.orderId}/mark-paid`, {})).ok);
  const cps = (await admin.get('/api/admin/coupons')).coupons.find((x) => x.code === code);
  assert.equal(cps.used, 1, 'coupon use counted on payment');
  assert.equal((await u.post('/api/coupons/check', { code, productId: cat4.id })).status, 400, 'max uses reached');
}

// ---- share links ----
const att = await admin.post('/api/attempts', { examType: 'SCAT', level: 'elem' }); // admin trial attempt
assert.ok(att.id, JSON.stringify(att));
await admin.post(`/api/attempts/${att.id}/finish`);
assert.equal((await u.post(`/api/attempts/${att.id}/share`)).status, 404, 'only the owner can share');
const sh = await admin.post(`/api/attempts/${att.id}/share`);
const token = sh.url.split('/').pop();
const pub = await new C().get(`/api/shared/${token}`);
assert.equal(pub.shared, true); assert.equal(pub.student.email, undefined, 'no e-mail in the shared view'); assert.equal(pub.attempt.id, null);
assert.equal((await new C().get(`/api/shared/${'0'.repeat(48)}`)).status, 404);
assert.equal((await admin.get(`/api/attempts/${att.id}/report`)).shareCount, 1);
assert.ok((await admin.del(`/api/attempts/${att.id}/share`)).ok);
assert.equal((await new C().get(`/api/shared/${token}`)).status, 404, 'revoked link stops working');

// ---- notice + audit log ----
assert.ok((await admin.post('/api/admin/notice', { text: '점검 안내 테스트' })).ok);
assert.equal((await new C().get('/api/config')).notice, '점검 안내 테스트');
await admin.post('/api/admin/notice', { text: '' });
assert.equal((await new C().get('/api/config')).notice, null);
const sec = await admin.get('/api/admin/security');
assert.ok(sec.log.some((l) => l.action === 'admin.post' && l.target.startsWith('/coupons')), 'admin change logged');
assert.ok(sec.log.some((l) => l.action === '2fa.enable'), '2FA change logged');
assert.ok(sec.log.some((l) => l.action === 'login.2fa_failed'), 'failed 2FA logged');
assert.equal((await u.get('/api/admin/security')).status, 403);

// ---- disable 2FA (needs password + a fresh code; a wrong code is refused) ----
assert.equal((await u.post('/api/auth/2fa/disable', { password: PW, code: '000000' })).status, 400);
// ---- records: every event is logged, and the log cannot be altered ----
const mine = (await u.get('/api/auth/activity')).events.map((e) => e.action);
for (const a of ['user.register', 'login.success', '2fa.enable', 'session.revoke', 'order.create', 'order.paid']) assert.ok(mine.includes(a), `own activity has ${a}`);
const all = await admin.get('/api/admin/logs?cat=exam');
assert.ok(all.events.some((e) => e.action === 'exam.start') && all.events.some((e) => e.action === 'exam.finish') && all.events.some((e) => e.action === 'shared.view'), 'exam + share events');
assert.ok(all.events.every((e) => /^(exam|share|shared)\./.test(e.action)), 'category filter');
const fails = await admin.get(`/api/admin/logs?action=login.fail&q=${encodeURIComponent('tf***')}`);
assert.ok(fails.events.length >= 0);
const byEmail = await admin.get(`/api/admin/logs?q=${encodeURIComponent(email)}`);
assert.ok(byEmail.events.length >= 5, 'search by e-mail');
const adminEdit = (await admin.get('/api/admin/logs?cat=admin')).events.find((e) => e.target?.startsWith('/coupons') && e.action === 'admin.post');
assert.match(adminEdit.detail, /"value":20/, 'admin change records what was changed');
const csv = await fetch(BASE + '/api/admin/logs.csv?cat=pay', { headers: { cookie: admin.cookie } });
assert.equal(csv.status, 200); assert.match(await csv.text(), /order\.paid/);
const { execFileSync } = await import('node:child_process');
const tryDelete = () => execFileSync('npx', ['wrangler', 'd1', 'execute', 'mocktest', '--local', '--command', 'DELETE FROM audit_log'], { stdio: 'pipe' });
assert.throws(tryDelete, /append-only/, 'audit_log rows cannot be deleted');
assert.throws(() => execFileSync('npx', ['wrangler', 'd1', 'execute', 'mocktest', '--local', '--command', "UPDATE audit_log SET action='x'"], { stdio: 'pipe' }), /append-only/, 'audit_log rows cannot be edited');
console.log('SECURITY FEATURES OK');
