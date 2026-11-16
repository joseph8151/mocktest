// Guardian consent, family profiles, device lock, integrity, device limit, classes, gift codes, practice, support, stats, backup.
// Run against `wrangler dev` after e2e.mjs (admin exists).
import assert from 'node:assert/strict';
const BASE = process.env.BASE || 'http://localhost:8787';
class C {
  cookie = '';
  async req(m, p, b) {
    const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', cookie: this.cookie }, body: b ? JSON.stringify(b) : undefined, redirect: 'manual' });
    const sc = r.headers.get('set-cookie'); if (sc) { const v = sc.split(';')[0]; this.cookie = v.endsWith('=') ? '' : v; }
    return { status: r.status, ...(await r.json().catch(() => ({}))) };
  }
  get = (p) => this.req('GET', p); post = (p, b) => this.req('POST', p, b); patch = (p, b) => this.req('PATCH', p, b);
}
const PW = 'Mock-test-2026', stamp = Date.now();
const admin = new C();
assert.ok((await admin.post('/api/auth/login', { email: process.env.ADMIN_EMAIL || 'admin@example.com', password: PW })).user);
assert.ok((await admin.post('/api/admin/manual-sections', { speaking: true, essay: true })).ok); // this suite exercises teacher grading
const reg = async (tag, extra = {}) => { const c = new C(); const r = await c.post('/api/auth/register', { email: `${tag}${stamp}@t.com`, name: tag, password: PW, agree: true, ...extra }); assert.ok(r.user, JSON.stringify(r)); c.id = r.user.id; c.email = `${tag}${stamp}@t.com`; return c; };
const grant = (c, productId = 'p-cat4-3') => admin.post(`/api/admin/users/${c.id}/grant`, { productId });
const finishExam = async (c, id) => assert.ok((await c.post(`/api/attempts/${id}/finish`)).ok);

// ---- under 14: guardian consent gate ----
assert.equal((await new C().post('/api/auth/register', { email: `kid${stamp}@t.com`, name: 'K', password: PW, agree: true, under14: true })).status, 400, 'guardian e-mail required');
const kid = await reg('kid', { under14: true, guardian_email: `mom${stamp}@t.com` });
assert.equal((await kid.get('/api/auth/me')).user.gate, 'guardian_consent');
assert.equal((await kid.post('/api/pay/portone/prepare', { productId: 'p-cat4-1' })).status, 403, 'no payment before consent');
await grant(kid);
assert.equal((await kid.post('/api/attempts', { examType: 'CAT4' })).status, 403, 'no exam before consent');
assert.equal((await new C().get(`/api/auth/consent/${'a'.repeat(48)}`)).status, 404);
assert.equal((await admin.post(`/api/admin/users/${kid.id}/consent`, {})).status, 400, 'admin must note how consent was checked');
assert.ok((await admin.post(`/api/admin/users/${kid.id}/consent`, { note: '보호자 전화 확인' })).ok);
assert.equal((await kid.get('/api/auth/me')).user.gate, null, 'consent recorded');

// ---- family ----
const mom = await reg('mom');
await grant(mom, 'p-map-3');
const ch = await mom.post('/api/family/children', { name: '첫째', grade: 'G4' });
assert.ok(ch.id);
const fam = await mom.get('/api/family');
assert.equal(fam.children.length, 1);
const momTicket = (await mom.get('/api/tickets/mine')).tickets.find((t) => t.exam_type === 'MAP');
assert.ok(momTicket && momTicket.left === 3);
assert.equal((await mom.post('/api/tickets/transfer', { entitlementId: momTicket.id, toUserId: kid.id, count: 1 })).status, 403, 'cannot give to a stranger');
assert.ok((await mom.post('/api/tickets/transfer', { entitlementId: momTicket.id, toUserId: ch.id, count: 2 })).ok);
assert.equal((await mom.get('/api/tickets/mine')).tickets.find((t) => t.id === momTicket.id).left, 1);
assert.equal((await mom.post('/api/tickets/transfer', { entitlementId: momTicket.id, toUserId: ch.id, count: 5 })).status, 400, 'not more than left');
assert.ok((await mom.post('/api/family/switch', { childId: ch.id })).ok);
const meChild = (await mom.get('/api/auth/me')).user;
assert.equal(meChild.isChild, true); assert.equal(meChild.name, '첫째');
assert.equal((await mom.post('/api/family/children', { name: 'x' })).status, 403, 'child cannot add children');
const catt = await mom.post('/api/attempts', { examType: 'MAP' });
assert.ok(catt.id, 'child starts an exam with the shared ticket');
await finishExam(mom, catt.id);
assert.equal((await mom.post('/api/family/switch-back', { password: 'wrong' })).status, 400);
assert.ok((await mom.post('/api/family/switch-back', { password: PW })).ok);
assert.equal((await mom.get('/api/auth/me')).user.isChild, false);
assert.equal((await mom.get(`/api/attempts/${catt.id}/report`)).attempt.exam_type, 'MAP', 'parent sees the child report');
assert.equal((await new C().post('/api/auth/login', { email: `child-${ch.id}@family.invalid`, password: PW })).status, 401, 'child profile has no password login');

// ---- one device per exam + integrity ----
const s1 = await reg('dev');
await grant(s1);
const att = await s1.post('/api/attempts', { examType: 'CAT4' });
assert.ok((await s1.get(`/api/attempts/${att.id}/current`)).questions);
const s2 = new C(); await s2.post('/api/auth/login', { email: s1.email, password: PW });
const locked = await s2.get(`/api/attempts/${att.id}/current`);
assert.equal(locked.status, 409); assert.equal(locked.lockedElsewhere, true, 'second device is locked out');
assert.ok((await s2.post(`/api/attempts/${att.id}/takeover`)).ok);
assert.equal((await s1.get(`/api/attempts/${att.id}/current`)).status, 409, 'first device now locked');
await s2.post(`/api/attempts/${att.id}/integrity`, { type: 'leave' });
await s2.post(`/api/attempts/${att.id}/integrity`, { type: 'leave' });
assert.equal((await s2.post(`/api/attempts/${att.id}/integrity`, { type: 'device_switch' })).status, 400, 'device_switch is server-only');
await finishExam(s2, att.id);
const rep = await s2.get(`/api/attempts/${att.id}/report`);
assert.deepEqual(rep.integrity, { device_switch: 1, leave: 2 });
assert.ok(rep.compare && typeof rep.compare.n === 'number', 'peer comparison present');

// ---- device limit: a 4th login signs out the oldest ----
const d = []; for (let i = 0; i < 4; i++) { const c = new C(); await c.post('/api/auth/login', { email: s1.email, password: PW }); d.push(c); }
assert.equal((await s1.get('/api/auth/me')).user, null, 'oldest session signed out');
assert.ok((await d[3].get('/api/auth/me')).user, 'newest session alive');
assert.equal((await d[3].get('/api/auth/sessions')).sessions.length, 3);

// ---- classes ----
const teacher = await reg('teach');
assert.equal((await teacher.post('/api/classes', { name: 'A반' })).status, 403, 'students cannot create classes');
assert.ok((await admin.patch(`/api/admin/users/${teacher.id}`, { role: 'teacher' })).ok);
await teacher.post('/api/auth/login', { email: teacher.email, password: PW });
const cls = await teacher.post('/api/classes', { name: '토요 SSAT 반' });
assert.match(cls.code, /^[A-Z2-9]{6}$/);
const stu = await reg('stu');
assert.equal((await stu.post('/api/classes/join', { code: 'ZZZZZZ' })).status, 404);
assert.ok((await stu.post('/api/classes/join', { code: cls.code.toLowerCase() })).ok);
await grant(teacher, 'p-ssat-3');
const tt = (await teacher.get('/api/tickets/mine')).tickets[0];
assert.ok((await teacher.post('/api/tickets/transfer', { entitlementId: tt.id, toUserId: stu.id, count: 1 })).ok);
const satt = await stu.post('/api/attempts', { examType: 'SSAT' });
assert.ok(satt.id); await finishExam(stu, satt.id);
const detail = await teacher.get(`/api/classes/${cls.id}`);
assert.equal(detail.members.length, 1); assert.equal(detail.members[0].attempts.length, 1);
assert.ok((await teacher.get(`/api/attempts/${satt.id}/report`)).attempt, 'teacher sees member report');
assert.ok((await stu.post(`/api/classes/${cls.id}/leave`)).ok);
assert.equal((await teacher.get(`/api/attempts/${satt.id}/report`)).status, 404, 'not after the student leaves');

// ---- gift codes ----
const gc = await admin.post('/api/admin/gift-codes', { productId: 'p-sat-1', count: 2, note: 'test' });
assert.equal(gc.codes.length, 2); assert.match(gc.codes[0], /^GIFT-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
assert.ok((await stu.post('/api/gift/redeem', { code: gc.codes[0].toLowerCase() })).ok);
assert.equal((await stu.post('/api/gift/redeem', { code: gc.codes[0] })).status, 400, 'single use');
assert.ok((await stu.get('/api/me/overview')).entitlements.some((e) => e.exam_type === 'SAT'));
assert.ok((await admin.post(`/api/admin/gift-codes/${gc.codes[1]}/revoke`)).ok);
assert.equal((await stu.post('/api/gift/redeem', { code: gc.codes[1] })).status, 400, 'revoked');
const gp = await stu.post('/api/pay/portone/prepare', { productId: 'p-cat4-1', gift: true });
if (gp.status !== 503) {
  assert.ok((await admin.post(`/api/admin/orders/${gp.orderId}/mark-paid`, {})).ok);
  const mine = (await stu.get('/api/gift/mine')).codes;
  assert.equal(mine.length, 1, 'gift purchase issued a code');
  assert.ok(!(await stu.get('/api/me/overview')).entitlements.some((e) => e.exam_type === 'CAT4'), 'buyer did not get the ticket');
  const friend = await reg('friend');
  assert.ok((await friend.post('/api/gift/redeem', { code: mine[0].code })).ok);
}

// ---- practice ----
const none = await reg('nopr');
assert.equal((await none.get('/api/practice/options')).exams.length, 0);
assert.equal((await none.get('/api/practice/questions?exam=SAT&section=math')).status, 403);
const opts = await stu.get('/api/practice/options');
assert.ok(opts.exams.some((e) => e.type === 'SAT'));
const pq = await stu.get('/api/practice/questions?exam=SAT&section=math');
assert.equal(pq.questions.length, 10); assert.ok(pq.questions.every((q) => q.answer === undefined), 'no answers sent');
const chk = await stu.post('/api/practice/check', pq.questions[0].kind === 'num' ? { questionId: pq.questions[0].id, text: '0' } : { questionId: pq.questions[0].id, choice: 0 });
assert.equal(typeof chk.correct, 'boolean');

// ---- support ----
const tk = await stu.post('/api/support', { category: '결제·환불', subject: '영수증', body: '영수증 다시 받을 수 있나요?' });
assert.ok(tk.id);
assert.equal((await none.get(`/api/support/${tk.id}`)).status, 404, 'only the author');
assert.ok((await admin.post(`/api/admin/support/${tk.id}/reply`, { body: '메일로 다시 보냈습니다.' })).ok);
const th = await stu.get(`/api/support/${tk.id}`);
assert.equal(th.ticket.status, 'answered'); assert.equal(th.messages.length, 2); assert.equal(th.messages[1].staff, 1);

// ---- stats + backup ----
const ser = await admin.get('/api/admin/stats/series');
assert.ok(Array.isArray(ser.revenue) && ser.funnel.users > 0);
const bk = await fetch(BASE + '/api/admin/backup', { headers: { cookie: admin.cookie } });
assert.equal(bk.status, 200); const bj = await bk.json(); assert.ok(bj.tables.users.length > 0 && bj.tables.audit_log.length > 0);
assert.equal((await stu.get('/api/admin/backup')).status, 403);
console.log('FEATURES OK');
