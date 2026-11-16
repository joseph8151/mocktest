// 무통장입금: account setup, order + account details, validation, cancel, open-order limit, admin deposit confirm,
// expiry, refund without PG. Run against `npm run dev` after e2e.mjs (admin exists).
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
const u = new C();
const reg = await u.post('/api/auth/register', { email: `bank${stamp}@t.com`, name: '홍길동', password: PW, agree: true });
assert.ok(reg.user);
await admin.post(`/api/admin/users/${reg.user.id}/verify-email`);

// off until an account is set
assert.ok((await admin.post('/api/admin/bank-account', { account: '' })).ok);
assert.equal((await u.get('/api/products')).payment.bank, false);
assert.equal((await u.post('/api/pay/bank/order', { productId: 'p-cat4-1', depositor: '홍길동' })).status, 503);
assert.equal((await admin.post('/api/admin/bank-account', { bank: '국민은행', account: '123', holder: 'x' })).status, 400);
assert.ok((await admin.post('/api/admin/bank-account', { bank: '국민은행', account: '123-456-789012', holder: '목테스트랩' })).ok);
assert.equal((await u.get('/api/products')).payment.bank, true);
assert.equal((await admin.get('/api/admin/payment-status')).bank.holder, '목테스트랩');

// validation
assert.equal((await u.post('/api/pay/bank/order', { productId: 'p-cat4-1', depositor: '' })).status, 400);
assert.equal((await u.post('/api/pay/bank/order', { productId: 'p-cat4-1', depositor: '홍길동', cashReceipt: { type: 'personal', number: '123' } })).status, 400);
assert.equal((await u.post('/api/pay/bank/order', { productId: 'nope', depositor: '홍길동' })).status, 404);

// order -> account details
const o = await u.post('/api/pay/bank/order', { productId: 'p-cat4-1', depositor: '홍길동<script>', cashReceipt: { type: 'personal', number: '010-1234-5678' } });
assert.ok(o.orderId, JSON.stringify(o));
assert.equal(o.status, 'awaiting_deposit'); assert.equal(o.account.account, '123-456-789012'); assert.equal(o.depositor, '홍길동script');
assert.deepEqual(o.cashReceipt, { type: 'personal', number: '01012345678' });
assert.ok(o.amount > 30000 && o.expiresAt > Date.now() + 2 * 86400000);
const view = await u.get(`/api/pay/bank/${o.orderId}`);
assert.equal(view.amount, o.amount);
assert.equal((await new C().get(`/api/pay/bank/${o.orderId}`)).status, 401);
const other = new C(); await other.post('/api/auth/register', { email: `bank2${stamp}@t.com`, name: 'O', password: PW, agree: true });
assert.equal((await other.get(`/api/pay/bank/${o.orderId}`)).status, 404, 'someone else cannot see the order');
assert.equal((await other.post(`/api/pay/bank/${o.orderId}/cancel`)).status, 400);
let mine = (await u.get('/api/orders')).orders.find((x) => x.id === o.orderId);
assert.equal(mine.status, 'awaiting_deposit'); assert.equal(mine.provider, 'bank');
assert.ok((await admin.get('/api/admin/stats')).awaitingDeposit >= 1);
assert.equal(((await u.get('/api/entitlements').catch(() => ({}))).entitlements || []).length, 0);

// cancel, limit of 3 open orders
const o2 = await u.post('/api/pay/bank/order', { productId: 'p-cat4-1', depositor: '홍길동' });
assert.ok((await u.post(`/api/pay/bank/${o2.orderId}/cancel`)).ok);
assert.equal((await u.get(`/api/pay/bank/${o2.orderId}`)).status, 'failed');
await u.post('/api/pay/bank/order', { productId: 'p-cat4-1', depositor: '홍길동' });
await u.post('/api/pay/bank/order', { productId: 'p-cat4-1', depositor: '홍길동' });
assert.equal((await u.post('/api/pay/bank/order', { productId: 'p-cat4-1', depositor: '홍길동' })).status, 409);

// admin confirms the deposit -> ticket
assert.ok((await admin.post(`/api/admin/orders/${o.orderId}/mark-paid`, {})).ok);
assert.equal((await u.get(`/api/pay/bank/${o.orderId}`)).status, 'paid');
const att = await u.post('/api/attempts', { examType: 'CAT4' });
assert.ok(att.id, 'ticket works: ' + JSON.stringify(att));
await u.post(`/api/attempts/${att.id}/finish`);

// refund: needs the manual transfer confirmation
assert.equal((await admin.post(`/api/admin/orders/${o.orderId}/refund`, {})).status, 400);
assert.ok((await admin.post(`/api/admin/orders/${o.orderId}/refund`, { transferred: true })).ok);
assert.equal((await u.get(`/api/pay/bank/${o.orderId}`)).status, 'refunded');

assert.ok((await admin.post('/api/admin/bank-account', { account: '' })).ok); // leave it off for other tests
console.log('BANK TRANSFER OK');
