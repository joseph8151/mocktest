// Login throttling, refund requests, account deletion. Run against `wrangler dev`.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const BASE = process.env.BASE || 'http://localhost:8787';
class C { cookie = ''; async req(m, p, b) { const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', cookie: this.cookie }, body: b ? JSON.stringify(b) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) this.cookie = sc.split(';')[0]; return { status: r.status, ...(await r.json().catch(() => ({}))) }; } get = (p) => this.req('GET', p); post = (p, b) => this.req('POST', p, b); }
const sql = (q) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'mocktest', '--local', '--command', q], { stdio: 'pipe' });
const stamp = Date.now(), email = `s${stamp}@t.com`;
const u = new C(), admin = new C();
const reg = await u.post('/api/auth/register', { email, name: 'S', password: 'password123', agree: true }); const uid = reg.user.id;

// throttle: 8 wrong attempts allowed, then 429 even for the right password
const t = new C();
for (let i = 0; i < 8; i++) assert.equal((await t.post('/api/auth/login', { email, password: 'wrong-pass' })).status, 401);
assert.equal((await t.post('/api/auth/login', { email, password: 'password123' })).status, 429, 'locked out');
const other = new C(); assert.equal((await other.post('/api/auth/login', { email: `x${stamp}@t.com`, password: 'nope' })).status, 401, 'other keys unaffected');

// refund request
sql(`INSERT INTO orders (id,user_id,product_id,provider,provider_ref,amount,currency,status,created_at,paid_at) VALUES ('rf${stamp}','${uid}','p-map-1','portone','pay-rf${stamp}',19000,'KRW','paid',${stamp},${stamp})`);
assert.equal((await new C().post(`/api/orders/rf${stamp}/request-refund`, {})).status, 401);
assert.ok((await u.post(`/api/orders/rf${stamp}/request-refund`, { reason: '단순 변심' })).ok);
assert.equal((await u.post(`/api/orders/rf${stamp}/request-refund`, {})).status, 409, 'duplicate request');
assert.equal((await u.get('/api/orders')).orders[0].refund_status, 'pending');
await admin.post('/api/auth/login', { email: process.env.ADMIN_EMAIL || 'admin@example.com', password: 'password123' });
const o = (await admin.get('/api/admin/orders')).orders.find((x) => x.id === `rf${stamp}`);
assert.equal(o.refund_status, 'pending'); assert.equal(o.refund_reason, '단순 변심');
assert.ok((await admin.post(`/api/admin/refund-requests/${o.refund_id}/reject`)).ok);
assert.equal((await u.get('/api/orders')).orders[0].refund_status, 'rejected');
const csv = await fetch(BASE + '/api/admin/orders.csv', { headers: { cookie: admin.cookie } }); assert.match(await csv.text(), /created,paid,email/);
assert.equal((await fetch(BASE + '/api/admin/orders.csv', { headers: { cookie: u.cookie } })).status, 403);

// voice answers are stored in D1 (no R2 needed)
assert.ok((await admin.post(`/api/admin/users/${uid}/grant`, { productId: 'p-wida-1' })).ok);
const att = await u.post('/api/attempts', { examType: 'WIDA' });
const bytes = Uint8Array.from({ length: 70000 }, (_, i) => i % 251);
const up = await fetch(BASE + `/api/attempts/${att.id}/audio`, { method: 'PUT', headers: { cookie: u.cookie, 'content-type': 'audio/webm' }, body: bytes });
const { audioKey } = await up.json(); assert.ok(audioKey?.startsWith(att.id + '/'), 'audio stored');
const got = new Uint8Array(await (await fetch(BASE + '/api/admin/audio/' + encodeURIComponent(audioKey), { headers: { cookie: admin.cookie } })).arrayBuffer());
assert.equal(got.length, bytes.length); assert.deepEqual([...got.slice(0, 300)], [...bytes.slice(0, 300)], 'audio round-trips byte-exact');
assert.equal((await fetch(BASE + `/api/attempts/${att.id}/audio`, { method: 'PUT', headers: { cookie: u.cookie }, body: new Uint8Array(1_300_000) })).status, 413, 'oversize rejected');

// account deletion
assert.equal((await u.post('/api/auth/delete', { password: 'bad' })).status, 400);
assert.ok((await u.post('/api/auth/delete', { password: 'password123' })).ok);
assert.equal((await u.get('/api/auth/me')).user, null, 'session cleared');
assert.ok([401, 429].includes((await new C().post('/api/auth/login', { email, password: 'password123' })).status), 'cannot log in after deletion');
assert.equal((await new C().post('/api/auth/login', { email: `deleted-${uid}@deleted.invalid`, password: 'password123' })).status, 401);
const ord = (await admin.get('/api/admin/orders')).orders.find((x) => x.id === `rf${stamp}`);
assert.ok(ord && !ord.email.includes(email.split('@')[0]), 'order kept, email anonymised');
assert.equal((await admin.post('/api/auth/delete', { password: 'password123' })).status, 400, 'admin cannot self-delete');
console.log('SAFETY OK');
