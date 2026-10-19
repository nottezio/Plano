---
name: ai-writing-signs-editor
description: Use when the user asks to rewrite, edit or review text so it doesn't sound AI-written, and when drafting anything meant for other people (emails, posts, articles, reports, messages, pitches). Do NOT use for the user's own notes, code, code comments, or internal docs.
---

# AI writing signs editor

Rewrite text so it reads like a direct, plain human wrote it, without changing what it says.

## Steps

1. **Read `references/signs.md` first** (in this skill's folder). Use its categories and examples as the checklist. Do not rely on memory of it.
2. **Detect.** Scan the text for these signs and note where each occurs:
   - not-X-but-Y contrasts ("not just X, it's Y", "no X, no Y, just Z", "Y rather than X")
   - one-line closers and summary punchlines
   - staged openers and warm-up sentences
   - forced triads (three adjectives, phrases or examples)
   - dash overuse (em dashes where a comma, colon or full stop works)
   - inflated claims (significance, legacy, "pivotal", "testament", "broader trends")
   - stock AI words (delve, tapestry, landscape, vibrant, robust, leverage, underscore and the rest of the list)
   - bold labels and inline-header bullets where prose would do
   - filler (hedges, empty analysis, vague attributions, chatbot phrases)
   - leftovers: stray Markdown symbols, tool citation tags, unfilled placeholders
3. **Rewrite.**
   - Use plain, direct sentences. Prefer "is" and "has" to "serves as" and "boasts".
   - State the point first. Cut any sentence that could describe a different subject unchanged.
   - Put in the specific fact the original already gives; never invent one. If a vague sentence has no fact behind it, delete it.
   - Vary sentence length naturally. Use the same word for the same thing.
4. **Keep fixed.**
   - Meaning, facts, numbers, dates and claims stay exactly as they are. Do not add new information or sources.
   - Keep the user's voice and level of formality. Casual stays casual, formal stays formal. Match their spelling variant and punctuation habits (quote style, list style).
   - Leave quoted text, names, titles, and technical terms untouched.
   - If removing a sign would change the meaning, keep the original wording and flag it.
5. **Return** in this order:
   1. The rewritten text only.
   2. A short list of what was changed (one line per change, grouped by sign, e.g. "Removed not-just-X-but-Y in para 2"). Keep it brief.
   3. Only if needed: a one-line flag for anything left alone on purpose or anything that looked unsupported (a claim with no fact behind it, an unverifiable citation).

## Notes

- A single sign is not proof of AI writing and is not always wrong. Edit for clarity and directness, not to hit a count. If the text is already clean, say so and change little.
- Do not replace one pattern with another (for example swapping every em dash for a semicolon or "however").
- Do not add praise, commentary or advice beyond the change list.
- If the user wants a lighter touch (fix only the worst signs), do that.
