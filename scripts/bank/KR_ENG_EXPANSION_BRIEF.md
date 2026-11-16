# Brief: 영어 레테 (KR_ENG) — second bank per age

You are adding ORIGINAL items to the English level-test (영어 레테) bank of MockTest Lab (repo /home/user/mocktest).
Korean English-academy entrance tests are the model for format and difficulty only; never reproduce or paraphrase
a real test item or any published/copyrighted text. Every passage and item is newly written by you.

## Spec (from the site owner)
- Ages and target reading level: 9세 SR 3.5 (difficulty 1), 10세 SR 4.5 (difficulty 2), 11세 SR 5.5 (difficulty 3),
  12세 SR 6.5 (difficulty 4). SR = US grade-level reading (3.5 = grade 3, 5th month).
- Reading passages 350–400 words, mix fiction and nonfiction; content based on the US elementary curriculum
  (Common Core ELA, plus science/social-studies topics of that grade). Flesch-Kincaid grade of each passage within
  ±0.8 of the age's SR (check with `node scripts/passage-stats.mjs <file>`, which prints words and FK per passage).
- Sections: `reading` (5 questions per passage: main idea/theme, key detail, inference, vocabulary in context,
  text structure/author's purpose, character/point of view, compare/sequence), `vocab` (stand-alone: context clues,
  synonyms/antonyms, prefixes/suffixes/roots, multiple-meaning words, idioms appropriate to the grade),
  `grammar` (stand-alone: verb tense, subject–verb agreement, pronouns, adjectives/adverbs, comparatives,
  conjunctions, prepositions, punctuation/capitalization, sentence fragments/run-ons, relative pronouns at 11–12).
- No writing items (those sections are switched off).

## Output
ONE JSON array in the file you are assigned (e.g. `scripts/bank/kr-eng-10-b.json`); touch no other repo file.
Item schema (open the matching existing `scripts/bank/kr-eng-<age>.json` first and match style and difficulty; avoid its topics):
`{ "exam_type": "KR_ENG", "section": "reading"|"vocab"|"grammar", "difficulty": 1-4, "passage": "(reading only, identical string for all 5 items of a passage, paragraphs separated by \n\n)", "stem": "...", "choices": [4 distinct], "answer": 0-3, "explanation": "English explanation, 1–2 sentences" }`
- Per age: 6 passages × 5 reading items (3 fiction, 3 nonfiction) + 30 vocab + 30 grammar = 90 items.
- Exactly one defensible answer; plausible distractors; answer positions balanced (≈25% each, no long runs).
- No duplicates or near-duplicates of any item in `scripts/bank/kr-eng-*.json` (grep your stems/answers).
- American English spelling; age-appropriate, inclusive content; no brand names.

## When done
`node scripts/passage-stats.mjs <your file>` must report "all items structurally valid" and every passage within
350–400 words and the FK target. Final message: file, counts, the words/FK line per passage, and any item you are
unsure about (index + why). Keep helper scripts in your own scratchpad subfolder
/tmp/claude-0/-home-user-mocktest/d898e36e-7fe1-52c6-830c-3a83458ae374/scratchpad/<your-name>/ (shared scratchpad). Do not commit.
