# MockTest Lab — MAP · CAT4 · WIDA 모의고사 사이트

Cloudflare Workers(Hono) + D1(SQLite) + R2 + 정적 SPA. 회원가입 → 결제(Stripe / 포트원) → **이용권 자동 지급** → 온라인 응시 → 자동 채점 리포트.

## 기능
- **회원**: 가입/로그인(PBKDF2 해시, HttpOnly 세션 쿠키), 비밀번호 변경/재설정(이메일), 프로필, 응시·결제 내역
- **결제**: Stripe Checkout(USD) + 포트원 V2(KRW). 웹훅 서명 검증 + 금액 서버 검증 + 멱등 처리 → 결제 즉시 이용권 지급. 관리자 환불(PG 취소 + 이용권 회수)
- **시험**: 서버가 한 문항씩 출제(정답은 클라이언트에 전달되지 않음), 영역별 타이머(서버 검증), 새로고침/재접속 시 이어풀기
  - **MAP 스타일**: 적응형(정답→어려워지고 오답→쉬워짐), RIT 유사 추정점수
  - **CAT4 스타일**: 언어·수리·비언어·공간 4영역, SAS/스태나인 추정
  - **WIDA 스타일**: Listening(TTS 2회) · Reading 자동채점, Writing · Speaking(녹음→R2) 교사 채점, 가중 종합 레벨
- **리포트**: 영역별 점수, 문항별 해설, 인쇄/PDF 저장, 결과 이메일
- **관리자**: 대시보드, 회원 관리(정지/삭제/권한/이용권 수동 지급), 주문·환불, 상품 CRUD, 문제은행 CRUD + JSON 대량등록, 쓰기/말하기 채점 큐

> 문제는 형식만 참고해 새로 만든 **오리지널 샘플**(약 300문항)이며 NWEA/GL Assessment/WIDA와 무관합니다. 점수는 공식 점수가 아닌 추정치입니다. 실제 서비스 전에 문제은행을 확충하세요(관리자 > 문제 > JSON 대량 등록).

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
`ADMIN_EMAIL`(wrangler.jsonc)로 **가장 먼저 가입한** 계정이 관리자가 됩니다.

## Cloudflare 배포
```bash
npx wrangler login
npx wrangler d1 create mocktest          # 출력된 database_id를 wrangler.jsonc에 입력
npx wrangler r2 bucket create mocktest-audio
npm run db:migrate:remote && npm run db:seed:remote
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put PORTONE_API_SECRET
npx wrangler secret put PORTONE_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY   # 이메일(선택)
npm run deploy
```
`wrangler.jsonc`의 `SITE_URL`(실제 도메인), `ADMIN_EMAIL`, `MAIL_FROM`, `PORTONE_STORE_ID`, `PORTONE_CHANNEL_KEY`를 수정하세요.

### 웹훅 등록
- **Stripe**: `https://<도메인>/api/webhooks/stripe` — 이벤트 `checkout.session.completed`, `checkout.session.async_payment_succeeded`
- **포트원 V2**: `https://<도메인>/api/webhooks/portone` — `Transaction.Paid`, 시크릿은 `PORTONE_WEBHOOK_SECRET`

웹훅이 늦어도 결제 완료 페이지가 서버에서 PG 조회로 재확인하므로 이용권은 누락 없이 지급됩니다.

### GitHub 자동 배포
Cloudflare 대시보드 → Workers & Pages → Create → Connect to Git → 이 저장소 선택 (빌드 명령 없음, 배포 명령 `npx wrangler deploy`).

## 운영 전 체크리스트
- 이용약관/개인정보처리방침/환불규정은 **템플릿**입니다. 법률 검토 후 `public/app.js`의 `LEGAL`을 수정하고, `wrangler.jsonc`의 `BIZ_*` 사업자 정보를 채우세요 (푸터·약관에 자동 표시)
- 한국 판매 시 통신판매업 신고 및 PG 계약(포트원 채널 키)
- 로그인 시도 제한(Cloudflare Rate Limiting/Turnstile) 설정 권장
- 문제은행 확충 및 난이도 보정(응시 데이터 기반)
