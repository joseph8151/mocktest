import { computeScore } from './scoring.js';
import { shuffle } from './util.js';

/**
 * NOTE: These are original, independently-written practice exams that imitate the
 * *format* of MAP Growth / CAT4 / WIDA ACCESS / SCAT / SSAT / ISEE. They are not affiliated with
 * NWEA, GL Assessment, WIDA, Johns Hopkins CTY, the Enrollment Management Association (SSAT) or
 * ERB (ISEE), and scores are estimates, not official scores.
 */
export const EXAMS = {
  MAP: {
    title: 'MAP Growth 스타일 모의고사', adaptive: true,
    sections: [
      { key: 'reading', name: 'Reading', n: 20, minutes: 25 },
      { key: 'language', name: 'Language Usage', n: 15, minutes: 20 },
      { key: 'math', name: 'Mathematics', n: 20, minutes: 30 },
    ],
  },
  CAT4: {
    title: 'CAT4 스타일 모의고사', adaptive: false,
    sections: [
      { key: 'verbal', name: 'Verbal Reasoning', n: 16, minutes: 12 },
      { key: 'quantitative', name: 'Quantitative Reasoning', n: 16, minutes: 12 },
      { key: 'nonverbal', name: 'Non-Verbal Reasoning', n: 16, minutes: 12 },
      { key: 'spatial', name: 'Spatial Ability', n: 16, minutes: 12 },
    ],
  },
  WIDA: {
    title: 'WIDA ACCESS 스타일 모의고사', adaptive: false,
    sections: [
      { key: 'listening', name: 'Listening', n: 10, minutes: 15 },
      { key: 'reading', name: 'Reading', n: 12, minutes: 25 },
      { key: 'writing', name: 'Writing', n: 2, minutes: 30, manual: true },
      { key: 'speaking', name: 'Speaking', n: 2, minutes: 10, manual: true },
    ],
  },
};

// Scaled-score exams (score = min + pct*(max-min) per section, estimated).
EXAMS.SCAT = {
  title: 'SCAT 스타일 모의고사', adaptive: false, scaled: { min: 200, max: 300, total: 'sum' },
  sections: [
    { key: 'verbal', name: 'Verbal (Analogies)', n: 16, minutes: 20 },
    { key: 'quantitative', name: 'Quantitative (Comparisons)', n: 16, minutes: 20 },
  ],
};
EXAMS.SSAT = {
  title: 'SSAT 스타일 모의고사', adaptive: false, scaled: { min: 440, max: 710, total: 'sum' },
  sections: [
    { key: 'writing', name: 'Writing Sample', n: 1, minutes: 25, manual: true },
    { key: 'quantitative', name: 'Quantitative (Math)', n: 20, minutes: 30 },
    { key: 'reading', name: 'Reading', n: 12, minutes: 25 },
    { key: 'verbal', name: 'Verbal', n: 20, minutes: 20 },
  ],
};
EXAMS.ISEE = {
  title: 'ISEE 스타일 모의고사', adaptive: false, scaled: { min: 760, max: 940, total: 'sum', stanine: true },
  sections: [
    { key: 'verbal', name: 'Verbal Reasoning', n: 16, minutes: 20 },
    { key: 'quantitative', name: 'Quantitative Reasoning', n: 16, minutes: 35 },
    { key: 'reading', name: 'Reading Comprehension', n: 12, minutes: 25 },
    { key: 'math', name: 'Mathematics Achievement', n: 20, minutes: 35 },
    { key: 'essay', name: 'Essay', n: 1, minutes: 30, manual: true },
  ],
};

EXAMS.COGAT = {
  title: 'CogAT 스타일 모의고사', adaptive: false, sas: { mean: 100, sd: 16 },
  sections: [
    { key: 'verbal', name: 'Verbal Battery', n: 16, minutes: 15 },
    { key: 'quantitative', name: 'Quantitative Battery', n: 16, minutes: 15 },
    { key: 'nonverbal', name: 'Nonverbal Battery', n: 16, minutes: 15 },
  ],
};
EXAMS.SAT = {
  title: 'SAT 스타일 모의고사', adaptive: false, scaled: { min: 200, max: 800, total: 'sum' },
  sections: [
    { key: 'rw', name: 'Reading and Writing', n: 27, minutes: 32 },
    { key: 'math', name: 'Math', n: 22, minutes: 35 },
  ],
};
EXAMS.TOEFLJ = {
  title: 'TOEFL Junior 스타일 모의고사', adaptive: false, scaled: { min: 200, max: 300, total: 'sum' },
  sections: [
    { key: 'listening', name: 'Listening Comprehension', n: 20, minutes: 25 },
    { key: 'lfm', name: 'Language Form and Meaning', n: 20, minutes: 15 },
    { key: 'reading', name: 'Reading Comprehension', n: 24, minutes: 30 },
  ],
};

/**
 * Levels / grade bands. The bank is tagged by difficulty (1-5), not by grade, so a level selects a difficulty window
 * (and, where the real test reports on a different scale per level, that scale). Windows widen automatically when a
 * section would otherwise run out of questions.
 */
const L = (key, name, grades, dmin, dmax, extra = {}) => ({ key, name, grades, dmin, dmax, ...extra });
const MAPW = [[1, 2], [1, 2], [1, 3], [1, 3], [2, 3], [2, 4], [2, 4], [3, 4], [3, 5], [3, 5], [4, 5], [4, 5], [4, 5]]; // K, G1..G12
EXAMS.MAP.levels = MAPW.map(([lo, hi], g) => L(g === 0 ? 'k' : `g${g}`, g === 0 ? 'Kindergarten' : `Grade ${g}`, g === 0 ? '유치원(K)' : `${g}학년`, lo, hi));
EXAMS.CAT4.levels = [L('a', 'Level Pre-A / A', '만 6–8세', 1, 3), L('bc', 'Level B / C', '만 9–11세', 1, 4), L('d', 'Level D', '만 12–13세', 2, 5), L('eg', 'Level E–G', '만 14세 이상', 3, 5)];
EXAMS.COGAT.levels = [L('l78', 'Level 7–8', '1–2학년', 1, 3), L('l911', 'Level 9–11', '3–5학년', 1, 4), L('l1214', 'Level 12–14', '6–8학년', 2, 5), L('l1517', 'Level 15–17/18', '9–12학년', 3, 5)];
EXAMS.SCAT.levels = [L('elem', 'Elementary', '2–3학년', 1, 3), L('inter', 'Intermediate', '4–5학년', 2, 4), L('adv', 'Advanced', '6학년 이상', 3, 5)];
EXAMS.SSAT.levels = [L('elem', 'Elementary Level', '3–4학년', 1, 3, { scaled: { min: 300, max: 600, total: 'sum' } }), L('middle', 'Middle Level', '5–7학년', 2, 4, { scaled: { min: 440, max: 710, total: 'sum' } }), L('upper', 'Upper Level', '8–11학년', 3, 5, { scaled: { min: 500, max: 800, total: 'sum' } })];
EXAMS.ISEE.levels = [L('lower', 'Lower Level', '4–5학년 지원', 1, 3), L('middle', 'Middle Level', '6–7학년 지원', 2, 4), L('upper', 'Upper Level', '8–12학년 지원', 3, 5)];
EXAMS.SAT.levels = [L('psat89', 'PSAT 8/9', '8–9학년', 1, 3, { scaled: { min: 120, max: 720, total: 'sum' } }), L('psat10', 'PSAT/NMSQT · PSAT 10', '10–11학년', 2, 4, { scaled: { min: 160, max: 760, total: 'sum' } }), L('sat', 'SAT', '11–12학년', 2, 5, { scaled: { min: 200, max: 800, total: 'sum' } })];
EXAMS.TOEFLJ.levels = [L('p1', 'TOEFL Primary Step 1', '초등 2–4학년 (CEFR Pre-A1–A1)', 1, 2, { scaled: { min: 100, max: 109, total: 'sum' } }), L('p2', 'TOEFL Primary Step 2', '초등 4–6학년 (CEFR A1–A2)', 1, 3, { scaled: { min: 104, max: 115, total: 'sum' } }), L('std', 'TOEFL Junior Standard', '만 11–15세 (CEFR A2–B2)', 2, 5, { scaled: { min: 200, max: 300, total: 'sum' } })];
EXAMS.WIDA.levels = [L('g1', 'Grade 1', '1학년', 1, 2), L('g23', 'Grades 2–3', '2–3학년', 1, 3), L('g45', 'Grades 4–5', '4–5학년', 2, 4), L('g68', 'Grades 6–8', '6–8학년', 2, 5), L('g912', 'Grades 9–12', '9–12학년', 3, 5)];

/** Resolve a level key (falls back to the middle level). */
export function getLevel(examType, key) {
  const lv = EXAMS[examType]?.levels || [];
  return lv.find((l) => l.key === key) || lv[Math.floor((lv.length - 1) / 2)] || { key: 'all', name: 'All', dmin: 1, dmax: 5 };
}
/** Suggest a level from a free-text grade such as "G5", "5학년", "Grade 10", "K". */
export function levelForGrade(examType, grade) {
  const lv = EXAMS[examType]?.levels || [];
  if (!lv.length || !grade) return null;
  const g = /^\s*(k|kg|kinder(garten)?|유치원)\b/i.test(grade) ? 0 : parseInt(String(grade).replace(/[^0-9]/g, ''), 10);
  if (Number.isNaN(g)) return null;
  if (examType === 'MAP') return g === 0 ? 'k' : `g${Math.min(12, Math.max(1, g))}`;
  const ranges = { CAT4: [2, 5, 7, 12], COGAT: [2, 5, 8, 12], SCAT: [3, 5, 12], SSAT: [4, 7, 12], ISEE: [4, 6, 12], SAT: [9, 10, 12], TOEFLJ: [4, 6, 12], WIDA: [1, 3, 5, 8, 12] }[examType] || [];
  const i = ranges.findIndex((max) => g <= max);
  return lv[i === -1 ? lv.length - 1 : i]?.key || null;
}
/** Questions in the level's difficulty window, widened one step at a time until the section can be filled. */
export function levelBank(bank, level, need) {
  let lo = level.dmin, hi = level.dmax, pool = bank.filter((q) => q.difficulty >= lo && q.difficulty <= hi);
  while (pool.length < need && (lo > 1 || hi < 5)) { lo = Math.max(1, lo - 1); hi = Math.min(5, hi + 1); pool = bank.filter((q) => q.difficulty >= lo && q.difficulty <= hi); }
  return { pool, lo, hi };
}

export const GRACE_MS = 5000;

/** Build the initial attempt state. */
export function initialState(examType, now, levelKey) {
  const ex = EXAMS[examType], lv = getLevel(examType, levelKey);
  return { si: 0, qi: 0, deadline: now + ex.sections[0].minutes * 60000, diff: Math.round((lv.dmin + lv.dmax) / 2), served: [], current: null, shown: now, fixed: null, level: lv.key };
}

/** Choose next question id for the current section. `bank` = [{id,difficulty}] active in section. */
export function pickNext(examType, st, bank, target = 10, lo = 1, hi = 5) {
  const ex = EXAMS[examType];
  const sec = ex.sections[st.si];
  const used = new Set(st.served);
  const pool = bank.filter((q) => !used.has(q.id));
  if (!pool.length) return null;
  if (ex.adaptive) {
    const best = Math.min(...pool.map((q) => Math.abs(q.difficulty - st.diff)));
    const cands = pool.filter((q) => Math.abs(q.difficulty - st.diff) === best);
    return cands[Math.floor(Math.random() * cands.length)].id;
  }
  // fixed forms: difficulty ramps from the bottom to the top of the level window across the section
  const want = lo + (st.qi * (hi - lo)) / Math.max(1, target - 1);
  const best = Math.min(...pool.map((q) => Math.abs(q.difficulty - want)));
  const cands = pool.filter((q) => Math.abs(q.difficulty - want) <= best + 0.5);
  return shuffle(cands)[0].id;
}

export function sectionTarget(examType, si, bankSize) {
  return Math.min(EXAMS[examType].sections[si].n, bankSize);
}

export function adaptDifficulty(diff, correct, lo = 1, hi = 5) {
  return Math.max(lo, Math.min(hi, diff + (correct ? 1 : -1)));
}

/* ---------------- scoring ---------------- */
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function scoreAttempt(examType, answers, levelKey) {
  const ex = EXAMS[examType], lv = ex.levels ? getLevel(examType, levelKey) : null;
  return computeScore(examType, ex, lv, answers);
}

export function levelFromPct(p) {
  return p >= 0.9 ? 6 : p >= 0.75 ? 5 : p >= 0.6 ? 4 : p >= 0.4 ? 3 : p >= 0.2 ? 2 : 1;
}
