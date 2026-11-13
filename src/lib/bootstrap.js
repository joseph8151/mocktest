// Self-provisioning database: on the first request of a fresh deployment this applies the schema
// (migrations/*.sql) and loads the sample questions/products, so no manual `d1 migrations apply` or
// seed step is needed. Safe to run repeatedly and from several isolates at once (IF NOT EXISTS / OR IGNORE).
import m1 from '../../migrations/0001_init.sql';
import m2 from '../../migrations/0002_safety.sql';
import m3 from '../../migrations/0003_audio.sql';
import seed from '../../seed/seed.json';

// [name, sql, a table that exists once this migration has been applied]
const MIGRATIONS = [['0001_init', m1, 'users'], ['0002_safety', m2, 'login_attempts'], ['0003_audio', m3, 'audio_files']];

const statements = (sql) => sql.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n').split(';').map((x) => x.trim()).filter(Boolean)
  .map((x) => x.replace(/^CREATE TABLE /i, 'CREATE TABLE IF NOT EXISTS ').replace(/^CREATE INDEX /i, 'CREATE INDEX IF NOT EXISTS '));

let ready = null;
export function ensureDb(env) {
  if (!ready) ready = run(env).catch((e) => { ready = null; throw e; });
  return ready;
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

  if ((await db.prepare('SELECT COUNT(*) n FROM questions').first()).n === 0) {
    const cols = 'id,exam_type,section,kind,difficulty,passage,stem,image_svg,choices,answer,explanation,active,created_at';
    const row = '(?,?,?,?,?,?,?,?,?,?,?,1,0)';
    const batch = [];
    for (let i = 0; i < seed.questions.length; i += 8) { // 8 rows x 11 params stays under D1's 100-parameter limit
      const chunk = seed.questions.slice(i, i + 8);
      batch.push(db.prepare(`INSERT OR IGNORE INTO questions (${cols}) VALUES ${chunk.map(() => row).join(',')}`).bind(...chunk.flat()));
    }
    for (let i = 0; i < batch.length; i += 25) await db.batch(batch.slice(i, i + 25));
  }
  if ((await db.prepare('SELECT COUNT(*) n FROM products').first()).n === 0) {
    await db.batch(seed.products.map((p) => db.prepare(
      'INSERT OR IGNORE INTO products (id,exam_type,title,description,price_krw,price_usd_cents,attempts,valid_days,active,sort) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(...p)));
  }
}
