import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { b64, unb64, now, randomToken, sha256hex, timingSafeEqual } from './util.js';

const enc = new TextEncoder();
const ITER = 100000; // Workers PBKDF2 max
const SESSION_MS = 14 * 24 * 3600 * 1000;

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

export async function createSession(c, userId) {
  const token = randomToken();
  await c.env.DB.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)')
    .bind(await sha256hex(token), userId, now() + SESSION_MS).run();
  const secure = new URL(c.req.url).protocol === 'https:';
  setCookie(c, 'sid', token, { httpOnly: true, secure, sameSite: 'Lax', path: '/', maxAge: SESSION_MS / 1000 });
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
    user = await c.env.DB.prepare(
      `SELECT u.id,u.email,u.name,u.role,u.status,u.grade,u.phone FROM sessions s JOIN users u ON u.id=s.user_id
       WHERE s.token_hash=? AND s.expires_at>?`
    ).bind(await sha256hex(token), now()).first();
    if (user && user.status !== 'active') user = null;
  }
  c.set('user', user);
  return user;
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
