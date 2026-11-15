import { Hono } from 'hono';
import { deleteCookie, getCookie } from 'hono/cookie';
import { uid, now, isEmail, randomToken, sha256hex } from '../lib/util.js';
import { hashPassword, verifyPassword, createSession, destroySession, loadUser, requireUser } from '../lib/auth.js';
import { sendMail, mailWelcome, mailReset } from '../lib/email.js';
import { clientIp, rateLimited, tooMany, audit, passwordProblem, turnstileOk, newTotpSecret, totpVerify, otpauthUri } from '../lib/security.js';

const app = new Hono();

app.post('/register', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  const name = String(b.name || '').trim();
  const password = String(b.password || '');
  if (!isEmail(email)) return c.json({ error: '올바른 이메일을 입력하세요.' }, 400);
  if (name.length < 1 || name.length > 60) return c.json({ error: '이름을 입력하세요.' }, 400);
  const pwErr = passwordProblem(password, email); if (pwErr) return c.json({ error: pwErr }, 400);
  if (!b.agree) return c.json({ error: '이용약관에 동의해야 합니다.' }, 400);
  if (!(await turnstileOk(c, b['cf-turnstile-response']))) return c.json({ error: '자동 가입 방지 확인에 실패했습니다. 다시 시도해 주세요.' }, 400);
  if (await rateLimited(c.env, `register|${clientIp(c)}`, 30, 3600000)) return tooMany(c, '가입 시도가 너무 많습니다. 1시간 후 다시 시도해 주세요.');
  const exists = await c.env.DB.prepare('SELECT 1 FROM users WHERE email=?').bind(email).first();
  if (exists) return c.json({ error: '이미 가입된 이메일입니다.' }, 409);
  const { hash, salt } = await hashPassword(password);
  const id = uid();
  // Admin: the configured ADMIN_EMAIL; if none is configured, the very first account becomes admin.
  const adminEmail = (c.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const configured = adminEmail && adminEmail !== 'admin@example.com';
  let role = 'student';
  // Bootstrap only while no admin exists (the last admin cannot be removed), so the role can never be claimed later.
  if (!(await c.env.DB.prepare(`SELECT 1 FROM users WHERE role='admin' LIMIT 1`).first())) role = configured ? (email === adminEmail ? 'admin' : 'student') : 'admin';
  await c.env.DB.prepare(
    'INSERT INTO users (id,email,password_hash,salt,name,role,grade,phone,created_at,last_login_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(id, email, hash, salt, name, role, String(b.grade || '').slice(0, 20) || null, String(b.phone || '').slice(0, 30) || null, now(), now()).run();
  await createSession(c, id, role);
  if (role === 'admin') await audit(c, 'admin.bootstrap', id, 'first administrator account', { id, email });
  c.executionCtx.waitUntil(sendMail(c.env, email, `[${c.env.SITE_NAME}] 가입을 환영합니다`, mailWelcome(c.env, name)));
  return c.json({ user: { id, email, name, role } });
});

app.post('/login', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  const key = `${email}|${c.req.header('cf-connecting-ip') || 'local'}`;
  const since = now() - 15 * 60000;
  const fails = await c.env.DB.prepare('SELECT COUNT(*) n FROM login_attempts WHERE key=? AND at>?').bind(key, since).first();
  if (fails.n >= 8) return c.json({ error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요.' }, 429);
  const u = await c.env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
  if (!u || !(await verifyPassword(String(b.password || ''), u.password_hash, u.salt))) {
    await c.env.DB.prepare('INSERT INTO login_attempts (key,at) VALUES (?,?)').bind(key, now()).run();
    c.executionCtx.waitUntil(c.env.DB.prepare('DELETE FROM login_attempts WHERE at<?').bind(now() - 3600000).run());
    return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
  }
  if (u.status !== 'active') return c.json({ error: '정지된 계정입니다. 관리자에게 문의하세요.' }, 403);
  if (u.totp_secret) { // second factor
    if (!b.code) return c.json({ error: '인증 앱의 6자리 코드를 입력하세요.', need2fa: true }, 401);
    const step = await totpVerify(u.totp_secret, b.code, u.totp_last);
    if (!step) {
      await c.env.DB.prepare('INSERT INTO login_attempts (key,at) VALUES (?,?)').bind(key, now()).run();
      await audit(c, 'login.2fa_failed', u.id, null, u);
      return c.json({ error: '인증 코드가 올바르지 않습니다.', need2fa: true }, 401);
    }
    await c.env.DB.prepare('UPDATE users SET totp_last=? WHERE id=?').bind(step, u.id).run();
  }
  await c.env.DB.prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run();
  await createSession(c, u.id, u.role);
  if (u.role === 'admin') await audit(c, 'admin.login', u.id, String(c.req.header('user-agent') || '').slice(0, 120), u);
  await c.env.DB.prepare('UPDATE users SET last_login_at=? WHERE id=?').bind(now(), u.id).run();
  return c.json({ user: { id: u.id, email: u.email, name: u.name, role: u.role } });
});

app.post('/logout', async (c) => { await destroySession(c); return c.json({ ok: true }); });

app.get('/me', async (c) => c.json({ user: await loadUser(c) }));

app.patch('/me', requireUser, async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const u = c.get('user');
  await c.env.DB.prepare('UPDATE users SET name=?, grade=?, phone=? WHERE id=?')
    .bind(String(b.name || u.name).slice(0, 60), String(b.grade ?? u.grade ?? '').slice(0, 20) || null, String(b.phone ?? u.phone ?? '').slice(0, 30) || null, u.id).run();
  return c.json({ ok: true });
});

app.post('/password', requireUser, async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const u = c.get('user');
  const row = await c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(u.id).first();
  if (!(await verifyPassword(String(b.current || ''), row.password_hash, row.salt))) return c.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, 400);
  const pwErr = passwordProblem(b.next, u.email); if (pwErr) return c.json({ error: pwErr }, 400);
  const { hash, salt } = await hashPassword(b.next);
  await c.env.DB.prepare('UPDATE users SET password_hash=?, salt=? WHERE id=?').bind(hash, salt, u.id).run();
  const cur = await sha256hex(getCookie(c, 'sid') || '');
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash!=?').bind(u.id, cur).run(); // sign out other devices
  await audit(c, 'password.change', u.id);
  return c.json({ ok: true });
});

app.post('/delete', requireUser, async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const u = c.get('user');
  if (u.role === 'admin') return c.json({ error: '관리자 계정은 탈퇴할 수 없습니다. 먼저 권한을 해제하세요.' }, 400);
  const row = await c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(u.id).first();
  if (!(await verifyPassword(String(b.password || ''), row.password_hash, row.salt))) return c.json({ error: '비밀번호가 올바르지 않습니다.' }, 400);
  const { hash, salt } = await hashPassword(randomToken());
  // Personal data is erased; paid orders are kept (anonymised) for the 5-year commerce-law retention.
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM audio_files WHERE attempt_id IN (SELECT id FROM attempts WHERE user_id=?)').bind(u.id), // recorded voice answers
    c.env.DB.prepare('DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE user_id=?)').bind(u.id),
    c.env.DB.prepare('DELETE FROM attempts WHERE user_id=?').bind(u.id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id),
    c.env.DB.prepare('DELETE FROM reset_tokens WHERE user_id=?').bind(u.id),
    c.env.DB.prepare(`UPDATE users SET email=?, name='탈퇴회원', phone=NULL, grade=NULL, status='suspended', password_hash=?, salt=? WHERE id=?`)
      .bind(`deleted-${u.id}@deleted.invalid`, hash, salt, u.id),
  ]);
  deleteCookie(c, 'sid', { path: '/' });
  return c.json({ ok: true });
});

app.post('/forgot', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  if (!(await turnstileOk(c, b['cf-turnstile-response']))) return c.json({ error: '자동 요청 방지 확인에 실패했습니다.' }, 400);
  if (await rateLimited(c.env, `forgot|${clientIp(c)}`, 10, 3600000)) return tooMany(c);
  const u = await c.env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  if (u && !(await rateLimited(c.env, `forgot-mail|${email}`, 3, 3600000))) { // at most 3 mails/hour per address
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
  if (await rateLimited(c.env, `reset|${clientIp(c)}`, 20, 3600000)) return tooMany(c);
  const th = await sha256hex(String(b.token || ''));
  const t = await c.env.DB.prepare('SELECT * FROM reset_tokens WHERE token_hash=? AND expires_at>?').bind(th, now()).first();
  if (!t) return c.json({ error: '만료되었거나 잘못된 링크입니다.' }, 400);
  const owner = await c.env.DB.prepare('SELECT id,email FROM users WHERE id=?').bind(t.user_id).first();
  const pwErr = passwordProblem(b.password, owner?.email); if (pwErr) return c.json({ error: pwErr }, 400);
  const { hash, salt } = await hashPassword(b.password);
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET password_hash=?, salt=? WHERE id=?').bind(hash, salt, t.user_id),
    c.env.DB.prepare('DELETE FROM reset_tokens WHERE user_id=?').bind(t.user_id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(t.user_id),
  ]);
  await audit(c, 'password.reset', t.user_id, null, owner);
  return c.json({ ok: true });
});

/* ---- signed-in devices ---- */
app.get('/sessions', requireUser, async (c) => {
  const cur = await sha256hex(getCookie(c, 'sid') || '');
  const { results } = await c.env.DB.prepare('SELECT token_hash,created_at,last_seen,ip,ua,expires_at FROM sessions WHERE user_id=? AND expires_at>? ORDER BY last_seen DESC')
    .bind(c.get('user').id, now()).all();
  // The id is a prefix of the token HASH (not the token), enough to revoke without exposing anything reusable.
  return c.json({ sessions: results.map((s) => ({ id: s.token_hash.slice(0, 16), current: s.token_hash === cur, created_at: s.created_at, last_seen: s.last_seen, ip: s.ip, ua: s.ua, expires_at: s.expires_at })) });
});
app.post('/sessions/revoke', requireUser, async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const u = c.get('user'), cur = await sha256hex(getCookie(c, 'sid') || '');
  if (b.all) await c.env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash!=?').bind(u.id, cur).run();
  else if (/^[0-9a-f]{16}$/.test(String(b.id || ''))) await c.env.DB.prepare(`DELETE FROM sessions WHERE user_id=? AND substr(token_hash,1,16)=? AND token_hash!=?`).bind(u.id, b.id, cur).run();
  else return c.json({ error: 'bad id' }, 400);
  await audit(c, 'session.revoke', u.id, b.all ? 'all others' : b.id);
  return c.json({ ok: true });
});

/* ---- two-factor authentication (TOTP: Google Authenticator, Microsoft Authenticator, 1Password ...) ---- */
const pwOk = async (c, password) => {
  const row = await c.env.DB.prepare('SELECT password_hash,salt FROM users WHERE id=?').bind(c.get('user').id).first();
  return verifyPassword(String(password || ''), row.password_hash, row.salt);
};
app.post('/2fa/setup', requireUser, async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const u = c.get('user');
  if (await rateLimited(c.env, `2fa|${u.id}`, 10, 600000)) return tooMany(c);
  if (!(await pwOk(c, b.password))) return c.json({ error: '비밀번호가 올바르지 않습니다.' }, 400);
  const secret = newTotpSecret();
  await c.env.DB.prepare('UPDATE users SET totp_pending=? WHERE id=?').bind(secret, u.id).run();
  return c.json({ secret, uri: otpauthUri(c.env.SITE_NAME || 'MockTest', u.email, secret) });
});
app.post('/2fa/enable', requireUser, async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const u = c.get('user');
  if (await rateLimited(c.env, `2fa|${u.id}`, 10, 600000)) return tooMany(c);
  const row = await c.env.DB.prepare('SELECT totp_pending FROM users WHERE id=?').bind(u.id).first();
  if (!row?.totp_pending) return c.json({ error: '먼저 설정을 시작하세요.' }, 400);
  const step = await totpVerify(row.totp_pending, b.code);
  if (!step) return c.json({ error: '코드가 올바르지 않습니다. 앱에 표시된 최신 6자리를 입력하세요.' }, 400);
  const cur = await sha256hex(getCookie(c, 'sid') || '');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET totp_secret=totp_pending, totp_pending=NULL, totp_last=? WHERE id=?').bind(step, u.id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash!=?').bind(u.id, cur), // other devices must sign in with the code
  ]);
  await audit(c, '2fa.enable', u.id);
  return c.json({ ok: true });
});
app.post('/2fa/disable', requireUser, async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const u = c.get('user');
  if (await rateLimited(c.env, `2fa|${u.id}`, 10, 600000)) return tooMany(c);
  const row = await c.env.DB.prepare('SELECT totp_secret,totp_last FROM users WHERE id=?').bind(u.id).first();
  if (!row?.totp_secret) return c.json({ ok: true });
  if (!(await pwOk(c, b.password)) || !(await totpVerify(row.totp_secret, b.code, row.totp_last))) return c.json({ error: '비밀번호 또는 인증 코드가 올바르지 않습니다.' }, 400);
  await c.env.DB.prepare('UPDATE users SET totp_secret=NULL, totp_pending=NULL, totp_last=NULL WHERE id=?').bind(u.id).run();
  await audit(c, '2fa.disable', u.id);
  return c.json({ ok: true });
});

export default app;
