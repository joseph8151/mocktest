// Simulates Stripe webhooks against `wrangler dev` (needs STRIPE_WEBHOOK_SECRET=whsec_test in .dev.vars).
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const BASE = process.env.BASE || 'http://localhost:8787', SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test';
let cookie = '';
const call = async (m, p, b, h = {}) => { const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', cookie, ...h }, body: typeof b === 'string' ? b : b ? JSON.stringify(b) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
const sql = (q) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'mocktest', '--local', '--command', q], { stdio: 'pipe' });
const stamp = Date.now();
const reg = await call('POST', '/api/auth/register', { email: `pay${stamp}@t.com`, name: 'Payer', password: 'password123', agree: true });
const uid = reg.user.id;
const mkOrder = (id, amount) => sql(`INSERT INTO orders (id,user_id,product_id,provider,provider_ref,amount,currency,status,created_at) VALUES ('${id}','${uid}','p-map-1','stripe','cs_${id}',${amount},'USD','pending',${stamp})`);
const event = (evId, orderId, amount) => JSON.stringify({ id: evId, type: 'checkout.session.completed', data: { object: { id: 'cs_' + orderId, payment_status: 'paid', amount_total: amount, metadata: { order_id: orderId } } } });
const send = (raw, sig) => { const t = Math.floor(Date.now() / 1000); return call('POST', '/api/webhooks/stripe', raw, { 'stripe-signature': sig ?? `t=${t},v1=${createHmac('sha256', SECRET).update(`${t}.${raw}`).digest('hex')}` }); };
const ents = async () => (await call('GET', '/api/me/overview')).entitlements.length;

mkOrder('o1' + stamp, 1400); mkOrder('o2' + stamp, 1400);
assert.equal(await ents(), 0);
assert.equal((await send(event('e0' + stamp, 'o1' + stamp, 1400), 't=1,v1=bad')).status, 400, 'forged signature rejected');
assert.equal(await ents(), 0);
assert.ok((await send(event('e1' + stamp, 'o1' + stamp, 1400))).ok); assert.equal(await ents(), 1, 'paid -> entitlement');
const dup = await send(event('e1' + stamp, 'o1' + stamp, 1400)); assert.equal(dup.duplicate, true); assert.equal(await ents(), 1, 'duplicate event ignored');
assert.ok((await send(event('e2' + stamp, 'o1' + stamp, 1400))).ok); assert.equal(await ents(), 1, 'replayed order not double-granted');
assert.ok((await send(event('e3' + stamp, 'o2' + stamp, 1))).ok); assert.equal(await ents(), 1, 'amount mismatch not fulfilled');
const o = await call('GET', '/api/orders'); assert.equal(o.orders.filter((x) => x.status === 'paid').length, 1);
console.log('PAYMENT FLOW OK');
