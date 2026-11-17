// Recorded audio for listening passages. A passage is identified by its exam and text, so re-seeding keeps the link
// and editing the script (new text = new key) drops the stale recording back to text-to-speech automatically.
export const LISTEN_MAX_BYTES = 1_400_000;

export function listenKey(exam, passage) {
  let h = 0x811c9dc5;
  for (const ch of String(passage)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${String(exam).toLowerCase()}-${h.toString(16).padStart(8, '0')}`;
}

let cache = { at: 0, v: null };
export const clearAudioIndex = () => { cache = { at: 0, v: null }; };
/** key -> updated_at of every uploaded recording (cached 60s per isolate). */
export async function audioIndex(env) {
  if (cache.v && Date.now() - cache.at < 60000) return cache.v;
  try {
    const { results } = await env.DB.prepare('SELECT key,updated_at FROM listening_audio').all();
    cache = { at: Date.now(), v: new Map(results.map((r) => [r.key, r.updated_at])) };
  } catch { cache = { at: Date.now(), v: new Map() }; }
  return cache.v;
}
/** URL of the recording for a listening question, or null (then the browser uses text-to-speech). */
export function audioUrl(idx, exam, q) {
  if (!q.passage || !/listen/i.test(q.section || '')) return null;
  const k = listenKey(exam, q.passage), v = idx.get(k);
  return v ? `/api/listening/${k}.mp3?v=${v}` : null;
}
