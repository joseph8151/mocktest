# MockTest Lab — MAP · CAT4 · CogAT · SCAT · SSAT · ISEE · SAT · TOEFL Junior · TOEIC Bridge · WIDA 모의고사 사이트

Cloudflare Workers(Hono) + D1(SQLite) + 정적 SPA. 회원가입 → 결제(Stripe / 포트원) → **이용권 자동 지급** → 온라인 응시 → 자동 채점 리포트.

## 기능
- **회원**: 가입/로그인(PBKDF2 해시, HttpOnly 세션 쿠키), 비밀번호 변경/재설정(이메일), 프로필, 응시·결제 내역
- **결제**: Stripe Checkout(USD) + 포트원 V2(KRW). 웹훅 서명 검증 + 금액 서버 검증 + 멱등 처리 → 결제 즉시 이용권 지급. 관리자 환불(PG 취소 + 이용권 회수)
- **시험**: 정답은 클라이언트에 전달되지 않음, 영역별 타이머(서버 검증), 새로고침/재접속 시 이어풀기. 응시 시작 시 **학년/레벨 선택**(학년을 입력해 두면 자동 추천)
  - **MAP Growth 스타일**: K · G1 … G12 학년별, 적응형(한 문항씩, **뒤로 가기 없음**), Rasch 기반 RIT 추정 + 학년 규준 백분위
  - **CAT4 스타일**: Level A · B/C · D · E–G, 언어·수리·비언어·공간 → SAS·백분위·스태나인, 언어–공간 성향(bias)
  - **CogAT 스타일**: Level 7–8 · 9–11 · 12–14 · 15–17/18, Verbal · Quantitative · Nonverbal → SAS·스태나인 + 능력 프로필(예: 6B (V+))
  - **SCAT 스타일**: Elementary · Intermediate · Advanced, Verbal · Quantitative, 레벨별 척도 점수
  - **SSAT 스타일**: Elementary(300–600) · Middle(440–710) · Upper(500–800). Middle/Upper는 실제처럼 **정답 +1, 오답 −¼, 무응답 0** 공식 채점
  - **ISEE 스타일**: Lower · Middle · Upper, Verbal · Quantitative · Reading · Math → 760–940 척도·스태나인, Essay는 점수 미포함
  - **SAT 스타일**: PSAT 8/9(240–1440) · PSAT 10(320–1520) · SAT(400–1600), 10점 단위, Math에 **주관식(grid-in)** 포함, PSAT 선발지수
  - **TOEFL 스타일**: Primary Step 1 · Step 2(100–115) · Junior Standard(200–300, 합산 600–900, CEFR)
  - **WIDA 스타일**: 1 · 2–3 · 4–5 · 6–8 · 9–12학년, 1.0–6.0 레벨, Oral · Literacy · Comprehension · Overall 복합 점수
  - **문항 이동**: 비적응형 시험은 실제 시험처럼 **현재 영역 안에서 자유 이동**(이전/다음, 문항 번호판, 표시하기, 답 지우기, 건너뛰기). 영역 제출 후에는 수정 불가, 남은 문항은 무응답 처리
- **리포트**: 영역별 점수, 문항별 해설, 인쇄/PDF 저장, 결과 이메일
- **안전/개인정보**: 로그인 무차별 대입 차단(15분에 8회), 회원 본인 탈퇴(답안·녹음 삭제, 결제기록은 익명화 후 5년 보관), 환불 요청 → 관리자 승인/거절, 성적 추이 그래프
- **관리자**: 대시보드, 회원 관리(정지/삭제/권한/이용권 수동 지급), 주문·환불, 상품 CRUD, 문제은행 CRUD + JSON 대량등록, 쓰기/말하기 채점 큐, 환불요청 처리, 주문 CSV 내보내기

> 문제는 형식만 참고해 새로 만든 **오리지널 샘플**(약 1,950문항. 그래프·도형은 SVG로 직접 생성: `scripts/svgcharts.mjs`, 독해·어휘 등은 `scripts/bank/*.json`에 작성 후 블라인드 검증)이며 NWEA/GL Assessment/WIDA와 무관합니다. 점수는 공식 점수가 아닌 추정치입니다. 실제 서비스 전에 문제은행을 확충하세요(관리자 > 문제 > JSON 대량 등록).

## 로컬 실행
```bash
npm install
npm run db:migrate:local
npm run seed:gen && npm run db:seed:local
cp .dev.vars.example .dev.vars   # 키 입력 (비워도 로컬 동작; 결제만 비활성)
npm run dev                      # http://localhost:8787
npm test                         # 단위 테스트
npm run test:e2e                 # dev 서버 켜 둔 상태에서 E2E (결제 웹훅 시뮬레이션 포함, .dev.vars에 STRIPE_WEBHOOK_SECRET=whsec_test 필요)
```
`ADMIN_EMAIL`이 비어 있으면 관리자가 **한 명도 없을 때 처음 가입한** 계정이 관리자가 됩니다.

## Cloudflare 배포 (설정 최소화)
GitHub 연동(Workers Builds)이든 터미널이든 **배포 명령은 `npx wrangler deploy` 하나**입니다.

- 필요한 리소스는 **D1 하나뿐**이며 `wrangler.jsonc`에 ID를 적지 않으면 **배포 시 자동 생성**됩니다(auto-provisioning). 말하기 녹음도 D1에 저장하므로 R2가 필요 없습니다(녹음 1건 약 1.2MB 이하).
- 테이블과 상품은 **첫 요청에서 Worker가 스스로 생성**하고, 문제은행(`public/_seed/seed.json`, 방문자에게는 404로 차단)은 새 버전이 배포되면 **백그라운드에서** 동기화합니다(`src/lib/bootstrap.js`). 요청이 동기화를 기다리지 않습니다.
- `SITE_URL`이 비어 있으면 접속 주소에서 자동으로 알아냅니다(커스텀 도메인 연결 후에도 그대로 동작).
- **관리자**: `ADMIN_EMAIL`이 비어 있으면 관리자가 없을 때 **처음 가입한 계정이 관리자**가 됩니다 → 배포 직후 바로 본인 계정으로 가입하세요. `ADMIN_EMAIL`을 지정하면 관리자가 없을 때 그 이메일만 관리자가 될 수 있습니다. 마지막 관리자는 강등·정지할 수 없습니다.

```bash
npx wrangler login
npx wrangler deploy
```

선택 사항(결제·이메일을 쓸 때): Workers → mocktest → Settings → Variables and Secrets에 시크릿 추가
```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put PORTONE_API_SECRET
npx wrangler secret put PORTONE_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY
```
`MAIL_FROM`, `BIZ_*`(사업자 정보)도 대시보드의 Variables에 Text로 넣으세요(`wrangler.jsonc`에 적으면 배포 때마다 대시보드 값을 덮어씁니다). `PORTONE_STORE_ID`, `PORTONE_CHANNEL_KEY`, `KCP_SITE_CD` 같은 일반 값은 대시보드의 Variables에 **Text**로 넣으면 됩니다(`keep_vars: true`라 배포해도 지워지지 않음). API 시크릿은 **Secret**으로 넣으세요.

> 자동 생성이 권한 문제로 실패하면 수동으로 만들고 `wrangler.jsonc`의 D1 항목에 `database_id`를 적으면 됩니다: `npx wrangler d1 create mocktest`.
> 기존 DB가 `wrangler d1 migrations apply`로 이미 만들어져 있어도 자동 구성 코드가 이를 감지해 충돌하지 않습니다.

### 웹훅 등록
- **Stripe**: `https://<도메인>/api/webhooks/stripe` — 이벤트 `checkout.session.completed`, `checkout.session.async_payment_succeeded`
- **포트원 V2**: `https://<도메인>/api/webhooks/portone` — `Transaction.Paid`, 시크릿은 `PORTONE_WEBHOOK_SECRET`

웹훅이 늦어도 결제 완료 페이지가 서버에서 PG 조회로 재확인하므로 이용권은 누락 없이 지급됩니다.

### GitHub 자동 배포
Cloudflare 대시보드 → Workers & Pages → Create → Connect to Git → 이 저장소 선택 (빌드 명령 없음, 배포 명령 `npx wrangler deploy`).

## 이메일 (Resend)
1. resend.com 가입 → Domains → 내 도메인 추가 → 안내된 DNS 레코드(SPF·DKIM)를 Cloudflare DNS에 추가 → Verified 확인
2. API Keys → Create (Sending access) → Cloudflare 대시보드 Variables and Secrets에 `RESEND_API_KEY`(Secret)
3. `MAIL_FROM`(Text) = `MockTest Lab <noreply@내도메인>`
4. 관리자 > 결제설정 > 이메일 카드의 **테스트 메일 보내기**로 확인 (실패하면 Resend의 오류 메시지가 그대로 표시됨)

도메인 인증 전에는 Resend 테스트 주소(onboarding@resend.dev)로 **Resend 계정 본인 이메일에만** 보낼 수 있습니다.

## 결제 (KCP · 포트원 · Stripe)
| 방식 | 필요한 값 | 비고 |
|---|---|---|
| **포트원 경유 KCP** (권장) | `PORTONE_STORE_ID`, `PORTONE_CHANNEL_KEY`(대시보드 Text 변수) + `PORTONE_API_SECRET`, `PORTONE_WEBHOOK_SECRET`(secret) | 포트원 콘솔에서 PG사를 **NHN KCP**로 채널 등록. 카드·가상계좌·계좌이체·휴대폰 지원, 가상계좌는 입금 웹훅으로 자동 지급 |
| **KCP 직접** | `KCP_SITE_CD`, `KCP_CERT_INFO`(secret), 운영 전환 시 `KCP_MODE=prod` | 코드는 `src/lib/kcp.js` 한 파일. **KCP 공식 가이드로 필드명/URL/pay_method 코드 검증 필요**(아래 참고) |
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | 해외 카드(USD) |

- 일반 고객에게는 원화 결제 수단이 **하나**(KCP 직접이 설정돼 있으면 KCP, 아니면 포트원)만 보이고, **관리자에게는 설정된 모든 수단**이 보입니다.
- 관리자 > **결제설정** 탭에서 연동 상태와 웹훅/Ret_URL 주소를 확인하세요. 홈에서 관리자에게만 보이는 **“[관리자 전용] 결제 테스트 1,000원”** 상품으로 실제 결제·환불을 시험해 볼 수 있습니다.
- KCP 직접 연동은 KCP 서버에 접근할 수 없는 환경에서 **자체 모의 서버**로만 검증했습니다(`npm run test:e2e`의 `kcp.e2e.mjs`). 계약 후 받는 공식 개발 가이드(developer.kcp.co.kr)와 KCP 테스트 몰(site_cd `T0000`)로 아래를 확인하세요: 거래등록/승인/취소 URL(`KCP_REGISTER_URL`·`KCP_APPROVE_URL`·`KCP_CANCEL_URL`로 덮어쓰기 가능), 요청·응답 필드명, `pay_method` 코드, 결제창 호출 방식(`kcpForm`). 입금 통보 처리가 검증되지 않아 **KCP 직접 연동에서는 가상계좌를 막아 두었습니다**(가상계좌는 포트원 경유로 사용).

## 학습 기능
- **시험 안내 페이지**(`#/info/<시험>`): 구성·시간·채점 방식·점수 해석·준비 팁 (공개)
- **무료 샘플 5문항**(`#/sample/<시험>`): 로그인 없이 풀고 해설 확인 (공개). 샘플 전용 문항(전체의 약 20%)은 유료 응시에 출제되지 않습니다
- **오답노트**(`#/mistakes`): 틀린 문제를 모아 해설과 함께 복습
- **결과 분석**: 난이도별 정답률, 영역별 풀이 시간, 보완 영역 안내, 점수 해석

## 결제 안정성
- 웹훅이 누락돼도 고객은 **마이페이지 > 결제 내역 > 결제 확인**으로 재조회할 수 있고, 관리자는 주문 탭의 **재확인**으로 처리합니다.
- 포트원 가상계좌는 **입금 대기** 상태로 두었다가 입금 웹훅이 오면 이용권을 지급합니다. 3일이 지난 미완료 결제는 자동으로 만료 처리됩니다.
- 금액이 다른 결제는 이용권을 주지 않고 PG사에도 **자동 취소**를 요청합니다.
- 웹훅 처리 중 오류가 나면 결제사가 재시도하도록 5xx를 돌려주며(중복 이벤트로 오인하지 않음), 모바일 리디렉션 결제 실패 사유를 화면에 보여 줍니다.

## 테스트
```bash
npm test                 # 단위 테스트
npm run test:e2e         # wrangler dev 실행 후: 응시·결제·KCP·안전 기능 종단 테스트
```
결제 종단 테스트(`kcp.e2e.mjs`, `pay.e2e.mjs`)는 자체 **모의 결제사 서버**를 띄우므로 `.dev.vars`에 다음이 필요합니다(로컬 전용, 커밋 금지):
`KCP_SITE_CD`, `KCP_CERT_INFO`, `KCP_REGISTER_URL`/`KCP_APPROVE_URL`/`KCP_CANCEL_URL`(→ `http://localhost:9099/...`), `PORTONE_STORE_ID`, `PORTONE_CHANNEL_KEY`, `PORTONE_API_SECRET`, `PORTONE_WEBHOOK_SECRET`(`whsec_<base64>`), `PORTONE_API_BASE`·`STRIPE_API_BASE`(→ `http://localhost:9098`), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET=whsec_test`.

## 문제 품질 관리
- 손으로 쓴 문항(`scripts/bank/*.json`)과 코드로 생성한 문항(숫자·그래프·도형 SVG)은 **정답을 가린 채 별도 검수자가 직접 풀어** 정답과 대조했습니다(`scripts/blind-view.mjs`, `scripts/compare-blind.mjs`, `scripts/compare-review.mjs`).
- 결함으로 판정된 문항은 `scripts/bank/*.drop.json` / `_generated.drop.json`으로 제외하고, 생성기 자체의 결함(모호한 수 유추, 부동소수점 잡음, 보이지 않는 회전 등)은 코드에서 고쳤습니다.
- `REVIEW_DIR=<폴더> node scripts/gen-seed.mjs`로 검수용 세트(텍스트 JSON + 그림 갤러리)를 내보낼 수 있고, `REVIEW_SKIP=<id목록.json>`으로 이미 검수한 문항은 제외합니다.

## 보안
**항상 켜져 있는 보호**
- 보안 헤더: CSP(외부 스크립트는 https만, 인라인 스크립트 차단), HSTS, 클릭재킹 차단(`frame-ancestors 'none'`/`X-Frame-Options`), nosniff, Referrer-Policy, Permissions-Policy (`public/_headers` + API 미들웨어)
- CSRF: 상태를 바꾸는 요청은 같은 출처만 허용(웹훅·KCP 리턴 제외, 서명/서버 승인으로 검증), 세션 쿠키 HttpOnly·SameSite=Lax·Secure
- 요청 횟수 제한(D1): 로그인 15분 8회, 가입 IP당 시간 30회, 비밀번호 찾기 IP 10회·이메일 3회/시간, 쿠폰 확인·결제 생성·환불 요청·2단계 인증·공유 링크 열람
- 비밀번호 정책: 8자 이상, 영문+숫자/기호, 흔한 비밀번호·이메일 아이디 포함 금지 (PBKDF2-SHA256 해시)
- 요청 크기 제한(일반 256KB, 녹음 1.3MB, 문제 대량 등록 8MB)
- 관리자 세션 12시간 만료, 권한 변경 시 해당 회원 재로그인
- 결제 금액은 항상 서버가 계산·검증(쿠폰 포함), 웹훅 서명 검증, 금액 불일치 자동 취소
- 답안 저장은 응시자 본인만, 주관식 정답 비노출, 진행 중 응시는 시험당 하나(`0007_integrity.sql`)
- 감사 로그: 관리자 변경 작업·데이터 내보내기·로그인·비밀번호·2단계 인증 기록(관리자 > 보안)

**켜서 쓰는 보호**
- **2단계 인증(TOTP)**: 내 시험 → 로그인 보안. 관리자는 꼭 켜세요(대시보드에 경고 표시). 켜면 다른 기기는 로그아웃됩니다.
- **로그인된 기기 관리**: 기기별 로그아웃, 다른 기기 모두 로그아웃
- **봇 차단(Cloudflare Turnstile)**: Cloudflare 대시보드 → Turnstile에서 위젯을 만들고 `TURNSTILE_SITE_KEY`(Text), `TURNSTILE_SECRET`(Secret)을 넣으면 가입·비밀번호 찾기에 적용됩니다.
- 추가 권장: Cloudflare WAF 관리형 규칙, Bot Fight Mode

## 기록 보존
- **활동 기록**(관리자 > 기록): 가입, 로그인 성공·실패(잠금·정지 포함), 로그아웃, 비밀번호·회원정보 변경, 2단계 인증, 기기 로그아웃, 시험 시작·영역 제출·종료(점수), 녹음 제출, 리포트 공유·중지·열람, 결제 시작·완료·실패(사유)·환불, 환불 요청, 그리고 관리자의 모든 변경(바뀐 내용, 비밀값 제외)과 데이터 내보내기. 검색(이메일·IP·ID·내용)·분류·기간 필터, CSV 다운로드.
- **변조 방지**: `audit_log`는 DB 트리거로 삭제·수정이 막혀 있습니다(`migrations/0009_records.sql`). 탈퇴 시 이메일 표시만 `(탈퇴회원)`으로 가릴 수 있습니다.
- **삭제 대신 보존**: 회원 탈퇴·관리자 삭제는 개인정보(이름·이메일·연락처·녹음)만 지우고 응시 결과·답안·결제·활동 기록은 익명으로 남깁니다. 문제·상품은 비활성화, 공유 링크는 중지 표시로 남습니다.
- 회원은 내 시험 → 로그인 보안 → **내 활동 기록**에서 자신의 기록을 볼 수 있고, 관리자는 회원 상세에서 그 회원의 기록을 봅니다.
- 법정 보관: 결제 기록 5년(전자상거래법), 관리자 접속 기록 1년 이상(개인정보 안전성 확보조치 기준) — 이 사이트는 기간 제한 없이 보관합니다. 처리방침에 보관 항목·기간을 적어 두세요.

## 국내 레벨테스트 (레테) 카테고리
미국 시험과 완전히 분리된 카테고리입니다. 홈(미국 시험)에는 나오지 않고, 상단 메뉴 **레테**와 카테고리 탭(미국 시험 | 국내 레테)으로만 들어갑니다(`#/kr`).

| 시험 | 레벨 | 구성 | 가격(1회 / 3회) |
|---|---|---|---|
| 영어 레테 (`KR_ENG`) | 9세 SR 3.5 · 10세 SR 4.5 · 11세 SR 5.5 · 12세 SR 6.5 | Reading 15(350–400단어 지문 3개, 픽션·논픽션) · Vocabulary 15 · Grammar 15 · Writing Creative 1 · Expository 1(교사 채점) | 47,000 / 119,000 |
| 국어 문해력 레테 (`KR_KOR`) | 7–12세 | 비문학 8 · 문학 8 · 어휘·어법 10 · 서술형 1(교사 채점). 지문 7세 250–350자 → 12세 1,550–1,900자 | 39,000 / 99,000 |
| 수학 사고력 레테 (`KR_MATH`) | 7–12세 | 수·연산 감각 · 도형·공간 · 규칙·추론 · 문제해결 각 6(객관식+단답형, 도형 그림) | 43,000 / 109,000 |

- 문항은 미국 교과(Common Core) 기반 영어, 초등 교과 연계 국어·수학을 바탕으로 **모두 새로 창작**했고(학원 문항 복제 없음), 전 문항을 블라인드 검수했습니다(영어 384 · 국어 323 · 수학 335문항).
- 레벨 = 나이. 각 나이 문항으로만 출제하며, 문항이 부족한 레벨은 “준비 중”으로 표시되어 시작할 수 없습니다. 문항이 없는 시험은 판매 목록에 나오지 않습니다.
- 결과: 영역별 100점 환산, 영어는 **추정 SR**과 반 판정(상위 반 추천 · 입학 기준 충족(정답률 70%) · 보강 후 입학 · 한 단계 아래), 국어·수학은 **최상위·상위·중위·기본·기초** 판정과 추천 과정, 보완 영역.
- 새 문항 은행은 `scripts/bank/_pending.json`에 올려 두면 검수 전까지 시드에서 제외됩니다.

## 회원·법적 보호
- **이메일 인증**: Resend가 연결되어 있으면 가입 시 인증 메일을 보내고, 인증 전에는 결제·응시가 막힙니다(재발송 버튼). 메일 서비스가 없으면 인증을 요구하지 않습니다. 기존 회원은 인증된 것으로 처리됩니다.
- **만 14세 미만 보호자 동의**(개인정보 보호법 제22조의2): 가입 시 “만 14세 미만”을 고르면 보호자 이메일로 동의 링크를 보냅니다. 보호자가 성함·관계를 적고 동의하면 기록(`guardian_consents`)이 남고 결제·응시가 열립니다. 전화 등으로 확인한 경우 관리자가 확인 방법을 적어 수동 처리할 수 있습니다. 부모님 계정에서 만든 **자녀 프로필**은 그 자체로 보호자 동의로 기록됩니다.
- **계정 공유 방지**: 한 계정은 최대 3대 기기까지 로그인(4번째 로그인 시 가장 오래된 기기 로그아웃). 시험은 시작한 기기에서만 진행되며, 다른 기기에서 열면 “이 기기에서 이어서 보기” 확인 후 넘어가고 기기 전환이 기록됩니다.
- **부정행위 감지**: 시험 중 다른 창·앱으로 이동, 복사 시도, 전체 화면 해제를 기록해 리포트(학부모 공유 리포트·선생님 화면 포함)에 표시합니다. 시험 문제는 복사·우클릭이 막혀 있습니다.
- **로그인 응답 시간 균일화**(가입 여부 추측 방지), **보안 규칙(CSP)**: 외부 스크립트는 포트원·KCP·Cloudflare Turnstile 주소만 허용. 실제 결제창이 막히면 `public/_headers`의 `script-src`에 해당 PG 주소를 추가하세요.
- **백업**: 관리자 > 보안 > 전체 백업(JSON, 녹음 제외, 다운로드 기록 남음). D1은 Cloudflare가 30일간 시점 복구(Time Travel)를 제공합니다: `npx wrangler d1 time-travel restore mocktest --timestamp=<시각>`.

## 가족·학원
- **자녀 프로필**(내 시험 → 자녀 프로필): 부모 계정 하나로 자녀 최대 6명. 부모가 결제한 이용권을 자녀에게 나눠 주고, “이 프로필로 전환”하면 자녀가 직접 응시합니다(돌아올 때 부모 비밀번호 필요). 자녀 결과 메일은 부모에게 갑니다.
- **학원·기관(선생님 계정)**: 관리자가 회원 권한을 “선생님”으로 바꾸면 **내 반**에서 반을 만들고 6자리 코드를 학생에게 줍니다. 학생은 내 시험 → 학원·반 참여에서 코드 입력. 선생님은 학생별 최근 결과·남은 이용권·시험 중 이탈 기록을 보고, 구매한 이용권을 선택한 학생에게 나눠 줍니다. 학생이 반을 나가면 선생님은 더 이상 성적을 볼 수 없습니다.
- 나눠 준 이용권은 원래 주문에 묶여 있어, 원 주문을 환불하면 함께 회수됩니다.

## 매출·학습 기능
- **선물하기**: 결제창에서 “선물하기”를 고르면 이용권 대신 `GIFT-XXXX-XXXX` 코드가 이메일로 옵니다. 받는 사람이 내 시험 → 선물 코드 등록. 관리자는 이벤트용 코드를 대량 발급·취소할 수 있습니다(관리자 > 선물코드).
- **영역별 연습**(상단 “연습”): 구매한(또는 받은) 시험의 영역·난이도를 골라 10문항씩 시간 제한 없이 풀고 즉시 채점·해설. 이용권 차감 없음, 리포트에서 “약한 영역 연습하기”로 바로 연결.
- **또래 비교**: 리포트 각 영역에 “같은 레벨 n명 중 상위 x%” 표시(같은 시험·레벨 응시 10명 이상일 때, 사이트 응시자 기준).
- **1:1 문의**(상단 “문의”): 분류(결제·환불, 시험·채점, 계정, 기관·단체, 기타)별 문의, 관리자 답변 시 이메일 알림(관리자 > 문의).
- **통계 그래프**: 관리자 대시보드에 최근 30일 매출·결제·가입·응시 막대그래프, 전환(가입→인증→구매→재구매), 시험별 매출.

## 카카오
- **카카오 로그인**: developers.kakao.com → 애플리케이션 추가 → 카카오 로그인 활성화, Redirect URI에 `https://<도메인>/api/auth/kakao/callback`, 동의항목에서 닉네임·**카카오계정(이메일)** 설정. REST API 키를 `KAKAO_REST_KEY`(Text), Client Secret을 쓰면 `KAKAO_CLIENT_SECRET`(Secret). 같은 이메일의 기존 계정은 자동 연결됩니다(2단계 인증 계정은 이메일 로그인만).
- **카카오 알림톡(SOLAPI)**: 카카오 비즈니스 채널 + SOLAPI 가입 → 발신 프로필(pfId) 연결 → 템플릿 2개 검수(결과 알림: `#{이름}` `#{시험}` `#{링크}`, 결제 알림: `#{이름}` `#{상품}` `#{금액}` `#{링크}`). `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`(Secret), `SOLAPI_SENDER`, `KAKAO_PFID`, `ALIMTALK_TPL_RESULT`, `ALIMTALK_TPL_PAID`. 회원정보의 연락처(자녀는 부모 연락처)로 발송됩니다. **SOLAPI 공개 문서 기준으로 작성했고 실제 채널로는 검증하지 못했습니다** — 첫 발송을 확인하세요.

## 추가 기능
- **쿠폰**(관리자 > 쿠폰): 정률(최대 90%)·정액, 시험 지정, 사용 횟수·만료일. 결제창에서 적용하면 할인가로 주문이 만들어지고, 결제 완료 시 사용 횟수가 올라갑니다.
- **리포트 공유 링크**: 리포트 하단에서 학부모·선생님용 읽기 전용 링크(14일, 언제든 중지, 이메일 비표시)
- **오답 다시 풀기**: 오답노트 → 다시 풀기 모드(정답 표시 없이 다시 풀고 즉시 채점·해설)
- **사이트 공지 배너**: 관리자 > 대시보드에서 작성(방문자는 닫을 수 있음)

## 관리자 체험
관리자는 결제 없이 모든 시험을 응시할 수 있습니다(마이페이지 > 관리자 체험 응시, 횟수 제한 없음).

## 운영 전 체크리스트
- 이용약관/개인정보처리방침/환불규정은 **템플릿**입니다. 법률 검토 후 `public/app.js`의 `LEGAL`을 수정하고, `wrangler.jsonc`의 `BIZ_*` 사업자 정보를 채우세요 (푸터·약관에 자동 표시)
- 한국 판매 시 통신판매업 신고 및 PG 계약(포트원 채널 키)
- 로그인 제한은 앱 내장(D1)이며, 추가로 Cloudflare Rate Limiting/Turnstile 적용 권장
- 문제은행 확충 및 난이도 보정(응시 데이터 기반)
