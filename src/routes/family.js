// Family (parent → child profiles), classes (teacher → students), ticket sharing, gift codes, practice mode, 1:1 support.
import { Hono } from 'hono';
import { uid, now, randomToken, numEqual } from '../lib/util.js';
import { requireUser, createSession, accountGate, hashPassword, verifyPassword } from '../lib/auth.js';
import { audit, rateLimited, tooMany, clientIp } from '../lib/security.js';
import { EXAMS } from '../lib/exam.js';
import { giftCode } from '../lib/payments.js';

const app = new Hono();
app.use('*', requireUser);
const db = (c) => c.env.DB;

/* =============================== family =============================== */
const MAX_CHILDREN = 6;
app.get('/family', async (c) => {
  const u = c.get('user');
  if (u.parent_id) return c.json({ children: [], isChild: true });
  const { results: kids } = await db(c).prepare('SELECT id,name,grade,created_at FROM users WHERE parent_id=? AND status=? ORDER BY created_at').bind(u.id, 'active').all();
  for (const k of kids) {
    k.tickets = (await db(c).prepare(`SELECT e.id,e.exam_type,e.attempts_total,e.attempts_used,e.expires_at,p.title FROM entitlements e JOIN products p ON p.id=e.product_id
      WHERE e.user_id=? AND e.revoked=0 AND (e.expires_at IS NULL OR e.expires_at>?) ORDER BY e.created_at DESC`).bind(k.id, now()).all()).results;
    k.attempts = (await db(c).prepare(`SELECT id,exam_type,status,started_at,finished_at,json_extract(score,'$.headline.value') AS headline,json_extract(state,'$.level') AS level
      FROM attempts WHERE user_id=? ORDER BY started_at DESC LIMIT 10`).bind(k.id).all()).results;
  }
  return c.json({ children: kids });
});
app.post('/family/children', async (c) => {
  const u = c.get('user'), b = await c.req.json().catch(() => ({}));
  if (u.parent_id) return c.json({ error: '자녀 프로필에서는 추가할 수 없습니다.' }, 403);
  const gate = accountGate(c.env, u); if (gate) return c.json(gate, 403);
  const name = String(b.name || '').trim().slice(0, 40);
  if (!name) return c.json({ error: '자녀 이름을 입력하세요.' }, 400);
  if ((await db(c).prepare('SELECT COUNT(*) n FROM users WHERE parent_id=?').bind(u.id).first()).n >= MAX_CHILDREN) return c.json({ error: `자녀는 ${MAX_CHILDREN}명까지 등록할 수 있습니다.` }, 400);
  const id = uid(), { hash, salt } = await hashPassword(randomToken()); // child profiles have no password of their own
  await db(c).batch([
    db(c).prepare(`INSERT INTO users (id,email,password_hash,salt,name,role,grade,created_at,email_verified_at,under14,consent_at,parent_id) VALUES (?,?,?,?,?,'student',?,?,?,1,?,?)`)
      .bind(id, `child-${id}@family.invalid`, hash, salt, name, String(b.grade || '').slice(0, 20) || null, now(), now(), now(), u.id),
    // the parent account holder creating the profile is the guardian's consent
    db(c).prepare('INSERT INTO guardian_consents (id,user_id,guardian_email,guardian_name,relation,method,ip,at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(uid(), id, u.email, u.name, '보호자 계정', 'parent_account', clientIp(c), now()),
  ]);
  await audit(c, 'family.child_add', id, { name });
  return c.json({ ok: true, id });
});
app.patch('/family/children/:id', async (c) => {
  const u = c.get('user'), b = await c.req.json().catch(() => ({}));
  const r = await db(c).prepare('UPDATE users SET name=COALESCE(?,name), grade=? WHERE id=? AND parent_id=?')
    .bind(String(b.name || '').trim().slice(0, 40) || null, String(b.grade || '').slice(0, 20) || null, c.req.param('id'), u.id).run();
  if (!r.meta.changes) return c.json({ error: 'not found' }, 404);
  await audit(c, 'family.child_update', c.req.param('id'), { grade: b.grade || null });
  return c.json({ ok: true });
});
// Switch the browser to a child's profile (the child then takes exams as themselves). Going back needs the parent's password.
app.post('/family/switch', async (c) => {
  const u = c.get('user'), { childId } = await c.req.json().catch(() => ({}));
  const kid = await db(c).prepare(`SELECT id,role FROM users WHERE id=? AND parent_id=? AND status='active'`).bind(childId, u.id).first();
  if (!kid) return c.json({ error: 'not found' }, 404);
  await audit(c, 'family.switch_to_child', kid.id);
  await db(c).prepare('DELETE FROM sessions WHERE token_hash=?').bind(c.get('sid')).run();
  await createSession(c, kid.id, 'student', { actingParent: u.id });
  return c.json({ ok: true });
});
app.post('/family/switch-back', async (c) => {
  const u = c.get('user'), b = await c.req.json().catch(() => ({}));
  if (!u.acting_parent) return c.json({ error: '보호자 계정에서 전환한 프로필이 아닙니다.' }, 400);
  if (await rateLimited(c.env, `switchback|${u.acting_parent}`, 10, 900000)) return tooMany(c);
  const p = await db(c).prepare(`SELECT * FROM users WHERE id=? AND status='active'`).bind(u.acting_parent).first();
  if (!p || !(await verifyPassword(String(b.password || ''), p.password_hash, p.salt))) { await audit(c, 'family.switch_back_failed', p?.id || null); return c.json({ error: '보호자 비밀번호가 올바르지 않습니다.' }, 400); }
  await db(c).prepare('DELETE FROM sessions WHERE token_hash=?').bind(c.get('sid')).run();
  await createSession(c, p.id, p.role);
  await audit(c, 'family.switch_back', p.id, null, p);
  return c.json({ ok: true });
});

/* ===================== share tickets with a child or a class student ===================== */
async function mayGiveTo(c, toId) {
  const u = c.get('user');
  if (await db(c).prepare('SELECT 1 FROM users WHERE id=? AND parent_id=?').bind(toId, u.id).first()) return true;
  if (u.role === 'teacher' && await db(c).prepare(`SELECT 1 FROM class_members m JOIN classes k ON k.id=m.class_id WHERE m.user_id=? AND k.teacher_id=? AND m.left_at IS NULL AND k.archived=0`).bind(toId, u.id).first()) return true;
  return false;
}
app.post('/tickets/transfer', async (c) => {
  const u = c.get('user'), b = await c.req.json().catch(() => ({}));
  const count = Math.round(Number(b.count) || 1);
  if (count < 1 || count > 500) return c.json({ error: '횟수가 올바르지 않습니다.' }, 400);
  if (!(await mayGiveTo(c, b.toUserId))) return c.json({ error: '내 자녀나 내 반 학생에게만 줄 수 있습니다.' }, 403);
  const e = await db(c).prepare(`SELECT * FROM entitlements WHERE id=? AND user_id=? AND revoked=0 AND (expires_at IS NULL OR expires_at>?)`).bind(b.entitlementId, u.id, now()).first();
  if (!e || !e.order_id && !e.origin_order_id) return c.json({ error: '나눠 줄 수 있는 이용권이 아닙니다.' }, 400); // admin trial tickets cannot be shared
  const take = await db(c).prepare('UPDATE entitlements SET attempts_total=attempts_total-?1 WHERE id=?2 AND attempts_total-attempts_used>=?1').bind(count, e.id).run();
  if (!take.meta.changes) return c.json({ error: '남은 횟수가 부족합니다.' }, 400);
  const nid = uid();
  await db(c).prepare(`INSERT INTO entitlements (id,user_id,product_id,order_id,exam_type,attempts_total,expires_at,created_at,origin_order_id,source) VALUES (?,?,?,NULL,?,?,?,?,?,?)`)
    .bind(nid, b.toUserId, e.product_id, e.exam_type, count, e.expires_at, now(), e.order_id || e.origin_order_id, `transfer:${e.id}`).run();
  await audit(c, 'ticket.transfer', b.toUserId, { from: e.id, to: nid, exam: e.exam_type, count });
  return c.json({ ok: true });
});
// Tickets that can be shared (paid, not expired, with attempts left)
app.get('/tickets/mine', async (c) => {
  const { results } = await db(c).prepare(`SELECT e.id,e.exam_type,e.attempts_total-e.attempts_used AS left,e.expires_at,p.title FROM entitlements e JOIN products p ON p.id=e.product_id
    WHERE e.user_id=? AND e.revoked=0 AND (e.order_id IS NOT NULL OR e.origin_order_id IS NOT NULL) AND e.attempts_total>e.attempts_used AND (e.expires_at IS NULL OR e.expires_at>?) ORDER BY e.expires_at`).bind(c.get('user').id, now()).all();
  return c.json({ tickets: results });
});

/* =============================== classes =============================== */
const classCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return [...crypto.getRandomValues(new Uint8Array(6))].map((b) => A[b % A.length]).join(''); };
const teacherOnly = (c) => (c.get('user').role === 'teacher' || c.get('user').role === 'admin' ? null : c.json({ error: '선생님 계정만 사용할 수 있습니다. 관리자에게 기관 계정을 요청하세요.' }, 403));
app.get('/classes', async (c) => {
  const u = c.get('user');
  const teaching = u.role === 'teacher' || u.role === 'admin' ? (await db(c).prepare(`SELECT k.*, (SELECT COUNT(*) FROM class_members m WHERE m.class_id=k.id AND m.left_at IS NULL) AS members FROM classes k WHERE teacher_id=? ORDER BY archived, created_at DESC`).bind(u.id).all()).results : [];
  const joined = (await db(c).prepare(`SELECT k.id,k.name,u.name AS teacher,m.joined_at FROM class_members m JOIN classes k ON k.id=m.class_id JOIN users u ON u.id=k.teacher_id WHERE m.user_id=? AND m.left_at IS NULL AND k.archived=0`).bind(u.id).all()).results;
  return c.json({ teaching, joined });
});
app.post('/classes', async (c) => {
  const no = teacherOnly(c); if (no) return no;
  const name = String((await c.req.json().catch(() => ({}))).name || '').trim().slice(0, 60);
  if (!name) return c.json({ error: '반 이름을 입력하세요.' }, 400);
  const id = uid(); let code = classCode();
  for (let i = 0; i < 5 && (await db(c).prepare('SELECT 1 FROM classes WHERE code=?').bind(code).first()); i++) code = classCode();
  await db(c).prepare('INSERT INTO classes (id,teacher_id,name,code,created_at) VALUES (?,?,?,?,?)').bind(id, c.get('user').id, name, code, now()).run();
  await audit(c, 'class.create', id, { name, code });
  return c.json({ ok: true, id, code });
});
app.get('/classes/:id', async (c) => {
  const k = await db(c).prepare('SELECT * FROM classes WHERE id=? AND teacher_id=?').bind(c.req.param('id'), c.get('user').id).first();
  if (!k) return c.json({ error: 'not found' }, 404);
  const { results: members } = await db(c).prepare(`SELECT u.id,u.name,u.grade,m.joined_at FROM class_members m JOIN users u ON u.id=m.user_id WHERE m.class_id=? AND m.left_at IS NULL ORDER BY u.name`).bind(k.id).all();
  for (const s of members) {
    s.attempts = (await db(c).prepare(`SELECT id,exam_type,status,finished_at,json_extract(score,'$.headline.value') AS headline,json_extract(state,'$.level') AS level,integrity
      FROM attempts WHERE user_id=? AND status!='in_progress' ORDER BY finished_at DESC LIMIT 8`).bind(s.id).all()).results;
    s.tickets = (await db(c).prepare(`SELECT exam_type, SUM(attempts_total-attempts_used) AS left FROM entitlements WHERE user_id=? AND revoked=0 AND (expires_at IS NULL OR expires_at>?) GROUP BY exam_type`).bind(s.id, now()).all()).results;
  }
  return c.json({ class: k, members });
});
app.post('/classes/:id/archive', async (c) => {
  const r = await db(c).prepare('UPDATE classes SET archived=1-archived WHERE id=? AND teacher_id=?').bind(c.req.param('id'), c.get('user').id).run();
  if (!r.meta.changes) return c.json({ error: 'not found' }, 404);
  await audit(c, 'class.archive', c.req.param('id'));
  return c.json({ ok: true });
});
app.post('/classes/:id/remove', async (c) => {
  const { userId } = await c.req.json().catch(() => ({}));
  const k = await db(c).prepare('SELECT id FROM classes WHERE id=? AND teacher_id=?').bind(c.req.param('id'), c.get('user').id).first();
  if (!k) return c.json({ error: 'not found' }, 404);
  await db(c).prepare('UPDATE class_members SET left_at=? WHERE class_id=? AND user_id=? AND left_at IS NULL').bind(now(), k.id, userId).run();
  await audit(c, 'class.remove_member', userId, { class: k.id });
  return c.json({ ok: true });
});
app.post('/classes/join', async (c) => {
  const u = c.get('user');
  if (await rateLimited(c.env, `classjoin|${u.id}`, 10, 600000)) return tooMany(c);
  const code = String((await c.req.json().catch(() => ({}))).code || '').trim().toUpperCase();
  const k = await db(c).prepare('SELECT * FROM classes WHERE code=? AND archived=0').bind(code).first();
  if (!k) return c.json({ error: '반 코드를 찾을 수 없습니다.' }, 404);
  if (k.teacher_id === u.id) return c.json({ error: '내가 만든 반입니다.' }, 400);
  await db(c).prepare(`INSERT INTO class_members (class_id,user_id,joined_at) VALUES (?,?,?) ON CONFLICT(class_id,user_id) DO UPDATE SET left_at=NULL, joined_at=excluded.joined_at`).bind(k.id, u.id, now()).run();
  await audit(c, 'class.join', k.id, { name: k.name });
  return c.json({ ok: true, name: k.name });
});
app.post('/classes/:id/leave', async (c) => {
  await db(c).prepare('UPDATE class_members SET left_at=? WHERE class_id=? AND user_id=? AND left_at IS NULL').bind(now(), c.req.param('id'), c.get('user').id).run();
  await audit(c, 'class.leave', c.req.param('id'));
  return c.json({ ok: true });
});

/* =============================== gift codes =============================== */
app.post('/gift/redeem', async (c) => {
  const u = c.get('user');
  const gate = accountGate(c.env, u); if (gate) return c.json(gate, 403);
  if (await rateLimited(c.env, `redeem|${u.id}`, 10, 600000)) return tooMany(c);
  const code = String((await c.req.json().catch(() => ({}))).code || '').trim().toUpperCase().replace(/\s/g, '');
  const g = await db(c).prepare('SELECT g.*, p.exam_type, p.attempts, p.valid_days, p.title FROM gift_codes g JOIN products p ON p.id=g.product_id WHERE g.code=?').bind(code).first();
  if (!g || g.revoked || (g.expires_at && g.expires_at < now())) { await audit(c, 'gift.redeem_failed', null, { code: code.slice(0, 20) }); return c.json({ error: '사용할 수 없는 코드입니다.' }, 400); }
  if (g.redeemed_by) return c.json({ error: '이미 사용된 코드입니다.' }, 400);
  const claim = await db(c).prepare('UPDATE gift_codes SET redeemed_by=?, redeemed_at=? WHERE code=? AND redeemed_by IS NULL AND revoked=0').bind(u.id, now(), code).run();
  if (!claim.meta.changes) return c.json({ error: '이미 사용된 코드입니다.' }, 400);
  await db(c).prepare(`INSERT INTO entitlements (id,user_id,product_id,order_id,exam_type,attempts_total,expires_at,created_at,origin_order_id,source) VALUES (?,?,?,NULL,?,?,?,?,?,?)`)
    .bind(uid(), u.id, g.product_id, g.exam_type, g.attempts, now() + g.valid_days * 86400000, now(), g.order_id, `gift:${code}`).run();
  await audit(c, 'gift.redeem', code, { product: g.product_id, from: g.created_by });
  return c.json({ ok: true, title: g.title });
});
app.get('/gift/mine', async (c) => {
  const { results } = await db(c).prepare(`SELECT g.code,g.redeemed_at,g.revoked,g.expires_at,g.created_at,p.title,(SELECT name FROM users WHERE id=g.redeemed_by) AS redeemed_name
    FROM gift_codes g JOIN products p ON p.id=g.product_id WHERE g.created_by=? AND g.order_id IS NOT NULL ORDER BY g.created_at DESC LIMIT 100`).bind(c.get('user').id).all();
  return c.json({ codes: results });
});

/* =============================== practice mode =============================== */
// Untimed section drills for exams the member has bought (or was given) at least once. Graded one question at a time.
const hasExam = async (c, exam) => c.get('user').role === 'admin' || !!(await db(c).prepare('SELECT 1 FROM entitlements WHERE user_id=? AND exam_type=? AND revoked=0 LIMIT 1').bind(c.get('user').id, exam).first());
app.get('/practice/options', async (c) => {
  const out = [];
  for (const [type, e] of Object.entries(EXAMS)) if (await hasExam(c, type)) out.push({ type, title: e.title, sections: e.sections.filter((s) => !s.manual).map((s) => ({ key: s.key, name: s.name })) });
  const stats = (await db(c).prepare(`SELECT exam_type,section,COUNT(*) n,SUM(correct) ok FROM practice_log WHERE user_id=? GROUP BY exam_type,section`).bind(c.get('user').id).all()).results;
  return c.json({ exams: out, stats });
});
app.get('/practice/questions', async (c) => {
  const { exam, section, diff } = c.req.query();
  if (!EXAMS[exam] || !(await hasExam(c, exam))) return c.json({ error: '이 시험의 이용권을 구매하면 연습할 수 있습니다.' }, 403);
  if (await rateLimited(c.env, `practice|${c.get('user').id}`, 60, 3600000)) return tooMany(c, '연습 세트는 1시간에 60번까지 받을 수 있습니다.');
  const d = Math.max(0, Math.min(5, +diff || 0));
  const { results } = await db(c).prepare(`SELECT id,section,kind,difficulty,passage,stem,image_svg,choices FROM questions
    WHERE exam_type=? AND section=? AND active=1 AND kind IN ('mcq','num') AND (?3=0 OR difficulty=?3) ORDER BY RANDOM() LIMIT 10`).bind(exam, section, d).all();
  return c.json({ questions: results.map((q) => ({ ...q, choices: q.kind === 'num' ? null : JSON.parse(q.choices) })) });
});
app.post('/practice/check', async (c) => {
  const u = c.get('user'), b = await c.req.json().catch(() => ({}));
  if (await rateLimited(c.env, `practicecheck|${u.id}`, 400, 86400000)) return tooMany(c, '오늘 연습 한도(400문항)를 채웠습니다.');
  const q = await db(c).prepare('SELECT * FROM questions WHERE id=? AND active=1').bind(b.questionId).first();
  if (!q || !(await hasExam(c, q.exam_type))) return c.json({ error: 'not found' }, 404);
  const correct = q.kind === 'num' ? numEqual(String(b.text ?? ''), JSON.parse(q.choices)) : Number.isInteger(b.choice) && b.choice === q.answer;
  await db(c).prepare('INSERT INTO practice_log (id,user_id,question_id,exam_type,section,difficulty,correct,at) VALUES (?,?,?,?,?,?,?,?)').bind(uid(), u.id, q.id, q.exam_type, q.section, q.difficulty, correct ? 1 : 0, now()).run();
  return c.json({ correct, answer: q.kind === 'num' ? null : q.answer, accepted: q.kind === 'num' ? JSON.parse(q.choices) : null, explanation: q.explanation });
});

/* =============================== 1:1 support =============================== */
app.get('/support', async (c) => c.json({ tickets: (await db(c).prepare('SELECT * FROM support_tickets WHERE user_id=? ORDER BY updated_at DESC').bind(c.get('user').id).all()).results }));
app.post('/support', async (c) => {
  const u = c.get('user'), b = await c.req.json().catch(() => ({}));
  if (await rateLimited(c.env, `support|${u.id}`, 10, 3600000)) return tooMany(c);
  const subject = String(b.subject || '').trim().slice(0, 120), body = String(b.body || '').trim().slice(0, 4000);
  if (!subject || !body) return c.json({ error: '제목과 내용을 입력하세요.' }, 400);
  const id = uid(), cat = ['결제·환불', '시험·채점', '계정', '기관·단체', '기타'].includes(b.category) ? b.category : '기타';
  await db(c).batch([
    db(c).prepare('INSERT INTO support_tickets (id,user_id,category,subject,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(id, u.id, cat, subject, 'open', now(), now()),
    db(c).prepare('INSERT INTO support_messages (id,ticket_id,user_id,staff,body,created_at) VALUES (?,?,?,0,?,?)').bind(uid(), id, u.id, body, now()),
  ]);
  await audit(c, 'support.create', id, { category: cat });
  return c.json({ ok: true, id });
});
app.get('/support/:id', async (c) => {
  const t = await db(c).prepare('SELECT * FROM support_tickets WHERE id=? AND user_id=?').bind(c.req.param('id'), c.get('user').id).first();
  if (!t) return c.json({ error: 'not found' }, 404);
  const { results } = await db(c).prepare('SELECT staff,body,created_at FROM support_messages WHERE ticket_id=? ORDER BY created_at').bind(t.id).all();
  return c.json({ ticket: t, messages: results });
});
app.post('/support/:id/reply', async (c) => {
  const u = c.get('user'), b = await c.req.json().catch(() => ({}));
  if (await rateLimited(c.env, `support|${u.id}`, 10, 3600000)) return tooMany(c);
  const t = await db(c).prepare('SELECT * FROM support_tickets WHERE id=? AND user_id=?').bind(c.req.param('id'), u.id).first();
  const body = String(b.body || '').trim().slice(0, 4000);
  if (!t || !body) return c.json({ error: '내용을 입력하세요.' }, 400);
  await db(c).batch([
    db(c).prepare('INSERT INTO support_messages (id,ticket_id,user_id,staff,body,created_at) VALUES (?,?,?,0,?,?)').bind(uid(), t.id, u.id, body, now()),
    db(c).prepare(`UPDATE support_tickets SET status='open', updated_at=? WHERE id=?`).bind(now(), t.id),
  ]);
  await audit(c, 'support.reply', t.id);
  return c.json({ ok: true });
});

export { giftCode };
export default app;
