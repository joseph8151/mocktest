/* MockTest Lab SPA — no framework, no innerHTML with user data (everything goes through h()/text). */
const $app = document.getElementById('app');
const $nav = document.getElementById('nav');
let me = null;
let timerInt = null;

/* ---------- helpers ---------- */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'hidden') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const api = async (method, path, body) => {
  const r = await fetch('/api' + path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || `오류 (${r.status})`); e.status = r.status; e.data = j; if (j.lockedElsewhere && location.hash.startsWith('#/exam/')) setTimeout(route, 30); throw e; }
  return j;
};
const toast = (m) => { const t = document.getElementById('toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3000); };
const money = (n, cur) => (cur === 'USD' ? `$${(n / 100).toFixed(2)}` : `${n.toLocaleString()}원`);
const date = (ms) => (ms ? new Date(ms).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const svgUri = (s) => 'data:image/svg+xml;utf8,' + encodeURIComponent(s);
const choiceNode = (c) => (c.startsWith('svg:') ? h('img', { src: svgUri(c.slice(4)), alt: 'option' }) : h('span', {}, c));
const mount = (...n) => { clearInterval(timerInt); if (window._kh) { document.removeEventListener('keydown', window._kh); window._kh = null; } speechSynthesis?.cancel?.(); $app.replaceChildren(...n.flat(Infinity).filter((x) => x != null && x !== false)); window.scrollTo(0, 0); };
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };
const examName = { MAP: 'MAP', CAT4: 'CAT4', WIDA: 'WIDA' };
const field = (label, input) => h('div', {}, h('label', {}, label), input);
/* Cloudflare Turnstile (only when the server has it configured): renders into the form, adds a cf-turnstile-response field. */
function botCheck() {
  if (!cfg.turnstile) return null;
  const box = h('div', { class: 'turnstile' });
  const draw = () => window.turnstile.render(box, { sitekey: cfg.turnstile });
  if (window.turnstile) setTimeout(draw); else if (!document.getElementById('ts-js')) {
    const sc = h('script', { id: 'ts-js', src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', async: true }); sc.onload = draw; document.head.append(sc);
  } else document.getElementById('ts-js').addEventListener('load', draw);
  return box;
}
const ACTION_KO = {
  'user.register': '회원가입', 'login.success': '로그인', 'admin.login': '관리자 로그인', 'login.fail': '로그인 실패', 'login.2fa_failed': '2단계 인증 실패', logout: '로그아웃',
  'password.change': '비밀번호 변경', 'password.reset_request': '비밀번호 찾기 요청', 'password.reset': '비밀번호 재설정', 'profile.update': '회원정보 수정',
  'account.delete': '탈퇴·삭제(익명화)', '2fa.enable': '2단계 인증 켬', '2fa.disable': '2단계 인증 끔', 'session.revoke': '기기 로그아웃', 'admin.bootstrap': '첫 관리자 생성',
  'exam.start': '시험 시작', 'exam.section_submit': '영역 제출', 'exam.finish': '시험 종료', 'exam.audio_upload': '녹음 제출', 'share.create': '리포트 공유', 'share.revoke': '공유 중지', 'shared.view': '공유 리포트 열람',
  'order.create': '결제 시작', 'order.paid': '결제 완료', 'order.failed': '결제 실패·취소', 'order.refunded': '환불 완료', 'refund.request': '환불 요청',
  'admin.post': '관리자 작업', 'admin.patch': '관리자 수정', 'admin.put': '관리자 수정', 'admin.delete': '관리자 삭제', 'admin.get': '데이터 내보내기',
};
const actionTone = (a) => (/fail|delete|disable|revoke|refund/.test(a) ? 'bad' : /^order\.paid|success|register|enable|finish/.test(a) ? 'ok' : /^admin/.test(a) ? 'warn' : '');
const fmtDetail = (d) => {
  if (!d) return '';
  let o; try { o = JSON.parse(d); } catch { return d; }
  if (!o || typeof o !== 'object') return String(o);
  const flat = (v) => (v && typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${k}=${typeof x === 'object' && x ? JSON.stringify(x) : x}`).join(', ') : String(v));
  return Object.entries(o).filter(([, v]) => v !== null && v !== '' && v !== undefined).map(([k, v]) => `${k}: ${flat(v)}`).join(' · ');
};
const logRows = (events, { who = true } = {}) => h('table', { class: 'logtable' }, h('tr', {}, ['시각', '활동', who ? '사용자' : null, '대상', 'IP', '내용'].filter(Boolean).map((x) => h('th', {}, x))),
  events.map((l) => h('tr', {}, h('td', { class: 'small nowrap' }, date(l.at)), h('td', {}, h('span', { class: 'badge ' + actionTone(l.action) }, ACTION_KO[l.action] || l.action)),
    who ? h('td', { class: 'small' }, l.actor_email || '-') : null, h('td', { class: 'mono small' }, l.target || ''), h('td', { class: 'mono small' }, l.ip || ''), h('td', { class: 'small muted' }, fmtDetail(l.detail)))));
const resetBotCheck = () => { try { window.turnstile?.reset(); } catch {} };
const copyText = async (t) => { try { await navigator.clipboard.writeText(t); toast('복사되었습니다.'); } catch { prompt('아래 주소를 복사하세요', t); } };
const uaName = (ua = '') => `${/iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '기기'} · ${/Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : '브라우저'}`;

function renderNav() {
  $nav.classList.remove('open');
  $nav.replaceChildren(...[
    h('button', { class: 'menu-toggle', 'aria-label': '메뉴', onclick: (e) => { e.stopPropagation(); $nav.classList.toggle('open'); } }, h('span'), h('span'), h('span')),
    h('a', { href: '#/' }, '시험 상품'),
    ...(me ? [
      h('a', { class: 'keep', href: '#/me' }, me.isChild ? `내 시험 (${me.name})` : '내 시험'),
      h('a', { href: '#/practice' }, '연습'),
      h('a', { href: '#/mistakes' }, '오답노트'),
      me.role === 'teacher' ? h('a', { href: '#/classes' }, '내 반') : null,
      me.isChild ? null : h('a', { href: '#/support' }, '문의'),
      me.role === 'admin' ? h('a', { href: '#/admin' }, '관리자') : null,
      h('button', { onclick: guard(async () => { await api('POST', '/auth/logout'); me = null; renderNav(); location.hash = '#/'; }) }, `로그아웃 (${me.name})`),
    ] : [h('a', { class: 'keep', href: '#/login' }, '로그인'), h('a', { class: 'cta', href: '#/register' }, '시작하기')]),
  ].filter(Boolean));
}

/* ---------- pages ---------- */
const EXAM_META = {
  MAP: { name: 'MAP Growth', ico: 'M', accent: 'var(--map)', soft: 'var(--map-soft)', sub: '적응형 · Reading / Language Usage / Math',
    points: ['정답이면 어려워지고 오답이면 쉬워지는 적응형 출제', '영역별 RIT 유사 추정 점수와 성취 수준', '응시를 거듭할수록 보이는 성장 추이'] },
  CAT4: { name: 'CAT4', ico: 'C', accent: 'var(--cat4)', soft: 'var(--cat4-soft)', sub: '추론력 · Verbal / Quant / Non-verbal / Spatial',
    points: ['4개 영역 추론 능력 진단 (그림 문항 포함)', '표준연령점수(SAS)와 스태나인 추정', '영역별 강점·약점 한눈에 보는 리포트'] },
  WIDA: { name: 'WIDA ACCESS', ico: 'W', accent: 'var(--wida)', soft: 'var(--wida-soft)', sub: '영어 숙달도 · Listening / Reading / Writing / Speaking',
    points: ['듣기·읽기 자동 채점, 쓰기·말하기는 교사 채점', '1–6 Proficiency Level 과 영역별 가중 종합 레벨', '브라우저 녹음으로 실제 말하기 응시'] },
};
Object.assign(EXAM_META, {
  SCAT: { name: 'SCAT', ico: 'S', accent: 'var(--scat)', soft: 'var(--scat-soft)', sub: '영재 선발 · Verbal / Quantitative',
    points: ['유추(Analogy)와 수량 비교(Quantitative Comparison) 문항', '그래프·도형 문제는 SVG 그림으로 제공', '영역별 척도 점수 추정과 종합 점수'] },
  SSAT: { name: 'SSAT', ico: 'S', accent: 'var(--ssat)', soft: 'var(--ssat-soft)', sub: '사립학교 입시 · Writing / Quant / Reading / Verbal',
    points: ['동의어·유추 어휘, 독해, 수학(그래프·도형 포함)', '라이팅 샘플은 교사 채점(1–6점)', 'Middle·Upper는 오답 −¼ 공식 채점, 레벨별 척도 점수'] },
  ISEE: { name: 'ISEE', ico: 'I', accent: 'var(--isee)', soft: 'var(--isee-soft)', sub: '사립학교 입시 · Verbal / Quant / Reading / Math / Essay',
    points: ['Sentence Completion · Synonym 어휘 문항', 'Quantitative Reasoning · Mathematics Achievement', '영역별 척도 점수(760–940)·백분위·스태나인'] },
});
Object.assign(EXAM_META, {
  COGAT: { name: 'CogAT', ico: 'C', accent: 'var(--cogat)', sub: '인지능력 · Verbal / Quantitative / Nonverbal',
    points: ['미국 영재·사립학교 선발에 쓰이는 3개 배터리(언어·수리·비언어)', '유추·분류·문장완성, 수 계열·수 유추, 도형 매트릭스·종이접기', '표준연령점수(SAS, 평균 100)와 스태나인 추정'] },
  SAT: { name: 'SAT', ico: 'S', accent: 'var(--sat)', sub: '대학입시 · Reading & Writing / Math',
    points: ['디지털 SAT 형식의 Reading & Writing 27문항, Math 22문항', '그래프·표·도형은 SVG 그림으로 제공', '영역별 200–800 척도 점수와 합산 점수(400–1600) 추정'] },
  TOEFLJ: { name: 'TOEFL Junior', ico: 'T', accent: 'var(--toeflj)', sub: '영어 숙달도 · Listening / Language Form & Meaning / Reading',
    points: ['듣기는 음성으로 재생(최대 2회), 문법·어휘, 독해 3개 영역', '영역별 200–300 척도 점수와 합산 점수(600–900) 추정', 'CEFR A2–B2 수준 문항'] },
});
const FAQ = [
  ['결제하면 바로 시험을 볼 수 있나요?', '네. 결제가 확인되면 이용권이 자동으로 지급되어 곧바로 “내 시험”에서 시작할 수 있습니다.'],
  ['시험 도중 나가면 어떻게 되나요?', '진행 상황이 저장되어 같은 계정으로 다시 접속하면 이어서 풀 수 있습니다. 단, 영역별 제한 시간은 계속 흘러갑니다.'],
  ['실제 시험 점수와 같은가요?', '아니요. 형식을 참고해 만든 연습용 문제이며 점수는 학습 참고용 추정치입니다. NWEA · GL Assessment · WIDA와 무관합니다.'],
  ['WIDA 쓰기·말하기 결과는 언제 나오나요?', '교사가 채점을 마치면 이메일로 알려드리고, 리포트에 종합 레벨이 표시됩니다.'],
  ['환불이 가능한가요?', '결제 후 7일 이내 미사용 이용권은 전액 환불됩니다. “내 시험 > 결제 내역”에서 환불을 요청하세요.'],
];
async function pageHome() {
  const { products, payment } = await api('GET', '/products');
  const toExams = () => document.getElementById('exams')?.scrollIntoView({ behavior: 'smooth' });
  const head = (n, k, t, d) => h('div', { class: 'section-title' }, h('div', {}, h('div', { class: 'kicker' }, `${n} — ${k}`), h('h2', {}, t), d ? h('p', {}, d) : null));
  mount(
    h('section', { class: 'hero' },
      h('div', {},
        h('span', { class: 'eyebrow' }, '★ U.S. admissions test prep'),
        h('h1', {}, 'Practice like', h('br'), 'it\'s ', h('span', { class: 'hl' }, 'test day'), '.', h('em', {}, 'MAP / CAT4 / CogAT / SCAT / SSAT / ISEE / SAT / TOEFL Junior / WIDA')),
        h('p', { class: 'lead' }, '실제 시험과 같은 형식, 같은 시간 압박. 결제하면 곧바로 응시할 수 있고, 끝나는 즉시 영역별 점수와 문항별 해설이 나옵니다.'),
        h('div', { class: 'row' }, h('button', { class: 'btn lg', onclick: toExams }, 'Browse tests →'), me ? h('a', { class: 'btn lg alt', href: '#/me' }, '내 시험') : h('a', { class: 'btn lg alt', href: '#/register' }, '회원가입')),
        h('div', { class: 'chips' }, [['1,950+', 'original questions'], ['9', 'test types'], ['0s', 'wait for your score']].map(([b, t]) => h('div', {}, h('b', {}, b), t)))),
      h('div', { class: 'mock', 'aria-hidden': 'true' },
        h('div', { class: 'mrow' }, h('b', { style: 'font-weight:500' }, 'Verbal / 03'), h('span', {}, '08:42')),
        h('div', { class: 'mq' }, 'Author is to book as composer is to ___'),
        [['A', 'song', true], ['B', 'piano'], ['C', 'concert'], ['D', 'singer']].map(([l, t, sel]) => h('div', { class: 'mc' + (sel ? ' sel' : '') }, h('b', {}, l), t)),
        h('div', { class: 'mbar' }, h('i'))),
    ),
    h('div', { class: 'marquee', 'aria-hidden': 'true' }, h('div', {}, [0, 1].map(() => ['MAP Growth', 'CAT4', 'CogAT', 'SCAT', 'SSAT', 'ISEE', 'SAT · PSAT', 'TOEFL Primary · Junior', 'WIDA ACCESS'].map((x) => h('span', {}, x, h('i', {}, '★')))))),
    h('div', { id: 'exams' }), head('01', 'Exams', 'Choose your test', '원하는 시험과 횟수권을 고르세요. 결제가 확인되면 이용권이 즉시 지급됩니다.'),
    h('div', { class: 'index' }, Object.entries(EXAM_META).map(([type, m], i) => h('div', { class: 'exam-card', style: `--accent:${m.accent}` },
      h('div', { class: 'idx' }, h('span', {}, h('b', {}), `0${i + 1}`), h('span', {}, type)),
      h('h3', {}, m.name), h('div', { class: 'sub' }, m.sub),
      h('div', { class: 'row small', style: 'margin:-6px 0 16px;gap:14px' }, h('a', { href: `#/info/${type}` }, '시험 안내'), h('a', { href: `#/sample/${type}` }, '무료 샘플 5문항')),
      h('div', { class: 'tags' }, ({ MAP: ['K–G12', '학년별 13단계'], CAT4: ['Level A', 'B/C', 'D', 'E–G'], COGAT: ['L7–8', 'L9–11', 'L12–14', 'L15–18'], SCAT: ['Elementary', 'Intermediate', 'Advanced'], SSAT: ['Elementary', 'Middle', 'Upper'], ISEE: ['Lower', 'Middle', 'Upper'], SAT: ['PSAT 8/9', 'PSAT 10', 'SAT'], TOEFLJ: ['Primary 1', 'Primary 2', 'Junior'], WIDA: ['G1', 'G2–3', 'G4–5', 'G6–8', 'G9–12'] }[type] || []).map((x) => h('span', {}, x))),
      h('ul', {}, m.points.map((x) => h('li', {}, x))),
      h('div', { class: 'push' }, products.filter((p) => p.exam_type === type).map((p) => h('div', { class: 'plan' },
        h('div', {}, h('div', { class: 'pt' }, p.id === 'p-test' ? '관리자 결제 테스트' : `${p.attempts}회권`, (() => { const one = products.find((x) => x.exam_type === type && x.attempts === 1); const off = one && p.attempts > 1 ? Math.round((1 - p.price_krw / (one.price_krw * p.attempts)) * 100) : 0; return off > 0 ? h('em', { class: 'save' }, `−${off}%`) : null; })()), h('div', { class: 'pd' }, `${p.valid_days}D · ${money(p.price_usd_cents, 'USD')}`)),
        h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:14px' }, h('div', { class: 'price' }, money(p.price_krw, 'KRW')), h('button', { class: 'btn sm', onclick: () => buy(p, payment) }, '구매'))))),
    ))),
    head('02', 'Process', 'How it works', '가입부터 리포트까지, 군더더기 없이.'),
    h('div', { class: 'steps' }, [['회원가입', '이메일로 가입하고 학년을 입력합니다.'], ['결제', '국내 카드·간편결제 또는 해외 카드. 결제 즉시 이용권 지급.'], ['응시', '영역별 타이머와 함께 실전처럼 응시합니다.'], ['리포트', '점수·해설·성장 추이를 확인하고 PDF로 저장합니다.']].map(([t, d]) => h('div', { class: 'step' }, h('h3', {}, t), h('p', {}, d)))),
    head('03', 'Features', 'What you get'),
    h('div', { class: 'features' }, [['실전형 출제', '서버가 한 문항씩 출제하고 정답은 노출되지 않습니다. 새로고침해도 이어서 풀 수 있습니다.'], ['성장 추이', '같은 시험을 반복 응시하면 점수 변화를 그래프로 보여줍니다.'], ['해설 리포트', '문항별 정답·내 답·해설과 영역별 강약점을 제공합니다.'], ['듣기 · 말하기', '듣기는 음성으로 재생하고, 말하기는 브라우저에서 바로 녹음합니다.'], ['안전한 결제', 'Stripe · 포트원. 서버에서 금액을 검증하고 웹훅으로 자동 지급합니다.'], ['PDF 저장', '리포트를 인쇄하거나 PDF로 저장해 상담에 활용하세요.']].map(([t, d], i) => h('div', { class: 'feature' }, h('div', { class: 'fi' }, `0${i + 1}`), h('div', {}, h('b', {}, t), h('span', {}, d))))),
    head('04', 'FAQ', 'Questions, answered'),
    FAQ.map(([q, a]) => h('details', { class: 'faq' }, h('summary', {}, q), h('p', {}, a))),
    h('div', { class: 'cta-band' }, h('div', {}, h('h2', {}, 'Ready for test day?'), h('p', {}, '결제 후 바로 시작 · 결과는 즉시 확인')), h('button', { class: 'btn lg', onclick: toExams }, 'Choose your test →')),
  );
}

const PAY_METHODS = [['CARD', '신용·체크카드'], ['VIRTUAL_ACCOUNT', '가상계좌'], ['TRANSFER', '실시간 계좌이체'], ['MOBILE', '휴대폰 결제']];
let paying = false;
const once = (fn) => async (...a) => { if (paying) return; paying = true; try { await fn(...a); } finally { paying = false; } };
function buy(p, payment) {
  if (!me) { toast('먼저 로그인해 주세요.'); location.hash = '#/login'; return; }
  const close = () => modal.remove();
  let method = 'CARD';
  // Customers get one KRW option (KCP direct if configured, else PortOne); admins see every configured provider to try them.
  const krw = [payment.kcp && ['kcp', 'KCP 직접결제'], payment.portone && ['portone', '포트원 결제 (KCP 등)']].filter(Boolean);
  const shown = me.role === 'admin' ? krw : krw.slice(0, 1);
  const methodBtns = PAY_METHODS.map(([k, l]) => h('button', { type: 'button', class: 'btn alt sm' + (k === method ? ' on' : ''), onclick: (e) => { method = k; methodBtns.forEach((b) => b.classList.toggle('sel', b === e.currentTarget)); } }, l));
  methodBtns[0].classList.add('sel');
  // Coupon: checked server-side, the discounted price is shown on the pay buttons and re-validated when the order is created.
  let coupon = null, gift = false;
  const priceKs = [], priceU = h('span', {}, money(p.price_usd_cents, 'USD'));
  const newPriceK = () => { const x = h('span', {}, money(p.price_krw, 'KRW')); priceKs.push(x); return x; };
  const showPrice = (r) => { // r = coupon check result, or null for list price
    priceKs.forEach((x) => x.replaceChildren(...(r ? [h('s', { class: 'muted' }, money(p.price_krw, 'KRW')), ' ', money(r.krw, 'KRW')] : [money(p.price_krw, 'KRW')])));
    priceU.textContent = money(r ? r.usd : p.price_usd_cents, 'USD');
  };
  const cpIn = h('input', { placeholder: '쿠폰 코드', class: 'grow', autocomplete: 'off', style: 'text-transform:uppercase' });
  const cpMsg = h('div', { class: 'small' });
  const cpBox = p.id === 'p-test' ? null : h('div', { class: 'coupon' }, h('label', {}, '쿠폰'), h('div', { class: 'row', style: 'flex-wrap:nowrap' }, cpIn,
    h('button', { type: 'button', class: 'btn sm alt', onclick: guard(async () => {
      cpMsg.className = 'small'; cpMsg.textContent = ''; coupon = null; showPrice(null);
      if (!cpIn.value.trim()) return;
      try { const r = await api('POST', '/coupons/check', { code: cpIn.value, productId: p.id }); coupon = r.coupon; showPrice(r); cpMsg.className = 'small ok-text'; cpMsg.textContent = `✓ ${r.label} 적용`; }
      catch (e) { cpMsg.className = 'small err'; cpMsg.textContent = e.message; }
    }) }, '적용')), cpMsg);
  const modal = h('div', { class: 'modal', onclick: (e) => e.target === modal && close() }, h('div', { class: 'card' },
    h('div', { class: 'kicker' }, 'Checkout'), h('h3', {}, p.title), h('p', { class: 'muted small' }, `${p.attempts}회 응시 · ${p.valid_days}일 이내 사용`),
    shown.length ? h('div', {}, h('label', {}, '결제 수단'), h('div', { class: 'row paymethods' }, methodBtns)) : null,
    shown.length || payment.stripe ? cpBox : null,
    (shown.length || payment.stripe) && p.id !== 'p-test' ? h('label', { class: 'giftchk' }, h('input', { type: 'checkbox', style: 'width:auto', onchange: (e) => (gift = e.target.checked) }), ' 선물하기 — 이용권 대신 ', h('b', {}, '선물 코드'), '를 이메일로 받습니다') : null,
    h('div', { class: 'row', style: 'margin-top:18px' },
      shown.map(([k, l], i) => h('button', { class: 'btn', onclick: guard(once(() => (k === 'kcp' ? payKcp(p, method, coupon, gift) : payPortone(p, close, method, coupon, gift)))) }, me.role === 'admin' ? l + ' · ' : '', newPriceK())),
      payment.stripe ? h('button', { class: 'btn alt', onclick: guard(once(() => payStripe(p, coupon, gift))) }, 'International card · ', priceU) : null,
    ),
    !shown.length && !payment.stripe ? (me.role === 'admin'
      ? h('div', { class: 'notice' }, h('b', {}, '결제 수단이 아직 연결되지 않았습니다.'), h('p', { class: 'small' }, 'PG사(포트원·KCP·Stripe)에서 받은 키를 Cloudflare 대시보드 → Workers → mocktest → Settings → Variables and Secrets에 넣으면 이 창에 결제 버튼이 나타납니다.'), h('a', { class: 'btn sm', href: '#/admin/payments', onclick: close }, '결제설정 보기 →'))
      : h('p', { class: 'err' }, '지금은 결제를 받을 수 없습니다. 잠시 후 다시 시도하거나 고객센터로 문의해 주세요.')) : null,
    h('p', { style: 'margin-top:16px' }, h('button', { class: 'btn alt sm', onclick: close }, '닫기')),
  ));
  document.body.append(modal);
}
async function payStripe(p, coupon, gift) { const { url } = await api('POST', '/pay/stripe/checkout', { productId: p.id, coupon, gift }); location.href = url; }
async function payKcp(p, method, coupon, gift) {
  if (method === 'VIRTUAL_ACCOUNT') throw new Error('KCP 직접결제는 가상계좌를 지원하지 않습니다. 다른 결제 수단을 선택해 주세요.');
  const { form } = await api('POST', '/pay/kcp/register', { productId: p.id, payMethod: method, coupon, gift });
  const f = h('form', { method: form.method, action: form.action, style: 'display:none' }, Object.entries(form.fields).map(([k, v]) => h('input', { type: 'hidden', name: k, value: v })));
  document.body.append(f); f.submit();
}
async function payPortone(p, close, method = 'CARD', coupon, gift) {
  const o = await api('POST', '/pay/portone/prepare', { productId: p.id, coupon, gift });
  if (!window.PortOne) await new Promise((res, rej) => { const s = h('script', { src: 'https://cdn.portone.io/v2/browser-sdk.js' }); s.onload = res; s.onerror = () => rej(new Error('결제 모듈을 불러오지 못했습니다.')); document.head.append(s); });
  const req = {
    storeId: o.storeId, channelKey: o.channelKey, paymentId: o.paymentId, orderName: o.orderName, totalAmount: o.totalAmount,
    currency: 'CURRENCY_KRW', payMethod: method, customer: o.customer, redirectUrl: `${location.origin}/?portone_order=${o.orderId}`,
  };
  if (method === 'VIRTUAL_ACCOUNT') req.virtualAccount = { accountExpiry: { validHours: 72 } };
  if (method === 'MOBILE') req.productType = 'PRODUCT_TYPE_DIGITAL';
  const resp = await window.PortOne.requestPayment(req);
  if (resp?.code) { toast(resp.message || '결제가 취소되었습니다.'); return; }
  close();
  location.hash = `#/pay/success?order=${o.orderId}&provider=portone`;
}

async function pagePaySuccess(q) {
  mount(h('div', { class: 'card intro' }, h('div', { class: 'big' }, 'Payment'), h('h2', {}, '결제 확인 중'), h('p', { class: 'muted' }, '잠시만 기다려 주세요.')));
  const done = () => mount(h('div', { class: 'card intro' }, h('div', { class: 'big' }, 'Payment complete'), h('h2', {}, '결제가 완료되었습니다.'), h('p', {}, '이용권이 지급되었습니다. 지금 바로 시험을 시작할 수 있습니다.'), h('a', { class: 'btn', href: '#/me' }, '내 시험으로 가기 →')));
  for (let i = 0; i < 8; i++) {
    try {
      if (q.provider === 'kcp') { if ((await api('GET', `/orders/${q.order}/status`)).status === 'paid') return done(); }
      else {
        const r = await api('POST', q.provider === 'portone' ? '/pay/portone/complete' : '/pay/stripe/confirm', { orderId: q.order });
        if (r.ok || r.status === 'paid') return done();
        if (r.pending) { // virtual account issued, waiting for the deposit
          const a = r.account || {};
          return mount(h('div', { class: 'card intro' }, h('div', { class: 'big' }, 'Awaiting deposit'), h('h2', {}, '입금 대기 중입니다.'),
            h('p', {}, '입금이 확인되면 이용권이 자동으로 지급됩니다. 입금 후 “내 시험”에서 확인하세요.'),
            a.number ? h('table', {}, [['은행', a.bank], ['계좌번호', a.number], ['예금주', a.holder], ['입금액', a.amount ? money(a.amount, 'KRW') : null], ['입금기한', a.expiresAt ? date(Date.parse(a.expiresAt)) : null]].filter((x) => x[1]).map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, v)))) : null,
            h('p', {}, h('a', { class: 'btn', href: '#/me' }, '내 시험 →'))));
        }
      }
    } catch (e) { if (q.provider === 'portone') return mount(h('div', { class: 'card intro' }, h('h2', { class: 'err' }, '결제 확인 실패'), h('p', {}, e.message), h('a', { class: 'btn alt', href: '#/' }, '돌아가기'))); }
    await new Promise((r) => setTimeout(r, 1500));
  }
  mount(h('div', { class: 'card intro' }, h('h2', {}, '결제 처리 중'), h('p', {}, '결제 승인이 지연되고 있습니다. 잠시 후 “내 시험”에서 확인해 주세요.'), h('a', { class: 'btn', href: '#/me' }, '내 시험')));
}

function authForm(kind, q = {}) {
  const reg = kind === 'register';
  const err = h('div', { class: 'err' }, q.msg || '');
  const codeBox = h('div', { hidden: true }, field('2단계 인증 코드 (인증 앱의 6자리)', h('input', { name: 'code', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, pattern: '[0-9]{6}' })));
  const f = h('form', { onsubmit: async (e) => {
    e.preventDefault(); err.textContent = '';
    const d = Object.fromEntries(new FormData(f));
    if (codeBox.hidden) delete d.code;
    try {
      await api('POST', reg ? '/auth/register' : '/auth/login', { ...d, agree: !!d.agree });
      me = (await api('GET', '/auth/me')).user; renderNav(); location.hash = me.role === 'admin' && !me.twofa ? '#/me?secure=1' : '#/me';
    } catch (ex) {
      if (ex.data?.need2fa && codeBox.hidden) { codeBox.hidden = false; f.code.focus(); err.textContent = ''; return; }
      err.textContent = ex.message; resetBotCheck();
    }
  } },
    h('h2', {}, reg ? '회원가입' : '로그인'),
    reg ? field('이름(학생/학부모)', h('input', { name: 'name', required: true, maxlength: 60 })) : null,
    field('이메일', h('input', { name: 'email', type: 'email', required: true, autocomplete: 'email' })),
    field('비밀번호' + (reg ? ' (8자 이상, 영문+숫자 섞어서)' : ''), h('input', { name: 'password', type: 'password', required: true, minlength: reg ? 8 : 1, autocomplete: reg ? 'new-password' : 'current-password' })),
    reg ? field('학년 (선택)', h('input', { name: 'grade', placeholder: '예: G5' })) : null,
    reg ? (() => {
      const g = h('div', { hidden: true }, field('보호자(부모님) 이메일', h('input', { name: 'guardian_email', type: 'email', placeholder: '동의 요청 메일을 보냅니다' })),
        h('p', { class: 'small muted' }, '만 14세 미만은 법에 따라 보호자 동의가 필요합니다. 보호자가 메일의 링크에서 동의하면 결제·응시를 할 수 있습니다.'));
      return h('div', { class: 'under14' }, h('label', {}, h('input', { type: 'checkbox', name: 'under14', style: 'width:auto', onchange: (e) => { g.hidden = !e.target.checked; g.querySelector('input').required = e.target.checked; } }), ' 만 14세 미만입니다'), g,
        h('p', { class: 'small muted' }, '부모님이 자녀 여러 명을 관리하려면 부모님 이름으로 가입한 뒤 ', h('b', {}, '내 시험 → 자녀 프로필'), '에서 추가하세요. 자녀는 따로 가입할 필요가 없습니다.'));
    })() : null,
    reg ? h('label', {}, h('input', { type: 'checkbox', name: 'agree', required: true, style: 'width:auto' }), ' ', h('a', { href: '#/terms', target: '_blank' }, '이용약관'), ' 및 ', h('a', { href: '#/privacy', target: '_blank' }, '개인정보처리방침'), '에 동의합니다. (만 14세 미만은 보호자 동의 필요)') : null,
    reg ? null : codeBox, reg ? botCheck() : null,
    err, h('button', { class: 'btn' }, reg ? '가입하기' : '로그인'),
    cfg.kakao ? h('a', { class: 'btn kakao', href: '/api/auth/kakao/start' }, h('span', { class: 'kk' }, '●'), reg ? ' 카카오로 3초 만에 시작하기' : ' 카카오로 로그인') : null,
    h('p', { class: 'small' }, reg ? h('a', { href: '#/login' }, '이미 계정이 있나요?') : [h('a', { href: '#/register' }, '회원가입'), ' · ', h('a', { href: '#/forgot' }, '비밀번호 찾기')]),
  );
  return h('div', { class: 'auth' },
    h('div', { class: 'side' }, h('span', { class: 'eyebrow' }, 'MockTest Lab'), h('div', {}, h('h2', {}, reg ? 'Practice. Score. Improve.' : 'Welcome back.'), h('p', {}, 'MAP · CAT4 · CogAT · SCAT · SSAT · ISEE · SAT · TOEFL Junior · WIDA'))), f);
}
function pageForgot() {
  const msg = h('p', { class: 'muted' });
  const f = h('form', { class: 'card narrow', onsubmit: guard(async (e) => { e.preventDefault(); try { await api('POST', '/auth/forgot', { email: f.email.value, 'cf-turnstile-response': f['cf-turnstile-response']?.value }); msg.textContent = '가입된 이메일이면 재설정 링크를 보냈습니다.'; } finally { resetBotCheck(); } }) },
    h('h2', {}, '비밀번호 찾기'), field('이메일', h('input', { name: 'email', type: 'email', required: true })), botCheck(), h('button', { class: 'btn' }, '링크 보내기'), msg);
  mount(f);
}
function pageReset(token) {
  const f = h('form', { class: 'card narrow', onsubmit: guard(async (e) => { e.preventDefault(); await api('POST', '/auth/reset', { token, password: f.password.value }); toast('변경되었습니다. 로그인해 주세요.'); location.hash = '#/login'; }) },
    h('h2', {}, '새 비밀번호'), field('새 비밀번호 (8자 이상)', h('input', { name: 'password', type: 'password', minlength: 8, required: true })), h('button', { class: 'btn' }, '변경'));
  mount(f);
}

async function pageMe(q = {}) {
  if (!me) return (location.hash = '#/login');
  const [ov, ord, exs] = await Promise.all([api('GET', '/me/overview'), api('GET', '/orders'), api('GET', '/exams')]);
  const exams = exs.exams;
  const start = (type) => chooseLevel(exams.find((x) => x.type === type), ov.attempts.some((a) => a.exam_type === type && a.status === 'in_progress'));
  const statusBadge = (s) => h('span', { class: 'badge ' + (s === 'graded' ? 'ok' : s === 'submitted' ? 'warn' : '') }, { in_progress: '진행 중', submitted: '채점 대기', graded: '완료' }[s] || s);
  const prof = h('form', { class: 'row', onsubmit: guard(async (e) => { e.preventDefault(); await api('PATCH', '/auth/me', { name: prof.name.value, grade: prof.grade.value, phone: prof.phone.value }); me.name = prof.name.value; renderNav(); toast('저장되었습니다.'); }) },
    h('input', { name: 'name', class: 'grow', value: me.name, required: true }), h('input', { name: 'grade', class: 'grow', value: me.grade || '', placeholder: '학년' }), h('input', { name: 'phone', class: 'grow', value: me.phone || '', placeholder: '연락처' }), h('button', { class: 'btn sm' }, '저장'));
  const pw = h('form', { class: 'row', onsubmit: guard(async (e) => { e.preventDefault(); await api('POST', '/auth/password', { current: pw.cur.value, next: pw.nxt.value }); pw.reset(); toast('비밀번호가 변경되었습니다.'); }) },
    h('input', { name: 'cur', type: 'password', class: 'grow', placeholder: '현재 비밀번호', required: true }), h('input', { name: 'nxt', type: 'password', class: 'grow', placeholder: '새 비밀번호 (8자 이상)', minlength: 8, required: true }), h('button', { class: 'btn sm alt' }, '변경'));
  const charts = [...new Set(ov.attempts.map((a) => a.exam_type))].map((t) => ({ t, pts: ov.attempts.filter((a) => a.exam_type === t && a.status === 'graded' && a.score?.overall != null).reverse().map((a) => ({ v: a.score.overall, t: a.finished_at })) }))
    .filter((x) => x.pts.length >= 2).map((x) => growthChart(x.pts, x.t));
  const del = h('form', { class: 'row', onsubmit: guard(async (e) => { e.preventDefault(); if (!confirm('정말 탈퇴하시겠습니까? 되돌릴 수 없습니다.')) return; await api('POST', '/auth/delete', { password: del.pw.value }); me = null; renderNav(); toast('탈퇴가 완료되었습니다.'); location.hash = '#/'; }) },
    h('input', { name: 'pw', type: 'password', class: 'grow', placeholder: '비밀번호 확인', required: true }), h('button', { class: 'btn sm danger' }, '탈퇴하기'));
  const recheck = guard(async (o) => {
    const r = await api('POST', `/orders/${o.id}/recheck`);
    toast(r.status === 'paid' ? '결제가 확인되어 이용권이 지급되었습니다.' : r.status === 'awaiting_deposit' ? '아직 입금이 확인되지 않았습니다.' : r.error || (r.status === 'failed' ? '결제가 완료되지 않았습니다.' : '결제 승인을 기다리는 중입니다.'));
    pageMe();
  });
  const refund = guard(async (o) => { const reason = prompt('환불 사유를 입력해 주세요 (선택)') ; if (reason === null) return; await api('POST', `/orders/${o.id}/request-refund`, { reason }); toast('환불 요청이 접수되었습니다.'); pageMe(); });
  const gateBox = gateBanner();
  const extra = me.isChild ? [] : [giftCard(), joinClassCard()];
  mount(
    me.isChild ? childBanner() : null,
    gateBox,
    h('h2', {}, `안녕하세요, ${me.name}님`),
    me.isChild ? null : h('div', { class: 'quicklinks' }, [['#/family', '👨‍👩‍👧', '자녀 프로필', '자녀별 이용권·성적 관리'], ['#/practice', '✎', '영역별 연습', '약한 유형만 집중 연습'], me.role === 'teacher' ? ['#/classes', '🏫', '내 반', '학생 성적·이용권 관리'] : ['#/support', '✉', '1:1 문의', '결제·시험·계정 문의']].map(([href, ic, t, d]) => h('a', { href, class: 'ql' }, h('i', {}, ic), h('b', {}, t), h('span', {}, d)))),
    h('div', { class: 'card' }, h('h3', {}, '내 이용권'), ov.entitlements.length ? h('table', {}, h('tr', {}, h('th', {}, '상품'), h('th', {}, '남은 횟수'), h('th', {}, '만료'), h('th', {})),
      ov.entitlements.map((e) => h('tr', {}, h('td', {}, e.title), h('td', {}, e.trial ? h('span', { class: 'badge' }, '관리자 체험') : `${e.remaining}/${e.attempts_total}`), h('td', {}, e.expired ? h('span', { class: 'badge bad' }, '만료') : date(e.expires_at)),
        h('td', {}, e.remaining > 0 && !e.expired ? h('button', { class: 'btn sm', onclick: () => start(e.exam_type) }, '시험 시작') : null)))) : h('p', { class: 'muted' }, '이용권이 없습니다. ', h('a', { href: '#/' }, '시험 상품 보러가기'))),
    ov.attempts.some((a) => a.status === 'in_progress') ? h('div', { class: 'card' }, h('b', {}, '진행 중인 시험이 있습니다.'), h('div', { class: 'row', style: 'margin-top:10px' }, ov.attempts.filter((a) => a.status === 'in_progress').map((a) => h('a', { class: 'btn sm', href: `#/exam/${a.id}` }, `${a.exam_type} 이어서 풀기`)))) : null,
    h('div', { class: 'card' }, h('h3', {}, '응시 기록'), ov.attempts.length ? h('table', {}, ov.attempts.map((a) => h('tr', {}, h('td', {}, a.exam_type, a.level ? h('div', { class: 'small muted' }, (exams.find((x) => x.type === a.exam_type)?.levels || []).find((l) => l.key === a.level)?.name || '') : null), h('td', {}, date(a.started_at)), h('td', {}, statusBadge(a.status)),
      h('td', {}, a.status !== 'in_progress' ? h('a', { href: `#/report/${a.id}` }, '리포트') : null)))) : h('p', { class: 'muted' }, '아직 응시 기록이 없습니다.')),
    h('div', { class: 'card' }, h('h3', {}, '결제 내역'), ord.orders.length ? h('table', {}, ord.orders.map((o) => h('tr', {}, h('td', {}, o.title), h('td', {}, money(o.amount, o.currency)), h('td', {}, date(o.paid_at || o.created_at)), h('td', {}, h('span', { class: 'badge ' + (o.status === 'paid' ? 'ok' : ['awaiting_deposit', 'pending'].includes(o.status) ? 'warn' : 'bad') }, { paid: '결제완료', refunded: '환불', failed: '실패', awaiting_deposit: '입금 대기', pending: '결제 진행중' }[o.status] || o.status)),
      h('td', {}, ['pending', 'awaiting_deposit'].includes(o.status) ? h('button', { class: 'btn sm alt', onclick: () => recheck(o) }, '결제 확인') : null, o.status === 'paid' && o.provider !== 'admin' ? (o.refund_status === 'pending' ? h('span', { class: 'badge warn' }, '환불 검토중') : o.refund_status === 'rejected' ? h('span', { class: 'badge' }, '환불 거절됨') : h('button', { class: 'btn sm alt', onclick: () => refund(o) }, '환불 요청')) : null)))) : h('p', { class: 'muted' }, '결제 내역이 없습니다.')),
    me.role === 'admin' ? h('div', { class: 'card' }, h('div', { class: 'kicker' }, 'Admin'), h('h3', {}, '관리자 체험 응시'), h('p', { class: 'muted small' }, '결제 없이 모든 시험을 직접 풀어 볼 수 있습니다. (횟수 제한 없음)'), h('div', { class: 'row' }, exams.map((x) => h('button', { class: 'btn sm alt', onclick: () => chooseLevel(x, false) }, x.type === 'TOEFLJ' ? 'TOEFL Jr' : x.type)))) : null,
    charts.length ? h('div', { class: 'card' }, h('h3', {}, '성적 추이 (종합 추정 점수)'), h('div', { class: 'grid' }, charts)) : null,
    h('div', { class: 'card' }, h('h3', {}, '회원 정보'), prof, h('h3', {}, '비밀번호 변경'), pw),
    ...extra,
    me.isChild ? null : securityCard(q),
    h('div', { class: 'card' }, h('h3', {}, '회원 탈퇴'), h('p', { class: 'muted small' }, '탈퇴하면 이름·이메일·연락처와 말하기 녹음이 삭제되고, 응시 결과·결제·활동 기록은 누구인지 알 수 없게 익명화되어 보관됩니다(전자상거래법에 따라 결제 기록 5년).'), del),
  );
}

/* ---------- growth chart (inline SVG) ---------- */
function growthChart(points, label) {
  const W = 320, H = 110, pad = 24, ns = 'http://www.w3.org/2000/svg';
  const mk = (t, a) => { const e = document.createElementNS(ns, t); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); return e; };
  const ys = points.map((p) => p.v), lo = Math.min(...ys) - 5, hi = Math.max(...ys) + 5;
  const X = (i) => pad + (i * (W - 2 * pad)) / Math.max(1, points.length - 1), Y = (v) => H - pad - ((v - lo) / (hi - lo || 1)) * (H - 2 * pad);
  const svg = mk('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'max-width:360px', role: 'img', 'aria-label': `${label} 성적 추이` });
  svg.append(mk('polyline', { points: points.map((p, i) => `${X(i)},${Y(p.v)}`).join(' '), fill: 'none', stroke: 'var(--brand)', 'stroke-width': 2.5 }));
  points.forEach((p, i) => {
    svg.append(mk('circle', { cx: X(i), cy: Y(p.v), r: 4, fill: 'var(--brand)' }));
    const t = mk('text', { x: X(i), y: Y(p.v) - 8, 'text-anchor': 'middle', 'font-size': 11, fill: 'currentColor' }); t.textContent = p.v; svg.append(t);
    const d = mk('text', { x: X(i), y: H - 6, 'text-anchor': 'middle', 'font-size': 9, fill: 'var(--muted)' }); d.textContent = new Date(p.t).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }); svg.append(d);
  });
  return h('div', {}, h('b', {}, label), svg);
}


/* ---------- exam guides, free sample, wrong-answer notebook ---------- */
const EXAM_INFO = {
  MAP: { about: 'NWEA가 만든 적응형 학업 진단. 정답이면 더 어려운 문제, 오답이면 더 쉬운 문제가 나와 실제 수준을 정밀하게 찾아갑니다.', who: '미국 초·중등 학생, 국제학교 입학·진급 평가(Reading · Language Usage · Math)', score: 'RIT 점수(대략 100~350)로 표시되며 같은 학생이 반복 응시해 성장 폭을 보는 데 적합합니다. 이 사이트의 점수는 RIT와 비슷한 척도로 환산한 추정치입니다.',
    tips: ['모르는 문제에 오래 머물지 마세요. 정확도가 난이도를 결정하므로 모르면 가장 그럴듯한 답을 고르고 넘어가는 편이 낫습니다.', '독해는 질문을 먼저 읽고 근거 문장을 찾아 확인하세요.', '수학은 계산 실수를 줄이려면 식을 한 줄씩 적어 보세요.'] },
  CAT4: { about: 'GL Assessment의 인지능력 검사. 학교에서 배운 지식이 아니라 추론하는 힘을 네 영역(언어·수리·비언어·공간)으로 측정합니다.', who: '영국계 국제학교 입학·배치(만 6~17세)', score: '표준연령점수(SAS) 평균 100, 표준편차 15. 스태나인 1~9에서 5가 평균이며 7 이상이면 상위권입니다. 이 사이트는 정답률을 SAS로 환산한 추정치를 보여 줍니다.',
    tips: ['영역마다 제한 시간이 짧습니다. 한 문제에 30초 이상 쓰지 않는 연습을 하세요.', '비언어·공간 문제는 도형의 "변하는 규칙(개수·방향·색)"을 하나씩 확인하세요.', '언어 영역은 단어 관계(반대·부분·기능 등)를 먼저 한 문장으로 정의한 뒤 보기를 보세요.'] },
  COGAT: { about: 'Riverside Insights의 인지능력 검사. 언어·수리·비언어 세 배터리로 구성되며 영재 선발과 사립학교 입학에 널리 쓰입니다.', who: '미국 영재 프로그램·사립학교 지원 학생(K~12)', score: '표준연령점수(SAS) 평균 100, 표준편차 16, 스태나인 1~9. 이 사이트는 정답률을 SAS로 환산한 추정치입니다.',
    tips: ['수 계열은 앞뒤 숫자의 차이→차이의 차이 순서로 규칙을 찾으세요.', '유추 문제는 두 단어의 관계를 문장으로 만들어 세 번째 단어에 그대로 적용하세요.', '도형 문제는 보기를 하나씩 소거하는 방식이 빠릅니다.'] },
  SCAT: { about: 'Johns Hopkins CTY가 영재 판별에 쓰는 상위 수준(above-level) 검사. 현재 학년보다 높은 난이도의 어휘 유추와 수량 비교로 구성됩니다.', who: '영재교육 프로그램 지원 학생(주로 초 2~중 8)', score: '영역별 척도 점수와 학년 대비 백분위로 해석합니다. 이 사이트는 영역별 200~300 척도를 가정한 추정치입니다.',
    tips: ['수량 비교는 "계산하지 않고 비교"하는 것이 핵심입니다. 같은 항을 지워 보세요.', '문자 값이 정해지지 않은 문제는 "결정할 수 없다"가 정답일 수 있습니다.', '어려운 어휘는 어근·접두사로 뜻을 추측하세요.'] },
  SSAT: { about: 'Enrollment Management Association의 사립(특히 기숙) 학교 입학 시험. Writing Sample, Quantitative, Reading, Verbal로 구성됩니다.', who: '미국 사립·기숙학교 지원 학생(초 3~고 11)', score: '영역별 440~710 척도점수의 합계와 백분위. 오답 감점이 있는 실제 시험과 달리 이 모의고사는 정답 수로 환산한 추정치입니다. 라이팅은 점수화되지 않고 학교에 전달됩니다.',
    tips: ['Verbal은 동의어·유추를 빨리 풀고 시간을 Reading에 남기세요.', 'Reading은 지문의 주제문·화자의 태도(tone)를 먼저 파악하세요.', '라이팅 샘플은 첫 문단에서 입장을 분명히 하고 구체적 예시를 쓰세요.'] },
  ISEE: { about: 'ERB가 주관하는 사립학교 입학 시험. Verbal Reasoning, Quantitative Reasoning, Reading, Mathematics Achievement, Essay로 구성됩니다.', who: '미국 사립 통학학교 지원 학생(초 2~고 12)', score: '영역별 760~940 척도점수와 스태나인, 백분위. 에세이는 점수화되지 않고 학교에 전달됩니다. 이 사이트는 추정치를 보여 줍니다.',
    tips: ['문장 완성은 빈칸 앞뒤의 접속어(however, because)로 방향을 먼저 잡으세요.', 'Quantitative는 "계산 없이 어림"으로 보기를 줄일 수 있는지 먼저 보세요.', '에세이는 도입-근거 2개-결론의 틀을 외워 두세요.'] },
  SAT: { about: 'College Board의 대학 입학 시험(디지털 SAT). Reading & Writing과 Math 두 섹션이며 응답에 따라 두 번째 모듈의 난이도가 달라집니다.', who: '고등학생(대학 지원), 국제학교 상위 학년', score: '섹션별 200~800, 합산 400~1600. 이 사이트는 정답률을 환산한 추정치이며 실제 SAT의 등화(equating)와 다릅니다.',
    tips: ['Reading & Writing은 지문을 다 읽기 전에 "무엇을 묻는지"를 먼저 보세요.', '문법 문제는 문장 경계(쉼표·접속사)→주어-동사 일치→시제 순으로 점검하세요.', 'Math는 그래프·표 문제에서 축의 단위를 먼저 확인하세요.'] },
  TOEFLJ: { about: 'ETS의 중등용 영어 숙달도 평가(TOEFL Junior Standard). 듣기 · 언어 형식과 의미(문법·어휘) · 읽기로 구성됩니다.', who: '만 11~15세 영어 학습자, 영어 성적 제출이 필요한 국제학교 지원자', score: '영역별 200~300, 합산 600~900과 CEFR(A2~B2) 수준으로 해석합니다. 이 사이트는 영역별 정답률을 환산한 추정치입니다.',
    tips: ['듣기는 질문 유형(주제·세부·의도)을 미리 떠올리고 들으세요. (이 사이트는 최대 2회 재생)', '문법 문제는 빈칸의 품사를 먼저 판단하세요.', '독해는 공지·이메일·기사 등 글의 목적을 먼저 파악하세요.'] },
  WIDA: { about: 'WIDA ACCESS는 미국 K-12 영어 학습자의 영어 숙달도를 듣기·말하기·읽기·쓰기로 평가합니다.', who: '미국 공립학교 영어 학습자(ELL/EL), 영어 숙달도를 확인하려는 학생', score: '영역별 Proficiency Level 1~6. 종합 레벨은 읽기·쓰기 35%씩, 듣기·말하기 15%씩 가중합니다. 쓰기·말하기는 교사가 채점합니다.',
    tips: ['듣기는 핵심어(누가·언제·어디)를 메모하듯 들으세요.', '말하기는 완전한 문장으로 이유와 예시를 덧붙여 말해 보세요.', '쓰기는 첫 문장에 주제를 쓰고 연결어(first, then, because)를 활용하세요.'] },
};
const SCORE_HELP = {
  MAP: '영역 점수는 난이도를 반영한 추정치이며 Beginning → Developing → Proficient → Advanced 순으로 성취 수준을 나눕니다. 같은 영역을 반복 응시해 변화를 보세요.',
  CAT4: 'SAS 100이 평균입니다. 85 미만이면 보완이 필요하고 115 이상이면 강점 영역입니다. 스태나인 5가 평균, 7 이상이 상위권입니다.',
  COGAT: 'SAS 100이 평균입니다(표준편차 16). 스태나인 7 이상이면 상위권이고 영재 프로그램 선발은 보통 상위 3~5% 이내를 봅니다.',
  SCAT: '영역별 점수는 현재 학년보다 높은 수준의 문제를 기준으로 합니다. 절대 점수보다 영역 간 균형과 반복 응시 시 변화를 보세요.',
  SSAT: '합산 점수는 3개 점수 영역(Quantitative · Reading · Verbal)의 합입니다. 라이팅 샘플은 점수에 포함되지 않습니다.',
  ISEE: '합산 점수는 4개 점수 영역의 합이며 에세이는 점수에 포함되지 않습니다. 스태나인 5가 평균입니다.',
  SAT: '합산 점수는 Reading & Writing + Math(400~1600)입니다. 실제 SAT는 응시자 집단 기준으로 환산하므로 이 점수는 참고용입니다.',
  TOEFLJ: '영역별 200~300점, 합산 600~900점입니다. 점수대가 높을수록 CEFR 상위 수준(B1~B2)에 해당합니다.',
  WIDA: 'Level 1(Entering) → 6(Reaching). 종합 레벨은 영역별 가중 평균입니다. 쓰기·말하기는 채점 후 표시됩니다.',
};

function gateBanner() {
  if (me.gate === 'verify_email') {
    const out = h('span', { class: 'small' });
    return h('div', { class: 'notice' }, h('b', {}, '이메일 인증이 필요합니다.'), h('p', { class: 'small' }, `${me.email}로 보낸 인증 링크를 눌러 주세요. 인증 후 결제와 응시를 할 수 있습니다.`),
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: guard(async () => { await api('POST', '/auth/verify/resend'); out.textContent = '인증 메일을 다시 보냈습니다. 스팸함도 확인해 주세요.'; }) }, '인증 메일 다시 받기'), out));
  }
  if (me.gate === 'guardian_consent') {
    const g = h('input', { type: 'email', class: 'grow', placeholder: '보호자 이메일', value: '' });
    const out = h('span', { class: 'small' });
    return h('div', { class: 'notice' }, h('b', {}, '보호자 동의를 기다리고 있습니다.'), h('p', { class: 'small' }, `만 14세 미만 회원은 보호자 동의 후 결제·응시를 할 수 있습니다. ${me.guardianEmail ? `동의 요청을 ${me.guardianEmail}로 보냈습니다.` : ''} 메일이 오지 않았다면 다시 보내거나 다른 보호자 이메일을 입력하세요.`),
      h('div', { class: 'row' }, g, h('button', { class: 'btn sm', onclick: guard(async () => { await api('POST', '/auth/consent/resend', { guardian_email: g.value || undefined }); out.textContent = '동의 요청 메일을 보냈습니다.'; }) }, '동의 요청 보내기'), out));
  }
  return null;
}
function childBanner() {
  return h('div', { class: 'childbar' }, h('span', {}, '👧 ', h('b', {}, me.name), ' 프로필로 이용 중'),
    me.actingParent ? h('button', { class: 'btn sm alt', onclick: guard(async () => {
      const pw = prompt('보호자 계정 비밀번호를 입력하세요'); if (!pw) return;
      await api('POST', '/family/switch-back', { password: pw }); me = (await api('GET', '/auth/me')).user; renderNav(); location.hash = '#/family';
    }) }, '보호자 계정으로 돌아가기') : null);
}
function giftCard() {
  const inp = h('input', { class: 'grow', placeholder: 'GIFT-XXXX-XXXX', style: 'text-transform:uppercase;font-family:var(--mono)' });
  const mine = h('div', {});
  api('GET', '/gift/mine').then(({ codes }) => { if (codes.length) mine.replaceChildren(h('h4', {}, '내가 산 선물 코드'), h('table', {}, codes.map((g) => h('tr', {}, h('td', { class: 'mono' }, g.code), h('td', {}, g.title),
    h('td', {}, g.revoked ? h('span', { class: 'badge bad' }, '취소됨') : g.redeemed_at ? h('span', { class: 'badge ok' }, `사용됨${g.redeemed_name ? ' · ' + g.redeemed_name : ''}`) : h('span', { class: 'badge' }, '미사용')),
    h('td', {}, !g.redeemed_at && !g.revoked ? h('button', { class: 'btn sm alt', onclick: () => copyText(g.code) }, '복사') : null))))); }).catch(() => {});
  return h('div', { class: 'card' }, h('h3', {}, '선물 코드 등록'), h('p', { class: 'muted small' }, '선물 받은 코드를 입력하면 이용권이 바로 지급됩니다.'),
    h('form', { class: 'row', onsubmit: guard(async (e) => { e.preventDefault(); const r = await api('POST', '/gift/redeem', { code: inp.value }); toast(`${r.title} 이용권이 지급되었습니다.`); pageMe(); }) }, inp, h('button', { class: 'btn sm' }, '등록')), mine);
}
function joinClassCard() {
  const inp = h('input', { class: 'grow', placeholder: '반 코드 6자리', maxlength: 6, style: 'text-transform:uppercase;font-family:var(--mono)' });
  const list = h('div', {});
  api('GET', '/classes').then(({ joined }) => { if (joined.length) list.replaceChildren(h('table', {}, joined.map((k) => h('tr', {}, h('td', {}, k.name), h('td', { class: 'small muted' }, `${k.teacher} 선생님`),
    h('td', {}, h('button', { class: 'btn sm alt', onclick: guard(async () => { if (!confirm(`${k.name} 반에서 나갈까요? 선생님이 더 이상 내 성적을 볼 수 없습니다.`)) return; await api('POST', `/classes/${k.id}/leave`); pageMe(); }) }, '나가기')))))); }).catch(() => {});
  return h('div', { class: 'card' }, h('h3', {}, '학원·반 참여'), h('p', { class: 'muted small' }, '선생님께 받은 반 코드를 입력하면 선생님이 내 시험 결과를 보고 이용권을 나눠 줄 수 있습니다.'),
    h('form', { class: 'row', onsubmit: guard(async (e) => { e.preventDefault(); const r = await api('POST', '/classes/join', { code: inp.value }); toast(`${r.name} 반에 참여했습니다.`); pageMe(); }) }, inp, h('button', { class: 'btn sm' }, '참여')), list);
}

/* ---------- family ---------- */
async function pageFamily() {
  if (!me) return (location.hash = '#/login');
  if (me.isChild) return (location.hash = '#/me');
  const [{ children }, { tickets }] = await Promise.all([api('GET', '/family'), api('GET', '/tickets/mine')]);
  const add = h('form', { class: 'row', onsubmit: guard(async (e) => { e.preventDefault(); await api('POST', '/family/children', { name: add.n.value, grade: add.g.value }); toast('자녀 프로필을 추가했습니다.'); pageFamily(); }) },
    h('input', { name: 'n', class: 'grow', placeholder: '자녀 이름', required: true, maxlength: 40 }), h('input', { name: 'g', class: 'grow', placeholder: '학년 (예: G4, K)' }), h('button', { class: 'btn sm' }, '자녀 추가'));
  const giveForm = (kid) => {
    if (!tickets.length) return h('p', { class: 'small muted' }, '나눠 줄 이용권이 없습니다. 시험 상품을 구매하면 자녀에게 나눠 줄 수 있습니다.');
    const sel = h('select', {}, tickets.map((t) => h('option', { value: t.id }, `${t.title} (남은 ${t.left}회)`)));
    const n = h('input', { type: 'number', min: 1, value: 1, style: 'width:80px' });
    return h('div', { class: 'row' }, sel, n, h('button', { class: 'btn sm', onclick: guard(async () => { await api('POST', '/tickets/transfer', { entitlementId: sel.value, toUserId: kid.id, count: +n.value }); toast(`${kid.name}에게 이용권을 줬습니다.`); pageFamily(); }) }, '이용권 주기'));
  };
  mount(h('div', { class: 'kicker' }, 'Family'), h('h2', {}, '자녀 프로필'),
    h('p', { class: 'muted' }, '부모님 계정 하나로 자녀 여러 명의 이용권과 성적을 관리합니다. 결제는 부모님 계정에서 하고, 이용권을 자녀에게 나눠 주세요. 자녀는 “이 프로필로 전환”을 눌러 직접 응시합니다.'),
    h('div', { class: 'card' }, h('h3', {}, '자녀 추가'), add, h('p', { class: 'small muted' }, '자녀 프로필을 만들면 보호자 동의가 완료된 것으로 기록됩니다. 자녀 결과 메일은 부모님 이메일로 갑니다.')),
    children.length ? children.map((k) => h('div', { class: 'card kid' },
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', { style: 'margin:0' }, k.name, k.grade ? h('span', { class: 'muted small' }, ` · ${k.grade}`) : null),
        h('button', { class: 'btn sm', onclick: guard(async () => { await api('POST', '/family/switch', { childId: k.id }); me = (await api('GET', '/auth/me')).user; renderNav(); location.hash = '#/me'; }) }, '이 프로필로 전환 →')),
      h('h4', {}, '이용권'), k.tickets.length ? h('table', {}, k.tickets.map((t) => h('tr', {}, h('td', {}, t.title), h('td', {}, `${t.attempts_total - t.attempts_used}/${t.attempts_total}회 남음`), h('td', { class: 'small muted' }, `~${date(t.expires_at)}`)))) : h('p', { class: 'small muted' }, '이용권 없음'),
      giveForm(k),
      h('h4', {}, '최근 시험'), k.attempts.length ? h('table', {}, k.attempts.map((a) => h('tr', {}, h('td', {}, a.exam_type), h('td', {}, date(a.started_at)), h('td', {}, a.headline ?? (a.status === 'in_progress' ? '진행 중' : '-')), h('td', {}, a.status !== 'in_progress' ? h('a', { href: `#/report/${a.id}` }, '리포트') : null)))) : h('p', { class: 'small muted' }, '아직 응시 기록이 없습니다.'))) : h('div', { class: 'card' }, h('p', { class: 'muted' }, '등록된 자녀가 없습니다.')));
}

/* ---------- classes (teacher) ---------- */
async function pageClasses(id) {
  if (!me) return (location.hash = '#/login');
  if (me.role !== 'teacher' && me.role !== 'admin') return mount(h('div', { class: 'card intro' }, h('div', { class: 'big' }, 'For schools'), h('h2', {}, '학원·기관 계정'), h('p', {}, '반을 만들고 학생 성적을 한눈에 보려면 선생님 계정이 필요합니다. 1:1 문의(기관·단체)로 신청해 주세요.'), h('a', { class: 'btn', href: '#/support?cat=기관·단체' }, '기관 계정 신청')));
  if (id) return pageClassDetail(id);
  const { teaching } = await api('GET', '/classes');
  const f = h('form', { class: 'row', onsubmit: guard(async (e) => { e.preventDefault(); const r = await api('POST', '/classes', { name: f.n.value }); toast(`반을 만들었습니다. 코드: ${r.code}`); pageClasses(); }) }, h('input', { name: 'n', class: 'grow', placeholder: '반 이름 (예: 토요 SSAT 반)', required: true }), h('button', { class: 'btn sm' }, '반 만들기'));
  mount(h('div', { class: 'kicker' }, 'Classes'), h('h2', {}, '내 반'), h('p', { class: 'muted' }, '학생에게 반 코드를 알려 주면 학생이 내 시험 → 학원·반 참여에서 입력합니다. 구매한 이용권을 학생에게 나눠 주고, 결과와 시험 중 화면 이탈 기록을 확인할 수 있습니다.'),
    h('div', { class: 'card' }, f),
    teaching.length ? h('div', { class: 'card' }, h('table', {}, h('tr', {}, ['반', '코드', '학생', ''].map((x) => h('th', {}, x))), teaching.map((k) => h('tr', { class: k.archived ? 'muted' : '' }, h('td', {}, h('a', { href: `#/classes/${k.id}` }, k.name), k.archived ? ' (보관됨)' : ''), h('td', { class: 'mono' }, k.code), h('td', {}, `${k.members}명`),
      h('td', {}, h('button', { class: 'btn sm alt', onclick: guard(async () => { await api('POST', `/classes/${k.id}/archive`); pageClasses(); }) }, k.archived ? '다시 열기' : '보관')))))) : null);
}
async function pageClassDetail(id) {
  const [{ class: k, members }, { tickets }] = await Promise.all([api('GET', `/classes/${id}`), api('GET', '/tickets/mine')]);
  const pick = new Set();
  const sel = h('select', {}, tickets.map((t) => h('option', { value: t.id }, `${t.title} (남은 ${t.left}회)`)));
  const give = guard(async () => {
    if (!pick.size) return toast('학생을 선택하세요.');
    for (const uid of pick) await api('POST', '/tickets/transfer', { entitlementId: sel.value, toUserId: uid, count: 1 });
    toast(`${pick.size}명에게 1회씩 나눠 줬습니다.`); pageClassDetail(id);
  });
  const flags = (a) => { const i = a.integrity ? JSON.parse(a.integrity) : {}; const n = (i.leave || 0) + (i.copy || 0) + (i.device_switch || 0); return n ? h('span', { class: 'badge warn', title: JSON.stringify(i) }, `이탈 ${n}`) : null; };
  mount(h('a', { href: '#/classes', class: 'small' }, '← 내 반'), h('h2', {}, k.name), h('p', {}, '반 코드 ', h('b', { class: 'mono' }, k.code), ' ', h('button', { class: 'btn sm alt', onclick: () => copyText(k.code) }, '복사')),
    tickets.length ? h('div', { class: 'card row' }, h('span', {}, '선택한 학생에게 1회씩:'), sel, h('button', { class: 'btn sm', onclick: give }, '이용권 나눠 주기')) : h('p', { class: 'small muted' }, '나눠 줄 이용권이 없습니다. 시험 상품을 구매하면 학생에게 나눠 줄 수 있습니다(대량 구매는 1:1 문의).'),
    members.length ? h('div', { class: 'card' }, h('table', {}, h('tr', {}, ['', '학생', '남은 이용권', '최근 결과', ''].map((x) => h('th', {}, x))), members.map((m) => h('tr', {},
      h('td', {}, h('input', { type: 'checkbox', style: 'width:auto', onchange: (e) => (e.target.checked ? pick.add(m.id) : pick.delete(m.id)) })),
      h('td', {}, m.name, m.grade ? h('span', { class: 'small muted' }, ` · ${m.grade}`) : null),
      h('td', { class: 'small' }, m.tickets.filter((t) => t.left > 0).map((t) => `${t.exam_type} ${t.left}`).join(' · ') || '-'),
      h('td', { class: 'small' }, m.attempts.slice(0, 3).map((a) => h('div', {}, h('a', { href: `#/report/${a.id}` }, `${a.exam_type} ${a.headline ?? ''}`), ' ', h('span', { class: 'muted' }, date(a.finished_at)), ' ', flags(a)))),
      h('td', {}, h('button', { class: 'btn sm alt', onclick: guard(async () => { if (!confirm(`${m.name} 학생을 반에서 뺄까요?`)) return; await api('POST', `/classes/${id}/remove`, { userId: m.id }); pageClassDetail(id); }) }, '빼기')))))) : h('div', { class: 'card' }, h('p', { class: 'muted' }, '아직 참여한 학생이 없습니다. 반 코드를 알려 주세요.')));
}

/* ---------- practice ---------- */
async function pagePractice(q = {}) {
  if (!me) return (location.hash = '#/login');
  const { exams, stats } = await api('GET', '/practice/options');
  if (!exams.length) return mount(h('div', { class: 'card intro' }, h('div', { class: 'big' }, 'Practice'), h('h2', {}, '영역별 연습'), h('p', {}, '구매(또는 선물·나눠 받은) 시험의 영역별 문제를 시간 제한 없이 풀고 바로 채점받는 연습 모드입니다.'), h('a', { class: 'btn', href: '#/' }, '시험 상품 보기')));
  const ex = h('select', {}, exams.map((e) => h('option', { value: e.type, selected: e.type === q.exam }, e.title)));
  const sec = h('select', {}); const diff = h('select', {}, [['0', '난이도 전체'], ['1', '1 (쉬움)'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5 (어려움)']].map(([v, l]) => h('option', { value: v }, l)));
  const fill = () => sec.replaceChildren(...exams.find((e) => e.type === ex.value).sections.map((s) => h('option', { value: s.key, selected: s.key === q.section }, s.name)));
  ex.addEventListener('change', fill); fill();
  const area = h('div', {});
  const stat = (e, sk) => { const r = stats.find((x) => x.exam_type === e && x.section === sk); return r ? `${r.ok}/${r.n} (${Math.round((r.ok / r.n) * 100)}%)` : '-'; };
  const start = guard(async () => {
    const { questions } = await api('GET', `/practice/questions?exam=${ex.value}&section=${sec.value}&diff=${diff.value}`);
    let ok = 0, done = 0; const score = h('b', {}, '0 / 0');
    area.replaceChildren(h('div', { class: 'row sticky-score' }, h('span', {}, '이번 세트 ', score), h('button', { class: 'btn sm alt', onclick: start }, '새 10문항')),
      ...[].concat(questions.length ? questions.map((qq, i) => {
        const expl = h('p', { class: 'small', hidden: true });
        const box = h('div', { class: 'card' }, h('div', { class: 'small muted' }, `${i + 1}. 난이도 ${qq.difficulty}`), qq.passage ? h('div', { class: 'passage' }, qq.passage) : null, qq.image_svg ? h('img', { class: 'qimg', src: svgUri(qq.image_svg), alt: '' }) : null, h('b', {}, qq.stem));
        const mark = (r) => { done++; if (r.correct) ok++; score.textContent = `${ok} / ${done}`; box.classList.add(r.correct ? 'good' : 'wrong'); expl.hidden = false; expl.replaceChildren(h('b', {}, r.correct ? '정답! ' : '오답 '), r.accepted ? `정답: ${r.accepted.join(' 또는 ')} · ` : '', r.explanation || ''); };
        if (qq.kind === 'num') {
          const inp = h('input', { class: 'gridin', inputmode: 'decimal' });
          const go = h('button', { class: 'btn sm', onclick: guard(async () => { go.disabled = inp.disabled = true; mark(await api('POST', '/practice/check', { questionId: qq.id, text: inp.value })); }) }, '확인');
          box.append(h('div', { class: 'row' }, inp, go), expl);
        } else {
          const opts = qq.choices.map((c, j) => h('button', { type: 'button', class: 'choice', onclick: guard(async () => {
            if (box.dataset.done) return; box.dataset.done = 1; const r = await api('POST', '/practice/check', { questionId: qq.id, choice: j });
            opts.forEach((o, k) => { o.disabled = true; if (k === r.answer) o.classList.add('right'); else if (k === j) o.classList.add('miss'); }); mark(r);
          }) }, h('b', {}, 'ABCDEFGH'[j]), choiceNode(c)));
          box.append(h('div', {}, opts), expl);
        }
        return box;
      }) : h('p', { class: 'muted' }, '이 조건의 문제가 없습니다. 난이도를 바꿔 보세요.')));
  });
  mount(h('div', { class: 'kicker' }, 'Practice'), h('h2', {}, '영역별 연습'), h('p', { class: 'muted' }, '시간 제한 없이 한 영역만 10문항씩 풀고 바로 채점과 해설을 봅니다. 연습은 이용권을 차감하지 않습니다.'),
    h('div', { class: 'card' }, h('div', { class: 'row' }, ex, sec, diff, h('button', { class: 'btn', onclick: start }, '연습 시작')),
      stats.length ? h('p', { class: 'small muted', style: 'margin-top:10px' }, '지금까지: ', exams.flatMap((e) => e.sections.map((s) => [e.type, s])).filter(([t, s]) => stats.some((x) => x.exam_type === t && x.section === s.key)).map(([t, s]) => `${t} ${s.name} ${stat(t, s.key)}`).join(' · ')) : null),
    area);
  if (q.exam && q.section) start();
}

/* ---------- support ---------- */
async function pageSupport(id, q = {}) {
  if (!me) return (location.hash = '#/login');
  if (id) {
    const { ticket, messages } = await api('GET', `/support/${id}`);
    const f = h('form', { onsubmit: guard(async (e) => { e.preventDefault(); await api('POST', `/support/${id}/reply`, { body: f.b.value }); pageSupport(id); }) }, h('textarea', { name: 'b', rows: 4, required: true, placeholder: '추가로 문의할 내용' }), h('button', { class: 'btn sm' }, '보내기'));
    return mount(h('a', { href: '#/support', class: 'small' }, '← 문의 목록'), h('h2', {}, ticket.subject), h('p', { class: 'muted small' }, `${ticket.category} · ${date(ticket.created_at)} · `, supportBadge(ticket.status)),
      messages.map((m) => h('div', { class: 'card msg ' + (m.staff ? 'staff' : '') }, h('div', { class: 'small muted' }, m.staff ? '답변 · 운영팀' : '나', ' · ', date(m.created_at)), h('div', { class: 'msgbody' }, m.body))),
      ticket.status !== 'closed' ? h('div', { class: 'card' }, f) : h('p', { class: 'muted' }, '종료된 문의입니다.'));
  }
  const { tickets } = await api('GET', '/support');
  const cats = ['결제·환불', '시험·채점', '계정', '기관·단체', '기타'];
  const f = h('form', { class: 'card', onsubmit: guard(async (e) => { e.preventDefault(); const r = await api('POST', '/support', { category: f.c.value, subject: f.s.value, body: f.b.value }); toast('문의가 접수되었습니다. 답변이 등록되면 메일로 알려 드립니다.'); location.hash = `#/support/${r.id}`; }) },
    h('h3', {}, '새 문의'), h('div', { class: 'row' }, h('select', { name: 'c' }, cats.map((c) => h('option', { selected: c === q.cat }, c))), h('input', { name: 's', class: 'grow', placeholder: '제목', required: true, maxlength: 120 })),
    h('textarea', { name: 'b', rows: 6, required: true, placeholder: q.cat === '기관·단체' ? '기관명, 담당자 연락처, 예상 학생 수, 원하는 시험을 적어 주세요.' : '문의 내용을 자세히 적어 주세요. (주문번호·시험명 등)' }), h('button', { class: 'btn' }, '문의하기'));
  mount(h('div', { class: 'kicker' }, 'Support'), h('h2', {}, '1:1 문의'), f,
    h('div', { class: 'card' }, h('h3', {}, '내 문의'), tickets.length ? h('table', {}, tickets.map((t) => h('tr', {}, h('td', {}, h('a', { href: `#/support/${t.id}` }, t.subject)), h('td', { class: 'small muted' }, t.category), h('td', {}, supportBadge(t.status)), h('td', { class: 'small' }, date(t.updated_at))))) : h('p', { class: 'muted' }, '문의 내역이 없습니다.')));
}
const supportBadge = (s) => h('span', { class: 'badge ' + (s === 'answered' ? 'ok' : s === 'open' ? 'warn' : '') }, { open: '답변 대기', answered: '답변 완료', closed: '종료' }[s] || s);

/* ---------- e-mail verification & guardian consent landing pages ---------- */
async function pageVerify(token) {
  try { await api('POST', '/auth/verify', { token }); if (me) me = (await api('GET', '/auth/me')).user;
    mount(h('div', { class: 'card intro' }, h('div', { class: 'big' }, 'Verified'), h('h2', {}, '이메일 인증이 완료되었습니다.'), h('a', { class: 'btn', href: me ? '#/me' : '#/login' }, me ? '내 시험으로' : '로그인')));
  } catch (e) { mount(h('div', { class: 'card intro' }, h('h2', { class: 'err' }, '인증하지 못했습니다'), h('p', {}, e.message), h('a', { class: 'btn alt', href: '#/me' }, '내 시험'))); }
}
async function pageConsent(token) {
  let info;
  try { info = await api('GET', `/auth/consent/${token}`); } catch (e) { return mount(h('div', { class: 'card intro' }, h('h2', {}, '열 수 없는 링크입니다'), h('p', { class: 'muted' }, e.message))); }
  const f = h('form', { class: 'card narrow', onsubmit: guard(async (e) => { e.preventDefault(); await api('POST', '/auth/consent', { token, guardian_name: f.n.value, relation: f.r.value, agree: f.a.checked }); mount(h('div', { class: 'card intro' }, h('div', { class: 'big' }, 'Thank you'), h('h2', {}, '동의가 완료되었습니다.'), h('p', {}, `${info.child.name} 학생이 이제 결제와 응시를 할 수 있습니다.`))); }) },
    h('div', { class: 'kicker' }, 'Guardian consent'), h('h2', {}, '법정대리인 동의'),
    h('p', {}, h('b', {}, info.child.name), ' 학생', info.child.grade ? `(${info.child.grade})` : '', '이 가입하면서 보호자 이메일로 ', info.guardian, '을(를) 입력했습니다.'),
    h('div', { class: 'passage small' }, h('b', {}, '수집·이용 항목: '), '이름, 이메일, 학년, 시험 응시 기록(답안·점수·말하기 녹음), 결제 기록', h('br'), h('b', {}, '목적: '), '회원 관리, 모의고사 응시·채점·결과 제공, 결제·환불', h('br'), h('b', {}, '보관: '), '탈퇴 시 개인정보 파기(법정 보관 기록 제외). 자세한 내용은 ', h('a', { href: '#/privacy', target: '_blank' }, '개인정보처리방침'), '을 확인하세요.'),
    field('보호자 성함', h('input', { name: 'n', required: true, maxlength: 40 })), field('관계', h('select', { name: 'r' }, ['부', '모', '조부모', '기타 법정대리인'].map((x) => h('option', {}, x)))),
    h('label', {}, h('input', { type: 'checkbox', name: 'a', required: true, style: 'width:auto' }), ' 위 내용을 확인했으며 자녀의 개인정보 수집·이용에 동의합니다.'),
    h('div', { class: 'row' }, h('button', { class: 'btn' }, '동의합니다'), h('button', { type: 'button', class: 'btn alt', onclick: guard(async () => { if (!confirm('동의하지 않으면 학생 계정을 사용할 수 없습니다. 계속할까요?')) return; await api('POST', '/auth/consent', { token, guardian_name: f.n.value || '-', agree: true, decline: true }); mount(h('div', { class: 'card intro' }, h('h2', {}, '동의하지 않음으로 처리했습니다.'))); }) }, '동의하지 않음')));
  mount(f);
}

function securityCard(q = {}) {
  const box = h('div', { class: 'card', id: 'security' }, h('div', { class: 'kicker' }, 'Security'), h('h3', {}, '로그인 보안'));
  const tfa = h('div', {}), devs = h('div', {});
  const drawTfa = () => {
    if (me.twofa) return tfa.replaceChildren(h('p', {}, h('span', { class: 'badge ok' }, '2단계 인증 사용 중'), ' 로그인할 때 인증 앱의 코드가 필요합니다.'),
      h('form', { class: 'row', onsubmit: guard(async (e) => { e.preventDefault(); const f = e.target; await api('POST', '/auth/2fa/disable', { password: f.pw.value, code: f.code.value }); me.twofa = false; toast('2단계 인증을 해제했습니다.'); drawTfa(); }) },
        h('input', { name: 'pw', type: 'password', class: 'grow', placeholder: '비밀번호', required: true }), h('input', { name: 'code', class: 'grow', placeholder: '현재 6자리 코드', inputmode: 'numeric', required: true }), h('button', { class: 'btn sm alt' }, '해제')));
    tfa.replaceChildren(...[
      me.role === 'admin' ? h('p', { class: 'notice-inline' }, '관리자 계정은 2단계 인증을 꼭 켜 두세요. 비밀번호가 유출돼도 계정을 지킬 수 있습니다.') : null,
      h('p', { class: 'muted small' }, 'Google Authenticator · Microsoft Authenticator 같은 인증 앱으로 로그인할 때 6자리 코드를 한 번 더 확인합니다.'),
      h('form', { class: 'row', onsubmit: guard(async (e) => {
        e.preventDefault(); const s = await api('POST', '/auth/2fa/setup', { password: e.target.pw.value });
        const code = h('input', { class: 'grow', placeholder: '앱에 표시된 6자리', inputmode: 'numeric', maxlength: 6, required: true });
        tfa.replaceChildren(h('ol', { class: 'small' },
          h('li', {}, '인증 앱에서 “설정 키 입력”(키 직접 입력)을 고릅니다.'),
          h('li', {}, '계정 이름: ', h('b', {}, me.email), ' · 키: ', h('code', { class: 'secret' }, s.secret.replace(/(.{4})/g, '$1 ').trim()), ' ', h('button', { type: 'button', class: 'btn sm alt', onclick: () => copyText(s.secret) }, '키 복사')),
          h('li', {}, '휴대폰에서 이 화면을 보고 있다면 ', h('a', { href: s.uri }, '인증 앱으로 바로 열기'), '를 눌러도 됩니다.'),
          h('li', {}, '앱에 나온 6자리 코드를 입력해 확인합니다.')),
          h('form', { class: 'row', onsubmit: guard(async (ev) => { ev.preventDefault(); await api('POST', '/auth/2fa/enable', { code: code.value }); me.twofa = true; toast('2단계 인증이 켜졌습니다. 다른 기기는 로그아웃되었습니다.'); drawTfa(); loadDevs(); }) }, code, h('button', { class: 'btn sm' }, '확인하고 켜기')));
      }) }, h('input', { name: 'pw', type: 'password', class: 'grow', placeholder: '비밀번호 확인', required: true }), h('button', { class: 'btn sm' }, '2단계 인증 켜기'))].filter(Boolean));
  };
  const loadDevs = guard(async () => {
    const { sessions } = await api('GET', '/auth/sessions');
    devs.replaceChildren(h('table', {}, h('tr', {}, ['기기', 'IP', '마지막 사용', ''].map((x) => h('th', {}, x))), sessions.map((x) => h('tr', {},
      h('td', {}, uaName(x.ua), x.current ? h('span', { class: 'badge ok', style: 'margin-left:6px' }, '현재 기기') : null), h('td', { class: 'mono small' }, x.ip || '-'), h('td', {}, date(x.last_seen || x.created_at)),
      h('td', {}, x.current ? null : h('button', { class: 'btn sm alt', onclick: guard(async () => { await api('POST', '/auth/sessions/revoke', { id: x.id }); loadDevs(); }) }, '로그아웃'))))),
      sessions.length > 1 ? h('p', {}, h('button', { class: 'btn sm danger', onclick: guard(async () => { await api('POST', '/auth/sessions/revoke', { all: true }); toast('다른 기기에서 모두 로그아웃했습니다.'); loadDevs(); }) }, '다른 기기 모두 로그아웃')) : '');
  });
  drawTfa(); loadDevs();
  const mine = h('details', { class: 'mylog', ontoggle: guard(async (e) => { if (!e.target.open || mine.dataset.loaded) return; mine.dataset.loaded = 1; const { events } = await api('GET', '/auth/activity'); mine.append(events.length ? h('div', { class: 'logbox' }, logRows(events, { who: false })) : h('p', { class: 'muted small' }, '기록이 없습니다.')); }) },
    h('summary', {}, '내 활동 기록 보기 (로그인·시험·결제, 최근 100건)'));
  box.append(h('h4', {}, '2단계 인증'), tfa, h('h4', {}, '로그인된 기기'), h('p', { class: 'muted small' }, '모르는 기기가 있으면 로그아웃하고 비밀번호를 바꾸세요.'), devs, h('h4', {}, '활동 기록'), mine);
  if (q.secure) setTimeout(() => box.scrollIntoView({ behavior: 'smooth' }), 300);
  return box;
}

async function pageInfo(type) {
  type = (type || '').toUpperCase(); const meta = EXAM_META[type], inf = EXAM_INFO[type];
  if (!meta || !inf) return mount(h('div', { class: 'card' }, h('h2', {}, '시험을 찾을 수 없습니다.')));
  const [{ exams }, { products, payment }] = await Promise.all([api('GET', '/exam-info'), api('GET', '/products')]);
  const e = exams.find((x) => x.type === type), mine = products.filter((p) => p.exam_type === type && p.id !== 'p-test');
  const totalMin = e.sections.reduce((a, s) => a + s.minutes, 0), totalQ = e.sections.reduce((a, s) => a + s.n, 0);
  mount(
    h('div', { class: 'kicker' }, 'Test guide'), h('h1', { style: 'font-family:var(--serif);font-size:clamp(2rem,5vw,3.2rem);letter-spacing:-.05em;margin:6px 0 10px' }, meta.name),
    h('p', { class: 'lead muted', style: 'max-width:42em' }, inf.about),
    h('div', { class: 'stats', style: 'margin:22px 0;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))' }, [['총 문항', `${totalQ}`], ['총 시간', `${totalMin}분`], ['영역', `${e.sections.length}개`], ['출제 방식', e.adaptive ? '적응형' : '고정형']].map(([l, v]) => h('div', { class: 'stat' }, h('div', { class: 'muted small' }, l), h('b', {}, v)))),
    h('div', { class: 'card' }, h('h3', {}, '시험 구성'), h('table', {}, h('tr', {}, ['영역', '문항', '시간', '채점'].map((x) => h('th', {}, x))), e.sections.map((s) => h('tr', {}, h('td', {}, s.name), h('td', {}, s.n), h('td', {}, `${s.minutes}분`), h('td', {}, s.manual ? '교사 채점' : '자동 채점'))))),
    e.levels.length > 1 ? h('div', { class: 'card' }, h('h3', {}, '레벨 · 학년'), h('p', { class: 'muted small' }, '응시할 때 레벨을 고를 수 있습니다. 레벨에 따라 출제 난이도 구간(1~5)과 점수 척도가 달라집니다.'), h('table', {}, h('tr', {}, ['레벨', '대상', '난이도 구간', '점수 척도'].map((x) => h('th', {}, x))), e.levels.map((l) => h('tr', {}, h('td', {}, h('b', {}, l.name)), h('td', {}, l.grades), h('td', {}, `${l.dmin}–${l.dmax}`), h('td', {}, l.scaled ? `영역별 ${l.scaled.min}–${l.scaled.max}` : '공통'))))) : null,
    h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(300px,1fr))' },
      h('div', { class: 'card' }, h('div', { class: 'kicker' }, 'Who takes it'), h('p', {}, inf.who)),
      h('div', { class: 'card' }, h('div', { class: 'kicker' }, 'Scoring'), h('p', {}, inf.score))),
    h('div', { class: 'card' }, h('h3', {}, '이렇게 준비하세요'), h('ul', { style: 'padding-left:1.1em;margin:0' }, inf.tips.map((t) => h('li', { style: 'margin:6px 0' }, t)))),
    h('div', { class: 'cta-band', style: 'margin-top:28px' }, h('div', {}, h('h2', {}, `${meta.name} 무료 체험`), h('p', {}, '로그인 없이 5문항을 풀어 보고 바로 해설을 확인하세요.')), h('div', { class: 'row' },
      h('a', { class: 'btn lg', href: `#/sample/${type}` }, '무료 샘플 풀기 →'), ...mine.slice(0, 1).map((p) => h('button', { class: 'btn lg alt', style: 'color:inherit;border-color:currentColor', onclick: () => buy(p, payment) }, `${p.title} · ${money(p.price_krw, 'KRW')}`)))),
  );
}

async function pageSample(type) {
  type = (type || '').toUpperCase();
  const d = await api('GET', `/sample/${type}`), picked = {};
  const out = h('div', {});
  const submit = guard(async () => {
    const answers = d.questions.map((q) => ({ id: q.id, choice: picked[q.id] ?? null }));
    const r = await api('POST', '/sample/grade', { answers });
    const by = Object.fromEntries(r.results.map((x) => [x.id, x]));
    document.querySelectorAll('[data-q]').forEach((card) => { const x = by[card.dataset.q]; if (!x) return; card.classList.add(x.correct ? 'good' : 'wrong'); card.querySelectorAll('.choice').forEach((c, i) => { c.style.pointerEvents = 'none'; c.classList.remove('sel'); if (i === x.answer) c.classList.add('right'); else if (picked[card.dataset.q] === i) c.classList.add('miss'); }); card.append(h('p', { class: 'small' }, h('b', {}, x.correct ? '정답. ' : '오답. '), x.explanation || '')); });
    btn.remove(); out.replaceChildren(h('div', { class: 'score-hero' }, h('div', {}, h('div', { class: 'muted' }, 'Sample result'), h('h2', {}, `${r.total}문항 중 ${r.score}문항 정답`), h('p', { class: 'muted small' }, '실제 시험은 영역별 제한 시간이 있고 점수와 리포트가 제공됩니다.')), h('a', { class: 'btn', href: `#/info/${type}` }, '시험 안내 · 구매 →')));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  const btn = h('button', { class: 'btn lg', onclick: submit }, '채점하기');
  mount(h('div', { class: 'kicker' }, 'Free sample · no login'), h('h2', {}, `${d.title} 무료 샘플`), out,
    d.questions.map((q, n) => { const boxes = q.choices.map((c, i) => h('label', { class: 'choice', onclick: () => { picked[q.id] = i; boxes.forEach((b, j) => b.classList.toggle('sel', i === j)); } }, h('b', {}, 'ABCD'[i]), choiceNode(c)));
      return h('div', { class: 'card', 'data-q': q.id }, h('div', { class: 'small muted' }, `#${n + 1} · ${q.section}`), q.passage ? h('div', { class: 'passage' }, q.passage) : null, q.image_svg ? h('img', { class: 'qimg', src: svgUri(q.image_svg), alt: '' }) : null, h('h3', { class: 'stem' }, q.stem), boxes); }), btn);
}

async function pageMistakes(q = {}) {
  if (!me) return (location.hash = '#/login');
  const exam = q.exam || '';
  const { items } = await api('GET', '/me/mistakes' + (exam ? `?exam=${exam}` : ''));
  const retry = q.mode === 'retry';
  const qs = (o) => '#/mistakes?' + new URLSearchParams(Object.fromEntries(Object.entries({ exam, mode: retry ? 'retry' : '', ...o }).filter(([, v]) => v))).toString();
  const sel = h('select', { onchange: () => (location.hash = qs({ exam: sel.value })) }, h('option', { value: '' }, '전체 시험'), ...Object.keys(EXAM_META).map((x) => h('option', { value: x, selected: x === exam }, x)));
  if (retry) return mountRetry(items, sel, qs);
  mount(h('div', { class: 'kicker' }, 'Review'), h('h2', {}, '오답노트'), h('p', { class: 'muted' }, '지금까지 틀린 문제를 최근 순으로 모았습니다. 해설을 읽고 같은 유형을 다시 풀어 보세요.'), h('div', { class: 'row', style: 'margin-bottom:16px' }, sel, h('span', { class: 'muted small' }, `${items.length}문항`), items.length ? h('a', { class: 'btn sm', href: qs({ mode: 'retry' }) }, '다시 풀기 모드 →') : null),
    items.length ? items.map((it, i) => h('div', { class: 'card wrong' }, h('div', { class: 'small muted' }, `${it.exam_type} · ${it.section} · 난이도 ${it.difficulty}`), it.passage ? h('div', { class: 'passage' }, it.passage) : null, it.image_svg ? h('img', { class: 'qimg', src: svgUri(it.image_svg), alt: '' }) : null, h('b', {}, it.stem),
      it.kind === 'num' ? h('p', {}, h('span', { class: 'badge bad' }, '내 답'), ' ', it.text || '(무응답)', '  ', h('span', { class: 'badge ok' }, '정답'), ' ', it.choices.join(' 또는 ')) : h('div', {}, it.choices.map((c, j) => h('div', { class: 'choice' + (j === it.answer ? ' right' : j === it.choice ? ' miss' : '') }, h('b', {}, 'ABCD'[j]), choiceNode(c), j === it.choice ? h('span', { class: 'badge bad' }, '내 답') : null, j === it.answer ? h('span', { class: 'badge ok' }, '정답') : null))),
      it.explanation ? h('p', { class: 'small' }, h('b', {}, '해설 '), it.explanation) : null)) : h('div', { class: 'card' }, h('p', { class: 'muted' }, '아직 오답이 없습니다. 시험을 응시하면 틀린 문제가 여기에 쌓입니다.')));
}

/** Retry mode: the same wrong questions without the marks; answer, then see right/wrong and the explanation. */
function mountRetry(items, sel, qs) {
  let right = 0, done = 0;
  const score = h('b', {}, '0 / 0');
  const tick = (ok) => { done++; if (ok) right++; score.textContent = `${right} / ${done}`; };
  const card = (it, i) => {
    const expl = h('p', { class: 'small', hidden: true }, h('b', {}, '해설 '), it.explanation || '해설이 없습니다.');
    const box = h('div', { class: 'card' }, h('div', { class: 'small muted' }, `${i + 1}. ${it.exam_type} · ${it.section} · 난이도 ${it.difficulty}`), it.passage ? h('div', { class: 'passage' }, it.passage) : null,
      it.image_svg ? h('img', { class: 'qimg', src: svgUri(it.image_svg), alt: '' }) : null, h('b', {}, it.stem));
    if (it.kind === 'num') {
      const inp = h('input', { class: 'gridin', inputmode: 'decimal', placeholder: '답 입력' });
      const res = h('p', {});
      const go = h('button', { class: 'btn sm', onclick: () => { const norm = (v) => { const t = String(v).trim().replace(/,/g, ''); const m = t.match(/^(-?\d+)\s*\/\s*(\d+)$/); return m ? +m[1] / +m[2] : t === '' ? NaN : Number(t); };
        const ok = it.choices.some((a) => Math.abs(norm(a) - norm(inp.value)) < 1e-6); tick(ok); go.disabled = inp.disabled = true; box.classList.add(ok ? 'good' : 'wrong');
        res.replaceChildren(h('span', { class: 'badge ' + (ok ? 'ok' : 'bad') }, ok ? '정답' : '오답'), ' 정답: ', it.choices.join(' 또는 ')); expl.hidden = false; } }, '확인');
      box.append(h('div', { class: 'row' }, inp, go), res, expl);
    } else {
      const opts = it.choices.map((c, j) => h('button', { type: 'button', class: 'choice', onclick: () => {
        if (box.dataset.done) return; box.dataset.done = 1; const ok = j === it.answer; tick(ok); box.classList.add(ok ? 'good' : 'wrong');
        opts.forEach((o, k) => { o.disabled = true; if (k === it.answer) o.classList.add('right'); else if (k === j) o.classList.add('miss'); }); expl.hidden = false;
      } }, h('b', {}, 'ABCDEFGH'[j]), choiceNode(c)));
      box.append(h('div', {}, opts), expl);
    }
    return box;
  };
  mount(h('div', { class: 'kicker' }, 'Retry'), h('h2', {}, '오답 다시 풀기'), h('p', { class: 'muted' }, '전에 틀린 문제를 정답 표시 없이 다시 풉니다. 답을 고르면 바로 채점과 해설이 나옵니다.'),
    h('div', { class: 'row sticky-score', style: 'margin-bottom:16px' }, sel, h('span', {}, '이번 점수 ', score), h('a', { class: 'btn sm alt', href: qs({ mode: '' }) }, '← 오답노트')),
    items.length ? items.map(card) : h('div', { class: 'card' }, h('p', { class: 'muted' }, '다시 풀 문제가 없습니다.')));
}

/** Level / grade picker shown before an exam starts (skipped when the exam has one level or an attempt is resumed). */
function chooseLevel(exam, resuming) {
  const go = guard(async (level) => { const r = await api('POST', '/attempts', { examType: exam.type, level }); location.hash = `#/exam/${r.id}`; });
  if (!exam || resuming || (exam.levels || []).length <= 1) return go(exam?.levels?.[0]?.key);
  let pick = exam.suggested || exam.levels[Math.floor((exam.levels.length - 1) / 2)].key;
  const close = () => m.remove();
  const opts = exam.levels.map((l) => h('button', { type: 'button', class: 'lvl' + (l.key === pick ? ' on' : ''), onclick: (e) => { pick = l.key; opts.forEach((b) => b.classList.toggle('on', b === e.currentTarget)); } },
    h('b', {}, l.name), h('span', {}, l.grades), l.key === exam.suggested ? h('i', {}, '추천') : null));
  const m = h('div', { class: 'modal', onclick: (e) => e.target === m && close() }, h('div', { class: 'card', style: 'max-width:520px' },
    h('div', { class: 'kicker' }, 'Choose your level'), h('h3', {}, `${EXAM_META[exam.type]?.name || exam.type} · 레벨 선택`),
    h('p', { class: 'muted small' }, '학년에 맞는 레벨을 고르세요. 레벨에 따라 문제 난이도 구간과 점수 척도가 달라집니다.' + (exam.suggested ? ' (회원 정보의 학년으로 추천했습니다)' : ' 회원 정보에 학년을 입력하면 자동으로 추천됩니다.')),
    h('div', { class: 'lvls' }, opts),
    h('div', { class: 'row', style: 'margin-top:18px' }, h('button', { class: 'btn', onclick: () => go(pick) }, '이 레벨로 시작 →'), h('button', { class: 'btn alt', onclick: close }, '취소'))));
  document.body.append(m);
}

/* ---------- exam runner ---------- */
async function pageExam(id) {
  if (!me) return (location.hash = '#/login');
  let state;
  try { state = await api('GET', `/attempts/${id}/current`); } catch (e) {
    if (!e.data?.lockedElsewhere) throw e;
    return mount(h('div', { class: 'card intro' }, h('div', { class: 'big' }, 'One device'), h('h2', {}, '다른 기기에서 진행 중인 시험입니다.'),
      h('p', {}, '시험은 한 번에 한 기기에서만 볼 수 있습니다. 이 기기에서 이어서 보면 다른 기기의 시험 화면은 멈추고, 기기 전환 기록이 리포트에 남습니다.'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: guard(async () => { await api('POST', `/attempts/${id}/takeover`); pageExam(id); }) }, '이 기기에서 이어서 보기'), h('a', { class: 'btn alt', href: '#/me' }, '내 시험'))));
  }
  for (let i = 0; state.status === 'retry' && i < 5; i++) { await new Promise((r) => setTimeout(r, 300)); state = await api('GET', `/attempts/${id}/current`); }
  if (state.mode === 'section') return pageExamSection(id, state);
  return pageExamAdaptive(id, state);
}

/* ---------- exam integrity: focus loss / copy / fullscreen exit are recorded and shown on the report ---------- */
const fsOk = () => !!document.documentElement.requestFullscreen;
const fsButton = () => (fsOk() ? h('button', { class: 'btn sm alt fs-btn', title: '전체 화면', onclick: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {})) }, document.fullscreenElement ? '전체 화면 끄기' : '⛶ 전체 화면') : null);
let integLast = 0, wasFull = false;
function integrity(type) {
  const m = location.hash.match(/^#\/exam\/([\w-]+)/);
  if (!m || !document.querySelector('.qcard')) return;
  const t = Date.now(); if (type === 'leave') { if (t - integLast < 2000) return; integLast = t; }
  fetch(`/api/attempts/${m[1]}/integrity`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type }) }).catch(() => {});
  if (type === 'leave') toast('시험 화면을 벗어났습니다. 이탈 기록은 결과 리포트에 표시됩니다.');
  if (type === 'copy') toast('시험 문제는 복사할 수 없습니다. 복사 시도는 기록됩니다.');
}
document.addEventListener('visibilitychange', () => { if (document.hidden) integrity('leave'); });
window.addEventListener('blur', () => integrity('leave'));
document.addEventListener('copy', (e) => { if (location.hash.startsWith('#/exam/') && !e.target.closest?.('textarea,input')) { e.preventDefault(); integrity('copy'); } });
document.addEventListener('contextmenu', (e) => { if (location.hash.startsWith('#/exam/') && e.target.closest?.('.qcard') && !e.target.closest('textarea,input')) e.preventDefault(); });
document.addEventListener('fullscreenchange', () => { if (wasFull && !document.fullscreenElement) integrity('fullscreen_exit'); wasFull = !!document.fullscreenElement; document.querySelectorAll('.fs-btn').forEach((b) => (b.textContent = document.fullscreenElement ? '전체 화면 끄기' : '⛶ 전체 화면')); });

/* Section mode: move freely inside a section, change or clear answers, flag for review, submit the section. */
function pageExamSection(id, state) {
  let lastSection = -1, offset = 0, cur = 0, rec = null, submitting = false, shownAt = Date.now(), textTimer = null;
  const listens = {};
  const flagsKey = () => `flags:${id}:${state.section.index}`;
  const getFlags = () => { try { return new Set(JSON.parse(localStorage.getItem(flagsKey()) || '[]')); } catch { return new Set(); } };
  const setFlags = (f) => { try { localStorage.setItem(flagsKey(), JSON.stringify([...f])); } catch {} };
  const answered = (q) => { const v = state.saved[q.id]; return !!v && (q.kind === 'mcq' ? v.choice !== null && v.choice !== undefined : q.kind === 'text' || q.kind === 'num' ? !!(v.text || '').trim() : !!v.audio); };
  const save = async (q, body) => {
    const ms = Date.now() - shownAt; shownAt = Date.now();
    try { await api('POST', `/attempts/${id}/save`, { questionId: q.id, ms, ...body }); }
    catch (e) { if (e.data?.expired) return submitSection(true); toast(e.message); }
  };
  const submitSection = guard(async (auto) => {
    if (submitting) return;
    if (auto !== true) {
      const un = state.questions.filter((q) => !answered(q)).length, fl = getFlags().size;
      const msg = `이 영역을 제출할까요?${un ? `\n· 안 푼 문항 ${un}개는 ${state.penalty ? '무응답(0점)' : '오답'}으로 처리됩니다.` : ''}${fl ? `\n· 다시 보기로 표시한 문항 ${fl}개가 있습니다.` : ''}\n제출하면 이 영역으로 돌아올 수 없습니다.`;
      if (!confirm(msg)) return;
    }
    submitting = true;
    try { const r = await api('POST', `/attempts/${id}/submit-section`, { section: state.section.index }); if (r.status === 'finished') { location.hash = `#/report/${id}`; return; } state = r; cur = 0; render(); }
    finally { submitting = false; }
  });
  const render = () => {
    clearInterval(timerInt); speechSynthesis?.cancel?.();
    offset = state.serverNow - Date.now();
    const sec = state.section;
    if (sec.index !== lastSection) {
      lastSection = sec.index;
      return mount(h('div', { class: 'card intro' }, h('div', { class: 'big' }, `Section ${sec.index + 1} / ${sec.total}`), h('h2', {}, sec.name),
        h('p', {}, `${state.questions.length}문항 · 제한 시간 약 ${Math.max(1, Math.round((sec.deadline - state.serverNow) / 60000))}분`),
        h('ul', { class: 'small', style: 'padding-left:1.1em;color:var(--ink-2)' },
          h('li', {}, '이 영역 안에서는 이전·다음 문항으로 자유롭게 이동하고 답을 바꿀 수 있습니다.'),
          h('li', {}, '모르는 문제는 건너뛰고 “다시 보기”로 표시해 두었다가 나중에 풀어도 됩니다.'),
          h('li', {}, state.penalty ? '이 시험은 오답 −¼점, 무응답 0점입니다. 확신이 없으면 비워 두는 것도 전략입니다.' : '안 푼 문항은 오답으로 처리되니 시간이 남으면 모두 답하세요.'),
          h('li', {}, '시간이 끝나면 이 영역은 자동으로 제출됩니다.')),
        sec.manual ? h('p', { class: 'muted' }, '이 영역은 교사가 직접 채점합니다.') : null,
        h('button', { class: 'btn lg', onclick: () => { shownAt = Date.now(); draw(); } }, '시작하기')));
    }
    draw();
  };
  const draw = () => {
    clearInterval(timerInt); speechSynthesis?.cancel?.();
    const sec = state.section, qs = state.questions, q = qs[cur], flags = getFlags();
    const timer = h('span', { class: 'timer' });
    const tick = () => { const left = Math.max(0, sec.deadline - (Date.now() + offset)); const m = Math.floor(left / 60000), s2 = Math.floor((left % 60000) / 1000); timer.textContent = `${m}:${String(s2).padStart(2, '0')}`; timer.classList.toggle('low', left < 60000); if (left <= 0) { clearInterval(timerInt); submitSection(true); } };
    const go = (i) => { if (i < 0 || i >= qs.length) return; cur = i; shownAt = Date.now(); draw(); };
    const doneCount = qs.filter(answered).length;
    const palette = h('div', { class: 'palette' }, qs.map((x, i) => h('button', { type: 'button', class: 'pal' + (i === cur ? ' cur' : '') + (answered(x) ? ' done' : '') + (flags.has(x.id) ? ' flag' : ''), title: answered(x) ? '답함' : '안 품', onclick: () => go(i) }, i + 1)));
    const body = [];
    if (sec.key === 'listening' && q.passage) {
      listens[q.id] ||= 0;
      const play = h('button', { class: 'btn alt', onclick: () => { if (listens[q.id] >= 2) return toast('최대 2번까지 들을 수 있습니다.'); listens[q.id]++; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(q.passage); u.lang = 'en-US'; u.rate = 0.9; speechSynthesis.speak(u); play.textContent = `▶ 다시 듣기 (${2 - listens[q.id]}회 남음)`; } }, listens[q.id] ? `▶ 다시 듣기 (${2 - listens[q.id]}회 남음)` : '▶ 듣기 (최대 2회)');
      body.push(h('div', { class: 'passage' }, play));
    } else if (q.passage) {
      const grp = qs.map((x, i) => (x.passage === q.passage ? i : -1)).filter((i) => i >= 0); // questions sharing this passage (kept together)
      body.push(h('div', { class: 'passage' }, grp.length > 1 ? h('div', { class: 'pnote' }, `Questions ${grp[0] + 1}–${grp[grp.length - 1] + 1} refer to the following passage.`) : null, q.passage));
    }
    const longP = !!q.passage && sec.key !== 'listening' && q.passage.split(/\s+/).length >= 110;
    if (q.image_svg) body.push(h('img', { class: 'qimg', src: svgUri(q.image_svg), alt: '문제 그림' }));
    body.push(h('h3', { class: 'stem' }, q.stem));
    let kh = null;
    if (q.kind === 'mcq') {
      const pickC = (i) => { state.saved[q.id] = { choice: i }; boxes.forEach((b, j) => b.classList.toggle('sel', i === j)); palette.children[cur].classList.add('done'); counter.textContent = `${qs.filter(answered).length}/${qs.length} 답함`; save(q, { choice: i }); };
      const boxes = q.choices.map((c, i) => h('label', { class: 'choice' + (state.saved[q.id]?.choice === i ? ' sel' : ''), onclick: () => pickC(i) }, h('b', {}, 'ABCDEFGH'[i]), choiceNode(c)));
      body.push(...boxes);
      kh = (e) => { if (e.target.closest?.('input,textarea')) return; const i = 'abcdefgh'.indexOf(e.key.toLowerCase()); if (e.key.length === 1 && i >= 0 && i < boxes.length) pickC(i); else if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1); };
    } else if (q.kind === 'num') {
      const inp = h('input', { class: 'gridin', inputmode: 'decimal', autocomplete: 'off', placeholder: '예: 12, 0.75, 3/4' }); inp.value = state.saved[q.id]?.text || '';
      inp.addEventListener('input', () => { state.saved[q.id] = { text: inp.value }; palette.children[cur].classList.toggle('done', !!inp.value.trim()); counter.textContent = `${qs.filter(answered).length}/${qs.length} 답함`; clearTimeout(textTimer); textTimer = setTimeout(() => save(q, { text: inp.value }), 600); });
      body.push(inp, h('p', { class: 'small muted' }, '숫자로 입력하세요. 분수(3/4)와 소수(0.75) 모두 정답으로 인정됩니다. 단위는 쓰지 않습니다.'));
    } else if (q.kind === 'text') {
      const ta = h('textarea', { rows: 10, maxlength: 6000, placeholder: 'Write your answer here…' }); ta.value = state.saved[q.id]?.text || '';
      ta.addEventListener('input', () => { state.saved[q.id] = { text: ta.value }; clearTimeout(textTimer); textTimer = setTimeout(() => save(q, { text: ta.value }), 700); });
      body.push(ta, h('p', { class: 'small muted' }, '자동 저장됩니다.'));
    } else {
      const stx = h('p', { class: 'muted' }, state.saved[q.id]?.audio ? '녹음이 저장되어 있습니다. 다시 녹음하면 바뀝니다.' : '녹음 버튼을 눌러 말해 보세요.');
      const rb = h('button', { class: 'btn', onclick: guard(async () => {
        if (rec) { rec.stop(); return; }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const chunks = [];
        rec = new MediaRecorder(stream); rec.ondataavailable = (e) => chunks.push(e.data);
        rec.onstop = guard(async () => { stream.getTracks().forEach((t) => t.stop()); const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); rec = null; rb.textContent = '🎙 다시 녹음'; stx.textContent = '업로드 중…';
          const r = await fetch(`/api/attempts/${id}/audio`, { method: 'PUT', headers: { 'content-type': blob.type || 'audio/webm' }, body: blob }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '녹음 업로드 실패');
          await save(q, { audioKey: (await r.json()).audioKey }); state.saved[q.id] = { audio: true }; stx.replaceChildren('녹음 저장됨 · ', h('audio', { controls: true, src: URL.createObjectURL(blob) })); palette.children[cur].classList.add('done'); });
        rec.start(); rb.textContent = '⏹ 녹음 종료'; stx.textContent = '녹음 중… (최대 75초)'; setTimeout(() => rec && rec.state === 'recording' && rec.stop(), 75000);
      }) }, state.saved[q.id]?.audio ? '🎙 다시 녹음' : '🎙 녹음 시작');
      body.push(rb, stx);
    }
    const counter = h('span', { class: 'muted small' }, `${doneCount}/${qs.length} 답함`);
    const flagBtn = h('button', { type: 'button', class: 'btn sm alt' + (flags.has(q.id) ? ' flagged' : ''), onclick: () => { const f = getFlags(); f.has(q.id) ? f.delete(q.id) : f.add(q.id); setFlags(f); draw(); } }, flags.has(q.id) ? '★ 다시 보기 해제' : '☆ 다시 보기');
    const clearBtn = answered(q) && q.kind === 'mcq' ? h('button', { type: 'button', class: 'btn sm alt', onclick: guard(async () => { delete state.saved[q.id]; await api('POST', `/attempts/${id}/save`, { questionId: q.id, clear: true }); draw(); }) }, '답 지우기') : null;
    const last = cur === qs.length - 1;
    mount(h('div', { class: 'exam-shell' },
      h('div', { class: 'exam-top' },
        h('div', { class: 'exam-head' }, h('div', { class: 'sec-pill' }, sec.name, h('i', {}, `${sec.index + 1}/${sec.total}`)), counter, fsButton(), h('span', {}, '⏱ ', timer)),
        palette),
      h('div', { class: 'qcard' + (longP ? ' split' : '') }, h('div', { class: 'qmeta' }, h('b', {}, `Question ${cur + 1}`), h('span', { class: 'row', style: 'gap:6px' }, clearBtn, flagBtn)), longP ? h('div', { class: 'splitwrap' }, body[0], h('div', { class: 'qside' }, body.slice(1))) : body,
        h('div', { class: 'exam-foot' },
          h('button', { class: 'btn alt', disabled: cur === 0, onclick: () => go(cur - 1) }, '← 이전'),
          h('span', { class: 'kbd hide-sm' }, q.kind === 'mcq' ? 'A–D 선택 · ←/→ 이동' : ''),
          last ? h('button', { class: 'btn', onclick: () => submitSection(false) }, '영역 제출') : h('button', { class: 'btn', onclick: () => go(cur + 1) }, answered(q) ? '다음 →' : '건너뛰기 →'))),
      h('p', { style: 'text-align:center;margin-top:18px' }, h('button', { class: 'btn sm alt', onclick: () => submitSection(false) }, `이 영역 제출하기 (${doneCount}/${qs.length})`))));
    if (kh) { window._kh = kh; document.addEventListener('keydown', kh); }
    tick(); timerInt = setInterval(tick, 500);
  };
  render();
}

/* Adaptive mode (MAP): one question at a time, forward only — exactly like the real test. */
async function pageExamAdaptive(id, state) {
  let lastSection = -1, offset = 0, listens = 0, rec = null;
  const render = () => {
    clearInterval(timerInt); speechSynthesis?.cancel?.();
    if (state.status === 'finished') { location.hash = `#/report/${id}`; return; }
    offset = state.serverNow - Date.now();
    const q = state.question, sec = state.section;
    if (sec.index !== lastSection) { // section intro
      lastSection = sec.index;
      return mount(h('div', { class: 'card intro' }, h('div', { class: 'big' }, `Section ${sec.index + 1} / ${sec.total}`), h('h2', {}, sec.name),
        h('p', {}, `제한 시간: 약 ${Math.max(1, Math.round((sec.deadline - state.serverNow) / 60000))}분. 시간이 끝나면 자동으로 다음 영역으로 넘어갑니다.`),
        sec.manual ? h('p', { class: 'muted' }, '이 영역은 교사가 직접 채점하며, 채점이 끝나면 이메일로 알려드립니다.') : null,
        sec.key === 'speaking' ? h('p', { class: 'muted' }, '마이크 사용 권한이 필요합니다.') : null,
        h('button', { class: 'btn lg', onclick: render }, '시작하기')));
    }
    let selected = null, kh = null; const ans = {};
    const timer = h('span', { class: 'timer' });
    const tick = () => { const left = Math.max(0, sec.deadline - (Date.now() + offset)); const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000); timer.textContent = `${m}:${String(s).padStart(2, '0')}`; timer.classList.toggle('low', left < 60000); if (left <= 0) { clearInterval(timerInt); submit(true); } };
    let busy = false;
    const submit = guard(async (auto) => {
      if (busy) return; busy = true;
      const body = { questionId: q.id };
      if (q.kind === 'mcq') body.choice = selected;
      if (q.kind === 'text') body.text = ans.text.value;
      if (q.kind === 'audio' && ans.blob) { const r = await fetch(`/api/attempts/${id}/audio`, { method: 'PUT', headers: { 'content-type': ans.blob.type || 'audio/webm' }, body: ans.blob }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '녹음 업로드 실패'); body.audioKey = (await r.json()).audioKey; }
      state = await api('POST', `/attempts/${id}/answer`, body); busy = false; render();
    });
    const body = [];
    if (q.kind === 'mcq' && sec.key === 'listening') {
      const play = h('button', { class: 'btn alt', onclick: () => { if (listens >= 2) return toast('최대 2번까지 들을 수 있습니다.'); listens++; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(q.passage); u.lang = 'en-US'; u.rate = 0.9; speechSynthesis.speak(u); play.textContent = `▶ 다시 듣기 (${2 - listens}회 남음)`; } }, '▶ 듣기 (최대 2회)');
      body.push(h('div', { class: 'passage' }, play));
    } else if (q.passage) body.push(h('div', { class: 'passage' }, q.passage));
    const longP = !!q.passage && sec.key !== 'listening' && q.passage.split(/\s+/).length >= 110;
    if (q.image_svg) body.push(h('img', { class: 'qimg', src: svgUri(q.image_svg), alt: '문제 그림' }));
    body.push(h('h3', { class: 'stem' }, q.stem));
    if (q.kind === 'mcq') {
      const pick = (i) => { selected = i; boxes.forEach((b, j) => b.classList.toggle('sel', i === j)); next.disabled = false; };
      const boxes = q.choices.map((c, i) => h('label', { class: 'choice', onclick: () => pick(i) }, h('b', {}, 'ABCDEFGH'[i]), choiceNode(c)));
      body.push(...boxes);
      kh = (e) => { if (e.target.closest?.('input,textarea')) return; const i = 'abcdefgh'.indexOf(e.key.toLowerCase()); if (e.key.length === 1 && i >= 0 && i < boxes.length) pick(i); else if (e.key === 'Enter' && selected !== null) submit(false); };
    } else if (q.kind === 'text') {
      ans.text = h('textarea', { rows: 9, maxlength: 6000, placeholder: 'Write your answer here…' }); body.push(ans.text);
    } else {
      const st = h('p', { class: 'muted' }, '녹음 버튼을 눌러 말해 보세요.');
      const rb = h('button', { class: 'btn', onclick: guard(async () => {
        if (rec) { rec.stop(); return; }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const chunks = [];
        rec = new MediaRecorder(stream); rec.ondataavailable = (e) => chunks.push(e.data);
        rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); ans.blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); rec = null; rb.textContent = '🎙 다시 녹음'; st.replaceChildren('녹음 완료 · ', h('audio', { controls: true, src: URL.createObjectURL(ans.blob) })); };
        rec.start(); rb.textContent = '⏹ 녹음 종료'; st.textContent = '녹음 중… (최대 75초)'; setTimeout(() => rec && rec.state === 'recording' && rec.stop(), 75000);
      }) }, '🎙 녹음 시작');
      body.push(rb, st);
    }
    const next = h('button', { class: 'btn lg', disabled: q.kind === 'mcq', onclick: () => submit(false) }, '다음 →');
    const tot = state.progress.total || state.progress.n;
    mount(h('div', { class: 'exam-shell' },
      h('div', { class: 'exam-top' },
        h('div', { class: 'exam-head' }, h('div', { class: 'sec-pill' }, sec.name, h('i', {}, `${sec.index + 1}/${sec.total}`)), h('span', { class: 'muted small' }, `문항 ${state.progress.n} / ${tot}`), fsButton(), h('span', {}, '⏱ ', timer)),
        h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(((state.progress.n - 1) / tot) * 100)}%` }))),
      h('div', { class: 'qcard' + (longP ? ' split' : '') }, longP ? h('div', { class: 'splitwrap' }, body[0], h('div', { class: 'qside' }, body.slice(1))) : body, h('div', { class: 'exam-foot' }, h('span', { class: 'kbd hide-touch' }, q.kind === 'mcq' ? '키보드 A–D 선택 · Enter 다음' : ''), next))));
    if (kh) { window._kh = kh; document.addEventListener('keydown', kh); } // after mount(), which clears the previous handler
    tick(); timerInt = setInterval(tick, 500);
  };
  render();
}

/* ---------- report ---------- */
function analytics(r, t) {
  const A = r.items.filter((i) => i.correct === 0 || i.correct === 1);
  if (!A.length) return null;
  const pct = (xs) => (xs.length ? Math.round((xs.filter((i) => i.correct === 1).length / xs.length) * 100) : null);
  const bands = [['쉬움 (난이도 1–2)', A.filter((i) => i.difficulty <= 2)], ['보통 (3)', A.filter((i) => i.difficulty === 3)], ['어려움 (4–5)', A.filter((i) => i.difficulty >= 4)]];
  const secs = Object.entries(Object.groupBy ? Object.groupBy(A, (i) => i.section) : A.reduce((m, i) => ((m[i.section] ||= []).push(i), m), {}));
  const secStats = secs.map(([k, xs]) => ({ k, n: xs.length, pct: pct(xs), sec: Math.round(xs.reduce((a, i) => a + (i.time_ms || 0), 0) / xs.length / 1000) }));
  const weak = secStats.filter((x) => x.n >= 3).sort((a, b) => a.pct - b.pct)[0];
  return h('div', { class: 'card' }, h('div', { class: 'kicker' }, 'Analysis'), h('h3', {}, '결과 분석'),
    h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(260px,1fr))' },
      h('div', {}, h('b', { class: 'small' }, '난이도별 정답률'), bands.map(([l, xs]) => h('div', { style: 'margin:10px 0' }, h('div', { class: 'small muted' }, `${l} · ${xs.length ? pct(xs) + '%' : '-'} (${xs.filter((i) => i.correct === 1).length}/${xs.length})`), h('div', { class: 'bar' }, h('i', { style: `width:${pct(xs) || 0}%` }))))),
      h('div', {}, h('b', { class: 'small' }, '영역별 평균 풀이 시간'), h('table', {}, secStats.map((x) => h('tr', {}, h('td', {}, x.k), h('td', {}, x.sec < 1 ? '<1초/문항' : `${x.sec}초/문항`), h('td', {}, `${x.pct}%`)))))),
    weak ? h('p', {}, h('b', {}, '보완 포인트: '), `${weak.k} 영역의 정답률이 ${weak.pct}%로 가장 낮습니다. `, h('a', { href: `#/mistakes?exam=${t}` }, '오답노트에서 복습하기 →')) : null,
    SCORE_HELP[t] ? h('p', { class: 'small muted' }, h('b', {}, '점수 해석: '), SCORE_HELP[t]) : null);
}

async function pageReport(id) {
  if (!me) return (location.hash = '#/login');
  renderReport(await api('GET', `/attempts/${id}/report`), id);
}
async function pageShared(token) {
  let r;
  try { r = await api('GET', `/shared/${token}`); } catch (e) { return mount(h('div', { class: 'card intro' }, h('div', { class: 'big' }, 'Link expired'), h('h2', {}, '열 수 없는 링크입니다.'), h('p', { class: 'muted' }, e.message))); }
  renderReport(r, null);
}
function integrityNote(i) {
  if (!i) return h('p', { class: 'small muted' }, '✓ 시험 중 화면 이탈·복사 기록 없음');
  const parts = [['leave', '화면 이탈'], ['copy', '복사 시도'], ['paste', '붙여넣기'], ['fullscreen_exit', '전체 화면 해제'], ['device_switch', '기기 전환']].filter(([k]) => i[k]).map(([k, l]) => `${l} ${i[k]}회`);
  return parts.length ? h('div', { class: 'notice integ' }, h('b', {}, '시험 중 기록: '), parts.join(' · '), h('p', { class: 'small muted', style: 'margin:4px 0 0' }, '다른 창으로 이동하거나 복사를 시도한 횟수입니다. 실제 시험에서는 허용되지 않는 행동입니다.')) : null;
}
const weakest = (sc) => { const e = Object.entries(sc.sections || {}).filter(([, s]) => s.total).sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)[0]; return e ? e[0] : ''; };
function shareBox(r, id) {
  const out = h('div', { class: 'small' });
  const make = guard(async () => { const s = await api('POST', `/attempts/${id}/share`); out.replaceChildren(h('div', { class: 'share-url' }, h('input', { value: s.url, readonly: true, onclick: (e) => e.target.select() }), h('button', { class: 'btn sm', onclick: () => copyText(s.url) }, '복사')), h('p', { class: 'muted' }, `${date(s.expiresAt)}까지 열람 가능 · 로그인 없이 보는 읽기 전용 리포트 (이메일은 표시되지 않음)`)); stop.hidden = false; });
  const stop = h('button', { class: 'btn sm alt', hidden: !r.shareCount, onclick: guard(async () => { if (!confirm('이 리포트의 공유 링크를 모두 중지할까요?')) return; await api('DELETE', `/attempts/${id}/share`); stop.hidden = true; out.replaceChildren(h('p', { class: 'muted' }, '공유가 중지되었습니다. 이전 링크는 더 이상 열리지 않습니다.')); }) }, `공유 중지${r.shareCount ? ` (${r.shareCount})` : ''}`);
  return h('div', { class: 'card noprint share' }, h('div', { class: 'kicker' }, 'Share'), h('h3', {}, '학부모·선생님과 리포트 공유'), h('p', { class: 'muted small' }, '링크를 받은 사람은 로그인 없이 이 리포트만 볼 수 있습니다. 14일 후 자동으로 만료되고, 언제든 중지할 수 있습니다.'),
    h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: make }, '공유 링크 만들기'), stop), out);
}
function renderReport(r, id) {
  const sc = r.score, t = r.attempt.exam_type;
  const ns = 'http://www.w3.org/2000/svg', C = 2 * Math.PI * 54;
  const ring = (pct, big, small, color) => {
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 128 128'); svg.setAttribute('width', '128'); svg.setAttribute('height', '128');
    for (const [stroke, off] of [['var(--rule-2)', 0], [color, C * (1 - Math.max(0.02, pct) / 100)]]) {
      const c = document.createElementNS(ns, 'circle'); for (const [k, v] of Object.entries({ cx: 64, cy: 64, r: 54, fill: 'none', stroke, 'stroke-width': 10, 'stroke-linecap': 'butt', 'stroke-dasharray': C, 'stroke-dashoffset': off })) c.setAttribute(k, v); svg.append(c);
    }
    return h('div', { class: 'ring' }, svg, h('div', { class: 'c' }, h('b', {}, big), h('span', {}, small)));
  };
  const accent = { MAP: 'var(--map)', CAT4: 'var(--cat4)', WIDA: 'var(--wida)', SCAT: 'var(--scat)', SSAT: 'var(--ssat)', ISEE: 'var(--isee)', COGAT: 'var(--cogat)', SAT: 'var(--sat)', TOEFLJ: 'var(--toeflj)' }[t];
  // Each section arrives formatted the way the real test reports it (main value, sub line, optional chip).
  const cards = Object.entries(sc.sections).map(([key, s]) => h('div', { class: 'ring-card' }, h('div', { class: 'muted small' }, s.name),
    ring(s.ring ?? s.pct ?? 0, s.main ?? '–', '', accent),
    h('div', { class: 'small', style: 'min-height:2.6em' }, s.sub || ''),
    s.total ? h('div', { class: 'small muted' }, `${s.correct}/${s.total} 정답${s.omitted ? ` · 무응답 ${s.omitted}` : ''}`) : null,
    s.chip ? h('span', { class: 'badge' }, s.chip) : null,
    r.compare?.sections?.[key] ? h('div', { class: 'peer' }, `같은 레벨 ${r.compare.sections[key].n}명 중 `, h('b', {}, `상위 ${Math.max(1, 100 - r.compare.sections[key].pct)}%`)) : null));
  const head = sc.headline || { label: '종합', value: sc.overall ?? '–' };
  const items = r.items.map((it, i) => h('div', { class: 'card ' + (it.correct === 1 ? 'good' : it.correct === 0 ? 'wrong' : '') },
    h('div', { class: 'small muted' }, `#${i + 1} · ${it.section} · 난이도 ${it.difficulty}`),
    it.passage ? h('div', { class: 'passage' }, it.passage) : null,
    it.image_svg ? h('img', { class: 'qimg', src: svgUri(it.image_svg), alt: '' }) : null, h('b', {}, it.stem),
    it.kind === 'num' ? h('div', {}, h('p', {}, h('span', { class: 'badge ' + (it.correct ? 'ok' : 'bad') }, '내 답'), ' ', it.text || '(무응답)', '  ', h('span', { class: 'badge ok' }, '정답'), ' ', (it.choices || []).join(' 또는 ')), it.explanation ? h('p', { class: 'small muted' }, `해설: ${it.explanation}`) : null) :
    it.kind === 'mcq' ? h('div', {}, it.choices.map((c, j) => h('div', { class: 'choice' + (j === it.answer ? ' right' : j === it.choice ? ' miss' : '') }, h('b', {}, 'ABCDEFGH'[j]), choiceNode(c), j === it.choice ? h('span', { class: 'badge ' + (j === it.answer ? 'ok' : 'bad') }, '내 답') : null, j === it.answer ? h('span', { class: 'badge ok' }, '정답') : null)), it.explanation ? h('p', { class: 'small muted' }, `해설: ${it.explanation}`) : null)
      : h('div', {}, it.text ? h('div', { class: 'passage' }, it.text) : h('p', { class: 'muted' }, '(녹음 응답)'), h('p', {}, it.manual_score ? `교사 점수: ${it.manual_score}/6` : '채점 대기 중', it.feedback ? ` · ${it.feedback}` : ''))));
  mount(
    h('div', { class: 'score-hero' },
      h('div', {}, h('div', { class: 'muted small' }, `${r.student.name} · ${date(r.attempt.finished_at)}${r.attempt.level?.name && r.attempt.level.key !== 'all' ? ' · ' + r.attempt.level.name : ''}`), h('h2', {}, `${r.attempt.title} 결과`),
        sc.pendingManual ? h('span', { class: 'badge warn' }, t === 'WIDA' ? '쓰기/말하기 채점 후 종합 레벨이 표시됩니다' : '에세이/라이팅은 교사 채점 후 표시됩니다 (점수에는 포함되지 않음)') : null,
        r.shared ? h('span', { class: 'badge' }, '공유된 리포트 · 읽기 전용') : null,
        h('p', { class: 'muted small noprint' }, h('button', { class: 'btn sm alt', onclick: () => window.print() }, '인쇄 / PDF 저장'))),
      h('div', { class: 'hero-score' }, h('div', { class: 'muted small' }, head.label), h('div', { class: 'total' + (String(head.value).length > 6 ? ' long' : '') }, head.value ?? '–'))),
    h('div', { class: 'rings' }, cards),
    (sc.extras || []).length ? h('div', { class: 'extras' }, sc.extras.map((x) => h('div', {}, h('div', { class: 'kicker' }, x.label), h('b', {}, x.value)))) : null,
    h('div', { class: 'small muted', style: 'margin:10px 0 18px' }, (sc.notes || ['※ 모의고사 결과는 공식 점수가 아닌 추정치이며 학습 참고용입니다.']).map((n) => h('p', { style: 'margin:3px 0' }, '※ ' + n))),
    integrityNote(r.integrity),
    r.compare && r.compare.n < 10 ? h('p', { class: 'small muted' }, `※ 같은 시험·레벨 응시자가 10명 이상 모이면 또래 비교(상위 %)가 표시됩니다. (현재 ${r.compare.n}명)`) : r.compare ? h('p', { class: 'small muted' }, '※ 또래 비교는 이 사이트 응시자 기준이며 공식 규준이 아닙니다.') : null,
    analytics(r, t),
    !r.shared && id ? h('p', { class: 'noprint' }, h('a', { class: 'btn sm alt', href: `#/practice?exam=${t}&section=${weakest(sc)}` }, '약한 영역 연습하기 →')) : null,
    id && !r.shared && (r.student?.email === me?.email || r.student?.email?.endsWith('@family.invalid')) ? shareBox(r, id) : null,
    h('h3', {}, '문항별 리뷰'), items);
}

/* ---------- admin ---------- */
const ADMIN_TABS = [['stats', '대시보드'], ['users', '회원'], ['orders', '주문'], ['products', '상품'], ['coupons', '쿠폰'], ['gifts', '선물코드'], ['support', '문의'], ['questions', '문제'], ['grading', '채점'], ['payments', '결제설정'], ['logs', '기록'], ['security', '보안']];
async function pageAdmin(tab = 'stats') {
  if (!me || me.role !== 'admin') return (location.hash = '#/');
  const body = h('div', {});
  mount(h('h2', {}, '관리자'), h('div', { class: 'tabs' }, ADMIN_TABS.map(([k, l]) => h('button', { class: k === tab ? 'on' : '', onclick: () => (location.hash = `#/admin/${k}`) }, l))), body);
  document.querySelector('.tabs .on')?.scrollIntoView({ inline: 'center', block: 'nearest' }); // phones: keep the current tab visible
  window.scrollTo(0, 0);
  await ({ stats: adminStats, users: adminUsers, orders: adminOrders, products: adminProducts, questions: adminQuestions, grading: adminGrading, payments: adminPayments, coupons: adminCoupons, security: adminSecurity, logs: adminLogs, gifts: adminGifts, support: adminSupport }[tab] || adminStats)(body);
}
async function adminStats(b) {
  const s = await api('GET', '/admin/stats');
  const nt = h('textarea', { rows: 2, maxlength: 300, placeholder: '예: 추석 연휴(9/16–18) 고객센터 휴무 · 비워 두면 공지가 내려갑니다.' }); nt.value = cfg.notice || '';
  if (!me.twofa) b.append(h('div', { class: 'notice' }, h('b', {}, '관리자 계정에 2단계 인증이 꺼져 있습니다.'), h('p', { class: 'small' }, '비밀번호만으로 관리자 권한을 얻을 수 없도록 인증 앱 코드를 추가하세요.'), h('a', { class: 'btn sm', href: '#/me?secure=1' }, '지금 켜기 →')));
  b.append(h('div', { class: 'card' }, h('h3', {}, '사이트 공지 배너'), nt, h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: guard(async () => { await api('POST', '/admin/notice', { text: nt.value }); cfg.notice = nt.value.trim() || null; showNotice(); toast('공지가 저장되었습니다.'); }) }, '저장'))));
  const charts = h('div', { class: 'charts' });
  api('GET', '/admin/stats/series').then((x) => charts.replaceChildren(...dashCharts(x))).catch(() => {});
  b.append(h('div', { class: 'stats' }, [['회원', s.users], ['결제 주문', s.paidOrders], ['응시', s.attempts], ['채점 대기', s.pendingGrading], ['환불 요청', s.pendingRefunds], ['활성 문제', s.questions], ...s.revenue.map((r) => [`매출 ${r.currency}`, money(r.s, r.currency)])].map(([l, v]) => h('div', { class: 'stat' }, h('div', { class: 'muted small' }, l), h('b', {}, v)))));
  b.append(charts);
}
function dashCharts(x) {
  const days = [...Array(30)].map((_, i) => new Date(Date.now() - (29 - i) * 86400000 + 9 * 3600000).toISOString().slice(0, 10));
  const series = (rows, key = 'n') => days.map((d) => +(rows.find((r) => r.d === d)?.[key] || 0));
  const ns = 'http://www.w3.org/2000/svg';
  const bars = (title, vals, fmt) => {
    const max = Math.max(1, ...vals), W = 300, H = 90, bw = W / vals.length;
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'bars'); svg.setAttribute('preserveAspectRatio', 'none');
    vals.forEach((v, i) => { const r = document.createElementNS(ns, 'rect'); const hh = (v / max) * (H - 4); r.setAttribute('x', i * bw + 1); r.setAttribute('y', H - hh); r.setAttribute('width', bw - 2); r.setAttribute('height', Math.max(hh, v ? 1 : 0)); const tt = document.createElementNS(ns, 'title'); tt.textContent = `${days[i]}: ${fmt(v)}`; r.append(tt); svg.append(r); });
    return h('div', { class: 'chart card' }, h('div', { class: 'kicker' }, title), h('b', {}, fmt(vals.reduce((a, c) => a + c, 0))), h('span', { class: 'small muted' }, ' · 최근 30일'), svg);
  };
  const f = x.funnel || {};
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');
  return [
    bars('매출 (원)', series(x.revenue, 'krw'), (v) => v.toLocaleString() + '원'),
    bars('결제 건수', series(x.revenue), (v) => v + '건'),
    bars('가입', series(x.signups), (v) => v + '명'),
    bars('응시', series(x.attempts), (v) => v + '회'),
    h('div', { class: 'chart card' }, h('div', { class: 'kicker' }, '전환'), h('table', {}, [['가입', f.users], ['이메일 인증', `${f.verified} (${pct(f.verified, f.users)})`], ['구매 회원', `${f.buyers} (${pct(f.buyers, f.users)})`], ['재구매 회원', `${f.repeat} (${pct(f.repeat, f.buyers)})`]].map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, v ?? 0))))),
    h('div', { class: 'chart card' }, h('div', { class: 'kicker' }, '시험별 매출 (30일)'), x.byExam.length ? h('table', {}, x.byExam.map((e) => h('tr', {}, h('td', {}, e.exam_type), h('td', {}, `${e.n}건`), h('td', {}, money(e.krw || 0, 'KRW'))))) : h('p', { class: 'small muted' }, '아직 매출이 없습니다.')),
  ];
}
async function adminGifts(b) {
  const [{ codes }, { products }] = await Promise.all([api('GET', '/admin/gift-codes'), api('GET', '/admin/products')]);
  const out = h('div', {});
  const f = h('form', { class: 'row', onsubmit: guard(async (e) => { e.preventDefault(); const r = await api('POST', '/admin/gift-codes', { productId: f.p.value, count: +f.n.value, note: f.m.value, expires_at: f.x.value ? Date.parse(f.x.value + 'T23:59:59') : null });
    out.replaceChildren(h('p', {}, `${r.codes.length}개 발급:`), h('textarea', { rows: Math.min(10, r.codes.length + 1), readonly: true }, r.codes.join('\n')), h('button', { type: 'button', class: 'btn sm alt', onclick: () => copyText(r.codes.join('\n')) }, '전체 복사')); }) },
    h('select', { name: 'p' }, products.filter((p) => p.id !== 'p-test').map((p) => h('option', { value: p.id }, p.title))), h('input', { name: 'n', type: 'number', min: 1, max: 200, value: 1, style: 'width:90px' }),
    h('input', { name: 'm', class: 'grow', placeholder: '메모 (예: 11월 설명회 경품)' }), h('input', { name: 'x', type: 'date', title: '만료일(선택)' }), h('button', { class: 'btn sm' }, '코드 발급'));
  b.append(h('div', { class: 'card' }, h('h3', {}, '선물 코드 발급'), h('p', { class: 'muted small' }, '이벤트·제휴·경품용 코드입니다. 회원이 내 시험 → 선물 코드 등록에 입력하면 이용권이 지급됩니다. 고객이 “선물하기”로 결제한 코드도 아래 목록에 함께 표시됩니다.'), f, out),
    h('div', { class: 'card' }, h('h3', {}, '코드 목록'), h('table', {}, h('tr', {}, ['코드', '상품', '출처', '상태', '메모', ''].map((x) => h('th', {}, x))), codes.map((g) => h('tr', {}, h('td', { class: 'mono' }, g.code), h('td', { class: 'small' }, g.title), h('td', { class: 'small' }, g.order_id ? '고객 선물 구매' : '관리자 발급'),
      h('td', {}, g.revoked ? h('span', { class: 'badge bad' }, '취소') : g.redeemed_at ? h('span', { class: 'badge ok' }, `사용 · ${g.redeemed_email || ''}`) : h('span', { class: 'badge' }, '미사용')), h('td', { class: 'small muted' }, g.note || ''),
      h('td', {}, !g.redeemed_at && !g.revoked && !g.order_id ? h('button', { class: 'btn sm alt', onclick: guard(async () => { if (!confirm('이 코드를 취소할까요?')) return; await api('POST', `/admin/gift-codes/${g.code}/revoke`); pageAdmin('gifts'); }) }, '취소') : null))))));
}
async function adminSupport(b) {
  const st = new URLSearchParams(location.hash.split('?')[1] || '').get('status') || 'open';
  const { tickets } = await api('GET', `/admin/support?status=${st}`);
  const open = guard(async (t) => {
    const d = await api('GET', `/admin/support/${t.id}`);
    const close = () => m.remove();
    const f = h('form', { onsubmit: guard(async (e) => { e.preventDefault(); await api('POST', `/admin/support/${t.id}/reply`, { body: f.b.value }); close(); toast('답변을 등록하고 메일로 알렸습니다.'); pageAdmin('support'); }) }, h('textarea', { name: 'b', rows: 5, required: true, placeholder: '답변' }), h('div', { class: 'row' }, h('button', { class: 'btn sm' }, '답변 보내기'), h('button', { type: 'button', class: 'btn sm alt', onclick: guard(async () => { await api('POST', `/admin/support/${t.id}/close`); close(); pageAdmin('support'); }) }, '종료'), h('button', { type: 'button', class: 'btn sm alt', onclick: close }, '닫기')));
    const m = h('div', { class: 'modal', onclick: (e) => e.target === m && close() }, h('div', { class: 'card', style: 'max-width:640px;max-height:90vh;overflow:auto' }, h('h3', {}, d.ticket.subject), h('p', { class: 'small muted' }, `${d.ticket.name} (${d.ticket.email}) · ${d.ticket.category} · ${date(d.ticket.created_at)}`),
      d.messages.map((x) => h('div', { class: 'msg ' + (x.staff ? 'staff' : '') }, h('div', { class: 'small muted' }, x.staff ? '운영팀' : '회원', ' · ', date(x.created_at)), h('div', { class: 'msgbody' }, x.body))), f));
    document.body.append(m);
  });
  b.append(h('div', { class: 'row', style: 'margin-bottom:12px' }, [['open', '답변 대기'], ['answered', '답변 완료'], ['closed', '종료'], ['all', '전체']].map(([k, l]) => h('a', { class: 'btn sm ' + (k === st ? '' : 'alt'), href: `#/admin/support?status=${k}` }, l))),
    tickets.length ? h('table', {}, tickets.map((t) => h('tr', {}, h('td', {}, h('a', { href: 'javascript:void 0', onclick: () => open(t) }, t.subject)), h('td', { class: 'small' }, `${t.name} · ${t.email}`), h('td', { class: 'small muted' }, t.category), h('td', {}, supportBadge(t.status)), h('td', { class: 'small' }, date(t.updated_at))))) : h('p', { class: 'muted' }, '문의가 없습니다.'));
}
async function adminCoupons(b) {
  const { coupons } = await api('GET', '/admin/coupons');
  const f = h('form', { class: 'grid2', onsubmit: guard(async (e) => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(f));
    await api('POST', '/admin/coupons', { code: d.code, kind: d.kind, value: +d.value, exam_type: d.exam_type || null, max_uses: d.max_uses ? +d.max_uses : null, expires_at: d.expires ? Date.parse(d.expires + 'T23:59:59') : null, note: d.note });
    toast('저장되었습니다.'); pageAdmin('coupons');
  }) },
    field('코드 (영문 대문자·숫자)', h('input', { name: 'code', required: true, pattern: '[A-Za-z0-9_-]{4,32}', placeholder: 'SPRING15', style: 'text-transform:uppercase' })),
    field('할인 방식', h('select', { name: 'kind' }, h('option', { value: 'percent' }, '정률 (%)'), h('option', { value: 'amount' }, '정액 (원)'))),
    field('할인 값', h('input', { name: 'value', type: 'number', required: true, min: 1, placeholder: '15 또는 5000' })),
    field('적용 시험', h('select', { name: 'exam_type' }, h('option', { value: '' }, '전체'), Object.keys(EXAM_META).map((x) => h('option', { value: x }, x)))),
    field('사용 횟수 제한 (빈칸 = 무제한)', h('input', { name: 'max_uses', type: 'number', min: 1 })),
    field('만료일 (선택)', h('input', { name: 'expires', type: 'date' })),
    field('메모', h('input', { name: 'note', maxlength: 100 })),
    h('div', { style: 'align-self:end' }, h('button', { class: 'btn' }, '쿠폰 만들기 / 수정')));
  b.append(h('div', { class: 'card' }, h('h3', {}, '쿠폰 만들기'), h('p', { class: 'muted small' }, '할인은 최대 90%이며, 결제 금액은 1,000원(USD 1.00) 아래로 내려가지 않습니다. 같은 코드로 다시 저장하면 수정됩니다.'), f),
    h('div', { class: 'card' }, h('h3', {}, '쿠폰 목록'), coupons.length ? h('table', {}, h('tr', {}, ['코드', '할인', '시험', '사용', '만료', '메모', ''].map((x) => h('th', {}, x))), coupons.map((c) => h('tr', {},
      h('td', { class: 'mono' }, c.code), h('td', {}, c.kind === 'percent' ? `${c.value}%` : money(c.value, 'KRW')), h('td', {}, c.exam_type || '전체'), h('td', {}, `${c.used}${c.max_uses ? ' / ' + c.max_uses : ''}`), h('td', {}, c.expires_at ? date(c.expires_at) : '-'), h('td', { class: 'small' }, c.note || ''),
      h('td', {}, h('button', { class: 'btn sm ' + (c.active ? 'alt' : ''), onclick: guard(async () => { await api('POST', `/admin/coupons/${encodeURIComponent(c.code)}/toggle`); pageAdmin('coupons'); }) }, c.active ? '중지' : '다시 사용')))))
      : h('p', { class: 'muted' }, '아직 쿠폰이 없습니다.')));
}
async function adminLogs(b) {
  const f = h('form', { class: 'logfilter' },
    h('input', { name: 'q', placeholder: '이메일 · IP · 주문/응시 ID · 내용 검색', class: 'grow' }),
    h('select', { name: 'cat' }, [['', '전체 활동'], ['account', '로그인·계정'], ['exam', '시험·리포트'], ['pay', '결제·환불'], ['admin', '관리자 작업']].map(([v, l]) => h('option', { value: v }, l))),
    h('input', { name: 'from', type: 'date', 'aria-label': '시작일' }), h('input', { name: 'to', type: 'date', 'aria-label': '종료일' }),
    h('button', { class: 'btn sm' }, '검색'));
  const list = h('div', {}), info = h('p', { class: 'small muted' }), more = h('button', { class: 'btn sm alt', hidden: true }, '더 보기');
  const csv = h('a', { class: 'btn sm alt' }, 'CSV 다운로드');
  let before = null, rows = [];
  const params = () => { const d = Object.fromEntries(new FormData(f)); return new URLSearchParams(Object.fromEntries(Object.entries(d).filter(([, v]) => v))); };
  const load = guard(async (reset) => {
    const qs = params(); if (!reset && before) qs.set('before', before);
    const r = await api('GET', '/admin/logs?' + qs);
    rows = reset ? r.events : rows.concat(r.events); before = rows.length ? rows[rows.length - 1].at : null;
    list.replaceChildren(rows.length ? logRows(rows) : h('p', { class: 'muted' }, '조건에 맞는 기록이 없습니다.'));
    info.textContent = `전체 ${r.total.toLocaleString()}건 중 ${rows.length.toLocaleString()}건 표시`; more.hidden = !r.more;
    csv.href = '/api/admin/logs.csv?' + params();
  });
  f.addEventListener('submit', (e) => { e.preventDefault(); load(true); });
  more.addEventListener('click', () => load(false));
  b.append(h('div', { class: 'card' }, h('div', { class: 'kicker' }, 'Records'), h('h3', {}, '활동 기록'),
    h('p', { class: 'muted small' }, '가입·로그인(실패 포함)·시험 시작/제출/종료·결제/실패/환불·리포트 공유와 열람·관리자의 모든 변경이 시간순으로 남습니다. 기록은 수정·삭제할 수 없게 데이터베이스에서 잠겨 있습니다.'),
    f, h('div', { class: 'row', style: 'justify-content:space-between;margin:10px 0' }, info, csv), list, h('p', {}, more)));
  await load(true);
}
async function adminSecurity(b) {
  const s = await api('GET', '/admin/security');
  const chk = (ok, label, fix) => h('tr', {}, h('td', {}, h('span', { class: 'badge ' + (ok ? 'ok' : 'warn') }, ok ? '정상' : '확인 필요')), h('td', {}, label), h('td', { class: 'small muted' }, ok ? '' : fix));
  b.append(
    h('div', { class: 'card' }, h('h3', {}, '보안 점검'), h('table', {},
      chk(s.checks.adminsWithout2fa === 0, '모든 관리자 2단계 인증', `${s.checks.adminsWithout2fa}명이 2단계 인증을 켜지 않았습니다. 각자 내 시험 → 로그인 보안에서 켜세요.`),
      chk(s.checks.https, 'HTTPS 접속', '사이트 주소가 https가 아닙니다. Cloudflare 도메인으로 접속하세요.'),
      chk(s.checks.turnstile, '자동 가입·봇 차단 (Turnstile)', 'Cloudflare Turnstile 위젯을 만들고 TURNSTILE_SITE_KEY(Text), TURNSTILE_SECRET(Secret)을 넣으면 가입·비밀번호 찾기에 봇 차단이 켜집니다.'),
      chk(s.checks.webhookSecrets.stripe && s.checks.webhookSecrets.portone, '결제 웹훅 서명 키', '결제 키는 있는데 웹훅 시크릿이 없습니다. 위조된 결제 알림을 막으려면 꼭 넣으세요.')),
      h('p', { class: 'small muted' }, '항상 켜져 있는 보호: 보안 헤더(CSP·HSTS·클릭재킹 차단), 동일 출처 확인(CSRF), 로그인·가입·쿠폰·결제 요청 횟수 제한, 흔한 비밀번호 차단, 관리자 세션 12시간 만료, 서버 금액 검증, 관리자 작업 기록.')),
    h('div', { class: 'card' }, h('h3', {}, '관리자 계정'), h('table', {}, s.admins.map((a) => h('tr', {}, h('td', {}, a.name), h('td', {}, a.email), h('td', {}, h('span', { class: 'badge ' + (a.twofa ? 'ok' : 'warn') }, a.twofa ? '2FA 사용' : '2FA 꺼짐')), h('td', {}, date(a.last_login_at)))))),
    s.failedLoginsByIp.length ? h('div', { class: 'card' }, h('h3', {}, '최근 1시간 로그인 실패 (IP별)'), h('table', {}, s.failedLoginsByIp.map((x) => h('tr', {}, h('td', { class: 'mono' }, x.ip), h('td', {}, `${x.n}회`))))) : null,
    h('div', { class: 'card' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', {}, '최근 보안 관련 기록'), h('a', { class: 'btn sm alt', href: '#/admin/logs' }, '전체 기록 보기 →')),
      logRows(s.log.filter((l) => /^(login|admin\.login|password|2fa|session|account)/.test(l.action)).slice(0, 30))));
}
async function adminUsers(b) {
  const q = h('input', { placeholder: '이메일/이름 검색', class: 'grow' }); const list = h('div', {});
  const load = guard(async () => {
    const { users } = await api('GET', '/admin/users?q=' + encodeURIComponent(q.value));
    list.replaceChildren(h('table', {}, h('tr', {}, ['이름', '이메일', '권한', '상태', '가입일', ''].map((x) => h('th', {}, x))), users.map((u) => h('tr', {},
      h('td', {}, u.name), h('td', {}, u.email), h('td', {}, u.role, u.role === 'admin' ? h('span', { class: 'badge ' + (u.twofa ? 'ok' : 'warn'), style: 'margin-left:6px' }, u.twofa ? '2FA' : '2FA 꺼짐') : null), h('td', {}, h('span', { class: 'badge ' + (u.status === 'active' ? 'ok' : 'bad') }, u.status)), h('td', {}, date(u.created_at)),
      h('td', {}, h('button', { class: 'btn sm alt', onclick: () => userDetail(u.id) }, '상세'))))));
  });
  q.addEventListener('input', () => { clearTimeout(q.t); q.t = setTimeout(load, 300); });
  b.append(h('div', { class: 'row' }, q), list); await load();
}
async function userDetail(id) {
  const d = await api('GET', '/admin/users/' + id); const { products } = await api('GET', '/admin/products');
  const close = () => m.remove();
  const sel = h('select', {}, products.map((p) => h('option', { value: p.id }, p.title)));
  const m = h('div', { class: 'modal', onclick: (e) => e.target === m && close() }, h('div', { class: 'card', style: 'max-width:640px;max-height:90vh;overflow:auto' },
    h('h3', {}, `${d.user.name} (${d.user.email})`), h('p', { class: 'muted small' }, `${d.user.role} · ${d.user.status} · 학년 ${d.user.grade || '-'} · 연락처 ${d.user.phone || '-'}`),
    h('div', { class: 'row' },
      h('button', { class: 'btn sm ' + (d.user.status === 'active' ? 'danger' : ''), onclick: guard(async () => { await api('PATCH', '/admin/users/' + id, { status: d.user.status === 'active' ? 'suspended' : 'active' }); close(); toast('변경됨'); pageAdmin('users'); }) }, d.user.status === 'active' ? '계정 정지' : '정지 해제'),
      (() => { const r = h('select', {}, [['student', '학생·학부모'], ['teacher', '선생님(기관)'], ['admin', '관리자']].map(([v, l]) => h('option', { value: v, selected: v === d.user.role }, l)));
        return h('span', { class: 'row', style: 'gap:6px' }, r, h('button', { class: 'btn sm alt', onclick: guard(async () => { if (r.value === d.user.role) return; if (!confirm(`권한을 ${r.selectedOptions[0].textContent}(으)로 바꿀까요? 해당 회원은 다시 로그인해야 합니다.`)) return; await api('PATCH', '/admin/users/' + id, { role: r.value }); close(); pageAdmin('users'); }) }, '권한 변경')); })(),
      h('button', { class: 'btn sm danger', onclick: guard(async () => { if (confirm('이 회원의 개인정보(이름·이메일·연락처)를 지우고 탈퇴 처리할까요?\n응시 결과·결제·활동 기록은 익명으로 보존됩니다.')) { await api('DELETE', '/admin/users/' + id); close(); pageAdmin('users'); } }) }, '탈퇴 처리')),
    h('p', { class: 'small' }, d.user.parent_id ? h('span', { class: 'badge' }, '자녀 프로필') : null, ' ', d.user.kakao_id ? h('span', { class: 'badge' }, '카카오') : null, ' ',
      d.user.email_verified_at ? h('span', { class: 'badge ok' }, '이메일 인증') : h('button', { class: 'btn sm alt', onclick: guard(async () => { await api('POST', `/admin/users/${id}/verify-email`); close(); userDetail(id); }) }, '이메일 인증 처리'), ' ',
      d.user.under14 ? (d.user.consent_at ? h('span', { class: 'badge ok' }, `보호자 동의 ${date(d.user.consent_at)}`) : h('button', { class: 'btn sm alt', onclick: guard(async () => { const note = prompt('보호자 동의를 어떻게 확인했나요? (예: 보호자 전화 확인 2026-11-15)'); if (!note) return; await api('POST', `/admin/users/${id}/consent`, { note }); close(); userDetail(id); }) }, '보호자 동의 수동 확인')) : null),
    h('h4', {}, '이용권 수동 지급'), h('div', { class: 'row' }, sel, h('button', { class: 'btn sm', onclick: guard(async () => { await api('POST', `/admin/users/${id}/grant`, { productId: sel.value }); close(); userDetail(id); }) }, '지급')),
    h('h4', {}, '이용권'), h('table', {}, d.entitlements.map((e) => h('tr', {}, h('td', {}, e.exam_type), h('td', {}, `${e.attempts_used}/${e.attempts_total}`), h('td', {}, date(e.expires_at)), h('td', {}, e.revoked ? '회수됨' : '')))),
    h('h4', {}, '주문'), h('table', {}, d.orders.map((o) => h('tr', {}, h('td', {}, o.title), h('td', {}, o.provider), h('td', {}, money(o.amount, o.currency)), h('td', {}, o.status)))),
    h('h4', {}, '활동 기록'), d.activity.length ? h('div', { class: 'logbox' }, logRows(d.activity, { who: false })) : h('p', { class: 'muted small' }, '기록 없음'),
    h('h4', {}, '응시'), h('table', {}, d.attempts.map((a) => h('tr', {}, h('td', {}, a.exam_type), h('td', {}, date(a.started_at)), h('td', {}, a.status), h('td', {}, h('a', { href: `#/report/${a.id}`, onclick: close }, '리포트'))))),
    h('p', {}, h('button', { class: 'btn alt sm', onclick: close }, '닫기'))));
  document.body.append(m);
}
async function adminOrders(b) {
  const { orders } = await api('GET', '/admin/orders');
  b.append(h('p', {}, h('a', { class: 'btn sm alt', href: '/api/admin/orders.csv' }, 'CSV 내보내기')), h('table', {}, h('tr', {}, ['일시', '회원', '상품', '수단', '금액', '상태', ''].map((x) => h('th', {}, x))), orders.map((o) => h('tr', {},
    h('td', {}, date(o.created_at)), h('td', {}, `${o.name} (${o.email})`), h('td', {}, o.title), h('td', {}, o.provider), h('td', {}, money(o.amount, o.currency)), h('td', {}, o.status),
    h('td', {}, o.refund_status === 'pending' ? h('div', { class: 'small' }, h('span', { class: 'badge warn' }, '환불요청'), ` ${o.refund_reason || ''} `, h('button', { class: 'btn sm alt', onclick: guard(async () => { await api('POST', `/admin/refund-requests/${o.refund_id}/reject`); pageAdmin('orders'); }) }, '거절')) : null,
      ['pending', 'failed', 'awaiting_deposit'].includes(o.status) && o.provider !== 'admin' ? h('button', { class: 'btn sm alt', title: 'PG사 관리자 화면에서 결제를 확인한 경우에만', onclick: guard(async () => { const tno = prompt('PG사(KCP·포트원·Stripe) 관리자 화면에서 결제 완료를 확인했나요? 확인했다면 거래번호를 입력하세요 (선택).'); if (tno === null) return; await api('POST', `/admin/orders/${o.id}/mark-paid`, { tno }); toast('결제 확정 · 이용권 지급'); pageAdmin('orders'); }) }, '수동 확정') : null,
      ['pending', 'failed', 'awaiting_deposit'].includes(o.status) && o.provider !== 'admin' ? h('button', { class: 'btn sm alt', onclick: guard(async () => { const r = await api('POST', `/admin/orders/${o.id}/recheck`); toast(`결제사 확인 결과: ${r.status}${r.error ? ' (' + r.error + ')' : ''}`); pageAdmin('orders'); }) }, '재확인') : null,
      o.status === 'paid' && o.provider !== 'admin' ? h('button', { class: 'btn sm danger', onclick: guard(async () => { if (confirm('PG사에 환불을 요청하고 이용권을 회수합니다. 진행할까요?')) { await api('POST', `/admin/orders/${o.id}/refund`); toast('환불 완료'); pageAdmin('orders'); } }) }, '환불') : null)))));
}
async function adminProducts(b) {
  const { products } = await api('GET', '/admin/products');
  const edit = (p = { exam_type: 'MAP', title: '', description: '', price_krw: 19000, price_usd_cents: 1400, attempts: 1, valid_days: 90, active: 1, sort: 0 }) => {
    const f = h('form', { class: 'card', onsubmit: guard(async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(f)); await api('POST', '/admin/products', { ...d, id: p.id, active: !!d.active }); pageAdmin('products'); }) },
      h('div', { class: 'row' }, field('시험', h('select', { name: 'exam_type', value: p.exam_type }, Object.keys(SECTIONS).map((x) => h('option', { selected: x === p.exam_type }, x)))), field('상품명', h('input', { name: 'title', value: p.title, required: true })), field('정렬', h('input', { name: 'sort', type: 'number', value: p.sort }))),
      field('설명', h('input', { name: 'description', value: p.description })),
      h('div', { class: 'row' }, field('가격(원)', h('input', { name: 'price_krw', type: 'number', value: p.price_krw })), field('가격(USD 센트)', h('input', { name: 'price_usd_cents', type: 'number', value: p.price_usd_cents })), field('응시 횟수', h('input', { name: 'attempts', type: 'number', value: p.attempts })), field('유효기간(일)', h('input', { name: 'valid_days', type: 'number', value: p.valid_days }))),
      h('label', {}, h('input', { type: 'checkbox', name: 'active', checked: !!p.active, style: 'width:auto' }), ' 판매 중'), h('button', { class: 'btn sm' }, '저장'));
    b.replaceChildren(f);
  };
  b.append(h('p', {}, h('button', { class: 'btn sm', onclick: () => edit() }, '+ 새 상품')), h('table', {}, products.map((p) => h('tr', {}, h('td', {}, p.exam_type), h('td', {}, p.title), h('td', {}, `${money(p.price_krw, 'KRW')} / ${money(p.price_usd_cents, 'USD')}`), h('td', {}, `${p.attempts}회/${p.valid_days}일`), h('td', {}, p.active ? '판매중' : '중지'), h('td', {}, h('button', { class: 'btn sm alt', onclick: () => edit(p) }, '수정'))))));
}
const SECTIONS = { MAP: ['reading', 'language', 'math'], CAT4: ['verbal', 'quantitative', 'nonverbal', 'spatial'], WIDA: ['listening', 'reading', 'writing', 'speaking'], SCAT: ['verbal', 'quantitative'], SSAT: ['writing', 'quantitative', 'reading', 'verbal'], ISEE: ['verbal', 'quantitative', 'reading', 'math', 'essay'], COGAT: ['verbal', 'quantitative', 'nonverbal'], SAT: ['rw', 'math'], TOEFLJ: ['listening', 'lfm', 'reading'] };
async function adminQuestions(b) {
  const fe = h('select', {}, h('option', { value: '' }, '전체 시험'), ...Object.keys(SECTIONS).map((x) => h('option', {}, x)));
  const list = h('div', {});
  const load = guard(async () => {
    const { questions, counts } = await api('GET', '/admin/questions' + (fe.value ? `?exam=${fe.value}` : ''));
    list.replaceChildren(h('p', { class: 'small muted' }, counts.map((c) => `${c.exam_type}/${c.section}: ${c.n}`).join(' · ')),
      h('table', {}, questions.map((q) => h('tr', { style: q.active ? '' : 'opacity:.4' }, h('td', {}, `${q.exam_type}/${q.section}`), h('td', {}, `L${q.difficulty}`), h('td', {}, q.stem.slice(0, 80)), h('td', {}, h('button', { class: 'btn sm alt', onclick: () => qEdit(q.id) }, '수정'))))));
  });
  const qEdit = guard(async (id) => {
    const q = id ? await api('GET', '/admin/questions/' + id) : { exam_type: 'MAP', section: 'reading', kind: 'mcq', difficulty: 3, passage: '', stem: '', image_svg: '', choices: ['', '', '', ''], answer: 0, explanation: '', active: 1 };
    const f = h('form', { class: 'card', onsubmit: guard(async (e) => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(f));
      const body = { exam_type: d.exam_type, section: d.section, kind: d.kind, difficulty: +d.difficulty, passage: d.passage, stem: d.stem, image_svg: d.image_svg, explanation: d.explanation, active: !!d.active,
        choices: d.kind === 'mcq' || d.kind === 'num' ? d.choices.split('\n').map((x) => x.trim()).filter(Boolean) : null, answer: d.kind === 'mcq' ? (+d.answer) - 1 : null };
      await api(id ? 'PUT' : 'POST', '/admin/questions' + (id ? '/' + id : ''), body); toast('저장됨'); pageAdmin('questions');
    }) },
      h('div', { class: 'row' }, field('시험', h('select', { name: 'exam_type' }, Object.keys(SECTIONS).map((x) => h('option', { selected: x === q.exam_type }, x)))), field('영역(section key)', h('input', { name: 'section', value: q.section })), field('유형', h('select', { name: 'kind' }, ['mcq', 'num', 'text', 'audio'].map((x) => h('option', { selected: x === q.kind }, x)))), field('난이도(1-5)', h('input', { name: 'difficulty', type: 'number', min: 1, max: 5, value: q.difficulty }))),
      field('지문 (듣기는 읽어줄 스크립트)', h('textarea', { name: 'passage', rows: 3 }, q.passage || '')), field('문제', h('textarea', { name: 'stem', rows: 2, required: true }, q.stem)),
      field('보기 (한 줄에 하나, 그림은 svg:<svg ...>)', h('textarea', { name: 'choices', rows: 5 }, (q.choices || []).join('\n'))), field('정답 번호 (1부터)', h('input', { name: 'answer', type: 'number', min: 1, value: (q.answer ?? 0) + 1 })),
      field('문제 그림 SVG (선택)', h('textarea', { name: 'image_svg', rows: 3 }, q.image_svg || '')), field('해설', h('textarea', { name: 'explanation', rows: 2 }, q.explanation || '')),
      h('label', {}, h('input', { type: 'checkbox', name: 'active', checked: !!q.active, style: 'width:auto' }), ' 출제 대상'), h('div', { class: 'row' }, h('button', { class: 'btn sm' }, '저장'),
        id ? h('button', { type: 'button', class: 'btn sm danger', onclick: guard(async () => { await api('DELETE', '/admin/questions/' + id); pageAdmin('questions'); }) }, '비활성화') : null));
    b.replaceChildren(f);
  });
  const imp = h('textarea', { rows: 5, placeholder: '[{"exam_type":"MAP","section":"math","difficulty":3,"stem":"...","choices":["a","b","c","d"],"answer":0,"explanation":"..."}]' });
  fe.addEventListener('change', load);
  b.append(h('div', { class: 'row' }, fe, h('button', { class: 'btn sm', onclick: () => qEdit() }, '+ 새 문제')), list,
    h('details', { class: 'card' }, h('summary', {}, 'JSON 대량 등록'), imp, h('p', {}, h('button', { class: 'btn sm', onclick: guard(async () => { const r = await api('POST', '/admin/questions/import', JSON.parse(imp.value)); toast(`${r.imported}개 등록됨`); pageAdmin('questions'); }) }, '등록'))));
  await load();
}
async function adminPayments(b) {
  const st = await api('GET', '/admin/payment-status');
  const row = (name, ok, lines) => h('div', { class: 'card' }, h('div', { class: 'row' }, h('h3', { class: 'grow', style: 'margin:0' }, name), h('span', { class: 'badge ' + (ok ? 'ok' : 'warn') }, ok ? '설정됨' : '미설정')), lines.map(([k, v]) => h('p', { class: 'small' }, h('span', { class: 'muted' }, k + ' '), h('code', {}, v))));
  b.append(
    h('p', { class: 'muted' }, '아래 주소를 각 결제사 관리자 화면에 등록하고, 시크릿은 Cloudflare → Workers → Settings → Variables and Secrets에 추가하세요. 연동 점검은 홈의 “[관리자 전용] 결제 테스트 1,000원” 상품으로 직접 결제해 볼 수 있습니다.'),
    row('KCP 직접 연동', st.kcp.configured, [['모드', st.kcp.mode === 'prod' ? '운영(prod)' : '테스트(test)'], ['site_cd', st.kcp.siteCd || '(KCP_SITE_CD 필요)'], ['결과 수신(Ret_URL)', st.kcp.returnUrl], ['필요 시크릿', 'KCP_SITE_CD, KCP_CERT_INFO (운영 전환 시 KCP_MODE=prod)']]),
    row('포트원 (KCP 등 PG 채널)', st.portone.configured, [['웹훅 URL', st.portone.webhookUrl], ['웹훅 시크릿', st.portone.webhookSecret ? '설정됨' : '(PORTONE_WEBHOOK_SECRET 필요)'], ['필요 값', 'PORTONE_STORE_ID, PORTONE_CHANNEL_KEY, PORTONE_API_SECRET']]),
    row('Stripe (해외 카드)', st.stripe.configured, [['웹훅 URL', st.stripe.webhookUrl], ['웹훅 시크릿', st.stripe.webhookSecret ? '설정됨' : '(STRIPE_WEBHOOK_SECRET 필요)']]),
    (() => {
      const out = h('p', { class: 'small' });
      const card = row('이메일 (Resend)', st.mail.configured, [['보내는 주소', st.mail.from + (st.mail.testSender ? ' (Resend 테스트 주소: 본인 Resend 계정 이메일로만 발송됨)' : '')], ['필요 값', 'RESEND_API_KEY (Secret), MAIL_FROM (Text, 예: MockTest Lab <noreply@내도메인>)']]);
      card.append(h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn sm', onclick: guard(async () => { out.className = 'small'; out.textContent = '보내는 중…'; try { const r = await api('POST', '/admin/mail-test'); out.className = 'small ok-text'; out.textContent = `✓ ${r.to}로 테스트 메일을 보냈습니다. 받은편지함(스팸함 포함)을 확인하세요.`; } catch (e) { out.className = 'small err'; out.textContent = '발송 실패: ' + e.message; } }) }, '내 이메일로 테스트 메일 보내기')), out);
      return card;
    })(),
    row('카카오 로그인', st.kakao.login, [['Redirect URI', st.kakao.redirect], ['필요 값', 'KAKAO_REST_KEY (Text), KAKAO_CLIENT_SECRET (Secret, 선택) · 카카오 개발자 콘솔에서 이메일 동의항목 설정']]),
    row('카카오 알림톡 (SOLAPI)', st.kakao.alimtalk, [['템플릿', `결과 알림 ${st.kakao.templates.result ? '✓' : '✗'} · 결제 알림 ${st.kakao.templates.paid ? '✓' : '✗'}`], ['필요 값', 'SOLAPI_API_KEY, SOLAPI_API_SECRET (Secret), SOLAPI_SENDER, KAKAO_PFID, ALIMTALK_TPL_RESULT, ALIMTALK_TPL_PAID']]));
}
async function adminGrading(b) {
  const { items } = await api('GET', '/admin/grading');
  if (!items.length) return b.append(h('p', { class: 'muted' }, '채점할 답안이 없습니다.'));
  b.append(...items.map((it) => {
    const f = h('form', { class: 'card', onsubmit: guard(async (e) => { e.preventDefault(); await api('POST', '/admin/grading/' + it.id, { score: f.score.value, feedback: f.fb.value }); toast('저장됨'); pageAdmin('grading'); }) },
      h('div', { class: 'small muted' }, `${it.name} (${it.email}) · ${it.section}`), h('b', {}, it.stem),
      it.kind === 'text' ? h('div', { class: 'passage' }, it.text || '(무응답)') : (it.audio_key ? h('audio', { controls: true, src: '/api/admin/audio/' + encodeURIComponent(it.audio_key) }) : h('p', { class: 'muted' }, '(녹음 없음)')),
      h('div', { class: 'row' }, h('input', { name: 'score', type: 'number', min: 1, max: 6, value: it.manual_score ?? '', placeholder: '1-6', required: true, style: 'width:90px' }), h('input', { name: 'fb', class: 'grow', value: it.feedback || '', placeholder: '피드백(선택)' }), h('button', { class: 'btn sm' }, it.manual_score ? '수정' : '채점')));
    return f;
  }));
}


/* ---------- legal pages (템플릿: 게시 전 법률 검토 필요) ---------- */
let cfg = { site: 'MockTest Lab', biz: {} };
const LEGAL = {
  terms: ['이용약관', (c) => [
    ['제1조 (목적)', `이 약관은 ${c.biz.name}(이하 "회사")가 제공하는 ${c.site} 온라인 모의고사 서비스(이하 "서비스")의 이용 조건과 절차, 회사와 회원의 권리·의무를 규정합니다.`],
    ['제2조 (서비스 내용)', '회사는 MAP, CAT4, CogAT, SCAT, SSAT, ISEE, SAT, TOEFL Junior, WIDA 형식을 참고해 자체 제작한 연습용 모의고사를 제공합니다. 본 서비스는 NWEA, GL Assessment, Riverside Insights(CogAT), Johns Hopkins CTY, Enrollment Management Association(SSAT), ERB(ISEE), College Board(SAT), ETS(TOEFL), WIDA와 제휴·승인 관계가 없으며, 제공되는 점수는 학습 참고용 추정치이고 공식 점수가 아닙니다.'],
    ['제3조 (회원가입)', '회원은 정확한 정보를 입력해야 하며, 만 14세 미만 아동은 법정대리인(보호자)의 동의 하에 가입·이용해야 합니다. 계정은 타인에게 양도하거나 공유할 수 없습니다.'],
    ['제4조 (이용권과 결제)', '이용권은 결제 완료 시 자동 지급되며, 상품별로 정해진 응시 횟수와 유효기간 내에서 사용할 수 있습니다. 시험을 시작하면 응시 1회가 차감됩니다.'],
    ['제5조 (금지행위)', '문제의 복제·배포·캡처 후 공유, 자동화 도구를 이용한 응시, 타인 계정 도용, 서비스 운영 방해 행위를 금지하며, 위반 시 이용이 제한될 수 있습니다.'],
    ['제6조 (저작권)', '서비스 내 문제와 해설의 저작권은 회사에 있으며, 회원은 개인 학습 목적 외로 이용할 수 없습니다.'],
    ['제7조 (면책)', '회사는 천재지변, 통신 장애 등 불가항력으로 인한 서비스 중단에 책임을 지지 않으며, 모의고사 결과가 실제 시험 성적을 보장하지 않습니다.'],
    ['제8조 (분쟁 해결)', '이 약관은 대한민국 법률에 따르며, 분쟁은 민사소송법상 관할 법원에서 해결합니다.'],
  ]],
  privacy: ['개인정보처리방침', (c) => [
    ['1. 수집 항목', '필수: 이름, 이메일, 비밀번호(암호화 저장). 선택: 학년, 연락처. 서비스 이용 과정에서 응시 기록(답안, 소요 시간, 점수)과 결제 기록이 생성되며, 말하기 시험 시 음성 녹음이 수집됩니다.'],
    ['2. 이용 목적', '회원 관리, 이용권 제공, 시험 채점 및 결과 리포트 제공, 결제·환불 처리, 고객 문의 대응, 서비스 개선.'],
    ['3. 보유 기간', '회원 탈퇴 시 이름·이메일·연락처·말하기 녹음은 지체 없이 파기합니다. 응시 결과·답안과 서비스 이용 기록(접속·로그인·결제·시험 활동 기록, 접속 IP)은 개인을 알아볼 수 없게 익명화하여 서비스 운영·부정 이용 방지·분쟁 대응을 위해 보관합니다. 전자상거래법에 따라 계약·결제 기록 5년, 소비자 불만·분쟁 기록 3년은 반드시 보관합니다.'],
    ['4. 제3자 제공 및 처리위탁', '결제 처리를 위해 포트원 및 결제대행사, Stripe에 결제에 필요한 정보를 전달하며, 서버·저장소는 Cloudflare, 이메일 발송은 Resend를 통해 처리됩니다. 이 외에는 법령에 근거한 경우를 제외하고 동의 없이 제공하지 않습니다.'],
    ['5. 이용자의 권리', '회원은 언제든지 개인정보 열람·정정·삭제·처리정지를 요청할 수 있으며, 아래 문의처로 연락하면 지체 없이 처리합니다.'],
    ['6. 아동의 개인정보', '만 14세 미만 아동의 개인정보는 법정대리인의 동의를 받아 수집합니다.'],
    ['7. 개인정보 보호책임자', `${c.biz.owner} · 문의: ${c.biz.contact}`],
  ]],
  refund: ['환불규정', (c) => [
    ['1. 전액 환불', '결제 후 7일 이내이며 응시 기록이 전혀 없는(미사용) 이용권은 전액 환불됩니다.'],
    ['2. 부분 환불', '다회권은 사용하지 않은 회차에 대해, 이미 응시한 회차 가격(정가 기준)을 공제한 금액을 환불합니다.'],
    ['3. 환불 불가', '응시를 시작한 1회권, 유효기간이 지난 이용권, 회원의 약관 위반으로 이용이 제한된 경우.'],
    ['4. 환불 절차', `고객센터(${c.biz.contact})로 주문 정보와 함께 요청하시면 확인 후 영업일 기준 3일 이내에 결제 수단으로 환불합니다. 카드사 사정에 따라 취소 반영에 며칠이 더 걸릴 수 있습니다.`],
    ['5. 서비스 장애', '회사 귀책으로 시험을 정상 응시하지 못한 경우 응시 횟수를 복구하거나 환불합니다.'],
  ]],
};
function pageLegal(kind) {
  const [title, build] = LEGAL[kind];
  mount(h('div', { class: 'card' }, h('h2', {}, title), build(cfg).map(([t, body]) => h('div', {}, h('h3', {}, t), h('p', {}, body))),
    h('p', { class: 'small muted' }, `사업자: ${cfg.biz.name} · 대표 ${cfg.biz.owner} · 사업자등록번호 ${cfg.biz.regNo} · 통신판매업 ${cfg.biz.salesNo} · ${cfg.biz.address} · ${cfg.biz.contact}`)));
}

/* ---------- router ---------- */
async function route() {
  document.querySelectorAll('.modal').forEach((m) => m.remove()); // never leave a dialog open across pages
  $nav.classList.remove('open'); // close the phone menu after navigating
  const [path, qs] = (location.hash.slice(1) || '/').split('?'); const q = Object.fromEntries(new URLSearchParams(qs || ''));
  const seg = path.split('/').filter(Boolean);
  try {
    if (!seg.length) return await pageHome();
    switch (seg[0]) {
      case 'login': return mount(authForm('login', q));
      case 'register': return mount(authForm('register'));
      case 'forgot': return pageForgot();
      case 'reset': return pageReset(seg[1]);
      case 'me': return await pageMe(q);
      case 'info': return await pageInfo(seg[1]);
      case 'sample': return await pageSample(seg[1]);
      case 'mistakes': return await pageMistakes(q);
      case 'exam': return await pageExam(seg[1]);
      case 'report': return await pageReport(seg[1]);
      case 'shared': return await pageShared(seg[1]);
      case 'family': return await pageFamily();
      case 'classes': return await pageClasses(seg[1]);
      case 'practice': return await pagePractice(q);
      case 'support': return await pageSupport(seg[1], q);
      case 'verify': return await pageVerify(seg[1]);
      case 'consent': return await pageConsent(seg[1]);
      case 'admin': return await pageAdmin(seg[1]);
      case 'terms': case 'privacy': case 'refund': return pageLegal(seg[0]);
      case 'pay': return seg[1] === 'success' ? await pagePaySuccess(q) : mount(h('div', { class: 'card intro' }, h('div', { class: 'big' }, 'Payment not completed'), h('h2', {}, '결제가 완료되지 않았습니다.'),
        q.msg ? h('p', { class: 'err' }, q.msg) : null, h('p', { class: 'muted' }, '결제 금액이 청구되지 않았거나, 청구된 경우 자동으로 취소됩니다. 이미 결제가 됐는데 이용권이 보이지 않으면 “내 시험 > 결제 내역”에서 “결제 확인”을 눌러 주세요.'),
        h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/' }, '다시 시도하기'), h('a', { class: 'btn alt', href: '#/me' }, '내 시험'))));
      default: return mount(h('div', { class: 'card' }, h('h2', {}, '페이지를 찾을 수 없습니다.')));
    }
  } catch (e) {
    if (e.status === 401) { me = null; renderNav(); location.hash = '#/login'; return; }
    mount(h('div', { class: 'card' }, h('h2', { class: 'err' }, '오류'), h('p', {}, e.message), h('a', { class: 'btn alt', href: '#/' }, '처음으로')));
  }
}
function showNotice() {
  document.getElementById('notice')?.remove();
  if (!cfg.notice) return;
  const key = 'notice-hidden:' + cfg.notice;
  try { if (localStorage.getItem(key)) return; } catch {}
  const bar = h('div', { id: 'notice', class: 'notice-bar', role: 'status' }, h('span', {}, '★'), h('p', {}, cfg.notice),
    h('button', { 'aria-label': '공지 닫기', onclick: () => { try { localStorage.setItem(key, 1); } catch {} bar.remove(); } }, '×'));
  $app.before(bar);
}
window.addEventListener('hashchange', route);
document.addEventListener('click', (e) => { if (!e.target.closest('nav')) $nav.classList.remove('open'); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal').forEach((m) => m.remove()); });
(async () => {
  try { me = (await api('GET', '/auth/me')).user; } catch {}
  try { cfg = await api('GET', '/config'); const b = cfg.biz; document.getElementById('bizinfo').textContent = `${b.name} · 대표 ${b.owner} · 사업자등록번호 ${b.regNo} · 통신판매업 ${b.salesNo} · ${b.address} · ${b.contact}`; } catch {}
  renderNav(); showNotice();
  const po = new URLSearchParams(location.search).get('portone_order'); // mobile redirect return
  if (po) {
    const qp = new URLSearchParams(location.search), code = qp.get('code'), msg = qp.get('message');
    history.replaceState(null, '', '/');
    location.hash = code ? `#/pay/cancel?msg=${encodeURIComponent(msg || code)}` : `#/pay/success?order=${po}&provider=portone`;
  }
  route();
})();
