import { Hono } from 'hono';
import auth from './routes/auth.js';
import shop from './routes/shop.js';
import exams from './routes/exams.js';
import admin from './routes/admin.js';

const app = new Hono();

// CSRF defence: cookies are SameSite=Lax; additionally require same-origin on state-changing requests
// (webhooks are exempt: they are authenticated by signature).
app.use('/api/*', async (c, next) => {
  const m = c.req.method;
  if (m !== 'GET' && m !== 'HEAD' && !c.req.path.startsWith('/api/webhooks/') && !c.req.path.includes('/webhooks/')) {
    const origin = c.req.header('origin');
    if (origin && new URL(origin).host !== new URL(c.req.url).host) return c.json({ error: 'forbidden origin' }, 403);
  }
  await next();
  c.header('Cache-Control', 'no-store');
});

app.route('/api/auth', auth);
app.route('/api/admin', admin);
app.route('/api', shop);
app.route('/api', exams);

app.notFound((c) => (c.req.path.startsWith('/api/') ? c.json({ error: 'not found' }, 404) : c.env.ASSETS.fetch(c.req.raw)));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: '서버 오류가 발생했습니다.' }, 500);
});

export default app;
