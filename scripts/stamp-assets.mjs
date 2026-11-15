// Adds a content hash to the app.js / style.css URLs in index.html (cache busting). Runs automatically before
// `wrangler deploy` / `wrangler dev` (wrangler.jsonc → build.command), so the files can be cached by browsers for a year.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const pub = new URL('../public/', import.meta.url);
const h = (f) => createHash('sha256').update(readFileSync(new URL(f, pub))).digest('hex').slice(0, 10);
let html = readFileSync(new URL('index.html', pub), 'utf8');
for (const f of ['app.js', 'style.css']) html = html.replace(new RegExp(`/${f.replace('.', '\\.')}(\\?v=[0-9a-f]+)?"`), `/${f}?v=${h(f)}"`);
writeFileSync(new URL('index.html', pub), html);
console.log('stamped', html.match(/\/(app\.js|style\.css)\?v=[0-9a-f]+/g).join(' '));
