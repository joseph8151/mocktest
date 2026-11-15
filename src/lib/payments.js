import { now, uid, b64, unb64, hmacSha256, timingSafeEqual, hex } from './util.js';
import { sendMail, mailReceipt, mailGift } from './email.js';
import { logEvent } from './security.js';
import { alimtalk, phoneFor } from './notify.js';

/** Gift code like GIFT-7KQ2-M9XD (no 0/O/1/I to avoid misreading). */
export function giftCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(8));
  const ch = [...r].map((b) => A[b % A.length]).join('');
  return `GIFT-${ch.slice(0, 4)}-${ch.slice(4)}`;
}

/** Idempotently mark an order paid and grant the entitlement. */
export async function fulfillOrder(env, orderId, providerRef) {
  const db = env.DB;
  const upd = await db.prepare(
    `UPDATE orders SET status='paid', paid_at=?, provider_ref=COALESCE(?,provider_ref) WHERE id=? AND status IN ('pending','failed','awaiting_deposit')`
  ).bind(now(), providerRef || null, orderId).run();
  if (!upd.meta.changes) return false; // already fulfilled
  await db.prepare('UPDATE coupons SET used=used+1 WHERE code=(SELECT coupon FROM orders WHERE id=?)').bind(orderId).run();
  const o = await db.prepare(
    `SELECT o.*, p.exam_type, p.attempts, p.valid_days, p.title, u.email, u.name
     FROM orders o JOIN products p ON p.id=o.product_id JOIN users u ON u.id=o.user_id WHERE o.id=?`
  ).bind(orderId).first();
  if (o.gift) { // gift purchase: issue a redeemable code instead of a ticket (one code per order, carries the whole product)
    const code = giftCode();
    await db.prepare('INSERT OR IGNORE INTO gift_codes (code,product_id,order_id,created_by,note,expires_at,created_at) VALUES (?,?,?,?,?,?,?)')
      .bind(code, o.product_id, o.id, o.user_id, 'gift purchase', now() + 365 * 86400000, now()).run();
    await sendMail(env, o.email, `[${env.SITE_NAME}] 선물 코드 발급`, mailGift(env, o.name, o.title, [code]));
  } else {
    await db.prepare(
      `INSERT OR IGNORE INTO entitlements (id,user_id,product_id,order_id,exam_type,attempts_total,expires_at,created_at)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(uid(), o.user_id, o.product_id, o.id, o.exam_type, o.attempts, now() + o.valid_days * 86400000, now()).run();
  }
  await alimtalk(env, await phoneFor(env, o.user_id), 'paid', { 이름: o.name, 상품: o.title, 금액: o.currency === 'USD' ? `$${(o.amount / 100).toFixed(2)}` : `${o.amount.toLocaleString()}원`, 링크: `${env.SITE_URL}/#/me` });
  await logEvent(env, { actor: { id: o.user_id, email: o.email }, action: 'order.paid', target: o.id, detail: { provider: o.provider, amount: o.amount, currency: o.currency, product: o.product_id, coupon: o.coupon || null } });
  await sendMail(env, o.email, `[${env.SITE_NAME}] 결제 완료`, mailReceipt(env, o.name, o.title, o.amount, o.currency));
  return true;
}

/** Mark an order failed and log why (webhooks have no signed-in user: the order's owner is recorded). */
export async function failOrder(env, where, binds, reason, ip = null) {
  const rows = (await env.DB.prepare(`SELECT o.id,o.user_id,u.email FROM orders o JOIN users u ON u.id=o.user_id WHERE ${where}`).bind(...binds).all()).results;
  for (const o of rows) {
    await env.DB.prepare(`UPDATE orders SET status='failed' WHERE id=?`).bind(o.id).run();
    await logEvent(env, { actor: { id: o.user_id, email: o.email }, action: 'order.failed', target: o.id, detail: { reason }, ip });
  }
}

const stripeBase = (env) => env.STRIPE_API_BASE || 'https://api.stripe.com';
const portoneBase = (env) => env.PORTONE_API_BASE || 'https://api.portone.io';

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
  const r = await fetch(`${stripeBase(env)}/v1/checkout/sessions`, {
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
  const r = await fetch(`${stripeBase(env)}/v1/checkout/sessions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  return r.json();
}
export async function stripeRefund(env, paymentIntent) {
  const r = await fetch(`${stripeBase(env)}/v1/refunds`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ payment_intent: paymentIntent }),
  });
  return r.ok;
}

/* ---------------- PortOne V2 ---------------- */
export async function portoneGetPayment(env, paymentId) {
  const r = await fetch(`${portoneBase(env)}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `PortOne ${env.PORTONE_API_SECRET}` },
  });
  if (!r.ok) return null;
  return r.json();
}
export async function portoneCancel(env, paymentId, reason = '관리자 환불') {
  const r = await fetch(`${portoneBase(env)}/payments/${encodeURIComponent(paymentId)}/cancel`, {
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
  if (pay.status === 'VIRTUAL_ACCOUNT_ISSUED') { // bank-transfer payments wait for the customer's deposit
    await env.DB.prepare(`UPDATE orders SET status='awaiting_deposit' WHERE id=? AND status IN ('pending','awaiting_deposit')`).bind(order.id).run();
    const va = pay.method || {};
    return { ok: false, pending: true, account: { bank: va.bank, number: va.accountNumber, holder: va.remitteeName, expiresAt: va.expiredAt, amount: order.amount } };
  }
  if (pay.status !== 'PAID') return { ok: false, error: `결제 상태: ${pay.status}` };
  if (pay.amount?.total !== order.amount || pay.currency !== order.currency) {
    await failOrder(env, 'o.id=?', [order.id], `amount mismatch ${pay.amount?.total}≠${order.amount}`);
    await portoneCancel(env, order.provider_ref, '금액 불일치 자동취소').catch(() => {}); // never keep money we will not honour
    return { ok: false, error: '결제 금액이 일치하지 않습니다.' };
  }
  await fulfillOrder(env, order.id, order.provider_ref);
  return { ok: true };
}

/** Re-check an unfinished order with its payment provider (lost webhook, closed tab, delayed deposit). */
export async function recheckOrder(env, order) {
  if (order.status === 'paid') return { status: 'paid' };
  try {
    if (order.provider === 'portone') {
      const r = await portoneVerifyAndFulfill(env, order.id);
      if (r.pending) return { status: 'awaiting_deposit', account: r.account };
      if (!r.ok && r.error?.startsWith('결제 상태: ')) {
        const st = r.error.slice(7);
        if (['FAILED', 'CANCELLED', 'PARTIAL_CANCELLED'].includes(st)) await failOrder(env, `o.id=? AND o.status NOT IN ('paid','failed')`, [order.id], `portone ${st}`);
      }
    } else if (order.provider === 'stripe') {
      const s = await stripeRetrieveSession(env, order.provider_ref);
      if (s.payment_status === 'paid' && s.amount_total === order.amount) await fulfillOrder(env, order.id, order.provider_ref);
      else if (s.status === 'expired') await failOrder(env, `o.id=? AND o.status='pending'`, [order.id], 'stripe session expired');
    }
  } catch (e) { console.error('recheck failed', e); return { status: order.status, error: '결제사 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.' }; }
  const fresh = await env.DB.prepare('SELECT status FROM orders WHERE id=?').bind(order.id).first();
  return { status: fresh.status };
}
