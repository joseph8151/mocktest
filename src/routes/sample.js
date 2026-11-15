// Public endpoints: exam structure (for the info pages) and a free 5-question sample test (no login).
import { Hono } from 'hono';
import { EXAMS } from '../lib/exam.js';
import { buildReport } from './exams.js';
import { sha256hex, now } from '../lib/util.js';
import { clientIp, rateLimited, tooMany, audit } from '../lib/security.js';

const app = new Hono();

app.get('/exam-info', (c) => c.json({
  exams: Object.entries(EXAMS).map(([type, e]) => ({
    type, title: e.title, adaptive: !!e.adaptive, category: e.category || 'us', levels: e.levels || [],
    sections: e.sections.map((s) => ({ key: s.key, name: s.name, n: s.n, minutes: s.minutes, manual: !!s.manual })),
  })),
}));

// The free sample only ever shows and grades the sample pool (ids ending in '0' or '8'); paid attempts never use those questions,
// so revealing sample answers cannot leak answers of a paid test.
const publicQ = (q) => ({ id: q.id, section: q.section, passage: q.passage, stem: q.stem, image_svg: q.image_svg, choices: JSON.parse(q.choices) });

/** 5 auto-graded questions: one per difficulty band (1..5 where available) from the exam's graded sections. */
app.get('/sample/:exam', async (c) => {
  const exam = c.req.param('exam').toUpperCase();
  if (!EXAMS[exam]) return c.json({ error: 'unknown exam' }, 404);
  const secs = EXAMS[exam].sections.filter((s) => !s.manual).map((s) => s.key);
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM questions WHERE exam_type=? AND kind='mcq' AND active=1 AND substr(id,-1) IN ('0','8') AND section IN (${secs.map(() => '?').join(',')}) ORDER BY RANDOM() LIMIT 400`).bind(exam, ...secs).all();
  const picked = [], used = new Set();
  for (const d of [1, 2, 3, 4, 5]) { // difficulty ramp, spread across sections
    const cands = results.filter((q) => q.difficulty === d && !used.has(q.id)).sort((a, b) => Number(picked.some((p) => p.section === a.section)) - Number(picked.some((p) => p.section === b.section)));
    if (cands[0]) { picked.push(cands[0]); used.add(cands[0].id); }
  }
  for (const q of results) { if (picked.length >= 5) break; if (!used.has(q.id)) { picked.push(q); used.add(q.id); } }
  return c.json({ exam, title: EXAMS[exam].title, questions: picked.map(publicQ) });
});

app.post('/sample/grade', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const ans = Array.isArray(b.answers) ? b.answers.slice(0, 10) : [];
  const out = [];
  for (const a of ans) {
    const q = await c.env.DB.prepare(`SELECT id,answer,explanation,choices FROM questions WHERE id=? AND kind='mcq' AND active=1 AND substr(id,-1) IN ('0','8')`).bind(String(a.id)).first();
    if (q) out.push({ id: q.id, correct: Number.isInteger(a.choice) && a.choice === q.answer, answer: q.answer, explanation: q.explanation });
  }
  return c.json({ results: out, score: out.filter((x) => x.correct).length, total: out.length });
});

// Read-only report opened from a share link (parents / tutors). Token is stored hashed; expired or revoked links 404.
app.get('/shared/:token', async (c) => {
  if (await rateLimited(c.env, `shared|${clientIp(c)}`, 60, 600000)) return tooMany(c);
  const token = c.req.param('token');
  if (!/^[0-9a-f]{48}$/.test(token)) return c.json({ error: '링크가 만료되었거나 공유가 중지되었습니다.' }, 404);
  const link = await c.env.DB.prepare('SELECT attempt_id FROM share_links WHERE token_hash=? AND expires_at>? AND revoked_at IS NULL').bind(await sha256hex(token), now()).first();
  const a = link && (await c.env.DB.prepare(`SELECT * FROM attempts WHERE id=? AND status!='in_progress'`).bind(link.attempt_id).first());
  if (!a) return c.json({ error: '링크가 만료되었거나 공유가 중지되었습니다.' }, 404);
  await audit(c, 'shared.view', a.id, { ua: String(c.req.header('user-agent') || '').slice(0, 100) }, null); // who opened a parent link, and when
  return c.json(await buildReport(c.env, a, { shared: true }));
});

export default app;
