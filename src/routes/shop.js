import { Hono } from 'hono';
import { uid, now } from '../lib/util.js';
import { requireUser } from '../lib/auth.js';
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
  const { results } = await c.env.DB.prepare('SELECT * FROM products WHERE active=1 ORDER BY sort,price_krw').all();
  return c.json({
    products: results,
    payment: { stripe: !!c.env.STRIPE_SECRET_KEY, portone: !!(c.env.PORTONE_STORE_ID && c.env.PORTONE_CHANNEL_KEY),
      portoneStoreId: c.env.PORTONE_STORE_ID || null, portoneChannelKey: c.env.PORTONE_CHANNEL_KEY || null },
  });
});

async function newOrder(c, productId, provider) {
  const user = c.get('user');
  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id=? AND active=1').bind(productId).first();
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
  return c.json(r, r.ok ? 200 : 400);
});

app.post('/webhooks/portone', async (c) => {
  const raw = await c.req.text();
  if (!c.env.PORTONE_WEBHOOK_SECRET || !(await portoneVerifyWebhook(c.env.PORTONE_WEBHOOK_SECRET, raw, c.req.raw.headers)))
    return c.json({ error: 'bad signature' }, 400);
  const ev = JSON.parse(raw);
  const paymentId = ev.data?.paymentId;
  if (paymentId && /Transaction\.(Paid|Ready)/.test(ev.type || '')) {
    const o = await c.env.DB.prepare('SELECT id FROM orders WHERE provider=? AND provider_ref=?').bind('portone', paymentId).first();
    if (o) await portoneVerifyAndFulfill(c.env, o.id);
  }
  return c.json({ ok: true });
});

app.get('/orders', requireUser, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT o.id,o.provider,o.amount,o.currency,o.status,o.created_at,o.paid_at,p.title FROM orders o JOIN products p ON p.id=o.product_id
     WHERE o.user_id=? AND o.status!='pending' ORDER BY o.created_at DESC`
  ).bind(c.get('user').id).all();
  return c.json({ orders: results });
});

export default app;
