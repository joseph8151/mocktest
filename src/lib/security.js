// Security helpers: rate limiting, audit log, TOTP two-factor auth, Turnstile bot check, password policy, headers.
import { uid, now } from './util.js';

export const clientIp = (c) => c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || 'local';

/**
 * Sliding-window rate limit stored in D1. Returns true when the caller is OVER the limit (and records nothing then).
 * key should already include the scope, e.g. `register|1.2.3.4`.
 */
export async function rateLimited(env, key, max, windowMs) {
  const db = env.DB, t = now();
  // Local development only (wrangler dev has no real client IP); Cloudflare always sets cf-connecting-ip in production.
  if (/\|(local|127\.0\.0\.1|::1)$/.test(key)) return false;
  const n = (await db.prepare('SELECT COUNT(*) n FROM rate_limits WHERE key=? AND at>?').bind(key, t - windowMs).first()).n;
  if (n >= max) return true;
  await db.prepare('INSERT INTO rate_limits (key,at) VALUES (?,?)').bind(key, t).run();
  if (Math.random() < 0.02) await db.prepare('DELETE FROM rate_limits WHERE at<?').bind(t - 86400000).run(); // housekeeping
  return false;
}
export const tooMany = (c, msg = '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.') => c.json({ error: msg }, 429);

/** Append-only audit trail of security-relevant and admin actions. Never stores passwords or codes. */
export async function audit(c, action, target = null, detail = null, actor = undefined) {
  const u = actor === undefined ? c.get('user') : actor;
  try {
    await c.env.DB.prepare('INSERT INTO audit_log (id,actor_id,actor_email,action,target,detail,ip,at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(uid(), u?.id || null, u?.email || null, action, target, detail ? String(detail).slice(0, 500) : null, clientIp(c), now()).run();
  } catch (e) { console.error('audit', e); }
}

/* ---------------- password policy ---------------- */
const COMMON = new Set(['password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwerty123', 'qwertyuiop', '11111111', '00000000', 'abcd1234', '1q2w3e4r', '1q2w3e4r5t', 'iloveyou', 'asdf1234', 'qwer1234', 'admin123', 'letmein1', 'zxcvbnm1', '87654321', 'aaaaaaaa']);
export function passwordProblem(pw, email = '') {
  pw = String(pw || '');
  if (pw.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (pw.length > 128) return '비밀번호가 너무 깁니다.';
  const low = pw.toLowerCase();
  if (COMMON.has(low) || /^(.)\1+$/.test(pw)) return '너무 흔한 비밀번호입니다. 다른 비밀번호를 사용하세요.';
  const local = String(email).split('@')[0].toLowerCase();
  if (local.length >= 4 && low.includes(local)) return '비밀번호에 이메일 아이디를 넣지 마세요.';
  if (!(/[a-zA-Z]/.test(pw) && /[^a-zA-Z]/.test(pw))) return '비밀번호는 영문과 숫자(또는 기호)를 섞어 주세요.';
  return null;
}

/* ---------------- TOTP (RFC 6238, SHA-1, 30 s, 6 digits) ---------------- */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes) {
  let bits = 0, val = 0, out = '';
  for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
export function unbase32(s) {
  const clean = String(s).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, val = 0; const out = [];
  for (const ch of clean) { val = (val << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(out);
}
export const newTotpSecret = () => base32(crypto.getRandomValues(new Uint8Array(20)));
export async function totpCode(secret, counter) {
  const key = await crypto.subtle.importKey('raw', unbase32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new ArrayBuffer(8); const dv = new DataView(msg);
  dv.setUint32(0, Math.floor(counter / 2 ** 32)); dv.setUint32(4, counter >>> 0);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const o = mac[mac.length - 1] & 15;
  const n = ((mac[o] & 127) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3];
  return String(n % 1e6).padStart(6, '0');
}
/** Returns the matched time-step (to block replays) or null. Accepts ±1 step of clock drift. */
export async function totpVerify(secret, code, lastStep = 0, t = now()) {
  code = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return null;
  const step = Math.floor(t / 30000);
  for (const s of [step - 1, step, step + 1]) if (s > (lastStep || 0) && (await totpCode(secret, s)) === code) return s;
  return null;
}
export const otpauthUri = (site, email, secret) =>
  `otpauth://totp/${encodeURIComponent(site)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(site)}&algorithm=SHA1&digits=6&period=30`;

/* ---------------- Cloudflare Turnstile (optional bot check) ---------------- */
export const turnstileOn = (env) => !!(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET);
export async function turnstileOk(c, token) {
  if (!turnstileOn(c.env)) return true;
  if (!token) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret: c.env.TURNSTILE_SECRET, response: String(token), remoteip: clientIp(c) }),
    });
    return !!(await r.json()).success;
  } catch { return false; }
}

/* ---------------- response headers for API responses ---------------- */
export const API_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};
