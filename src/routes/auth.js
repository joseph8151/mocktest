import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { uid, now, isEmail, randomToken, sha256hex, timingSafeEqual } from '../lib/util.js';
import { hashPassword, verifyPassword, createSession, destroySession, loadUser, requireUser, accountGate } from '../lib/auth.js';
import { operatorAlert } from '../lib/notify.js';
import { sendMail, mailWelcome, mailReset, mailVerify, mailConsent } from '../lib/email.js';
import { clientIp, rateLimited, tooMany, audit, maskEmail, passwordProblem, turnstileOk, newTotpSecret, totpVerify, otpauthUri } from '../lib/security.js';

const app = new Hono();

/** One-time link tokens (e-mail verification, guardian consent). Only the hash is stored. */
export async function issueToken(env, purpose, userId, ttlMs, data = null) {
  const token = randomToken(24);
  await env.DB.prepare('INSERT INTO tokens (token_hash,purpose,user_id,data,expires_at,created_at) VALUES (?,?,?,?,?,?)')
    .bind(await sha256hex(token), purpose, userId, data ? JSON.stringify(data) : null, now() + ttlMs, now()).run();
  return token;
}
async function readToken(env, purpose, token) {
  if (!/^[0-9a-f]{48}$/.test(String(token || ''))) return null;
  return env.DB.prepare('SELECT * FROM tokens WHERE token_hash=? AND purpose=? AND expires_at>? AND used_at IS NULL').bind(await sha256hex(token), purpose, now()).first();
}
async function sendVerify(c, u) {
  const t = await issueToken(c.env, 'verify_email', u.id, 48 * 3600000);
  return sendMail(c.env, u.email, `[${c.env.SITE_NAME}] 이메일 인증`, mailVerify(c.env, u.name, `${c.env.SITE_URL}/#/verify/${t}`));
}
async function sendConsent(c, u, guardianEmail) {
  const t = await issueToken(c.env, 'guardian_consent', u.id, 7 * 86400000, { guardianEmail });
  return sendMail(c.env, guardianEmail, `[${c.env.SITE_NAME}] 자녀 가입 동의 요청`, mailConsent(c.env, u.name, `${c.env.SITE_URL}/#/consent/${t}`));
}
// Equalise timing for unknown e-mails so response time does not reveal whether an account exists.
let dummy = null;
const dummyVerify = async (pw) => { dummy ||= await hashPassword('dummy-password-for-timing'); await verifyPassword(pw, dummy.hash, dummy.salt); return false; };

/** Statements that de-identify an account but keep its history (results, orders, activity log). Voice recordings are deleted. */
export const anonymizeUser = (db, id, hash, salt) => [
  db.prepare('DELETE FROM audio_files WHERE attempt_id IN (SELECT id FROM attempts WHERE user_id=?)').bind(id), // voice = personal data
  db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id),
  db.prepare('DELETE FROM reset_tokens WHERE user_id=?').bind(id),
  db.prepare('UPDATE share_links SET revoked_at=?, expires_at=? WHERE user_id=? AND revoked_at IS NULL').bind(now(), now(), id),
  db.prepare(`UPDATE users SET email=?, name='탈퇴회원', phone=NULL, grade=NULL, status='suspended', deleted_at=?, totp_secret=NULL, totp_pending=NULL, password_hash=?, salt=? WHERE id=?`)
    .bind(`deleted-${id}@deleted.invalid`, now(), hash, salt, id),
  db.prepare(`UPDATE audit_log SET actor_email='(탈퇴회원)' WHERE actor_id=?`).bind(id),
];

app.post('/register', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  const name = String(b.name || '').trim();
  const password = String(b.password || '');
  if (!isEmail(email)) return c.json({ error: '올바른 이메일을 입력하세요.' }, 400);
  if (name.length < 1 || name.length > 60) return c.json({ error: '이름을 입력하세요.' }, 400);
  const pwErr = passwordProblem(password, email); if (pwErr) return c.json({ error: pwErr }, 400);
  if (!b.agree) return c.json({ error: '이용약관에 동의해야 합니다.' }, 400);
  const under14 = b.under14 === true || b.under14 === '1' || b.under14 === 'on';
  const guardianEmail = String(b.guardian_email || '').trim().toLowerCase();
  if (under14 && (!isEmail(guardianEmail) || guardianEmail === email)) return c.json({ error: '만 14세 미만은 보호자(부모님) 이메일을 입력해야 합니다. 본인 이메일과 달라야 합니다.' }, 400);
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
    'INSERT INTO users (id,email,password_hash,salt,name,role,grade,phone,created_at,last_login_at,email_verified_at,under14,guardian_email) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(id, email, hash, salt, name, role, String(b.grade || '').slice(0, 20) || null, String(b.phone || '').slice(0, 30) || null, now(), now(),
    c.env.RESEND_API_KEY && role !== 'admin' ? null : now(), under14 ? 1 : 0, under14 ? guardianEmail : null).run();
  await createSession(c, id, role);
  await audit(c, 'user.register', id, { role, grade: b.grade || null, ua: String(c.req.header('user-agent') || '').slice(0, 120) }, { id, email });
  if (role === 'admin') await audit(c, 'admin.bootstrap', id, 'first administrator account', { id, email });
  c.executionCtx.waitUntil(sendMail(c.env, email, `[${c.env.SITE_NAME}] 가입을 환영합니다`, mailWelcome(c.env, name)));
  if (role !== 'admin') c.executionCtx.waitUntil(operatorAlert(c.env, '새 회원가입', { 이름: name, 이메일: email, 학년: b.grade || '-', 연락처: b.phone || '-', '만 14세 미만': under14 ? '예 (보호자 동의 필요)' : '아니오', 가입방법: '이메일' }));
  if (c.env.RESEND_API_KEY && role !== 'admin') c.executionCtx.waitUntil(sendVerify(c, { id, email, name }));
  if (under14) { await sendConsent(c, { id, email, name }, guardianEmail); await audit(c, 'consent.requested', id, { guardian: maskEmail(guardianEmail) }, { id, email }); }
  return c.json({ user: { id, email, name, role } });
});

app.post('/login', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  const key = `${email}|${c.req.header('cf-connecting-ip') || 'local'}`;
  const since = now() - 15 * 60000;
  const fails = await c.env.DB.prepare('SELECT COUNT(*) n FROM login_attempts WHERE key=? AND at>?').bind(key, since).first();
  if (fails.n >= 8) { await audit(c, 'login.fail', null, { email: maskEmail(email), reason: 'locked' }, null); return c.json({ error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요.' }, 429); }
  const u = await c.env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
  if (!u ? await dummyVerify(String(b.password || '')) || true : !(await verifyPassword(String(b.password || ''), u.password_hash, u.salt))) {
    await c.env.DB.prepare('INSERT INTO login_attempts (key,at) VALUES (?,?)').bind(key, now()).run();
    c.executionCtx.waitUntil(c.env.DB.prepare('DELETE FROM login_attempts WHERE at<?').bind(now() - 3600000).run()); // throttle counters only; the attempt itself is in the activity log
    await audit(c, 'login.fail', u?.id || null, { email: maskEmail(email), reason: u ? 'bad_password' : 'unknown_email' }, u ? { id: u.id, email: u.email } : null);
    return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
  }
  if (u.status !== 'active') { await audit(c, 'login.fail', u.id, { reason: 'suspended' }, u); return c.json({ error: '정지된 계정입니다. 관리자에게 문의하세요.' }, 403); }
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
  if (u.parent_id) return c.json({ error: '자녀 프로필은 보호자 계정에서 “프로필 전환”으로 이용합니다.' }, 403);
  const { evicted } = await createSession(c, u.id, u.role);
  await audit(c, u.role === 'admin' ? 'admin.login' : 'login.success', u.id, { twofa: !!u.totp_secret, ua: String(c.req.header('user-agent') || '').slice(0, 120), ...(evicted ? { signedOutOldest: evicted } : {}) }, u);
  await c.env.DB.prepare('UPDATE users SET last_login_at=? WHERE id=?').bind(now(), u.id).run();
  return c.json({ user: { id: u.id, email: u.email, name: u.name, role: u.role } });
});

app.post('/logout', async (c) => { const u = await loadUser(c); if (u) await audit(c, 'logout', u.id); await destroySession(c); return c.json({ ok: true }); });

app.get('/me', async (c) => {
  const u = await loadUser(c);
  if (!u) return c.json({ user: null });
  const { email_verified_at, consent_at, under14, guardian_email, kakao_id, ...rest } = u;
  return c.json({ user: { ...rest, emailVerified: !!email_verified_at, under14: !!under14, consent: !!consent_at, guardianEmail: guardian_email ? maskEmail(guardian_email) : null, kakao: !!kakao_id, isChild: !!u.parent_id, actingParent: !!u.acting_parent, gate: accountGate(c.env, u)?.code || null } });
});

/* ---- Kakao login (REST API key from developers.kakao.com; Redirect URI = <site>/api/auth/kakao/callback) ---- */
const kakaoRedirect = (c) => `${c.env.SITE_URL}/api/auth/kakao/callback`;
app.get('/kakao/start', (c) => {
  if (!c.env.KAKAO_REST_KEY) return c.redirect('/#/login', 302);
  const state = randomToken(16);
  setCookie(c, 'kst', state, { httpOnly: true, secure: new URL(c.req.url).protocol === 'https:', sameSite: 'Lax', path: '/api/auth/kakao', maxAge: 600 });
  const q = new URLSearchParams({ client_id: c.env.KAKAO_REST_KEY, redirect_uri: kakaoRedirect(c), response_type: 'code', state, scope: 'account_email,profile_nickname' });
  return c.redirect(`https://kauth.kakao.com/oauth/authorize?${q}`, 302);
});
app.get('/kakao/callback', async (c) => {
  const fail = (m) => c.redirect(`/#/login?msg=${encodeURIComponent(m)}`, 302);
  const { code, state, error } = c.req.query();
  const saved = getCookie(c, 'kst') || '';
  deleteCookie(c, 'kst', { path: '/api/auth/kakao' });
  if (error || !code) return fail('카카오 로그인이 취소되었습니다.');
  if (!state || !saved || !timingSafeEqual(state, saved)) return fail('로그인 요청이 만료되었습니다. 다시 시도해 주세요.');
  if (await rateLimited(c.env, `kakao|${clientIp(c)}`, 30, 600000)) return fail('잠시 후 다시 시도해 주세요.');
  try {
    const tok = await (await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: c.env.KAKAO_REST_KEY, redirect_uri: kakaoRedirect(c), code, ...(c.env.KAKAO_CLIENT_SECRET ? { client_secret: c.env.KAKAO_CLIENT_SECRET } : {}) }),
    })).json();
    if (!tok.access_token) return fail('카카오 인증에 실패했습니다.');
    const me = await (await fetch('https://kapi.kakao.com/v2/user/me', { headers: { Authorization: `Bearer ${tok.access_token}` } })).json();
    const kid = String(me.id || ''), acc = me.kakao_account || {};
    if (!kid) return fail('카카오 사용자 정보를 받지 못했습니다.');
    const email = acc.email && acc.is_email_valid && acc.is_email_verified ? String(acc.email).toLowerCase() : null;
    let u = await c.env.DB.prepare('SELECT * FROM users WHERE kakao_id=?').bind(kid).first();
    let created = false;
    if (!u && email) {
      u = await c.env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
      if (u) { // link to the existing account with the same verified e-mail
        if (u.totp_secret) return fail('2단계 인증을 사용하는 계정은 이메일로 로그인해 주세요.');
        await c.env.DB.prepare('UPDATE users SET kakao_id=?, email_verified_at=COALESCE(email_verified_at,?) WHERE id=?').bind(kid, now(), u.id).run();
        await audit(c, 'kakao.link', u.id, null, u);
      }
    }
    if (!u) {
      if (!email) return fail('카카오 계정 이메일 제공에 동의해야 가입할 수 있습니다.');
      const id = uid(), { hash, salt } = await hashPassword(randomToken());
      const name = String(acc.profile?.nickname || email.split('@')[0]).slice(0, 60);
      await c.env.DB.prepare(`INSERT INTO users (id,email,password_hash,salt,name,role,created_at,last_login_at,email_verified_at,kakao_id) VALUES (?,?,?,?,?,'student',?,?,?,?)`)
        .bind(id, email, hash, salt, name, now(), now(), now(), kid).run();
      u = { id, email, name, role: 'student', status: 'active' }; created = true;
      await audit(c, 'user.register', id, { via: 'kakao' }, u); // Kakao accounts are 14+ under Kakao's own terms
      c.executionCtx.waitUntil(operatorAlert(c.env, '새 회원가입', { 이름: name, 이메일: email, 가입방법: '카카오' }));
    }
    if (u.status !== 'active') { await audit(c, 'login.fail', u.id, { reason: 'suspended', via: 'kakao' }, u); return fail('정지된 계정입니다.'); }
    if (u.totp_secret) return fail('2단계 인증을 사용하는 계정은 이메일로 로그인해 주세요.');
    const { evicted } = await createSession(c, u.id, u.role);
    await c.env.DB.prepare('UPDATE users SET last_login_at=? WHERE id=?').bind(now(), u.id).run();
    if (!created) await audit(c, u.role === 'admin' ? 'admin.login' : 'login.success', u.id, { via: 'kakao', ...(evicted ? { signedOutOldest: evicted } : {}) }, u);
    return c.redirect(created ? '/#/me?welcome=1' : '/#/me', 302);
  } catch (e) { console.error('kakao', e); return fail('카카오 로그인 중 오류가 발생했습니다.'); }
});

/* ---- e-mail verification ---- */
app.post('/verify', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (await rateLimited(c.env, `verify|${clientIp(c)}`, 30, 3600000)) return tooMany(c);
  const t = await readToken(c.env, 'verify_email', b.token);
  if (!t) return c.json({ error: '만료되었거나 이미 사용한 링크입니다. 로그인 후 인증 메일을 다시 받으세요.' }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE tokens SET used_at=? WHERE token_hash=?').bind(now(), t.token_hash),
    c.env.DB.prepare('UPDATE users SET email_verified_at=COALESCE(email_verified_at,?) WHERE id=?').bind(now(), t.user_id),
  ]);
  await audit(c, 'email.verified', t.user_id, null, await c.env.DB.prepare('SELECT id,email FROM users WHERE id=?').bind(t.user_id).first());
  return c.json({ ok: true });
});
app.post('/verify/resend', requireUser, async (c) => {
  const u = c.get('user');
  if (u.email_verified_at) return c.json({ ok: true, already: true });
  if (await rateLimited(c.env, `verify-mail|${u.id}`, 3, 3600000)) return tooMany(c, '인증 메일은 1시간에 3번까지 보낼 수 있습니다.');
  if (!(await sendVerify(c, u))) return c.json({ error: '메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 502);
  return c.json({ ok: true });
});

/* ---- guardian consent for under-14 members (PIPA art. 22-2) ---- */
app.get('/consent/:token', async (c) => {
  if (await rateLimited(c.env, `consent|${clientIp(c)}`, 60, 3600000)) return tooMany(c);
  const t = await readToken(c.env, 'guardian_consent', c.req.param('token'));
  if (!t) return c.json({ error: '만료되었거나 이미 처리된 링크입니다.' }, 404);
  const u = await c.env.DB.prepare('SELECT name,grade,created_at FROM users WHERE id=?').bind(t.user_id).first();
  return c.json({ child: { name: u?.name, grade: u?.grade, joined: u?.created_at }, guardian: maskEmail(JSON.parse(t.data || '{}').guardianEmail) });
});
app.post('/consent', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (await rateLimited(c.env, `consent|${clientIp(c)}`, 60, 3600000)) return tooMany(c);
  const t = await readToken(c.env, 'guardian_consent', b.token);
  if (!t) return c.json({ error: '만료되었거나 이미 처리된 링크입니다.' }, 400);
  const name = String(b.guardian_name || '').trim().slice(0, 40), relation = String(b.relation || '').slice(0, 20);
  if (!name || !b.agree) return c.json({ error: '보호자 성함을 입력하고 동의에 체크해 주세요.' }, 400);
  const g = JSON.parse(t.data || '{}').guardianEmail;
  if (b.decline) {
    await c.env.DB.prepare('UPDATE tokens SET used_at=? WHERE token_hash=?').bind(now(), t.token_hash).run();
    await audit(c, 'consent.declined', t.user_id, { guardian: maskEmail(g) }, null);
    return c.json({ ok: true, declined: true });
  }
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE tokens SET used_at=? WHERE token_hash=?').bind(now(), t.token_hash),
    c.env.DB.prepare('UPDATE users SET consent_at=? WHERE id=?').bind(now(), t.user_id),
    c.env.DB.prepare('INSERT INTO guardian_consents (id,user_id,guardian_email,guardian_name,relation,method,ip,at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(uid(), t.user_id, g, name, relation, 'email_link', clientIp(c), now()),
  ]);
  await audit(c, 'consent.given', t.user_id, { guardian: maskEmail(g), relation }, null);
  return c.json({ ok: true });
});
app.post('/consent/resend', requireUser, async (c) => {
  const u = c.get('user'), b = await c.req.json().catch(() => ({}));
  if (!u.under14 || u.consent_at) return c.json({ ok: true });
  const g = String(b.guardian_email || u.guardian_email || '').trim().toLowerCase();
  if (!isEmail(g) || g === u.email) return c.json({ error: '보호자 이메일을 정확히 입력하세요.' }, 400);
  if (await rateLimited(c.env, `consent-mail|${u.id}`, 3, 3600000)) return tooMany(c, '동의 요청은 1시간에 3번까지 보낼 수 있습니다.');
  await c.env.DB.prepare('UPDATE users SET guardian_email=? WHERE id=?').bind(g, u.id).run();
  await sendConsent(c, u, g);
  await audit(c, 'consent.requested', u.id, { guardian: maskEmail(g) });
  return c.json({ ok: true });
});

app.patch('/me', requireUser, async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const u = c.get('user');
  await c.env.DB.prepare('UPDATE users SET name=?, grade=?, phone=? WHERE id=?')
    .bind(String(b.name || u.name).slice(0, 60), String(b.grade ?? u.grade ?? '').slice(0, 20) || null, String(b.phone ?? u.phone ?? '').slice(0, 30) || null, u.id).run();
  await audit(c, 'profile.update', u.id, { fields: ['name', 'grade', 'phone'].filter((k) => b[k] !== undefined && String(b[k] ?? '') !== String(u[k] ?? '')) });
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
  // Personal data is erased; exam results, orders and the activity log are kept de-identified (commerce-law retention: 5 years).
  await audit(c, 'account.delete', u.id, { by: 'self' });
  await c.env.DB.batch(anonymizeUser(c.env.DB, u.id, hash, salt));
  deleteCookie(c, 'sid', { path: '/' });
  return c.json({ ok: true });
});

app.post('/forgot', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  if (!(await turnstileOk(c, b['cf-turnstile-response']))) return c.json({ error: '자동 요청 방지 확인에 실패했습니다.' }, 400);
  if (await rateLimited(c.env, `forgot|${clientIp(c)}`, 10, 3600000)) return tooMany(c);
  const u = await c.env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  await audit(c, 'password.reset_request', u?.id || null, { email: maskEmail(email), known: !!u }, u ? { id: u.id, email } : null);
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

/* ---- my own activity (logins, payments, exams ...) ---- */
app.get('/activity', requireUser, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT action,target,detail,ip,at FROM audit_log WHERE actor_id=? ORDER BY at DESC LIMIT 100').bind(c.get('user').id).all();
  return c.json({ events: results });
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
