// KakaoTalk AlimTalk via SOLAPI (https://solapi.com). Optional: does nothing unless all settings exist.
// Settings (Cloudflare Variables): SOLAPI_API_KEY, SOLAPI_API_SECRET (Secret), SOLAPI_SENDER (registered sender number),
// KAKAO_PFID (business channel id from SOLAPI), ALIMTALK_TPL_RESULT / ALIMTALK_TPL_PAID (approved template ids).
// Template variables used: #{이름} #{시험} #{링크} (result) and #{이름} #{상품} #{금액} #{링크} (paid).
// NOTE: written from SOLAPI's public API docs; verify with a real channel and approved templates before relying on it.
import { hex, hmacSha256, randomToken } from './util.js';
import { sendMail } from './email.js';

/** Operator alert (new member, new bank-transfer order): Formspree form (FORMSPREE_URL; the form owner gets the mail)
 * and/or a direct mail to NOTIFY_EMAIL through Resend. Never throws. */
export async function operatorAlert(env, subject, fields) {
  const title = `[${env.SITE_NAME || 'MockTest Lab'}] ${subject}`;
  const jobs = [];
  if (env.FORMSPREE_URL) jobs.push(fetch(env.FORMSPREE_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ _subject: title, 알림: subject, ...fields, 관리자화면: `${env.SITE_URL}/#/admin` }),
  }).then(async (r) => { if (!r.ok) console.error('formspree', r.status, (await r.text()).slice(0, 200)); }));
  if (env.NOTIFY_EMAIL) jobs.push(sendMail(env, env.NOTIFY_EMAIL, title,
    `<p><b>${subject}</b></p><table>${Object.entries(fields).map(([k, v]) => `<tr><td style="color:#6b7280;padding:3px 12px 3px 0">${k}</td><td>${String(v ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))}</td></tr>`).join('')}</table>`));
  await Promise.all(jobs.map((j) => j.catch((e) => console.error('operator alert', e))));
}

export const alimtalkOn = (env) => !!(env.SOLAPI_API_KEY && env.SOLAPI_API_SECRET && env.SOLAPI_SENDER && env.KAKAO_PFID);
const phoneOk = (p) => { const d = String(p || '').replace(/\D/g, ''); return /^01[016789]\d{7,8}$/.test(d) ? d : null; };

export async function alimtalk(env, phone, kind, vars) {
  const tpl = { result: env.ALIMTALK_TPL_RESULT, paid: env.ALIMTALK_TPL_PAID }[kind];
  const to = phoneOk(phone);
  if (!alimtalkOn(env) || !tpl || !to) return { ok: false, skipped: true };
  try {
    const date = new Date().toISOString(), salt = randomToken(16);
    const signature = hex(await hmacSha256(new TextEncoder().encode(env.SOLAPI_API_SECRET), date + salt));
    const variables = Object.fromEntries(Object.entries(vars).map(([k, v]) => [`#{${k}}`, String(v)]));
    const r = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: { Authorization: `HMAC-SHA256 apiKey=${env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { to, from: String(env.SOLAPI_SENDER).replace(/\D/g, ''), kakaoOptions: { pfId: env.KAKAO_PFID, templateId: tpl, variables } } }),
    });
    if (!r.ok) console.error('alimtalk', r.status, await r.text().catch(() => ''));
    return { ok: r.ok };
  } catch (e) { console.error('alimtalk', e); return { ok: false }; }
}
/** Phone to notify for a member: their own, or the parent's for a child profile. */
export async function phoneFor(env, userId) {
  const u = await env.DB.prepare('SELECT phone,parent_id FROM users WHERE id=?').bind(userId).first();
  if (!u) return null;
  if (u.phone) return u.phone;
  return u.parent_id ? (await env.DB.prepare('SELECT phone FROM users WHERE id=?').bind(u.parent_id).first())?.phone : null;
}
