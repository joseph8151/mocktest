# Brief: TOEIC Bridge (Listening & Reading) question bank

You are writing ORIGINAL practice items for MockTest Lab (repo /home/user/mocktest), an online mock-test site.
The real TOEIC Bridge Listening & Reading test (ETS) is the model for FORMAT and DIFFICULTY only: never reproduce,
paraphrase or reconstruct items from official ETS guides, sample tests or prep books. Every script, text and item is new.

## The test
TOEIC Bridge L&R measures everyday/workplace English for beginner–intermediate learners (CEFR Pre-A1 to B1):
teens and adults in daily life, school, shops, travel, simple jobs. Topics: schedules, shopping, restaurants, transport,
weather, appointments, offices, stores, classes, events, notices, short emails/texts, ads, forms. No idioms beyond B1.
Our mock is half-length: Listening 25 questions, Reading 25 questions, drawn from these PARTS:

### Listening (section "listening") — the "passage" is the audio script; the browser reads it aloud (or plays a
recording made from it). Students do NOT see the script, only the stem and choices.
1. **Four Pictures** — passage: ONE short spoken sentence describing a picture (e.g. "The man is carrying a box.").
   stem exactly: `Choose the picture that best matches what you hear.`
   choices: 4 pictures as strings `"svg:<svg …>…</svg>"` (viewBox 0 0 120 120, width/height 120, simple clear line
   drawings: people as simple figures, objects, clocks, prices on tags, weather icons, numbers). Exactly one picture
   matches; the others differ in ONE clear detail (object, action, number, place, time). No text in the picture that
   gives the answer away unless it IS the tested detail (a price, a clock time). Black/grey strokes, stroke-width ≥ 2,
   one accent colour (#b31942 or #0a1f44), font-size ≥ 13. Generate the SVGs with a node script.
2. **Question-Response** — passage: ONE spoken question or statement, no speaker label (e.g. "When does the library close today?").
   stem exactly: `Choose the best response to the question or statement you hear.`
   choices: 4 short written responses; exactly one natural reply. Distractors: same-word repetition, similar sound,
   wrong question type (answering "where" for "when"), plausible but off-topic.
3. **Conversations** — passage: a dialogue of 4–6 turns between `Woman:` and `Man:` (these two labels ONLY, first line
   starts with `Woman:` or `Man:`). 2 questions per conversation (identical passage string for both), e.g. "Where are
   the speakers?", "What will the man probably do next?", "What does the woman want?".
4. **Talks** — passage: a short monologue (announcement, voicemail, radio ad, tour guide, store message, 50–90 words).
   First line starts with ONE role label from: `Announcer:` `Speaker:` `Guide:` `Caller:` `Host:` (never Woman:/Man:),
   the whole talk on that one label. 2 questions per talk (identical passage).

### Reading (section "reading")
1. **Sentence Completion** — no passage. stem: one sentence with one blank `____` (four underscores), e.g.
   "Please ____ your name on the list." choices: 4 words/phrases; tests grammar (verb form, preposition, pronoun,
   comparative, conjunction) or vocabulary. Exactly one correct.
2. **Text Completion** — passage: a short text (40–90 words: notice, email, text message, memo, ad) with exactly
   4 blanks written `(1) ____`, `(2) ____`, `(3) ____`, `(4) ____`. 4 questions per text, stems exactly
   `Choose the best option for blank (1).` … `(4).` At least one of the four blanks per text asks for a whole
   sentence (choices are 4 sentences; only one fits the context).
3. **Reading Comprehension** — passage: a short text (50–160 words: sign, schedule, menu, ad, email, article, chat,
   form; tables written as plain lines are fine) with 3 questions (identical passage string): main purpose, detail,
   inference, vocabulary-in-context ("The word 'X' in line 2 is closest in meaning to").

## Difficulty (1–4)
1 = Pre-A1/A1 (very short, high-frequency words) · 2 = A1/A2 · 3 = A2/B1 · 4 = B1 (longer, inference, less common words).
Spread items over 1–4 (roughly 25% / 30% / 30% / 15%).

## Output
One JSON array per assigned file; touch no other repo file. Item schema:
`{ "exam_type": "TOEICB", "section": "listening"|"reading", "difficulty": 1-4, "passage": "(omit for Sentence Completion)",
  "stem": "...", "choices": [4 distinct], "answer": 0-3, "explanation": "1–2 sentence English explanation" }`
- Exactly 4 choices, exactly ONE defensible answer, plausible distractors, answer positions balanced (~25% each, no cycles).
- Grouped items: the passage string must be byte-identical for every item of that passage, and those items adjacent.
- Questions must be answerable ONLY from the passage (listening: only from what is heard).
- American English; neutral, inclusive, everyday content; no brand names; no real people.
- No duplicates or near-duplicates inside your file.

## When done
`node scripts/passage-stats.mjs <your file>` must say "all items structurally valid". Render every picture item
(Playwright + Chromium are installed: `require('playwright')`; screenshot the 4 choices side by side) and LOOK at it.
Final message: file, counts per part × difficulty, and any item you are unsure about (index + why). Keep helper files in
/tmp/claude-0/-home-user-mocktest/d898e36e-7fe1-52c6-830c-3a83458ae374/scratchpad/<your-folder>/. Do not commit.
