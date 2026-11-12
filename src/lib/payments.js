import { now, uid, b64, unb64, hmacSha256, timingSafeEqual, hex } from './util.js';
import { sendMail, mailReceipt } from './email.js';

/** Idempotently mark an order paid and grant the entitlement. */
export async function fulfillOrder(env, orderId, providerRef) {
  const db = env.DB;
  const upd = await db.prepare(
    `UPDATE orders SET status='paid', paid_at=?, provider_ref=COALESCE(?,provider_ref) WHERE id=? AND status IN ('pending','failed')`
  ).bind(now(), providerRef || null, orderId).run();
  if (!upd.meta.changes) return false; // already fulfilled
  const o = await db.prepare(
    `SELECT o.*, p.exam_type, p.attempts, p.valid_days, p.title, u.email, u.name
     FROM orders o JOIN products p ON p.id=o.product_id JOIN users u ON u.id=o.user_id WHERE o.id=?`
  ).bind(orderId).first();
  await db.prepare(
    `INSERT OR IGNORE INTO entitlements (id,user_id,product_id,order_id,exam_type,attempts_total,expires_at,created_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).bind(uid(), o.user_id, o.product_id, o.id, o.exam_type, o.attempts, now() + o.valid_days * 86400000, now()).run();
  await sendMail(env, o.email, `[${env.SITE_NAME}] 결제 완료`, mailReceipt(env, o.name, o.title, o.amount, o.currency));
  return true;
}

/* ---------------- Stripe ---------------- */
const form = (obj) => {
  const p = new URLSearchParams();
  const walk = (prefix, v) => {
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(`${prefix}[${k}]`, x);
    else p.append(prefix, String(v));
  };
  for (const [k, v] of Object.entries(obj)) walk(k, v);
  return p;
};

export async function stripeCreateCheckout(env, { order, product, user }) {
  const body = form({
    mode: 'payment',
    'line_items': { 0: { quantity: 1, price_data: { currency: 'usd', unit_amount: order.amount,
      product_data: { name: product.title } } } },
    customer_email: user.email,
    client_reference_id: order.id,
    metadata: { order_id: order.id },
    success_url: `${env.SITE_URL}/#/pay/success?order=${order.id}`,
    cancel_url: `${env.SITE_URL}/#/pay/cancel`,
  });
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || 'Stripe error');
  return j; // { id, url }
}

/** Verify Stripe-Signature header (t=...,v1=...). */
export async function stripeVerify(secret, raw, header, toleranceSec = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')));
  const t = parts.t, v1 = header.split(',').filter((x) => x.startsWith('v1=')).map((x) => x.slice(3));
  if (!t || !v1.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return false;
  const sig = hex(await hmacSha256(new TextEncoder().encode(secret), `${t}.${raw}`));
  return v1.some((s) => timingSafeEqual(s, sig));
}

export async function stripeRetrieveSession(env, id) {
  const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  return r.json();
}
export async function stripeRefund(env, paymentIntent) {
  const r = await fetch('https://api.stripe.com/v1/refunds', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ payment_intent: paymentIntent }),
  });
  return r.ok;
}

/* ---------------- PortOne V2 ---------------- */
export async function portoneGetPayment(env, paymentId) {
  const r = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `PortOne ${env.PORTONE_API_SECRET}` },
  });
  if (!r.ok) return null;
  return r.json();
}
export async function portoneCancel(env, paymentId, reason = '관리자 환불') {
  const r = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}/cancel`, {
    method: 'POST',
    headers: { Authorization: `PortOne ${env.PORTONE_API_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  return r.ok;
}
/** Standard Webhooks verification used by PortOne V2 (secret "whsec_<base64>"). */
export async function portoneVerifyWebhook(secret, raw, headers, toleranceSec = 300) {
  const id = headers.get('webhook-id'), ts = headers.get('webhook-timestamp'), sigs = headers.get('webhook-signature');
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > toleranceSec) return false;
  const key = unb64(secret.replace(/^whsec_/, ''));
  const expected = b64(await hmacSha256(key, `${id}.${ts}.${raw}`));
  return sigs.split(' ').some((s) => timingSafeEqual(s.replace(/^v1,/, ''), expected));
}

/** Server-side verification of a PortOne payment against our order, then fulfil. */
export async function portoneVerifyAndFulfill(env, orderId) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first();
  if (!order) return { ok: false, error: 'order not found' };
  if (order.status === 'paid') return { ok: true, already: true };
  const pay = await portoneGetPayment(env, order.provider_ref);
  if (!pay) return { ok: false, error: '결제 조회 실패' };
  if (pay.status !== 'PAID') return { ok: false, error: `결제 상태: ${pay.status}` };
  if (pay.amount?.total !== order.amount || pay.currency !== order.currency) {
    await env.DB.prepare(`UPDATE orders SET status='failed' WHERE id=?`).bind(order.id).run();
    return { ok: false, error: '결제 금액이 일치하지 않습니다.' };
  }
  await fulfillOrder(env, order.id, order.provider_ref);
  return { ok: true };
}
