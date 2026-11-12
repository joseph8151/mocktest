import { Hono } from 'hono';
import { uid, now, isEmail, randomToken, sha256hex } from '../lib/util.js';
import { hashPassword, verifyPassword, createSession, destroySession, loadUser, requireUser } from '../lib/auth.js';
import { sendMail, mailWelcome, mailReset } from '../lib/email.js';

const app = new Hono();

app.post('/register', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  const name = String(b.name || '').trim();
  const password = String(b.password || '');
  if (!isEmail(email)) return c.json({ error: '올바른 이메일을 입력하세요.' }, 400);
  if (name.length < 1 || name.length > 60) return c.json({ error: '이름을 입력하세요.' }, 400);
  if (password.length < 8) return c.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, 400);
  if (!b.agree) return c.json({ error: '이용약관에 동의해야 합니다.' }, 400);
  const exists = await c.env.DB.prepare('SELECT 1 FROM users WHERE email=?').bind(email).first();
  if (exists) return c.json({ error: '이미 가입된 이메일입니다.' }, 409);
  const { hash, salt } = await hashPassword(password);
  const id = uid();
  const role = c.env.ADMIN_EMAIL && email === c.env.ADMIN_EMAIL.toLowerCase() ? 'admin' : 'student';
  await c.env.DB.prepare(
    'INSERT INTO users (id,email,password_hash,salt,name,role,grade,phone,created_at,last_login_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(id, email, hash, salt, name, role, b.grade || null, b.phone || null, now(), now()).run();
  await createSession(c, id);
  c.executionCtx.waitUntil(sendMail(c.env, email, `[${c.env.SITE_NAME}] 가입을 환영합니다`, mailWelcome(c.env, name)));
  return c.json({ user: { id, email, name, role } });
});

app.post('/login', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  const u = await c.env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
  if (!u || !(await verifyPassword(String(b.password || ''), u.password_hash, u.salt)))
    return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
  if (u.status !== 'active') return c.json({ error: '정지된 계정입니다. 관리자에게 문의하세요.' }, 403);
  await createSession(c, u.id);
  await c.env.DB.prepare('UPDATE users SET last_login_at=? WHERE id=?').bind(now(), u.id).run();
  return c.json({ user: { id: u.id, email: u.email, name: u.name, role: u.role } });
});

app.post('/logout', async (c) => { await destroySession(c); return c.json({ ok: true }); });

app.get('/me', async (c) => c.json({ user: await loadUser(c) }));

app.patch('/me', requireUser, async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const u = c.get('user');
  await c.env.DB.prepare('UPDATE users SET name=?, grade=?, phone=? WHERE id=?')
    .bind(String(b.name || u.name).slice(0, 60), b.grade ?? u.grade, b.phone ?? u.phone, u.id).run();
  return c.json({ ok: true });
});

app.post('/password', requireUser, async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const u = c.get('user');
  const row = await c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(u.id).first();
  if (!(await verifyPassword(String(b.current || ''), row.password_hash, row.salt))) return c.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, 400);
  if (String(b.next || '').length < 8) return c.json({ error: '새 비밀번호는 8자 이상이어야 합니다.' }, 400);
  const { hash, salt } = await hashPassword(b.next);
  await c.env.DB.prepare('UPDATE users SET password_hash=?, salt=? WHERE id=?').bind(hash, salt, u.id).run();
  return c.json({ ok: true });
});

app.post('/forgot', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  const u = await c.env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  if (u) {
    const token = randomToken();
    await c.env.DB.prepare('INSERT INTO reset_tokens (token_hash,user_id,expires_at) VALUES (?,?,?)')
      .bind(await sha256hex(token), u.id, now() + 3600000).run();
    const link = `${c.env.SITE_URL}/#/reset/${token}`;
    c.executionCtx.waitUntil(sendMail(c.env, email, `[${c.env.SITE_NAME}] 비밀번호 재설정`, mailReset(c.env, link)));
  }
  return c.json({ ok: true }); // never reveal whether the account exists
});

app.post('/reset', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (String(b.password || '').length < 8) return c.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, 400);
  const th = await sha256hex(String(b.token || ''));
  const t = await c.env.DB.prepare('SELECT * FROM reset_tokens WHERE token_hash=? AND expires_at>?').bind(th, now()).first();
  if (!t) return c.json({ error: '만료되었거나 잘못된 링크입니다.' }, 400);
  const { hash, salt } = await hashPassword(b.password);
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET password_hash=?, salt=? WHERE id=?').bind(hash, salt, t.user_id),
    c.env.DB.prepare('DELETE FROM reset_tokens WHERE user_id=?').bind(t.user_id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(t.user_id),
  ]);
  return c.json({ ok: true });
});

export default app;
