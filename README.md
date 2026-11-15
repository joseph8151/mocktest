# MockTest Lab — MAP · CAT4 · CogAT · SCAT · SSAT · ISEE · SAT · TOEFL Junior · WIDA 모의고사 사이트

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
- 테이블과 샘플 문제/상품은 **첫 요청에서 Worker가 스스로 생성**합니다(`src/lib/bootstrap.js`). 수동 마이그레이션·시드가 필요 없습니다.
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
