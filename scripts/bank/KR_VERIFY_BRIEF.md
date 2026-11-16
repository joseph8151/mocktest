# Brief: blind verification of a new 레테 bank

You are an independent reviewer. A different writer produced the bank file you are given. Your job is to find every
item that a student could not answer with exactly one defensible choice, and anything not fit for the stated age.

## Procedure (do not look at answers/explanations until step 3)
1. Read the items blind: `node scripts/blind-view.mjs <bank.json> <start> <count>` (prints passages, stems and
   choices without answers). Items with a figure say `[FIGURE …]`: render that item's `image_svg` and LOOK at it
   (Playwright + Chromium are installed: `require('playwright')`, deviceScaleFactor 1; write a tiny script under
   /tmp/claude-0/-home-user-mocktest/d898e36e-7fe1-52c6-830c-3a83458ae374/scratchpad/verify/ that extracts the SVG by
   index with `node -e` and screenshots it). Solve every item yourself. For math, compute (script any counting).
2. Save your answers as JSON `{ "0": "B", "1": "A", "7": "32", … }` (letters for multiple choice, the number for
   `kind:"num"`) in the scratchpad, then run `node scripts/compare-blind.mjs <bank.json> <answers.json>`.
3. Only now open the key for the items that disagree and decide, item by item, whether the key is wrong, the item is
   ambiguous (two defensible answers / missing information / figure does not match the text), or you were wrong.
4. Also flag (even if you agreed with the key): factual errors in passages or explanations, a figure inconsistent
   with its stem/explanation, Korean spelling/spacing errors that change meaning, content clearly too hard or too easy
   for the stated age (difficulty 1=7세 … 6=12세), anything that looks copied from a real published test,
   and anything inappropriate for children.

## Output
- Write `scripts/bank/<same name>.drop.json`: a JSON array of the item INDICES that must not be used
  (wrong key, ambiguous, broken figure, factual error, inappropriate). For a passage problem, drop every item of
  that passage. Do not edit the bank file itself and touch no other file.
- Final message: agreement count (x / n), every dropped index with a one-line reason, and minor issues you did not
  drop (index + note).
