import { Hono } from 'hono';
import { uid, now } from '../lib/util.js';
import { requireUser, loadUser } from '../lib/auth.js';
import { kcpEnabled, kcpRegister, kcpForm, kcpApprove, kcpCancel, kcpOrderId } from '../lib/kcp.js';
import {
  fulfillOrder, stripeCreateCheckout, stripeVerify, stripeRetrieveSession,
  portoneVerifyAndFulfill, portoneGetPayment, portoneVerifyWebhook,
} from '../lib/payments.js';

const app = new Hono();

app.get('/config', (c) => c.json({
  site: c.env.SITE_NAME,
  biz: { name: c.env.BIZ_NAME, owner: c.env.BIZ_OWNER, regNo: c.env.BIZ_REG_NO, salesNo: c.env.BIZ_SALES_NO, address: c.env.BIZ_ADDRESS, contact: c.env.BIZ_CONTACT },
}));

app.get('/products', async (c) => {
  const admin = (await loadUser(c))?.role === 'admin'; // the 1,000-won payment test product is only visible to admins
  const { results } = await c.env.DB.prepare(`SELECT * FROM products WHERE active=1 OR (?1 AND id='p-test') ORDER BY sort,price_krw`).bind(admin ? 1 : 0).all();
  return c.json({
    products: results,
    payment: { kcp: kcpEnabled(c.env), stripe: !!c.env.STRIPE_SECRET_KEY, portone: !!(c.env.PORTONE_STORE_ID && c.env.PORTONE_CHANNEL_KEY),
      portoneStoreId: c.env.PORTONE_STORE_ID || null, portoneChannelKey: c.env.PORTONE_CHANNEL_KEY || null },
  });
});

async function newOrder(c, productId, provider) {
  const user = c.get('user');
  const product = await c.env.DB.prepare(`SELECT * FROM products WHERE id=?1 AND (active=1 OR (?2 AND id='p-test'))`).bind(productId, user.role === 'admin' ? 1 : 0).first();
  if (!product) return {};
  const currency = provider === 'stripe' ? 'USD' : 'KRW';
  const amount = provider === 'stripe' ? product.price_usd_cents : product.price_krw;
  const order = { id: uid(), user_id: user.id, product_id: product.id, provider, amount, currency, created_at: now() };
  return { user, product, order };
}

/* ---- Stripe ---- */
app.post('/pay/stripe/checkout', requireUser, async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return c.json({ error: 'Stripe가 설정되지 않았습니다.' }, 503);
  const { productId } = await c.req.json().catch(() => ({}));
  const { user, product, order } = await newOrder(c, productId, 'stripe');
  if (!product) return c.json({ error: '상품을 찾을 수 없습니다.' }, 404);
  const session = await stripeCreateCheckout(c.env, { order, product, user });
  await c.env.DB.prepare(
    `INSERT INTO orders (id,user_id,product_id,provider,provider_ref,amount,currency,status,created_at) VALUES (?,?,?,?,?,?,?,'pending',?)`
  ).bind(order.id, user.id, product.id, 'stripe', session.id, order.amount, order.currency, order.created_at).run();
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
  const seen = await c.env.DB.prepare('INSERT OR IGNORE INTO webhook_events (id,created_at) VALUES (?,?)').bind(ev.id, now()).run();
  if (!seen.meta.changes) return c.json({ ok: true, duplicate: true });
  if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') {
    const s = ev.data.object;
    const orderId = s.metadata?.order_id || s.client_reference_id;
    const o = orderId && (await c.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first());
    if (o && s.payment_status === 'paid' && s.amount_total === o.amount) await fulfillOrder(c.env, o.id, s.id);
  }
  return c.json({ ok: true });
});

/* ---- PortOne V2 ---- */
app.post('/pay/portone/prepare', requireUser, async (c) => {
  if (!c.env.PORTONE_API_SECRET || !c.env.PORTONE_STORE_ID) return c.json({ error: '포트원이 설정되지 않았습니다.' }, 503);
  const { productId } = await c.req.json().catch(() => ({}));
  const { user, product, order } = await newOrder(c, productId, 'portone');
  if (!product) return c.json({ error: '상품을 찾을 수 없습니다.' }, 404);
  const paymentId = `pay-${order.id}`;
  await c.env.DB.prepare(
    `INSERT INTO orders (id,user_id,product_id,provider,provider_ref,amount,currency,status,created_at) VALUES (?,?,?,?,?,?,?,'pending',?)`
  ).bind(order.id, user.id, product.id, 'portone', paymentId, order.amount, 'KRW', order.created_at).run();
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
    if (o) await portoneVerifyAndFulfill(c.env, o.id);
  }
  if (paymentId && /Transaction\.(Failed|Cancelled)/.test(ev.type || '')) {
    await c.env.DB.prepare(`UPDATE orders SET status='failed' WHERE provider='portone' AND provider_ref=? AND status IN ('pending','awaiting_deposit')`).bind(paymentId).run();
  }
  return c.json({ ok: true });
});

/* ---- KCP direct ("표준웹") ---- */
app.post('/pay/kcp/register', requireUser, async (c) => {
  if (!kcpEnabled(c.env)) return c.json({ error: 'KCP가 설정되지 않았습니다.' }, 503);
  const { productId, payMethod } = await c.req.json().catch(() => ({}));
  const { user, product, order } = await newOrder(c, productId, 'kcp');
  if (!product) return c.json({ error: '상품을 찾을 수 없습니다.' }, 404);
  const ordr = kcpOrderId(order.id), retUrl = `${c.env.SITE_URL}/api/pay/kcp/return`;
  await c.env.DB.prepare(`INSERT INTO orders (id,user_id,product_id,provider,provider_ref,amount,currency,status,created_at) VALUES (?,?,?,?,?,?,?,'pending',?)`)
    .bind(order.id, user.id, product.id, 'kcp', ordr, order.amount, 'KRW', order.created_at).run();
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
    await c.env.DB.prepare(`UPDATE orders SET status='failed' WHERE id=? AND status='pending'`).bind(o.id).run();
    return c.redirect(`${home}/#/pay/cancel`, 303);
  }
  try {
    const a = await kcpApprove(c.env, b);
    if (!a.ok) throw new Error('approval refused');
    if (a.amount !== o.amount) { // never grant on a mismatching amount; try to void what KCP just approved
      await c.env.DB.prepare(`UPDATE orders SET status='failed' WHERE id=?`).bind(o.id).run();
      if (a.tno) await kcpCancel(c.env, { tno: a.tno, reason: '금액 불일치 자동취소' }).catch(() => {});
      return c.redirect(`${home}/#/pay/cancel`, 303);
    }
    await c.env.DB.prepare('UPDATE orders SET meta=? WHERE id=?').bind(JSON.stringify({ tno: a.tno }), o.id).run();
    await fulfillOrder(c.env, o.id, o.provider_ref);
    return c.redirect(`${home}/#/pay/success?order=${o.id}&provider=kcp`, 303);
  } catch (e) {
    console.error('kcp approve', e);
    return c.redirect(`${home}/#/pay/cancel`, 303);
  }
});

app.get('/orders/:id/status', requireUser, async (c) => {
  const o = await c.env.DB.prepare('SELECT status FROM orders WHERE id=? AND user_id=?').bind(c.req.param('id'), c.get('user').id).first();
  return o ? c.json({ status: o.status }) : c.json({ error: 'not found' }, 404);
});

app.get('/orders', requireUser, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT o.id,o.provider,o.amount,o.currency,o.status,o.created_at,o.paid_at,p.title,
            (SELECT status FROM refund_requests r WHERE r.order_id=o.id) AS refund_status
     FROM orders o JOIN products p ON p.id=o.product_id
     WHERE o.user_id=? AND o.status!='pending' ORDER BY o.created_at DESC`
  ).bind(c.get('user').id).all();
  return c.json({ orders: results });
});

app.post('/orders/:id/request-refund', requireUser, async (c) => {
  const { reason } = await c.req.json().catch(() => ({}));
  const o = await c.env.DB.prepare(`SELECT id FROM orders WHERE id=? AND user_id=? AND status='paid' AND provider!='admin'`).bind(c.req.param('id'), c.get('user').id).first();
  if (!o) return c.json({ error: '환불 요청할 수 없는 주문입니다.' }, 400);
  const r = await c.env.DB.prepare('INSERT OR IGNORE INTO refund_requests (id,order_id,user_id,reason,created_at) VALUES (?,?,?,?,?)')
    .bind(uid(), o.id, c.get('user').id, String(reason || '').slice(0, 500), now()).run();
  if (!r.meta.changes) return c.json({ error: '이미 환불 요청이 접수되었습니다.' }, 409);
  return c.json({ ok: true });
});

export default app;
