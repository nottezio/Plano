# Signs of AI writing: reference

- **Source:** https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing
- **Date fetched:** 2026-10-19
- **Nature of this file:** a paraphrased digest in my own words, not a copy. The source is a Wikipedia field guide for spotting undisclosed AI text. It is descriptive, not a rulebook. Only the signs that apply to general prose are kept here; Wikipedia-specific material (edit summaries, drafts review, wikitext and template bugs, talk-page conventions) is left out.

## How to use these signs

- One sign on its own proves nothing. Humans write these patterns too. Several signs together, repeated, is the real tell.
- The source stresses that people (and detector tools) are poor at telling AI from human text. Treat this as an editing checklist, not a verdict.
- Underlying cause: models drift toward the statistically average, agreeable phrasing. Specific, odd, checkable facts get replaced by generic, flattering, important-sounding statements. Fix by putting the specific fact back or deleting the sentence.
- Not reliable signs (do not flag these alone): perfect grammar, formal or "fancy" vocabulary, a mix of casual and formal tone, plain blandness, a lone "However" or "Additionally", unsourced claims.

---

## 1. Vocabulary

### 1.1 Stock "AI vocabulary"
Words that cluster and appear far more often in post-2022 model output. The more of them in one passage, the stronger the signal.
- Long-running set: additionally (opening a sentence), align with, boasts (for "has"), bolstered, crucial, delve, emphasizing, enduring, enhance, fostering, garner, highlight (verb), interplay, intricate/intricacies, key (adjective), landscape (abstract), meticulous(ly), pivotal, robust, showcase, tapestry (abstract), testament, underscore (verb), valuable, vibrant.
- The favourites drift by model generation. Older output leaned on delve, tapestry, testament. Mid-era output on highlighting, showcasing, fostering, enhance. The source lists newer favourites as challenge, clearer, dependable, echoed, foster, leverage, matters, multifaceted, practical, prioritize, quietly, steady, universally.
- Some chatbots have their own flavour (one overuses "scientific" words such as causal, empirical, correlate).
- Judge the word in context. "Underscore" as a literal underline mark is fine. A synonym of a flagged word is not automatically a problem.
- Example: "The report underscores a pivotal shift in the evolving landscape."
- Plainer: "The report says things changed in 2024."

### 1.2 Puffed-up promotional words
Travel-brochure or press-release diction used on neutral subjects: boasts a, vibrant, rich, profound, nestled, in the heart of, groundbreaking, renowned, breathtaking, diverse array, natural beauty, commitment to, exemplifies.
- Example: "Nestled in the heart of the valley, the town boasts a vibrant arts scene."
- Plainer: "The town has a few galleries and a weekly market."

### 1.3 Vague connection verbs
Instead of stating the relationship, the text says things are "connected to", "associated with" or "in connection with" each other.
- Example: "She was associated with leadership of the charity."
- Plainer: "She chaired the charity from 2019 to 2022."

### 1.4 Vague authorities
Opinions pinned on "experts", "observers", "industry reports", "some critics", or several sources when only one is cited. Lists hinted at as incomplete ("such as...") with no basis.
- Example: "Experts argue the policy has had mixed results."
- Plainer: "Dr. Rao's 2023 study found the policy cut costs but raised waiting times." (Only if a real source exists; otherwise cut it.)

---

## 2. Sentence and paragraph structure

### 2.1 Not X, but Y (negative parallelism)
Tells the reader what a thing is not before saying what it is. Variants: "not only... but also...", "it's not just X, it's Y", "no X, no Y, just Z", and the reversed "Y rather than X". Fine once in a while; a sign when frequent.
- Example: "This isn't just a tool, it's a new way of working."
- Plainer: "The tool changes how the team plans its week."

### 2.2 Forced triads (rule of three)
Three adjectives, three short phrases, or three bullet examples where two or four (or one) would be natural. Used to make a thin point look thorough.
- Example: "Fast, reliable, and scalable, it serves teams, startups, and enterprises."
- Plainer: "It handles about 10,000 requests a second."

### 2.3 Trailing "-ing" analysis
A participle phrase bolted onto the end of a sentence to add significance, often with a vague outside voice.
- Example: "The bridge opened in 1932, symbolizing the city's ambitions and highlighting its commitment to progress."
- Plainer: "The bridge opened in 1932."

### 2.4 Significance and legacy padding
Sentences claiming a topic "marks a pivotal moment", "reflects broader trends", "stands as a testament", "plays a crucial role", "leaves an indelible mark", or "sets the stage for" something. Often attached to mundane facts. The same applies to ecosystem/heritage/legacy asides that the facts do not support.
- Example: "The name change reflects the town's enduring legacy and broader regional shifts."
- Plainer: "The town changed its name in 1904 after the mill closed."

### 2.5 Canned notability talk
Dwelling on the fact that a subject was "featured in", "cited by", "profiled in" media, or has an "active social media presence", rather than saying what they did.
- Example: "He has been featured in leading trade publications and maintains an active online presence."
- Plainer: "He designs boat hulls; his 2021 racing hull won the regional cup."

### 2.6 Avoiding "is" and "has"
Swapping plain copulas for heavier verbs: serves as, stands as, represents, marks, functions as, boasts, features, offers, maintains, "refers to" in openings.
- Example: "The library serves as a hub and features three reading rooms."
- Plainer: "The library is the town's main meeting place. It has three reading rooms."

### 2.7 The "Despite... challenges" formula
A closing block that opens "Despite its strengths, X faces challenges...", lists generic hurdles, then ends upbeat or with vague future prospects. Section titles like "Challenges and Future Outlook" are part of it.
- Example: "Despite these challenges, the sector remains poised for continued growth."
- Plainer: delete, or name the actual problem and its status.

### 2.8 Staged openers and one-line closers
Warm-up openings ("In today's fast-paced world...", "When it comes to X...") and summary punchlines at the end of a paragraph or section ("In summary...", "Overall...", "Ultimately, it's about...") that restate what was just said. The source records the conclusion/summary habit as typical of older models; the staged opening and single-sentence mic-drop are the form it commonly takes now.
- Example: "In a world full of noise, one thing stands out: clarity."
- Plainer: start with the point itself; end when the point ends.

### 2.9 Invented-looking significance hedges
A disclaimer saying the subject is of limited importance, followed straight away by a paragraph on why it matters anyway. Also "it's important to note", "worth noting", "may vary" (a pattern strongest in older output).
- Example: "While this is a minor detail, it highlights the importance of precision."
- Plainer: cut both halves or state the detail.

### 2.10 Uniform sentence rhythm and low lexical variety
Recent output tends toward short, even sentences (very roughly 8 to 20 words), heavy comma and period use, and little variety in punctuation. Older output repeated no word for fear of repetition and swapped in synonyms for the same thing ("elegant variation": the firm, the company, the organization, the outfit).
- Plainer: vary sentence length naturally; call a thing the same name each time.

### 2.11 Things humans do more often than AI (use as a target)
Simple "there is a", "it has a" sentences; plain verbs (wrote, moved, used, tried, died) in place of stiff ones (authored, relocated, utilized, attempted, passed away); definite statements ("the first", "the only"); small qualifiers (very, perhaps, tends to); ordinary wordy bits (in order to, as a result of).

---

## 3. Formatting

### 3.1 Bold-label lists
Bullets or numbers that each begin with a bolded heading and a colon, then a sentence of explanation. Often applied to material that reads better as prose.
- Example: "- **Speed:** Loads faster. - **Safety:** Fewer errors."
- Plainer: "It loads faster and fails less often."

### 3.2 Scattered bold emphasis
Bolding key phrases mechanically throughout a paragraph, "key takeaways" style, including repeated bolding of the same term.
- Plainer: remove all bold except genuine terms the reader must find.

### 3.3 Title Case headings
Every main word capitalised in section headings.
- Example: "Impact Of Technology And Digitalization"
- Plainer: "Impact of technology and digitalization" (sentence case, unless the house style says otherwise).

### 3.4 "X and Y" section titles
Headings built as pairs ("Challenges and Opportunities", "Awards and Recognition") on every section.
- Plainer: use one concrete heading, or none.

### 3.5 Emoji as decoration
Emoji in front of headings or bullets.
- Plainer: remove.

### 3.6 Thin tables and divider lines
Tiny tables that hold a couple of facts, and a horizontal rule between every section.
- Plainer: a sentence, or no rule.

### 3.7 Em-dash overuse
Em dashes (often spaced) where a comma, colon, parentheses or a full stop would do, especially to punch up a clause or set up a contrast. Strongest in combination with other signs. The source notes some newer models now avoid dashes entirely and lean on commas and periods instead, so a total absence of other punctuation can itself be a pattern.
- Example: "The result — surprising, even to us — was clear."
- Plainer: "The result surprised us, but it was clear."

### 3.8 Curly quotes and apostrophes
Some chatbots output typographic quotes (“ ” ’) where plain text uses straight ones, sometimes mixed. Weak sign: word processors and phones do this too. Match the destination's existing convention.

---

## 4. Tone

### 4.1 Promotional, upbeat default
Even when asked to be neutral, output slides toward brochure praise. Newer models are subtler and avoid blunt superlatives like "the best", but stay quietly positive.
- Plainer: state what is true, including limits and costs, in the same flat voice.

### 4.2 Empty analysis that says nothing checkable
Statements about "valuable insights", "resonating with", "fostering understanding", "contributing to" something. The sentence could be dropped into any topic.
- Test: if it could describe a different subject unchanged, replace it with a specific fact or cut it.

### 4.3 Source-availability disclaimers
Hedges such as "specific details are scarce", "not widely documented", "based on available information", or "this should be treated as X rather than Y". The claim of missing information may itself be a guess.
- Plainer: say what you checked and what you found, or leave it out.

### 4.4 Chatbot talk left in the text
Leftover conversational lines: "Certainly!", "Of course!", "I hope this helps", "Let me know if you'd like...", "Would you like me to...", "Here is a...", "You're absolutely right!". Also knowledge-cutoff remarks ("as of my last update"). Always remove from anything meant for other people.

### 4.5 Fill-in-the-blank placeholders
Bracketed template text left unfilled: "[Describe the section here]", "[Your name]". Always remove or fill.

---

## 5. Markup and citation artifacts

### 5.1 Stray Markdown
Asterisks around words, `#` heading marks, backticks, `---` rules that show as raw symbols because the destination does not render Markdown (email, plain-text forms, wikis, CMS fields).
- Plainer: convert to the destination's formatting or plain text.

### 5.2 Tool citation residue
Machine tags pasted from chatbot outputs where a source link should be: contentReference/oaicite/oai_citation, turn0search0, "+1" after a name, [cite: 1], [span_1](start_span), grok_card or render tags, odd bracket or dagger markers, attached_file or file-upload markers, ":::writing". Delete and replace with a real source, or drop the claim.

### 5.3 Utm_source tracking in links
Links ending with a `utm_source=` parameter (chatbot names are common values). Strip the tracking part.

### 5.4 Citations that do not check out
Dead links, DOIs or ISBNs that fail or point to a different work, book references with no page number, claims attributed to a source that does not say that. Verify every cited source before keeping it.

### 5.5 Generic lead that treats a topic as a proper noun
Opening by defining the title as if it were a named thing ("The list of X is a curated compilation of..."; "X refers to...").
- Plainer: begin with the subject itself ("X is...").

---

## Era notes (older tells, still worth a glance)

- Didactic disclaimers: "it's important to note", "worth noting".
- Section summaries: "In conclusion", "Overall" paragraphs restating the section.
- Prompt refusals or knowledge-cutoff statements pasted into text.
- Abrupt cut-offs where the text stops mid-thought.
