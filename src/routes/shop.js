import { Hono } from 'hono';
import { uid, now } from '../lib/util.js';
import { requireUser, loadUser, accountGate } from '../lib/auth.js';
import { rateLimited, tooMany, audit } from '../lib/security.js';
import { kcpEnabled, kcpRegister, kcpForm, kcpApprove, kcpCancel, kcpOrderId } from '../lib/kcp.js';
import {
  fulfillOrder, stripeCreateCheckout, stripeVerify, stripeRetrieveSession,
  portoneVerifyAndFulfill, portoneGetPayment, portoneVerifyWebhook, recheckOrder, failOrder,
} from '../lib/payments.js';

const app = new Hono();

app.get('/config', async (c) => c.json({
  site: c.env.SITE_NAME,
  turnstile: c.env.TURNSTILE_SITE_KEY && c.env.TURNSTILE_SECRET ? c.env.TURNSTILE_SITE_KEY : null,
  kakao: !!c.env.KAKAO_REST_KEY,
  notice: (await c.env.DB.prepare(`SELECT value FROM settings WHERE key='notice'`).first())?.value || null,
  biz: { name: c.env.BIZ_NAME || '(상호명 입력)', owner: c.env.BIZ_OWNER || '(대표자명)', regNo: c.env.BIZ_REG_NO || '(사업자등록번호)', salesNo: c.env.BIZ_SALES_NO || '(통신판매업 신고번호)', address: c.env.BIZ_ADDRESS || '(사업장 주소)', contact: c.env.BIZ_CONTACT || '(고객센터 이메일/전화)' },
}));

app.get('/products', async (c) => {
  const admin = (await loadUser(c))?.role === 'admin'; // the 1,000-won payment test product is only visible to admins
  const { results } = await c.env.DB.prepare(`SELECT * FROM products WHERE active=1 OR (?1 AND id='p-test') ORDER BY sort,price_krw`).bind(admin ? 1 : 0).all();
  // never sell an exam that has no questions yet (e.g. a new category whose bank is still being reviewed)
  const ready = new Set((await c.env.DB.prepare(`SELECT exam_type FROM questions WHERE active=1 GROUP BY exam_type HAVING COUNT(*) >= 20`).all()).results.map((r) => r.exam_type));
  return c.json({
    products: results.filter((p) => p.id === 'p-test' || ready.has(p.exam_type)),
    payment: { kcp: kcpEnabled(c.env), stripe: !!c.env.STRIPE_SECRET_KEY, portone: !!(c.env.PORTONE_STORE_ID && c.env.PORTONE_CHANNEL_KEY),
      portoneStoreId: c.env.PORTONE_STORE_ID || null, portoneChannelKey: c.env.PORTONE_CHANNEL_KEY || null },
  });
});

/** Look up a coupon and work out the discounted prices for one product. Returns { error } or { coupon, krw, usd }. */
export async function applyCoupon(env, code, product) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return { krw: product.price_krw, usd: product.price_usd_cents, coupon: null };
  const cp = await env.DB.prepare('SELECT * FROM coupons WHERE code=? AND active=1').bind(code).first();
  if (!cp || (cp.expires_at && cp.expires_at < now()) || (cp.max_uses != null && cp.used >= cp.max_uses)) return { error: '사용할 수 없는 쿠폰입니다.' };
  if (cp.exam_type && cp.exam_type !== product.exam_type) return { error: `이 쿠폰은 ${cp.exam_type} 상품에만 쓸 수 있습니다.` };
  if (product.id === 'p-test') return { error: '테스트 상품에는 쿠폰을 쓸 수 없습니다.' };
  const ratio = cp.kind === 'percent' ? Math.min(90, Math.max(1, cp.value)) / 100 : Math.min(0.9, cp.value / product.price_krw);
  // Never below the PG minimums (KRW 1,000 / USD 1.00).
  const krw = Math.max(1000, Math.round((product.price_krw * (1 - ratio)) / 100) * 100);
  const usd = Math.max(100, Math.round(product.price_usd_cents * (1 - ratio)));
  return { coupon: cp.code, krw, usd, label: cp.kind === 'percent' ? `${cp.value}% 할인` : `${cp.value.toLocaleString()}원 할인` };
}

async function newOrder(c, productId, provider, couponCode, gift = false) {
  const user = c.get('user');
  if (await rateLimited(c.env, `checkout|${user.id}`, 30, 600000)) return { limited: true };
  const gate = accountGate(c.env, user); if (gate) return { gate };
  const product = await c.env.DB.prepare(`SELECT * FROM products WHERE id=?1 AND (active=1 OR (?2 AND id='p-test'))`).bind(productId, user.role === 'admin' ? 1 : 0).first();
  if (!product) return {};
  const price = await applyCoupon(c.env, couponCode, product);
  if (price.error) return { couponError: price.error };
  const currency = provider === 'stripe' ? 'USD' : 'KRW';
  const amount = provider === 'stripe' ? price.usd : price.krw;
  const list = provider === 'stripe' ? product.price_usd_cents : product.price_krw;
  const order = { id: uid(), user_id: user.id, product_id: product.id, provider, amount, currency, created_at: now(), coupon: price.coupon, list_amount: list, gift: gift && product.id !== 'p-test' ? 1 : 0 };
  return { user, product, order };
}
const orderProblem = (c, r) => r.limited ? tooMany(c) : r.gate ? c.json(r.gate, 403) : r.couponError ? c.json({ error: r.couponError }, 400) : !r.product ? c.json({ error: '상품을 찾을 수 없습니다.' }, 404) : null;
const insertOrder = (c, order, providerRef) => ({
  run: async () => {
    await c.env.DB.prepare(
      `INSERT INTO orders (id,user_id,product_id,provider,provider_ref,amount,currency,status,created_at,coupon,list_amount,gift) VALUES (?,?,?,?,?,?,?,'pending',?,?,?,?)`
    ).bind(order.id, order.user_id, order.product_id, order.provider, providerRef, order.amount, order.currency, order.created_at, order.coupon || null, order.list_amount, order.gift).run();
    await audit(c, 'order.create', order.id, { provider: order.provider, product: order.product_id, amount: order.amount, currency: order.currency, list: order.list_amount, coupon: order.coupon || null, gift: !!order.gift });
  },
});

app.post('/coupons/check', requireUser, async (c) => {
  if (await rateLimited(c.env, `coupon|${c.get('user').id}`, 20, 600000)) return tooMany(c);
  const { code, productId } = await c.req.json().catch(() => ({}));
  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id=? AND active=1').bind(productId).first();
  if (!product) return c.json({ error: '상품을 찾을 수 없습니다.' }, 404);
  const r = await applyCoupon(c.env, code, product);
  return r.error ? c.json(r, 400) : c.json(r);
});

/* ---- Stripe ---- */
app.post('/pay/stripe/checkout', requireUser, async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return c.json({ error: 'Stripe가 설정되지 않았습니다.' }, 503);
  const { productId, coupon, gift } = await c.req.json().catch(() => ({}));
  const r = await newOrder(c, productId, 'stripe', coupon, !!gift); const bad = orderProblem(c, r); if (bad) return bad;
  const { user, product, order } = r;
  const session = await stripeCreateCheckout(c.env, { order, product, user });
  await insertOrder(c, order, session.id).run();
  return c.json({ url: session.url });
});

// Fallback in case the webhook is delayed: success page asks us to confirm.
app.post('/pay/stripe/confirm', requireUser, async (c) => {
  const { orderId } = await c.req.json().catch(() => ({}));
  const o = await c.env.DB.prepare('SELECT * FROM orders WHERE id=? AND user_id=? AND provider=?').bind(orderId, c.get('user').id, 'stripe').first();
  if (!o) return c.json({ error: 'not found' }, 404);
  if (o.status !== 'paid') {
    const s = await stripeRetrieveSession(c.env, o.provider_ref);
    if (s.payment_status === 'paid' && s.amount_total === o.amount) await fulfillOrder(c.env, o.id, o.provider_ref);
  }
  const fresh = await c.env.DB.prepare('SELECT status FROM orders WHERE id=?').bind(o.id).first();
  return c.json({ status: fresh.status });
});

app.post('/webhooks/stripe', async (c) => {
  const raw = await c.req.text();
  if (!c.env.STRIPE_WEBHOOK_SECRET || !(await stripeVerify(c.env.STRIPE_WEBHOOK_SECRET, raw, c.req.header('stripe-signature'))))
    return c.json({ error: 'bad signature' }, 400);
  const ev = JSON.parse(raw);
  if (await c.env.DB.prepare('SELECT 1 FROM webhook_events WHERE id=?').bind(ev.id).first()) return c.json({ ok: true, duplicate: true });
  const obj = ev.data?.object || {};
  const orderId = obj.metadata?.order_id || obj.client_reference_id;
  const o = orderId && (await c.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first());
  if (o && (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded')) {
    if (obj.payment_status === 'paid' && obj.amount_total === o.amount) await fulfillOrder(c.env, o.id, obj.id);
  } else if (o && (ev.type === 'checkout.session.expired' || ev.type === 'checkout.session.async_payment_failed')) {
    await failOrder(c.env, `o.id=? AND o.status='pending'`, [o.id], ev.type);
  }
  // Record the event only after it was handled: if handling threw, Stripe's retry must not be treated as a duplicate.
  await c.env.DB.prepare('INSERT OR IGNORE INTO webhook_events (id,created_at) VALUES (?,?)').bind(ev.id, now()).run();
  return c.json({ ok: true });
});

/* ---- PortOne V2 ---- */
app.post('/pay/portone/prepare', requireUser, async (c) => {
  if (!c.env.PORTONE_API_SECRET || !c.env.PORTONE_STORE_ID) return c.json({ error: '포트원이 설정되지 않았습니다.' }, 503);
  const { productId, coupon, gift } = await c.req.json().catch(() => ({}));
  const r = await newOrder(c, productId, 'portone', coupon, !!gift); const bad = orderProblem(c, r); if (bad) return bad;
  const { user, product, order } = r;
  const paymentId = `pay-${order.id}`;
  await insertOrder(c, order, paymentId).run();
  return c.json({
    orderId: order.id, paymentId, orderName: product.title, totalAmount: order.amount, currency: 'KRW',
    storeId: c.env.PORTONE_STORE_ID, channelKey: c.env.PORTONE_CHANNEL_KEY,
    customer: { fullName: user.name, email: user.email },
  });
});

app.post('/pay/portone/complete', requireUser, async (c) => {
  const { orderId } = await c.req.json().catch(() => ({}));
  const o = await c.env.DB.prepare('SELECT id FROM orders WHERE id=? AND user_id=? AND provider=?').bind(orderId, c.get('user').id, 'portone').first();
  if (!o) return c.json({ error: 'not found' }, 404);
  const r = await portoneVerifyAndFulfill(c.env, o.id);
  return c.json(r, r.ok || r.pending ? 200 : 400);
});

app.post('/webhooks/portone', async (c) => {
  const raw = await c.req.text();
  if (!c.env.PORTONE_WEBHOOK_SECRET || !(await portoneVerifyWebhook(c.env.PORTONE_WEBHOOK_SECRET, raw, c.req.raw.headers)))
    return c.json({ error: 'bad signature' }, 400);
  const ev = JSON.parse(raw);
  const paymentId = ev.data?.paymentId;
  if (paymentId && /Transaction\.(Paid|Ready|VirtualAccountIssued)/.test(ev.type || '')) {
    const o = await c.env.DB.prepare('SELECT id FROM orders WHERE provider=? AND provider_ref=?').bind('portone', paymentId).first();
    if (o) { const r = await portoneVerifyAndFulfill(c.env, o.id); if (r.error === '결제 조회 실패') return c.json({ error: 'lookup failed, retry' }, 503); }
  }
  if (paymentId && /Transaction\.(Failed|Cancelled)/.test(ev.type || '')) {
    await failOrder(c.env, `o.provider='portone' AND o.provider_ref=? AND o.status IN ('pending','awaiting_deposit')`, [paymentId], ev.type);
  }
  return c.json({ ok: true });
});

/* ---- KCP direct ("표준웹") ---- */
app.post('/pay/kcp/register', requireUser, async (c) => {
  if (!kcpEnabled(c.env)) return c.json({ error: 'KCP가 설정되지 않았습니다.' }, 503);
  const { productId, payMethod, coupon, gift } = await c.req.json().catch(() => ({}));
  if (payMethod === 'VIRTUAL_ACCOUNT') return c.json({ error: 'KCP 직접결제는 가상계좌를 지원하지 않습니다. 카드·계좌이체·휴대폰을 이용해 주세요.' }, 400); // would need KCP's deposit notification
  const r = await newOrder(c, productId, 'kcp', coupon, !!gift); const bad = orderProblem(c, r); if (bad) return bad;
  const { product, order } = r;
  const ordr = kcpOrderId(order.id), retUrl = `${c.env.SITE_URL}/api/pay/kcp/return`;
  await insertOrder(c, order, ordr).run();
  const args = { orderId: ordr, amount: order.amount, goodName: product.title, payMethod, retUrl, userAgent: c.req.header('user-agent') };
  const reg = await kcpRegister(c.env, args);
  return c.json({ orderId: order.id, form: kcpForm(c.env, reg, args) });
});

// KCP posts the buyer back here (cross-site form POST, no cookie needed): approve server-side, verify the amount, then grant.
app.post('/pay/kcp/return', async (c) => {
  const b = await c.req.parseBody();
  const o = await c.env.DB.prepare(`SELECT * FROM orders WHERE provider='kcp' AND provider_ref=?`).bind(String(b.ordr_idxx || '')).first();
  const home = c.env.SITE_URL;
  if (!o) return c.redirect(`${home}/#/pay/cancel`, 303);
  if (o.status === 'paid') return c.redirect(`${home}/#/pay/success?order=${o.id}&provider=kcp`, 303);
  if (b.res_cd !== '0000') {
    await failOrder(c.env, `o.id=? AND o.status='pending'`, [o.id], `kcp ${String(b.res_cd || '').slice(0, 10)}`);
    return c.redirect(`${home}/#/pay/cancel`, 303);
  }
  try {
    const a = await kcpApprove(c.env, b);
    if (!a.ok) throw new Error('approval refused');
    if (a.amount !== o.amount) { // never grant on a mismatching amount; try to void what KCP just approved
      await failOrder(c.env, 'o.id=?', [o.id], `amount mismatch ${a.amount}≠${o.amount}`);
      if (a.tno) await kcpCancel(c.env, { tno: a.tno, reason: '금액 불일치 자동취소' }).catch(() => {});
      return c.redirect(`${home}/#/pay/cancel`, 303);
    }
    await c.env.DB.prepare('UPDATE orders SET meta=? WHERE id=?').bind(JSON.stringify({ tno: a.tno }), o.id).run();
    await fulfillOrder(c.env, o.id, o.provider_ref);
    return c.redirect(`${home}/#/pay/success?order=${o.id}&provider=kcp`, 303);
  } catch (e) {
    console.error('kcp approve', e); // e.g. timeout after KCP approved: flag for an admin to verify in the KCP console and confirm manually
    await c.env.DB.prepare(`UPDATE orders SET meta=? WHERE id=?`).bind(JSON.stringify({ ...JSON.parse(o.meta || '{}'), error: 'approve-failed', at: Date.now() }), o.id).run();
    return c.redirect(`${home}/#/pay/cancel?msg=${encodeURIComponent('결제 승인 확인이 지연되고 있습니다. 결제가 완료됐다면 고객센터로 알려 주세요.')}`, 303);
  }
});

app.get('/orders/:id/status', requireUser, async (c) => {
  const o = await c.env.DB.prepare('SELECT status FROM orders WHERE id=? AND user_id=?').bind(c.req.param('id'), c.get('user').id).first();
  return o ? c.json({ status: o.status }) : c.json({ error: 'not found' }, 404);
});

app.get('/orders', requireUser, async (c) => {
  await failOrder(c.env, `o.status='pending' AND o.created_at<?`, [now() - 3 * 86400000], 'abandoned (3 days)'); // abandoned checkouts
  const { results } = await c.env.DB.prepare(
    `SELECT o.id,o.provider,o.amount,o.currency,o.status,o.created_at,o.paid_at,p.title,
            (SELECT status FROM refund_requests r WHERE r.order_id=o.id) AS refund_status
     FROM orders o JOIN products p ON p.id=o.product_id
     WHERE o.user_id=? AND (o.status!='pending' OR o.created_at>?) AND NOT (o.status='failed' AND o.created_at<?) ORDER BY o.created_at DESC`
  ).bind(c.get('user').id, now() - 3 * 86400000, now() - 7 * 86400000).all();
  return c.json({ orders: results });
});

app.post('/orders/:id/recheck', requireUser, async (c) => {
  const o = await c.env.DB.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').bind(c.req.param('id'), c.get('user').id).first();
  return o ? c.json(await recheckOrder(c.env, o)) : c.json({ error: 'not found' }, 404);
});

app.post('/orders/:id/request-refund', requireUser, async (c) => {
  if (await rateLimited(c.env, `refundreq|${c.get('user').id}`, 10, 3600000)) return tooMany(c);
  const { reason } = await c.req.json().catch(() => ({}));
  const o = await c.env.DB.prepare(`SELECT id FROM orders WHERE id=? AND user_id=? AND status='paid' AND provider!='admin'`).bind(c.req.param('id'), c.get('user').id).first();
  if (!o) return c.json({ error: '환불 요청할 수 없는 주문입니다.' }, 400);
  const r = await c.env.DB.prepare('INSERT OR IGNORE INTO refund_requests (id,order_id,user_id,reason,created_at) VALUES (?,?,?,?,?)')
    .bind(uid(), o.id, c.get('user').id, String(reason || '').slice(0, 500), now()).run();
  if (!r.meta.changes) return c.json({ error: '이미 환불 요청이 접수되었습니다.' }, 409);
  await audit(c, 'refund.request', o.id, { reason: String(reason || '').slice(0, 200) });
  return c.json({ ok: true });
});

export default app;
