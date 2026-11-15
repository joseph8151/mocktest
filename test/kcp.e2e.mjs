// KCP direct-integration flow against `wrangler dev` with a MOCK KCP server (our own reading of the spec - NOT KCP itself).
// .dev.vars needs: KCP_SITE_CD, KCP_CERT_INFO, KCP_REGISTER_URL/KCP_APPROVE_URL/KCP_CANCEL_URL -> http://localhost:9099/{register,approve,cancel}
import assert from 'node:assert/strict';
import http from 'node:http';
const BASE = process.env.BASE || 'http://localhost:8787';
const registered = new Map(), calls = [];
const mock = http.createServer((req, res) => {
  let body = ''; req.on('data', (d) => (body += d)); req.on('end', () => {
    const j = JSON.parse(body || '{}'); calls.push([req.url, j]); res.setHeader('content-type', 'application/json');
    if (req.url === '/register') { registered.set(j.ordr_idxx, Number(j.good_mny)); return res.end(JSON.stringify({ Code: '0000', approvalKey: 'AK-' + j.ordr_idxx, PayUrl: 'https://pay.example/kcp' })); }
    if (req.url === '/approve') { const amt = registered.get(j.ordr_idxx) + (j.enc_data === 'WRONG' ? 100 : 0); return res.end(JSON.stringify({ res_cd: j.enc_data === 'DECLINED' ? '9999' : '0000', amount: String(amt), tno: 'TNO' + j.ordr_idxx.slice(-6) })); }
    if (req.url === '/cancel') return res.end(JSON.stringify({ res_cd: '0000' }));
    res.statusCode = 404; res.end('{}');
  });
}).listen(9099);
class C { cookie = ''; async req(m, p, b) { const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', cookie: this.cookie }, body: b ? JSON.stringify(b) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) this.cookie = sc.split(';')[0]; return { status: r.status, ...(await r.json().catch(() => ({}))) }; } get = (p) => this.req('GET', p); post = (p, b) => this.req('POST', p, b); }
const admin = new C(); assert.ok((await admin.post('/api/auth/login', { email: process.env.ADMIN_EMAIL || 'admin@example.com', password: 'Mock-test-2026' })).user, 'admin login');
const products = (await admin.get('/api/products')); assert.equal(products.payment.kcp, true, 'kcp enabled');
const ret = (fields) => fetch(BASE + '/api/pay/kcp/return', { method: 'POST', redirect: 'manual', headers: { origin: 'https://pay.example', 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields) });
async function order(method = 'CARD') { const r = await admin.post('/api/pay/kcp/register', { productId: 'p-test', payMethod: method }); assert.ok(r.form, JSON.stringify(r)); return r; }

// 1) happy path
assert.equal((await admin.post('/api/pay/kcp/register', { productId: 'p-test', payMethod: 'VIRTUAL_ACCOUNT' })).status, 400, 'virtual accounts are not offered via KCP direct');
const a = await order('CARD');
assert.equal(a.form.action, 'https://pay.example/kcp'); assert.equal(a.form.fields.good_mny, '1000'); assert.equal(a.form.fields.pay_method, '100000000000'); assert.ok(a.form.fields.Ret_URL.endsWith('/api/pay/kcp/return'));
let r = await ret({ res_cd: '0000', ordr_idxx: a.form.fields.ordr_idxx, tran_cd: '00100000', enc_data: 'OK', enc_info: 'x' });
assert.equal(r.status, 303); assert.match(r.headers.get('location'), /pay\/success\?order=.*provider=kcp/);
assert.equal((await admin.get(`/api/orders/${a.orderId}/status`)).status, 'paid');
await ret({ res_cd: '0000', ordr_idxx: a.form.fields.ordr_idxx, tran_cd: '00100000', enc_data: 'OK', enc_info: 'x' }); // replay
const paid = (await admin.get('/api/orders')).orders.filter((o) => o.id === a.orderId); assert.equal(paid.length, 1);
// 2) wrong amount from KCP -> not granted, auto-cancel attempted
const b = await order(); const before = calls.length;
r = await ret({ res_cd: '0000', ordr_idxx: b.form.fields.ordr_idxx, tran_cd: 'x', enc_data: 'WRONG', enc_info: 'x' });
assert.match(r.headers.get('location'), /pay\/cancel/); assert.equal((await admin.get(`/api/orders/${b.orderId}/status`)).status, 'failed');
assert.ok(calls.slice(before).some(([u]) => u === '/cancel'), 'mismatch was auto-cancelled at KCP');
// 3) declined / buyer cancelled
const c = await order(); r = await ret({ res_cd: '9999', ordr_idxx: c.form.fields.ordr_idxx });
assert.match(r.headers.get('location'), /pay\/cancel/); assert.equal((await admin.get(`/api/orders/${c.orderId}/status`)).status, 'failed');
const d = await order(); await ret({ res_cd: '0000', ordr_idxx: d.form.fields.ordr_idxx, tran_cd: 'x', enc_data: 'DECLINED', enc_info: 'x' });
assert.equal((await admin.get(`/api/orders/${d.orderId}/status`)).status, 'pending', 'approval refused -> not granted');
// 4) unknown order id
assert.match((await ret({ res_cd: '0000', ordr_idxx: 'Knope' })).headers.get('location'), /pay\/cancel/);
// 5) admin refund goes through KCP cancel with the stored tno
const orders = (await admin.get('/api/admin/orders')).orders; assert.ok(orders.find((o) => o.id === a.orderId));
const rf = await admin.post(`/api/admin/orders/${a.orderId}/refund`); assert.ok(rf.ok, JSON.stringify(rf));
assert.ok(calls.some(([u, j]) => u === '/cancel' && /^TNO/.test(j.tno)), 'cancel used stored tno');
const st = await admin.get('/api/admin/payment-status'); assert.equal(st.kcp.configured, true);
console.log('KCP FLOW OK'); mock.close();
