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
  if (!r.ok) { const e = new Error(j.error || `오류 (${r.status})`); e.status = r.status; e.data = j; throw e; }
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

function renderNav() {
  $nav.replaceChildren(...[
    h('a', { href: '#/' }, '시험 상품'),
    ...(me ? [
      h('a', { class: 'keep', href: '#/me' }, '내 시험'),
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
  const total = products.length;
  mount(
    h('section', { class: 'hero' },
      h('div', {}, h('span', { class: 'eyebrow' }, '✨ 결제 즉시 응시 · 영역별 리포트 제공'),
        h('h1', {}, '국제학교 입학·진단 대비', h('br'), h('em', {}, 'MAP · CAT4 · WIDA'), ' 실전 모의고사'),
        h('p', { class: 'lead' }, '실제 시험과 같은 형식, 같은 긴장감. 집에서 온라인으로 응시하고 영역별 점수와 해설 리포트를 바로 확인하세요.'),
        h('div', { class: 'row' }, h('button', { class: 'btn lg', onclick: toExams }, '시험 둘러보기'), me ? h('a', { class: 'btn lg alt', href: '#/me' }, '내 시험') : h('a', { class: 'btn lg alt', href: '#/register' }, '무료 회원가입')),
        h('div', { class: 'chips' }, [['300+', '오리지널 문항'], ['3종', 'MAP · CAT4 · WIDA'], ['즉시', '자동 채점 리포트']].map(([b, t]) => h('div', {}, h('b', {}, b), t)))),
      h('div', { class: 'mock', 'aria-hidden': 'true' },
        h('div', { class: 'mrow' }, h('b', {}, 'Verbal Reasoning'), h('span', {}, '⏱ 08:42')),
        h('div', { class: 'mq' }, 'Author is to book as composer is to ___'),
        [['A', 'song', true], ['B', 'piano'], ['C', 'concert'], ['D', 'singer']].map(([l, t, sel]) => h('div', { class: 'mc' + (sel ? ' sel' : '') }, h('b', {}, l), t)),
        h('div', { class: 'mbar' }, h('i'))),
    ),
    h('div', { id: 'exams', class: 'section-title' }, h('div', {}, h('h2', {}, '시험 선택'), h('p', {}, '원하는 시험과 횟수권을 고르세요. 모든 상품은 결제 즉시 이용 가능합니다.'))),
    h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(310px,1fr))' }, Object.entries(EXAM_META).map(([type, m]) => h('div', { class: 'exam-card', style: `--accent:${m.accent};--accent-soft:${m.soft}` },
      h('div', { class: 'ico' }, m.ico), h('h3', {}, m.name), h('div', { class: 'sub' }, m.sub),
      h('ul', {}, m.points.map((x) => h('li', {}, x))),
      h('div', { class: 'push' }, products.filter((p) => p.exam_type === type).map((p) => h('div', { class: 'plan' },
        h('div', {}, h('div', { class: 'pt' }, `${p.attempts}회권`), h('div', { class: 'pd' }, `${p.valid_days}일 이내 · ${money(p.price_usd_cents, 'USD')}`)),
        h('div', { class: 'row', style: 'flex-wrap:nowrap' }, h('div', { class: 'price' }, money(p.price_krw, 'KRW')), h('button', { class: 'btn sm', onclick: () => buy(p, payment) }, '구매')))),
      ),
    ))),
    h('div', { class: 'section-title' }, h('div', {}, h('h2', {}, '이렇게 진행돼요'), h('p', {}, '가입부터 리포트까지 5분이면 충분합니다.'))),
    h('div', { class: 'steps' }, [['회원가입', '이메일로 간단히 가입하고 학년을 입력합니다.'], ['결제', '카드/간편결제(국내) 또는 해외 카드로 결제하면 이용권이 자동 지급됩니다.'], ['응시', '영역별 타이머와 함께 온라인으로 실전처럼 응시합니다.'], ['리포트', '점수·해설·성장 추이를 확인하고 PDF로 저장합니다.']].map(([t, d]) => h('div', { class: 'step' }, h('h3', {}, t), h('p', {}, d)))),
    h('div', { class: 'section-title' }, h('div', {}, h('h2', {}, '준비된 기능'))),
    h('div', { class: 'features' }, [['🎯', '실전형 출제', '서버에서 한 문항씩 출제하고 정답은 노출되지 않습니다. 새로고침해도 이어서 풀 수 있어요.'], ['📈', '성장 추이', '같은 시험을 반복 응시하면 점수 변화를 그래프로 보여드립니다.'], ['🧠', '해설 리포트', '문항별 정답·내 답·해설과 영역별 강약점을 제공합니다.'], ['🎧', '듣기·말하기', '듣기는 음성으로 재생, 말하기는 브라우저 녹음으로 응시합니다.'], ['🔒', '안전한 결제', 'Stripe · 포트원 결제, 서버 금액 검증과 웹훅으로 자동 지급됩니다.'], ['📄', 'PDF 저장', '리포트를 인쇄하거나 PDF로 저장해 상담에 활용하세요.']].map(([i, t, d]) => h('div', { class: 'feature' }, h('div', { class: 'fi' }, i), h('div', {}, h('b', {}, t), h('span', {}, d))))),
    h('div', { class: 'section-title' }, h('div', {}, h('h2', {}, '자주 묻는 질문'))),
    FAQ.map(([q, a]) => h('details', { class: 'faq' }, h('summary', {}, q), h('p', {}, a))),
    h('div', { class: 'cta-band' }, h('h2', {}, '지금 실력을 확인해 보세요'), h('p', {}, '결제 후 바로 시작 · 결과는 즉시 확인'), h('button', { class: 'btn lg', onclick: toExams }, '시험 선택하러 가기')),
  );
}

function buy(p, payment) {
  if (!me) { toast('먼저 로그인해 주세요.'); location.hash = '#/login'; return; }
  const close = () => modal.remove();
  const modal = h('div', { class: 'modal', onclick: (e) => e.target === modal && close() }, h('div', { class: 'card' },
    h('h3', {}, p.title), h('p', { class: 'muted' }, '결제 수단을 선택하세요.'),
    h('div', { class: 'row' },
      payment.portone ? h('button', { class: 'btn', onclick: guard(() => payPortone(p, close)) }, `카드/간편결제 (${money(p.price_krw, 'KRW')})`) : null,
      payment.stripe ? h('button', { class: 'btn alt', onclick: guard(() => payStripe(p)) }, `International card (${money(p.price_usd_cents, 'USD')})`) : null,
    ),
    !payment.portone && !payment.stripe ? h('p', { class: 'err' }, '결제 수단이 아직 설정되지 않았습니다. (관리자: README의 결제 설정 참고)') : null,
    h('p', {}, h('button', { class: 'btn alt sm', onclick: close }, '닫기')),
  ));
  document.body.append(modal);
}
async function payStripe(p) { const { url } = await api('POST', '/pay/stripe/checkout', { productId: p.id }); location.href = url; }
async function payPortone(p, close) {
  const o = await api('POST', '/pay/portone/prepare', { productId: p.id });
  if (!window.PortOne) await new Promise((res, rej) => { const s = h('script', { src: 'https://cdn.portone.io/v2/browser-sdk.js' }); s.onload = res; s.onerror = () => rej(new Error('결제 모듈을 불러오지 못했습니다.')); document.head.append(s); });
  const resp = await window.PortOne.requestPayment({
    storeId: o.storeId, channelKey: o.channelKey, paymentId: o.paymentId, orderName: o.orderName, totalAmount: o.totalAmount,
    currency: 'CURRENCY_KRW', payMethod: 'CARD', customer: o.customer, redirectUrl: `${location.origin}/?portone_order=${o.orderId}`,
  });
  if (resp?.code) { toast(resp.message || '결제가 취소되었습니다.'); return; }
  close();
  location.hash = `#/pay/success?order=${o.orderId}&provider=portone`;
}

async function pagePaySuccess(q) {
  mount(h('div', { class: 'card' }, h('h2', {}, '결제 확인 중…'), h('p', { class: 'muted' }, '잠시만 기다려 주세요.')));
  const path = q.provider === 'portone' ? '/pay/portone/complete' : '/pay/stripe/confirm';
  for (let i = 0; i < 6; i++) {
    try {
      const r = await api('POST', path, { orderId: q.order });
      if (r.ok || r.status === 'paid') return mount(h('div', { class: 'card' }, h('h2', { class: 'ok' }, '결제가 완료되었습니다 🎉'), h('p', {}, '이용권이 지급되었습니다. 지금 바로 시험을 시작할 수 있어요.'), h('a', { class: 'btn', href: '#/me' }, '내 시험으로 가기')));
    } catch (e) { if (q.provider === 'portone') return mount(h('div', { class: 'card' }, h('h2', { class: 'err' }, '결제 확인 실패'), h('p', {}, e.message), h('a', { class: 'btn alt', href: '#/' }, '돌아가기'))); }
    await new Promise((r) => setTimeout(r, 1500));
  }
  mount(h('div', { class: 'card' }, h('h2', {}, '결제 처리 중'), h('p', {}, '결제 승인이 지연되고 있습니다. 잠시 후 “내 시험”에서 확인해 주세요.'), h('a', { class: 'btn', href: '#/me' }, '내 시험')));
}

function authForm(kind) {
  const reg = kind === 'register';
  const err = h('div', { class: 'err' });
  const f = h('form', { onsubmit: async (e) => {
    e.preventDefault(); err.textContent = '';
    const d = Object.fromEntries(new FormData(f));
    try {
      const r = await api('POST', reg ? '/auth/register' : '/auth/login', { ...d, agree: !!d.agree });
      me = (await api('GET', '/auth/me')).user; renderNav(); location.hash = '#/me';
    } catch (ex) { err.textContent = ex.message; }
  } },
    h('h2', {}, reg ? '회원가입' : '로그인'),
    reg ? field('이름(학생/학부모)', h('input', { name: 'name', required: true, maxlength: 60 })) : null,
    field('이메일', h('input', { name: 'email', type: 'email', required: true, autocomplete: 'email' })),
    field('비밀번호' + (reg ? ' (8자 이상)' : ''), h('input', { name: 'password', type: 'password', required: true, minlength: reg ? 8 : 1, autocomplete: reg ? 'new-password' : 'current-password' })),
    reg ? field('학년 (선택)', h('input', { name: 'grade', placeholder: '예: G5' })) : null,
    reg ? h('label', {}, h('input', { type: 'checkbox', name: 'agree', required: true, style: 'width:auto' }), ' ', h('a', { href: '#/terms', target: '_blank' }, '이용약관'), ' 및 ', h('a', { href: '#/privacy', target: '_blank' }, '개인정보처리방침'), '에 동의합니다. (만 14세 미만은 보호자 동의 필요)') : null,
    err, h('button', { class: 'btn' }, reg ? '가입하기' : '로그인'),
    h('p', { class: 'small' }, reg ? h('a', { href: '#/login' }, '이미 계정이 있나요?') : [h('a', { href: '#/register' }, '회원가입'), ' · ', h('a', { href: '#/forgot' }, '비밀번호 찾기')]),
  );
  return h('div', { class: 'auth' },
    h('div', { class: 'side' }, h('span', { class: 'eyebrow', style: 'align-self:flex-start' }, 'MockTest Lab'), h('h2', {}, reg ? '실전처럼 연습하고, 바로 확인하세요' : '다시 오신 걸 환영해요'), h('p', {}, 'MAP · CAT4 · WIDA 온라인 모의고사')), f);
}
function pageForgot() {
  const msg = h('p', { class: 'muted' });
  const f = h('form', { class: 'card narrow', onsubmit: guard(async (e) => { e.preventDefault(); await api('POST', '/auth/forgot', { email: f.email.value }); msg.textContent = '가입된 이메일이면 재설정 링크를 보냈습니다.'; }) },
    h('h2', {}, '비밀번호 찾기'), field('이메일', h('input', { name: 'email', type: 'email', required: true })), h('button', { class: 'btn' }, '링크 보내기'), msg);
  mount(f);
}
function pageReset(token) {
  const f = h('form', { class: 'card narrow', onsubmit: guard(async (e) => { e.preventDefault(); await api('POST', '/auth/reset', { token, password: f.password.value }); toast('변경되었습니다. 로그인해 주세요.'); location.hash = '#/login'; }) },
    h('h2', {}, '새 비밀번호'), field('새 비밀번호 (8자 이상)', h('input', { name: 'password', type: 'password', minlength: 8, required: true })), h('button', { class: 'btn' }, '변경'));
  mount(f);
}

async function pageMe() {
  if (!me) return (location.hash = '#/login');
  const [ov, ord] = await Promise.all([api('GET', '/me/overview'), api('GET', '/orders')]);
  const start = guard(async (type) => { const r = await api('POST', '/attempts', { examType: type }); location.hash = `#/exam/${r.id}`; });
  const statusBadge = (s) => h('span', { class: 'badge ' + (s === 'graded' ? 'ok' : s === 'submitted' ? 'warn' : '') }, { in_progress: '진행 중', submitted: '채점 대기', graded: '완료' }[s] || s);
  const prof = h('form', { class: 'row', onsubmit: guard(async (e) => { e.preventDefault(); await api('PATCH', '/auth/me', { name: prof.name.value, grade: prof.grade.value, phone: prof.phone.value }); me.name = prof.name.value; renderNav(); toast('저장되었습니다.'); }) },
    h('input', { name: 'name', class: 'grow', value: me.name, required: true }), h('input', { name: 'grade', class: 'grow', value: me.grade || '', placeholder: '학년' }), h('input', { name: 'phone', class: 'grow', value: me.phone || '', placeholder: '연락처' }), h('button', { class: 'btn sm' }, '저장'));
  const pw = h('form', { class: 'row', onsubmit: guard(async (e) => { e.preventDefault(); await api('POST', '/auth/password', { current: pw.cur.value, next: pw.nxt.value }); pw.reset(); toast('비밀번호가 변경되었습니다.'); }) },
    h('input', { name: 'cur', type: 'password', class: 'grow', placeholder: '현재 비밀번호', required: true }), h('input', { name: 'nxt', type: 'password', class: 'grow', placeholder: '새 비밀번호 (8자 이상)', minlength: 8, required: true }), h('button', { class: 'btn sm alt' }, '변경'));
  const charts = ['MAP', 'CAT4'].map((t) => ({ t, pts: ov.attempts.filter((a) => a.exam_type === t && a.status === 'graded' && a.score?.overall != null).reverse().map((a) => ({ v: a.score.overall, t: a.finished_at })) }))
    .filter((x) => x.pts.length >= 2).map((x) => growthChart(x.pts, x.t));
  const del = h('form', { class: 'row', onsubmit: guard(async (e) => { e.preventDefault(); if (!confirm('정말 탈퇴하시겠습니까? 되돌릴 수 없습니다.')) return; await api('POST', '/auth/delete', { password: del.pw.value }); me = null; renderNav(); toast('탈퇴가 완료되었습니다.'); location.hash = '#/'; }) },
    h('input', { name: 'pw', type: 'password', class: 'grow', placeholder: '비밀번호 확인', required: true }), h('button', { class: 'btn sm danger' }, '탈퇴하기'));
  const refund = guard(async (o) => { const reason = prompt('환불 사유를 입력해 주세요 (선택)') ; if (reason === null) return; await api('POST', `/orders/${o.id}/request-refund`, { reason }); toast('환불 요청이 접수되었습니다.'); pageMe(); });
  mount(
    h('h2', {}, `안녕하세요, ${me.name}님`),
    h('div', { class: 'card' }, h('h3', {}, '내 이용권'), ov.entitlements.length ? h('table', {}, h('tr', {}, h('th', {}, '상품'), h('th', {}, '남은 횟수'), h('th', {}, '만료'), h('th', {})),
      ov.entitlements.map((e) => h('tr', {}, h('td', {}, e.title), h('td', {}, `${e.remaining}/${e.attempts_total}`), h('td', {}, e.expired ? h('span', { class: 'badge bad' }, '만료') : date(e.expires_at)),
        h('td', {}, e.remaining > 0 && !e.expired ? h('button', { class: 'btn sm', onclick: () => start(e.exam_type) }, '시험 시작') : null)))) : h('p', { class: 'muted' }, '이용권이 없습니다. ', h('a', { href: '#/' }, '시험 상품 보러가기'))),
    ov.attempts.some((a) => a.status === 'in_progress') ? h('div', { class: 'card' }, h('b', {}, '진행 중인 시험이 있습니다. '), ov.attempts.filter((a) => a.status === 'in_progress').map((a) => h('a', { class: 'btn sm', href: `#/exam/${a.id}` }, `${a.exam_type} 이어서 풀기`))) : null,
    h('div', { class: 'card' }, h('h3', {}, '응시 기록'), ov.attempts.length ? h('table', {}, ov.attempts.map((a) => h('tr', {}, h('td', {}, a.exam_type), h('td', {}, date(a.started_at)), h('td', {}, statusBadge(a.status)),
      h('td', {}, a.status !== 'in_progress' ? h('a', { href: `#/report/${a.id}` }, '리포트') : null)))) : h('p', { class: 'muted' }, '아직 응시 기록이 없습니다.')),
    h('div', { class: 'card' }, h('h3', {}, '결제 내역'), ord.orders.length ? h('table', {}, ord.orders.map((o) => h('tr', {}, h('td', {}, o.title), h('td', {}, money(o.amount, o.currency)), h('td', {}, date(o.paid_at || o.created_at)), h('td', {}, h('span', { class: 'badge ' + (o.status === 'paid' ? 'ok' : 'bad') }, { paid: '결제완료', refunded: '환불', failed: '실패' }[o.status] || o.status)),
      h('td', {}, o.status === 'paid' && o.provider !== 'admin' ? (o.refund_status === 'pending' ? h('span', { class: 'badge warn' }, '환불 검토중') : o.refund_status === 'rejected' ? h('span', { class: 'badge' }, '환불 거절됨') : h('button', { class: 'btn sm alt', onclick: () => refund(o) }, '환불 요청')) : null)))) : h('p', { class: 'muted' }, '결제 내역이 없습니다.')),
    charts.length ? h('div', { class: 'card' }, h('h3', {}, '성적 추이 (종합 추정 점수)'), h('div', { class: 'grid' }, charts)) : null,
    h('div', { class: 'card' }, h('h3', {}, '회원 정보'), prof, h('h3', {}, '비밀번호 변경'), pw),
    h('div', { class: 'card' }, h('h3', {}, '회원 탈퇴'), h('p', { class: 'muted small' }, '탈퇴하면 응시 기록·답안·녹음이 삭제되고 계정 정보가 익명화됩니다. 결제 기록은 법령에 따라 5년간 보관됩니다.'), del),
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

/* ---------- exam runner ---------- */
async function pageExam(id) {
  if (!me) return (location.hash = '#/login');
  let state = await api('GET', `/attempts/${id}/current`);
  let lastSection = -1, offset = 0, listens = 0, rec = null;
  const render = () => {
    clearInterval(timerInt); speechSynthesis?.cancel?.();
    if (state.status === 'finished') { location.hash = `#/report/${id}`; return; }
    offset = state.serverNow - Date.now();
    const q = state.question, sec = state.section;
    if (sec.index !== lastSection) { // section intro
      lastSection = sec.index;
      return mount(h('div', { class: 'card intro' }, h('div', { class: 'big' }, { listening: '🎧', speaking: '🎙', writing: '✍️', math: '➗', reading: '📖', language: '🔤', verbal: '💬', quantitative: '🔢', nonverbal: '🔷', spatial: '🧊' }[sec.key] || '📝'),
        h('span', { class: 'badge' }, `Section ${sec.index + 1} / ${sec.total}`), h('h2', {}, sec.name),
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
      if (q.kind === 'audio' && ans.blob) { const r = await fetch(`/api/attempts/${id}/audio`, { method: 'PUT', headers: { 'content-type': ans.blob.type || 'audio/webm' }, body: ans.blob }); if (!r.ok) throw new Error('녹음 업로드 실패'); body.audioKey = (await r.json()).audioKey; }
      state = await api('POST', `/attempts/${id}/answer`, body); busy = false; render();
    });
    const body = [];
    if (q.kind === 'mcq' && sec.key === 'listening') {
      const play = h('button', { class: 'btn alt', onclick: () => { if (listens >= 2) return toast('최대 2번까지 들을 수 있습니다.'); listens++; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(q.passage); u.lang = 'en-US'; u.rate = 0.9; speechSynthesis.speak(u); play.textContent = `▶ 다시 듣기 (${2 - listens}회 남음)`; } }, '▶ 듣기 (최대 2회)');
      body.push(h('div', { class: 'passage' }, play));
    } else if (q.passage) body.push(h('div', { class: 'passage' }, q.passage));
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
        rec.start(); rb.textContent = '⏹ 녹음 종료'; st.textContent = '녹음 중…';
      }) }, '🎙 녹음 시작');
      body.push(rb, st);
    }
    const next = h('button', { class: 'btn lg', disabled: q.kind === 'mcq', onclick: () => submit(false) }, '다음 →');
    const tot = state.progress.total || state.progress.n;
    mount(h('div', { class: 'exam-shell' },
      h('div', { class: 'exam-top' },
        h('div', { class: 'exam-head' }, h('div', { class: 'sec-pill' }, sec.name, h('i', {}, `${sec.index + 1}/${sec.total}`)), h('span', { class: 'muted small' }, `문항 ${state.progress.n} / ${tot}`), h('span', {}, '⏱ ', timer)),
        h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(((state.progress.n - 1) / tot) * 100)}%` }))),
      h('div', { class: 'qcard' }, body, h('div', { class: 'exam-foot' }, h('span', { class: 'kbd' }, q.kind === 'mcq' ? '키보드 A–D 선택 · Enter 다음' : ''), next))));
    if (kh) { window._kh = kh; document.addEventListener('keydown', kh); } // after mount(), which clears the previous handler
    tick(); timerInt = setInterval(tick, 500);
  };
  render();
}

/* ---------- report ---------- */
async function pageReport(id) {
  if (!me) return (location.hash = '#/login');
  const r = await api('GET', `/attempts/${id}/report`);
  const sc = r.score, t = r.attempt.exam_type;
  const ns = 'http://www.w3.org/2000/svg', C = 2 * Math.PI * 54;
  const ring = (pct, big, small, color) => {
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 128 128'); svg.setAttribute('width', '128'); svg.setAttribute('height', '128');
    for (const [stroke, off] of [['var(--line-2)', 0], [color, C * (1 - Math.max(0.02, pct) / 100)]]) {
      const c = document.createElementNS(ns, 'circle'); for (const [k, v] of Object.entries({ cx: 64, cy: 64, r: 54, fill: 'none', stroke, 'stroke-width': 11, 'stroke-linecap': 'round', 'stroke-dasharray': C, 'stroke-dashoffset': off })) c.setAttribute(k, v); svg.append(c);
    }
    return h('div', { class: 'ring' }, svg, h('div', { class: 'c' }, h('b', {}, big), h('span', {}, small)));
  };
  const accent = { MAP: 'var(--map)', CAT4: 'var(--cat4)', WIDA: 'var(--wida)' }[t];
  const cards = Object.values(sc.sections).map((s) => {
    const big = t === 'MAP' ? (s.scaleScore ?? '-') : t === 'CAT4' ? (s.sas ?? '-') : (s.level ?? (s.graded === false ? '대기' : '-'));
    const small = t === 'MAP' ? 'RIT 유사' : t === 'CAT4' ? `스태나인 ${s.stanine ?? '-'}` : 'Level (1–6)';
    const pct = s.total ? s.pct : t === 'WIDA' && s.level ? (s.level / 6) * 100 : 0;
    return h('div', { class: 'ring-card' }, h('div', { class: 'muted small' }, s.name), ring(pct, big, small, accent),
      s.total ? h('div', { class: 'small' }, `${s.correct}/${s.total} 정답 · ${s.pct}%`) : h('div', { class: 'small muted' }, s.graded === false ? '교사 채점 대기 중' : '교사 채점'), s.band ? h('span', { class: 'badge' }, s.band) : null);
  });
  const comp = sc.composites ? h('p', { class: 'muted' }, `Oral ${sc.composites.oral ?? '-'} · Literacy ${sc.composites.literacy ?? '-'}`) : null;
  const overallLabel = { MAP: '종합 추정 점수', CAT4: '종합 SAS (추정)', WIDA: 'Overall Level' }[t];
  const overallVal = t === 'WIDA' ? sc.composites?.overall : sc.overall;
  const items = r.items.map((it, i) => h('div', { class: 'card ' + (it.correct === 1 ? 'good' : it.correct === 0 ? 'wrong' : '') },
    h('div', { class: 'small muted' }, `#${i + 1} · ${it.section} · 난이도 ${it.difficulty}`),
    it.passage ? h('div', { class: 'passage' }, it.passage) : null,
    it.image_svg ? h('img', { class: 'qimg', src: svgUri(it.image_svg), alt: '' }) : null, h('b', {}, it.stem),
    it.kind === 'mcq' ? h('div', {}, it.choices.map((c, j) => h('div', { class: 'choice' + (j === it.answer ? ' sel' : '') }, h('b', {}, 'ABCDEFGH'[j]), choiceNode(c), j === it.choice ? h('span', { class: 'badge ' + (j === it.answer ? 'ok' : 'bad') }, '내 답') : null, j === it.answer ? h('span', { class: 'badge ok' }, '정답') : null)), it.explanation ? h('p', { class: 'small muted' }, `해설: ${it.explanation}`) : null)
      : h('div', {}, it.text ? h('div', { class: 'passage' }, it.text) : h('p', { class: 'muted' }, '(녹음 응답)'), h('p', {}, it.manual_score ? `교사 점수: ${it.manual_score}/6` : '채점 대기 중', it.feedback ? ` · ${it.feedback}` : ''))));
  mount(
    h('div', { class: 'score-hero' },
      h('div', {}, h('div', { class: 'muted small' }, `${r.student.name} · ${date(r.attempt.finished_at)}`), h('h2', {}, `${r.attempt.title} 결과`), comp,
        sc.pendingManual ? h('span', { class: 'badge warn' }, '쓰기/말하기 채점 후 종합 점수가 표시됩니다') : null,
        h('p', { class: 'muted small noprint' }, h('button', { class: 'btn sm alt', onclick: () => window.print() }, '인쇄 / PDF 저장'))),
      h('div', { style: 'text-align:right' }, h('div', { class: 'muted small' }, overallLabel), h('div', { class: 'total' }, overallVal ?? '–'))),
    h('div', { class: 'rings' }, cards),
    h('p', { class: 'small muted' }, '※ 모의고사 결과는 공식 점수가 아닌 추정치이며 학습 참고용입니다.'),
    h('h3', {}, '문항별 리뷰'), items);
}

/* ---------- admin ---------- */
const ADMIN_TABS = [['stats', '대시보드'], ['users', '회원'], ['orders', '주문'], ['products', '상품'], ['questions', '문제'], ['grading', '채점']];
async function pageAdmin(tab = 'stats') {
  if (!me || me.role !== 'admin') return (location.hash = '#/');
  const body = h('div', {});
  mount(h('h2', {}, '관리자'), h('div', { class: 'tabs' }, ADMIN_TABS.map(([k, l]) => h('button', { class: k === tab ? 'on' : '', onclick: () => (location.hash = `#/admin/${k}`) }, l))), body);
  await ({ stats: adminStats, users: adminUsers, orders: adminOrders, products: adminProducts, questions: adminQuestions, grading: adminGrading }[tab] || adminStats)(body);
}
async function adminStats(b) {
  const s = await api('GET', '/admin/stats');
  b.append(h('div', { class: 'stats' }, [['회원', s.users], ['결제 주문', s.paidOrders], ['응시', s.attempts], ['채점 대기', s.pendingGrading], ['환불 요청', s.pendingRefunds], ['활성 문제', s.questions], ...s.revenue.map((r) => [`매출 ${r.currency}`, money(r.s, r.currency)])].map(([l, v]) => h('div', { class: 'stat' }, h('div', { class: 'muted small' }, l), h('b', {}, v)))));
}
async function adminUsers(b) {
  const q = h('input', { placeholder: '이메일/이름 검색', class: 'grow' }); const list = h('div', {});
  const load = guard(async () => {
    const { users } = await api('GET', '/admin/users?q=' + encodeURIComponent(q.value));
    list.replaceChildren(h('table', {}, h('tr', {}, ['이름', '이메일', '권한', '상태', '가입일', ''].map((x) => h('th', {}, x))), users.map((u) => h('tr', {},
      h('td', {}, u.name), h('td', {}, u.email), h('td', {}, u.role), h('td', {}, h('span', { class: 'badge ' + (u.status === 'active' ? 'ok' : 'bad') }, u.status)), h('td', {}, date(u.created_at)),
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
      h('button', { class: 'btn sm alt', onclick: guard(async () => { await api('PATCH', '/admin/users/' + id, { role: d.user.role === 'admin' ? 'student' : 'admin' }); close(); pageAdmin('users'); }) }, d.user.role === 'admin' ? '관리자 해제' : '관리자 지정'),
      h('button', { class: 'btn sm danger', onclick: guard(async () => { if (confirm('이 회원과 모든 기록을 삭제할까요?')) { await api('DELETE', '/admin/users/' + id); close(); pageAdmin('users'); } }) }, '삭제')),
    h('h4', {}, '이용권 수동 지급'), h('div', { class: 'row' }, sel, h('button', { class: 'btn sm', onclick: guard(async () => { await api('POST', `/admin/users/${id}/grant`, { productId: sel.value }); close(); userDetail(id); }) }, '지급')),
    h('h4', {}, '이용권'), h('table', {}, d.entitlements.map((e) => h('tr', {}, h('td', {}, e.exam_type), h('td', {}, `${e.attempts_used}/${e.attempts_total}`), h('td', {}, date(e.expires_at)), h('td', {}, e.revoked ? '회수됨' : '')))),
    h('h4', {}, '주문'), h('table', {}, d.orders.map((o) => h('tr', {}, h('td', {}, o.title), h('td', {}, o.provider), h('td', {}, money(o.amount, o.currency)), h('td', {}, o.status)))),
    h('h4', {}, '응시'), h('table', {}, d.attempts.map((a) => h('tr', {}, h('td', {}, a.exam_type), h('td', {}, date(a.started_at)), h('td', {}, a.status), h('td', {}, h('a', { href: `#/report/${a.id}`, onclick: close }, '리포트'))))),
    h('p', {}, h('button', { class: 'btn alt sm', onclick: close }, '닫기'))));
  document.body.append(m);
}
async function adminOrders(b) {
  const { orders } = await api('GET', '/admin/orders');
  b.append(h('p', {}, h('a', { class: 'btn sm alt', href: '/api/admin/orders.csv' }, 'CSV 내보내기')), h('table', {}, h('tr', {}, ['일시', '회원', '상품', '수단', '금액', '상태', ''].map((x) => h('th', {}, x))), orders.map((o) => h('tr', {},
    h('td', {}, date(o.created_at)), h('td', {}, `${o.name} (${o.email})`), h('td', {}, o.title), h('td', {}, o.provider), h('td', {}, money(o.amount, o.currency)), h('td', {}, o.status),
    h('td', {}, o.refund_status === 'pending' ? h('div', { class: 'small' }, h('span', { class: 'badge warn' }, '환불요청'), ` ${o.refund_reason || ''} `, h('button', { class: 'btn sm alt', onclick: guard(async () => { await api('POST', `/admin/refund-requests/${o.refund_id}/reject`); pageAdmin('orders'); }) }, '거절')) : null,
      o.status === 'paid' && o.provider !== 'admin' ? h('button', { class: 'btn sm danger', onclick: guard(async () => { if (confirm('PG사에 환불을 요청하고 이용권을 회수합니다. 진행할까요?')) { await api('POST', `/admin/orders/${o.id}/refund`); toast('환불 완료'); pageAdmin('orders'); } }) }, '환불') : null)))));
}
async function adminProducts(b) {
  const { products } = await api('GET', '/admin/products');
  const edit = (p = { exam_type: 'MAP', title: '', description: '', price_krw: 19000, price_usd_cents: 1400, attempts: 1, valid_days: 90, active: 1, sort: 0 }) => {
    const f = h('form', { class: 'card', onsubmit: guard(async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(f)); await api('POST', '/admin/products', { ...d, id: p.id, active: !!d.active }); pageAdmin('products'); }) },
      h('div', { class: 'row' }, field('시험', h('select', { name: 'exam_type', value: p.exam_type }, ['MAP', 'CAT4', 'WIDA'].map((x) => h('option', { selected: x === p.exam_type }, x)))), field('상품명', h('input', { name: 'title', value: p.title, required: true })), field('정렬', h('input', { name: 'sort', type: 'number', value: p.sort }))),
      field('설명', h('input', { name: 'description', value: p.description })),
      h('div', { class: 'row' }, field('가격(원)', h('input', { name: 'price_krw', type: 'number', value: p.price_krw })), field('가격(USD 센트)', h('input', { name: 'price_usd_cents', type: 'number', value: p.price_usd_cents })), field('응시 횟수', h('input', { name: 'attempts', type: 'number', value: p.attempts })), field('유효기간(일)', h('input', { name: 'valid_days', type: 'number', value: p.valid_days }))),
      h('label', {}, h('input', { type: 'checkbox', name: 'active', checked: !!p.active, style: 'width:auto' }), ' 판매 중'), h('button', { class: 'btn sm' }, '저장'));
    b.replaceChildren(f);
  };
  b.append(h('p', {}, h('button', { class: 'btn sm', onclick: () => edit() }, '+ 새 상품')), h('table', {}, products.map((p) => h('tr', {}, h('td', {}, p.exam_type), h('td', {}, p.title), h('td', {}, `${money(p.price_krw, 'KRW')} / ${money(p.price_usd_cents, 'USD')}`), h('td', {}, `${p.attempts}회/${p.valid_days}일`), h('td', {}, p.active ? '판매중' : '중지'), h('td', {}, h('button', { class: 'btn sm alt', onclick: () => edit(p) }, '수정'))))));
}
const SECTIONS = { MAP: ['reading', 'language', 'math'], CAT4: ['verbal', 'quantitative', 'nonverbal', 'spatial'], WIDA: ['listening', 'reading', 'writing', 'speaking'] };
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
        choices: d.kind === 'mcq' ? d.choices.split('\n').map((x) => x.trim()).filter(Boolean) : null, answer: d.kind === 'mcq' ? (+d.answer) - 1 : null };
      await api(id ? 'PUT' : 'POST', '/admin/questions' + (id ? '/' + id : ''), body); toast('저장됨'); pageAdmin('questions');
    }) },
      h('div', { class: 'row' }, field('시험', h('select', { name: 'exam_type' }, Object.keys(SECTIONS).map((x) => h('option', { selected: x === q.exam_type }, x)))), field('영역(section key)', h('input', { name: 'section', value: q.section })), field('유형', h('select', { name: 'kind' }, ['mcq', 'text', 'audio'].map((x) => h('option', { selected: x === q.kind }, x)))), field('난이도(1-5)', h('input', { name: 'difficulty', type: 'number', min: 1, max: 5, value: q.difficulty }))),
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
async function adminGrading(b) {
  const { items } = await api('GET', '/admin/grading');
  if (!items.length) return b.append(h('p', { class: 'muted' }, '채점할 답안이 없습니다.'));
  b.append(items.map((it) => {
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
    ['제2조 (서비스 내용)', '회사는 MAP, CAT4, WIDA 형식을 참고해 자체 제작한 연습용 모의고사를 제공합니다. 본 서비스는 NWEA, GL Assessment, WIDA와 제휴·승인 관계가 없으며, 제공되는 점수는 학습 참고용 추정치이고 공식 점수가 아닙니다.'],
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
    ['3. 보유 기간', '회원 탈퇴 시 지체 없이 파기합니다. 단, 전자상거래법에 따라 계약·결제 기록 5년, 소비자 불만·분쟁 기록 3년은 보관합니다.'],
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
  const [path, qs] = (location.hash.slice(1) || '/').split('?'); const q = Object.fromEntries(new URLSearchParams(qs || ''));
  const seg = path.split('/').filter(Boolean);
  try {
    if (!seg.length) return await pageHome();
    switch (seg[0]) {
      case 'login': return mount(authForm('login'));
      case 'register': return mount(authForm('register'));
      case 'forgot': return pageForgot();
      case 'reset': return pageReset(seg[1]);
      case 'me': return await pageMe();
      case 'exam': return await pageExam(seg[1]);
      case 'report': return await pageReport(seg[1]);
      case 'admin': return await pageAdmin(seg[1]);
      case 'terms': case 'privacy': case 'refund': return pageLegal(seg[0]);
      case 'pay': return seg[1] === 'success' ? await pagePaySuccess(q) : mount(h('div', { class: 'card' }, h('h2', {}, '결제가 취소되었습니다.'), h('a', { class: 'btn', href: '#/' }, '돌아가기')));
      default: return mount(h('div', { class: 'card' }, h('h2', {}, '페이지를 찾을 수 없습니다.')));
    }
  } catch (e) {
    if (e.status === 401) { me = null; renderNav(); location.hash = '#/login'; return; }
    mount(h('div', { class: 'card' }, h('h2', { class: 'err' }, '오류'), h('p', {}, e.message), h('a', { class: 'btn alt', href: '#/' }, '처음으로')));
  }
}
window.addEventListener('hashchange', route);
(async () => {
  try { me = (await api('GET', '/auth/me')).user; } catch {}
  try { cfg = await api('GET', '/config'); const b = cfg.biz; document.getElementById('bizinfo').textContent = `${b.name} · 대표 ${b.owner} · 사업자등록번호 ${b.regNo} · 통신판매업 ${b.salesNo} · ${b.address} · ${b.contact}`; } catch {}
  renderNav();
  const po = new URLSearchParams(location.search).get('portone_order'); // mobile redirect return
  if (po) { history.replaceState(null, '', '/'); location.hash = `#/pay/success?order=${po}&provider=portone`; }
  route();
})();
