import { Hono } from 'hono';
import { uid, now, bufToB64, numEqual, randomToken, sha256hex } from '../lib/util.js';
import { requireUser } from '../lib/auth.js';
import { EXAMS, GRACE_MS, initialState, pickNext, sectionTarget, adaptDifficulty, scoreAttempt, getLevel, levelBank, levelForGrade } from '../lib/exam.js';
import { sendMail, mailResult } from '../lib/email.js';
import { audit, logEvent } from '../lib/security.js';

const app = new Hono();
app.use('*', requireUser);

const publicQ = (q) => ({
  id: q.id, section: q.section, kind: q.kind, passage: q.passage, stem: q.stem, image_svg: q.image_svg,
  choices: q.choices && q.kind !== 'num' ? JSON.parse(q.choices) : null,
});

app.get('/exams', (c) => c.json({
  exams: Object.entries(EXAMS).map(([k, e]) => ({ type: k, title: e.title, sections: e.sections, levels: e.levels || [], suggested: levelForGrade(k, c.get('user')?.grade) })),
}));

/** Wrong-answer notebook: the most recent wrong answer per question, with the explanation. */
app.get('/me/mistakes', async (c) => {
  const u = c.get('user'), { exam, section } = c.req.query();
  const { results } = await c.env.DB.prepare(
    `SELECT q.id, q.exam_type, q.section, q.kind, q.difficulty, q.passage, q.stem, q.image_svg, q.choices, q.answer, q.explanation, a.choice, a.text, a.created_at
     FROM answers a JOIN attempts t ON t.id=a.attempt_id JOIN questions q ON q.id=a.question_id
     WHERE t.user_id=?1 AND a.correct=0 AND t.status!='in_progress' AND (?2 IS NULL OR q.exam_type=?2) AND (?3 IS NULL OR q.section=?3)
     ORDER BY a.created_at DESC LIMIT 400`).bind(u.id, exam || null, section || null).all();
  const seen = new Set(), items = [];
  for (const r of results) { if (seen.has(r.id)) continue; seen.add(r.id); items.push({ ...r, choices: JSON.parse(r.choices) }); }
  return c.json({ items: items.slice(0, 200) });
});

app.get('/me/overview', async (c) => {
  const u = c.get('user');
  const [ents, atts] = await Promise.all([
    c.env.DB.prepare(
      `SELECT e.*, p.title FROM entitlements e JOIN products p ON p.id=e.product_id
       WHERE e.user_id=? AND e.revoked=0 ORDER BY e.created_at DESC`).bind(u.id).all(),
    c.env.DB.prepare(
      `SELECT id,exam_type,status,started_at,finished_at,score,json_extract(state,'$.level') AS level FROM attempts WHERE user_id=? ORDER BY started_at DESC`).bind(u.id).all(),
  ]);
  return c.json({
    entitlements: ents.results.map((e) => ({ ...e, remaining: e.attempts_total - e.attempts_used, trial: e.order_id === null, expired: !!e.expires_at && e.expires_at < now() })),
    attempts: atts.results.map((a) => ({ ...a, score: a.score ? JSON.parse(a.score) : null })),
  });
});

/* ---- start / resume ---- */
app.post('/attempts', async (c) => {
  const u = c.get('user');
  const { examType, level } = await c.req.json().catch(() => ({}));
  if (!EXAMS[examType]) return c.json({ error: '알 수 없는 시험입니다.' }, 400);
  if (level && !(EXAMS[examType].levels || []).some((l) => l.key === level)) return c.json({ error: '레벨이 올바르지 않습니다.' }, 400);
  const levelKey = level || levelForGrade(examType, u.grade) || getLevel(examType).key;
  const open = await c.env.DB.prepare(`SELECT id FROM attempts WHERE user_id=? AND exam_type=? AND status='in_progress'`).bind(u.id, examType).first();
  if (open) return c.json({ id: open.id, resumed: true });

  let ent = await c.env.DB.prepare(
    `SELECT id FROM entitlements WHERE user_id=? AND exam_type=? AND revoked=0 AND attempts_used<attempts_total
     AND (expires_at IS NULL OR expires_at>?) ORDER BY expires_at LIMIT 1`).bind(u.id, examType, now()).first();
  if (!ent && u.role === 'admin') { // admins can try every exam without paying: unlimited trial ticket (no order attached)
    const prod = await c.env.DB.prepare('SELECT id FROM products WHERE exam_type=? ORDER BY sort LIMIT 1').bind(examType).first();
    if (prod) {
      const eid = uid();
      await c.env.DB.prepare(`INSERT INTO entitlements (id,user_id,product_id,order_id,exam_type,attempts_total,expires_at,created_at) VALUES (?,?,?,NULL,?,1000000,NULL,?)`).bind(eid, u.id, prod.id, examType, now()).run();
      ent = { id: eid };
    }
  }
  if (!ent) return c.json({ error: '응시 가능한 이용권이 없습니다. 먼저 결제해 주세요.' }, 402);
  const claim = await c.env.DB.prepare('UPDATE entitlements SET attempts_used=attempts_used+1 WHERE id=? AND attempts_used<attempts_total').bind(ent.id).run();
  if (!claim.meta.changes) return c.json({ error: '이용권이 소진되었습니다.' }, 402);
  const id = uid();
  try {
    await c.env.DB.prepare('INSERT INTO attempts (id,user_id,entitlement_id,exam_type,state,started_at) VALUES (?,?,?,?,?,?)')
      .bind(id, u.id, ent.id, examType, JSON.stringify(initialState(examType, now(), levelKey)), now()).run();
  } catch (e) { // a parallel request already opened one: return the ticket and resume that attempt
    await c.env.DB.prepare('UPDATE entitlements SET attempts_used=attempts_used-1 WHERE id=? AND attempts_used>0').bind(ent.id).run();
    const again = await c.env.DB.prepare(`SELECT id FROM attempts WHERE user_id=? AND exam_type=? AND status='in_progress'`).bind(u.id, examType).first();
    if (again) return c.json({ id: again.id, resumed: true });
    throw e;
  }
  await audit(c, 'exam.start', id, { exam: examType, level: levelKey, entitlement: ent.id, trial: !!ent.id && u.role === 'admin' });
  return c.json({ id });
});

async function loadAttempt(c, { live = false } = {}) {
  const a = await c.env.DB.prepare('SELECT * FROM attempts WHERE id=?').bind(c.req.param('id')).first();
  const u = c.get('user');
  if (!a) return null;
  if (live) { // taking the test: owner only, and only while the ticket is still valid
    if (a.user_id !== u.id) return null;
    if (a.status === 'in_progress' && (await c.env.DB.prepare('SELECT revoked FROM entitlements WHERE id=?').bind(a.entitlement_id).first())?.revoked) return null;
    return a;
  }
  if (a.user_id !== u.id && u.role !== 'admin') return null;
  return a;
}

async function finish(env, a, st) {
  const { results } = await env.DB.prepare('SELECT * FROM answers WHERE attempt_id=?').bind(a.id).all();
  const score = scoreAttempt(a.exam_type, results, st.level);
  const status = score.pendingManual ? 'submitted' : 'graded';
  await env.DB.prepare('UPDATE attempts SET status=?, score=?, state=?, finished_at=? WHERE id=?')
    .bind(status, JSON.stringify(score), JSON.stringify(st), now(), a.id).run();
  const u = await env.DB.prepare('SELECT id,email FROM users WHERE id=?').bind(a.user_id).first();
  await logEvent(env, { actor: u, action: 'exam.finish', target: a.id, detail: { exam: a.exam_type, level: st.level, status, score: score.headline ? `${score.headline.label} ${score.headline.value}` : score.overall ?? null, answered: results.length } });
  if (status === 'graded') await notifyResult(env, a);
}
export async function notifyResult(env, a) {
  const u = await env.DB.prepare('SELECT email,name FROM users WHERE id=?').bind(a.user_id).first();
  if (u) await sendMail(env, u.email, `[${env.SITE_NAME}] 결과 리포트`, mailResult(env, u.name, EXAMS[a.exam_type].title, a.id));
}

/** Move to the section after st.si. Returns false if the exam is over. */
function nextSection(a, st) {
  const ex = EXAMS[a.exam_type];
  const lv = getLevel(a.exam_type, st.level);
  st.si += 1; st.qi = 0; st.served = []; st.current = null; st.set = null; st.diff = Math.round((lv.dmin + lv.dmax) / 2);
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
        `SELECT id,difficulty FROM questions WHERE exam_type=? AND section=? AND active=1 AND substr(id,-1) NOT IN ('0','8')`).bind(a.exam_type, sec.key).all(); // '0' = free-sample pool
      const lv = getLevel(a.exam_type, st.level);
      const { pool, lo, hi } = levelBank(bank, lv, sec.n);
      const target = sectionTarget(a.exam_type, st.si, pool.length);
      st.target = target; st.lo = lo; st.hi = hi;
      if (st.qi >= target) { nextSection(a, st); continue; }
      const id = pickNext(a.exam_type, st, pool, target, lo, hi);
      if (!id) { nextSection(a, st); continue; }
      st.current = id; st.shown = now();
    }
    const q = await env.DB.prepare('SELECT * FROM questions WHERE id=?').bind(st.current).first();
    return q;
  }
  return null;
}


/* ===== Section mode (every non-adaptive exam): the whole section is fixed up-front; students move freely,
   change answers and skip; unanswered questions are recorded as omitted when the section is submitted. ===== */
async function buildSectionSet(env, a, st) {
  const sec = EXAMS[a.exam_type].sections[st.si];
  const { results: bank } = await env.DB.prepare(`SELECT id,difficulty FROM questions WHERE exam_type=? AND section=? AND active=1 AND substr(id,-1) NOT IN ('0','8')`).bind(a.exam_type, sec.key).all(); // '0' = free-sample pool
  const lv = getLevel(a.exam_type, st.level);
  const { pool, lo, hi } = levelBank(bank, lv, sec.n);
  const target = sectionTarget(a.exam_type, st.si, pool.length), ids = [], sim = { ...st, served: [], qi: 0 };
  for (let i = 0; i < target; i++) { const id = pickNext(a.exam_type, sim, pool, target, lo, hi); if (!id) break; ids.push(id); sim.served.push(id); sim.qi++; }
  st.set = { si: st.si, ids }; st.target = ids.length;
}
async function finalizeSection(env, a, st) { // unanswered -> omitted (choice NULL, correct 0) so they count in the score
  if (!st.set || st.set.si !== st.si) return;
  const { results: done } = await env.DB.prepare('SELECT question_id FROM answers WHERE attempt_id=?').bind(a.id).all();
  const have = new Set(done.map((r) => r.question_id)), missing = st.set.ids.filter((id) => !have.has(id));
  if (!missing.length) return;
  const { results: qs } = await env.DB.prepare(`SELECT id,section,kind,difficulty FROM questions WHERE id IN (${missing.map(() => '?').join(',')})`).bind(...missing).all();
  const rows = qs.filter((q) => q.kind === 'mcq' || q.kind === 'num').map((q) => env.DB.prepare(
    `INSERT OR IGNORE INTO answers (id,attempt_id,question_id,section,kind,difficulty,choice,correct,time_ms,created_at) VALUES (?,?,?,?,?,?,NULL,0,0,?)`).bind(uid(), a.id, q.id, q.section, q.kind, q.difficulty, now()));
  if (rows.length) await env.DB.batch(rows);
}
/** Advance through expired sections, build the current section's set, or finish. Returns false when the attempt finished. */
async function ensureSection(env, a, st) {
  const ex = EXAMS[a.exam_type];
  for (let guard = 0; guard < 20; guard++) {
    if (st.si >= ex.sections.length) { await finish(env, a, st); return false; }
    if (now() > st.deadline + GRACE_MS) { await finalizeSection(env, a, st); nextSection(a, st); continue; }
    if (!st.set || st.set.si !== st.si) await buildSectionSet(env, a, st);
    if (!st.set.ids.length) { nextSection(a, st); continue; }
    return true;
  }
  return false;
}
async function sectionView(env, a, st) {
  const ex = EXAMS[a.exam_type], sec = ex.sections[st.si];
  const ids = st.set.ids;
  const { results: qs } = await env.DB.prepare(`SELECT * FROM questions WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
  const byId = Object.fromEntries(qs.map((q) => [q.id, q]));
  const { results: ans } = await env.DB.prepare(`SELECT question_id,choice,text,audio_key FROM answers WHERE attempt_id=? AND section=?`).bind(a.id, sec.key).all();
  return {
    status: 'in_progress', mode: 'section',
    section: { index: st.si, key: sec.key, name: sec.name, total: ex.sections.length, deadline: st.deadline, manual: !!sec.manual },
    questions: ids.map((id) => byId[id]).filter(Boolean).map(publicQ),
    saved: Object.fromEntries(ans.map((r) => [r.question_id, { choice: r.choice, text: r.text, audio: !!r.audio_key }])),
    penalty: a.exam_type === 'SSAT' && st.level !== 'elem',
    serverNow: now(),
  };
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
  const a = await loadAttempt(c, { live: true });
  if (!a) return c.json({ error: 'not found' }, 404);
  if (a.status !== 'in_progress') return c.json({ status: 'finished' });
  const st = JSON.parse(a.state);
  if (!EXAMS[a.exam_type].adaptive) {
    if (!(await ensureSection(c.env, a, st))) return c.json({ status: 'finished' });
    const w = await c.env.DB.prepare('UPDATE attempts SET state=? WHERE id=? AND state=?').bind(JSON.stringify(st), a.id, a.state).run();
    if (!w.meta.changes) { // another request changed the state first (e.g. built this section's set): serve what was stored
      const fresh = await c.env.DB.prepare('SELECT * FROM attempts WHERE id=?').bind(a.id).first();
      const st2 = JSON.parse(fresh.state);
      if (fresh.status !== 'in_progress' || !st2.set || st2.set.si !== st2.si) return c.json({ status: fresh.status === 'in_progress' ? 'retry' : 'finished' });
      return c.json(await sectionView(c.env, fresh, st2));
    }
    return c.json(await sectionView(c.env, a, st));
  }
  const q = await ensureCurrent(c.env, a, st);
  if (q) await c.env.DB.prepare('UPDATE attempts SET state=? WHERE id=?').bind(JSON.stringify(st), a.id).run();
  return c.json({ ...view(a, st, q), mode: 'adaptive' });
});

/** Save (or change, or clear) one answer inside the current section. */
app.post('/attempts/:id/save', async (c) => {
  const a = await loadAttempt(c, { live: true });
  if (!a) return c.json({ error: 'not found' }, 404);
  if (a.status !== 'in_progress' || EXAMS[a.exam_type].adaptive) return c.json({ error: '저장할 수 없는 상태입니다.' }, 409);
  const b = await c.req.json().catch(() => ({}));
  const st = JSON.parse(a.state);
  if (!st.set || st.set.si !== st.si || !st.set.ids.includes(b.questionId)) return c.json({ error: '현재 영역의 문제가 아닙니다.' }, 409);
  if (now() > st.deadline + GRACE_MS) return c.json({ error: '이 영역의 시간이 끝났습니다.', expired: true }, 409);
  const q = await c.env.DB.prepare('SELECT * FROM questions WHERE id=?').bind(b.questionId).first();
  if (b.clear) { await c.env.DB.prepare('DELETE FROM answers WHERE attempt_id=? AND question_id=?').bind(a.id, q.id).run(); return c.json({ ok: true }); }
  let choice = null, text = null, audioKey = null, correct = null;
  if (q.kind === 'mcq') { choice = Number.isInteger(b.choice) ? b.choice : null; correct = choice !== null && choice === q.answer ? 1 : 0; }
  else if (q.kind === 'num') { text = String(b.text ?? '').slice(0, 20); correct = text.trim() ? (numEqual(text, JSON.parse(q.choices)) ? 1 : 0) : 0; }
  else if (q.kind === 'text') text = String(b.text || '').slice(0, 6000);
  else if (q.kind === 'audio') audioKey = typeof b.audioKey === 'string' && b.audioKey.startsWith(`${a.id}/`) ? b.audioKey : null;
  await c.env.DB.prepare(
    `INSERT INTO answers (id,attempt_id,question_id,section,kind,difficulty,choice,text,audio_key,correct,time_ms,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(attempt_id, question_id) DO UPDATE SET choice=excluded.choice, text=excluded.text, audio_key=COALESCE(excluded.audio_key, answers.audio_key), correct=excluded.correct, time_ms=answers.time_ms+excluded.time_ms`
  ).bind(uid(), a.id, q.id, q.section, q.kind, q.difficulty, choice, text, audioKey, correct, Math.max(0, Math.min(600000, +b.ms || 0)), now()).run();
  return c.json({ ok: true });
});

/** Finish the current section (unanswered -> omitted) and open the next one. */
app.post('/attempts/:id/submit-section', async (c) => {
  const a = await loadAttempt(c, { live: true });
  if (!a) return c.json({ error: 'not found' }, 404);
  if (a.status !== 'in_progress') return c.json({ status: 'finished' });
  const b = await c.req.json().catch(() => ({}));
  const st = JSON.parse(a.state);
  if (Number.isInteger(b.section) && b.section === st.si) { await finalizeSection(c.env, a, st); await audit(c, 'exam.section_submit', a.id, { exam: a.exam_type, section: EXAMS[a.exam_type].sections[st.si]?.key }); nextSection(a, st); }
  if (!(await ensureSection(c.env, a, st))) return c.json({ status: 'finished' });
  await c.env.DB.prepare('UPDATE attempts SET state=? WHERE id=?').bind(JSON.stringify(st), a.id).run();
  return c.json(await sectionView(c.env, a, st));
});

app.post('/attempts/:id/answer', async (c) => {
  const a = await loadAttempt(c, { live: true });
  if (!a) return c.json({ error: 'not found' }, 404);
  if (a.status !== 'in_progress') return c.json({ status: 'finished' });
  const b = await c.req.json().catch(() => ({}));
  const st = JSON.parse(a.state);
  const ex = EXAMS[a.exam_type];
  if (!EXAMS[a.exam_type].adaptive) return c.json({ error: '이 시험은 영역 단위로 저장합니다.' }, 409);
  if (b.questionId !== st.current) return c.json({ error: '현재 문제가 아닙니다.' }, 409);
  const q = await c.env.DB.prepare('SELECT * FROM questions WHERE id=?').bind(st.current).first();
  const inTime = now() <= st.deadline + GRACE_MS;

  if (inTime) {
    let correct = null, choice = null, text = null, audioKey = null;
    if (q.kind === 'mcq') {
      choice = Number.isInteger(b.choice) ? b.choice : null;
      correct = choice !== null && choice === q.answer ? 1 : 0;
    } else if (q.kind === 'num') {
      text = String(b.text ?? '').slice(0, 20); correct = text.trim() && numEqual(text, JSON.parse(q.choices)) ? 1 : 0;
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
    if (ex.adaptive && q.kind === 'mcq') st.diff = adaptDifficulty(st.diff, correct === 1, st.lo || 1, st.hi || 5);
    st.current = null;
  } else {
    nextSection(a, st);
  }
  const next = await ensureCurrent(c.env, a, st);
  if (next) await c.env.DB.prepare('UPDATE attempts SET state=? WHERE id=?').bind(JSON.stringify(st), a.id).run();
  return c.json(view(a, st, next));
});

app.put('/attempts/:id/audio', async (c) => {
  const a = await loadAttempt(c, { live: true });
  if (!a || a.status !== 'in_progress') return c.json({ error: 'not found' }, 404);
  const buf = await c.req.arrayBuffer();
  if (!buf.byteLength) return c.json({ error: '녹음 파일이 비어 있습니다.' }, 400);
  const ctype = (c.req.header('content-type') || 'audio/webm').split(';')[0].trim().toLowerCase();
  if (!/^audio\/(webm|ogg|mp4|mpeg|wav|x-m4a|aac)$/.test(ctype)) return c.json({ error: '오디오 파일만 업로드할 수 있습니다.' }, 415);
  if ((await c.env.DB.prepare('SELECT COUNT(*) n FROM audio_files WHERE attempt_id=?').bind(a.id).first()).n >= 12) return c.json({ error: '녹음은 시험당 12개까지 저장할 수 있습니다.' }, 429);
  if (buf.byteLength > 1_200_000) return c.json({ error: '녹음이 너무 깁니다. 더 짧게 다시 녹음해 주세요. (약 1분 이내)' }, 413);
  const key = `${a.id}/${uid()}.webm`;
  await c.env.DB.prepare('INSERT INTO audio_files (key,attempt_id,content_type,data,created_at) VALUES (?,?,?,?,?)')
    .bind(key, a.id, ctype, bufToB64(buf), now()).run();
  await audit(c, 'exam.audio_upload', a.id, { bytes: buf.byteLength });
  return c.json({ audioKey: key });
});

app.post('/attempts/:id/finish', async (c) => {
  const a = await loadAttempt(c);
  if (!a || a.user_id !== c.get('user').id) return c.json({ error: 'not found' }, 404);
  if (a.status === 'in_progress') { const st = JSON.parse(a.state); if (!EXAMS[a.exam_type].adaptive) await finalizeSection(c.env, a, st); await finish(c.env, a, st); }
  return c.json({ ok: true });
});

/** Report payload. `shared` = the read-only parent view: no e-mail, no internal ids. */
export async function buildReport(env, a, { shared = false } = {}) {
  const { results } = await env.DB.prepare(
    `SELECT a.section,a.kind,a.difficulty,a.choice,a.text,a.correct,a.manual_score,a.feedback,a.time_ms,
            q.stem,q.passage,q.image_svg,q.choices,q.answer,q.explanation
     FROM answers a JOIN questions q ON q.id=a.question_id WHERE a.attempt_id=? ORDER BY a.created_at`).bind(a.id).all();
  const user = await env.DB.prepare('SELECT name,email,grade FROM users WHERE id=?').bind(a.user_id).first();
  const lv = getLevel(a.exam_type, JSON.parse(a.state).level);
  return {
    attempt: { id: shared ? null : a.id, exam_type: a.exam_type, title: EXAMS[a.exam_type].title, status: a.status, started_at: a.started_at, finished_at: a.finished_at, level: { key: lv.key, name: lv.name, grades: lv.grades } },
    student: shared ? { name: user?.name, grade: user?.grade } : user,
    score: a.score ? JSON.parse(a.score) : null,
    items: results.map((r) => ({ ...r, choices: r.choices ? JSON.parse(r.choices) : null })),
    shared,
  };
}

app.get('/attempts/:id/report', async (c) => {
  const a = await loadAttempt(c);
  if (!a) return c.json({ error: 'not found' }, 404);
  if (a.status === 'in_progress') return c.json({ error: '아직 진행 중인 시험입니다.' }, 409);
  const r = await buildReport(c.env, a);
  if (a.user_id === c.get('user').id) r.shareCount = (await c.env.DB.prepare('SELECT COUNT(*) n FROM share_links WHERE attempt_id=? AND expires_at>? AND revoked_at IS NULL').bind(a.id, now()).first()).n;
  return c.json(r);
});

/* ---- read-only report links for parents / tutors (14 days, revocable) ---- */
app.post('/attempts/:id/share', async (c) => {
  const a = await loadAttempt(c);
  if (!a || a.user_id !== c.get('user').id) return c.json({ error: 'not found' }, 404);
  if (a.status === 'in_progress') return c.json({ error: '시험을 마친 뒤 공유할 수 있습니다.' }, 409);
  if ((await c.env.DB.prepare('SELECT COUNT(*) n FROM share_links WHERE user_id=? AND created_at>?').bind(a.user_id, now() - 86400000).first()).n >= 20)
    return c.json({ error: '오늘은 더 이상 링크를 만들 수 없습니다.' }, 429);
  const token = randomToken(24);
  await c.env.DB.prepare('INSERT INTO share_links (token_hash,attempt_id,user_id,expires_at,created_at) VALUES (?,?,?,?,?)')
    .bind(await sha256hex(token), a.id, a.user_id, now() + 14 * 86400000, now()).run();
  await audit(c, 'share.create', a.id, { exam: a.exam_type, days: 14 });
  return c.json({ url: `${c.env.SITE_URL}/#/shared/${token}`, expiresAt: now() + 14 * 86400000 });
});
app.delete('/attempts/:id/share', async (c) => {
  const a = await loadAttempt(c);
  if (!a || a.user_id !== c.get('user').id) return c.json({ error: 'not found' }, 404);
  await c.env.DB.prepare('UPDATE share_links SET revoked_at=?, expires_at=? WHERE attempt_id=? AND revoked_at IS NULL').bind(now(), now(), a.id).run(); // kept, just closed
  await audit(c, 'share.revoke', a.id);
  return c.json({ ok: true });
});

export default app;
