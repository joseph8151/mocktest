# Brief: deepen the SSAT / ISEE / SCAT question pools

You are adding ORIGINAL practice items to MockTest Lab (repo /home/user/mocktest), an online mock-test site for US
admissions tests. The real tests (SSAT by EMA, ISEE by ERB, SCAT by Johns Hopkins CTY) are the model for FORMAT and
DIFFICULTY only: never reproduce, paraphrase or reconstruct items from official guides, released tests or prep books.

## Difficulty scale (1–5) and the levels that use it
Each exam level draws questions from a band: SSAT Elementary d1–3 · Middle d2–4 · Upper d3–5; ISEE Lower d1–3 ·
Middle d2–4 · Upper d3–5; SCAT Elementary d1–3 · Intermediate d2–4 · Advanced d3–5.
Rough grade meaning: d1 ≈ grade 3–4, d2 ≈ grade 5, d3 ≈ grade 6–7, d4 ≈ grade 8, d5 ≈ grade 9–11 (Upper-level hard).

## Output
ONE JSON array in your assigned file; touch no other repo file. Schema (look at existing items of the same exam and
section in `public/_seed/seed.json` — fields: [id, exam, section, kind, difficulty, passage, stem, image_svg, choices, answer, explanation] — and match them):
`{ "exam_type": "SSAT"|"ISEE"|"SCAT", "section": "...", "difficulty": 1-5, "stem": "...", "choices": [4 distinct], "answer": 0-3, "explanation": "1–2 sentence English explanation", "image_svg": "(optional)", "passage": "(reading only)" }`
- Exactly 4 choices, exactly one defensible answer, plausible distractors, answer positions balanced (~25% each).
- Item formats (copy the exact stem/choice wording style of existing items):
  - Synonym: `Choose the word closest in meaning to SCARCE.` (SSAT) / `Select the word whose meaning is closest to CONCEAL.` (ISEE).
  - SSAT analogy: `Bird is to nest as bee is to` with 4 word choices.  SCAT analogy: `Pilot : Airplane :: Captain : ?` with capitalized choices.
  - ISEE sentence completion: one blank `___`, 4 single-word (or two-word at d4–5) choices.
  - Quantitative comparison (ISEE quantitative d3–5, all SCAT quantitative): stem `Quantity A: …\nQuantity B: …` (optional
    centered info line first) and choices exactly `["Quantity A is greater","Quantity B is greater","The two quantities are equal","The relationship cannot be determined"]`;
    use "cannot be determined" only when it is truly undeterminable, and balance the four outcomes.
- Math: every answer verified by a node script (put it in your scratchpad folder). Grade-appropriate content per difficulty.
- Figures (geometry, coordinate graphs, bar/line charts, tables, number lines): inline SVG in `image_svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H" width="W" height="H" font-family="sans-serif">` with
  **W ≤ 400**, font-size ≥ 13, stroke ≥ 2, black/grey + one accent (#b31942 or #0a1f44), computed coordinates, figure
  exactly consistent with stem and answer ("not drawn to scale" only if stated). Render each with Playwright
  (`require('playwright')`, 320px wide) and look at it.
- No duplicates/near-duplicates of existing items (check `public/_seed/seed.json` stems and answers for the same exam+section).
- American English; age-appropriate; no brands.

## When done
`node scripts/passage-stats.mjs <your file>` must say "all items structurally valid". Final message: file, counts per
section × difficulty, how math was verified, and any item you are unsure about (index + why). Keep helper files in
/tmp/claude-0/-home-user-mocktest/d898e36e-7fe1-52c6-830c-3a83458ae374/scratchpad/<your-folder>/ (shared scratchpad). Do not commit.

## Round 2 additions: CAT4 · CogAT · WIDA · TOEFL Junior
Levels → difficulty bands: CAT4 A d1–3 · B/C d1–4 · D d2–5 · E–G d3–5; CogAT L7–8 d1–3 · L9–11 d1–4 · L12–14 d2–5 ·
L15–17 d3–5; WIDA G1 d1–2 · G2–3 d1–3 · G4–5 d2–4 · G6–8 d2–5 · G9–12 d3–5; TOEFL Primary Step 1 d1–2 · Step 2 d1–3 · Junior Standard d2–5.
- Figure items (CAT4 spatial/nonverbal, CogAT nonverbal): the question figure goes in `image_svg`; picture answer choices
  are strings `"svg:<svg …>…</svg>"` (≈120×120, W ≤ 160, same style rules). Study the existing items of that section in
  public/_seed/seed.json (they include svg: choices) and match their look. Generate shapes by code (rotations,
  reflections, folds, matrices) and VERIFY by code that exactly one choice is correct (e.g. compare normalized point sets).
- Listening items (WIDA, TOEFL Junior): the "passage" is the audio script that the browser reads aloud with
  text-to-speech; the student does not see it. Write natural spoken English (a short talk, announcement or dialogue
  with "Woman:"/"Man:" labels as in existing items), then questions answerable only from the script.
