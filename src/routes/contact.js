// 고객센터 form (public): anyone — signed in or not — can report a problem. The inquiry is stored as a support ticket and
// e-mailed to the operator with the customer as Reply-To, so it can be answered straight from the mailbox.
// Abuse guards: honeypot field, Turnstile (when configured), per-IP and per-address rate limits, size limits, no HTML.
import { Hono } from 'hono';
import { uid, now } from '../lib/util.js';
import { loadUser } from '../lib/auth.js';
import { rateLimited, tooMany, audit, clientIp, turnstileOk } from '../lib/security.js';
import { operatorAlert } from '../lib/notify.js';
import { sendMail, mailContactReceived } from '../lib/email.js';

const app = new Hono();
export const CS_CATEGORIES = ['결제·환불', '시험·채점', '계정·로그인', '문제 오류 신고', '기관·단체', '기타'];
const EMAIL_RE = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-z]{2,}$/i;
// strip control characters (keep line breaks) — the text is shown as plain text everywhere
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f​-‏‪-‮]/g, '').trim().slice(0, n);

app.post('/contact', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (b.website) return c.json({ ok: true, id: 'ok' }); // honeypot: bots fill every field; pretend success
  if (await rateLimited(c.env, `contact|${clientIp(c)}`, 5, 3600000)) return tooMany(c, '문의가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
  const user = await loadUser(c);
  const name = clean(user?.name || b.name, 40), email = clean(user?.email || b.email, 120).toLowerCase();
  const subject = clean(b.subject, 120), body = clean(b.body, 4000), ref = clean(b.ref, 120) || null;
  const category = CS_CATEGORIES.includes(b.category) ? b.category : '기타';
  if (!name) return c.json({ error: '이름을 입력해 주세요.' }, 400);
  if (!EMAIL_RE.test(email) || email.endsWith('.invalid')) return c.json({ error: '답변받을 이메일 주소를 확인해 주세요.' }, 400);
  if (subject.length < 2 || body.length < 5) return c.json({ error: '제목과 내용을 입력해 주세요.' }, 400);
  if (!user && !b.agree) return c.json({ error: '개인정보 수집·이용에 동의해 주세요.' }, 400);
  if (!user && !(await turnstileOk(c, b['cf-turnstile-response']))) return c.json({ error: '자동 입력 방지 확인에 실패했습니다. 다시 시도해 주세요.' }, 400);
  if (await rateLimited(c.env, `contact-mail|${email}`, 5, 86400000)) return tooMany(c, '오늘은 이 이메일로 더 이상 문의할 수 없습니다. 내일 다시 시도해 주세요.');

  const id = uid(), no = id.slice(0, 8).toUpperCase(), t = now();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO support_tickets (id,user_id,category,subject,status,created_at,updated_at,guest_email,guest_name,ref) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(id, user?.id || '', category, subject, 'open', t, t, user ? null : email, user ? null : name, ref),
    c.env.DB.prepare('INSERT INTO support_messages (id,ticket_id,user_id,staff,body,created_at) VALUES (?,?,?,0,?,?)').bind(uid(), id, user?.id || '', body, t),
  ]);
  await audit(c, 'support.create', id, { category, guest: !user }, user || { id: null, email });
  // operator mail: everything needed to answer (the customer's address is the Reply-To), nothing more
  c.executionCtx.waitUntil(operatorAlert(c.env, `고객 문의 [${category}] ${subject}`, {
    접수번호: no, 분류: category, 이름: name, 회원: user ? '회원' : '비회원', 참고: ref || '-', 내용: body,
    답변방법: '이 메일에 답장하면 고객에게 바로 전달됩니다 (관리자 → 문의에서 답변해도 됩니다)',
  }, { replyTo: email }));
  c.executionCtx.waitUntil(sendMail(c.env, email, `[${c.env.SITE_NAME}] 문의 접수 (${no})`, mailContactReceived(c.env, name, no, subject)));
  return c.json({ ok: true, id, no });
});

export default app;
