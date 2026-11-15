import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { b64, unb64, now, randomToken, sha256hex, timingSafeEqual } from './util.js';

const enc = new TextEncoder();
const ITER = 100000; // Workers PBKDF2 max
const SESSION_MS = 14 * 24 * 3600 * 1000;
const ADMIN_SESSION_MS = 12 * 3600 * 1000; // admins sign in again every 12 hours

export async function hashPassword(password, saltB64) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256);
  return { hash: b64(bits), salt: b64(salt) };
}
export async function verifyPassword(password, hash, salt) {
  const r = await hashPassword(password, salt);
  return timingSafeEqual(r.hash, hash);
}

export const MAX_DEVICES = 3; // student/teacher accounts: signing in on a 4th device signs out the oldest (stops ticket sharing)
export async function createSession(c, userId, role = 'student', { actingParent = null } = {}) {
  const token = randomToken();
  const ttl = role === 'admin' ? ADMIN_SESSION_MS : SESSION_MS;
  const th = await sha256hex(token);
  await c.env.DB.prepare('INSERT INTO sessions (token_hash,user_id,expires_at,created_at,last_seen,ip,ua,acting_parent) VALUES (?,?,?,?,?,?,?,?)')
    .bind(th, userId, now() + ttl, now(), now(), c.req.header('cf-connecting-ip') || 'local', String(c.req.header('user-agent') || '').slice(0, 200), actingParent).run();
  let evicted = 0;
  if (role !== 'admin') {
    const r = await c.env.DB.prepare(`DELETE FROM sessions WHERE user_id=?1 AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=?1 AND expires_at>?2 ORDER BY created_at DESC LIMIT ?3)`)
      .bind(userId, now(), MAX_DEVICES).run();
    evicted = r.meta.changes || 0;
  }
  const secure = new URL(c.req.url).protocol === 'https:';
  setCookie(c, 'sid', token, { httpOnly: true, secure, sameSite: 'Lax', path: '/', maxAge: ttl / 1000 });
  return { evicted };
}
export async function destroySession(c) {
  const token = getCookie(c, 'sid');
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256hex(token)).run();
  deleteCookie(c, 'sid', { path: '/' });
}

export async function loadUser(c) {
  if (c.get('user') !== undefined) return c.get('user');
  const token = getCookie(c, 'sid');
  let user = null;
  if (token) {
    const th = await sha256hex(token);
    user = await c.env.DB.prepare(
      `SELECT u.id,u.email,u.name,u.role,u.status,u.grade,u.phone,(u.totp_secret IS NOT NULL) AS twofa,s.last_seen,
              u.email_verified_at,u.under14,u.consent_at,u.guardian_email,u.parent_id,u.kakao_id,s.acting_parent
       FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`
    ).bind(th, now()).first();
    if (user && user.status !== 'active') user = null;
    if (user) {
      if (!user.last_seen || now() - user.last_seen > 5 * 60000) { // keep "last active" fresh for the device list, cheaply
        const upd = c.env.DB.prepare('UPDATE sessions SET last_seen=? WHERE token_hash=?').bind(now(), th).run();
        try { c.executionCtx.waitUntil(upd); } catch { await upd; }
      }
      user.twofa = !!user.twofa; delete user.last_seen;
      c.set('sid', th);
    }
  }
  c.set('user', user);
  return user;
}
/**
 * What still blocks paying / starting exams: e-mail verification (only when mail can actually be sent) and,
 * for under-14 accounts, a guardian's consent. Admins and parent-managed child profiles are never blocked.
 */
export function accountGate(env, u) {
  if (!u || u.role === 'admin' || u.parent_id) return null;
  if (u.under14 && !u.consent_at) return { code: 'guardian_consent', error: '만 14세 미만 회원은 보호자 동의가 필요합니다. 보호자 이메일로 보낸 동의 링크를 확인해 주세요.' };
  if (env.RESEND_API_KEY && !u.email_verified_at) return { code: 'verify_email', error: '이메일 인증 후 이용할 수 있습니다. 가입한 이메일의 인증 링크를 눌러 주세요.' };
  return null;
}
export async function requireUser(c, next) {
  const u = await loadUser(c);
  if (!u) return c.json({ error: '로그인이 필요합니다.' }, 401);
  await next();
}
export async function requireAdmin(c, next) {
  const u = await loadUser(c);
  if (!u) return c.json({ error: '로그인이 필요합니다.' }, 401);
  if (u.role !== 'admin') return c.json({ error: '관리자 권한이 필요합니다.' }, 403);
  await next();
}
