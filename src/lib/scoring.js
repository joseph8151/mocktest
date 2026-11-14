/**
 * Score reports in the format of each real test (scale, components, percentile/stanine, profile codes).
 * The official conversion tables and norms are proprietary, so every number here is an ESTIMATE on the real scale,
 * computed from this mock test's responses with documented, simple models (Rasch for MAP, normal-curve norms elsewhere).
 */
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const r1 = (x) => Math.round(x * 10) / 10;
const r10 = (x) => Math.round(x / 10) * 10;
// standard normal CDF (Abramowitz-Stegun 7.1.26)
function phi(z) { const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2), y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2); return z >= 0 ? (1 + y) / 2 : (1 - y) / 2; }
const pr = (z) => clamp(Math.round(phi(z) * 100), 1, 99);
const stanine = (p) => [4, 11, 23, 40, 60, 77, 89, 96].filter((c) => p > c).length + 1;
const zOfPct = (pct) => (pct - 0.5) / 0.2; // raw proportion correct -> z (0.5 = average, 0.9 = about +2 SD)

/* ---------------- MAP Growth: Rasch ability on the RIT scale ---------------- */
// Approximate grade means/SDs (K..12) — illustrative norms in the spirit of NWEA's published tables, not the official ones.
const MAP_NORMS = {
  reading: { mean: [152, 167, 181, 192, 201, 208, 213, 216, 219, 220, 221, 223, 224], sd: [12, 14, 15, 15, 15, 15, 15, 15, 16, 16, 17, 17, 17] },
  language: { mean: [150, 166, 180, 191, 200, 206, 210, 214, 217, 218, 219, 220, 221], sd: [12, 14, 14, 14, 14, 14, 14, 15, 15, 15, 16, 16, 16] },
  math: { mean: [151, 168, 182, 194, 205, 214, 219, 224, 229, 231, 233, 235, 237], sd: [12, 13, 13, 13, 14, 15, 16, 17, 18, 18, 19, 19, 19] },
};
const ITEM_RIT = [0, 150, 170, 190, 210, 230]; // difficulty 1..5 -> item RIT
function rasch(items, prior, sdPrior = 18) { // posterior mode with a normal prior (handles all-right / all-wrong)
  let th = prior;
  for (let it = 0; it < 40; it++) {
    let g = -(th - prior) / (sdPrior * sdPrior), h = -1 / (sdPrior * sdPrior);
    for (const x of items) { const p = 1 / (1 + Math.exp(-(th - ITEM_RIT[x.difficulty]) / 10)); g += ((x.correct ? 1 : 0) - p) / 10; h -= (p * (1 - p)) / 100; }
    const step = g / h; th -= step; if (Math.abs(step) < 0.01) break;
  }
  let info = 1 / (sdPrior * sdPrior); for (const x of items) { const p = 1 / (1 + Math.exp(-(th - ITEM_RIT[x.difficulty]) / 10)); info += (p * (1 - p)) / 100; }
  return { rit: clamp(Math.round(th), 100, 350), se: Math.max(2, Math.round(1 / Math.sqrt(info))) };
}
const QUINTILE = (p) => (p <= 20 ? 'Low' : p <= 40 ? 'LoAvg' : p <= 60 ? 'Avg' : p <= 80 ? 'HiAvg' : 'High');

/* ---------------- helpers ---------------- */
function sectionBase(sec, a) {
  const auto = a.filter((x) => x.correct === 0 || x.correct === 1);
  const correct = auto.filter((x) => x.correct === 1).length, total = auto.length;
  const omitted = auto.filter((x) => x.correct === 0 && (x.choice === null || x.choice === undefined) && x.kind === 'mcq').length;
  return { name: sec.name, answered: a.length, correct, total, wrong: total - correct - omitted, omitted, pct: total ? Math.round((correct / total) * 100) : 0 };
}
const cefr = (score, cuts) => (score >= cuts[2] ? 'B2' : score >= cuts[1] ? 'B1' : score >= cuts[0] ? 'A2' : 'Below A2');
const WIDA_LABEL = ['', 'Entering', 'Emerging', 'Developing', 'Expanding', 'Bridging', 'Reaching'];

export function computeScore(examType, ex, lv, answers) {
  const sections = {}, out = { sections, level: lv ? { key: lv.key, name: lv.name, grades: lv.grades } : null, extras: [], notes: [] };
  const grade = lv && /^g(\d+)$/.test(lv.key) ? +lv.key.slice(1) : lv?.key === 'k' ? 0 : null;

  for (const sec of ex.sections) {
    const a = answers.filter((x) => x.section === sec.key);
    const s = sectionBase(sec, a);
    sections[sec.key] = s;
    if (sec.manual) { // writing / speaking / essay: teacher rubric 1-6
      const scores = a.map((x) => x.manual_score).filter((x) => x != null);
      s.graded = a.length === 0 || scores.length === a.length;
      s.level = scores.length ? r1(scores.reduce((m, x) => m + x, 0) / scores.length) : null;
      s.main = s.level ?? (s.graded ? '–' : '채점 대기'); s.sub = examType === 'WIDA' ? (s.level ? WIDA_LABEL[Math.floor(s.level)] : '교사 채점') : '교사 채점 · 점수 미포함';
      s.ring = s.level ? (s.level / 6) * 100 : 0;
      continue;
    }
    if (!s.total) { s.main = '–'; s.sub = '응답 없음'; s.ring = 0; continue; }
    const p = s.correct / s.total, z = zOfPct(p);
    if (examType === 'MAP') {
      const subj = MAP_NORMS[sec.key] || MAP_NORMS.reading, gi = grade ?? 5;
      const { rit, se } = rasch(a.filter((x) => x.correct === 0 || x.correct === 1), subj.mean[gi]);
      const perc = pr((rit - subj.mean[gi]) / subj.sd[gi]);
      Object.assign(s, { rit, ritLow: rit - se, ritHigh: rit + se, percentile: perc, quintile: QUINTILE(perc), scaleScore: rit });
      s.main = rit; s.sub = `RIT 범위 ${rit - se}–${rit + se} · ${grade === null ? '' : (grade === 0 ? 'K' : grade + '학년') + ' '}백분위 ${perc}`; s.chip = QUINTILE(perc); s.ring = perc;
    } else if (examType === 'CAT4' || examType === 'COGAT') {
      const sd = examType === 'COGAT' ? 16 : 15, lo = examType === 'COGAT' ? 50 : 60, hi = examType === 'COGAT' ? 160 : 140;
      const sas = Math.round(clamp(100 + sd * z, lo, hi)), perc = pr((sas - 100) / sd);
      Object.assign(s, { sas, percentile: perc, stanine: stanine(perc) });
      s.main = sas; s.sub = `${examType === 'CAT4' ? 'NPR' : 'PR'} ${perc} · 스태나인 ${s.stanine}`; s.ring = perc;
    } else if (examType === 'WIDA') {
      s.level = r1(clamp(1 + 5 * p, 1, 6)); s.main = s.level.toFixed(1); s.sub = WIDA_LABEL[Math.floor(s.level)]; s.ring = (s.level / 6) * 100;
    } else { // scaled-score tests
      const scale = (lv && lv.scaled) || ex.scaled;
      let frac = p;
      if (examType === 'SSAT' && lv && lv.key !== 'elem') { // formula scoring: +1 right, -1/4 wrong, 0 omitted
        s.raw = r1(s.correct - 0.25 * s.wrong); frac = clamp(s.raw / s.total, 0, 1);
      }
      let scaled = scale.min + frac * (scale.max - scale.min);
      scaled = examType === 'SAT' ? r10(scaled) : Math.round(scaled);
      s.scaled = scaled;
      const zz = zOfPct(frac); s.percentile = pr(zz);
      if (examType === 'ISEE') s.stanine = stanine(s.percentile);
      if (examType === 'TOEFLJ' && (!lv || lv.key === 'std')) s.cefr = cefr(scaled, { listening: [225, 245, 290], lfm: [210, 245, 275], reading: [210, 240, 285] }[sec.key] || [210, 245, 280]);
      s.main = scaled;
      s.sub = examType === 'TOEFLJ' && s.cefr ? `CEFR ${s.cefr}` : examType === 'ISEE' ? `스태나인 ${s.stanine} · 백분위 ${s.percentile}` : examType === 'SSAT' && s.raw !== undefined ? `원점수 ${s.raw} (오답 ${s.wrong} · 무응답 ${s.omitted}) · 백분위 ${s.percentile}` : `백분위 ${s.percentile}`;
      s.ring = ((scaled - scale.min) / (scale.max - scale.min)) * 100;
    }
  }

  const vals = (k) => Object.values(sections).map((x) => x[k]).filter((x) => x !== undefined && x !== null && x !== '–');
  if (examType === 'MAP') {
    out.overall = null; out.headline = { label: 'RIT (영역별)', value: vals('rit').join(' · ') || '–' };
    out.notes.push('MAP은 영역별 RIT만 보고하며 합산 점수가 없습니다. 백분위는 선택한 학년의 근사 규준 기준입니다.');
  } else if (examType === 'CAT4') {
    const sas = vals('sas'); out.overall = sas.length ? Math.round(sas.reduce((m, x) => m + x, 0) / sas.length) : null;
    out.headline = { label: 'Mean SAS', value: out.overall ?? '–' };
    const v = sections.verbal?.sas, sp = sections.spatial?.sas;
    if (v && sp) { const d = v - sp, m = Math.abs(d); out.profile = m < 10 ? 'No bias (균형형)' : `${m < 15 ? 'Mild' : m < 25 ? 'Moderate' : 'Extreme'} ${d > 0 ? 'verbal' : 'spatial'} bias`; out.extras.push({ label: '학습 프로필 (언어 vs 공간)', value: out.profile }); }
  } else if (examType === 'COGAT') {
    const V = sections.verbal?.sas, Q = sections.quantitative?.sas, N = sections.nonverbal?.sas;
    if (V && Q && N) {
      const comp = Math.round((V + Q + N) / 3); out.overall = comp; out.headline = { label: 'Composite (VQN) SAS', value: comp };
      out.extras.push({ label: 'VQ / VN / QN', value: `${Math.round((V + Q) / 2)} / ${Math.round((V + N) / 2)} / ${Math.round((Q + N) / 2)}` });
      const st = [sections.verbal.stanine, sections.quantitative.stanine, sections.nonverbal.stanine].sort((a, b) => a - b)[1];
      const b = { V, Q, N }, keys = ['V', 'Q', 'N'], mx = Math.max(V, Q, N), mn = Math.min(V, Q, N);
      const rel = keys.map((k) => { const others = keys.filter((x) => x !== k).map((x) => b[x]); const d = b[k] - (others[0] + others[1]) / 2; return d >= 10 ? `${k}+` : d <= -10 ? `${k}-` : null; }).filter(Boolean);
      const letter = mx - mn >= 24 ? 'E' : rel.length === 0 ? 'A' : rel.some((x) => x.endsWith('+')) && rel.some((x) => x.endsWith('-')) ? 'C' : 'B';
      out.profile = `${st}${letter}${rel.length ? ` (${rel.join(' ')})` : ''}`;
      out.extras.push({ label: 'Ability Profile', value: out.profile });
      out.notes.push('Ability Profile: 숫자 = 세 배터리의 중앙 스태나인, A = 고른 분포, B = 한 영역이 두드러짐, C = 강점과 약점이 공존, E = 24점 이상의 극단적 차이.');
    } else { out.overall = null; out.headline = { label: 'Composite SAS', value: '–' }; }
  } else if (examType === 'WIDA') {
    const L = sections.listening?.level, R = sections.reading?.level, W = sections.writing?.level, S = sections.speaking?.level;
    const f = (x) => (x === null || x === undefined ? null : r1(x));
    out.composites = {
      oral: f(L != null && S != null ? 0.5 * L + 0.5 * S : null), literacy: f(R != null && W != null ? 0.5 * R + 0.5 * W : null),
      comprehension: f(L != null && R != null ? 0.3 * L + 0.7 * R : null), overall: f(L != null && S != null && R != null && W != null ? 0.15 * L + 0.15 * S + 0.35 * R + 0.35 * W : null),
    };
    out.headline = { label: 'Overall (Composite) Level', value: out.composites.overall ?? '–' };
    out.extras.push({ label: 'Oral (L·S 50:50)', value: out.composites.oral ?? '–' }, { label: 'Literacy (R·W 50:50)', value: out.composites.literacy ?? '–' }, { label: 'Comprehension (L 30 · R 70)', value: out.composites.comprehension ?? '–' });
    out.pendingManual = !(sections.writing?.graded && sections.speaking?.graded);
  } else {
    const scored = Object.entries(sections).filter(([k]) => !ex.sections.find((x) => x.key === k)?.manual).map(([, x]) => x.scaled).filter((x) => x != null);
    out.overall = scored.length ? scored.reduce((m, x) => m + x, 0) : null;
    const scale = (lv && lv.scaled) || ex.scaled, n = ex.sections.filter((x) => !x.manual).length;
    out.headline = { label: `Total (${scale.min * n}–${scale.max * n})`, value: out.overall ?? '–' };
    if (examType === 'SAT') {
      const total = out.overall, mean = { psat89: 830, psat10: 920, sat: 1030 }[lv?.key] ?? 1030, sd = { psat89: 160, psat10: 180, sat: 200 }[lv?.key] ?? 200;
      if (total) out.extras.push({ label: '추정 백분위 (전체 응시자)', value: pr((total - mean) / sd) });
      if (lv?.key === 'psat10' && sections.rw?.scaled && sections.math?.scaled) out.extras.push({ label: 'NMSQT Selection Index', value: Math.round((2 * sections.rw.scaled + sections.math.scaled) / 10) });
    }
    if (examType === 'SSAT' && lv && lv.key !== 'elem') out.notes.push('SSAT Middle/Upper는 정답 +1, 오답 −¼, 무응답 0점으로 원점수를 계산합니다. 모르는 문제는 건너뛰는 것도 전략입니다.');
    if (examType === 'TOEFLJ' && lv?.key === 'std') out.notes.push('CEFR 수준은 영역별 점수의 근사 기준(A2/B1/B2)으로 표시합니다.');
    const manual = ex.sections.filter((x) => x.manual).map((x) => sections[x.key]);
    out.pendingManual = manual.some((x) => !x.graded);
  }
  out.notes.push('모든 점수는 실제 시험과 같은 척도로 환산한 추정치이며, 공식 환산표·규준과 다를 수 있습니다.');
  return out;
}
