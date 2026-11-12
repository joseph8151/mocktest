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
const mount = (...n) => { clearInterval(timerInt); speechSynthesis?.cancel?.(); $app.replaceChildren(...n.flat()); window.scrollTo(0, 0); };
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };
const examName = { MAP: 'MAP', CAT4: 'CAT4', WIDA: 'WIDA' };
const field = (label, input) => h('div', {}, h('label', {}, label), input);

function renderNav() {
  $nav.replaceChildren(...[
    h('a', { href: '#/' }, '시험 상품'),
    ...(me ? [
      h('a', { href: '#/me' }, '내 시험'),
      me.role === 'admin' ? h('a', { href: '#/admin' }, '관리자') : null,
      h('button', { onclick: guard(async () => { await api('POST', '/auth/logout'); me = null; renderNav(); location.hash = '#/'; }) }, `로그아웃 (${me.name})`),
    ] : [h('a', { href: '#/login' }, '로그인'), h('a', { href: '#/register' }, '회원가입')]),
  ].filter(Boolean));
}

/* ---------- pages ---------- */
async function pageHome() {
  const { products, payment } = await api('GET', '/products');
  const groups = { MAP: 'MAP Growth 스타일 · 적응형 (쉬우면 어려워지고, 틀리면 쉬워집니다)', CAT4: 'CAT4 스타일 · 언어/수리/비언어/공간 추론', WIDA: 'WIDA ACCESS 스타일 · 듣기/읽기/쓰기/말하기 (교사 채점)' };
  mount(
    h('section', { class: 'hero' }, h('h1', {}, 'MAP · CAT4 · WIDA 모의고사'), h('p', { class: 'muted' }, '결제 즉시 이용권이 자동 지급되고, 바로 온라인으로 응시할 수 있습니다. 시험이 끝나면 영역별 리포트가 제공됩니다.')),
    Object.entries(groups).map(([type, desc]) => h('div', {},
      h('h2', {}, type), h('p', { class: 'muted' }, desc),
      h('div', { class: 'grid' }, products.filter((p) => p.exam_type === type).map((p) => h('div', { class: 'card' },
        h('h3', {}, p.title), h('p', { class: 'muted small' }, p.description),
        h('div', { class: 'price' }, money(p.price_krw, 'KRW')), h('div', { class: 'muted small' }, `${p.attempts}회 응시 · ${p.valid_days}일 이내 사용 · ${money(p.price_usd_cents, 'USD')}`),
        h('p', {}, h('button', { class: 'btn', onclick: () => buy(p, payment) }, '구매하기')),
      ))),
    )),
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
  const f = h('form', { class: 'card narrow', onsubmit: async (e) => {
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
    reg ? h('label', {}, h('input', { type: 'checkbox', name: 'agree', required: true, style: 'width:auto' }), ' 이용약관 및 개인정보 처리방침에 동의합니다.') : null,
    err, h('button', { class: 'btn' }, reg ? '가입하기' : '로그인'),
    h('p', { class: 'small' }, reg ? h('a', { href: '#/login' }, '이미 계정이 있나요?') : [h('a', { href: '#/register' }, '회원가입'), ' · ', h('a', { href: '#/forgot' }, '비밀번호 찾기')]),
  );
  return f;
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
  mount(
    h('h2', {}, `안녕하세요, ${me.name}님`),
    h('div', { class: 'card' }, h('h3', {}, '내 이용권'), ov.entitlements.length ? h('table', {}, h('tr', {}, h('th', {}, '상품'), h('th', {}, '남은 횟수'), h('th', {}, '만료'), h('th', {})),
      ov.entitlements.map((e) => h('tr', {}, h('td', {}, e.title), h('td', {}, `${e.remaining}/${e.attempts_total}`), h('td', {}, e.expired ? h('span', { class: 'badge bad' }, '만료') : date(e.expires_at)),
        h('td', {}, e.remaining > 0 && !e.expired ? h('button', { class: 'btn sm', onclick: () => start(e.exam_type) }, '시험 시작') : null)))) : h('p', { class: 'muted' }, '이용권이 없습니다. ', h('a', { href: '#/' }, '시험 상품 보러가기'))),
    ov.attempts.some((a) => a.status === 'in_progress') ? h('div', { class: 'card' }, h('b', {}, '진행 중인 시험이 있습니다. '), ov.attempts.filter((a) => a.status === 'in_progress').map((a) => h('a', { class: 'btn sm', href: `#/exam/${a.id}` }, `${a.exam_type} 이어서 풀기`))) : null,
    h('div', { class: 'card' }, h('h3', {}, '응시 기록'), ov.attempts.length ? h('table', {}, ov.attempts.map((a) => h('tr', {}, h('td', {}, a.exam_type), h('td', {}, date(a.started_at)), h('td', {}, statusBadge(a.status)),
      h('td', {}, a.status !== 'in_progress' ? h('a', { href: `#/report/${a.id}` }, '리포트') : null)))) : h('p', { class: 'muted' }, '아직 응시 기록이 없습니다.')),
    h('div', { class: 'card' }, h('h3', {}, '결제 내역'), ord.orders.length ? h('table', {}, ord.orders.map((o) => h('tr', {}, h('td', {}, o.title), h('td', {}, money(o.amount, o.currency)), h('td', {}, date(o.paid_at || o.created_at)), h('td', {}, h('span', { class: 'badge ' + (o.status === 'paid' ? 'ok' : 'bad') }, { paid: '결제완료', refunded: '환불', failed: '실패' }[o.status] || o.status))))) : h('p', { class: 'muted' }, '결제 내역이 없습니다.')),
    h('div', { class: 'card' }, h('h3', {}, '회원 정보'), prof, h('h3', {}, '비밀번호 변경'), pw),
  );
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
      return mount(h('div', { class: 'card' }, h('h2', {}, `Section ${sec.index + 1}/${sec.total} · ${sec.name}`),
        h('p', {}, `제한 시간: 약 ${Math.max(1, Math.round((sec.deadline - state.serverNow) / 60000))}분. 시간이 끝나면 자동으로 다음 영역으로 넘어갑니다.`),
        sec.manual ? h('p', { class: 'muted' }, '이 영역은 교사가 직접 채점하며, 채점이 끝나면 이메일로 알려드립니다.') : null,
        sec.key === 'speaking' ? h('p', { class: 'muted' }, '마이크 사용 권한이 필요합니다.') : null,
        h('button', { class: 'btn', onclick: render }, '시작하기')));
    }
    let selected = null; const ans = {};
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
    body.push(h('h3', {}, q.stem));
    if (q.kind === 'mcq') {
      const boxes = q.choices.map((c, i) => { const el = h('label', { class: 'choice', onclick: () => { selected = i; boxes.forEach((b, j) => b.classList.toggle('sel', i === j)); next.disabled = false; } }, h('b', {}, 'ABCDEFGH'[i]), choiceNode(c)); return el; });
      body.push(...boxes);
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
    const next = h('button', { class: 'btn', disabled: q.kind === 'mcq', onclick: () => submit(false) }, '다음 ▶');
    mount(h('div', { class: 'card' },
      h('div', { class: 'exam-head' }, h('div', {}, h('b', {}, sec.name), h('span', { class: 'muted' }, ` · 문항 ${state.progress.n}`)), timer),
      h('hr'), body, h('p', {}, next)));
    tick(); timerInt = setInterval(tick, 500);
  };
  render();
}

/* ---------- report ---------- */
async function pageReport(id) {
  if (!me) return (location.hash = '#/login');
  const r = await api('GET', `/attempts/${id}/report`);
  const sc = r.score, t = r.attempt.exam_type;
  const cards = Object.values(sc.sections).map((s) => {
    const main = t === 'MAP' ? [s.scaleScore ?? '-', 'RIT 유사 추정'] : t === 'CAT4' ? [s.sas ?? '-', `SAS 추정 · 스태나인 ${s.stanine ?? '-'}`] : [s.level ?? (s.graded === false ? '채점 대기' : '-'), 'Proficiency Level (1–6)'];
    return h('div', { class: 'stat' }, h('div', { class: 'muted small' }, s.name), h('b', {}, main[0]), h('div', { class: 'small muted' }, main[1]),
      s.total ? h('div', {}, h('div', { class: 'bar' }, h('i', { style: `width:${s.pct}%` })), h('div', { class: 'small' }, `${s.correct}/${s.total} 정답`)) : null, s.band ? h('span', { class: 'badge' }, s.band) : null);
  });
  const comp = sc.composites ? h('p', {}, `Oral ${sc.composites.oral ?? '-'} · Literacy ${sc.composites.literacy ?? '-'} · Overall ${sc.composites.overall ?? '-'}`) : null;
  const items = r.items.map((it, i) => h('div', { class: 'card ' + (it.correct === 1 ? 'good' : it.correct === 0 ? 'wrong' : '') },
    h('div', { class: 'small muted' }, `#${i + 1} · ${it.section} · 난이도 ${it.difficulty}`),
    it.passage ? h('div', { class: 'passage' }, it.passage) : null,
    it.image_svg ? h('img', { class: 'qimg', src: svgUri(it.image_svg), alt: '' }) : null, h('b', {}, it.stem),
    it.kind === 'mcq' ? h('div', {}, it.choices.map((c, j) => h('div', { class: 'choice' + (j === it.answer ? ' sel' : '') }, h('b', {}, 'ABCDEFGH'[j]), choiceNode(c), j === it.choice ? h('span', { class: 'badge ' + (j === it.answer ? 'ok' : 'bad') }, '내 답') : null, j === it.answer ? h('span', { class: 'badge ok' }, '정답') : null)), it.explanation ? h('p', { class: 'small muted' }, `해설: ${it.explanation}`) : null)
      : h('div', {}, it.text ? h('div', { class: 'passage' }, it.text) : h('p', { class: 'muted' }, '(녹음 응답)'), h('p', {}, it.manual_score ? `교사 점수: ${it.manual_score}/6` : '채점 대기 중', it.feedback ? ` · ${it.feedback}` : ''))));
  mount(
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, `${r.attempt.title} 결과`), h('button', { class: 'btn alt noprint', onclick: () => window.print() }, '인쇄 / PDF 저장')),
      h('p', { class: 'muted' }, `${r.student.name} · ${date(r.attempt.finished_at)}`),
      sc.overall != null ? h('h3', {}, `종합: ${sc.overall}`) : null, comp,
      sc.pendingManual ? h('p', { class: 'badge warn' }, '쓰기/말하기 채점이 끝나면 종합 점수가 표시됩니다.') : null,
      h('div', { class: 'stats' }, cards),
      h('p', { class: 'small muted' }, '※ 모의고사 결과는 공식 점수가 아닌 추정치이며 학습 참고용입니다.')),
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
  b.append(h('div', { class: 'stats' }, [['회원', s.users], ['결제 주문', s.paidOrders], ['응시', s.attempts], ['채점 대기', s.pendingGrading], ['활성 문제', s.questions], ...s.revenue.map((r) => [`매출 ${r.currency}`, money(r.s, r.currency)])].map(([l, v]) => h('div', { class: 'stat' }, h('div', { class: 'muted small' }, l), h('b', {}, v)))));
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
  b.append(h('table', {}, h('tr', {}, ['일시', '회원', '상품', '수단', '금액', '상태', ''].map((x) => h('th', {}, x))), orders.map((o) => h('tr', {},
    h('td', {}, date(o.created_at)), h('td', {}, `${o.name} (${o.email})`), h('td', {}, o.title), h('td', {}, o.provider), h('td', {}, money(o.amount, o.currency)), h('td', {}, o.status),
    h('td', {}, o.status === 'paid' && o.provider !== 'admin' ? h('button', { class: 'btn sm danger', onclick: guard(async () => { if (confirm('PG사에 환불을 요청하고 이용권을 회수합니다. 진행할까요?')) { await api('POST', `/admin/orders/${o.id}/refund`); toast('환불 완료'); pageAdmin('orders'); } }) }, '환불') : null)))));
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
  renderNav();
  const po = new URLSearchParams(location.search).get('portone_order'); // mobile redirect return
  if (po) { history.replaceState(null, '', '/'); location.hash = `#/pay/success?order=${po}&provider=portone`; }
  route();
})();
