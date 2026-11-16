// 고객센터: public form (guests + members) -> ticket + operator mail with Reply-To; admin answers; abuse guards.
import assert from 'node:assert/strict';
import http from 'node:http';
const BASE = process.env.BASE || 'http://localhost:8787';
const got = [];
const mock = http.createServer((req, res) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => { got.push(JSON.parse(b || '{}')); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); }); }).listen(9095);
class C {
  cookie = '';
  async req(m, p, b) {
    const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', cookie: this.cookie }, body: b ? JSON.stringify(b) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) { const v = sc.split(';')[0]; this.cookie = v.endsWith('=') ? '' : v; }
    return { status: r.status, ...(await r.json().catch(() => ({}))) };
  }
  get = (p) => this.req('GET', p); post = (p, b) => this.req('POST', p, b);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wait = async (pred) => { for (let i = 0; i < 40; i++) { const x = got.find(pred); if (x) return x; await sleep(100); } throw new Error('no alert ' + JSON.stringify(got)); };
const stamp = Date.now(), guest = new C();
const base = { name: '김고객', email: `cs${stamp}@t.com`, category: '계정·로그인', subject: '로그인이 안 돼요', body: '비밀번호를 바꿨는데도 로그인이 안 됩니다.', agree: true };

// validation
assert.equal((await guest.post('/api/contact', { ...base, email: 'nope' })).status, 400);
assert.equal((await guest.post('/api/contact', { ...base, agree: false })).status, 400, 'guests must consent');
assert.equal((await guest.post('/api/contact', { ...base, body: '' })).status, 400);
const hp = await guest.post('/api/contact', { ...base, website: 'http://spam' });
assert.equal(hp.ok, true); assert.equal(hp.id, 'ok', 'honeypot: fake success, nothing stored');

// guest inquiry
const r = await guest.post('/api/contact', { ...base, subject: `로그인 문제 ${stamp}`, body: '<script>alert(1)</script>\u0007 로그인 불가', ref: '#/login' });
assert.ok(r.ok && r.no, JSON.stringify(r));
const alert = await wait((x) => x.접수번호 === r.no);
assert.equal(alert.email, base.email); assert.equal(alert._replyto, base.email, 'Reply-To = customer');
assert.equal(alert.회원, '비회원'); assert.match(alert._subject, /고객 문의/); assert.ok(!alert.내용.includes('\u0007'), 'control chars stripped');

// admin sees it, answers (guest -> answer mailed), or marks answered-by-email
const admin = new C(); await admin.post('/api/auth/login', { email: process.env.ADMIN_EMAIL || 'admin@example.com', password: 'Mock-test-2026' });
const list = (await admin.get('/api/admin/support?status=open')).tickets;
const t = list.find((x) => x.subject === `로그인 문제 ${stamp}`);
assert.ok(t, 'ticket listed'); assert.equal(t.email, base.email); assert.equal(t.name, '김고객'); assert.equal(t.guest, 1);
const d = await admin.get(`/api/admin/support/${t.id}`);
assert.equal(d.ticket.ref, '#/login'); assert.match(d.messages[0].body, /<script>/, 'stored as plain text (escaped on display)');
assert.ok((await admin.post(`/api/admin/support/${t.id}/reply`, { body: '비밀번호 재설정 링크를 다시 보내 드렸습니다.' })).ok);
assert.equal((await admin.get('/api/admin/support?status=answered')).tickets.find((x) => x.id === t.id)?.status, 'answered');
const r2 = await guest.post('/api/contact', { ...base, subject: `메일로 답할 문의 ${stamp}` });
const t2 = (await admin.get('/api/admin/support?status=open')).tickets.find((x) => x.subject === `메일로 답할 문의 ${stamp}`);
assert.ok((await admin.post(`/api/admin/support/${t2.id}/answered`, { note: '메일로 답변 완료' })).ok);
assert.match((await admin.get(`/api/admin/support/${t2.id}`)).messages.at(-1).body, /메모/);

// member: name/email come from the account (cannot be spoofed), visible in their own ticket list
const m = new C(); const mr = await m.post('/api/auth/register', { email: `csm${stamp}@t.com`, name: '이회원', password: 'Mock-test-2026', agree: true });
const mt = await m.post('/api/contact', { name: 'X', email: 'spoof@t.com', category: '결제·환불', subject: `환불 문의 ${stamp}`, body: '환불 받고 싶어요 내용입니다' });
assert.ok(mt.ok);
const ma = await wait((x) => x.접수번호 === mt.no);
assert.equal(ma.email, `csm${stamp}@t.com`); assert.equal(ma.이름, '이회원'); assert.equal(ma.회원, '회원');
assert.ok((await m.get('/api/support')).tickets.some((x) => x.id === mt.id), 'member sees it in 내 문의');
// member 1:1 문의 page also alerts
const st = await m.post('/api/support', { category: '기타', subject: `회원 문의 ${stamp}`, body: '회원 1:1 문의 본문' });
await wait((x) => x.접수번호 === st.id.slice(0, 8).toUpperCase());
// guests cannot read tickets
assert.equal((await guest.get(`/api/support/${t.id}`)).status, 401);
assert.equal((await guest.get('/api/admin/support')).status, 401);
mock.close();
console.log('CONTACT OK');
