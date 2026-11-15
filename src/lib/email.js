// Sends mail through Resend (https://resend.com) when RESEND_API_KEY is set; otherwise logs (local dev).
// MAIL_FROM must use a domain verified in Resend, e.g. "MockTest Lab <noreply@mydomain.com>".
// Until a domain is verified, Resend's test sender (onboarding@resend.dev) only delivers to the Resend account's own e-mail.
export const mailFrom = (env) => env.MAIL_FROM || `${env.SITE_NAME || 'MockTest Lab'} <onboarding@resend.dev>`;

/** Returns { ok, error? } — error carries Resend's message (bad key, unverified domain ...). */
export async function deliver(env, to, subject, html) {
  if (!env.RESEND_API_KEY) { console.log(`[mail:dev] to=${to} subject=${subject}\n${html}`); return { ok: false, error: 'RESEND_API_KEY가 설정되지 않았습니다.' }; }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: mailFrom(env), to, subject, html: layout(env, html) }),
    });
    if (r.ok) return { ok: true };
    const j = await r.json().catch(() => ({}));
    return { ok: false, error: `${r.status} ${j.message || j.name || ''}`.trim() };
  } catch (e) {
    console.error('mail failed', e);
    return { ok: false, error: String(e.message || e) };
  }
}
export async function sendMail(env, to, subject, html) {
  const r = await deliver(env, to, subject, html);
  if (!r.ok && env.RESEND_API_KEY) console.error('mail not sent', subject, r.error);
  return r.ok;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const btn = (href, label) => `<p style="margin:22px 0"><a href="${href}" style="display:inline-block;background:#0a1f44;color:#fff;text-decoration:none;padding:12px 20px;font-weight:600">${label}</a></p>`;
function layout(env, body) {
  return `<div style="background:#f5f4ef;padding:28px 12px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#0a1f44">
  <div style="max-width:520px;margin:0 auto;background:#fffdf8;border:1px solid #0a1f44">
    <div style="height:4px;background:linear-gradient(90deg,#b31942 33%,#fffdf8 33% 66%,#0a1f44 66%)"></div>
    <div style="padding:26px 28px;font-size:15px;line-height:1.65">
      <div style="font-weight:800;font-size:16px;margin-bottom:18px">★ ${esc(env.SITE_NAME || 'MockTest Lab')}</div>
      ${body}
    </div>
    <div style="padding:14px 28px;border-top:1px solid #e3e1d8;font-size:12px;color:#6b7280">본 메일은 발신 전용입니다. 문의: ${esc(env.BIZ_CONTACT || env.SITE_URL || '')}</div>
  </div></div>`;
}
export const mailWelcome = (env, name) =>
  `<p><b>${esc(name)}</b>님, 가입을 환영합니다.</p><p>학년·레벨에 맞는 모의고사를 고르고, 끝나는 즉시 영역별 점수와 해설을 확인하세요.</p>${btn(env.SITE_URL, '시험 보러 가기')}`;
export const mailReceipt = (env, name, title, amount, currency) =>
  `<p><b>${esc(name)}</b>님, 결제가 완료되었습니다.</p><table style="border-collapse:collapse;font-size:14px"><tr><td style="padding:4px 14px 4px 0;color:#6b7280">상품</td><td>${esc(title)}</td></tr><tr><td style="padding:4px 14px 4px 0;color:#6b7280">금액</td><td><b>${currency === 'USD' ? '$' + (amount / 100).toFixed(2) : amount.toLocaleString() + '원'}</b></td></tr></table>${btn(`${env.SITE_URL}/#/me`, '내 시험 보기')}`;
export const mailReset = (env, link) =>
  `<p>비밀번호 재설정을 요청하셨습니다. 아래 버튼은 <b>1시간</b> 동안 유효합니다.</p>${btn(link, '새 비밀번호 설정')}<p style="font-size:13px;color:#6b7280">요청하지 않으셨다면 이 메일을 무시하세요. 비밀번호는 바뀌지 않습니다.</p>`;
export const mailResult = (env, name, title, id) =>
  `<p><b>${esc(name)}</b>님, <b>${esc(title)}</b> 결과가 준비되었습니다.</p>${btn(`${env.SITE_URL}/#/report/${id}`, '결과 리포트 보기')}`;
export const mailTest = (env) => `<p>이메일 연결이 정상입니다. 가입 환영, 결제 영수증, 시험 결과, 비밀번호 재설정 메일이 이 주소(<b>${esc(mailFrom(env))}</b>)로 발송됩니다.</p>`;
