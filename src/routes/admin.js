import { Hono } from 'hono';
import { uid, now } from '../lib/util.js';
import { requireAdmin } from '../lib/auth.js';
import { EXAMS, scoreAttempt } from '../lib/exam.js';
import { stripeRetrieveSession, stripeRefund, portoneCancel } from '../lib/payments.js';
import { notifyResult } from './exams.js';

const app = new Hono();
app.use('*', requireAdmin);

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
  return c.json({ users: users.n, paidOrders: paid.n, revenue: revenue.results, attempts: attempts.n, pendingGrading: pending.n, questions: qs.n });
});

/* ---- members ---- */
app.get('/users', async (c) => {
  const s = `%${c.req.query('q') || ''}%`;
  const { results } = await c.env.DB.prepare(
    `SELECT id,email,name,role,status,grade,phone,created_at,last_login_at FROM users
     WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT 200`).bind(s, s).all();
  return c.json({ users: results });
});
app.get('/users/:id', async (c) => {
  const id = c.req.param('id');
  const [user, ents, orders, atts] = await Promise.all([
    c.env.DB.prepare('SELECT id,email,name,role,status,grade,phone,created_at,last_login_at FROM users WHERE id=?').bind(id).first(),
    c.env.DB.prepare('SELECT * FROM entitlements WHERE user_id=? ORDER BY created_at DESC').bind(id).all(),
    c.env.DB.prepare('SELECT o.*,p.title FROM orders o JOIN products p ON p.id=o.product_id WHERE o.user_id=? ORDER BY o.created_at DESC').bind(id).all(),
    c.env.DB.prepare('SELECT id,exam_type,status,started_at,finished_at FROM attempts WHERE user_id=? ORDER BY started_at DESC').bind(id).all(),
  ]);
  return c.json({ user, entitlements: ents.results, orders: orders.results, attempts: atts.results });
});
app.patch('/users/:id', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const id = c.req.param('id');
  if (id === c.get('user').id && (b.role === 'student' || b.status === 'suspended')) return c.json({ error: '자기 자신은 변경할 수 없습니다.' }, 400);
  if (b.role && !['student', 'admin'].includes(b.role)) return c.json({ error: 'bad role' }, 400);
  if (b.status && !['active', 'suspended'].includes(b.status)) return c.json({ error: 'bad status' }, 400);
  await c.env.DB.prepare('UPDATE users SET role=COALESCE(?,role), status=COALESCE(?,status), name=COALESCE(?,name), grade=COALESCE(?,grade) WHERE id=?')
    .bind(b.role || null, b.status || null, b.name || null, b.grade ?? null, id).run();
  if (b.status === 'suspended') await c.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run();
  return c.json({ ok: true });
});
app.delete('/users/:id', async (c) => {
  const id = c.req.param('id');
  if (id === c.get('user').id) return c.json({ error: '자기 자신은 삭제할 수 없습니다.' }, 400);
  const hasOrders = await c.env.DB.prepare(`SELECT 1 FROM orders WHERE user_id=? AND status='paid'`).bind(id).first();
  if (hasOrders) return c.json({ error: '결제 내역이 있는 회원은 삭제 대신 정지하세요.' }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE user_id=?)').bind(id),
    c.env.DB.prepare('DELETE FROM attempts WHERE user_id=?').bind(id),
    c.env.DB.prepare('DELETE FROM entitlements WHERE user_id=?').bind(id),
    c.env.DB.prepare('DELETE FROM orders WHERE user_id=?').bind(id),
    c.env.DB.prepare('DELETE FROM users WHERE id=?').bind(id),
  ]);
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
    `SELECT o.*,u.email,u.name,p.title FROM orders o JOIN users u ON u.id=o.user_id JOIN products p ON p.id=o.product_id
     ORDER BY o.created_at DESC LIMIT 300`).all();
  return c.json({ orders: results });
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
  }
  if (!ok) return c.json({ error: 'PG사 환불 처리에 실패했습니다.' }, 502);
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE orders SET status='refunded' WHERE id=?`).bind(o.id),
    c.env.DB.prepare(`UPDATE entitlements SET revoked=1 WHERE order_id=?`).bind(o.id),
  ]);
  return c.json({ ok: true });
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
     ORDER BY created_at DESC LIMIT 300`).bind(exam || null, section || null, q ? `%${q}%` : null).all();
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
  if (kind === 'mcq') {
    if (!Array.isArray(b.choices) || b.choices.length < 2) return '보기는 2개 이상이어야 합니다.';
    if (!Number.isInteger(b.answer) || b.answer < 0 || b.answer >= b.choices.length) return '정답 번호가 올바르지 않습니다.';
  }
  return null;
}
const qBind = (b) => [b.exam_type, b.section, b.kind || 'mcq', Math.max(1, Math.min(5, +b.difficulty || 3)), b.passage || null, b.stem,
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
    `SELECT a.id,a.attempt_id,a.section,a.kind,a.text,a.audio_key,a.manual_score,a.feedback,q.stem,q.passage,u.name,u.email
     FROM answers a JOIN attempts t ON t.id=a.attempt_id JOIN questions q ON q.id=a.question_id JOIN users u ON u.id=t.user_id
     WHERE a.kind IN ('text','audio') AND t.status!='in_progress' ORDER BY (a.manual_score IS NOT NULL), a.created_at DESC LIMIT 200`).all();
  return c.json({ items: results });
});
app.get('/audio/*', async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^\/api\/admin\/audio\//, ''));
  const o = await c.env.AUDIO.get(key);
  if (!o) return c.json({ error: 'not found' }, 404);
  return new Response(o.body, { headers: { 'Content-Type': o.httpMetadata?.contentType || 'audio/webm' } });
});
app.post('/grading/:id', async (c) => {
  const b = await c.req.json();
  const score = Math.round(+b.score);
  if (!(score >= 1 && score <= 6)) return c.json({ error: '점수는 1~6입니다.' }, 400);
  const ans = await c.env.DB.prepare('SELECT * FROM answers WHERE id=?').bind(c.req.param('id')).first();
  if (!ans) return c.json({ error: 'not found' }, 404);
  await c.env.DB.prepare('UPDATE answers SET manual_score=?, feedback=? WHERE id=?').bind(score, String(b.feedback || '').slice(0, 2000), ans.id).run();
  const att = await c.env.DB.prepare('SELECT * FROM attempts WHERE id=?').bind(ans.attempt_id).first();
  const { results } = await c.env.DB.prepare('SELECT * FROM answers WHERE attempt_id=?').bind(att.id).all();
  const sc = scoreAttempt(att.exam_type, results);
  const status = att.status === 'in_progress' ? 'in_progress' : sc.pendingManual ? 'submitted' : 'graded';
  await c.env.DB.prepare('UPDATE attempts SET score=?, status=? WHERE id=?').bind(JSON.stringify(sc), status, att.id).run();
  if (status === 'graded' && att.status === 'submitted') await notifyResult(c.env, att);
  return c.json({ ok: true });
});

export default app;
