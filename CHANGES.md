# Plano — CHANGES

## `2026-09-20.2`

**Both emphasis engines rewritten against the real corpus. `Aa*` and Format
bangsal now agree with the notes, and with each other.**

### How this was decided

Every rule below was measured, not chosen. The method: take the 237 real notes
from the export, strip every `*` and `_`, run the function, and compare line by
line with what was actually written.

| | before | after |
|---|---|---|
| `restoreEmphasis` (the `Aa*` button) | 95.2% | **96.9%** |
| `autoEmphasis` (Format bangsal) | 95.9% | **97.3%** |

**The corpus is not in the repository and never will be** — it is patient data.
What is kept is the conclusion and the count behind it, in the tests, so a
later change that contradicts the notes fails there instead of on a ward.

### What changed in the `Aa*` button

- **Investigation headings in every date shape the ward writes.** The rule
  demanded two digits for day and month and no month names, so a third of them
  stayed plain: `Foto thorax RS Batara Siang 2-9-2026`, `EKG Poli Aritmia
  31/8/26`, `USG Vascular Doppler (4 Agu 2026)`, `Laboratorium RSWS
  06-09-2026:`. Also `Thoraks`, `X-ray`, `Biakan`, `Laporan Arteriografi`.
- **A heading with a place and no date** — `Echo Hemodinamik IGD`, 17 lines,
  all bold. Bounded to five words with no sentence punctuation, so `Echo ulang
  bila klinis memburuk` stays a plan.
- **`Mohon izin kami … dengan` without the closing colon** (90% bold over 116
  lines), including the spelling `assesst`, which is in the notes 25 times. A
  rule that only matches the correct spelling leaves the typed ones unmarked.
- **Bare `Plan`** (83% bold over 74 lines).
- **`LUS` / `Lung Ultrasound` is no longer bolded**: plain in 124 of 141
  lines. It was being bolded because the alias table names the section — and
  the alias table is about what a heading MEANS, not how it is written.

### What changed in Format bangsal

Same evidence, and it had the opposite problem: it was over-marking.

- **`A/`, `P/`, `S/`, `O/` stay plain.** This is a reversal. The old rule came
  from one worked note where a consult block reads `*TS Interna GH* *A/*
  *Plan:*`; across the corpus those lines are plain 267 times and bold 22 —
  and all 289 sit inside a TS block, so "inside a consult block" does not
  explain the bold ones either. It matters beyond tidiness: bolding another
  service's assessment makes it read as ours, in a document whose purpose is
  to say what we think.
- **`Selanjutnya mohon arahan …` stays plain.** It was bolding 118 lines; it
  is the closing sentence of the note, not a request heading.
- **An identity line written without the letters `RM`** —
  `Ny. X / 3 Juli 1958 / 68 tahun / 1715410` — is now bold, as the corpus and
  the seeded templates have it.
- **`Pasien dikonsulkan …`** is italic; the rule listed `dirujuk`, `rujukan`,
  `datang` and `masuk` but not the commonest of them.
- The same date shapes and the same undated-heading rule as above.

### Not done, and why

- **There are still two emphasis engines.** They now agree on the measured
  cases, but they are separate code with separate rules, and this release is
  the second time both needed the same fix. Merging them is the right next
  move and is a refactor with its own risk, not a rider on a data-driven
  rule change.
- **Dose spacing is untouched.** `/24 jam/oral` (503) against `/24jam/oral`
  (197) is a real inconsistency, but normalising it edits clinical text rather
  than its markup. Its own release.
- **The day-counter check is untouched.** Counters go backwards in 5 of 49
  consecutive pairs, which is a genuine error the SOAP checker could catch —
  also its own change.
- **The minority styles are now actively overruled.** `Plan:` is bolded even
  though 13 lines write it plain, because 108 write it bold. That is what
  following a convention means, and `Aa*` is a button somebody presses, not an
  automatic rewrite.

```
1421 tests passed (+26)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-20.1`

**The mobile typing jump, and Catatan as a list as well as a board.**

### 1. Why the screen jumped while typing on a phone

The textarea grows with its text, and it measured itself by collapsing to
`height: 0`, reading the height the content needed, then putting it back — on
every keystroke.

On a desktop that is invisible. On a phone the textarea is FOCUSED, and
collapsing a focused element to nothing makes the browser scroll the caret
back into view against the collapsed layout. The old code then restored the
scroll from here, so the view snapped away and came back, once per character.

**Restoring the scroll afterwards could never fix it**: the browser's
correction and ours are two scrolls fighting inside one frame. The fix is not
to disturb the element being typed in.

It now measures a hidden COPY that carries `METRICS` — the same class string
the textarea and the tint layer already share, which exists so these layers
cannot drift apart. The real box is set to the height that copy reports and is
never collapsed.

**The fallback stays.** If the copy ever under-measures — a font not loaded in
one layer, a style that drifts — the note would be CUT, and that is the one
failure this component must not have. So after setting the height it asks the
real box whether its content still overflows, and only then falls back to the
old collapse-and-measure, scroll capture included. Correct beats fast; the
slow path now runs approximately never instead of on every key.

### 2. Catatan: Kartu or Daftar

A toggle above the board. **Kartu** is the masonry board. **Daftar** is one
note per row, full width, with a single line of preview — for a long shelf
where the titles answer "which one was it" faster than the colours do.

Same component, same drag, same drop line: a list that behaved differently
would be a second thing to keep in step. The choice is remembered per device,
not per account — it follows the screen you are on, and syncing it would let
one device change the other's.

### 3. The guard I added last release was broken, twice

`clampClasses.test.ts` was supposed to fail the build if `line-clamp` ever
shared an element with `block`. While using it:

- It **fired on a comment** — the words "no `block` here", written to explain
  the bug, counted as a `block` class. A guard that trips on the text warning
  about the thing it guards is a guard that gets deleted.
- Fixing that, it then **matched nothing at all**: the pattern expected
  `className={[...]}`, and every array in this codebase ends `].join(' ')}`.
  It passed because it looked nowhere.

It now strips comments, reads only the quoted class strings, and matches the
real array shape. Verified both ways: put the bug back, it fails; take it out,
it passes.

### Not done, and why

- **Nothing was changed from the export analysis yet.** The conventions it
  shows (bold for section and investigation headings, italic for DPJP lines)
  are worth encoding in Rapikan, and dose spacing is inconsistent enough in
  the real corpus to be worth normalising — but both rewrite the text of a
  clinical note, so they are their own release with their own tests, not a
  rider on a layout fix.
- **The phone still cannot reorder Catatan** (drag is the HTML API). Unchanged
  from the last release.

```
1395 tests passed
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-19.5`

**The card preview really is four lines now, and ordering is a drag that shows
where the card will land.**

### 1. Why the preview never shortened

Not a wrong number. `line-clamp-4` sets `display:-webkit-box`, and the span
also carried `block`. Tailwind emits `.block{display:block}` AFTER the
line-clamp utilities, so the later rule won, the clamp did nothing, and every
card printed its whole note.

That is why it survived two releases: the class list reads correctly, and
nothing on screen says which of two display utilities won. Removing `block`
fixes it — the clamp sets its own display.

**`clampClasses.test.ts` now fails the build** if any `className` in the app
pairs `line-clamp-*` with `block`, `flex`, `grid` or `inline-block`. Confirmed
by putting the bug back and watching the test fail.

### 2. Ordering: drag, with the drop shown first

Both previous attempts were wrong for the same reason — you could not see what
the drop would do. The first had no indicator at all. The second moved the
controls into the open note, a different screen from the one whose order was
being changed.

Now: drag a card, and an **accent line appears on the edge of the card it will
land next to** — above it or below it, following which half of that card the
pointer is over. The dragged card dims. Release, and it lands exactly where
the line was.

`moveBeside` in the domain makes the line a promise rather than a guess. It
computes the destination AFTER removing the dragged note, so "the side you
were shown" holds whichever direction the drag came from — computing it before
removal is the off-by-one that makes a downward drag land one place short. Six
tests, including that a move never disturbs notes the shelf or archive filter
is hiding.

The ↑ / ↓ buttons in the open note are gone: one way to order, on the screen
that shows the order.

### Not done, and why

- **Touch dragging is not supported.** This is the HTML drag-and-drop API,
  which phones do not fire. Reordering on a phone now has no control at all —
  if that matters, say so and it becomes a pointer-event drag, which is a
  bigger piece of work than it sounds because it has to own the scrolling too.
- **The insertion line reserves 4px above and below every card**, so the board
  does not jump when the line appears. It costs a little space on a dense
  board and it is what stops every card shifting mid-drag.

```
1395 tests passed (+6)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-19.4`

**Catatan cards show four lines, and ordering moved off the drag gesture.**

### The preview was the note

Ten lines filled a whole column with a long reference note, so the board
became the notes themselves, stacked — the wall of text the tabs were meant to
replace. Four lines is enough to recognise a note and not enough to read it
instead of opening it.

### Dragging a card onto a card is not a gesture anyone can see

There was no drop indicator, no gap opening, and no sign afterwards that
anything had moved: the only feedback was the card fading while dragged. That
is a gesture you have to be told about.

Ordering is now **↑ / ↓ in the open note**, one step per press, disabled at the
ends. Pressing one is either a move you can see when you go back to the board,
or a button that is plainly unavailable.

The rewrite still goes through `reorderWithinVisible`, so a move made while a
shelf or the archive filter is hiding notes cannot drop the hidden ones — the
guard that mattered is unchanged; only the way it is triggered is.

### Not done, and why

- **No drag anywhere on the board.** A drag worth keeping needs a drop
  indicator and a gap that opens as you move, which is the canvas machinery on
  the patient board. That is a real piece of work and this is a shelf of notes.
- **The card colours are unchanged.** They come from the theme's card tokens.
  If they read as too heavy in dark mode, that is a palette choice worth making
  deliberately rather than while fixing something else.

```
1389 tests passed
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-19.3`

**The sidebar stops resizing itself, the checklist fits in its minimised box,
and Catatan is a board of sticky notes.**

### 1. The sidebar resized on every expand

Expanding a panel pushed the column past the viewport, the scrollbar appeared,
and it took ~15px of width from the cards — so every panel reflowed and the bar
appeared to jump. `scrollbar-gutter: stable` reserves that space whether the
scrollbar is showing or not, so the width never changes.

### 2. The whole checklist, minimised

It showed four items and `+3 lagi`, which hides exactly the ones that might be
unticked — the only question the minimised view exists to answer. It is now two
columns with every item and no "+N".

### 3. A finished checklist says so

When everything is ticked the minimised box reads **✓ Semua selesai** instead of
seven struck-through lines. The list only answers "what is left", and when the
answer is "nothing" a word says it faster than a list. Custom Checklist follows
the same rule.

### 4. Catatan as sticky notes

The shelf was a row of tabs: it scrolls sideways, shows one title at a time,
and says nothing about what is IN a note, so finding one meant opening several.
It is now a board.

| | |
|---|---|
| **Layout** | Masonry through CSS columns, one to three by width. A grid would pad every card to the tallest in its row, and notes are not the same length |
| **Preview** | The first ten lines, with the markup stripped and list items marked, so a checklist still reads as one |
| **Colour** | Derived from the note's id, so it never changes for a given note and the note stays findable. Not a stored field: that needs a picker, a migration and a default, for a job that is only "tell these apart" |
| **Opening** | A card opens the editor, with **← Semua** to come back. The editor's toolbar, title field and archive/delete belong to a note being written, not to a card being scanned |
| **Order** | Still drag and drop, now by dragging cards |

The preview strips tags rather than rendering them: bodies are HTML from a
contenteditable, and rendering that in a card would bring its headings and
font sizes into a space sized for plain lines — along with whatever a pasted
fragment carried. 9 tests cover the stripping, including that no tag survives.

The colours are the shared card tokens, so they follow the theme and pass
`check:contrast`. A literal hex would have failed it, correctly.

### Not done, and why

- **No per-note colour picker.** The palette is derived; choosing colours is a
  feature with its own storage and UI, and nothing has asked for it yet.
- **No pinning and no search on the board.** Both are real Keep features and
  both are their own work; the shelves (Catatan / Catatan jaga) and Arsip
  already divide the board.
- **The editor itself is unchanged.** Same toolbar, same contenteditable, same
  saving. Only the way in changed.
- **Not rendered here.** Worth checking: the board at three columns on the ward
  PC, and that a long note's card stops at ten lines rather than filling the
  column.

```
1389 tests passed (+9)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-19.2`

**Real undo/redo for the note, and the panel sidebar was clipping its own
content.**

### 1. Undo and redo that can be relied on

The editor had no history of its own; Ctrl+Z was the browser's. That works for
plain typing and for nothing else this editor does. A template, Rapikan SOAP,
carry-forward, an AI rewrite, restoring a revision, a merge arriving from
another device — every one of those sets the value from React, which drops out
of the native stack. So Ctrl+Z after Rapikan either did nothing or jumped past
the reformat to some older state.

`domain/textHistory` is now the history, and it is the app's:

| | |
|---|---|
| **Typing** | Coalesces into one step per burst (900 ms), so undo goes back a phrase at a time, not a character |
| **A transform** | Always its own step. Undo after Rapikan gives exactly the note before Rapikan |
| **A change that arrived** | A merge or an adopted remote version is a step too: that is the change people reach for Ctrl+Z after |
| **Redo** | Survives until the next real edit, then is dropped — keeping a future that no longer follows from the present is how redo resurrects text nobody expected |
| **The caret** | Stored with each step and restored with it, so an undo puts you back where the edit was |
| **Saving** | An undo saves like any other change. An undo left unsaved is one that comes back on the next device |

Two buttons at the left of the format toolbar (↶ ↷, disabled when there is
nothing to do), plus Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y. The native
behaviour is refused when the app's history answers, so the two cannot
disagree. 12 tests, including the cases that broke before: a transform between
two bursts of typing, redo dropped by a new edit, and a keystroke after an undo
not merging into the step it just restored.

### 2. The sidebar was cutting its own headers off

Not a missing header: a clipped one. In the screenshots the Tanggal panel had
no header and Custom Checklist had no buttons, both cut at the card edge.

**Root cause.** `2026-09-19.1` made the panel sidebar a fixed-height flex
column so it would scroll on its own. Flex children shrink by default, and the
panel cards clip their corners with `overflow-hidden` — so instead of the
column scrolling, every card was squeezed to fit and cut off whatever no
longer fitted. The fix is `shrink-0` on the card: a panel is its natural
height, and the column scrolls, which is what was asked for in the first place.

**Also in the sidebar:**

- **Catatan pasien had two headers** — the panel's and the component's own, one
  line apart, reading the same words. `PatientNotes` gained a `bare` mode for a
  caller that already provides the heading. Its `startOpen` prop, added for the
  panel one release ago and now unused, is deleted rather than left behind.
- **Custom Checklist's actions** sat right-aligned against an empty spacer in
  compact mode. They start at the left now.

### Not done, and why

- **Undo is per open note.** Switching day or patient starts a new history
  rather than carrying one across, because an undo that reaches back into a
  note you are no longer looking at is worse than no undo.
- **The history is not persisted.** A reload starts fresh; Riwayat perubahan is
  the record that survives, and it already holds every transform.
- **The jaga note editor has no buttons yet.** It shares the machinery, so it
  is a small addition, but it was not asked for and an untested control in a
  second editor is not a free win.
- **Not rendered here.** Worth checking: apply a template, type a sentence,
  press Ctrl+Z twice — the first should undo the sentence, the second the whole
  template.

```
1380 tests passed (+12)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-19.1`

**Notes could not be written on a cleared day. That is fixed, and it was my
bug from `2026-09-18.1`.**

### 1. Why the note would not save

From the recording: *"Disalin dari hari sebelumnya"* appeared, the editor went
back to empty, and the day still offered "Mulai dari format". The app accepted
the write and the SERVER refused it.

**Root cause.** `clearEntry` writes `body: ''` but never updated `bodyHash`, so
a cleared day stored a hash of text it no longer held. The compare-and-set I
added in `2026-09-18.1` hashed the body MYSELF and compared that with the
stored `bodyHash`. On a cleared day those two can never agree, so every write
to that day was refused — for ever. Typing, carry-forward, everything.

I picked the wrong thing to compare. A compare-and-set must compare a field
with the same field, not with a value recomputed from another one. Hashing
locally silently assumed `bodyHash` always describes `body`, and one writer in
this codebase already broke that assumption.

**The fix, three parts:**

- **The write sends back the server's OWN `bodyHash`**, kept in `localBase`
  alongside the confirmed body (`expectedBaseHash`, tested). A write this
  device sent but has not seen confirmed still hashes its own text, which
  matches by construction because we wrote that hash too.
- **`clearEntry` writes `bodyHash` with the body.** The two now move together,
  which is what made the day unwritable.
- **A refused write reconciles within seconds**, not at the next startup. It
  used to wait, which at the keyboard is indistinguishable from the app
  refusing to take the note at all.

Existing broken days heal themselves on the first write after this ships: the
hash sent is the stored one, so it matches, and the write that lands stores a
consistent pair.

**Not blocked, and deliberately so:** a day whose hash this device cannot
verify is written WITHOUT a check rather than refused. A missed check costs a
possible revert; a wrong check costs the note. The note wins.

### 2. Watermark: `Mengambang`

`Pengaturan → Watermark di catatan` now chooses between **Berulang** (tiled,
what it does today) and **Mengambang** — one mark that floats with the scroll.
It is a setting, so it is remembered per account and applies on every device.

The floating overlay carries no `overflow`, because an `overflow: hidden`
ancestor turns a sticky child into an ordinary one — which would park the mark
at the top of a long note and leave the rest of the scroll unmarked, the exact
failure tiling was introduced to fix.

### 3. The panel sidebar, again

**"Minimised" now means less of the thing, not none of it.** The first version
collapsed each section to a bar, and four closed bars answer nothing without
four taps — slower than the flat list it replaced. Each section now shows a
condensed view of its own content:

| Section | Closed shows |
|---|---|
| Catatan pasien | The first three lines of the note |
| Checklist | The first four steps with their ticks, `+N lagi` |
| Custom Checklist | Same, or "Belum ada langkah khusus" |
| Tanggal | The last four dates as chips, today highlighted, `+N` |

Tapping the preview opens the section, which is where anything can be changed.
The preview is deliberately read-only: a control that works in a preview and a
different one that works when open is two places to fix one behaviour.

**Scrolling.** In the panel layout the sidebar is now a fixed-height column, so
it is always its own scroll container. `max-h` alone left the column as tall as
its content until that content passed the viewport, and an expanded panel could
then run past the bottom with the scroll belonging to the page.

### Not done, and why

- **Rules unchanged, so nothing needs deploying for the fix** beyond the app
  itself. Push and reload.
- **No test reproduces the refusal end to end**, which needs Firestore. The
  decision that was wrong is now a pure function with four tests, including the
  cleared-day case.
- **The floating watermark sits at one third of the note's height.** That is a
  fixed choice, not a setting; a slider for it is more knobs than the problem
  has.
- **`clearEntry` still leaves `deletedAt` set**, which is correct: a day with
  text in it is revived by the write itself (fixed earlier), and an empty write
  must not resurrect a day someone deliberately cleared.
- **Not rendered here.** Worth checking first: open a day you previously
  cleared, type a line, reload. It should still be there.

```
1368 tests passed (+4)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-18.2`

**6MWT consults check for TB/BB, Salin always copies the open note, and the
patient page has a second layout.**

### 1. TB/BB for a 6MWT consult

The walk test is reported per metre and read against the patient's size, so a
request without height and weight comes back. The note usually has them — just
on a different day from the one the consult was composed from.

`missingKonsulMeasurements` checks the body being sent, not the patient
record, because the body is what the consultant reads. It fires only for
purposes that need them (`6MWT`, `6 MWT`, `six minute walk test`), names which
one is missing, and treats a label with no value (`TB :`) as missing.

**A reminder, not a block.** A consult sent without them is still a consult,
and a copy button that refused would be worked around within a day.

### 2. Salin always copies the note on screen

The range chooser offered today, this day, the last three days and all days.
Every shape Salin actually sends describes ONE day — a daily handover, a
consult, an invasive-group message, a jaga note — so those options were four
ways to send something other than what fills the screen behind the sheet. The
multi-day list existed because the composer accepts one, not because anything
asked for it.

Removed properly rather than hidden:

- the Rentang chips, the range state, and the fetch of every other day that
  only the range needed;
- `range` and `lastN` from `CopyPreset`, and from the two seeded presets;
- `resolveRange` and the `CopyRange` type, with their tests.

`composeCopy` still takes a list of days, since a day header per day is what
would make a multi-day export readable if one is ever wanted.

### 3. A second layout for the patient page

`Pengaturan → Tata letak halaman SOAP`, **defaulting to Klasik**, which is
exactly what the page is today. Changing where someone's checklist lives
without asking is not an improvement to them.

**Panel** rebuilds the sidebar:

| | |
|---|---|
| **Order** | Catatan pasien · Checklist · Custom Checklist · Tanggal |
| **State** | Every section starts closed |
| **Header** | Carries the answer: `ada`/`kosong`, `7/7`, `0/1`, `12 hari`. A finished checklist is tinted |
| **Shape** | Each section is a card with its own edge, instead of four blocks separated by a gap |
| **Dates** | Capped and scrolling inside their own panel |

**Why that order.** Read top to bottom it is what the round asks, in the order
it asks: what carries over, what must be done every day, what must be done for
this patient, and only then which day you are on. The date list was above both
checklists and grows without limit, so on a three-week stay it pushed the
thing you tick while reading off the screen.

**Why closed and not remembered.** A sidebar that reopens whichever sections
were open on the last patient puts different things in front of you depending
on where you have been. The summaries are there so that a closed section is
not a hidden one.

`PatientNotes` gained `startOpen` so the panel can own the open/closed
decision; its own default (open when there is something to read) is unchanged
for the classic layout. The date rail is now built once and rendered by
whichever layout is on, rather than written twice.

### Not done, and why

- **Phones are unchanged.** The sidebar is an `xl` screen feature; the phone
  arrangement is a separate surface and was not part of this.
- **The layout setting does not change the note column**, only the sidebar.
  The header tools, the section jump bar and the editor are the same in both.
- **6MWT is the only consult with a measurement rule.** Others would need the
  same evidence this one has: a request that actually came back.
- **Not rendered here.** Worth checking on the ward PC: switch to Panel on a
  long-stay patient and confirm the four headers answer their questions
  without opening anything.

```
1364 tests passed
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-18.1`

**The revert is fixed: a late write is now merged instead of replacing a newer
note. Plus "Pakai versi revisi ini" in Bandingkan.**

### 1. Why a note reverted hours later

`writeBody` sent the whole text with no statement of what it was replacing,
and Firestore is last-write-wins. Firestore's queue is persistent, so a write
made with no signal is delivered whenever that device next reconnects — hours
later, after the note has been edited somewhere else. The late write then
replaced the newer text.

The three-way merge could not help: it runs inside a live editor holding both
versions, and a queued write left the app long ago. **The merge guarded the
front door; these writes came through the back.**

### The fix, in three parts, none of which works alone

**1. Every body write says what it was built on.** It carries `baseHash`: the
hash of the body this device last saw **confirmed** by the server.

The base comes from `localBase`, which was already written on every confirmed
snapshot and — this is the part that made the bug possible — **was never read
by anything**. The machinery existed and was inert. The live entry cannot be
used instead: offline, Firestore's optimistic copy already contains this
device's own unsent text, so the "base" would be our own edit, and a later
merge would conclude we had changed nothing.

**2. The rules refuse a stale write.** `allow update` on an entry accepts a
body only if `baseHash` still matches the stored `bodyHash`. A write built on
a version the server has moved past is rejected rather than applied.

Untouched: writes with no body (lock, presence, shift notes, preview), the
explicit clear, and older app versions, which send no `baseHash` and behave
exactly as before until they update. An entry stored before `bodyHash` existed
cannot be checked, and is allowed rather than refused forever.

**3. A rejected write is merged, not dropped.** This is what makes 2 safe.
Every body write is recorded in an outbox (a second store in the same
IndexedDB) with the text and its confirmed base, and cleared when the server
confirms it. At startup and on reconnect, `reconcileOutbox` reads what the
note holds now and decides:

| Situation | What happens |
|---|---|
| The server already has this text | Record dropped, silently |
| The server is still on the base | Written again: the write was simply lost |
| The server moved, **different lines** changed | Merged; the replaced version goes to Riwayat perubahan first |
| The server moved, **same line** changed | The offline version is saved to Riwayat perubahan and you are told |

**Stricter than the live merge, deliberately.** `mergeThreeWay` is
character-level: asked to combine "Aspilet 160 mg" with "Aspilet 80 mg + CPG"
it produces a merged line, and in the editor that is fine because the result
is on screen before it is kept. The reconciler runs at startup with nobody
watching, on a drug line. **A dose neither doctor wrote must never be written
by a background task**, so a late write is merged only when the two sides
changed different lines. Two drugs appended at the same spot are also handed
back rather than ordered by guesswork.

**Ordering matters in the write path.** The write is handed to Firestore
FIRST, from a synchronous in-memory base, and recorded afterwards. My first
version awaited IndexedDB before sending, which on a `pagehide` flush would
have meant the write never reached Firestore at all — losing the edit the
flush exists to save.

**Two writes in a row from one device** are handled separately from merging.
What a write expects the server to hold is the last body this device *sent*
(Firestore preserves write order per document); what a merge treats as the
common ancestor is the last body *confirmed*. Using the sent body as a merge
base would silently drop every change it carried if it turned out to be
refused; using the confirmed body as the write's expectation would have the
rules refuse the user's own newer text on a slow connection.

**You are told what happened.** A banner names each settled note, links to it,
and says whether it was merged or needs review. Notes that simply landed say
nothing.

### 2. "Pakai versi revisi ini"

In Bandingkan → Dengan revisi tempelan, the pasted revision can now replace the
note on screen. Two-step. It applies the text **exactly as pasted**, not the
normalised form the diff compares, since that form has bold markers and blank
lines stripped and would silently reformat a note nobody edited. The current
version goes to Riwayat perubahan first, so it is undoable. Not offered for a
jaga note or a locked day.

**A bug this exposed:** `restoreTo` set the draft without bringing the
editor's ref forward, so `restoreTo(body); flush();` in one tick would have
flushed the text being *replaced*, or seen `dirty` false and written nothing —
the same trap `setValue` documents. Fixed in `useTextSync`, which also makes
restoring from Riwayat perubahan safe to flush immediately.

### Also

`createEntry` is deleted. It wrote `body: ''` with `merge: true`, had no
callers, and wired to an existing day would have blanked that day's note.

### Not done, and why

- **Rules not run in the emulator** (the sandbox cannot download it). The
  compare-and-set is reviewed line by line and the decision logic it depends
  on is tested. A syntax error fails the deploy and leaves the old rules in
  place.
- **The reconciler has no end-to-end test**, since it needs Firestore.
  `planLateWrite` and the base/in-flight bookkeeping are tested (16 new tests).
- **The board preview can lag after a refused write.** The preview write
  carries no body check by design, so a refused body still updates the card
  until the next successful write.
- **Devices still on an older version keep the old behaviour** until they
  update, since their writes carry no base. The reverting device is the one to
  update first.
- **Nothing was tested on two real devices.** The test is: edit a note on the
  phone in airplane mode, edit the same note on the PC, then bring the phone
  back online and open Plano.

```
1366 tests passed (+16)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-17.5`

**Access control and a hidden admin page (`/admin`).**

### Root cause

The rules checked only `request.auth != null`. Any Google account, or any
email/password sign-up, that found the URL could store data in this Firebase
project. Isolation held, since members-only rules kept accounts from reading
each other, but nothing decided who may be here at all. Five accounts exist;
nobody chose that number.

### The model (`src/domain/access.ts`)

- **One admin, fixed by UID**, written into `firestore.rules`, not stored as
  data, so there is no document anyone could write to become admin. A test
  checks that the rules and the client name the same UID, and that there is
  exactly one.
- **`access/{uid}`** is created by each account's own app at first sign-in
  with `status: 'pending'`. The admin approves once and the approval stands
  until revoked. **Revoke = `status: 'revoked'`**, never a delete, so the
  record of who decided and when survives, and re-approving is one tap.
- **`config/access.enforce`** is the switch. It is **off by default**, so
  deploying this changes nothing. The admin approves the existing accounts
  first and then turns it on, so nobody is locked out in between.
- **Every data path** (patients and their subcollections, documents,
  templates, jaga) now requires `allowed()` = signed in AND (admin OR switch
  off OR approved).
- The user's own profile stays readable, and writable for sign-in's
  bootstrap fields only, so the waiting screen can load. Everything else
  waits for approval.

### What the admin can and cannot see

The admin reads `access/*` only: email, name, first and last seen, device,
app version, and counts each app reports about itself (patients, daily
notes, approximate KB of that device's copy, measured from the local cache
at no read cost).

**Not `users/{uid}`, because it also holds Catatan notes.** Rules cannot hide
one field of a document, so the only way to keep those notes out of the
admin's browser is never to grant the read. Clinical data stays unreadable
to the admin.

### Hardening inside the access record

- A user may write only the registry fields, **never `status`** (enforced by
  the rules through `registryKeys()`, which a test keeps identical to the
  client's `REGISTRY_KEYS`).
- The record may not claim another uid, and **its email must equal the
  email in the signed Google token.** Otherwise anyone could label their
  pending record `nottezio@gmail.com`, and the admin decides by what the list
  shows.

### Client

- **`AccessGate`** sits after the lock screen. It shows *Menunggu
  persetujuan* or *Akses dicabut* with a sign-out button, and it is **live**:
  approving opens the app without a reload, and revoking closes it.
- **Never refuses before the answer is known.** A cache miss before the
  server responds shows *Memeriksa akses…*, not a rejection, so an approved
  resident on a new phone is not told they were refused.
- **Registration is throttled** per device: last-seen at most hourly, stats
  at most every six hours.
- **`/admin`** shows the switch, *Setujui semua yang menunggu*, and one card
  per account with Setujui / Tolak / Cabut / Setujui lagi. Destructive
  actions are two-step. For anyone else the route renders the ordinary *not
  found* page. That is courtesy, not security: the data comes from documents
  only the admin can read.
- A Settings → Tentang → **Admin** link, shown to the admin only.

### Rollout, in this order

1. Push. Wait for **both** workflows (Pages and `firestore-deploy`) to go
   green.
2. Open **Pengaturan → Tentang → Admin**.
3. Each existing account appears, as *Menunggu*, once it has opened this
   version. Compare against Firebase Console → Authentication.
4. **Setujui semua yang menunggu.**
5. When all four are approved, **Aktifkan pembatasan.**

### Not done, and why

- **Rules not run in the emulator** (the sandbox cannot download it). They
  are reviewed line by line, and the client/rules agreement is tested. A
  syntax error fails the deploy workflow and leaves the previous rules in
  place, which is safe. The next step worth taking is a rules test job in
  GitHub Actions against the emulator.
- **Already-open live listeners.** New reads and all writes are refused the
  moment access is revoked, and the app's own gate closes the screen at once.
  Firestore does not promise to cut a listener that was already open at that
  instant, so a revoked device may receive updates until it reconnects.
- **A revoked device keeps what it had already downloaded.** Rules cannot
  erase another device's offline cache. *Keluar* on the waiting screen clears
  it; nothing does that automatically, so a mistaken revoke cannot destroy
  someone's unsynced notes.
- **Sign-up itself cannot be blocked** without a paid Firebase feature.
  Strangers can still create an Auth account; they land on the waiting
  screen and read nothing. Turning off the Email/Password provider in the
  console (all five accounts use Google) removes the open sign-up form's
  purpose.
- **Accounts that never open this version never appear in the list.** The
  Auth user list is not readable from a web page without a server.
- **Cost:** each request from a non-admin account adds one or two small
  document reads for the checks. That is negligible at ward scale.

```
1350 tests passed (+9)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-17.4`

**Helper keeps only the latest document for each import, and Formasi gets
"Kembalikan ke jadwal".**

### 1. Latest document, not latest import

**Root cause.** Both the import and the sync (17.3) treated "imported last"
as "newest". Those differ exactly when it matters. Say the phone imported
September, and the PC, before syncing, imported August's file from an old
WhatsApp message. The PC's import was the more recent act, so August would
have become the schedule on every device.

**The rule** (`recency.ts`, `compareRosters`). A document is later by, in
order:

1. the last date it covers, then the first, read from the parsed schedule;
2. the PDF's own modification/creation date, now read at import. A corrected
   re-issue of the same month counts as newer. The date on disk is not used,
   because that is the download time;
3. import time, as the last resort.

A key missing on either side is skipped, not treated as oldest, so rosters
stored before this release still compare correctly. Jarkom has no dates in
its content, so for it only 2 and 3 apply.

**At import**, an older document is **refused** with both versions named:

> PDF ini lebih lama dari yang tersimpan, jadi tidak dipakai. PDF: 1 Agu 2026
> – 31 Agu 2026. Tersimpan: 1 Sep 2026 – 30 Sep 2026.

It is refused rather than asked, because a roster is replaced whole and
synced everywhere: one mistaken tap would change every device. Re-importing
the same document is still allowed.

**In the sync**, `pickRoster` uses the same ordering. After the first sync, a
device holding a later document than the account now uploads it, which heals
an account that received an older copy from a device that had not synced yet.
The comparison is antisymmetric (tested), so two devices can never both
upload, and every device converges on the latest document.

**Import cards** now show what is stored, e.g. `62 shift · 1 Sep 2026 –
31 Okt 2026 · dokumen 28 Agu 2026`, so you can see which version you have
without opening anything.

**Fixed alongside, because the new rule would have exposed it.** The
Pediatri sheet names its month but not its year, and the year was taken from
the date being viewed. A January sheet imported while looking at December
2026 was dated January 2026, which the new rule would have refused as eleven
months old. The year is now the one nearest the viewed date (`nearestYear`).

### 2. Kembalikan ke jadwal

A two-step button in the Formasi Jaga header. It is hidden when there is
nothing to reset. The first tap arms it and lists what will be cleared; the
second clears. It disarms after 5 s or on changing shift.

| Cleared | Kept |
|---|---|
| Tukar jaga for this date + shift | Name corrections ("Selalu") and religion, which are facts about a person, not a shift |
| DPJP swaps for the two dates this Formasi prints | Tukar jaga on the other shift |
| Confirmation ticks **on posts that had a swap**, since the tick was the swapped-in resident's reply | Ticks on posts nobody swapped |

DPJP swaps are stored per date, so on a Pagi/Malam day the reset also clears
them for the other shift. The armed text says so. Every cleared key syncs as
a deletion (tested).

### Not done, and why

- **No "import anyway" for an older PDF.** An override would need its own
  rule to survive sync against newer copies on other devices, and nothing
  here has shown a real need for one. If a case appears, it is a deliberate
  addition.
- **A PDF with no metadata and the same dates as the stored one** is decided
  by import time, since nothing else distinguishes them.
- **Not tested with the real PDFs' metadata.** Whether the programme's
  exports carry ModDate/CreationDate is unknown until an import shows
  `dokumen …` on the card.

```
1341 tests passed (+22)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-17.3`

**Konfirmasi Jaga syncs between devices through your account.**

### Why this changed

Helper kept everything in `localStorage`, on the reasoning that the PDFs are
on the WhatsApp group and re-importing takes ten seconds. That held for the
rosters. It did not hold for the working state: a confirmation ticked on the
phone was invisible on the ward PC, and the evening round is done on both.

### What is synced, and how

**The parsed rosters, not the PDFs.** That means a few kilobytes instead of
megabytes, no Firebase Storage, and nothing to re-parse on the other device.

| Data | Firestore document | Rule |
|---|---|---|
| Jadwal Jaga, DPJP, Pediatri, Jarkom | `users/{uid}/jaga/{roster,dpjp,pediatri,jarkom}` | Stored as a JSON string, replaced whole. The later `importedAt` wins. |
| Confirmation ticks, tukar jaga, name and religion corrections, DPJP swaps, sender | `users/{uid}/jaga/state` | Written **one key at a time** |

**Why per key.** A device writes only the date+shift or the initials it
changed, using `setDoc` with `mergeFields`, so two devices ticking different
shifts cannot overwrite each other. Two alternatives were rejected:

- `merge: true` deep-merges. A tukar jaga replaced with one that has no
  `initials` would have kept the old initials.
- Rewriting the whole map from one device's copy is recurring patterns 1
  and 5.

**Why rosters are a JSON string.** A string accepts whatever the parser
produces with no Firestore type rules applying. `undefined` fields in state
values are stripped before writing (`toStorable`), because Firestore rejects
them.

**localStorage is still what the page reads.** Reads stay synchronous and
offline. Every store write also goes to the account through a `JagaRemote`
sink. `useJagaSync`, mounted on the Helper page, writes changes from other
devices back into localStorage and bumps a revision, and the page re-reads.
Changes made while the page is closed arrive the next time it opens.

### The first sync, where most of the risk is

- **Waits for the server's answer.** On a device's first sync Firestore's
  first snapshot comes from an EMPTY cache. Read as "the account has nothing",
  it would upload this device's old rosters over newer ones. Initial
  reconciliation therefore waits for a server-confirmed snapshot. Before that,
  cached data is applied, but nothing is uploaded or removed.
- **Merges without losing anything.** Nothing local is thrown away. Keys the
  account lacks are uploaded; where both sides have a key, the account wins.
  After that the account leads field by field, so a deletion on one device
  reaches the others.
- **Shared ward PC.** localStorage belongs to the browser, not to a person. A
  colleague signing in on a PC you used would have had your ticks, swaps and
  sender name uploaded into their account. The local copy is now claimed by
  the account that syncs it (`claimJagaLocal`). A different account clears it
  first, while unclaimed data from before this release goes to the first
  account that syncs.

### UI

- The note under the title no longer says changes stay on this device. A
  status line shows *Sinkron dengan akun* / *Menunggu koneksi…* /
  *Sinkron gagal…*.
- The WIP badge stays.

### Rules

`firestore.rules` gains `users/{uid}/jaga/{docId}`:

- owner only;
- create and update only for the five ids the app writes;
- no delete.

**This deploys through `firestore-deploy.yml` on push.** Until that workflow
has run, the sync fails with *Sinkron gagal* and the page keeps working
locally.

### Tests

- `sync.test.ts` (12): roster pick, first-sync merge, following the account,
  undefined stripping.
- `store.sync.test.ts` (12): each local write sends exactly one key, cleared
  values delete, nothing is sent when signed out, remote data is applied
  without an echo, and the shared-PC claim.

### Not done, and why

- **Rules not run in the emulator.** The sandbox cannot download it, so the
  rules are reviewed but not executed. Check the Actions run after pushing.
- **The hook's orchestration has no test.** The decisions it makes are in
  `sync.ts` and tested; the hook only sequences them, and testing it would
  need a Firestore mock.
- **State history is never trimmed.** Confirmations and swaps are kept
  forever, as before. That is a few hundred bytes per jaga, about 150 KB a
  year, well under Firestore's 1 MiB document limit for several years. It
  needs a trim rule before then.
- **Jarkom holds colleagues' phone numbers** and now lives in your account,
  readable by you only.
- **Nothing was run on two real devices.** The test is: tick a confirmation
  on the phone, then open Helper on the PC.

```
1319 tests passed (+24)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-17.2`

**Riwayat keeps Custom Checklist items that were checked and then deleted.**

### Root cause

The ward workflow is: tick a step, then delete it so the list stays short.
Delete removed the item from the array, and `todoHistory` skips ticks whose
id is no longer there, because the label left with the item. So the step
most certainly done was the one the history could not show. The history was
built on the assumption that deleting means "never mind", and here it means
"done".

### The fix

- **New optional field `removedOn: ClinicalDate`.** Deleting an item that was
  ever checked hides it instead of removing it. It keeps its label, stays in
  the history marked *(dihapus)*, and disappears from the list and its counts.
- **An item never checked on any day is still removed outright,** as before.
  That matches the request: checked-and-deleted is kept,
  unchecked-and-deleted is not.
- **"Ever checked", not "checked today".** A repeating item ticked yesterday
  and not yet today has real days of history, so deleting it keeps it.
- `removeTodo()` and `activeTodos()` are pure, in `patientTodos.ts`.
  `todoViews` shows only visible items.

**Trap caught before shipping (recurring pattern 1).** Import skipped labels
already present, checked against the **whole** array. With deleted items now
kept in that array, importing a checklist again the next morning would have
silently skipped every step deleted the day before. That is exactly the daily
cycle this feature is for. The check now uses visible items only
(`labelsToImport`, tested). Every write still sends the full array, so the
hidden items and their history are never rebuilt away.

### Not done, and why

- **Items deleted before this release are gone.** Their records were removed
  at the time, and nothing can recover them.
- **Hidden items stay in the patient document for the admission.** They are
  tens of bytes each, so a long stay adds a few KB. There is no purge,
  following the rule of no hard deletes without an explicit action.
- **Riwayat does not offer "restore".** Nothing asked for it, and re-importing
  or re-adding a step does the same job.

```
1295 tests passed (+8)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-17.1`

**Two copy paths that bypassed the formatter are fixed. Also new: peek
SIMGOS/WA as view switches, Salin RM in the peek, Custom Checklist history,
and comparing against a pasted revision.**

### 1. The `?` in SIMGOS: two paths that never formatted

**Evidence.** Two captures in **Periksa hasil salin** each showed exactly one
character, U+200B (zero-width space), at `baris 1:1`.

**Measurement, not reasoning.** I ran a note seeded with U+200B, U+00A0 and
friends through every composer in plain format:

| Path | Result |
|---|---|
| Laporan harian, per-section, document, Ringkas PDF, SOAP jaga, peek | clean |
| **Konsul** | U+200B and U+00A0 passed straight through |
| **Grup invasif** | U+200B and U+00A0 passed straight through |

**Root cause.** `composeKonsul` and `composeInvasif` returned their joined
lines as they were. They were the only composers that never called
`formatBody`, so for those two shapes:

- the Format chip did nothing, and "Teks polos" produced WhatsApp text with
  `*` markers still in it;
- invisible characters and NBSPs from the note reached the clipboard
  unchanged.

**Why nobody saw it.** The Salin sheet's non-ASCII warning was hidden whenever
"Teks polos" was selected. It trusted the format flag instead of looking at
the output, so the one case where plain output was *not* ASCII was also the
one case the warning could not show.

**Fix.**

- Both composers take `format` / `bullet` and end in `formatBody`. The
  default is WhatsApp, and the existing Konsul/invasif tests pass unchanged,
  so the formatter is idempotent on these messages.
- The warning is keyed on the output. With plain selected and non-ASCII
  present, it now says plainly that this is a Plano bug.
- Invisible characters in that warning are shown by code point. The old list
  printed a zero-width space as, effectively, nothing.
- **New invariant test** (`plainOutputAscii.test.ts`): every composer, listed
  by name, must produce pure ASCII in plain format from a note seeded with
  every character class seen in the corpus. With the fix stashed, 5 of its 12
  tests fail.

**Also hardened: the select-and-Ctrl+C sanitiser.**

- It read `document.getSelection()`, which does not reliably include text
  selected *inside a textarea*; Firefox returns an empty string. The note
  editor is a textarea, so in that case the sanitiser bailed out and the
  browser copied the raw text.
- It now reads the focused control's own selection range.
- Whether to fold to ASCII is now declared per element via
  `data-copy-format`, with the global flag as fallback. Several peek windows
  can show different views at once, and one global boolean cannot be right
  for all of them (recurring pattern 1).

**Not established.** Which path produced *your* capture. Both captures show
the character at 1:1, while Konsul and Grup invasif both open with a fixed
greeting, so the zero-width space should not be first in their output. The
checker now shows about 16 characters either side of every finding. The next
capture will say what the character sits next to, and which button produced
the text will settle it.

### 2. Peek: SIMGOS and WA switch the VIEW and do not copy

- Pressing **SIMGOS** shows `toPlain(body)` in the window; pressing **WA**
  shows `toWhatsApp(body)`. Pressing the active one returns to the note as
  written. Nothing is written to the clipboard.
- The window becomes the staging area: pick the destination, see exactly what
  it will receive, then select the part you need.
- The Salin sheet on the patient page is unchanged. It still copies and still
  does not change the screen. The two are deliberately different tools.
- The subtitle says which view is showing (`tampilan SIMGOS` instead of
  `hanya dibaca`).
- The `<pre>` carries `data-copy-format`, so a selection copied from the WA
  view keeps `°` and one from the SIMGOS view is folded.

### 3. Peek: Salin RM

- The number is shown in the subtitle (`RM 00452347`), and **Salin RM** in the
  title bar copies the digits only, matching the patient page.
- The minimum window width is now 360 px (was 280). With five fixed-width
  controls in the title bar, the patient's name was the only thing left to
  shrink, and at 280 px it shrank to nothing (recurring patterns 6/7).

### 4. Custom Checklist: Riwayat

- **Data model.** Repeating items already kept ticks per date in `todoTicks`.
  One-off items stored only `done: true`, which records *that* something was
  done but not *when*.
- **New optional field `doneOn: ClinicalDate`** on one-off items. It is set
  on tick and on switching a done item to one-off. On untick the key is
  *removed*, not set to `undefined`, because Firestore rejects undefined
  values.
- **`todoHistory()`** is derived, never stored, so a second record cannot
  disagree with the first. It groups by day, newest first, in list order.
  - Items ticked before this release are listed under *Tanggal tidak
    tercatat*. No date is guessed.
  - Ticks on deleted items are skipped, since their label is gone.
  - Past ticks of an item that has since become one-off are kept.
- **Riwayat** button in the Custom Checklist header, on the patient page and
  in the peek. It is read-only: ticking happens only on the list for the day
  on screen.

### 5. Bandingkan → Dengan revisi tempelan

- A second mode in the compare sheet (⇄): paste the revised SOAP and it is
  compared with the note on screen.
- **Abaikan format**, on by default, compares content only. A revision comes
  back through WhatsApp or SIMGOS, and both change markers, blank lines and
  spaces that nobody edited. Tested: a full SIMGOS round trip (no markers,
  CRLF, no blank lines, NBSP) reads as *no changes*.
- **Word-level edits.** A line that was edited rather than replaced shows as
  one row with only the changed words marked (`Atorvastatin ~~20~~ 40 mg`).
  A line is treated as edited when at least half its words survive; below
  that it shows as removed + added, because pairing unrelated lines reads
  worse.
- **Summary** (`n diubah · n ditambah · n dihapus`) and a **Hanya yang
  berubah** option that keeps one line of context either side.
- A `+ − ~` gutter carries the meaning as well as the colour.
- The pasted text is never saved. It lives in the sheet's content, which
  Radix unmounts on close.

### Wrong turns

- One `todoHistory` test fixture gave an open one-off item a tick *today*.
  The real write path cannot produce that, because `setRepeat` removes
  today's tick. I corrected the fixture, not the function.
- The first version of the revision rows placed all edits before unpaired
  removals, which could move an edit above a line that preceded it. Rows now
  keep their position.

### Not done, and why

- **No "Pakai versi revisi" button.** Adopting someone else's text into the
  note is an edit, and it should be a deliberate step of its own.
- **The WA view with the "guarded" bullet style.** The copy sanitiser strips
  zero-width characters from every manual copy, so guards shown in the WA
  view do not survive select-and-copy. That was already the sanitiser's
  behaviour and is unchanged.
- **Riwayat shows the clinical day, not the time.** Neither kind of tick has
  ever stored a time, and inventing one would be worse than leaving it out.
- **Not rendered.** The sandbox has no browser. Worth checking:
  - the peek title bar at 360 px wide;
  - a Konsul copied as Teks polos (it should have no `*`);
  - a real chief revision pasted into Bandingkan.

```
1287 tests passed (+34)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-16.5`

**The peek window's Checklist, Custom Checklist and Catatan pasien are one row
of tabs now.**

### Root cause

These were three stacked collapsible strips, each a full-width row with a
44 px tap target and its own border. The problem was the structure, not the
padding:

- **Closed**, the three strips cost about 135 px of a 380 px window, and the
  note (what the window is for) got roughly a third of the height. Your
  screenshot shows this: four windows, each mostly labels.
- **Open**, each strip added its own panel of up to 160 px, and nothing
  stopped all three being open at once. Stacked accordions add up, so the note
  body could be squeezed to zero.

Shrinking the padding would only have made the same stack smaller. It would
still grow with every strip added.

### The fix

- **One bottom row, three tabs.** Closed, it costs one 44 px row instead of
  three.
- **One panel slot.** Only one tab is open at a time. Pressing the open tab
  closes it, and pressing another switches straight to it. The panel is capped
  at 45 % of the window height and scrolls inside itself, so the note always
  keeps the rest.
- **The panel opens above the tabs,** so the row never moves. Switching from
  Checklist to Catatan is two presses on the same spot.
- **Counts are badges** that never truncate. When space is tight the label
  shortens ("Custom Chec…") but "0/1" stays whole. A badge is tinted when
  everything is done. Catatan pasien shows a dot when it has content, and a
  tab with nothing in it is dimmed.
- Tabs size to their label (`flex-auto`), so the short "Checklist" does not
  take the space "Custom Checklist" needs.
- The row keeps `pr-6` so the last tab stays clear of the resize grip.
- The tabs are disclosure buttons (`aria-expanded`/`aria-controls`) rather
  than ARIA tabs, because a tablist must always have one tab selected and this
  row can have none. The full label and count are in `aria-label`.
- The content is unchanged. The panel shows the same live checklist, the real
  `PatientTodos` in compact mode, and the same standing note. What is open is
  still not remembered.

### Not done, and why

- **Tabs stay 44 px tall.** That is the project-wide tap-target rule
  (`check:a11y`), and peek windows are not limited to mouse screens. A
  fine-pointer variant at around 32 px would save another 12 px on ward PCs,
  but it would be the first `pointer: fine` rule in the codebase. That is a
  decision for you, not something to slip into this release.
- **The title bar was not touched.** It is the other large block in the
  window, since the SIMGOS / WA / Buka / ✕ buttons are 44 px each.
  Compressing it is the next win if the note is still too short.
- **Not rendered here.** The sandbox has no headless browser, and the browser
  download host is not allowed. Typecheck, lint and tests pass, but the layout
  has not been seen. Please check on a ward PC with 3–4 windows open,
  including one resized to its 280 px minimum width.

```
1253 tests passed
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-16.4`

**"Pakai format ini" changed the button and not the text. Lint now fails on
any warning.**

### Root cause

The six lint warnings had been sitting in `verify` output while every entry
here said "lint — clean". That was true only of errors. `exhaustive-deps` was
set to warn, and a warning that does not fail the pipeline is a list that
grows quietly.

One of the six was a real bug. In Salin, the Ringkas report read the
consultant's switches (`active?.plainText`, `?.staffing`,
`?.verificationTime`) inside a `useMemo` that listed none of them. It also did
not list `applied`, the flag that selects them. So the memo only recomputed
when something *else* changed.

**How it showed on the ward:**

1. Ringkas (PDF) is already selected.
2. You press **Pakai format ini** for ZD.
3. The button turns to *Format ini sedang dipakai*.
4. `setShape('ringkas')` is a no-op, so nothing the memo watched had moved.
5. The copied text has no *Jam verifikasi* line. For MZ, the staffing lines
   and markers stay in.

The output kept the old shape until you typed a character or touched a chip.
That is the exact failure the comment above `applied` warns against: a control
that says one thing while the output is another.

Reading the state around it turned up two more faults in the same family:

- **`applied` did not reset on reopen.** The sheet stays mounted with the
  patient page, and opening it resets the shape. The flag survived, though, so
  a reopened sheet could show a disabled "sedang dipakai" over a shape the
  consultant never asked for, with no way to press it again.
- **`applied` was a boolean.** It remembered *that* a format was applied, not
  *whose*. If the note's DPJP Utama line was edited while it was `true`, the
  new consultant's switches took effect without anyone pressing anything.

### The fix

- **`appliedFor: string | null`** holds the DPJP id instead of a boolean.
  `appliedReportConfig()` returns the config only while that id matches the
  note's consultant, so a stale application stops matching on its own. The
  flag also resets whenever the sheet opens.
- **`consultantReportOptions()`** resolves the three switches to plain values
  *before* the memo, and the memo depends on those values. This makes the
  dependency list complete by construction. It also stays stable across
  renders, which the config object would not guarantee.
- Both helpers are pure, live in `pdfReport.ts`, and have 7 tests.

**The structural guard:** `exhaustive-deps` is now an **error**, and `npm run
lint` runs with `--max-warnings 0`. From now on there are only two states,
clean or red. I confirmed the guard actually fails by appending an unused
disable directive and watching lint exit 1.

### The other five warnings, individually

| Where | Verdict | Change |
|---|---|---|
| `CopySheet` open effect (`activeShiftNote`) | Deliberate: it depends on the id so the shape does not reset mid-typing | The id is read into `shiftNoteId` before the effect and used inside it. Same behaviour, and the list is complete as written |
| `CopySheet` `selected` memo (`body`, `aliases`) | Unnecessary deps left behind by the switch from section ids to groups | Removed |
| `CompareSheet` diff memo (`leftPane`, `rightPane`) | Safe: it listed `.body` while reading the pane objects | The bodies are taken out as strings first. Still no re-diff on unrelated renders |
| `DocumentPage` title effect (`document`) | Safe: it listed `id` and `title` | The same fields are read into consts first |
| `formatters.ts` unused `eslint-disable no-control-regex` | Stale | Removed |

None of the "deliberate" omissions needed a suppression comment. Each one was
really "depend on a field, not the object", and the way to say that is a
const declared before the hook. The comment in `eslint.config.js` that
justified `warn` is rewritten to say so. It also names the escape hatch: a
line-level disable with its reason, visible and greppable.

### Wrong turn

My first draft of this change cited this release's version in two code
comments. `check:version` rejected both, correctly. They now point at
`CHANGES.md` without naming a version.

### Not done, and why

- **No component test for the memo itself.** The suite does not render
  components (there is no `@testing-library`), and adding a DOM test harness
  for one regression is a bigger decision than this fix. The lint rule is now
  the regression test for this class of bug. The tests cover the resolution
  logic.
- **The `DocumentPage` title draft does not stop following the stored title
  once the field is touched**, although the comment above it says it does. If
  another device renames the document while you are typing, your draft is
  overwritten. This predates this change and was not touched here. It needs
  its own decision, whether to add a `touched` flag or to commit on blur only.
- **Nothing was run on a device.** Worth checking on the ward: open Salin →
  Ringkas (PDF) → Pakai format ini on a ZD patient. The *Jam verifikasi* line
  should appear immediately.

```
1253 tests passed
typecheck / lint (0 warnings, enforced) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-16.3`

**Custom Checklist in the peek window, and one name for it everywhere.**

### The name

`Checklist pasien` → **`Custom Checklist`**. One instance in the codebase, and
that is the point of changing it now: the daily checklist, the per-patient one
and the note strip were close enough in name to be confused, and the peek
window was about to show two of them one line apart.

The import link inside it now reads **"Ambil dari checklist harian"** rather
than "Ambil dari checklist", which named neither of the two things it sits
between.

### In the peek window

A third strip, between the daily checklist and the standing note.

It renders the **real `PatientTodos`**, not a read-only copy — so ticking,
adding and importing behave exactly as they do on the patient page. A second
implementation would be a second thing to keep in step, and the first time they
disagreed nobody would know which was right.

It reads the day ON SCREEN, like everything else in this window: a peek at an
older note shows that day's ticks, not this morning's.

`PatientTodos` gained a `compact` flag that drops its own heading, because the
strip already names it and two headings one line apart reading the same words
is how a 420 px window runs out of room for the thing it is showing. The counts
move to the strip label, so they are visible while it is closed — which is
usually all anybody wants from it.

```
1246 tests passed
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-16.2`

**Several peek windows at once, a visible resize grip, Salin, a date chip, and
collapsible checklist and standing note.**

### More than one window

One peek at a time is a sheet with extra steps. The case this exists for —
comparing two patients, or keeping one open while working through the others —
needs more than one.

`previewIds` is an array, and **the array IS the z-order**. Bringing a window
forward is moving its id to the end; nothing tracks a separate stacking number
that could drift out of step with the list. Pressing anywhere in a window
focuses it, which is last-touched-on-top — the rule every window manager uses
and the only one nobody has to be told.

Two details that only show up with several open:

- **First placement cascades** by 28 px per open window. Two landing on the
  same pixel look like one, and the second appears not to have opened.
- **A window survives a filter change.** The patient is looked up in the full
  list, not in the filtered cards, so searching does not close the window you
  were reading.

Re-peeking a patient already open brings that window forward rather than
opening a second copy of it.

### A visible resize grip

Two short strokes in the corner, the convention every desktop window uses,
drawn in the border colour so it reads as part of the frame rather than as a
control competing with the buttons above. It was a transparent 16 px square —
a feature nobody could find.

### Salin, in the two formats that leave the app

Not the full Salin sheet: that offers sections, presets, a preview and an
identity line, and a 420 px window is not where any of that gets chosen. What
is wanted from a peek is the whole note, now, in the form it is about to be
pasted into — so the two destinations are two buttons and there is nothing to
configure.

`toPlain` for SIMGOS, `toWhatsApp` with the user's bullet setting for WhatsApp
— the same functions the main sheet calls, so a note copied from here and one
copied from there are identical.

### The date is a chip

With several windows open, "hanya dibaca" is the same on every one and the date
is the only thing that differs. It is now a chip, tinted differently when the
note is not today's — a note from three days ago read as today's is the mistake
this window makes easiest.

### Checklist and Catatan pasien

Two strips that open, closed by default. They are the reason somebody peeks at
a patient they are not going to open — "did anyone do the EKG", "what was the
access problem" — and both are short.

The checklist is **live**: ticking here writes through the same controller the
patient page uses. It reads the day ON SCREEN, not today, so a window opened on
an older note shows that day's ticks.

Neither strip's open state is remembered. A window is a moment — opened to
answer one question and closed again — so restoring it would restore the state
of a question somebody already finished asking.

```
1246 tests passed
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-16.1`

**Buka and ✕ on the peek window did nothing.**

The title bar is the drag handle and also carries both controls, and the drag
handler called `setPointerCapture` on every `pointerdown` inside it — including
presses that landed on a button.

Capture retargets every subsequent pointer event to the capturing element, so
the `pointerup` never reached the button underneath and no click was ever
generated. The bar dragged perfectly while both controls were dead, which is
why it looked like a styling problem rather than a gesture one.

A press that starts on a `button` or an `a` is no longer a drag. Checked on the
event TARGET rather than by moving the handler somewhere narrower, because the
whole bar should stay draggable — the space around the title is the obvious
place to grab a window from, and putting the handler on the title text alone
would trade two broken buttons for a handle nobody can find.

The resize grip is itself a button, so the check only applies to the move
gesture; its own press must still start a drag.

Both controls also got proper tap targets now that they are actually
pressable — they had been sized as decoration.

```
1246 tests passed
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-14.5`

**The checklist tick was never being saved. And the peek is a window now.**

### Why the ticks kept disappearing — and why yesterday's fix did not help

Not the sync race fixed in `2026-09-14.4`. The tick was **never saved in the
first place**, so there was nothing for any sync to lose.

The handler was React's `onChange` on the contenteditable container. React's
change plugin handles checkboxes through `click`, and only for inputs React
itself rendered. These boxes are inserted by `execCommand` into a
contenteditable, so they have no fiber. React walks up to the nearest element
it does know — the `div` — sees that a `div` is not a checkbox, and dispatches
nothing.

The `onChange` prop looked correct, had a comment explaining exactly the right
thing about attributes versus properties, and had simply never run. The box
ticked on screen because the browser ticked it; nothing wrote it down, and it
came back blank the next time the note was read from storage.

Bound natively now, on both `change` and `click`. The redundancy is cheap
because the handler is idempotent — it reads the box's own state rather than
toggling anything — and it is worth having because whether a given browser
fires `change` for a synthetic checkbox inside a contenteditable is not
something to rely on.

The attribute is still what gets written, for the reason the old comment gave:
`innerHTML` serialises attributes and ignores properties.

### The peek is a floating window

A sheet is modal — it covers the board, and closing it is the only way to see
the board again. That is the wrong shape for what this is used for: reading one
patient's note WHILE looking at the others, comparing a plan against the card
beside it, keeping a note open while writing a report. Every one of those needs
both things visible at once, and a sheet makes them alternate.

It is now a panel dragged by its title bar, resized from the corner, closed
with Escape or ✕.

- **Position is not persisted.** A card's position on the canvas is saved and
  has to survive a different screen; this window lives for as long as it is
  open. It is placed once per patient, offset from the top right — unless you
  have already moved it, because a window that jumps back on every peek is one
  you reposition every time.
- **The title bar can never leave the viewport.** A window dragged past the
  edge has no handle left to drag it back by.
- **The header carries the full identity**, not "Pratinjau". On a board of
  twelve this is often one of several things being read at once, and a panel
  you have to click into to identify is not much of a peek.
- **Still read-only.** Nothing typed here could be saved anywhere, so there is
  nothing to type into — a read-only window cannot leave a half-written note in
  a chart nobody is looking at.

Both axes resize from one corner grip, unlike the board cards where they are
deliberately separate: a window has no neighbours to disturb, so there is
nothing for a stray pixel of the other dimension to break.

```
1246 tests passed
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-14.4`

**Salin RM; the Catatan checklist that vanished on a tab switch; Rapikan SOAP
without AI.**

### The checklist was not removed, it was overwritten

A lost update, and the mechanism is worth stating because it will recur
wherever a list lives in one document.

The Catatan notes are ONE Firestore document holding an array, so saving any
note rewrites all of them. Each save built that array from the `notes` value
its own render closed over — and a tab switch fires two saves in quick
succession: a flush for the note being left, then a save for the note being
entered.

The second save's array came from a render that had **not yet seen the first
echo back**. It carried the old body for the note just left, and overwrote the
checklist added seconds earlier. Read-modify-write, with the read too old.

It was intermittent because it depends on whether the subscription echoed
between the two writes, which on a fast connection it usually does.

Bodies now sent and unconfirmed are kept and replayed over every subsequent
array — including the archive toggle and the drag-reorder, which rewrite the
same array and would revert an in-flight body the same way. Entries are dropped
by **value**, not when the write resolves: a resolved promise says the request
was accepted, not that this is what the document holds. Another device may have
written in between, and then the pending value is genuinely stale and must stop
being replayed.

### Salin RM

Beside the identity row. It is the single most retyped thing in the app — every
SIMGOS search, radiology request and consult starts with it, eight digits that
are wrong if one is — and it was readable but not copyable, which meant reading
it off the screen and typing it back in. The exact transcription this app
exists to remove.

It copies the digits alone, with no `RM ` prefix, because it is going into a
search box that wants the number. A sibling of the identity button rather than
nested inside it: a button within a button is invalid HTML that browsers
resolve by dropping one.

### Rapikan SOAP, now deterministic first

The sheet no longer needs an API key. Two passes run with no model and no
network, both read off the worked bangsal note:

**`autoEmphasis`** puts the markers where that format has them — identity bold
(matched on the RM number, not the slashes, since a therapy line is full of
slashes too), every `DPJP` line italic, the referral sentence italic, `S :` /
`O :` bold, the request lines and `Plan :` bold, `TS <Bagian>` and `A/` bold,
and every investigation heading bold.

An investigation heading is recognised by **modality + a date on the same
line**. That is what keeps it off the findings underneath: `EKG di PJT
(02-09-2026)` is a heading, `Ventricular pacing rhythm, HR 60 bpm` is not.

`Selesai:` is left plain, because it is plain in the worked note. The point is
to reproduce that format, not improve on it.

Idempotent by construction — every rule skips a line already carrying a marker,
so running it twice cannot produce `**S :**`, and a line somebody formatted by
hand is never touched, **including where they chose differently**.

**`orderInvestigations`** then sorts the blocks into ward order, run after the
markers so the heading it sorts by is the one the note ends up with.

The AI pass stays, moved behind them as "Perbaiki lagi dengan AI" and handed
the deterministic result rather than the original — the same relationship the
CVCU reformatter already has. "Kembali ke hasil otomatis" is one press away.

```
1246 tests passed (was 1227 — 19 added on emphasis and pending writes)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-14.3`

**Arranging a Titipan card erased every position in Pasien saya.**

### Root cause: a stored map rebuilt from a filtered view

`commit` wrote the resolved layout as the WHOLE stored map. That was
deliberate — it is what stopped the board rearranging itself on every resize,
fixed on 11 September — but "the whole board" is only ever the scope on screen.

The store is a single map covering every patient. The ids handed to `placeAll`
are just the ones the current filter admits. So dragging a card in Titipan
wrote back a map containing only the Titipan cards, and every position in
Pasien saya was gone. The reverse held too.

**This is the same failure as rebuilding a stored list from a filtered view** —
the one guarded against in `reorderWithinVisible` when the Catatan tabs got
drag-reordering, and not guarded against here, because the canvas was written
first and the filter arrived later.

`mergeLayouts` now merges rather than replaces: every id the current view
cannot see is kept, and the resolved entries still win for the ids it can —
which is what freezes the visible board so a commit does not move its
neighbours. Applied to all three write paths: drag, resize, and
Rapikan/Urungkan.

**Positions already lost cannot be recovered** — they were overwritten in
localStorage, not soft-deleted. The affected scope will auto-place its cards
into the default grid on next load, and can be rearranged from there.

```
1227 tests passed (was 1223 — 4 added on the merge, including the reported case)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-14.2`

**"Ringkas perjalanan pasien" — the summary you read out when a consultant
asks who this patient is.**

In the ⋯ sheet, behind its own switch in Pengaturan → Fitur AI. Off by default
like the others.

```
Identitas · DPJP · Diagnosis · Perjalanan singkat ·
Keluhan sekarang · Terapi saat ini · Plan / KJS
```

### Why a model belongs here and not in the other four

Every other AI feature in Plano competes with deterministic code that does the
job better: the section parser is lossless, the lab parser is exact, the
checker compares two numbers. This one has no deterministic equivalent, because
the task is not transformation — it is deciding which three weeks of daily
notes matter and which do not, and saying it in the order a DPJP expects to
hear it.

It also cannot damage anything. **Nothing is written back to the note**, and
there is deliberately no "insert into note": a summary is a retelling,
retellings lose things, and that is fine when you are standing next to the
patient and terrible when it is filed.

### Which days get sent

A three-week admission is more text than one request can carry, so something
has to be dropped and WHICH is the whole decision.

| Kept | Why |
|---|---|
| The admission note, always | Identity, referral, presenting problem, first assessment. Without it the summary has to infer why the patient is in hospital from a mid-stay note that assumes everyone knows |
| The most recent days | "Keluhan sekarang" and the current plan exist nowhere else |
| **The middle is what goes** | Its content is largely carried forward into the days either side. A gap there costs a detail; a gap at either end costs the shape of the story |

The dropped dates are reported twice — to the user, above the summary, and to
the model inside the transcript. A gap the model does not know about is a gap
it will narrate straight through, and a summary that silently skipped a week is
one nobody can trust.

### What it is told not to do

The failure mode of a summary is not a wrong word. It is a confident number
that was never measured — so everything here is a quotation rather than a
calculation: no changed figures, doses, units or dates; nothing concluded that
is not written; no clinical advice; "terapi saat ini" excludes anything marked
finished; "keluhan sekarang" comes from the last day only.

The identity line is shown from the patient record, beside the summary, and
labelled as not coming from the model — the one field where a plausible
invention would be hardest to notice and worst to read aloud.

Available on a **locked** day too, unlike the other AI actions: a locked note
is one you are reading out rather than editing, which is exactly when this is
wanted.

```
1223 tests passed (was 1215 — 8 added on which days get selected)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-14.1`

**A false KJS badge that no rebuild could clear; an AI checker that reported
work already done; the 2026 Jarkom sheet.**

### The rebuild could not fix a false positive

Ny. Rukiah's note names four consultants — Kardio, Tindakan, Aritmia, EMD —
and no `Utama` line. Under the current rule that is `null`, correctly. She was
still badged `KJS · Kardio`, because the value was written by the PRE-13-
SEPTEMBER rule, which fired on any `DPJP Kardio` line at all.

And "Perbarui kartu pasien" could not clear it. The rebuild copied the write
path's rule that **absence is not a correction** — `if (kjs) fields.kjs = kjs`
— so a recomputed `null` was quietly skipped and the wrong badge survived every
rebuild.

The two are not the same act. On a write, a note that names nobody must not
erase a role set from a note that did: the user is mid-edit and the old answer
is still the best one. A rebuild exists BECAUSE the rule changed, and its whole
job is to replace old answers with what the rule now says — including
"nothing". It now clears the field.

**Run Pengaturan → Perbarui kartu pasien once after installing this.**

### The AI checker reported things that were already updated

It announced that a lab planned yesterday had no result, and that a urinalysis
was not in the assessment, when both were written in the note it was reading.
A checker that reports work already done gets ignored — and takes its true
findings with it.

Three changes to how it is asked:

- **Both dates are now given to it.** It had been dating findings by guesswork,
  which is how a result headed with today's date got reported as yesterday's.
- **A verification step, stated as a procedure:** for anything it intends to
  report, search TODAY's note first; if the result is there, say nothing —
  even if the plan line is still written. If unsure, say nothing.
- **`H-2` means HARI KE-2**, not two days before something, and tomorrow is
  `H-3`. The count runs forward. The one exception is discharge planning,
  where `H-1` does mean tomorrow, and that is stated too.

The deterministic rules are untouched. They never had this failure, because
they compare two numbers rather than forming an opinion.

### The 2026 Jarkom sheet

Parses: **91 residents**, and the identifier recognises it unchanged.

It also carries a second table on the right — `list NIM Semnol` — which is
read now. Those are the PJ-Jarkom seniors, and they are exactly the 14 names
that previously had no row of their own and fell back to the neutral greeting
forever. They arrive with **no agama**, because that side of the sheet has no
such column; the confirmation row shows "Agama?" and takes a correction rather
than guessing.

**Paediatrics nicknames now resolve for the greeting.** That sheet gives a
short name and nothing else — `Suci`, `Ken`, `Dira` — so the agama is looked up
by nickname, tolerantly: `Fatur` on the roster is `Fathur` in Jarkom, and
`Auri` is `Aurea`. The same one-edit rule the full-name matcher uses.

```
1209 tests passed
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-13.10`

**Jadwal Jaga Pediatri is the fourth import.**

### What the brackets meant

Confirmed from the group message, and it changes who gets contacted: a
bracketed name is a **PPDS BTKV**, not a cardiology resident. Taking it as the
person on call would have sent the confirmation to somebody who cannot answer
for a cardiology post — and whose own confirmation goes through Kardio anyway.

So the pair prints as the group writes it, `Raden (BTKV)/ Ken`, and only the
cardiology name gets a confirmation row.

### A comma is a shift, not a second person

`Rizki, Ken` is Rizki on pagi and Ken on malam. `(Kifli) - Galih, Dira` is
Galih with Kifli on pagi, Dira on malam — the BTKV name attaches to the half it
is written on, so `Fatur, (Kifli) - Suci` puts Kifli on the malam side.

One name covers the whole day, **including Saturdays**: paediatrics still
counts as dinas, so the sheet prints a single name where the cardiology roster
splits the day. Asking for the "pagi" of a one-name Saturday returns that
person rather than nothing.

### The year comes from the date you are viewing

The sheet spells out the month and never the year, so there is nothing in the
document to read. Taken from the selected date rather than from `new Date()`:
importing December's sheet in January still dates it to December, as long as
you are looking at the month you are importing.

### Where it sits in the chain

```
manual swap  >  paediatrics roster  >  nothing
```

Paediatrics is the one post the main roster leaves blank, so this is the only
place its name can come from other than by hand — but a swap still wins,
because the roster is right about the schedule and a swap is right about
tonight.

The import is identified by its `PPDS Jaga` / `Petugas Jaga` column header, and
tested **last** of the four: its title is just `Jadwal Jaga <bulan>`, which any
of these documents could claim.

```
1209 tests passed (was 1195 — 14 added on the parser and the paediatrics post)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-13.9`

**Confirmation wording matches the sent messages; investigation order
corrected to spec; two transforms the reformatter was missing.**

### The post names in the confirmation message

Taken verbatim from the message file:

| Formasi prints | Message asks |
|---|---|
| IGD A | `*Jaga IGD A*` |
| CVCU | `*Jaga CVCU PJT*` |
| RSWS/UH | `*Jaga RSWS/UH*` |
| Bangsal B | `*Jaga Bangsal PJT B*` |
| Chief Non PJT | `*Chief Jaga Non-PJT*` |
| Chief Konsul | `*Chief Konsul*` |

Its inconsistencies are kept, not tidied: `Chief Konsul` and `Chief Jaga
Non-PJT` carry no `Jaga` prefix while every other post does, and `Non-PJT` is
hyphenated where the roster column is not. This string is read by a senior
checking it against their own roster line, and a version that is neater than
the one everybody else sends is a version that reads as a different post.

### The swap tag moved onto the message box

It was a small grey word on the row above. The box is what gets copied and
sent, and a swap is the one thing about that message not in the roster anybody
else is reading — so it is marked where the text is, seen by the person about
to press Salin rather than before they have decided to.

### Import cadence

Jarkom is labelled **per semester**. New residents arrive twice a year, and a
monthly prompt for a document that changes every six months is a prompt people
learn to ignore. The two rosters stay monthly.

### Investigation order — the specified one, not an inferred one

```
EKG · Laboratorium · Urinalisa · ADT · Foto Thorax · CT · USG · Echo ·
LUS · Laporan Tindakan
```

Three corrections against the version inferred from note samples:

- **Urinalisa and ADT had no rank at all** and therefore sorted to the end,
  below the imaging.
- **USG now comes before echo**, rather than being lumped in with lung
  ultrasound after it. LUS is matched first in the table precisely because
  both contain "ultrasound" — reversed, `Lung Ultrasound` would take the
  generic USG rank and land two places early.
- **`Laporan …` blocks** — the TPM and PPM implantation reports — were
  unranked and stayed wherever they started. They now close the run.

Inferring the order from two samples was the mistake. Two notes agreeing says
they were written by one person on two days, not that the order is the ward's.

### Two transforms the reformatter never did

Both visible in the worked CVCU → bangsal pair, neither implemented before.

**Finished drugs move out of the active list.** A CVCU note marks them inline —
`• CA Gluconas … (selesai)` — because there the list is a running record of
everything given. A bangsal note separates them: the active list is what the
nurse is still giving today, and a finished drug sitting in it is an
instruction to continue something that has stopped. The marker is dropped on
the way, since repeating it under a `Selesai:` heading is how a heading stops
being read.

Only lines that SAY so are moved. A drug that finished in real life but is not
marked stays where it is — the note is the only evidence there is. And a blank
line does not end the block: these lists are written with gaps between groups,
and stopping at the first would leave half the list unexamined.

**`•` becomes `- `.** Not cosmetic: `•` is not ASCII, so every one of them
reaches SIMGOS as a `?` — the bug chased through four releases this month. A
note that has been through this transform can no longer carry them onward, and
this pass runs even on a note the rest of the transform cannot restructure.

### The AI fallback was returning a different document

Asked to tidy, it produced `# CATATAN PERKEMBANGAN TERINTEGRASI` with markdown
headings and regrouped sections — a rewrite, not a repair. Asking for a
tidy-up without saying what the target looks like invites exactly that.

The prompt now states the target shape explicitly: a WhatsApp note, no
markdown, `*tebal*` and `_miring_` preserved, the section order, the
investigation order above, and newest date first within a modality.

```
1195 tests passed (was 1185 — 10 added on the therapy split and bullets)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

**Not in this release:** the paediatrics roster PDF. Its shape is different
from the other three — dates against nicknames, two month sections, and
parenthesised names whose meaning I do not know yet (`(Kifli)`, `(Raden)`).
Parsing it on a guess about what the brackets mean would put the wrong person
in a report.

---

## `2026-09-13.8`

**Tukar jaga picks a PERSON; religion is correctable; the local-edit rule is
stated on screen.** Still WIP.

### Swapping names a person, not a string

A tukar jaga is "Rheza is on for Jordy". Typing that as free text loses
everything else about them — and the thing lost is the one that matters: their
agama, and therefore the greeting the confirmation message opens with. A swap
entered as bare text silently kept the PREVIOUS occupant's religion.

So a swap now stores `{ name, initials, muslim }`, picked from this month's
rota. `buildDirectory` joins the roster legend to Jarkom once; the legend is
the spine, because it is who is actually on the rota — a resident in Jarkom who
is not rostered cannot be swapped in, which is correct.

**Searched by nickname first**, because that is what a resident is called and
therefore what gets typed: "Rheza" has to reach `dr. M. Rheza Rivaldi Salam`.
Exact initials outrank everything (`AV` means that person), then nickname,
then any part of the full name.

**Free text still works**, and deliberately. Paediatrics keeps its own roster
and never appears in the legend, so that name can only ever be typed — a picker
that refused anything off-list would make the one post needing hand entry the
one post it could not do. A typed name commits on blur.

The list appears only while typing. Nine of ten rows are already correct, and a
control demanding attention on all ten to fix one is a worse trade than a field
that looks like text until you use it.

### Religion, three states

Jarkom is a semester old and the rota is not, so a resident who joined since
has no row, no agama, and the neutral greeting forever. Each row now carries
`Otomatis / Muslim / Non-Muslim`, keyed by **initials** — a person's religion
is not a property of a shift.

Three states rather than a toggle: "Otomatis" is what Jarkom said, which is a
different thing from an explicit answer. A two-state control would commit a
guess for everybody the first time anyone touched it.

It applies to **whoever is actually on**: a correction follows the swapped-in
resident, not the post.

### The edits are local, and that is the design

Now said on the screen where they are made rather than in a help page nobody
opens:

> Perubahan di layar ini (tukar jaga, nama, agama, DPJP) tersimpan di perangkat
> ini saja dan hanya untuk tanggalnya. Sumber utamanya tetap PDF jadwal.

Re-importing a new month replaces the schedule wholesale and a swap entered
against an old date stops applying. That is intended, not a limitation: a tukar
jaga is a fact about one night, and carrying it into a schedule nobody has
checked it against would be worse than losing it.

```
1185 tests passed (was 1174 — 11 added on the directory, search and swaps)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-13.7`

**Konfirmasi Jaga: tukar jaga, the paediatrics name, and DPJP swaps — all
editable.** Still WIP.

### Two kinds of "wrong name", kept apart

This is the decision the rest of it hangs on.

| | Keyed by | Means | Applies to |
|---|---|---|---|
| **Koreksi nama** (existing) | initials | the roster is right about the day, the MATCH is wrong | every shift that person appears in |
| **Tukar jaga** (new) | date + shift + post | the roster is right about the person, and wrong about TONIGHT | that one shift |

Writing a swap into the by-initials map would rename that resident in every
other shift on the board — a worse error than the one being fixed, and one
nobody would connect back to a swap entered days earlier. So the inline name
field now edits the DATE, which is what a tukar jaga is, and a **"Selalu"**
link beside a swapped name promotes it to the permanent correction when the
roster is the thing that is wrong. Two presses for the rare case, none for the
common one.

### The paediatrics row

Every post now renders, including the ones with no initials. Paediatrics keeps
its own roster that only they see, so its column is blank in every row — its
name can only ever arrive by hand, and until now there was no hand to arrive
by.

A post filled in this way is a **real** post: it prints in the Formasi, it
carries `(belum konfirmasi)` until ticked, and it counts in the outstanding
total. Keying "staffed" on initials alone had left that resident permanently
unconfirmable.

### DPJP swaps

Under the Formasi, "Ubah DPJP (tukar jaga)". Each field replaces only itself —
a swapped Utama does not imply a swapped Tindakan — and an empty field falls
back to the imported roster rather than printing blank.

**Edited by DATE, not by position.** The pair after 00.00 is the next calendar
day's row, so an edit made tonight against "setelah 00.00" is the same edit
read tomorrow as "hari ini". Keying it by position would need it entered twice
and would drift the moment one of them was.

It also works with no DPJP roster imported at all: filling both fields by hand
produces the block.

```
1174 tests passed (was 1168 — 6 added on the swaps)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

All three edits are per device, like the rosters themselves, and clearing a
field restores what the schedule said rather than erasing the line.

---

## `2026-09-13.6`

**Catatan pasien opens when it has something in it; a new checker rule and a
rewritten AI prompt, both derived from counting the export rather than
guessing.**

### Catatan pasien

Collapsed-by-default made sense when the section was empty on most patients. It
stopped making sense the moment it was used: a standing note is allergies, an
access problem, a DPJP's request — things that exist precisely because somebody
must see them without being told to look, and a one-line truncated preview
behind a `+` is the opposite of that.

It now opens when the note is non-empty, from a one-shot initialiser so it does
not fight you afterwards — collapse it and it stays collapsed for that patient.
And the collapsed preview shows the **whole** note, wrapped, rather than the
first line truncated: closing the section says you do not want it taking the
space, not that you want two thirds of a sentence.

### What actually gets updated, counted

Diffed all 97 consecutive day-pairs in the 2026-09-11 export. What changes,
by frequency: vitals (272 lines), therapy (270), subjective (211), plan (108),
lab (104), EKG (92), diagnosis (86), echo (68), day counters (52), urine and
balance (35), consults (17).

Then the more useful measurement — which whole blocks are copied forward
UNCHANGED:

```
urine      identical  13 / 41   (31%)
balance    identical  12 / 30   (40%)
echo       identical  75 / 93   (80%)
foto thorax identical 68 / 84   (80%)
terapi     identical  17 / 93   (18%)
vitals (whole block)   5 / 94   ( 5%)
```

**New rule: urine output and fluid balance unchanged from yesterday.** They are
daily measurements like the vitals and the two most often copied forward
untouched — about a third of the time, against 5% for the vitals block.

**Echo and chest films are deliberately NOT checked**, despite being identical
80% of the time. There the sameness is correct: the study was not repeated. The
distinction that matters is whether the number is measured every day, not
whether it changed — and a rule that fired on every echo would bury the real
findings under two that are always there.

The same numbers rewrote the AI prompt. It now lists the nine fields that move
daily, ordered by how often they move, and — just as importantly — an explicit
"this is not a mistake" list naming echo, thorax, MSCT, old ECGs, unchanged
diagnoses and risk factors. Without that the model reports them, because they
genuinely are identical to yesterday.

```
1168 tests passed (was 1164 — 4 added on urine and balance)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

**Measured but not built:** a rule for a drug in the active therapy list that
also appears under `Selesai:`. Only one note in the whole export has both lists
in a parseable form, which is not enough to write a rule against — it would be
a guess wearing a test.

---

## `2026-09-13.5`

**The H- rule in the SOAP checker has never fired. Fixed.**

Not the AI — a wiring bug of mine, present since the checker shipped in
`2026-09-12.8`.

`PatientPage` passed `dayMarkersDismissed: staleMarkers === null`. That reads
null as "the user has dealt with the counters", but `staleMarkers` is null in
three situations and only one is a dismissal:

1. nothing has happened yet — the ordinary case, every note you open
2. carry-forward ran and found no counters
3. the user pressed "Sudah"

So the rule was suppressed on essentially every note. The only window where it
could fire was the moment right after a carry-forward — when the dedicated
banner is already showing the same thing. It therefore contributed nothing,
ever.

**And it did so quietly, which is the part worth recording.** A check that
finds nothing looks exactly like a check that is switched off. Five of the
checker's rules were working, so the panel appeared, behaved, and gave every
impression of being on.

Dismissal is now its own state, set only by pressing "Sudah", and cleared when
the day or the patient changes — a dismissal means "these counters, on this
note, are dealt with", not a preference. Carrying it forward would suppress the
check on the note where the counters are newly a day stale, which is exactly
the note it exists for.

Three tests added asserting the DEFAULT is "not dismissed" — absent flag and
explicit `false` both fire, only an explicit `true` suppresses. The domain rule
was always correct and tested; what was untested was that anyone called it with
the right arguments.

```
1164 tests passed (was 1161)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-13.4`

**Catatan: the toolbar follows the page, and note tabs reorder by dragging.**

### Sticky toolbar

A reference note runs to several screens and the formatting controls sat at the
top of it — so bolding something two screens down meant selecting the text,
scrolling back up, and losing the selection on the way. That is the same
selection loss fixed in `2026-09-13.2`, arriving through the scroll instead of
through the `<select>`.

Sticky to the page's own scroller, so the shelf tabs and note tabs above still
scroll away: they are navigation, and you have finished with them by the time
you are formatting.

Opaque background and `z-10`, not a translucent bar. Body text scrolls
underneath this, and a translucent toolbar makes both unreadable at exactly the
moment you are aiming at a small button.

### Note tabs reorder by dragging

Drag a tab onto another and the shelf reorders. Order is the stored array
order, so a move rewrites `notes`.

**The dangerous part is not the splice.** The tabs show one shelf at a time
with archived notes hidden, so the order the user sees is a SUBSET — and
rebuilding the stored array from that subset drops everything the filter hides.
That failure is silent and total: a shelf of archived notes disappears and the
only feedback is a successful save.

`reorderWithinVisible` therefore walks the FULL list and hands each visible slot
its new occupant in turn; every hidden item keeps its exact index. Extracted to
`domain/reorder.ts` and tested for precisely that — a test asserts the two
hidden jaga notes are still at indices 1 and 3 after a move among the umum
notes.

Native HTML drag rather than the pointer-based drag the board uses: this is a
row of small tabs, and the native API gives the drop target for free. The board
needed pointer events because it needed positions; this needs an order.

```
1161 tests passed (was 1156 — 5 added on the filtered reorder)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-13.3`

**Two new checker rules; "Format bangsal" moved where it can be found, with an
AI fallback behind it.**

### A consult has answered but is not in the DPJP list

**49 entries** in the 2026-09-11 export are in exactly this state: a `TS Pulmo`
block with an answer in it, and a DPJP header that never names Pulmo.

It matters because the header is who the report is addressed FROM. A service
co-managing the patient and missing from that list does not get the note, and
nobody finds out until they ask why they were not told.

Matched on the first few letters of the service, because the two lines rarely
spell it the same — `TS Pulmo` in the block, `DPJP Pulmonologi` in the header.

### An electrolyte back in range, still written as the deficit

> K sudah 4.1 (dalam rentang) — tambahkan "perbaikan" di diagnosisnya?

**It runs only where you have supplied a range**, and that is the whole design.
Plano ships no reference ranges; a range belongs to the laboratory that printed
the result, and a number baked into an app is one nobody can correct when the
lab changes its assay. So there is a new **Pengaturan → Rentang rujukan lab**
(Na, K, Cl), empty by default, and this check is simply silent until it is
filled in. Guessing a normal range to make the reminder work would be
hardcoding one by another route.

It also stops once the line already says `perbaikan` — the reminder is for a
line nobody has revisited, not a nag about one that has been.

### "Format bangsal" was hiding in the status row

It was a small underlined link among the faint grey microcopy that says whether
the note is saved — text you read once and then stop seeing. A transform that
rewrites the whole note is not a footnote.

It now sits beside Lab and Pembuka in the header, which are the other things
you do TO a note, and drops into the ⋯ sheet on a phone with them.

### AI fallback for the reformatter

`cvcuToBangsal` stays the default and stays first. It moves blocks whole, never
looks inside one, and produces the same output every time — which is what makes
it safe to apply without reading every line. The model has none of those
properties, so it is offered only **after** the real transform has run, under
"Hasilnya masih belum rapi?", for the case it exists to serve: a CVCU note with
headings the transform has never seen.

It is handed the **deterministic result, not the original**. Fixing what is
left is a smaller and far more checkable job than redoing the conversion. A
character delta is shown beside it, computed without a model, because a large
change in length is the signal that content was dropped or invented — the
failure a reader skims past. "Kembali ke hasil otomatis" is always one press
away.

```
1156 tests passed (was 1149 — 7 added on the two new rules)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

**Still open:** the floating toolbar in Catatan and drag-reordering of notes.

---

## `2026-09-13.2`

**Text size in Catatan fixed; the AI button is back in the checker panel and
still never fires by itself.**

### Why the text size "sometimes didn't apply"

Two separate causes, both real, and the second explains why it looked
intermittent rather than broken.

**1. The selection was gone by the time the command ran.** The size control is
a native `<select>`, and opening one MUST take focus away from the
contenteditable — at which point the browser is free to drop the document
selection. `apply()` then called `focus()` and `execCommand('fontSize')`
against a caret rather than a range, and the size was applied to nothing.

The last range made inside the note is now recorded from `selectionchange` and
restored before any `execCommand`. Recorded from that event rather than from a
click, because a selection can be made with the keyboard too, or extended after
the mouse is released. Restored with `focus({ preventScroll: true })`, so a
long note does not jump away from what is being read.

**This is exactly why it got worse as the note grew.** `focus()` scrolls the
caret into view; on a document that scrolls, that is a different position from
the one the user had selected, so the odds of the range surviving fall as the
note gets longer. On a short note it usually survived — which is why it
"sometimes" worked.

**2. The same size twice did nothing.** The `<select>` kept its value, and
`onChange` does not fire when the value has not changed — so applying "Besar"
to a second paragraph was silently a no-op. It now shows a neutral `Ukuran`
label and resets after each use: a command, not a state.

### The AI button is back in the panel

Where it sits was never the point — what happens without it is. Enabling the
feature in Settings says the app MAY call the API; it does not say now. The
button is back inside "Periksa lagi", and nothing reaches the network until it
is pressed. The duplicate entry in the ⋯ sheet is gone; one trigger, not two.

```
1149 tests passed
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-13.1`

**Three real defects, all found by testing against the export: the checker read
the wrong number, the lab parser could not read its own output, and the AI
button sat where nobody asked for it.**

### The checker called an osmolality a sodium

```
- Moderate Hyponatremia (131 -> 129 -> 136) Hipoosmolal (265)
```

It reported *"diagnosis menyebut Na 265, lab terbaru 136"* about a note that
was entirely correct. `quotedValue` took the last number on the LINE, which
works until the line carries a second value — and this format, diagnosis then
osmolality, is everywhere in the corpus.

Now scoped to the analyte's OWN bracket: `[^\n(]*` before the group stops at
the first `(`, so `Hipoosmolal (265)` is a different group and invisible to it.
The arrow chain inside the right bracket still resolves to `136`.

This was wrong in the most damaging way a checker can be — plausibly. A rule
that fires confidently on a correct note costs more than the five it gets
right.

### The lab parser could not read the format it writes

`splitGrouped` required a colon: `Na/K/Cl : 136/3.6/103`. Plano's own output
uses a space. So re-parsing a lab block this app had already formatted dropped
**every grouped row** — Na/K/Cl, Ur/Cr, GOT/GPT, MCV/MCH/MCHC, NEUT/LYMPH,
APTT/INR/PT — and the failure was invisible, because the remaining rows still
parsed and the result still looked like a lab block.

Measured on 200 lab blocks from the export:

```
before   0 / 200 round-tripped     769 / 1407 lines recognised
after  200 / 200 round-tripped    1022 / 1407 lines recognised
```

The first attempt at the fix was itself wrong and is worth recording: simply
making the colon optional left `[A-Za-z0-9\s]+` in the name, which greedily
ate the start of the value — `Na/K/Cl 134/3.4/103` split as name `Na/K/Cl 13`,
value `4/3.4/103`, failed the alias check, and dropped the row exactly as
before. Name segments now exclude spaces and the value must be a slash-joined
run beginning with a digit. Every grouped label in this corpus is one word per
segment; the multi-word ones (`Anti HCV`) are never grouped.

**The canonical format is confirmed unchanged** and matches the export exactly:
`WBC · RBC · HGB · HCT · MCV/MCH/MCHC · PLT · NEUT/LYMPH · LED · APTT/INR/PT ·
GDS · Ur/Cr · Albumin · GOT/GPT · Na/K/Cl · Ca/Mg · CRP · Troponin · D-Dimer ·
HBsAg · Anti HCV · Anti HIV`, each group printed only if something in it was
found.

### The AI never runs on its own

The "Periksa dengan AI" button was inside the checker panel — and that panel
appears **by itself**. A button that appears by itself, spends the user's quota
and sends the note off the device is not the same thing as a feature the user
enabled. Enabling it in Settings says the app MAY do that; it does not say
"now".

The trigger moved to the ⋯ sheet, where every other deliberate act on a note
already lives. The panel is back to appearing only when a rule actually fires —
or when AI findings exist, since they have to land somewhere — and the AI
results still sit below the rules, tagged `(AI)`.

```
1149 tests passed (was 1141 — 8 added across the two parsers)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

**Not in this release:** the floating toolbar and font-size bug in Catatan,
drag-reordering of notes, and the CVCU → Bangsal reformatter. The last one is
not a rename of the existing "Rapikan SOAP" — it is a different feature and
needs both formats pinned down first.

---

## `2026-09-12.11`

**The API key field could be silently overwritten by a password manager.
Fixed.**

### What the dots in the field actually were

The field was `type="password"`. That type is exactly what a password
manager watches for, and `autocomplete="off"` does not stop it — every major
manager documents that they ignore it for this purpose, because the whole
point of a manager is to fill logins the page would rather it not touch.

The dangerous part is that the field is CONTROLLED: `value={key}`, updated
`onChange`. A manager offering (or auto-filling) an unrelated saved password
into this field fires that same `onChange`, and the component wrote whatever
arrived straight to storage as the Anthropic key — no typing, no Save button,
nothing to notice until a call failed with a 401 that made no sense. If dots
were showing without anyone having pasted a key, this is almost certainly
what happened, and the value is somebody's unrelated saved password, not a
key at all.

### The fix

- `type="text"`, never `"password"`. Masking is done with CSS
  (`-webkit-text-security`) instead, which gives the same dotted look without
  the type managers watch for.
- `data-1p-ignore`, `data-lpignore`, `data-bwignore` — the documented opt-outs
  for 1Password, LastPass and Bitwarden, the three that ignore
  `autocomplete="off"` outright.
- A format check: Anthropic keys start `sk-ant-`. Anything stored that
  doesn't is now flagged in place — "tidak seperti API key Anthropic … periksa
  dengan Lihat, lalu hapus jika bukan milik Anda" — as the safety net for
  whatever a manager may have already written before this shipped.

**Anyone who saw dots in this field before today should open it, press
"Lihat", and check the value is actually their key.**

```
1141 tests passed (was 1139 — 2 added on the format check)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-12.10`

**Settings grouped; ⋯ sheet stops repeating the header; sodium-for-glucose
calculator; optional AI pass on the SOAP checker.**

### Section aliases — checked, and two were missing

Scanned every heading-shaped line in the export against the alias list. The
list is current for the headings that define BOUNDARIES; what came back
unmatched was almost entirely sub-headings *inside* a block — `Conclusion`,
`Cardiac Valves`, `Kesan`, `Saran` — which is the boundary-based design working
as intended: they ride along inside the study they belong to, and aliasing them
would split one echo report into five sections.

Two were genuine top-level headings and are now aliases:

- **`Lung Ultrasound`** (75 uses) and **`Echo Hemodinamik`** → Penunjang. They
  head their own block, so without an alias they rode along inside whatever
  came before — and "O + Penunjang" could miss an entire study.
- **`Plan Terapi`** → Plan. `Plan Monitoring` and `Plan Diagnostik` were
  already there; this one travels with them, and a note using it had its plan
  split across two sections.

`Selesai:` was left alone deliberately. It rides inside Terapi, which is where
a reader wants discontinued drugs — beside the active ones, not in a section of
their own.

### Settings, grouped

Twenty-three sections in one flat list, with the four newest stranded below
"Tentang". Now under six headings: **Tampilan & catatan · Privasi & data ·
Akun · Pemeliharaan · Tentang**, with the maintenance tools (Perbarui kartu,
Periksa hasil salin, Riwayat sesi, Setel ulang) collected rather than scattered.

### The ⋯ sheet stops repeating the header

Format lab, Pembuka and Bandingkan hari were added to the sheet at every width
on 10 September, reasoning that a control existing at one screen size and not
another is one nobody learns. In practice it read as clutter: on a desktop the
sheet repeated three buttons sitting two centimetres above it, which makes the
list longer to scan for the things that are ONLY in there.

They now appear only where the header has dropped them — same `sm` breakpoint,
read once rather than guessed at, since two sources for one breakpoint is how
they drift.

`Sematkan di papan` → **`Pin di dashboard`**.

### Koreksi natrium pada hiperglikemia

A real card, not a link out — and the distinction is why it is allowed here
when the sodium and potassium REPLACEMENT calculators were removed. Those
produce a dose, which has to match a protocol only the ward owns. This produces
a reading: what the sodium would be at a normal glucose. It prescribes nothing.

**Both published factors, never one.** Katz 1.6 (NEJM 1973, theoretical) and
Hillier 2.4 (Am J Med 1999, experimental) disagree, and at glucose 600 they
differ by 4 mmol/L — the gap between calling the same sample hyponatraemic and
calling it normal. Showing one would present a contested number as settled. The
divergence note appears only when it is real.

**No downward correction below glucose 100.** The formula is linear and would
happily return a sodium lower than the lab measured at a glucose of 70 — which
is meaningless, since the dilution being corrected for is caused by the excess
glucose and there is none.

### Where the SOAP checker lives, and the optional AI pass

It is **not a button** — it is the "Periksa lagi" panel above the editor, which
appears by itself when a rule fires and is silent otherwise. That is deliberate
for the deterministic rules: they cost nothing and run as you type.

The new AI pass is the opposite and is therefore **on demand**. A network call,
the user's quota, and the note leaving the device may not happen because
somebody opened a chart. So: a third switch (`Periksa SOAP dengan AI`), and a
button inside the panel.

Its findings are listed **after** the rules and tagged `(AI)`. They are a
different kind of claim — the rules found a mismatch between two numbers
written in the note; this one has an opinion — and mixing them would let the
weaker sort borrow the stronger sort's credibility. The rules always run; the
AI never replaces them, because a checker whose findings vary between identical
runs stops being trusted.

```
1139 tests passed (was 1133 — 6 added on the sodium correction)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-12.9`

**The two AI features, both optional, both on the user's own key.**

### Lab assist — before the parser, not instead of it

A "Rapikan dengan AI" button in the lab sheet, visible only when a key exists
AND the lab switch is on.

It rewrites the **raw** box, not the output. `parseLab` is the thing that
produces the line that goes into the record, and it stays the only thing that
does — the model's job is to make messy OCR legible to the parser, not to write
the result. The preview underneath is still the parser's work, and the assist
can be wrong without being dangerous: a bad rewrite is visible in the raw box,
editable, and one "Urungkan AI" away.

The prompt forbids changing any number, adding any test, calculating anything,
or guessing at an unreadable value.

### Rapikan SOAP — a suggestion, side by side

In the ⋯ sheet, again only with a key and the switch on. It shows the current
note and the suggestion beside each other and **changes nothing** until
"Terapkan usulan" is pressed; applying goes through the normal revision trail,
so it can be rolled back.

**Why this is the only shape this feature may take.** The dangerous failure is
not a bad suggestion — that is obvious on sight. It is a good-looking one: a
sentence quietly improved into something the author did not write, in a record
somebody else acts on. Nothing but the author reading it prevents that, so the
reading is built into the flow rather than offered as an option.

Two things are computed **without** a model to make that reading faster:

- **Character delta.** A large change in length is the signal that something
  was dropped or invented — the one failure a reader skims past, because a
  shorter note still reads correctly.
- **Non-ASCII count.** For the reason recorded on `toPlain`: those reach SIMGOS
  as `?`.

Shown side by side rather than as a diff. A diff of a reordered note is almost
entirely red and green, which hides the one line that changed meaning — the
thing being looked for.

The prompt permits reordering, numbering and whitespace only, and forbids
changing any word, number, dose or unit. That is a request, not a guarantee,
which is exactly why the human step above it is not optional.

### Both are absent, not greyed out, when off

A disabled button for a feature nobody enabled is an advertisement — and this
one would be an advertisement for sending a patient's note off the device.

```
1133 tests passed (was 1126 — 7 added on the key store and the fail-closed switches)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

The switches fail closed by construction: anything in storage that is not
exactly `true` reads as off, including a half-written or hand-edited value, and
a corrupt flags blob reads as both off rather than throwing. The key is stored
under its own localStorage entry and reaches nothing that syncs.

---

## `2026-09-12.8`

**SOAP checker; bring-your-own-key AI settings (features wired next).**

### "Periksa lagi" — what the note looks like it forgot

A panel above the editor, from six rules read out of the 2026-09-11 export:

| Finding | Rule |
|---|---|
| TTV sama persis | The whole vitals block matches yesterday's, ≥3 values |
| Tidak ada TTV | No vitals anywhere in the note |
| Hitungan hari belum berubah | A `H-`/`hari ke-` counter identical to yesterday's |
| Lab sudah ada hasilnya tapi masih di Plan | A lab both planned and resulted in one note |
| Diagnosis menyebut K 2.9, lab terbaru 3.7 | A quoted electrolyte value the lab has moved past |
| Anemia tanpa Hb | `anemia` in the note with no haemoglobin anywhere |

**Deterministic, not a model.** Every finding is a comparison of two numbers
both written in the note. A model could do it and would also occasionally
invent a discrepancy or miss an obvious one — and a checker stops being read
the first time it is wrong twice. These fire on an exact mismatch and are
silent otherwise.

**It never edits.** Each of these has a legitimate reason to be exactly as it
is: vitals that really were identical, a diagnosis deliberately quoting the
admission value, a lab ordered again the same day. A checker that corrected
would be wrong about a patient roughly once a week; one that asks is only ever
ignorable.

Calibrated against the real corpus:

- **The whole block, not one vital.** 5 of 94 consecutive-day pairs in the
  export have an identical vitals block — a rare, real signal. Flagging a
  single repeated temperature would fire constantly.
- **The arrow form is current.** `Hypokalemia (2.9 --> 3.7)` is how a
  correction in progress is written; the value that counts is the right-hand
  one. Comparing the admission number would flag every improving patient every
  day.
- **0.05 tolerance**, so `3.60` and `3.6` are the same result.
- Runs on the debounced body, suppressed on a locked day, and silent on an
  empty one — a blank day is a day not started, not a day with five problems.

### AI: bring your own key

**Pengaturan → Fitur AI (opsional).** Off by default, per device.

Plano is shared, so a key in the build is a key every user spends — and a key
in a GitHub Pages bundle is one anybody can read out of it, since a static site
has no server to hide a secret behind. Each user brings their own or the
features are simply not there for them.

The key lives in localStorage and **nowhere else**: not Firestore, not the
profile, not the export. Those sync, and a credential that syncs is a
credential on every device that ever signed in. It is lost when browser data is
cleared, which is correct for a secret.

**Two conditions, not one**, before a byte of a note leaves the device: a key
is present, and that feature's switch is on. They answer different questions —
"can this app call the API" and "should it call it with my patient's note".
The panel says plainly that the text goes to Anthropic and that this is a
hospital-policy question.

```
1126 tests passed (was 1106 — 20 added on the checker)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

**Not done this release:** the two AI features themselves. `lib/ai.ts` has the
client, the key store and the flags, and Settings has the switches, but nothing
calls `askClaude` yet — the lab assist and the SOAP tidy are the next build.
Shipping the switches first means the policy decision can be made before any
patient text is anywhere near the network.

---

## `2026-09-12.7`

**Wrong-PDF contingency for the Helper import; the identity band's blank row
fixed.**

### The 44 px of nothing between the name and the location

The eye button was the last child of the wrapping header row with `ml-auto`.
On a narrow card the name and its badges fill that row, so the eye **wrapped
onto a line of its own** — and being a 44 px tap target, that line was 44 px of
nothing, at exactly the widths where space matters most.

A control cannot share a wrapping row with content. The band is now two
columns: everything that wraps on the left, the eye fixed on the right, outside
the wrap entirely. The left column wraps as much as it likes and the eye stays
top-right at every width.

### Uploading the wrong PDF

There are three file pickers side by side, which is three chances to drop the
right file in the wrong slot — and the failure was quiet. The DPJP roster fed
to the jaga parser finds no `HARI` column and produces zero shifts, which the
UI reported as "tidak ada baris jaga terbaca": a message describing the FILE as
broken when it was the SLOT that was wrong. On the evening before a jaga that
is somebody re-downloading a PDF that was never the problem.

`identifyJagaPdf` now runs **before** parsing, from marks only each document
carries, and a mismatch names both sides:

> Ini sepertinya Jadwal DPJP, bukan Jadwal Jaga PPDS. Impor di kotak Jadwal
> DPJP.

Refusing rather than trying anyway is the point: the alternative replaces a
good roster with a parse of a different document.

Two details that matter:

**Order of tests.** The DPJP file is titled "JADWAL JAGA DPJP UTAMA DAN PRIMARY
PCI", so checking for "jadwal jaga" first reads every DPJP file as a resident
roster. Its own marker is tested first.

**Identified by content, not filename.** These arrive over WhatsApp where names
are mangled, and a renamed file is not a different document.

An unrecognised file says so plainly rather than being guessed at — including
the likely cause, a scanned PDF with no text layer, which nothing here can
parse.

```
1106 tests passed (was 1100 — 6 added on document identification)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-12.6`

**One resolved name per post, shared by the Formasi and the confirmation list,
and correctable.** Still WIP.

### The Formasi names exactly who you confirmed

`ResolvedPost.display` is computed once, in `resolveShift`, and both the
Formasi and the confirmation row render that same string. They previously
derived it with the same expression in two places — which is one refactor away
from drifting, and the failure that produces is a report naming somebody the
user never messaged.

Order of preference, every step deliberate:

1. **what the user typed** — the only deliberate source in this feature
2. the **Jarkom nickname** — how the person is actually addressed
3. the **roster's full name** — never Jarkom's spelling of it
4. the **initials as printed** — honest, and readable by anyone on the rota

There is no step that produces nothing. A post with a person on it always names
them somehow, because a blank in a Formasi reads as "unstaffed" and that one is
not.

### The name is editable, and the correction sticks to the person

Matching the roster legend to the Jarkom sheet is fuzzy by necessity — two
documents, two typists, disagreeing by a letter on real colleagues — and 14 of
the 104 legend names have no Jarkom row at all. That residue does not go away
by tuning the matcher, and the cost of one wrong name is a report to a
consultant naming the wrong colleague.

So the name in the confirmation list is an input. Type over it and it is
remembered **against the INITIALS, not the date**: `AV` is the same person in
every shift they appear in, so fixing them once fixes every Formasi they will
ever be in. An override always wins over both documents — it is the only value
here a person entered deliberately, and a parser has no standing to overrule
it. Clearing the field removes the override rather than storing a blank.

The roster's full name still shows underneath whenever it differs from what is
being printed, so a bad match stays visible.

```
1100 tests passed (was 1096 — 4 added on the resolved display name)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-12.5`

**Konfirmasi Jaga: tick-off state, and the name sources made explicit.**
Still WIP.

### `(belum konfirmasi)`

A checkbox per senior in the confirmation list, persisted per **date AND
shift** — a weekend has two teams, and confirming the Pagi chief says nothing
about the Malam one, so a single per-date set would mark half the board done as
soon as the first shift was.

The Formasi prints the mark on every staffed post that has not been ticked:

```
Chief PJT : Ellen
Chief Konsul : Jauhar (belum konfirmasi)
Pediatri : 
```

Two decisions worth stating:

**The set holds the CONFIRMED, not the outstanding.** The default state of a
name nobody has ticked is "not yet confirmed" — a store that has to be seeded
with every post before it means anything is one that reports a full team the
day somebody forgets to seed it.

**An unstaffed post is never marked outstanding.** Paediatrics keeps its own
roster, so its column is empty in every row and there is nobody to confirm.
Marking it would put a permanent false alarm in every Formasi, and a warning
that is always there stops being read — taking the real ones with it.

Counts in the header: `3 belum konfirmasi`, or `9 dari 9 terkonfirmasi`.

### Where each name comes from

Made explicit, because the two documents disagree on spelling and only one of
them decides who is on:

| Field | Source |
|---|---|
| Full name | **Roster legend** — always |
| Nickname (panggilan) | Jarkom |
| Agama (greeting) | Jarkom |

Jarkom's spelling of a name is used nowhere. `dr. Grafiek Fogar Filen` is what
the roster prints and what Plano shows; `dr. Greafiek Fogar Filen Nando` is
only ever matched against, to reach that row's `Ve` and `Muslim`.

The confirmation list now shows the roster name in small text under the
nickname, so a wrong match is visible — if the nickname above it does not
belong to that person, that line is where you see it.

```
1096 tests passed (was 1092 — 4 added on the confirmation mark)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

**Still not done:** no editing a parsed roster after import; confirmation state
is per device; no reminder for the ones still outstanding.

---

## `2026-09-12.4`

**Helper tab — Konfirmasi Jaga. Marked WORK IN PROGRESS in the rail.**

A new tool tab that imports the three rosters from PDF and builds the Formasi
Jaga and the per-senior confirmation messages from them. Kept entirely
separate from the patient side: nothing in `domain/jaga/` imports from
`patients/` or `entries/`, and nothing there imports from here. The only shared
code is the greeting/time expander and the clipboard helper — if this ever
becomes its own app, that boundary is where it cuts.

### PDF import works because of positions, not text

Read as prose, these PDFs are unusable — pdf.js emits fragments in draw order,
so the jaga roster comes out with the shift table interleaved with the legend
beside it and no way to tell which column a two-letter initial came from. Each
fragment also carries an x/y, and with those the tables reconstruct exactly.
`lib/pdfItems.ts` exposes that; `lib/pdfText.ts` is unchanged.

Measured against the real files:

```
Jadwal Jaga PPDS   61 shifts, 16 Aug – 30 Sep, 104 initials in the legend
Jadwal DPJP        30 days, both columns
Daftar Jarkom      90 residents with agama and panggilan
name matching      90 of 104 legend names resolved to a Jarkom row
```

Three things that had to be got right:

**Weekend shifts are four points apart.** `Minggu Pagi` and `Minggu Malam` are
different teams entirely, and a generous row tolerance merges them into one row
of pairs. Two points, with the row anchored on its first fragment rather than a
running average — an average drifts as fragments are added and swallows the
next row.

**The TANGGAL cell is merged across both weekend shifts** and pdf.js attaches
it to the first. The `Malam` row inherits it; that is not a guess, it is
literally the same cell.

**The roster prints day numbers only** and spans a month boundary. The month
comes from the title, and a day number smaller than the last one is the
rollover — the only signal there is.

### Name matching, and where it gives up

The two documents are typed by different people: `dr. Grafiek Fogar Filen` in
the roster is `dr. Greafiek Fogar Filen Nando` in Jarkom. Matching scores whole
shared WORDS, allowing one edit on words of five letters or more — enough for
*Marylin/Marilyn*, *Montong/Mantong*, *Siti/Sitti*, and too narrow to reach a
different given name. Edit distance on the whole string was rejected: it treats
`Muhammad Asrul` and `Muhammad Abdul` as near-identical, which is the exact
confusion to avoid in a list of ninety colleagues who share given names.

The 14 unmatched are mostly the PJ-Jarkom seniors, who appear in that sheet
only as the PJ column and have no row of their own. They degrade to the full
name and the neutral greeting, and the list **says so** — "agama tidak
diketahui" — because silently sending the fallback is fine but silently hiding
that it happened is what stops the sheet ever being updated.

### The message

- Greeting follows the hour it is written (`selamat pagi/siang/sore/malam`).
- **Post-midnight DPJP is the NEXT CALENDAR DAY's row.** The consultant on call
  changes at 00.00 WITA, which is a date boundary, not a second column of the
  same row. Omitted entirely when tomorrow is not in the imported roster rather
  than repeating today's pair — a wrong name there sends the night's reports to
  someone who is not on.
- **Pediatri prints as a blank line.** They keep their own roster that only
  they see, so the column is empty in every row; a missing line reads as an
  oversight, a blank one reads as "not ours to report".
- Per-senior confirmation greets by **agama**, with the neutral form where it
  is unknown — never the commoner one, which is wrong for a quarter of the
  list.

No WhatsApp integration, per instruction. Copy buttons only.

Rosters are stored in localStorage, per device: they are published documents,
replaced wholesale every month, and re-importable in ten seconds. Firestore
would mean a schema, a sync path and a merge question for data that is already
shared elsewhere.

```
1092 tests passed (was 1080 — 12 added on the message builders)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

**Not done:** no tick-off state for who has replied; no editing of a parsed
roster after import (a wrong cell means re-importing); the parsers are tuned to
these three layouts and a redesigned PDF will need the column table adjusted.
The verification harness that ran against the real PDFs was deleted after the
run — no roster data is in the repo.

---

## `2026-09-12.3`

**Identity band on the card; sidebar hint capped; the KJS badge finally
appears — via a rebuild, because the cache was the problem.**

### Why the KJS badge still did not show

The rule was fixed in `2026-09-11.4`; the DATA was not. `kjs` is denormalised —
computed from the note body and stored on the patient, so the board can render
twelve cards without reading twelve bodies. That is the right trade, and its
cost is that the cache is only ever rebuilt by a WRITE. Every existing patient
still carries no role at all, and will until somebody types into their note.

Same for `preview`: the limit went 240 → 1600, but the `…` was **saved**, not
rendered, so no amount of resizing reveals text that was never stored.

Waiting for each patient to be edited is, on an archive of a hundred, never. So
**Pengaturan → Perbarui kartu pasien**: reads the latest entry of every
active and archived patient, recomputes `preview` and `kjs`, writes them back.
Note bodies are not touched.

It reads only the latest entry per patient — the card shows one day, and
reading every day of every patient would be hundreds of documents to rebuild a
field that describes one. And it follows the write path's rule that **absence
is not a correction**: a note naming nobody does not erase a role set from a
note that did.

Run it once after installing this build.

### Identity band on the card

Name, bed, location and badges were four stacked paragraphs in the same colour
and weight as the diagnosis list under them, so finding a patient on a board of
twelve was reading rather than glancing — the name had no edge, and the bed sat
in the same visual layer as a sentence about their coronaries.

They now sit in a tinted band with a hairline under it. Not a heavier border or
a different hue: the card background already carries checklist progress, and a
second colour on that surface is the collision recorded on the discharge wash.
Same colour, different weight.

### The sidebar hint was growing taller than the nav

Nothing in that block had a height limit, so a long description, a two-clinic
week and a wrapping ward name could make five rendered lines out of three
facts, in a rail 180 px wide. It is ambient furniture and cannot out-size the
navigation it sits under.

Each line is now clipped to one line, with the full text on the panel's
`title` — one hover away, and the rail keeps a predictable height whatever the
roster says.

```
1080 tests passed
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-12.2`

**Resize now has measured ends, and the diagnosis text uses the room it is
given.**

### The two ends of the drag are measured, not guessed

`MIN_CARD_H` was a flat 120 px and there was no maximum at all. Both numbers
were wrong for the same reason: the useful range of a card depends on what is
inside it, and a constant cannot know that.

| | Was | Now |
|---|---|---|
| Minimum | 120 px, fixed | the card with its diagnosis list fully collapsed |
| Maximum | none | the card with every line of the note shown |

`minH` is the chrome the card cannot give up — name, bed, badges, progress
strip, note. Below it those parts start overlapping each other, which is the
first screenshot. `maxH` is chrome plus the full content height, so dragging
further buys empty space and nothing else, which is the second.

Both are measured by the card and reported up, because the canvas knows the box
it drew and not what is in it. The middle block's `scrollHeight` is the full
content height **whatever the card has been clamped to** — that independence is
exactly what the removed uncap rule lacked, and it is why these can be measured
while the card is already capped.

The cap is still **not** dropped automatically at the top. Uncapping switches
the card out of its fixed-height layout mid-gesture, which changes the very
measurements the drag is clamped by — the shape of the flicker bug. Uncapping
stays a double-click on the grip, where nothing is moving.

### `- Hypertensive Heart Di…` on a card with room to spare

The `…` was **baked into the stored string**. `buildPreview` truncated at 240
characters at WRITE time, where the card's size is unknowable, so no amount of
dragging could reveal text that had never been saved.

- `PREVIEW_LIMIT` raised 240 → 1600. It now exists only to stop a pathological
  note from bloating the patient document.
- `previewLines`' four-line cap is a prop. Four on the masonry board, where a
  card grows to fit and a long note pushes everything below it off screen; 60
  on the canvas, where the user set the height themselves.

**Existing patients keep their 240-character preview until their note is next
saved** — the cache is only rebuilt on write. Opening a patient and touching
the note refreshes it.

```
1080 tests passed (was 1076 — 4 added on the measured bounds)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-12.1`

**Card height now follows the pointer. The snap is gone because the rule that
caused it is gone.**

### Root cause: a rule whose input was determined by its own output

The height grip used to remove the cap entirely when you dragged past the end
of the content, rather than setting a very large one. The reasoning was sound —
`hMax: 900` on a 400-tall card behaves like no cap until the note grows past
900, and then silently clips something you believed you had uncapped.

The implementation could not work. The number it compared against, `natural`,
came from the card's `scrollHeight` — but a capped card is rendered with
`fitHeight`, which makes it a flex column that **compresses to the height it is
given**. It never overflows, so its `scrollHeight` is always exactly the cap.
`natural === origin.hMax`, every time, and the test

```
target >= natural - 8      with target = origin.hMax + dy
```

reduced to `dy >= -8`. **Any downward movement uncapped the card** and it
jumped to full height; eight pixels back up re-capped it. That is the flicker
in the recording — not a snap to a grid, a binary flipping under the finger.

No threshold tuning fixes a rule that measures its own effect. It is removed:

```
hMax = max(MIN_CARD_H, (origin.hMax || natural) + dy)
```

The cap is exactly where the pointer left it. Dragging taller than the content
is a legitimate thing to ask for and the only consequence is empty space you
can see and drag back. **"No cap" is now an explicit act — double-click the
grip**, which already did exactly that.

`natural` still seeds the first drag on an uncapped card, where `fitHeight` is
off, nothing is compressed, and `scrollHeight` really is the content height.

### Two consequences of that, fixed in the same pass

**The middle of the card shrinks but no longer grows.** It was `flex-1`, which
stretched it to fill whatever height the card was given — so a card dragged
taller than its content spread the diagnosis list out and pushed the progress
strip to the bottom of a field of nothing. Shrink-only keeps the content's
shape; a cap larger than the content simply leaves space below it.

**The fade is drawn only when the card is really clipping.** Nothing outside
the middle block can tell: the card is rendered at a fixed height, so its
`scrollHeight` is always that height and says nothing. Inside an
`overflow-hidden` box whose content is unconstrained, `scrollHeight >
clientHeight` is the real answer — so the check moved in there. A fade over
text that is not cut off claims there is more below where there is not.

```
1076 tests passed (was 1075)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-11.4`

**KJS detection rewritten against the real export; canvas stops rearranging
itself on resize; header badges hug the name; Salin bagian verified on 190
real notes.**

### KJS — the old rule was wrong in both directions, and looking at the wrong text

Two separate defects, found by running the 2026-09-11 export through the
parser.

**1. It read `preview`, which does not contain the DPJP lines.** `preview` is
the card's display excerpt, and on almost every patient that is the diagnosis
block. `searchBlob` is worse — built from name, MRN, bed, ward and diagnoses,
it never holds a word of the note body. So the badge fired only on the handful
of patients whose preview happened to begin at the note header, and Ny.
Nuraeni — a KJS patient in every note she has — showed nothing at all.

`kjs` is now derived at WRITE time from the whole body, beside `dpjpId`, and
stored on the patient. The preview remains a fallback for patients not re-saved
since.

**2. "Has a `DPJP Kardio` line" was not the discriminator.** 19 entries in the
export carry that line while cardiology is the PRIMARY service —
`_DPJP Kardio (Utama): dr. Zaenab Djafar_`, or a solitary `_DPJP Kardio : …_`
on an ordinary patient. Calling those "another service's patient" is the
expensive mistake: it says the plan is only a recommendation and the discharge
is not ours, about a patient who is entirely ours.

What actually separates them is **who is marked `Utama`**:

| Note | Role |
|---|---|
| `_DPJP BTKV (Utama)_` + `_DPJP Kardio_` | `kardio` — we are consulted |
| `_DPJP Kardio (Utama)_` + `_DPJP Orthopedi_` | ours — no consult badge |
| `_DPJP Utama: <cardiologist>_` + `_DPJP KJS Anestesi_` | `ts` — ours, joint care |
| several DPJP lines, no KJS anywhere | `null` |

A patient with several DPJP lines and no KJS is not promoted to joint care:
multi-service is ordinary here, and inventing a badge for it would mark half
the board. Tests now use the actual notes — Ny. Siati, Tn. Muh Iqbal, Tn.
Irwan, Ny. St. Salmah, Ny. Nuraeni — rather than invented ones.

### Resizing made the other cards jump

`placeAll` auto-places cards with no stored position and skips slots occupied
by cards that have one. So the moment one card was committed it joined the
occupancy map, every other card's auto-placement was recomputed against a map
that had changed, and cards nobody had touched moved. Resizing one card
rearranged its neighbours; a second attempt "worked" only because by then
everything was placed.

A commit now writes the **resolved layout of the whole board**, so the
arrangement on screen is the arrangement on disk. Nothing moves because of
something done to a different card, and auto-placement is left to the one job
it is good at — finding a slot for a patient who has just arrived.

The grips also stay visible while a gesture runs, not only while hovered: the
pointer leaves the card the instant a resize starts (it is captured, not
tracked), so a hover-only grip vanished mid-drag and the gesture read as
dropped.

### The gap between the name and the H-1 badge

The name was `flex-1` with a `min-w-[55%]` floor, which did two things wrong at
once: it took every spare pixel, so the eye button sat at the far edge with a
hand's width of nothing between it and a short name; and the floor pushed any
badge that would not fit in the remainder onto its own line, even with room to
spare.

The name now sizes to its content and the badges follow it immediately,
wrapping with it as words in a sentence do. Only the eye keeps `ml-auto` — it
is a control, not a label, and a control that moves with the length of a name
is one you have to look for every time.

### Salin bagian — verified, not assumed

Ran the section parser over all **190 entries with a body** in the export:

```
lossless (regions rebuild the note from the first boundary)   PASS
no gaps, no overlaps, no backwards regions                    PASS
every slice is a verbatim substring of the note               PASS
a single-group copy contains nothing from another group       PASS

182/190 notes had at least one boundary
boundaries found: S 180 · O 180 · A 194 · Terapi 318 · Plan 222
```

Terapi outnumbers the notes because each `TS …` consult heading opens its own
Terapi region — that is the behaviour that stops copying Plan from pasting the
anaesthetist's plan as if it were ours.

The 8 notes with no boundary are the ones with no S/O/A/P headings at all
(unfilled templates and one-line IGD entries); Salin bagian correctly offers
nothing there rather than guessing.

The verification harness read a file of real patient data and was **deleted
after the run** — it is not in the repo and no fixture from it was committed.

```
1075 tests passed (was 1072)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-11.3`

**Today-only ECG mark that expires by itself; the card header no longer eats
the patient's name.**

### `EKG hari ini` — a date, not a boolean

New `patient.ekgFor`, set from the ⋯ sheet, shown as an `EKG hari ini` badge.

**Stored as the clinical date it applies to**, because the mark has to expire
on its own. A boolean would need something to clear it, and the only thing that
reliably runs in this app is the user — a flag nobody reset says "EKG today" on
a Thursday because it was set on Monday, which is how a marker stops being read
at all. A date makes expiry a comparison rather than a chore: nothing runs at
midnight, the card simply stops matching.

Separate from `ekgHarian` because they answer different questions — "this
patient always needs one" versus "this patient needs one today". One toggle for
both would mean marking a one-off tracing quietly promises a daily one. Where
both are set the standing order wins the label; "hari ini" on a daily patient
understates it.

### The wrapped name on Tn. Arfa's card

Two causes, and the first is the one that did the damage.

**`overflow-wrap: anywhere` was collapsing the name's min-content width.** Both
`anywhere` and `break-word` allow a break inside a word, but `anywhere` also
lets those break points count toward the element's **min-content** size — which
takes it to roughly one character. In a flex row that is a licence for every
`shrink-0` badge beside it to take what it likes, and the name is left with a
five-letter column: *Tn. Arfa / Anugra / h Dicky*. Changed to `break-words`,
whose min-content width is the longest word, so a name breaks mid-word only
when a single word genuinely cannot fit.

It was added in `2026-09-10.4` for the pathological single-long-token name and
went unnoticed until a card had enough badges to make the row tight. The new
`EKG/hari` badge was the third — it exposed this, it did not cause it.

**And the header row now wraps.** Its fixed cost grows every time a badge is
added (eye, EKG, discharge) and the name was the only flexible member, so each
new badge was paid for out of the patient's name — the same failure as the
truncation this row replaced, arriving through a different door. The name now
has a `min-w-[55%]` floor and the row is `flex-wrap`: the badge cluster drops
to its own line before it squeezes the name, and stays in the top-right corner
whenever there is room, which on a full-width card is always.

```
1072 tests passed (was 1067 — 5 added on the ECG marks, including the expiry)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-11.2`

**Daily-ECG marker; DPJP delivery restructured into routes; new patients land
in the list you are on; bulk archive.**

### EKG/hari marker

`patient.ekgHarian`, a flag like `pemantauan`, shown as an `EKG/hari` badge in
the card corner and toggled from the ⋯ sheet.

**A flag, not a checklist item.** The daily checklist asks "EKG sesuai
kebutuhan" precisely because most patients do not need one — a task you tick is
finished, and this is true until somebody says otherwise.

**Not derived from the diagnosis text.** "Arrhythmic" is a judgement, not a
keyword: `VES lown grade II` in a diagnosis list does not by itself mean daily
tracing, and `AF` in a past-history line means nothing for today. Guessing it
in the safe direction spams the board with marks that get ignored; in the
unsafe direction it quietly drops a tracing someone was relying on. Set by
hand, once.

### DPJP delivery is now a route, not a sentence

`Dpjp.delivery` was free text, which let `Dikirim oleh chief, dengan PDF` and
`Dikirim oleh chief` sit side by side and left the reader to notice that the
difference is whether to build a PDF at all. It is now `{ route, pdf, channel,
note }` with one formatter.

| Route | Who | |
|---|---|---|
| `chief` + PDF | AFM, ZD, AFG | send PDF to chief; chief forwards to DPJP and grup prodi |
| `chief`, no PDF | AHN (Az Hafid) | same route, **no PDF** — the exception that makes `pdf` a field |
| `group` | KS (Khalid), PT (Pendrik), PK (Prof Peter), ARB (dr Rio), MZ (Prof MZ) | send yourself to their group |
| `dm` | IM (Prof IM), MAA (dr Asrul) | wapri only, never a group |

Prof MZ carries `note: 'ada slide tersendiri'`, because it changes what you
prepare, not just where you send it. ZD keeps the verification-hour note from
the earlier list.

Tests assert the **route**, not the sentence — a test that breaks on a comma is
one people learn to update without reading.

**AHA (Alkatiri) was not in this list** and is left as `chief` with no PDF
claim. Say if he belongs in the PDF group.

### New patients land in the list you are looking at

`createBlankPatient` takes `temporary`, and the board passes the current scope.
No prompt: the choice is real but lopsided, and a modal on the most-pressed
button of the day charges every admission for the rare case. You are on Titipan
because you are dealing with a titipan patient.

The choice is moved rather than hidden — the new patient's page shows **Masuk
daftar: Pasien saya / Titipan** for as long as the note is blank, where it
costs nothing to ignore and one tap to correct. It disappears once there is a
note: after that the patient has a history, and moving them is a decision
rather than a correction, which stays in the ⋯ sheet where it is harder to do
by accident.

### Bulk archive

**Arsipkan** in the Pilih bar, beside Pindahkan ke sampah. It opens a reason
row — Pulang / Pindah / Meninggal / Lainnya — and applies one reason to the
batch.

**The reason is asked, never defaulted.** It is what the archive is later
browsed and filtered by, so a batch filed under a guess is worse than an
unfiled one: wrong in a way nobody re-checks. Batching is honest here — the
case this exists for is the end of a round where several patients went home the
same day, which is one reason by construction. A row rather than a dialog, so
the selection stays visible behind it.

```
1067 tests passed (was 1065)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-11.1`

**KJS badge now says which side we are on; auth persistence race fixed and the
spontaneous sign-out instrumented.**

### KJS: the fact was there, the direction was not

The badge said a second service is involved and left out the half that changes
what you do. On a patient referred TO cardiology the primary DPJP is not ours,
the plan is a recommendation rather than an order, and the discharge is someone
else's call. Two patients on one board can both be "KJS" and need opposite
handling.

`BoardCard.kjs` is now `'kardio' | 'ts' | null`:

| Badge | Meaning |
|---|---|
| `KJS · Kardio` | Another service's patient, we are the cardiology consultant |
| `KJS · TS` | Our patient, co-managed with another service |

**The discriminator is the `DPJP Kardio` line.** It appears in the consult
template because that note has to name both the primary DPJP *and* ours; a note
where we are primary has no reason to name a separate cardiology DPJP, so its
absence is meaningful rather than merely unobserved. Read from the note rather
than a new field, for the reason already recorded for the KJS flag: it is
stated in the opening, and a second place to record it is a second place for it
to be wrong.

Anything mentioning KJS without that line falls back to `ts` — the safer
direction, because understating our distance from a patient is a smaller error
than overstating our authority over one.

**No `\b` before `DPJP` in the matcher.** The line is written inside italics in
every one of these notes (`_DPJP Kardio : dr. Y_`), `_` is a word character, so
the boundary does not exist there and the match fails silently. Same trap that
hid `hari ke-9` from the day-marker matcher.

### The spontaneous sign-out

**Fixed, a real race.** `setPersistence` was fire-and-forget while `initSession`
subscribed to `onAuthStateChanged` on the next line. `setPersistence` swaps the
store the SDK reads credentials from, and any auth state emitted mid-swap
describes a store that is being replaced — which arrives at the listener as
`null`, indistinguishable from a real sign-out. The subscription now waits for
persistence to settle.

**Persistence order changed to IndexedDB first**, localStorage only as
fallback. localStorage was the weaker store in three ways: first evicted under
pressure, targeted by "clear browsing data" and cleanup extensions, and watched
for cross-tab changes by POLLING — so with several Plano tabs open, a read that
comes back empty for a moment looks exactly like another tab signing out.
IndexedDB is what the SDK prefers when left alone.

**The stale error is cleared on every auth transition.** "Gagal memuat
pengaturan." described the *previous* session; a sign-in page still showing it
reads as a failure of the sign-in happening now, which is the screen that gets
reported as the bug.

**And it is now instrumented rather than guessed at further.** Pengaturan →
**Riwayat sesi** keeps the last 20 session events — boot, sign-in, sign-out,
profile error, redirect error — each with a timestamp, whether the browser was
online, and the SDK's error code where there was one.

The `?` in SIMGOS is the standing lesson: four releases of plausible causes,
each shipped, each followed by another report. The candidates here — a token
the server rejected, a network failure treated as a rejection, a credential
read that came back empty for a moment — are indistinguishable afterwards
unless something wrote it down at the time. The panel leads with the one
reading that changes what to do: a sign-out **while offline** is a dropped
token refresh on ward wifi; **while online** is the case worth chasing.

No uid, no email, no token, no patient data in the log — it is meant to be
screenshot-able without thinking about it.

```
1065 tests passed (was 1060 — 5 added on the KJS direction)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

**Not claimed:** the race above is a real defect and was worth fixing on its
own, but I cannot say it is the cause of what you saw — a sign-out that undoes
itself on a hard reload has several explanations and I have no recording of
which one fired. The log is there so the next occurrence answers that instead
of me.

---

## `2026-09-10.8`

**Canvas reclaims its vertical space; a capped card stays readable; echo
full-study opening with a live date.**

### The handle was costing 44 px on every card

A drag strip in normal flow has to be tall enough to press, and 44 px times
twelve cards is most of a screen spent on an affordance used a few times a
week. Rapikan cost another full row above the board on top of that, and both
pushed the cards down past space that was sitting empty.

- The handle is now **overlaid in the gap above the card**, appearing on hover.
  Zero layout cost — it sits in a gap that already exists.
- **Rapikan and Urungkan portal into the board toolbar**, beside Format lab,
  and their own row is gone. Portalled rather than lifted: the layout they act
  on lives in `CanvasBoard`, and lifting the state to reach the toolbar would
  give two components the ability to write the same arrangement.

It stays a handle rather than the whole card. The card is a `<Link>` and a
long-press target; a drag starting anywhere on it has to win a race against
both, and losing it either opens a chart you did not ask for or moves a card
you did not mean to move.

### A short card now gives up its middle, not its bottom

Previously a cap clipped whatever fell past it — usually the progress strip,
so a shortened card lost the two things that make it useful on a board: which
patient it is, and what is left to do. It became an anonymous card still
sitting where you expect to find that patient.

`PatientCard` gained `fitHeight`. Under it the card is a flex column:

| Zone | Under a cap |
|---|---|
| Header — name, bed, discharge chip | always visible |
| Middle — chief, diagnosis list, labels | **clipped from the bottom, with a fade** |
| Progress strip + "Belum:" line | always visible |

The container is given `height`, not `maxHeight` — a flex column can only
distribute a height it has been given; under `maxHeight` it sizes to content
and the browser clips the overflow, which is the old behaviour. `min-h-0` on
the middle is what lets it shrink at all: a flex child defaults to
`min-height: auto` and refuses to go below its content. The expand chevron
moved to the corner, since a bar across the bottom would cover the strip that
is now deliberately kept.

### Echocardiography full-study opening

Added to the openings list:

> Tabe dokter, mohon izin mengirimkan list pasien echocardiography full study
> dari *(Ruang), (hari), (tanggal)*

and a combined greeting, `Assalamu'alaikum dokter dan selamat (waktu) dokter.`

Tokens resolve when the sheet opens: `(waktu)` → pagi/siang/sore/malam,
`(hari)` → the day name, `(tanggal)` → DD-MM-YYYY. So at 13:30 on a Friday the
options read exactly as they will be inserted.

**Tokens rather than more seed strings**, because the alternative is four
copies of one greeting differing by a single word, which go out of step the
first time one is edited alone — and a date cannot be a seed string at all.
**Expanded for display, not only on apply**, because `suggestGreetingIndex`
matches on the words *pagi/siang/sore/malam*: an unexpanded token would make
the time-appropriate greeting invisible to the function whose only job is to
surface it. Resolved **once per open** against a single timestamp, so a sheet
left open across midnight cannot offer "selamat malam" beside tomorrow's date.

`(Ruang)`, `(no)` and the rest are deliberately left alone. They mark something
only the sender knows, and filling them with a guess turns a visible blank into
an invisible wrong answer.

```
1060 tests passed (was 1055 — 5 added on token expansion)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

**Not done:** the greeting is resolved from the clock, not from the note's
clinical day — these lines are the message being sent, and a back-dated note
still goes out today. If a list should ever carry the date of the *study* and
not the date of sending, that is a different token and needs saying.

---

## `2026-09-10.7`

**Free canvas, stage 3: Rapikan, with undo. The canvas feature is complete.**

### Why the gap needed a button rather than a rule

A free canvas cannot close its own gaps. Discharge a patient from the middle of
an arranged board and the hole stays — and the alternative, cards sliding up on
their own, is the board rearranging itself after a deliberate act, which is the
exact behaviour `Urutan sendiri` exists to escape. So the hole is real by
design, and the answer is a press at a moment the user chose.

### It closes gaps in your arrangement rather than replacing it

`tidy` sorts by **reading order** — top to bottom, left to right within a band
— not by the underlying board order. Tidying by list order would throw the
arrangement away and call it cleaning. The band tolerance (half a row step)
exists because two cards side by side are never at exactly the same `y`, and
sorting on raw `y` would interleave columns the eye reads as one row.

Widths and height caps carry through untouched. They were set deliberately and
are not what "tidy" means. A card too wide for the remaining space wraps to the
next row before it is placed, not after, so nothing is left hanging off the
right edge.

### Undo, because there is no other copy

Rapikan overwrites every position at once, and those positions are the only
record of work done by hand — nothing reconstructs them. **Urungkan** restores
the layout as it was before the press.

Held in memory, not storage, and cleared on use: undo is for the ten seconds
after the press. An "Urungkan" still sitting there tomorrow would be offering
to revert an arrangement that has since been worked on.

```
1055 tests passed (was 1050 — 5 added on tidy)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

### Canvas, as shipped

| Stage | |
|---|---|
| 1 (`.5`) | Drag anywhere; fractional x/w so a layout survives a resize; localStorage; auto-placement that never buries a new patient |
| 2 (`.6`) | Width grip and height cap; over-drag removes the cap rather than setting a large one; fade only when actually clipped |
| 3 (`.7`) | Rapikan + Urungkan |

**Deliberately not done:** phones render the masonry board, not the canvas. A
360 px canvas is one column, which makes "where you put it" a list with your
desktop gaps preserved as dead space. Layouts remain per-device; swapping
`readLayouts`/`writeLayouts` for Firestore is the only change if that turns out
to be wrong.

---

## `2026-09-10.6`

**Free canvas, stage 2: card width and height cap.**

Two grips on every card in **Urutan sendiri**, visible on hover: a vertical
strip on the right edge for width, a horizontal one on the bottom for the
height cap. Double-click either to reset that axis.

**Two grips, not one corner.** A corner handle changes both dimensions in one
gesture, so setting a width you like also nudges a cap you had already set —
and in a horizontal drag most of the vertical movement is unintentional. One
axis per grip means the gesture cannot do something you did not ask for.

**Dragging the bottom edge past the end of the content removes the cap** rather
than setting a large one. `hMax: 900` on a card whose content is 400 tall
behaves exactly like no cap — until the note grows past 900 and it silently
starts clipping something you believed you had uncapped. The two states look
identical the day they are set and differ a week later, so the ambiguity is
resolved at the moment of the gesture instead of being left in the data.

**The fade is drawn only when the card is actually clipped.** Natural height is
measured with `scrollHeight` (a bounding rect reports the *clamped* height —
the number being compared against). A permanent fade under every capped card
would claim there is more below on cards where there is not, and a signal that
is sometimes false stops being read. Tapping the fade expands that card
temporarily; the expansion is **not** persisted, because "show me the rest of
this now" is a different act from "this card should be this tall".

**Minimum cap is 120 px** — roughly the header plus one line. Below that a card
no longer says which patient it is, which is worse than no card, because it
still occupies the place you expect to find them.

**Gesture arithmetic moved to the domain** as `applyGesture`, and is now
tested: the clamp that keeps a card on the canvas, the minimum width, the
uncap threshold. None of that is visible in a screenshot — a card that ends up
one pixel off-canvas looks fine until it is the card you needed.

```
1050 tests passed (was 1042 — 8 added on the gesture arithmetic)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

**Still not done:** no "Rapikan" — discharging a patient from the middle leaves
a permanent hole, and closing it automatically would be the board rearranging
itself after a deliberate act. That is stage 3. Phones still render masonry.

---

## `2026-09-10.5`

**"Periksa hasil salin" diagnostic added; free canvas board, stage 1.**

### The `?`: a second clean capture, so the guessing stops

The text captured this session — copied from the SIMGOS preview box — was
checked byte by byte: **5560 bytes, zero non-ASCII characters, zero `?`.** It
also shows ` derajat ` where a `°` would have been, which proves `foldToAscii`
ran on it. That is the second clean capture. Whatever introduces the `?` is
downstream of Plano's clipboard output, and a fifth reasoned fix in here would
be a fifth guess.

So this ships an instrument instead: **Pengaturan → Periksa hasil salin.**

- Box 1 audits what Plano produced: every non-ASCII character with its code
  point and line:column, plus any literal `?`.
- Box 2 takes the text pasted into SIMGOS *and copied back out*, and diffs the
  two — newline conversion normalised, because Windows turns every `\n` into
  `\r\n` and a diff that flagged that would flag every line.

The `?` count is reported **separately** from the non-ASCII count, and that
distinction is the diagnostic. A non-ASCII character is something Plano put on
the clipboard and could fix. A `?` is already ASCII — nothing downstream turns
it back — so finding one in box 1 means the substitution happened before the
text arrived, and finding one only in box 2 means SIMGOS did it.

### Free canvas, stage 1 — drag a card anywhere

New: `canvasLayout.ts` (model + storage) and `CanvasBoard.tsx` (surface +
gesture). Active only under **Urutan sendiri**, and only at `lg` and above.

**Coordinates.** `x` and `w` are fractions of canvas width; `y` is pixels. A
card remembered at `x: 640px` is in a different place on every screen — a
fraction means "40% across", which is what the arrangement actually means and
survives a window resize with nothing re-running. The vertical axis is not like
that: the canvas scrolls, so there is no height to be a fraction of, and the
distance between two stacked cards is a real distance rather than a proportion.

**Storage is localStorage**, keyed by patient id — a change from what was
proposed last session, and matching what `customIds` already does. An
arrangement is a view preference, not a fact about the patient; keeping it out
of Firestore means dragging writes nothing to the server and cannot conflict
mid-round. The cost is that a layout built on one machine is not the layout on
another — already true of `Urutan sendiri` today, so not a regression. Only
`readLayouts`/`writeLayouts` change if that turns out to be the wrong trade.

**Auto-placement, not persisted.** A card nobody has dragged flows into the
default grid, skipping any slot that overlaps a hand-placed card — because an
unplaced card is a patient admitted since the board was arranged, and landing
underneath an existing card makes them invisible and reads as never having been
created. Overlap between two cards the *user* placed is left alone: that is
what a free canvas is.

**Only handle-dragging.** The card is a `<Link>`; a drag starting anywhere on
it races the navigation on every tap. A strip above the card means tapping
still opens the patient.

**Not done, and why:**
- **Resize (width + height cap) is stage 2.** `hMax` is already in the stored
  shape so that arriving does not migrate a layout somebody arranged by hand.
- **Phones keep the masonry.** A canvas scaled to 360 px renders every card as
  an unreadable thumbnail, and one column makes "where you put it" a list with
  your desktop gaps preserved as dead space. This is where option B cannot be
  honoured literally.
- **No "Rapikan".** Discharging a patient from the middle leaves a permanent
  hole; that is stage 3.
- Canvas height is assumed from `ROW_STEP` rather than measured per card.
  Generous padding covers it; measuring means every card reporting its height
  on every content change.

```
1042 tests passed (was 1027 — 15 added across the inspector and the layout model)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-10.4`

**Mobile header and board toolbar no longer overflow the right edge.**

### Root cause: a row whose fixed cost grew with every feature

Both rows had the same shape — one non-wrapping flex line, one flexible child,
everything else `shrink-0`.

*Patient header:* back, a `flex-1` title, then Lab + Pembuka + Salin + ⇄ + ⋯.
On a 360 px phone those buttons and their gaps exceed 360 px **on their own**,
before the title is given a pixel. The title had already shrunk to nothing, so
there was nothing left to give and the row ran off the edge. Every feature
added to this header made it worse, and nothing in the layout could ever push
back.

Fix: the header's action cost is now **fixed**, not a function of how many
features exist. Below `sm` it keeps only what is irreducible — where am I
(back, title), what this screen is for (Salin), and everything else (⋯). Lab,
Pembuka and Bandingkan hari now appear in the ⋯ sheet **at every width**, not
only on mobile: a control that exists at one screen size and not another is a
control nobody learns. Nothing became unreachable.

*Board toolbar:* four order chips, a rule, then Format lab + Pilih. The chips
alone are wider than a phone, and because the actions sat last and were
`shrink-0`, **the actions were what got pushed off** — the two controls that
are always needed, while the chips (one of which is selected and already
visible) kept their space.

Fix: two boxes, because the halves overflow differently. The order chips are a
list and can scroll; the actions are fixed and must not. The chip strip takes
the leftover width with `overflow-x-auto`, the actions keep theirs at every
size. `min-w-0` on the scroller is load-bearing — a flex child's default
`min-width: auto` refuses to shrink below its content, which is how a nested
scroller ends up never scrolling and widening the page instead.

```
1027 tests passed
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

**Not done:** the `?` fix shipped in `2026-09-10.3` does not cover the workflow
described this session (selecting text inside the Salin preview box). See the
notes for that release — the polarity change is still correct for every copy
made outside the sheet, but it is not the cause of the reported `?`. No further
guess has been made without the raw clipboard text.

---

## `2026-09-10.3`

**Day-counter banner now points at the counters; ASCII folding no longer
depends on which screen is open.**

### The banner named the counters and hid where they were

`findDayMarkers` returned `{ text, value }` and threw away `match.index`. With
no position, the banner could only list what it found — `H-2, H-3, hari ke-9`
— so it answered *how many* and left *where* to a manual scan of a forty-line
carried-forward note, with the counters scattered through the italic opening
and the therapy list and two of them reading the same.

- `DayMarker` now carries `start`/`end`, plus `findDayMarker(body, text, n)`
  and `countDayMarker(body, text)`.
- Each counter in the banner is a **button**. Pressing it selects that counter
  in the editor and scrolls it into view, so the number is highlighted and one
  keystroke from being replaced.
- Repeats cycle: a counter appearing three times shows `×3` and walks the
  occurrences on repeated presses, wrapping rather than stopping at the last.
- A counter that no longer appears in the note is struck through and inert. It
  does **not** dismiss the banner — editing a number proves the user looked at
  it, not that the new number is right. "Sudah" is still by hand.

Positions are **not stored**. The stale list is captured at carry-forward and
the note is edited afterwards, so every character typed above a counter moves
it; a remembered offset points at the wrong text by the time anyone presses.
The search runs against the live body at press time instead.

`BodyEditor` gained one imperative method, `selectRange`, through an opt-in
`handleRef`. It reuses the existing `revealCaret` — which measures the true
wrapped position through the section mirror — rather than computing its own,
because two opinions about where a line is disagree on exactly the long notes
this is for.

### The `?` in SIMGOS: folding was opt-in, so it was off almost everywhere

Confirmed this session that the `?` appears **only after pasting into SIMGOS**,
never in Plano's own preview. That rules out the formatters — `toPlain` cannot
emit a `?`; it deletes non-ASCII — and points at the one copy path with no
formatter on it.

Root cause: `useSanitizedCopy` folds to ASCII only when `simgosPreview` is
true, and the *only* thing that ever set that flag was the Salin sheet, open,
on the plain tab. Every other copy in the app — selecting text in the note
editor, in a document, on the board — reached the clipboard unfolded. So the
guarantee held on one screen and silently did not hold anywhere else. The
decision was bound to **which sheet was open**, not to where the text was
going.

The polarity is now inverted:

| | Before | Now |
|---|---|---|
| Default for any manual copy | no fold | **fold to ASCII** |
| Exception | folding, on the plain tab | not folding, while a WhatsApp/markdown preview is open |

`simgosPreview` → `nonAsciiPreview`. The two mistakes are not symmetrical:
folding text that did not need it costs `°C` becoming ` derajat C` in a
WhatsApp message; not folding text that did costs a `?` in the medical record,
invisible until someone else reads it. The safe direction is the default, and
the exception has to be declared.

**If a `?` still appears after this**, the remaining path is outside Plano: a
copy taken from WhatsApp Web or Telegram Desktop on the ward PC and pasted from
there, where the clipboard is theirs, not ours. That is distinguishable — it
would happen only on notes that went through a chat app first.

**Not done:** no toast or visible warning when a copy still contains non-ASCII.
The app has no toast system and adding one for this is a bigger change than the
fix. The `findNonAsciiChars` warning inside the Salin sheet is unchanged.

```
1027 tests passed (was 1022 — 5 added on the jump targets)
typecheck / lint / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-10.2`

**Discharge marker moved to the card corner as a car chip; patient names no
longer truncated.**

### The name was being spent on badges

`PatientCard`'s title row was one flex line in which every child except the
`<h3>` was `shrink-0`, and the `<h3>` carried `truncate` — `white-space:
nowrap` plus an ellipsis. So the width available to a patient's name was the
card minus however many badges that patient happened to carry: DPJP initials,
KJS, the discharge badge, the pin star. The rule that produced was exactly
backwards — the patients with the most going on were the ones whose names you
could not read. "Tn. Petrus Da…" was never a long name; it was a name standing
next to two badges.

Raising the truncation width would have moved the threshold, not removed it.
The fix is structural, in two parts:

- The name **wraps** (`break-words` + `overflow-wrap: anywhere`) instead of
  truncating. A second line costs one row on the cards that need it, and the
  board is masonry — the gap closes underneath. Truncation cost a name on
  every badged card, permanently.
- DPJP, KJS and the pin **moved off the title row** onto the location line.
  They are reference marks, read after you have found the card, never in order
  to find it. Only the preview button and the discharge chip stay on the title
  row, because both must sit in the corner.

### The discharge wash was painted on a channel that was already taken

The full-card gradient introduced in `2026-09-10.1` is gone. It failed for a
structural reason, not a stylistic one: the card's background is already
domain data. `colorToken` encodes how far the checklist got, and the wash
tinted it with a second, unrelated fact — worst on a finished patient going
home today, where a green "selesai" background under a green "pulang hari ini"
wash read as one flat green block and neither signal survived.

That is the same failure as the 4px `borderLeftColor` before it (silently beat
by the pemantauan edge) and the bare colour stripe before that: a mark placed
on a channel something else owns. The corner is the one place on a card that
nothing else claims, so that is where it now lives:

- `DischargeChip` — car glyph + short label, tinted by stage (12% for
  `planned` up to 32% for `today`/`overdue`, fill only; the label keeps the
  card's own foreground colour, so the loudest chip is no harder to read than
  the quietest). A solid fill was tried before and rejected for out-shouting
  the patient's name.
- `IconCar` added to `Icons.tsx` as an SVG rather than the 🚗 emoji: emoji
  render as a different picture per OS, ignore `currentColor`, and vary enough
  in metrics to shift the chip's baseline.
- `STAGE_LABELS` now holds the full phrase ("Pulang hari ini") for `title` and
  the accessible name; new `STAGE_SHORT` holds the chip form ("Hari ini"). The
  word can shrink because the car already says *pulang*, and the width that
  frees goes to the name.

Colour is still never the only signal: the label always renders, and the full
phrase is on `title` and in an `sr-only` span.

**Not done, deliberately:** no card-wide discharge signal of any kind now
exists — the chip is the whole treatment. If the corner turns out to be too
quiet when scanning twenty cards from the end of the bed, the next thing to
try is a tint on the card's *bottom* edge, below the progress strip, which is
the only other unclaimed channel. Not built on a guess.

```
1022 tests passed
check:version   OK
check:contrast  OK
check:a11y      OK
build           clean
```

---

## `2026-08-28.2`

**Repo cleanup — no app behavior changed.**

Deleted four stray top-level paths, all committed by earlier GitHub web-UI
uploads that only add files and never delete them:

- `/domain`, `/components`, `/data` — a pre-`src/` snapshot of the app,
  missing `denah`, `dpjp`, `calc`, `checklists`, `DocumentPanel`,
  `CompareSheet`, and others added since. Never built or tested — `tsconfig`
  includes only `src`, `vitest.config.ts` includes only `src/**`, Vite walks
  from `src/main.tsx` — but present in the tree for anyone reading it cold.
- `/plano-changed/` — a changed-file bundle from `2026-08-23.2` that was
  committed instead of unpacked into `src/`. Contained its own
  `src/version.js` pinned to `2026-08-23.2`.

**Why this needed a fix, not just a delete:** `scripts/check-version.sh`
scoped its scan to `src/ public/ index.html` and excluded matches by
*basename*, so `plano-changed/src/version.js` was invisible to it twice over
— the check reported `OK` while a stale version string sat in the repo.
Rewritten to scan the whole tree (minus `node_modules`, `.git`, `dist`,
`package-lock.json`) and exclude by path, plus a second check asserting no
source file exists outside `src/`, `public/`, `scripts/`, `.github/`. See
`SPEC.md` for the standing rule this enforces.

The orphaned `plano-changed/CHANGES.md` is folded in below as history; its
figures (612 tests, `2026-08-23.2`) are stale and superseded by every count
above this entry.

```
651 tests passed
check:version   OK (path-scoped)
check:contrast  OK
check:a11y      OK
build           clean
```

---

## `2026-08-23.2` *(recovered from the orphaned bundle — historical, not current)*

**15 changed files.** Includes `2026-08-23.1` if you have not uploaded it.
Nothing to delete.

### 1. The CVCU → bangsal reformatter, third attempt

Your before/after pair was what it needed. The first version reordered by
guesswork and broke notes; the second only unwrapped headers, which was safe
and did too little — its output still read as a CVCU note.

**What was missing: the vitals are buried mid-sentence.**

```
Circulation: TD 121/84 mmHg, nadi 80 x/menit reguler, BJ I/II murni reguler, ...
```

Unwrapping `Circulation:` leaves that whole sentence intact. It now splits on
commas and classifies each fragment, so the vitals lift out and the
examination findings stay behind:

```
*O:*
Compos mentis
Tekanan Darah : 121/84 mmHg
Nadi : 80 x/menit reguler
Pernapasan : 20 x/menit
Suhu : 36.4°C
SpO2 : 96% via room air

JVP R+2 cmH₂O
BJ I/II murni reguler
Akral hangat
...

*EKG CVCU PJT (19-08-2026)*
```

Investigations move below and each gets a `*…*` heading. The bare `EKG`
label that only introduced the block is dropped, since every block now
carries its own.

Values keep their qualifiers — `80 x/menit reguler` stays `reguler` —
because the fragment is moved rather than rewritten.

**Nothing is discarded.** Fragments matching nothing go under `Lain-lain:`
and are counted in the preview, so a wrong guess is visible before you apply
it.

Two bugs caught by tests while building it: `SpO₂` never matched, because
the subscript is not a word character so `\b` after it never holds; and the
first draft dropped `akral hangat` into the wrong bucket.

### 2. Two optional formatting actions

Both on the toolbar, both **actions rather than automatic**. Applying either
on paste would edit text the moment it arrives, and the one time it guessed
wrong there would be no way to tell what the original said.

- **`Aa*`** — restores `*bold*` on headings and `_italic_` on DPJP and
  referral lines that a plain-text paste stripped. Never touches a line that
  already has a marker, so running it twice changes nothing.
- **`•→-`** — turns the iPhone bullet into a hyphen. Line starts only; a `•`
  mid-sentence is never list syntax.

### 3. From `2026-08-23.1`

Templates: `Pasien baru (admisi)` and `Konsul rawat bersama` removed; KJS
and poli replaced from your reports; `Pasien perpindahan` added; the
primer/sekunder split confined to the AHN template, with a test asserting
exactly one template carries it.

Patient page opens the most recent day that **has** a note rather than a
blank today. Lab extractor reachable from the board. `Ambil dari catatan
hari ini` in the identity sheet. Scrollbars in the app's own colours.

**Verification at the time:** 612 tests passed (+8), `check:version` OK,
`check:contrast` all card colours ≥4.5:1, `check:a11y` 62 components, build
clean.
