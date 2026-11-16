import { Hono } from 'hono';
import { uid, now } from '../lib/util.js';
import { requireAdmin } from '../lib/auth.js';
import { EXAMS } from '../lib/exam.js';
import { stripeRetrieveSession, stripeRefund, portoneCancel, recheckOrder, fulfillOrder, giftCode } from '../lib/payments.js';
import { regradeAttempt } from './exams.js';
import { aiConfigured, aiMode, gradePending, gradeAnswer, AI_MODEL_DEFAULT } from '../lib/aigrade.js';
import { kcpCancel, kcpEnabled, kcpConfig } from '../lib/kcp.js';
import { audit, redact, logEvent } from '../lib/security.js';
import { clearNoticeCache, DEFAULT_POPUP } from './shop.js';
import { purgeEdge } from '../lib/edgecache.js';
import { bankAccount } from '../lib/bank.js';
import { manualSettings, clearManualCache } from '../lib/sections.js';
import { deliver, mailFrom, mailTest, sendMail, mailSupportReply } from '../lib/email.js';
import { anonymizeUser } from './auth.js';
import { hashPassword } from '../lib/auth.js';
import { randomToken } from '../lib/util.js';

const app = new Hono();
app.use('*', requireAdmin);
// Audit trail: every admin change (and data export) is recorded with who, what, when and from where.
app.use('*', async (c, next) => {
  const m = c.req.method;
  if (m !== 'GET' && /^\/api\/admin\/products/.test(c.req.path)) c.set('purgeProducts', true);
  let body = null;
  if (m !== 'GET' && /json/.test(c.req.header('content-type') || '')) { // what was changed (secrets redacted)
    const j = await c.req.json().catch(() => null);
    body = Array.isArray(j) ? { items: j.length } : redact(j);
  }
  await next();
  if (c.get('purgeProducts')) await purgeEdge(c, ['/api/products']);
  if (m !== 'GET' || c.req.path.endsWith('.csv') || c.req.path.endsWith('/backup')) {
    const id = c.req.path.replace(/^\/api\/admin/, '');
    await audit(c, `admin.${m.toLowerCase()}`, id.slice(0, 200), { status: c.res.status, ...(body && Object.keys(body).length ? { body } : {}), ...(c.req.query() && Object.keys(c.req.query()).length ? { query: c.req.query() } : {}) });
  }
});

app.get('/stats', async (c) => {
  const q = (s) => c.env.DB.prepare(s).first();
  const [users, paid, revenue, attempts, pending, qs] = await Promise.all([
    q(`SELECT COUNT(*) n FROM users`),
    q(`SELECT COUNT(*) n FROM orders WHERE status='paid'`),
    c.env.DB.prepare(`SELECT currency, SUM(amount) s FROM orders WHERE status='paid' GROUP BY currency`).all(),
    q(`SELECT COUNT(*) n FROM attempts`),
    q(`SELECT COUNT(*) n FROM answers a JOIN attempts t ON t.id=a.attempt_id WHERE a.kind IN ('text','audio') AND a.manual_score IS NULL AND t.status!='in_progress'`),
    q(`SELECT COUNT(*) n FROM questions WHERE active=1`),
  ]);
  return c.json({ users: users.n, paidOrders: paid.n, revenue: revenue.results, attempts: attempts.n, pendingGrading: pending.n, pendingRefunds: (await q(`SELECT COUNT(*) n FROM refund_requests WHERE status='pending'`)).n, awaitingDeposit: (await q(`SELECT COUNT(*) n FROM orders WHERE provider='bank' AND status='awaiting_deposit'`)).n, questions: qs.n });
});

app.get('/payment-status', async (c) => {
  const e = c.env, site = e.SITE_URL;
  const bank = await bankAccount(e);
  return c.json({
    bank: { configured: !!bank, notify: !!e.NOTIFY_EMAIL, ...(bank || {}) },
    siteUrl: site,
    stripe: { configured: !!e.STRIPE_SECRET_KEY, webhookSecret: !!e.STRIPE_WEBHOOK_SECRET, webhookUrl: `${site}/api/webhooks/stripe` },
    portone: { configured: !!(e.PORTONE_API_SECRET && e.PORTONE_STORE_ID && e.PORTONE_CHANNEL_KEY), webhookSecret: !!e.PORTONE_WEBHOOK_SECRET, webhookUrl: `${site}/api/webhooks/portone` },
    kcp: { configured: kcpEnabled(e), mode: kcpConfig(e).mode, siteCd: e.KCP_SITE_CD ? e.KCP_SITE_CD.slice(0, 2) + '***' : null, returnUrl: `${site}/api/pay/kcp/return` },
    mail: { configured: !!e.RESEND_API_KEY, from: mailFrom(e), testSender: !e.MAIL_FROM },
    kakao: { login: !!e.KAKAO_REST_KEY, redirect: `${site}/api/auth/kakao/callback`, alimtalk: !!(e.SOLAPI_API_KEY && e.SOLAPI_API_SECRET && e.SOLAPI_SENDER && e.KAKAO_PFID), templates: { result: !!e.ALIMTALK_TPL_RESULT, paid: !!e.ALIMTALK_TPL_PAID } },
  });
});

app.post('/mail-test', async (c) => {
  const r = await deliver(c.env, c.get('user').email, `[${c.env.SITE_NAME}] 이메일 연결 테스트`, mailTest(c.env));
  return r.ok ? c.json({ ok: true, to: c.get('user').email }) : c.json({ error: r.error }, 502);
});

/* ---- members ---- */
app.get('/users', async (c) => {
  const s = `%${c.req.query('q') || ''}%`;
  const { results } = await c.env.DB.prepare(
    `SELECT id,email,name,role,status,grade,phone,created_at,last_login_at,(totp_secret IS NOT NULL) AS twofa FROM users
     WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT 200`).bind(s, s).all();
  return c.json({ users: results });
});
app.get('/users/:id', async (c) => {
  const id = c.req.param('id');
  const [user, ents, orders, atts] = await Promise.all([
    c.env.DB.prepare('SELECT id,email,name,role,status,grade,phone,created_at,last_login_at,email_verified_at,under14,guardian_email,consent_at,parent_id,kakao_id FROM users WHERE id=?').bind(id).first(),
    c.env.DB.prepare('SELECT * FROM entitlements WHERE user_id=? ORDER BY created_at DESC').bind(id).all(),
    c.env.DB.prepare('SELECT o.*,p.title FROM orders o JOIN products p ON p.id=o.product_id WHERE o.user_id=? ORDER BY o.created_at DESC').bind(id).all(),
    c.env.DB.prepare('SELECT id,exam_type,status,started_at,finished_at FROM attempts WHERE user_id=? ORDER BY started_at DESC').bind(id).all(),
  ]);
  const log = await c.env.DB.prepare('SELECT action,target,detail,ip,at,actor_email FROM audit_log WHERE actor_id=?1 OR target=?1 ORDER BY at DESC LIMIT 100').bind(id).all();
  return c.json({ user, entitlements: ents.results, orders: orders.results, attempts: atts.results, activity: log.results });
});
app.patch('/users/:id', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const id = c.req.param('id');
  if (id === c.get('user').id && (b.role === 'student' || b.status === 'suspended')) return c.json({ error: '자기 자신은 변경할 수 없습니다.' }, 400);
  if (b.role && !['student', 'teacher', 'admin'].includes(b.role)) return c.json({ error: 'bad role' }, 400);
  if (b.status && !['active', 'suspended'].includes(b.status)) return c.json({ error: 'bad status' }, 400);
  if ((b.role === 'student' || b.status === 'suspended') && (await c.env.DB.prepare(`SELECT role FROM users WHERE id=?`).bind(id).first())?.role === 'admin' && (await c.env.DB.prepare(`SELECT COUNT(*) n FROM users WHERE role='admin' AND status='active'`).first()).n <= 1) return c.json({ error: '마지막 관리자는 해제하거나 정지할 수 없습니다.' }, 400);
  await c.env.DB.prepare('UPDATE users SET role=COALESCE(?,role), status=COALESCE(?,status), name=COALESCE(?,name), grade=COALESCE(?,grade) WHERE id=?')
    .bind(b.role || null, b.status || null, b.name || null, b.grade ?? null, id).run();
  if (b.status === 'suspended' || b.role) await c.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run(); // role change: sign in again (admin sessions are shorter)
  return c.json({ ok: true });
});
app.delete('/users/:id', async (c) => {
  // Records are never destroyed: the account is de-identified like a self-withdrawal; results, orders and the log remain.
  const id = c.req.param('id');
  if (id === c.get('user').id) return c.json({ error: '자기 자신은 삭제할 수 없습니다.' }, 400);
  const t = await c.env.DB.prepare('SELECT role FROM users WHERE id=?').bind(id).first();
  if (!t) return c.json({ error: 'not found' }, 404);
  if (t.role === 'admin') return c.json({ error: '관리자는 먼저 권한을 해제하세요.' }, 400);
  const { hash, salt } = await hashPassword(randomToken());
  await audit(c, 'account.delete', id, { by: 'admin' });
  await c.env.DB.batch(anonymizeUser(c.env.DB, id, hash, salt));
  return c.json({ ok: true });
});
app.post('/users/:id/grant', async (c) => {
  const { productId } = await c.req.json().catch(() => ({}));
  const p = await c.env.DB.prepare('SELECT * FROM products WHERE id=?').bind(productId).first();
  if (!p) return c.json({ error: 'product not found' }, 404);
  const oid = uid();
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO orders (id,user_id,product_id,provider,amount,currency,status,created_at,paid_at) VALUES (?,?,?,'admin',0,'KRW','paid',?,?)`)
      .bind(oid, c.req.param('id'), p.id, now(), now()),
    c.env.DB.prepare(`INSERT INTO entitlements (id,user_id,product_id,order_id,exam_type,attempts_total,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .bind(uid(), c.req.param('id'), p.id, oid, p.exam_type, p.attempts, now() + p.valid_days * 86400000, now()),
  ]);
  return c.json({ ok: true });
});

/* ---- orders ---- */
app.get('/orders', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT o.*,u.email,u.name,p.title, r.status AS refund_status, r.reason AS refund_reason, r.id AS refund_id
     FROM orders o JOIN users u ON u.id=o.user_id JOIN products p ON p.id=o.product_id
     LEFT JOIN refund_requests r ON r.order_id=o.id
     ORDER BY (r.status='pending') DESC, o.created_at DESC LIMIT 300`).all();
  return c.json({ orders: results });
});
app.post('/orders/:id/mark-paid', async (c) => {
  const o = await c.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(c.req.param('id')).first();
  if (!o || !['pending', 'failed', 'awaiting_deposit'].includes(o.status)) return c.json({ error: '확정할 수 없는 주문입니다.' }, 400);
  const b = await c.req.json().catch(() => ({}));
  if (b.tno) await c.env.DB.prepare('UPDATE orders SET meta=? WHERE id=?').bind(JSON.stringify({ ...JSON.parse(o.meta || '{}'), tno: String(b.tno).slice(0, 40), manual: true }), o.id).run();
  await fulfillOrder(c.env, o.id, o.provider_ref);
  return c.json({ ok: true });
});
app.post('/bank-account', async (c) => { // 무통장입금 account (empty account = turn bank transfer off)
  const b = await c.req.json().catch(() => ({}));
  const v = { bank: String(b.bank || '').trim().slice(0, 30), account: String(b.account || '').replace(/[^0-9-]/g, '').slice(0, 30), holder: String(b.holder || '').trim().slice(0, 30) };
  if (v.account && (!v.bank || !v.holder || v.account.replace(/-/g, '').length < 8)) return c.json({ error: '은행, 계좌번호, 예금주를 모두 입력해 주세요.' }, 400);
  await c.env.DB.prepare(`INSERT INTO settings (key,value,updated_at) VALUES ('bank_account',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
    .bind(JSON.stringify(v.account ? v : { enabled: false }), now()).run();
  clearNoticeCache(); await purgeEdge(c, ['/api/products', '/api/config']);
  return c.json({ ok: true, bank: v.account ? v : null });
});
app.post('/orders/:id/recheck', async (c) => {
  const o = await c.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(c.req.param('id')).first();
  return o ? c.json(await recheckOrder(c.env, o)) : c.json({ error: 'not found' }, 404);
});
app.post('/orders/:id/refund', async (c) => {
  const o = await c.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(c.req.param('id')).first();
  if (!o || o.status !== 'paid') return c.json({ error: '환불할 수 없는 주문입니다.' }, 400);
  let ok = true;
  if (o.provider === 'stripe') {
    const s = await stripeRetrieveSession(c.env, o.provider_ref);
    ok = !!s.payment_intent && (await stripeRefund(c.env, s.payment_intent));
  } else if (o.provider === 'portone') {
    ok = await portoneCancel(c.env, o.provider_ref);
  } else if (o.provider === 'bank') { // no PG: the admin sends the money back by transfer, then records the refund here
    const b = await c.req.json().catch(() => ({}));
    if (!b.transferred) return c.json({ error: '무통장입금 주문은 고객 계좌로 직접 송금한 뒤 환불 처리해 주세요.' }, 400);
  } else if (o.provider === 'kcp') {
    const tno = JSON.parse(o.meta || '{}').tno;
    ok = !!tno && (await kcpCancel(c.env, { tno }));
  }
  if (!ok) return c.json({ error: 'PG사 환불 처리에 실패했습니다.' }, 502);
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE orders SET status='refunded' WHERE id=?`).bind(o.id),
    c.env.DB.prepare(`UPDATE entitlements SET revoked=1 WHERE order_id=?1 OR origin_order_id=?1`).bind(o.id), // incl. tickets shared to children/students or redeemed gifts
    c.env.DB.prepare(`UPDATE gift_codes SET revoked=1 WHERE order_id=?`).bind(o.id),
    c.env.DB.prepare(`UPDATE refund_requests SET status='done' WHERE order_id=?`).bind(o.id),
  ]);
  const owner = await c.env.DB.prepare('SELECT id,email FROM users WHERE id=?').bind(o.user_id).first();
  await logEvent(c.env, { actor: owner, action: 'order.refunded', target: o.id, detail: { provider: o.provider, amount: o.amount, currency: o.currency, by: c.get('user').email } });
  return c.json({ ok: true });
});

app.post('/refund-requests/:id/reject', async (c) => {
  await c.env.DB.prepare(`UPDATE refund_requests SET status='rejected' WHERE id=? AND status='pending'`).bind(c.req.param('id')).run();
  return c.json({ ok: true });
});
app.get('/orders.csv', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT o.created_at,o.paid_at,u.email,p.title,o.provider,o.amount,o.currency,o.status FROM orders o JOIN users u ON u.id=o.user_id JOIN products p ON p.id=o.product_id ORDER BY o.created_at DESC`).all();
  const esc = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; }; // CSV-injection safe
  const rows = results.map((r) => [new Date(r.created_at).toISOString(), r.paid_at ? new Date(r.paid_at).toISOString() : '', r.email, r.title, r.provider, r.amount, r.currency, r.status].map(esc).join(','));
  return new Response('\uFEFF' + ['created,paid,email,product,provider,amount,currency,status', ...rows].join('\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="orders.csv"' } });
});

/* ---- products ---- */
app.get('/products', async (c) => c.json({ products: (await c.env.DB.prepare('SELECT * FROM products ORDER BY sort').all()).results }));
app.post('/products', async (c) => {
  const b = await c.req.json();
  const id = b.id || uid();
  await c.env.DB.prepare(
    `INSERT INTO products (id,exam_type,title,description,price_krw,price_usd_cents,attempts,valid_days,active,sort) VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET exam_type=excluded.exam_type,title=excluded.title,description=excluded.description,price_krw=excluded.price_krw,
       price_usd_cents=excluded.price_usd_cents,attempts=excluded.attempts,valid_days=excluded.valid_days,active=excluded.active,sort=excluded.sort`
  ).bind(id, b.exam_type, b.title, b.description || '', +b.price_krw, +b.price_usd_cents, +b.attempts || 1, +b.valid_days || 90, b.active ? 1 : 0, +b.sort || 0).run();
  return c.json({ ok: true, id });
});

/* ---- question bank ---- */
app.get('/questions', async (c) => {
  const { exam, section, q } = c.req.query();
  const { results } = await c.env.DB.prepare(
    `SELECT id,exam_type,section,kind,difficulty,stem,active FROM questions
     WHERE (?1 IS NULL OR exam_type=?1) AND (?2 IS NULL OR section=?2) AND (?3 IS NULL OR stem LIKE ?3)
     ORDER BY created_at DESC LIMIT ?4`).bind(exam || null, section || null, q ? `%${q}%` : null, Math.min(1000, Math.max(1, +c.req.query('limit') || 300))).all();
  const counts = await c.env.DB.prepare(`SELECT exam_type,section,COUNT(*) n FROM questions WHERE active=1 GROUP BY exam_type,section`).all();
  return c.json({ questions: results, counts: counts.results });
});
app.get('/questions/:id', async (c) => {
  const q = await c.env.DB.prepare('SELECT * FROM questions WHERE id=?').bind(c.req.param('id')).first();
  return q ? c.json({ ...q, choices: q.choices ? JSON.parse(q.choices) : null }) : c.json({ error: 'not found' }, 404);
});

function validateQ(b) {
  const ex = EXAMS[b.exam_type];
  if (!ex) return '시험 종류가 올바르지 않습니다.';
  if (!ex.sections.find((s) => s.key === b.section)) return '영역이 올바르지 않습니다.';
  if (!b.stem) return '문제 본문이 필요합니다.';
  const kind = b.kind || 'mcq';
  if (!['mcq', 'num', 'text', 'audio'].includes(kind)) return '유형이 올바르지 않습니다.';
  if (kind === 'num' && (!Array.isArray(b.choices) || !b.choices.length)) return '주관식은 정답(허용 답)을 한 줄에 하나씩 입력하세요.';
  if (kind === 'mcq') {
    if (!Array.isArray(b.choices) || b.choices.length < 2) return '보기는 2개 이상이어야 합니다.';
    if (!Number.isInteger(b.answer) || b.answer < 0 || b.answer >= b.choices.length) return '정답 번호가 올바르지 않습니다.';
  }
  return null;
}
const qBind = (b) => [b.exam_type, b.section, b.kind || 'mcq', Math.max(1, Math.min(String(b.exam_type).startsWith('KR_') ? 6 : 5, +b.difficulty || 3)), b.passage || null, b.stem,
  b.image_svg || null, b.choices ? JSON.stringify(b.choices) : null, Number.isInteger(b.answer) ? b.answer : null, b.explanation || null, b.active === false ? 0 : 1];

app.post('/questions', async (c) => {
  const b = await c.req.json();
  const err = validateQ(b);
  if (err) return c.json({ error: err }, 400);
  const id = uid();
  await c.env.DB.prepare(
    `INSERT INTO questions (id,exam_type,section,kind,difficulty,passage,stem,image_svg,choices,answer,explanation,active,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, ...qBind(b), now()).run();
  return c.json({ ok: true, id });
});
app.put('/questions/:id', async (c) => {
  const b = await c.req.json();
  const err = validateQ(b);
  if (err) return c.json({ error: err }, 400);
  await c.env.DB.prepare(
    `UPDATE questions SET exam_type=?,section=?,kind=?,difficulty=?,passage=?,stem=?,image_svg=?,choices=?,answer=?,explanation=?,active=? WHERE id=?`
  ).bind(...qBind(b), c.req.param('id')).run();
  return c.json({ ok: true });
});
app.delete('/questions/:id', async (c) => {
  // soft-delete: answered questions must remain for old reports
  await c.env.DB.prepare('UPDATE questions SET active=0 WHERE id=?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});
app.post('/questions/import', async (c) => {
  const arr = await c.req.json();
  if (!Array.isArray(arr) || !arr.length || arr.length > 500) return c.json({ error: '1~500개의 문제 배열(JSON)이 필요합니다.' }, 400);
  const errors = [];
  const stmts = [];
  arr.forEach((b, i) => {
    const e = validateQ(b);
    if (e) errors.push(`#${i + 1}: ${e}`);
    else stmts.push(c.env.DB.prepare(
      `INSERT INTO questions (id,exam_type,section,kind,difficulty,passage,stem,image_svg,choices,answer,explanation,active,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(uid(), ...qBind(b), now()));
  });
  if (errors.length) return c.json({ error: errors.slice(0, 10).join('\n') }, 400);
  await c.env.DB.batch(stmts);
  return c.json({ ok: true, imported: stmts.length });
});

/* ---- manual grading (WIDA writing / speaking) ---- */
app.get('/grading', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT a.id,a.attempt_id,a.section,a.kind,a.text,a.audio_key,a.manual_score,a.feedback,a.graded_by,a.ai_status,a.ai_score,a.ai_feedback,a.ai_transcript,a.ai_model,t.exam_type,q.stem,q.passage,u.name,u.email
     FROM answers a JOIN attempts t ON t.id=a.attempt_id JOIN questions q ON q.id=a.question_id JOIN users u ON u.id=t.user_id
     WHERE a.kind IN ('text','audio') AND t.status!='in_progress' ORDER BY (a.manual_score IS NOT NULL), a.created_at DESC LIMIT 200`).all();
  return c.json({ items: results });
});
/* ---- AI grading (Claude; speaking transcribed with Workers AI) ---- */
app.get('/ai-grading', async (c) => {
  const counts = Object.fromEntries((await c.env.DB.prepare(`SELECT COALESCE(a.ai_status,'none') s, COUNT(*) n FROM answers a JOIN attempts t ON t.id=a.attempt_id
      WHERE a.kind IN ('text','audio') AND a.manual_score IS NULL AND t.status!='in_progress' GROUP BY 1`).all()).results.map((r) => [r.s, r.n]));
  return c.json({ configured: aiConfigured(c.env), speech: !!c.env.AI, mode: await aiMode(c.env), model: c.env.AI_MODEL || AI_MODEL_DEFAULT, pending: counts });
});
app.post('/ai-grading/mode', async (c) => {
  const { mode } = await c.req.json();
  if (!['review', 'auto', 'off'].includes(mode)) return c.json({ error: 'mode' }, 400);
  await c.env.DB.prepare(`INSERT INTO settings (key,value,updated_at) VALUES ('ai_grading_mode',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).bind(mode, now()).run();
  return c.json({ ok: true, mode });
});
app.post('/ai-grading/run', async (c) => { // grade the backlog now (in the background; the page polls)
  if (!aiConfigured(c.env)) return c.json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' }, 400);
  const job = gradePending(c.env, { limit: 20 }).catch((e) => console.error('ai run', e));
  try { c.executionCtx.waitUntil(job); } catch { await job; }
  return c.json({ ok: true });
});
app.post('/grading/:id/ai', async (c) => { // (re)grade one answer with AI, synchronously
  if (!aiConfigured(c.env)) return c.json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' }, 400);
  const id = c.req.param('id');
  await c.env.DB.prepare(`UPDATE answers SET ai_status=NULL WHERE id=? AND manual_score IS NULL AND ai_status!='running'`).bind(id).run();
  const ok = await gradeAnswer(c.env, id, { mode: 'review' });
  const r = await c.env.DB.prepare('SELECT ai_status,ai_score,ai_feedback,ai_transcript FROM answers WHERE id=?').bind(id).first();
  return c.json({ ok, ...r });
});
app.get('/audio/*', async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^\/api\/admin\/audio\//, ''));
  const o = await c.env.DB.prepare('SELECT content_type,data FROM audio_files WHERE key=?').bind(key).first();
  if (!o) return c.json({ error: 'not found' }, 404);
  const bin = atob(o.data), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const type = /^audio\/[a-z0-9.+-]+$/.test(o.content_type || '') ? o.content_type : 'audio/webm';
  return new Response(bytes, { headers: { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; media-src 'self'", 'Content-Disposition': 'inline; filename="answer.webm"' } });
});
app.post('/grading/:id', async (c) => {
  const b = await c.req.json();
  const score = Math.round(+b.score);
  if (!(score >= 1 && score <= 6)) return c.json({ error: '점수는 1~6입니다.' }, 400);
  const ans = await c.env.DB.prepare('SELECT * FROM answers WHERE id=?').bind(c.req.param('id')).first();
  if (!ans) return c.json({ error: 'not found' }, 404);
  await c.env.DB.prepare(`UPDATE answers SET manual_score=?, feedback=?, graded_by=? WHERE id=?`).bind(score, String(b.feedback || '').slice(0, 2000), b.fromAi ? 'ai+teacher' : 'teacher', ans.id).run();
  await regradeAttempt(c.env, ans.attempt_id);
  return c.json({ ok: true });
});

app.post('/users/:id/verify-email', async (c) => {
  await c.env.DB.prepare('UPDATE users SET email_verified_at=COALESCE(email_verified_at,?) WHERE id=?').bind(now(), c.req.param('id')).run();
  return c.json({ ok: true });
});
// Guardian consent confirmed outside the site (phone, signed form ...): record who confirmed it and how.
app.post('/users/:id/consent', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const note = String(b.note || '').trim().slice(0, 200);
  if (!note) return c.json({ error: '확인 방법(예: 보호자 전화 확인)을 적어 주세요.' }, 400);
  const id = c.req.param('id');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET consent_at=COALESCE(consent_at,?) WHERE id=?').bind(now(), id),
    c.env.DB.prepare('INSERT INTO guardian_consents (id,user_id,guardian_email,guardian_name,relation,method,ip,at) VALUES (?,?,(SELECT guardian_email FROM users WHERE id=?),?,?,?,?,?)')
      .bind(uid(), id, id, String(b.guardian_name || '').slice(0, 40) || null, note, 'admin', c.req.header('cf-connecting-ip') || null, now()),
  ]);
  return c.json({ ok: true });
});

/* ---- full backup (JSON). Voice recordings excluded. Contains personal data: keep the file safe. ---- */
app.get('/backup', async (c) => {
  const tables = ['users', 'products', 'orders', 'entitlements', 'attempts', 'answers', 'refund_requests', 'coupons', 'gift_codes', 'classes', 'class_members',
    'guardian_consents', 'share_links', 'support_tickets', 'support_messages', 'practice_log', 'settings', 'audit_log', 'questions'];
  const out = { app: 'mocktest', at: new Date().toISOString(), tables: {} };
  for (const t of tables) out.tables[t] = (await c.env.DB.prepare(`SELECT * FROM ${t}`).all()).results;
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="mocktest-backup-${out.at.slice(0, 10)}.json"` } });
});

/* ---- activity log: search, page, export ---- */
const CATS = { account: ['user.', 'login.', 'logout', 'password.', '2fa.', 'session.', 'profile.', 'account.'], exam: ['exam.', 'share.', 'shared.'], pay: ['order.', 'refund.'], admin: ['admin.'] };
function logQuery(q) {
  const where = [], args = [];
  if (q.q) { where.push('(actor_email LIKE ? OR actor_id=? OR target LIKE ? OR ip=? OR detail LIKE ?)'); const like = `%${q.q}%`; args.push(like, q.q, like, q.q, like); }
  if (CATS[q.cat]) { where.push('(' + CATS[q.cat].map(() => 'action LIKE ?').join(' OR ') + ')'); args.push(...CATS[q.cat].map((p) => p + '%')); }
  if (q.action) { where.push('action=?'); args.push(q.action); }
  if (q.from) { where.push('at>=?'); args.push(Date.parse(q.from + 'T00:00:00+09:00')); }
  if (q.to) { where.push('at<?'); args.push(Date.parse(q.to + 'T00:00:00+09:00') + 86400000); }
  if (q.before) { where.push('at<?'); args.push(+q.before); }
  return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', args };
}
app.get('/logs', async (c) => {
  const q = c.req.query(), lim = Math.min(200, +q.limit || 100);
  const { sql, args } = logQuery(q);
  const { results } = await c.env.DB.prepare(`SELECT * FROM audit_log ${sql} ORDER BY at DESC LIMIT ?`).bind(...args, lim + 1).all();
  const total = (await c.env.DB.prepare('SELECT COUNT(*) n FROM audit_log').first()).n;
  return c.json({ events: results.slice(0, lim), more: results.length > lim, total });
});
app.get('/logs.csv', async (c) => {
  const { sql, args } = logQuery(c.req.query());
  const { results } = await c.env.DB.prepare(`SELECT * FROM audit_log ${sql} ORDER BY at DESC LIMIT 50000`).bind(...args).all();
  const esc = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const rows = results.map((r) => [new Date(r.at).toISOString(), r.action, r.actor_email, r.actor_id, r.target, r.ip, r.detail].map(esc).join(','));
  return new Response('﻿' + ['time,action,user,user_id,target,ip,detail', ...rows].join('\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="activity-${new Date().toISOString().slice(0, 10)}.csv"` } });
});

/* ---- gift codes (events, partners, prizes) ---- */
app.get('/gift-codes', async (c) => c.json({ codes: (await c.env.DB.prepare(`SELECT g.*,p.title,(SELECT email FROM users WHERE id=g.redeemed_by) AS redeemed_email FROM gift_codes g JOIN products p ON p.id=g.product_id ORDER BY g.created_at DESC LIMIT 500`).all()).results }));
app.post('/gift-codes', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const p = await c.env.DB.prepare('SELECT id FROM products WHERE id=?').bind(b.productId).first();
  const n = Math.round(Number(b.count) || 1);
  if (!p || n < 1 || n > 200) return c.json({ error: '상품과 개수(1–200)를 확인하세요.' }, 400);
  const codes = [];
  for (let i = 0; i < n; i++) codes.push(giftCode());
  await c.env.DB.batch(codes.map((code) => c.env.DB.prepare('INSERT INTO gift_codes (code,product_id,order_id,created_by,note,expires_at,created_at) VALUES (?,?,NULL,?,?,?,?)')
    .bind(code, p.id, c.get('user').id, String(b.note || '').slice(0, 100), b.expires_at ? Number(b.expires_at) : null, now())));
  return c.json({ ok: true, codes });
});
app.post('/gift-codes/:code/revoke', async (c) => {
  await c.env.DB.prepare('UPDATE gift_codes SET revoked=1 WHERE code=? AND redeemed_by IS NULL').bind(c.req.param('code')).run();
  return c.json({ ok: true });
});

/* ---- 1:1 support ---- */
app.get('/support', async (c) => {
  const st = c.req.query('status') || 'open';
  const { results } = await c.env.DB.prepare(`SELECT t.*,u.email,u.name FROM support_tickets t JOIN users u ON u.id=t.user_id WHERE (?1='all' OR t.status=?1) ORDER BY t.updated_at DESC LIMIT 300`).bind(st).all();
  return c.json({ tickets: results });
});
app.get('/support/:id', async (c) => {
  const t = await c.env.DB.prepare('SELECT t.*,u.email,u.name FROM support_tickets t JOIN users u ON u.id=t.user_id WHERE t.id=?').bind(c.req.param('id')).first();
  if (!t) return c.json({ error: 'not found' }, 404);
  const { results } = await c.env.DB.prepare('SELECT staff,body,created_at FROM support_messages WHERE ticket_id=? ORDER BY created_at').bind(t.id).all();
  return c.json({ ticket: t, messages: results });
});
app.post('/support/:id/reply', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const t = await c.env.DB.prepare('SELECT t.*,u.email,u.name FROM support_tickets t JOIN users u ON u.id=t.user_id WHERE t.id=?').bind(c.req.param('id')).first();
  const body = String(b.body || '').trim().slice(0, 4000);
  if (!t || !body) return c.json({ error: '내용을 입력하세요.' }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO support_messages (id,ticket_id,user_id,staff,body,created_at) VALUES (?,?,?,1,?,?)').bind(uid(), t.id, c.get('user').id, body, now()),
    c.env.DB.prepare(`UPDATE support_tickets SET status='answered', updated_at=? WHERE id=?`).bind(now(), t.id),
  ]);
  c.executionCtx.waitUntil(sendMail(c.env, t.email, `[${c.env.SITE_NAME}] 문의 답변`, mailSupportReply(c.env, t.name, t.subject, t.id)));
  return c.json({ ok: true });
});
app.post('/support/:id/close', async (c) => {
  await c.env.DB.prepare(`UPDATE support_tickets SET status='closed', updated_at=? WHERE id=?`).bind(now(), c.req.param('id')).run();
  return c.json({ ok: true });
});

/* ---- charts: last 30 days (KST) ---- */
app.get('/stats/series', async (c) => {
  const since = now() - 30 * 86400000, day = `date((%s/1000)+32400,'unixepoch')`;
  const q = (sql) => c.env.DB.prepare(sql).bind(since).all().then((r) => r.results);
  const [rev, signups, atts, byExam, funnel] = await Promise.all([
    q(`SELECT ${day.replace('%s', 'paid_at')} d, SUM(CASE WHEN currency='KRW' THEN amount ELSE 0 END) krw, SUM(CASE WHEN currency='USD' THEN amount ELSE 0 END) usd, COUNT(*) n FROM orders WHERE status='paid' AND provider!='admin' AND paid_at>=? GROUP BY d`),
    q(`SELECT ${day.replace('%s', 'created_at')} d, COUNT(*) n FROM users WHERE created_at>=? AND parent_id IS NULL GROUP BY d`),
    q(`SELECT ${day.replace('%s', 'started_at')} d, COUNT(*) n FROM attempts WHERE started_at>=? GROUP BY d`),
    q(`SELECT p.exam_type, COUNT(*) n, SUM(CASE WHEN o.currency='KRW' THEN o.amount ELSE 0 END) krw FROM orders o JOIN products p ON p.id=o.product_id WHERE o.status='paid' AND o.provider!='admin' AND o.paid_at>=? GROUP BY p.exam_type ORDER BY krw DESC`),
    c.env.DB.prepare(`SELECT (SELECT COUNT(*) FROM users WHERE parent_id IS NULL AND role!='admin') users,
      (SELECT COUNT(*) FROM users WHERE parent_id IS NULL AND role!='admin' AND email_verified_at IS NOT NULL) verified,
      (SELECT COUNT(DISTINCT user_id) FROM orders WHERE status='paid' AND provider!='admin') buyers,
      (SELECT COUNT(*) FROM (SELECT user_id FROM orders WHERE status='paid' AND provider!='admin' GROUP BY user_id HAVING COUNT(*)>1)) repeat`).first(),
  ]);
  return c.json({ revenue: rev, signups, attempts: atts, byExam, funnel });
});

/* ---- coupons ---- */
app.get('/coupons', async (c) => c.json({ coupons: (await c.env.DB.prepare('SELECT * FROM coupons ORDER BY created_at DESC LIMIT 300').all()).results }));
app.post('/coupons', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const code = String(b.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,32}$/.test(code)) return c.json({ error: '쿠폰 코드는 영문 대문자·숫자 4–32자입니다.' }, 400);
  if (!['percent', 'amount'].includes(b.kind)) return c.json({ error: '할인 방식이 올바르지 않습니다.' }, 400);
  const value = Math.round(Number(b.value));
  if (b.kind === 'percent' ? !(value >= 1 && value <= 90) : !(value >= 100 && value <= 1000000)) return c.json({ error: b.kind === 'percent' ? '할인율은 1–90%입니다.' : '할인 금액은 100원 이상입니다.' }, 400);
  if (b.exam_type && !EXAMS[b.exam_type]) return c.json({ error: '시험 종류가 올바르지 않습니다.' }, 400);
  const maxUses = b.max_uses ? Math.max(1, Math.round(Number(b.max_uses))) : null;
  const exp = b.expires_at ? Number(b.expires_at) : null;
  await c.env.DB.prepare(`INSERT INTO coupons (code,kind,value,exam_type,max_uses,expires_at,active,note,created_at) VALUES (?,?,?,?,?,?,1,?,?)
    ON CONFLICT(code) DO UPDATE SET kind=excluded.kind,value=excluded.value,exam_type=excluded.exam_type,max_uses=excluded.max_uses,expires_at=excluded.expires_at,active=1,note=excluded.note`)
    .bind(code, b.kind, value, b.exam_type || null, maxUses, exp, String(b.note || '').slice(0, 100), now()).run();
  return c.json({ ok: true });
});
app.post('/coupons/:code/toggle', async (c) => {
  await c.env.DB.prepare('UPDATE coupons SET active=1-active WHERE code=?').bind(c.req.param('code')).run();
  return c.json({ ok: true });
});

/* ---- site notice banner ---- */
app.post('/notice', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const text = String(b.text || '').trim().slice(0, 300);
  await c.env.DB.prepare(`INSERT INTO settings (key,value,updated_at) VALUES ('notice',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).bind(text || null, now()).run();
  clearNoticeCache(); await purgeEdge(c, ['/api/config']);
  return c.json({ ok: true });
});

app.get('/manual-sections', async (c) => c.json({ manual: await manualSettings(c.env) }));
app.post('/manual-sections', async (c) => { // turn speaking / essay sections on or off for NEW attempts
  const b = await c.req.json().catch(() => ({}));
  const v = { speaking: !!b.speaking, essay: !!b.essay };
  await c.env.DB.prepare(`INSERT INTO settings (key,value,updated_at) VALUES ('manual_sections',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).bind(JSON.stringify(v), now()).run();
  clearManualCache(); clearNoticeCache(); await purgeEdge(c, ['/api/config', '/api/exam-info']);
  return c.json({ ok: true, manual: v });
});
app.get('/popup', async (c) => {
  const row = await c.env.DB.prepare(`SELECT value FROM settings WHERE key='popup'`).first();
  return c.json({ popup: row?.value ? JSON.parse(row.value) : { ...DEFAULT_POPUP, default: true } });
});
app.post('/popup', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (b.reset) { // back to the default 무통장입금 popup
    await c.env.DB.prepare(`DELETE FROM settings WHERE key='popup'`).run();
    clearNoticeCache(); await purgeEdge(c, ['/api/config']);
    return c.json({ ok: true, popup: { ...DEFAULT_POPUP, default: true } });
  }
  const v = { on: !!b.on, title: String(b.title || '').trim().slice(0, 60), body: String(b.body || '').trim().slice(0, 600) };
  await c.env.DB.prepare(`INSERT INTO settings (key,value,updated_at) VALUES ('popup',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).bind(JSON.stringify(v), now()).run();
  clearNoticeCache(); await purgeEdge(c, ['/api/config']);
  return c.json({ ok: true, popup: v });
});

/* ---- security overview + audit log ---- */
app.get('/security', async (c) => {
  const q = (s, ...a) => c.env.DB.prepare(s).bind(...a).all();
  const [admins, log, fails] = await Promise.all([
    q(`SELECT id,email,name,last_login_at,(totp_secret IS NOT NULL) AS twofa FROM users WHERE role='admin' AND status='active'`),
    q(`SELECT * FROM audit_log WHERE (?1='' OR action LIKE ?1 || '%') ORDER BY at DESC LIMIT 300`, String(c.req.query('action') || '')),
    q(`SELECT substr(key, instr(key,'|')+1) AS ip, COUNT(*) n FROM login_attempts WHERE at>? GROUP BY ip ORDER BY n DESC LIMIT 10`, now() - 3600000),
  ]);
  return c.json({
    admins: admins.results, log: log.results, failedLoginsByIp: fails.results,
    checks: {
      https: (c.env.SITE_URL || '').startsWith('https://'),
      turnstile: !!(c.env.TURNSTILE_SITE_KEY && c.env.TURNSTILE_SECRET),
      adminsWithout2fa: admins.results.filter((a) => !a.twofa).length,
      webhookSecrets: { stripe: !c.env.STRIPE_SECRET_KEY || !!c.env.STRIPE_WEBHOOK_SECRET, portone: !c.env.PORTONE_API_SECRET || !!c.env.PORTONE_WEBHOOK_SECRET },
    },
  });
});

export default app;
