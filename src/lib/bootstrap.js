// Self-provisioning database: on the first request of a fresh deployment this applies the schema
// (migrations/*.sql) and loads the sample questions/products, so no manual `d1 migrations apply` or
// seed step is needed. Safe to run repeatedly and from several isolates at once (IF NOT EXISTS / OR IGNORE).
import m1 from '../../migrations/0001_init.sql';
import m2 from '../../migrations/0002_safety.sql';
import m3 from '../../migrations/0003_audio.sql';
import m4 from '../../migrations/0004_prices.sql';
import m5 from '../../migrations/0005_admin_and_kcp.sql';
import m6 from '../../migrations/0006_new_exams.sql';
import m7 from '../../migrations/0007_integrity.sql';
import m8 from '../../migrations/0008_security_features.sql';
import m9 from '../../migrations/0009_records.sql';
import m10 from '../../migrations/0010_family_and_more.sql';
import m11 from '../../migrations/0011_kr_tests.sql';
import m12 from '../../migrations/0012_ai_grading.sql';
import m13 from '../../migrations/0013_contact.sql';
import m14 from '../../migrations/0014_listening_audio.sql';
import manifest from '../../seed/manifest.json'; // small: version + products. The question bank itself is a private static file.

// [name, sql, a table that exists once this migration has been applied]
const MIGRATIONS = [['0001_init', m1, 'users'], ['0002_safety', m2, 'login_attempts'], ['0003_audio', m3, 'audio_files']];

const statements = (sql) => {
  const parts = sql.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n').split(';').map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (const x of parts) { // a trigger body (BEGIN ...; END) was split on its inner ';' — glue it back together
    const last = out[out.length - 1];
    if (last && /^CREATE TRIGGER/i.test(last) && !/\bEND$/i.test(last)) out[out.length - 1] = `${last}; ${x}`; else out.push(x);
  }
  return out.map((x) => x.replace(/^CREATE TABLE /i, 'CREATE TABLE IF NOT EXISTS ').replace(/^CREATE INDEX /i, 'CREATE INDEX IF NOT EXISTS ').replace(/^CREATE TRIGGER /i, 'CREATE TRIGGER IF NOT EXISTS '));
};

// One-time data updates, applied AFTER seeding (so a fresh database is not left with only these rows).
const DATA_FIXES = [['0004_prices', m4], ['0005_admin_and_kcp', m5], ['0006_new_exams', m6], ['0007_integrity', m7], ['0008_security_features', m8], ['0009_records', m9], ['0010_family_and_more', m10], ['0011_kr_tests', m11], ['0012_ai_grading', m12], ['0013_contact', m13], ['0014_listening_audio', m14]];

let ready = null, syncing = null;
/**
 * Schema migrations and small data fixes run before the first request is served (fast: a few queries per new isolate).
 * The question-bank sync can take a while after a deploy, so it runs in the background (one isolate at a time) and
 * requests are never kept waiting for it — except on a brand-new, empty database, where there is nothing to serve yet.
 */
// A new isolate normally needs 3+ queries just to confirm the schema is current. Once one isolate in this Cloudflare
// location has confirmed it for this release, the others skip the check (marker in the edge cache, 1 day).
const SCHEMA_KEY = () => new Request(`https://schema.internal/ok/${MIGRATIONS.length}-${DATA_FIXES.length}-${manifest.version}`);
async function schemaKnownGood() { try { return !!(await globalThis.caches?.default?.match(SCHEMA_KEY())); } catch { return false; } }
function markSchemaGood(ctx) {
  try { const p = globalThis.caches?.default?.put(SCHEMA_KEY(), new Response('ok', { headers: { 'Cache-Control': 'public, max-age=86400' } })); if (p) ctx?.waitUntil(p.catch(() => {})); } catch {}
}
export function ensureDb(env, ctx) {
  if (!ready) ready = (async () => {
    if (await schemaKnownGood()) return false;
    const needSync = await run(env);
    if (!needSync) markSchemaGood(ctx);
    return needSync;
  })().catch((e) => { ready = null; throw e; });
  return ready.then((needSync) => {
    if (!needSync || syncing) return;
    syncing = syncSeed(env).catch((e) => console.error('seed sync', e)).finally(() => { syncing = null; });
    try { ctx?.waitUntil(syncing); } catch {}
  });
}

async function run(env) {
  const db = env.DB;
  await db.prepare('CREATE TABLE IF NOT EXISTS _app_migrations (name TEXT PRIMARY KEY, at INTEGER)').run();
  const tables = new Set((await db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all()).results.map((r) => r.name));
  const done = new Set((await db.prepare('SELECT name FROM _app_migrations').all()).results.map((r) => r.name));
  for (const [name, sql, probe] of MIGRATIONS) {
    if (done.has(name)) continue;
    const mark = db.prepare('INSERT OR IGNORE INTO _app_migrations (name,at) VALUES (?,?)').bind(name, Date.now());
    // Database already created by `wrangler d1 migrations apply`: just record it.
    if (tables.has(probe)) await mark.run();
    else await db.batch([...statements(sql).map((s) => db.prepare(s)), mark]);
  }
  if ((await db.prepare('SELECT COUNT(*) n FROM products').first()).n === 0) {
    await db.batch(manifest.products.map((p) => db.prepare(
      'INSERT OR IGNORE INTO products (id,exam_type,title,description,price_krw,price_usd_cents,attempts,valid_days,active,sort) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(...p)));
  }
  for (const [name, sql] of DATA_FIXES) {
    if (done.has(name)) continue;
    const stmts = [];
    for (const x of statements(sql)) { // a database migrated with `wrangler d1 migrations apply` may already have the column
      const m = x.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+)/i);
      if (m && (await db.prepare(`SELECT 1 FROM pragma_table_info('${m[1]}') WHERE name=?`).bind(m[2]).first())) continue;
      stmts.push(db.prepare(x));
    }
    await db.batch([...stmts, db.prepare('INSERT OR IGNORE INTO _app_migrations (name,at) VALUES (?,?)').bind(name, Date.now())]);
  }
  if (done.has(`seed-${manifest.version}`)) return false;
  // Empty database (fresh install): load the questions now, there is nothing to serve without them.
  if (!(await db.prepare(`SELECT 1 FROM questions WHERE id LIKE 'seed-%' LIMIT 1`).first())) { await syncSeed(env, { force: true }); return false; }
  return true;
}

/** Question bank sync. Ids are content hashes, so a new seed version only adds new questions and retires removed ones
 * (answered questions are kept but deactivated so old reports still render). Admin-created questions (uuid ids) are never touched. */
async function syncSeed(env, { force = false } = {}) {
  const db = env.DB, seedMark = `seed-${manifest.version}`, lock = `seedlock-${manifest.version}`, t = Date.now();
  if (await db.prepare('SELECT 1 FROM _app_migrations WHERE name=?').bind(seedMark).first()) return;
  if (!force) { // one isolate at a time; a lock older than 5 minutes is considered abandoned
    const got = await db.prepare('INSERT OR IGNORE INTO _app_migrations (name,at) VALUES (?,?)').bind(lock, t).run();
    if (!got.meta.changes) {
      const stolen = await db.prepare('UPDATE _app_migrations SET at=? WHERE name=? AND at<?').bind(t, lock, t - 300000).run();
      if (!stolen.meta.changes) return;
    }
  }
  const res = await env.ASSETS.fetch(new Request('https://assets.local/_seed/seed.json'));
  if (!res.ok) throw new Error(`seed file missing (${res.status})`);
  const seed = await res.json();
  if (seed.version !== manifest.version) throw new Error('seed file and manifest disagree');
  {
    const cur = (await db.prepare(`SELECT id,difficulty FROM questions WHERE id LIKE 'seed-%'`).all()).results;
    const have = new Set(cur.map((r) => r.id));
    // difficulty re-calibration of existing questions (ids are content hashes, difficulty is not part of them)
    const want0 = new Map(seed.questions.map((q) => [q[0], q[4]]));
    const recal = cur.filter((r) => want0.has(r.id) && want0.get(r.id) !== r.difficulty).map((r) => db.prepare('UPDATE questions SET difficulty=? WHERE id=?').bind(want0.get(r.id), r.id));
    for (let i = 0; i < recal.length; i += 50) await db.batch(recal.slice(i, i + 50));
    // redrawn figures (e.g. made legible on phones): the figure is not part of the id either
    const wantSvg = new Map(seed.questions.filter((q) => q[7]).map((q) => [q[0], q[7]]));
    const curSvg = (await db.prepare(`SELECT id,image_svg FROM questions WHERE id LIKE 'seed-%' AND image_svg IS NOT NULL`).all()).results;
    const redraw = curSvg.filter((r) => wantSvg.has(r.id) && wantSvg.get(r.id) !== r.image_svg).map((r) => db.prepare('UPDATE questions SET image_svg=? WHERE id=?').bind(wantSvg.get(r.id), r.id));
    for (let i = 0; i < redraw.length; i += 50) await db.batch(redraw.slice(i, i + 50));
    const want = new Set(seed.questions.map((q) => q[0]));
    const stale = [...have].filter((id) => !want.has(id));
    if (stale.length) {
      const answered = new Set((await db.prepare('SELECT DISTINCT question_id AS id FROM answers').all()).results.map((r) => r.id));
      const ops = [];
      for (const id of stale) ops.push(db.prepare(answered.has(id) ? 'UPDATE questions SET active=0 WHERE id=?' : 'DELETE FROM questions WHERE id=?').bind(id));
      for (let i = 0; i < ops.length; i += 50) await db.batch(ops.slice(i, i + 50));
    }
    const cols = 'id,exam_type,section,kind,difficulty,passage,stem,image_svg,choices,answer,explanation,active,created_at';
    const row = '(?,?,?,?,?,?,?,?,?,?,?,1,0)';
    const fresh = seed.questions.filter((q) => !have.has(q[0]));
    const batch = [];
    for (let i = 0; i < fresh.length; i += 8) { // 8 rows x 11 params stays under D1's 100-parameter limit
      const chunk = fresh.slice(i, i + 8);
      batch.push(db.prepare(`INSERT OR IGNORE INTO questions (${cols}) VALUES ${chunk.map(() => row).join(',')}`).bind(...chunk.flat()));
    }
    for (let i = 0; i < batch.length; i += 25) await db.batch(batch.slice(i, i + 25));
    await db.prepare('INSERT OR IGNORE INTO _app_migrations (name,at) VALUES (?,?)').bind(seedMark, Date.now()).run();
  }
  await db.prepare('DELETE FROM _app_migrations WHERE name=?').bind(lock).run();
}
