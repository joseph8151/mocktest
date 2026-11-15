// PortOne + Stripe flows against `wrangler dev` with a MOCK payment-provider server (our own; not the real PG).
// .dev.vars needs PORTONE_*/STRIPE_* with *_API_BASE=http://localhost:9098 (see README).
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHmac } from 'node:crypto';
const BASE = process.env.BASE || 'http://localhost:8787';
const state = new Map(), calls = []; let failLookups = false, sess = 0;
const mock = http.createServer((req, res) => {
  let body = ''; req.on('data', (d) => (body += d)); req.on('end', () => {
    calls.push(`${req.method} ${req.url}`); res.setHeader('content-type', 'application/json'); const u = req.url;
    if (req.method === 'POST' && u.startsWith('/__set/')) { state.set(decodeURIComponent(u.slice(7)), JSON.parse(body)); return res.end('{}'); }
    if (req.method === 'POST' && u === '/__fail') { failLookups = JSON.parse(body).on; return res.end('{}'); }
    let m;
    if ((m = u.match(/^\/payments\/([^/]+)\/cancel$/))) return res.end('{}');
    if ((m = u.match(/^\/payments\/([^/]+)$/))) { if (failLookups) { res.statusCode = 500; return res.end('{}'); } const s = state.get(decodeURIComponent(m[1])); if (!s) { res.statusCode = 404; return res.end('{}'); } return res.end(JSON.stringify({ currency: 'KRW', ...s, amount: { total: s.total } })); }
    if (u === '/v1/checkout/sessions' && req.method === 'POST') { const id = 'cs_mock_' + ++sess; return res.end(JSON.stringify({ id, url: 'https://stripe.mock/' + id })); }
    if ((m = u.match(/^\/v1\/checkout\/sessions\/([^/]+)$/))) return res.end(JSON.stringify(state.get(m[1]) || { payment_status: 'unpaid', status: 'open' }));
    res.statusCode = 404; res.end('{}');
  });
}).listen(9098);
const set = (k, v) => fetch('http://localhost:9098/__set/' + encodeURIComponent(k), { method: 'POST', body: JSON.stringify(v) });
class C { cookie = ''; async req(m, p, b, h = {}) { const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', cookie: this.cookie, ...h }, body: typeof b === 'string' ? b : b ? JSON.stringify(b) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) this.cookie = sc.split(';')[0]; return { status: r.status, ...(await r.json().catch(() => ({}))) }; } get = (p) => this.req('GET', p); post = (p, b, h) => this.req('POST', p, b, h); }
const u = new C(), stamp = Date.now();
assert.ok((await u.post('/api/auth/register', { email: `pay2${stamp}@t.com`, name: 'P', password: 'Mock-test-2026', agree: true })).user);
const ents = async () => (await u.get('/api/me/overview')).entitlements.length;
const orderStatus = async (id) => (await u.get('/api/orders')).orders.find((o) => o.id === id)?.status ?? (await u.get(`/api/orders/${id}/status`)).status;

// ---- PortOne webhook signing (Standard Webhooks) ----
const PKEY = Buffer.from('dGVzdC13ZWJob29rLWtleS0xMjM0NTY3ODkwMTI=', 'base64');
const pwebhook = (type, paymentId) => { const raw = JSON.stringify({ type, data: { paymentId } }), id = 'msg_' + Math.random(), ts = String(Math.floor(Date.now() / 1000)); const sig = 'v1,' + createHmac('sha256', PKEY).update(`${id}.${ts}.${raw}`).digest('base64'); return u.post('/api/webhooks/portone', raw, { 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': sig }); };

// 1) card: paid -> entitlement
let o = await u.post('/api/pay/portone/prepare', { productId: 'p-map-1' }); assert.equal(o.totalAmount, 45000); assert.equal(o.currency, 'KRW');
await set(o.paymentId, { status: 'PAID', total: 45000 });
let r = await u.post('/api/pay/portone/complete', { orderId: o.orderId }); assert.ok(r.ok, JSON.stringify(r)); assert.equal(await ents(), 1);
assert.ok((await u.post('/api/pay/portone/complete', { orderId: o.orderId })).ok); assert.equal(await ents(), 1, 'complete is idempotent');

// 2) virtual account: issued -> awaiting deposit -> deposit webhook grants
o = await u.post('/api/pay/portone/prepare', { productId: 'p-cat4-1' });
await set(o.paymentId, { status: 'VIRTUAL_ACCOUNT_ISSUED', total: 45000, method: { bank: 'KOOKMIN', accountNumber: '123-456', remitteeName: 'MockTest', expiredAt: new Date(Date.now() + 72 * 3600e3).toISOString() } });
r = await u.post('/api/pay/portone/complete', { orderId: o.orderId }); assert.equal(r.status, 200); assert.equal(r.pending, true); assert.equal(r.account.number, '123-456');
assert.equal(await orderStatus(o.orderId), 'awaiting_deposit'); assert.equal(await ents(), 1, 'no ticket before the deposit');
assert.equal((await u.post(`/api/orders/${o.orderId}/recheck`)).status, 'awaiting_deposit');
await set(o.paymentId, { status: 'PAID', total: 45000 });
assert.equal((await pwebhook('Transaction.Paid', o.paymentId)).status, 200); assert.equal(await orderStatus(o.orderId), 'paid'); assert.equal(await ents(), 2, 'deposit webhook granted the ticket');
assert.equal((await new C().post('/api/webhooks/portone', '{}', { 'webhook-id': 'x', 'webhook-timestamp': '1', 'webhook-signature': 'v1,AAAA' })).status, 400, 'forged webhook rejected');

// 3) tampered / wrong amount: refused AND cancelled at the PG
o = await u.post('/api/pay/portone/prepare', { productId: 'p-map-3' }); await set(o.paymentId, { status: 'PAID', total: 1000 });
r = await u.post('/api/pay/portone/complete', { orderId: o.orderId }); assert.equal(r.status, 400); assert.equal(await orderStatus(o.orderId), 'failed');
assert.ok(calls.some((c) => c === `POST /payments/${encodeURIComponent(o.paymentId)}/cancel`), 'underpaid payment was cancelled at PortOne'); assert.equal(await ents(), 2);

// 4) PG outage during the paid webhook -> 503 so PortOne retries; recheck recovers
o = await u.post('/api/pay/portone/prepare', { productId: 'p-scat-1' }); await set(o.paymentId, { status: 'PAID', total: 39000 });
await fetch('http://localhost:9098/__fail', { method: 'POST', body: '{"on":true}' });
assert.equal((await pwebhook('Transaction.Paid', o.paymentId)).status, 503, 'asks for a retry');
await fetch('http://localhost:9098/__fail', { method: 'POST', body: '{"on":false}' });
assert.equal((await pwebhook('Transaction.Paid', o.paymentId)).status, 200); assert.equal(await orderStatus(o.orderId), 'paid');

// 5) another user cannot confirm / re-check someone else's order
const other = new C(); await other.post('/api/auth/register', { email: `pay3${stamp}@t.com`, name: 'O', password: 'Mock-test-2026', agree: true });
assert.equal((await other.post('/api/pay/portone/complete', { orderId: o.orderId })).status, 404); assert.equal((await other.post(`/api/orders/${o.orderId}/recheck`)).status, 404);

// ---- Stripe ----
const SSECRET = 'whsec_test';
const stripeEvent = (id, type, obj) => { const raw = JSON.stringify({ id, type, data: { object: obj } }), t = Math.floor(Date.now() / 1000); return u.post('/api/webhooks/stripe', raw, { 'stripe-signature': `t=${t},v1=${createHmac('sha256', SSECRET).update(`${t}.${raw}`).digest('hex')}` }); };
let st = await u.post('/api/pay/stripe/checkout', { productId: 'p-map-1' }); assert.match(st.url, /stripe\.mock/);
const sOrder = (await u.get('/api/orders')).orders.find((x) => x.provider === 'stripe' && x.status === 'pending'); assert.ok(sOrder, 'pending order visible to its owner'); assert.equal(sOrder.amount, 3500); assert.equal(sOrder.currency, 'USD');
const before = await ents();
assert.equal((await stripeEvent('evt_a' + stamp, 'checkout.session.completed', { id: 'cs_mock_1', payment_status: 'paid', amount_total: 3500, metadata: { order_id: sOrder.id } })).status, 200);
assert.equal(await ents(), before + 1); assert.ok((await stripeEvent('evt_a' + stamp, 'checkout.session.completed', { id: 'cs_mock_1', payment_status: 'paid', amount_total: 3500, metadata: { order_id: sOrder.id } })).duplicate); assert.equal(await ents(), before + 1);
// webhook lost -> recheck asks Stripe and grants
st = await u.post('/api/pay/stripe/checkout', { productId: 'p-cat4-1' }); const s2 = (await u.get('/api/orders')).orders.find((x) => x.provider === 'stripe' && x.status === 'pending');
await set('cs_mock_2', { payment_status: 'paid', amount_total: 3500, status: 'complete' });
assert.equal((await u.post(`/api/orders/${s2.id}/recheck`)).status, 'paid'); assert.equal(await ents(), before + 2);
// expired session -> failed
await u.post('/api/pay/stripe/checkout', { productId: 'p-scat-1' }); const s3 = (await u.get('/api/orders')).orders.find((x) => x.provider === 'stripe' && x.status === 'pending');
await stripeEvent('evt_e' + stamp, 'checkout.session.expired', { id: 'cs_mock_3', metadata: { order_id: s3.id } }); assert.equal((await u.get(`/api/orders/${s3.id}/status`)).status, 'failed');
// mismatching Stripe amount is never granted
await u.post('/api/pay/stripe/checkout', { productId: 'p-ssat-1' }); const s4 = (await u.get('/api/orders')).orders.find((x) => x.provider === 'stripe' && x.status === 'pending');
await stripeEvent('evt_m' + stamp, 'checkout.session.completed', { id: 'cs_mock_4', payment_status: 'paid', amount_total: 100, metadata: { order_id: s4.id } }); assert.equal(await ents(), before + 2);
console.log('PAY FLOWS OK'); mock.close();
