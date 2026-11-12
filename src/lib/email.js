// Sends mail through Resend when RESEND_API_KEY is set; otherwise logs (dev).
export async function sendMail(env, to, subject, html) {
  if (!env.RESEND_API_KEY) {
    console.log(`[mail:dev] to=${to} subject=${subject}\n${html}`);
    return false;
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to, subject, html }),
    });
    return r.ok;
  } catch (e) {
    console.error('mail failed', e);
    return false;
  }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const mailWelcome = (env, name) =>
  `<p>${esc(name)}님, ${esc(env.SITE_NAME)} 가입을 환영합니다.</p><p><a href="${env.SITE_URL}">시험 보러 가기</a></p>`;
export const mailReceipt = (env, name, title, amount, currency) =>
  `<p>${esc(name)}님, 결제가 완료되었습니다.</p><p>상품: ${esc(title)}<br>금액: ${amount.toLocaleString()} ${currency === 'USD' ? 'USD' : '원'}</p><p><a href="${env.SITE_URL}/#/me">내 시험 보기</a></p>`;
export const mailReset = (env, link) =>
  `<p>비밀번호 재설정 링크 (1시간 유효):</p><p><a href="${link}">${link}</a></p>`;
export const mailResult = (env, name, title, id) =>
  `<p>${esc(name)}님, ${esc(title)} 결과가 준비되었습니다.</p><p><a href="${env.SITE_URL}/#/report/${id}">결과 리포트 보기</a></p>`;
