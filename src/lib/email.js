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
export const mailVerify = (env, name, link) =>
  `<p><b>${esc(name)}</b>님, 아래 버튼을 눌러 이메일 주소를 인증해 주세요. 인증 후 결제와 응시를 할 수 있습니다.</p>${btn(link, '이메일 인증하기')}<p style="font-size:13px;color:#6b7280">링크는 48시간 동안 유효합니다.</p>`;
export const mailConsent = (env, child, link) =>
  `<p>안녕하세요. <b>${esc(child)}</b> 학생이 ${esc(env.SITE_NAME)}에 가입하면서 보호자님의 이메일을 입력했습니다.</p>
   <p>만 14세 미만 아동의 개인정보를 처리하려면 개인정보 보호법에 따라 법정대리인의 동의가 필요합니다. 수집 항목(이름·이메일·학년·응시 기록·결제 기록)과 이용 목적을 확인하신 뒤 동의해 주세요.</p>${btn(link, '내용 확인하고 동의하기')}
   <p style="font-size:13px;color:#6b7280">링크는 7일 동안 유효합니다. 가입한 적이 없다면 이 메일을 무시하세요. 동의하지 않으면 계정을 사용할 수 없습니다.</p>`;
export const mailSupportReply = (env, name, subject, id) =>
  `<p><b>${esc(name)}</b>님, 문의하신 「${esc(subject)}」에 답변이 등록되었습니다.</p>${btn(`${env.SITE_URL}/#/support/${id}`, '답변 확인하기')}`;
export const mailGift = (env, name, title, codes) =>
  `<p><b>${esc(name)}</b>님, 선물용 이용권 코드가 발급되었습니다.</p><p>상품: ${esc(title)}</p>${codes.map((c) => `<p style="font:600 20px monospace;letter-spacing:2px;background:#f5f4ef;padding:10px 14px;display:inline-block">${esc(c)}</p>`).join('<br>')}<p>받는 분이 로그인 후 <b>내 시험 → 선물 코드 등록</b>에 입력하면 이용권이 지급됩니다.</p>`;
export const mailBankOrder = (env, name, v) =>
  `<p><b>${esc(name)}</b>님, 주문이 접수되었습니다. 아래 계좌로 입금해 주시면 확인 후 이용권을 지급해 드립니다.</p>
   <table style="border-collapse:collapse;font-size:14px">${[['상품', v.title], ['입금액', `<b>${v.amount.toLocaleString()}원</b>`], ['은행', v.account.bank], ['계좌번호', `<b>${esc(v.account.account)}</b>`], ['예금주', v.account.holder], ['입금자명', v.depositor], ['입금기한', new Date(v.expiresAt + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ') + ' (KST)']]
     .map(([k, x]) => `<tr><td style="padding:4px 14px 4px 0;color:#6b7280">${k}</td><td>${k === '입금액' || k === '계좌번호' ? x : esc(x)}</td></tr>`).join('')}</table>
   <p style="font-size:13px;color:#6b7280">입금자명이 다르면 확인이 늦어질 수 있습니다. 기한 안에 입금되지 않으면 주문은 자동 취소됩니다.</p>${btn(`${env.SITE_URL}/#/pay/bank?order=${v.orderId}`, '입금 안내 다시 보기')}`;

/** 결과지: the score sheet itself in the mail (works without opening the site), plus a link to the full report. */
export function mailReport(env, { student, title, level, finishedAt, score, link, linkLabel = '전체 리포트 보기 (문항별 해설)', from, message, pending }) {
  const sc = score || {}, td = 'padding:7px 10px;border-bottom:1px solid #e3e1d8', th = `${td};color:#6b7280;font-weight:400;text-align:left`;
  const when = finishedAt ? new Date(finishedAt + 9 * 3600000).toISOString().slice(0, 10) : '';
  const secs = Object.values(sc.sections || {}).map((x) => `<tr><td style="${td}">${esc(x.name)}</td><td style="${td};font-weight:700">${esc(x.main ?? '–')}</td><td style="${td};color:#6b7280;font-size:13px">${esc(x.sub || '')}${x.total ? ` · ${x.correct}/${x.total} 정답` : ''}</td></tr>`).join('');
  const extras = (sc.extras || []).map((x) => `<tr><th style="${th}">${esc(x.label)}</th><td style="${td};font-weight:700" colspan="2">${esc(x.value)}</td></tr>`).join('');
  return `${from ? `<p><b>${esc(from)}</b>님이 시험 결과지를 보냈습니다.</p>` : ''}${message ? `<p style="background:#f5f4ef;padding:10px 14px;white-space:pre-wrap">${esc(message)}</p>` : ''}
   <p style="margin:0;color:#6b7280;font-size:13px">${esc(title)}${level ? ` · ${esc(level)}` : ''}${when ? ` · ${when}` : ''}</p>
   <h2 style="margin:4px 0 14px;font-size:20px">${esc(student || '')} 학생 결과지</h2>
   ${sc.headline ? `<div style="border:1px solid #0a1f44;padding:14px 16px;margin-bottom:14px"><div style="color:#6b7280;font-size:13px">${esc(sc.headline.label)}</div><div style="font-size:28px;font-weight:800">${esc(sc.headline.value)}</div></div>` : ''}
   <table style="border-collapse:collapse;width:100%;font-size:14px">${extras}${secs}</table>
   ${pending ? '<p style="font-size:13px;color:#b31942">쓰기·말하기(서술형)는 채점이 끝나면 리포트에 반영됩니다.</p>' : ''}
   ${(sc.notes || []).length ? `<p style="font-size:12px;color:#6b7280">${sc.notes.map(esc).join('<br>')}</p>` : ''}
   ${link ? btn(link, linkLabel) : ''}`;
}
