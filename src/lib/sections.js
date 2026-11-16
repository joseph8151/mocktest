// Teacher-graded sections can be switched off (관리자 → 채점): 'speaking' = WIDA speaking, 'essay' = every written-response
// section (WIDA writing, SSAT writing sample, ISEE essay, 레테 writing / 서술형). Both are OFF by default so every result is
// instant; an attempt remembers what was skipped when it started (state.skip), so changing the switch never breaks one.
import { EXAMS } from './exam.js';
export const MANUAL_DEFAULT = { speaking: false, essay: false };
let cache = { at: 0, v: null };
export async function manualSettings(env) {
  if (cache.v && Date.now() - cache.at < 30000) return cache.v;
  let v = { ...MANUAL_DEFAULT };
  try { const r = await env.DB.prepare(`SELECT value FROM settings WHERE key='manual_sections'`).first(); if (r?.value) v = { ...v, ...JSON.parse(r.value) }; } catch {}
  cache = { at: Date.now(), v }; return v;
}
export const clearManualCache = () => { cache = { at: 0, v: null }; };
export const groupOf = (sec) => (!sec.manual ? null : sec.key === 'speaking' ? 'speaking' : 'essay');
export function skipKeys(examType, on) {
  return EXAMS[examType].sections.filter((s) => s.manual && !on[groupOf(s)]).map((s) => s.key);
}
