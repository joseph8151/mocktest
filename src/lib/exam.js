import { shuffle } from './util.js';

/**
 * NOTE: These are original, independently-written practice exams that imitate the
 * *format* of MAP Growth / CAT4 / WIDA ACCESS. They are not affiliated with NWEA,
 * GL Assessment or WIDA, and scores are estimates, not official scores.
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

export const GRACE_MS = 5000;

/** Build the initial attempt state. */
export function initialState(examType, now) {
  const ex = EXAMS[examType];
  return { si: 0, qi: 0, deadline: now + ex.sections[0].minutes * 60000, diff: 3, served: [], current: null, shown: now, fixed: null };
}

/** Choose next question id for the current section. `bank` = [{id,difficulty}] active in section. */
export function pickNext(examType, st, bank, target = 10) {
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
  // fixed forms: difficulty ramps 1→5 across the section; random among the closest matches
  const want = 1 + (st.qi * 4) / Math.max(1, target - 1);
  const best = Math.min(...pool.map((q) => Math.abs(q.difficulty - want)));
  const cands = pool.filter((q) => Math.abs(q.difficulty - want) <= best + 0.5);
  return shuffle(cands)[0].id;
}

export function sectionTarget(examType, si, bankSize) {
  return Math.min(EXAMS[examType].sections[si].n, bankSize);
}

export function adaptDifficulty(diff, correct) {
  return Math.max(1, Math.min(5, diff + (correct ? 1 : -1)));
}

/* ---------------- scoring ---------------- */
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function scoreAttempt(examType, answers) {
  const ex = EXAMS[examType];
  const sections = {};
  for (const sec of ex.sections) {
    const a = answers.filter((x) => x.section === sec.key);
    const auto = a.filter((x) => x.correct !== null && x.correct !== undefined);
    const correct = auto.filter((x) => x.correct === 1).length;
    const total = auto.length;
    const pct = total ? correct / total : 0;
    const s = { name: sec.name, answered: a.length, correct, total, pct: Math.round(pct * 100) };
    if (examType === 'MAP') {
      const d = total ? auto.reduce((m, x) => m + x.difficulty, 0) / total + (pct - 0.5) * 2 : 0;
      s.ability = Math.round(d * 100) / 100;
      s.scaleScore = total ? Math.round(140 + clamp(d, 0, 6) * 18) : null; // RIT-like, estimated
      s.band = d >= 4.2 ? 'Advanced' : d >= 3.2 ? 'Proficient' : d >= 2.2 ? 'Developing' : 'Beginning';
    } else if (examType === 'CAT4') {
      const sas = Math.round(clamp(100 + 15 * ((pct - 0.5) / 0.2), 60, 140));
      s.sas = total ? sas : null;
      s.stanine = total ? clamp(Math.round((sas - 100) / 7.5 + 5), 1, 9) : null;
    } else if (examType === 'WIDA') {
      if (sec.manual) {
        const scores = a.map((x) => x.manual_score).filter((x) => x != null);
        s.graded = scores.length === a.length && a.length > 0;
        s.level = scores.length ? Math.round((scores.reduce((m, x) => m + x, 0) / scores.length) * 10) / 10 : null;
      } else {
        s.level = total ? levelFromPct(pct) : null;
      }
    }
    sections[sec.key] = s;
  }
  const out = { sections };
  if (examType === 'MAP') {
    const v = Object.values(sections).filter((s) => s.scaleScore);
    out.overall = v.length ? Math.round(v.reduce((m, s) => m + s.scaleScore, 0) / v.length) : null;
  } else if (examType === 'CAT4') {
    const v = Object.values(sections).filter((s) => s.sas);
    out.overall = v.length ? Math.round(v.reduce((m, s) => m + s.sas, 0) / v.length) : null;
  } else if (examType === 'WIDA') {
    const L = sections.listening.level, R = sections.reading.level, W = sections.writing.level, S = sections.speaking.level;
    const f = (x) => (x == null ? null : x);
    out.composites = {
      oral: f(L != null && S != null ? (L + S) / 2 : null),
      literacy: f(R != null && W != null ? (R + W) / 2 : null),
      overall: L != null && S != null && R != null && W != null ? 0.15 * L + 0.15 * S + 0.35 * R + 0.35 * W : null,
    };
    for (const k of Object.keys(out.composites)) if (out.composites[k] != null) out.composites[k] = Math.round(out.composites[k] * 10) / 10;
    out.pendingManual = !(sections.writing.graded && sections.speaking.graded);
  }
  return out;
}

export function levelFromPct(p) {
  return p >= 0.9 ? 6 : p >= 0.75 ? 5 : p >= 0.6 ? 4 : p >= 0.4 ? 3 : p >= 0.2 ? 2 : 1;
}
