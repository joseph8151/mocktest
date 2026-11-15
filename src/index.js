import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import auth from './routes/auth.js';
import shop from './routes/shop.js';
import exams from './routes/exams.js';
import admin from './routes/admin.js';
import sample from './routes/sample.js';
import family from './routes/family.js';
import { ensureDb } from './lib/bootstrap.js';
import { API_HEADERS } from './lib/security.js';

const app = new Hono();

// CSRF defence: cookies are SameSite=Lax; additionally require same-origin on state-changing requests
// (webhooks are exempt: they are authenticated by signature).
// Zero-config: create/seed the database on first use, and derive SITE_URL from the request when it is not configured.
app.use('/api/*', async (c, next) => {
  await ensureDb(c.env);
  if (!c.env.SITE_URL || /localhost|127\.0\.0\.1/.test(c.env.SITE_URL)) {
    const u = new URL(c.req.url);
    if (!/localhost|127\.0\.0\.1/.test(u.hostname) || !c.env.SITE_URL) c.env = { ...c.env, SITE_URL: u.origin };
  }
  await next();
});

app.use('/api/*', async (c, next) => {
  const m = c.req.method;
  if (m !== 'GET' && m !== 'HEAD' && !c.req.path.startsWith('/api/webhooks/') && !c.req.path.includes('/webhooks/') && c.req.path !== '/api/pay/kcp/return') {
    const origin = c.req.header('origin');
    if (origin && new URL(origin).host !== new URL(c.req.url).host) return c.json({ error: 'forbidden origin' }, 403);
  }
  // Request size caps (bytes): audio answers and bulk question import are the only large bodies.
  const len = Number(c.req.header('content-length') || 0);
  const cap = c.req.path.endsWith('/audio') ? 1_300_000 : c.req.path === '/api/admin/questions/import' ? 8_000_000 : 256_000;
  if (len > cap) return c.json({ error: '요청이 너무 큽니다.' }, 413);
  await next();
  c.header('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(API_HEADERS)) if (!c.res.headers.has(k)) c.header(k, v);
});

app.route('/api/auth', auth);
app.route('/api/admin', admin);
app.route('/api', sample);
app.route('/api', shop);
app.route('/api', exams);
app.route('/api', family);

app.notFound((c) => (c.req.path.startsWith('/api/') ? c.json({ error: 'not found' }, 404) : c.env.ASSETS.fetch(c.req.raw)));
app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.json({ error: '서버 오류가 발생했습니다.' }, 500);
});

export default app;
