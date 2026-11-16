# Brief: 국어 문해력 / 수학 사고력 레테 — second bank per age band

You are adding ORIGINAL questions to the Korean level-test (레테) question bank of the MockTest Lab site
(repo root: /home/user/mocktest). Real academy level tests are the *model for question TYPES, format and
difficulty only* — never reproduce, paraphrase or reconstruct an actual academy question, passage or
copyrighted text. Every passage and item must be newly written by you.

## Output
Write ONE JSON array to the file you are assigned (e.g. `scripts/bank/kr-kor-9-10-b.json`). Do not edit any
other file. Item schema (same as the existing `kr-*.json` banks — open the matching existing file first and
match its style, length and difficulty):

```json
{ "exam_type": "KR_KOR" | "KR_MATH", "section": "...", "difficulty": 1-6,
  "passage": "(reading items only; identical string for every item of one passage)",
  "stem": "...", "choices": ["4 distinct options"], "answer": 0-3, "explanation": "한국어 해설 (왜 정답인지, 함정은 무엇인지)",
  "image_svg": "<svg ...>…</svg>  (optional, figures/graphs/tables-as-pictures)",
  "kind": "num"  // optional: short numeric answer; then "choices" = accepted answers like ["32"], no "answer" field
}
```
- Age → difficulty: 7세=1, 8세=2, 9세=3, 10세=4, 11세=5, 12세=6. Each item's difficulty must fit that age exactly.
- Answer positions balanced across A–D (roughly 25% each). Distractors plausible, exactly one defensible answer.
- No item may duplicate or near-duplicate an existing item in `scripts/bank/kr-*.json`.
- Korean must be natural, age-appropriate, correctly spaced (띄어쓰기) and spelled.

## SVG rules (all pictures, graphs, charts, grids, 쌓기나무, 전개도, 도형 must be inline SVG in `image_svg`)
- `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H" width="W" height="H" font-family="sans-serif">`, W ≤ 640.
- font-size ≥ 12, stroke-width ≥ 2 for main lines, black/grey/one accent colour (#b31942 or #0a1f44) only.
- The picture must be EXACTLY consistent with the question and answer (counts, lengths, labels). Draw with
  computed coordinates; for counting problems (삼각형 개수, 쌓기나무 개수, 경로 수 …) VERIFY by brute force in a
  small node script before writing the answer. Choices may also be pictures: a choice string starting with
  `svg:` followed by an `<svg …>` element is rendered as an image (keep those small, ~160×120).
- Render-check: `node -e` is available; Playwright + Chromium are installed (`require('playwright')`) if you
  want to screenshot an SVG and look at it (deviceScaleFactor 1, save under /tmp/claude-0/.../scratchpad).

## When done
1. `node scripts/passage-stats.mjs scripts/bank/<your file>` must report "all items structurally valid";
   paste its counts line in your final message.
2. Final message: file path, item counts per section/difficulty, how you verified math answers, and any item
   you are unsure about (by index) — be honest, a separate reviewer will blind-solve everything.

## 국어 문해력 (KR_KOR) — sections: `nonfiction`, `literature`, `vocab` (no writing items)
Model the TYPES on 독서·논술 학원 레벨테스트 (기파랑 계열) and 문해력 학원 레벨테스트 (지니국어 계열):
- nonfiction (비문학, 4 items per passage): 설명문·논설문·기사문·안내문, 과학/사회/역사/생활 주제. Mix item types:
  중심 생각·주제, 세부 내용 일치/불일치, 글의 구조·설명 방법(비교·대조·예시·분류·인과·과정), 문단 요약·순서,
  추론(글에 직접 없지만 알 수 있는 것), 사실과 의견 구분, 접속어 넣기, 자료 해석. At least 2 passages per age come
  with a 표·그래프·그림 (SVG) that the questions require (지니국어식 "글+자료 함께 읽기").
- literature (문학, 4 items per passage): 동화·소설 장면, 동시(7–9세), 시(10–12세), 수필, 옛이야기/우화. Item types:
  인물의 마음·성격·변화, 사건의 까닭, 배경(때·곳)의 역할, 말하는 이/서술자, 비유·의인·반복 같은 표현,
  분위기, 주제·교훈, 뒷이야기 추론, 감상이 알맞은 친구 고르기(기파랑식).
- vocab (어휘·어법, stand-alone, no passage): 문맥 속 낱말 뜻, 다의어, 유의어·반의어, 속담·관용 표현, 한자어 뜻(11–12세),
  맞춤법·띄어쓰기, 높임 표현, 문장 호응(주어-서술어, 시제), 알맞은 이어 주는 말, 낱말의 짜임.
- Passage length by age (characters, no spaces): 7세 250–350, 8세 350–500, 9세 500–700, 10세 700–950,
  11세 950–1,300, 12세 1,300–1,900. Use \n\n between paragraphs; 동시/시는 행·연 구분.
- Per age you write: 4 nonfiction passages (16 items) + 4 literature passages (16 items) + 20 vocab items.

## 수학 사고력 (KR_MATH) — sections: `number` (수·연산 감각), `geometry` (도형·공간), `pattern` (규칙·추론), `problem` (문제해결)
Model the TYPES on 사고력 수학 학원 레벨테스트 (필즈·소마·황소 계열):
- 필즈식: 수 감각과 연산 원리 (어림, 자릿값, 연산 기호 넣기, 마방진·수 배열, 계산 순서 바꿔 빨리 계산하기).
- 소마식: 퍼즐형·공간 사고 (쌓기나무 개수/위·앞·옆 모양, 전개도와 주사위, 도형 자르기·붙이기, 펜토미노/칠교,
  거울·회전, 길 찾기·경우의 수, 성냥개비, 크고 작은 도형 개수 세기, 논리 퍼즐/참·거짓).
- 황소식: 문장제 문제해결 (조건 여러 개를 동시에 만족하는 수 찾기, 거꾸로 풀기, 표 만들어 풀기, 나이·시계·달력·
  속력·비율(12세), 규칙을 식으로 일반화, 최대·최소).
- ≥ 70% of geometry items and ≥ 30% of pattern items need an SVG figure; graphs/표 as SVG where natural.
- Mix ≈ 70% multiple choice, 30% `kind:"num"` short answers (integers only).
- Grade level: stay inside what that age can reason about (7세: 20까지의 수, 덧셈·뺄셈 기초 / 12세: 분수·소수 연산,
  비와 비율, 넓이·부피, 경우의 수) but the thinking should be one step beyond the school textbook.
- Per age you write: 12 items in EACH of the 4 sections (48 items per age).
- Every answer must be verified (show the check in your head or a node script; for counting/figures always script).
