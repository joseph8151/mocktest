import { Hono } from 'hono';
import { uid, now } from '../lib/util.js';
import { requireUser } from '../lib/auth.js';
import { EXAMS, GRACE_MS, initialState, pickNext, sectionTarget, adaptDifficulty, scoreAttempt } from '../lib/exam.js';
import { sendMail, mailResult } from '../lib/email.js';

const app = new Hono();
app.use('*', requireUser);

const publicQ = (q) => ({
  id: q.id, section: q.section, kind: q.kind, passage: q.passage, stem: q.stem, image_svg: q.image_svg,
  choices: q.choices ? JSON.parse(q.choices) : null,
});

app.get('/exams', (c) => c.json({
  exams: Object.entries(EXAMS).map(([k, e]) => ({ type: k, title: e.title, sections: e.sections })),
}));

app.get('/me/overview', async (c) => {
  const u = c.get('user');
  const [ents, atts] = await Promise.all([
    c.env.DB.prepare(
      `SELECT e.*, p.title FROM entitlements e JOIN products p ON p.id=e.product_id
       WHERE e.user_id=? AND e.revoked=0 ORDER BY e.created_at DESC`).bind(u.id).all(),
    c.env.DB.prepare(
      `SELECT id,exam_type,status,started_at,finished_at,score FROM attempts WHERE user_id=? ORDER BY started_at DESC`).bind(u.id).all(),
  ]);
  return c.json({
    entitlements: ents.results.map((e) => ({ ...e, remaining: e.attempts_total - e.attempts_used, expired: !!e.expires_at && e.expires_at < now() })),
    attempts: atts.results.map((a) => ({ ...a, score: a.score ? JSON.parse(a.score) : null })),
  });
});

/* ---- start / resume ---- */
app.post('/attempts', async (c) => {
  const u = c.get('user');
  const { examType } = await c.req.json().catch(() => ({}));
  if (!EXAMS[examType]) return c.json({ error: '알 수 없는 시험입니다.' }, 400);
  const open = await c.env.DB.prepare(`SELECT id FROM attempts WHERE user_id=? AND exam_type=? AND status='in_progress'`).bind(u.id, examType).first();
  if (open) return c.json({ id: open.id, resumed: true });

  const ent = await c.env.DB.prepare(
    `SELECT id FROM entitlements WHERE user_id=? AND exam_type=? AND revoked=0 AND attempts_used<attempts_total
     AND (expires_at IS NULL OR expires_at>?) ORDER BY expires_at LIMIT 1`).bind(u.id, examType, now()).first();
  if (!ent) return c.json({ error: '응시 가능한 이용권이 없습니다. 먼저 결제해 주세요.' }, 402);
  const claim = await c.env.DB.prepare('UPDATE entitlements SET attempts_used=attempts_used+1 WHERE id=? AND attempts_used<attempts_total').bind(ent.id).run();
  if (!claim.meta.changes) return c.json({ error: '이용권이 소진되었습니다.' }, 402);
  const id = uid();
  await c.env.DB.prepare('INSERT INTO attempts (id,user_id,entitlement_id,exam_type,state,started_at) VALUES (?,?,?,?,?,?)')
    .bind(id, u.id, ent.id, examType, JSON.stringify(initialState(examType, now())), now()).run();
  return c.json({ id });
});

async function loadAttempt(c) {
  const a = await c.env.DB.prepare('SELECT * FROM attempts WHERE id=?').bind(c.req.param('id')).first();
  const u = c.get('user');
  if (!a || (a.user_id !== u.id && u.role !== 'admin')) return null;
  return a;
}

async function finish(env, a, st) {
  const { results } = await env.DB.prepare('SELECT * FROM answers WHERE attempt_id=?').bind(a.id).all();
  const score = scoreAttempt(a.exam_type, results);
  const status = score.pendingManual ? 'submitted' : 'graded';
  await env.DB.prepare('UPDATE attempts SET status=?, score=?, state=?, finished_at=? WHERE id=?')
    .bind(status, JSON.stringify(score), JSON.stringify(st), now(), a.id).run();
  if (status === 'graded') await notifyResult(env, a);
}
export async function notifyResult(env, a) {
  const u = await env.DB.prepare('SELECT email,name FROM users WHERE id=?').bind(a.user_id).first();
  if (u) await sendMail(env, u.email, `[${env.SITE_NAME}] 결과 리포트`, mailResult(env, u.name, EXAMS[a.exam_type].title, a.id));
}

/** Move to the section after st.si. Returns false if the exam is over. */
function nextSection(a, st) {
  const ex = EXAMS[a.exam_type];
  st.si += 1; st.qi = 0; st.served = []; st.current = null; st.diff = 3;
  if (st.si >= ex.sections.length) return false;
  st.deadline = now() + ex.sections[st.si].minutes * 60000;
  return true;
}

/** Make sure st.current points at a question; may advance sections / finish. */
async function ensureCurrent(env, a, st) {
  const ex = EXAMS[a.exam_type];
  for (let guard = 0; guard < 20; guard++) {
    if (st.si >= ex.sections.length) { await finish(env, a, st); return null; }
    const sec = ex.sections[st.si];
    if (now() > st.deadline + GRACE_MS) { nextSection(a, st); continue; }
    if (!st.current) {
      const { results: bank } = await env.DB.prepare(
        'SELECT id,difficulty FROM questions WHERE exam_type=? AND section=? AND active=1').bind(a.exam_type, sec.key).all();
      const target = sectionTarget(a.exam_type, st.si, bank.length);
      st.target = target;
      if (st.qi >= target) { nextSection(a, st); continue; }
      const id = pickNext(a.exam_type, st, bank, target);
      if (!id) { nextSection(a, st); continue; }
      st.current = id; st.shown = now();
    }
    const q = await env.DB.prepare('SELECT * FROM questions WHERE id=?').bind(st.current).first();
    return q;
  }
  return null;
}

function view(a, st, q, newSection) {
  const ex = EXAMS[a.exam_type];
  const sec = ex.sections[Math.min(st.si, ex.sections.length - 1)];
  return {
    status: q ? 'in_progress' : 'finished',
    section: { index: st.si, key: sec.key, name: sec.name, total: ex.sections.length, deadline: st.deadline, manual: !!sec.manual },
    progress: { n: st.qi + 1, total: st.target || null },
    question: q ? publicQ(q) : null,
    serverNow: now(),
  };
}

app.get('/attempts/:id/current', async (c) => {
  const a = await loadAttempt(c);
  if (!a) return c.json({ error: 'not found' }, 404);
  if (a.status !== 'in_progress') return c.json({ status: 'finished' });
  const st = JSON.parse(a.state);
  const q = await ensureCurrent(c.env, a, st);
  if (q) await c.env.DB.prepare('UPDATE attempts SET state=? WHERE id=?').bind(JSON.stringify(st), a.id).run();
  return c.json(view(a, st, q));
});

app.post('/attempts/:id/answer', async (c) => {
  const a = await loadAttempt(c);
  if (!a || a.user_id !== c.get('user').id) return c.json({ error: 'not found' }, 404);
  if (a.status !== 'in_progress') return c.json({ status: 'finished' });
  const b = await c.req.json().catch(() => ({}));
  const st = JSON.parse(a.state);
  const ex = EXAMS[a.exam_type];
  if (b.questionId !== st.current) return c.json({ error: '현재 문제가 아닙니다.' }, 409);
  const q = await c.env.DB.prepare('SELECT * FROM questions WHERE id=?').bind(st.current).first();
  const inTime = now() <= st.deadline + GRACE_MS;

  if (inTime) {
    let correct = null, choice = null, text = null, audioKey = null;
    if (q.kind === 'mcq') {
      choice = Number.isInteger(b.choice) ? b.choice : null;
      correct = choice !== null && choice === q.answer ? 1 : 0;
    } else if (q.kind === 'text') {
      text = String(b.text || '').slice(0, 6000);
    } else if (q.kind === 'audio') {
      audioKey = typeof b.audioKey === 'string' && b.audioKey.startsWith(`${a.id}/`) ? b.audioKey : null;
    }
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO answers (id,attempt_id,question_id,section,kind,difficulty,choice,text,audio_key,correct,time_ms,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(uid(), a.id, q.id, q.section, q.kind, q.difficulty, choice, text, audioKey, correct, now() - st.shown, now()).run();
    st.served.push(q.id); st.qi += 1;
    if (ex.adaptive && q.kind === 'mcq') st.diff = adaptDifficulty(st.diff, correct === 1);
    st.current = null;
  } else {
    nextSection(a, st);
  }
  const next = await ensureCurrent(c.env, a, st);
  if (next) await c.env.DB.prepare('UPDATE attempts SET state=? WHERE id=?').bind(JSON.stringify(st), a.id).run();
  return c.json(view(a, st, next));
});

app.put('/attempts/:id/audio', async (c) => {
  const a = await loadAttempt(c);
  if (!a || a.user_id !== c.get('user').id || a.status !== 'in_progress') return c.json({ error: 'not found' }, 404);
  const buf = await c.req.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > 8 * 1024 * 1024) return c.json({ error: '녹음 파일 크기가 올바르지 않습니다.' }, 400);
  const key = `${a.id}/${uid()}.webm`;
  await c.env.AUDIO.put(key, buf, { httpMetadata: { contentType: c.req.header('content-type') || 'audio/webm' } });
  return c.json({ audioKey: key });
});

app.post('/attempts/:id/finish', async (c) => {
  const a = await loadAttempt(c);
  if (!a || a.user_id !== c.get('user').id) return c.json({ error: 'not found' }, 404);
  if (a.status === 'in_progress') await finish(c.env, a, JSON.parse(a.state));
  return c.json({ ok: true });
});

app.get('/attempts/:id/report', async (c) => {
  const a = await loadAttempt(c);
  if (!a) return c.json({ error: 'not found' }, 404);
  if (a.status === 'in_progress') return c.json({ error: '아직 진행 중인 시험입니다.' }, 409);
  const { results } = await c.env.DB.prepare(
    `SELECT a.section,a.kind,a.difficulty,a.choice,a.text,a.correct,a.manual_score,a.feedback,a.time_ms,
            q.stem,q.passage,q.image_svg,q.choices,q.answer,q.explanation
     FROM answers a JOIN questions q ON q.id=a.question_id WHERE a.attempt_id=? ORDER BY a.created_at`).bind(a.id).all();
  const user = await c.env.DB.prepare('SELECT name,email,grade FROM users WHERE id=?').bind(a.user_id).first();
  return c.json({
    attempt: { id: a.id, exam_type: a.exam_type, title: EXAMS[a.exam_type].title, status: a.status, started_at: a.started_at, finished_at: a.finished_at },
    student: user,
    score: a.score ? JSON.parse(a.score) : null,
    items: results.map((r) => ({ ...r, choices: r.choices ? JSON.parse(r.choices) : null })),
  });
});

export default app;
