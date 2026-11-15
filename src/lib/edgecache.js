// Keys for the edge cache of public GET endpoints (see src/index.js). Admin changes purge the affected entries.
import manifest from '../../seed/manifest.json';
export const edgeKey = (origin, path) => new Request(`${origin}${path}?__v=${manifest.version}`);
export async function purgeEdge(c, paths) {
  const cache = globalThis.caches?.default; if (!cache) return;
  const origin = new URL(c.req.url).origin;
  await Promise.all(paths.map((p) => cache.delete(edgeKey(origin, p)).catch(() => {})));
}
