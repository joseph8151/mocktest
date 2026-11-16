// Operator alerts (Formspree) for new members and 무통장입금 orders; promo popup settings.
// Needs FORMSPREE_URL=http://localhost:9095/f/test in .dev.vars.
import assert from 'node:assert/strict';
import http from 'node:http';
const BASE = process.env.BASE || 'http://localhost:8787';
const got = [];
const mock = http.createServer((req, res) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => { got.push({ path: req.url, accept: req.headers.accept, body: JSON.parse(b || '{}') }); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); }); }).listen(9095);
class C {
  cookie = '';
  async req(m, p, b) {
    const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', cookie: this.cookie }, body: b ? JSON.stringify(b) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) { const v = sc.split(';')[0]; this.cookie = v.endsWith('=') ? '' : v; }
    return { status: r.status, ...(await r.json().catch(() => ({}))) };
  }
  get = (p) => this.req('GET', p); post = (p, b) => this.req('POST', p, b);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wait = async (pred) => { for (let i = 0; i < 40; i++) { const x = got.find(pred); if (x) return x; await sleep(100); } throw new Error('no alert: ' + JSON.stringify(got)); };
const PW = 'Mock-test-2026', stamp = Date.now();
const admin = new C();
assert.ok((await admin.post('/api/auth/login', { email: process.env.ADMIN_EMAIL || 'admin@example.com', password: PW })).user);

// signup alert
const u = new C(), email = `ops${stamp}@t.com`;
const r = await u.post('/api/auth/register', { email, name: '박서준', password: PW, agree: true, grade: '초4' });
assert.ok(r.user);
const a1 = await wait((x) => x.body.알림 === '새 회원가입' && x.body.이름 === '박서준' && x.body.이메일?.endsWith('@t.com'));
assert.ok(!a1.body.이메일.includes(`ops${stamp}`), 'email masked in alerts'); assert.equal(a1.body.연락처, undefined, 'no phone in alerts');
assert.equal(a1.path, '/f/test'); assert.equal(a1.accept, 'application/json');
assert.equal(a1.body.알림, '새 회원가입'); assert.equal(a1.body.이름, '박서준'); assert.equal(a1.body.학년, '초4'); assert.match(a1.body._subject, /새 회원가입/);

// popup: default only once a bank account exists
assert.ok((await admin.post('/api/admin/bank-account', { account: '' })).ok);
await admin.post('/api/admin/popup', { reset: true });
assert.equal((await admin.get('/api/admin/popup')).popup.default, true);
const fresh = async () => (await (await fetch(BASE + '/api/config', { headers: { cookie: u.cookie } })).json()).popup; // with a session: not edge-cached
assert.equal(await fresh(), null, 'no bank account -> no default popup');
assert.ok((await admin.post('/api/admin/bank-account', { bank: '신한은행', account: '110-123-456789', holder: '목테스트랩' })).ok);
assert.match((await fresh()).body, /30분~1시간/);

// bank order alert
await admin.post(`/api/admin/users/${r.user.id}/verify-email`);
const o = await u.post('/api/pay/bank/order', { productId: 'p-cat4-1', depositor: '박서준' });
assert.ok(o.orderId, JSON.stringify(o));
const a2 = await wait((x) => /무통장입금 주문/.test(x.body.알림 || ''));
assert.equal(a2.body.입금자명, '박서준'); assert.match(a2.body.금액, /원$/); assert.ok(!a2.body.회원.includes(email), 'member email masked');
await u.post(`/api/pay/bank/${o.orderId}/cancel`);

// admin edits the popup; off -> nothing
assert.ok((await admin.post('/api/admin/popup', { on: true, title: '오픈 이벤트', body: '첫 주 10% 할인' })).ok);
assert.equal((await fresh()).title, '오픈 이벤트');
assert.ok((await admin.post('/api/admin/popup', { on: false, title: 'x', body: 'y' })).ok);
assert.equal(await fresh(), null);
assert.equal((await u.post('/api/admin/popup', { on: true })).status, 403);
// restore: default popup, no bank account (other tests expect bank off)
assert.equal((await admin.post('/api/admin/popup', { reset: true })).popup.default, true);
assert.ok((await admin.post('/api/admin/bank-account', { account: '' })).ok);
mock.close();
console.log('OPS ALERTS + POPUP OK');
