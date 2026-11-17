// Recorded listening audio: admin uploads a file per passage key; exams and the free sample then serve it (Range-capable);
// passages without a file keep text-to-speech; the sample hides the script until grading (client) and flags listening items.
import assert from 'node:assert/strict';
const BASE = process.env.BASE || 'http://localhost:8787';
class C {
  cookie = '';
  async req(m, p, b, raw) {
    const r = await fetch(BASE + p, { method: m, headers: { 'content-type': raw ? raw.type : 'application/json', cookie: this.cookie }, body: raw ? raw.body : b ? JSON.stringify(b) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) { const v = sc.split(';')[0]; this.cookie = v.endsWith('=') ? '' : v; }
    return { status: r.status, ...(await r.json().catch(() => ({}))) };
  }
  get = (p) => this.req('GET', p); post = (p, b) => this.req('POST', p, b);
}
const admin = new C(), anon = new C();
assert.ok((await admin.post('/api/auth/login', { email: process.env.ADMIN_EMAIL || 'admin@example.com', password: 'Mock-test-2026' })).user);
assert.equal((await anon.get('/api/admin/listening')).status, 401);

let L = await admin.get('/api/admin/listening');
assert.ok(L.passages.length >= 90, `listening passages: ${L.passages.length}`);
assert.ok(L.passages.every((p) => /^(wida|toeflj)-[0-9a-f]{8}$/.test(p.key)), 'keys');
assert.equal(new Set(L.passages.map((p) => p.key)).size, L.passages.length, 'unique keys');
const fake = (n) => { const b = new Uint8Array(n); b.set([0x49, 0x44, 0x33]); for (let i = 3; i < n; i++) b[i] = i % 251; return b; };

// errors: unknown key, wrong type, too big
assert.equal((await admin.req('PUT', '/api/admin/listening/wida-00000000', null, { type: 'audio/mpeg', body: fake(100) })).status, 404);
const p0 = L.passages.find((p) => p.exam === 'WIDA' && p.sample) || L.passages[0];
assert.equal((await admin.req('PUT', `/api/admin/listening/${p0.key}`, null, { type: 'text/plain', body: 'x' })).status, 415);
assert.equal((await admin.req('PUT', `/api/admin/listening/${p0.key}`, null, { type: 'audio/mpeg', body: fake(1_420_000) })).status, 413);
assert.equal((await anon.req('PUT', `/api/admin/listening/${p0.key}`, null, { type: 'audio/mpeg', body: fake(100) })).status, 401);

// upload every WIDA passage (small fake mp3s), filename with extension is accepted
const data = fake(5000);
for (const p of L.passages.filter((x) => x.exam === 'WIDA')) assert.ok((await admin.req('PUT', `/api/admin/listening/${p.key}.mp3`, null, { type: 'audio/mpeg', body: data })).ok);
L = await admin.get('/api/admin/listening');
const w = L.passages.find((p) => p.key === p0.key);
assert.ok(w.audio && w.audio.bytes === 5000);

// public file: full body, Range (iOS), cache headers, bad key
let r = await fetch(BASE + w.audio.url);
assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'audio/mpeg');
assert.match(r.headers.get('cache-control'), /max-age=31536000/);
assert.deepEqual(new Uint8Array(await r.arrayBuffer()), data);
r = await fetch(BASE + w.audio.url, { headers: { range: 'bytes=0-1' } });
assert.equal(r.status, 206); assert.equal(r.headers.get('content-range'), 'bytes 0-1/5000'); assert.equal((await r.arrayBuffer()).byteLength, 2);
r = await fetch(BASE + w.audio.url, { headers: { range: 'bytes=4990-' } });
assert.equal(r.status, 206); assert.equal((await r.arrayBuffer()).byteLength, 10);
assert.equal((await fetch(BASE + '/api/listening/wida-00000000.mp3')).status, 404);

// a WIDA exam: every listening question carries its recording (index cache is per isolate: allow its 60s window)
const s = await admin.post('/api/attempts', { examType: 'WIDA' });
assert.ok(s.id, JSON.stringify(s));
const cur = await admin.get(`/api/attempts/${s.id}/current`);
assert.equal(cur.section.key, 'listening');
assert.ok(cur.questions.length && cur.questions.every((q) => q.audio && q.audio.startsWith('/api/listening/wida-')), 'exam audio urls');
assert.equal((await fetch(BASE + cur.questions[0].audio)).status, 200);
const finish = async (id) => { let v = await admin.get(`/api/attempts/${id}/current`); while (v.status === 'in_progress' && v.section) v = await admin.post(`/api/attempts/${id}/submit-section`, { section: v.section.index }); };
await finish(s.id); // leave no open attempt behind (other suites start fresh WIDA / TOEFL Junior tests)

// TOEFL Junior has no files -> TTS (audio null)
const t = await admin.post('/api/attempts', { examType: 'TOEFLJ', level: 'standard' });
if (t.id) {
  let c = await admin.get(`/api/attempts/${t.id}/current`);
  const lq = c.questions?.filter((q) => /listen/.test(q.section)) || [];
  assert.ok(lq.every((q) => q.audio === null), 'no file -> TTS');
  await finish(t.id);
}

// free sample: listening items are flagged; WIDA ones carry the recording
let found = false;
for (let i = 0; i < 15 && !found; i++) {
  const sm = await anon.get('/api/sample/WIDA');
  for (const q of sm.questions) if (q.listening) { found = true; assert.ok(q.audio, 'sample audio'); }
}
assert.ok(found, 'a WIDA sample listening item');
const tj = await anon.get('/api/sample/TOEFLJ');
assert.ok(tj.questions.every((q) => q.listening === /listen/.test(q.section)));

// delete -> back to TTS
assert.ok((await admin.req('DELETE', `/api/admin/listening/${p0.key}`)).ok);
assert.equal((await admin.get('/api/admin/listening')).passages.find((p) => p.key === p0.key).audio, null);
for (const p of L.passages.filter((x) => x.exam === 'WIDA')) await admin.req('DELETE', `/api/admin/listening/${p.key}`);
console.log('LISTENING AUDIO OK');
