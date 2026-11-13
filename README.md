# MockTest Lab — MAP · CAT4 · SCAT · SSAT · ISEE · WIDA 모의고사 사이트

Cloudflare Workers(Hono) + D1(SQLite) + 정적 SPA. 회원가입 → 결제(Stripe / 포트원) → **이용권 자동 지급** → 온라인 응시 → 자동 채점 리포트.

## 기능
- **회원**: 가입/로그인(PBKDF2 해시, HttpOnly 세션 쿠키), 비밀번호 변경/재설정(이메일), 프로필, 응시·결제 내역
- **결제**: Stripe Checkout(USD) + 포트원 V2(KRW). 웹훅 서명 검증 + 금액 서버 검증 + 멱등 처리 → 결제 즉시 이용권 지급. 관리자 환불(PG 취소 + 이용권 회수)
- **시험**: 서버가 한 문항씩 출제(정답은 클라이언트에 전달되지 않음), 영역별 타이머(서버 검증), 새로고침/재접속 시 이어풀기
  - **MAP 스타일**: 적응형(정답→어려워지고 오답→쉬워짐), RIT 유사 추정점수
  - **CAT4 스타일**: 언어·수리·비언어·공간 4영역, SAS/스태나인 추정
  - **SCAT 스타일**: Verbal(유추) · Quantitative(수량 비교), 영역별 척도 점수(200–300) 추정
  - **SSAT 스타일**: Writing(교사 채점) · Quantitative · Reading · Verbal, 척도 점수(440–710) 합산
  - **ISEE 스타일**: Verbal · Quantitative · Reading · Math · Essay, 척도 점수(760–940)·스태나인 추정
  - **WIDA 스타일**: Listening(TTS 2회) · Reading 자동채점, Writing · Speaking(녹음→R2) 교사 채점, 가중 종합 레벨
- **리포트**: 영역별 점수, 문항별 해설, 인쇄/PDF 저장, 결과 이메일
- **안전/개인정보**: 로그인 무차별 대입 차단(15분에 8회), 회원 본인 탈퇴(답안·녹음 삭제, 결제기록은 익명화 후 5년 보관), 환불 요청 → 관리자 승인/거절, 성적 추이 그래프
- **관리자**: 대시보드, 회원 관리(정지/삭제/권한/이용권 수동 지급), 주문·환불, 상품 CRUD, 문제은행 CRUD + JSON 대량등록, 쓰기/말하기 채점 큐, 환불요청 처리, 주문 CSV 내보내기

> 문제는 형식만 참고해 새로 만든 **오리지널 샘플**(약 700문항, 그래프·도형은 SVG로 직접 생성: `scripts/svgcharts.mjs`)이며 NWEA/GL Assessment/WIDA와 무관합니다. 점수는 공식 점수가 아닌 추정치입니다. 실제 서비스 전에 문제은행을 확충하세요(관리자 > 문제 > JSON 대량 등록).

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
`ADMIN_EMAIL`이 비어 있으면 **가장 먼저 가입한** 계정이 관리자가 됩니다.

## Cloudflare 배포 (설정 최소화)
GitHub 연동(Workers Builds)이든 터미널이든 **배포 명령은 `npx wrangler deploy` 하나**입니다.

- 필요한 리소스는 **D1 하나뿐**이며 `wrangler.jsonc`에 ID를 적지 않으면 **배포 시 자동 생성**됩니다(auto-provisioning). 말하기 녹음도 D1에 저장하므로 R2가 필요 없습니다(녹음 1건 약 1.2MB 이하).
- 테이블과 샘플 문제/상품은 **첫 요청에서 Worker가 스스로 생성**합니다(`src/lib/bootstrap.js`). 수동 마이그레이션·시드가 필요 없습니다.
- `SITE_URL`이 비어 있으면 접속 주소에서 자동으로 알아냅니다(커스텀 도메인 연결 후에도 그대로 동작).
- **관리자**: `ADMIN_EMAIL`이 비어 있으면 **가장 먼저 가입한 계정이 관리자**가 됩니다 → 배포 직후 바로 본인 계정으로 가입하세요. 이후 `ADMIN_EMAIL`을 지정하면 그 이메일만 관리자 가입이 가능합니다.

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
`wrangler.jsonc`의 `MAIL_FROM`, `PORTONE_STORE_ID`, `PORTONE_CHANNEL_KEY`, `BIZ_*`(사업자 정보)를 채우세요.

> 자동 생성이 권한 문제로 실패하면 수동으로 만들고 `wrangler.jsonc`의 D1 항목에 `database_id`를 적으면 됩니다: `npx wrangler d1 create mocktest`.
> 기존 DB가 `wrangler d1 migrations apply`로 이미 만들어져 있어도 자동 구성 코드가 이를 감지해 충돌하지 않습니다.

### 웹훅 등록
- **Stripe**: `https://<도메인>/api/webhooks/stripe` — 이벤트 `checkout.session.completed`, `checkout.session.async_payment_succeeded`
- **포트원 V2**: `https://<도메인>/api/webhooks/portone` — `Transaction.Paid`, 시크릿은 `PORTONE_WEBHOOK_SECRET`

웹훅이 늦어도 결제 완료 페이지가 서버에서 PG 조회로 재확인하므로 이용권은 누락 없이 지급됩니다.

### GitHub 자동 배포
Cloudflare 대시보드 → Workers & Pages → Create → Connect to Git → 이 저장소 선택 (빌드 명령 없음, 배포 명령 `npx wrangler deploy`).

## 운영 전 체크리스트
- 이용약관/개인정보처리방침/환불규정은 **템플릿**입니다. 법률 검토 후 `public/app.js`의 `LEGAL`을 수정하고, `wrangler.jsonc`의 `BIZ_*` 사업자 정보를 채우세요 (푸터·약관에 자동 표시)
- 한국 판매 시 통신판매업 신고 및 PG 계약(포트원 채널 키)
- 로그인 제한은 앱 내장(D1)이며, 추가로 Cloudflare Rate Limiting/Turnstile 적용 권장
- 문제은행 확충 및 난이도 보정(응시 데이터 기반)
