# Plano — CHANGES

## `2026-10-05.3` — Salin: preview to the bottom, chips that do not move

### 1. Bagian chips moved when pressed (Avi)
**Root cause.** `ChoiceChip`'s width depended on its state. Selecting added a
14 px check icon plus a 6 px gap and switched the label to semibold, about
25 px wider. In a wrapping row that reflows everything after the chip:
- pressing "A" pushed "Terapi + TS" to the next line;
- pressing "Seluruh catatan" pushed "S" back up.

Avi's four screenshots are the four layouts of the same six chips.

**Fundamental fix (in the shared component, so every chip row in the app is
covered).** The chip is an `inline-grid` with two layers in one cell:
- an invisible, `aria-hidden` sizer that is always the widest state (check +
  semibold);
- the visible layer.

Width no longer depends on `active` at all. Checked in the harness: 5 presses
across Bagian, 0 position changes in any of the six chips. Cost: unselected
chips are as wide as their selected state, so the label sits centred with a
little extra padding.

`choiceChip.test.ts` pins the structure (jsdom cannot measure width).

### 2. Preview height (Avi: "not the width, the height")
**Root cause.** Height was taken by things that did not need it:
- the copy button was a full-width footer bar under BOTH columns;
- a row under the preview (count, Ukuran awal, Pilih semua teks);
- with a dragged height, the preview column scrolled, which also hid its own
  header (Avi's screenshot).

**Fix.**
- **Button.** On a laptop the copy button is pinned at the bottom of the
  options column, under Penyesuaian; the options scroll above it.
  `Sheet` gains `footerClassName`; Salin passes `sm:hidden`, so a phone keeps
  the footer bar exactly as before.
- **Count and actions.** The count, Ukuran awal and Pilih semua teks moved up
  into the Preview header row.
- **Fills to the bottom.** The preview now runs to the sheet's bottom edge;
  only the height grip sits under it. Body top padding 16 → 12 px, column gap
  24 → 20 px. Measured at 1600 x 820: textarea 579 px, ending 33 px above the
  sheet's bottom edge.
- **Column never scrolls.** A dragged height can only be smaller than the
  column:
  - past the bottom the box shrinks to fit (`flex-shrink`);
  - a layout effect turns a height the box cannot show back into "fill"
    (null).

  The column never scrolls, so the hand-select test still moves the textarea
  0 px.
- The grip's `-my-1` let it hang 4 px out of the column; it is `-mt-1`.

### Not done
- The width handle from `.2` stays (harmless, in the gutter), but the default
  width is unchanged from `.2`.

```
1873 tests passed (+2)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build - clean
```

## `2026-10-05.2` — Floating calculator, bigger and resizable Salin preview

### 1. Floating calculator on the SOAP page (Avi)
**Why not a Sheet.** Every dialog in the app is modal: it dims the page, traps
focus and blocks the note. A calculator is only useful while the note stays
editable behind it. `FloatingCalculator` is a plain non-modal panel
(`role="dialog"`, `aria-modal="false"`, z-40 so a real Sheet still covers it).

**Default chosen, and why.** "Floating calculator" could mean arithmetic or the
bedside formulas. Both are in, as two tabs, rather than asking:
- **Hitung** — typed or keypad arithmetic, a live `= result`, a five-line tape,
  Salin hasil. `domain/calc/arithmetic.ts` is a small recursive-descent parser,
  **not `eval`** (tested: `alert(1)`, `2 ** 3` and `constructor` are syntax
  errors).
- **Klinis** — the same cards as the Kalkulator page (urine output, osmolality,
  corrected sodium, unit converter). They moved out of `CalculatorPage` into
  `components/calc/ClinicalCards.tsx`, so a formula fixed in one place is
  fixed in both. Page behaviour is unchanged.

**The one real hazard: number notation.** The notes write `12.000` for twelve
thousand and `3,1` for three point one. A calculator that read `12.000` as
twelve would be wrong by 1000x on exactly the numbers it is opened for. So:
- `.` followed by exactly three digits is a thousands separator;
- `,` is always the decimal mark;
- `.` with one or two digits (`3.1`, `0.75`) is accepted as a decimal, because a
  phone keypad types it.
- `1.500` is genuinely ambiguous and is read as 1500. Every result shows
  **"Dibaca: 1500 + 3,5"** so a misreading is visible, not silent.
- `%` is a plain postfix (`200 x 10%` = 20). It is NOT the phone-calculator rule
  that `200 + 10%` means 220. Results are written with a comma and no grouping,
  like the notes.

**Behaviour.**
- Laptop: header button (calculator icon) next to Salin; the panel floats
  bottom right, can be dragged by its header, is clamped to the window, and
  remembers where it was, whether it was folded, and the tab
  (`plano.floatCalc`). Folding keeps the line and the tape (the body is hidden,
  not unmounted) and shows the live result in the header.
- Phone: no room in the header, so it is a row in the ⋯ sheet. The panel docks
  above the tab bar (no dragging a panel round a 360 px screen) and the keypad
  replaces the system keyboard (`inputMode="none"` on a touch pointer), which
  would otherwise cover the note.
- Enter or `=` puts the result on the tape and into the line, so a chain needs
  no retyping. Tape rows re-insert their result. Escape closes.
- Nothing is saved but position, fold and tab. The tape dies with the panel,
  for the reason the Kalkulator page gives: numbers with no patient attached.

### 2. Salin preview: bigger by default, and resizable
**Root cause of the dead space.** The sheet was 64 rem wide and 88 dvh tall with
a 21 rem options column, and an empty notices `div` under the preview still took
a flex gap. On a wide screen the preview was a narrow strip with air around it.

**Fix.**
- `Sheet` gains `size="2xl"` (84 rem, still capped at 94 vw); a `fill` sheet is
  now 92 dvh tall. The options column is 18 rem by default (was 21 rem).
- The notices block renders only when there is a notice.
- The preview is one box for both views, so Teks and Tampilan share one height.
  Measured at 1440 x 900: the textarea went from about 335 px (the screenshot)
  to 532 px.
- **Resizable both ways**, with `components/common/ResizeGrip`:
  - a bar under the preview changes its height; a bar in the gutter changes the
    options column's width (laptop only);
  - drag, arrow keys (they are real `role="separator"` controls), double-click
    or Home to reset; "Ukuran awal" resets both;
  - remembered per device (`plano.salin.previewHeight`, `plano.salin.optionsWidth`).
    Neither is ever written to a note.
- Dragged taller than the column, the column scrolls (and the sheet does not).
  Hand-selecting to the bottom still moves the textarea 0 px.

**Wrong turns.**
- CSS `resize` was the first idea. It cannot work here: the preview fills its
  column with `flex-1`, whose flex-basis of 0 beats the height the browser
  writes while dragging.
- The first `ResizeGrip` kept the drag origin in a plain local object. Each
  move re-rendered the parent and made a new object, so a drag forgot it had
  started. It is a `useRef`.
- Arrow keys changed the size and "committed" in one event, so the persisted
  value was the OLD one. Sizes are now persisted from state in an effect.
- The width bar first sat inside the preview column, which scrolls once the
  preview is dragged taller, and would have been clipped. It is a child of the
  grid.
- The keypad `=` and the "Hitung" tab had the same accessible name; the key is
  now "Hitung hasil".

### Not done
- The calculator and Salin were render-checked in a harness (Playwright:
  drag, clamp, fold, tab, reload, phone width). The real PatientPage was not
  (it needs the whole data layer): the header button and the ⋯ row are markup
  plus one state flag, typechecked and linted. Check them on the device.
- The calculator cannot insert its result at the note's caret: the editor has
  no insert-at-caret handle, and focusing the panel loses the selection. It
  copies; you paste.
- On a phone the panel is about two-thirds of the screen high while open. Fold
  it with the triangle.

```
1871 tests passed (+19)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build - clean
```

## `2026-10-05.1` — Format bangsal safety, closings, lab placement, preview, declutter

### 1. Format bangsal — "dangerously wrong" (Avi)
**Reproduced** on a CVCU-style O section before touching anything:

| Input | Output | |
|---|---|---|
| `Suhu 37,8 C` | `Suhu : 37` + `- 8 C` | decimal comma split |
| `TD 90/60 (NE 0,1 mcg/kgBB/menit)` | `(NE 0` + `- 1 mcg/kgBB/menit)` | dose split |
| `Kalium 3,1; Natrium 132` | `Kalium 3` + `- 1` | lab value changed |
| `HR monitor 130` after `nadi 112` | **nothing** | dropped |
| `sesak nafas berkurang` | candidate RR | label matched mid-fragment |

**Root cause.**
- **The split.** Findings were split with `split(/[,;]/)`, but Indonesian
  writes the decimal with a comma, and parentheses carry qualifiers.
- **The drop.** A fragment matching a vital already taken was dropped by
  `if (!vital) unmatched.push(...)`. That means "matched a vital, but it was
  already taken" went nowhere.
- **Free lines.** Lines that were not organ-system sentences were split as
  well.
- **The false claim.** The file comment said "Nothing is discarded" and the
  sheet said "Urutan isi tidak berubah". Neither was true.

**Fundamental fix.**
- `splitFindings`: splits on `;`, and on `,` only outside brackets and never
  between two digits.
- Vitals are anchored at the START of a fragment and need a digit, except
  GCS/compos mentis, which collect onto one line.
- A repeated vital goes to Lain-lain and is never dropped.
- Free (non-header) lines are one finding each, kept whole.
- **The invariant — `lostTokens(before, after, allowance)`.** Every word and
  number of the input is counted (NFKD, lowercase) and must be present in the
  output.
  - Exempt: the organ-system headers and the vital labels this transform
    renames, plus the exact bare `EKG` label lines it drops on purpose.
  - Numbers are never exempt.
- `ReformatResult.lost` carries the result. ReformatSheet applies the same
  check to the AI result, lists the lost tokens in a danger callout, and
  **disables Terapkan**. A clean result says so in an accent callout. The
  description now says what the transform actually does.
- **Tests:** every row of the table above, "loses nothing" on the worked
  example and on the dangerous note, `lostTokens` and `splitFindings`.
- **Wrong turn.** The invariant's first run flagged `ekg`: the bare `EKG`
  label line is removed on purpose. It is exempted by line (the `allowance`
  argument), not by adding `ekg` to the global exempt list, so a dropped
  `EKG …` heading would still be caught.

### 2. Section-only Salin kept the closing
**Root cause.** Closings were recognised only from the configured list in
Settings. Hand-written sign-offs ("Tabe terima kasih dokter", "Mohon arahannya
dokter. Terima kasih dokter.") are not in it, so they stayed in every Plan-only
copy.

**Fix.** `isClosingLine` recognises a sign-off when all of these hold:
- it contains a sign-off phrase (terima kasih / mohon arahan(nya) / mohon
  bimbingan / wassalam);
- it contains an addressee (dokter, dok, Prof, dr, chief…);
- it is not a list item and not the opening ("melaporkan").

The configured list still counts. The sign-off is removed wherever it stands
as its own line in a subset (one written before a TS block was kept before).
The old test "keeps a closing when none are configured" was replaced on
purpose.

### 3. Preview moved while selecting
**Root cause.** On a laptop the whole sheet body scrolled with the preview
sticky inside it. Drag-selecting to the bottom of the textarea auto-scrolled
the body.

**Fix.** `Sheet fill`: a fixed height from 640 px, with a body that does not
scroll. CopySheet's options column scrolls itself, and the preview textarea
fills the rest (`flex-1`, `resize-none`, `overscroll-contain`). Checked with a
Playwright drag past the textarea's bottom edge: the textarea moved 0 px, and
598 characters were selected. A phone is unchanged (fixed `h-80` textarea).

### 4. Lab Sisipkan position
**Root cause.** `insertIntoObjective` appended at the END of the stack, but
the ward stack is newest-first.

**Fix.** `domain/lab/insertLab.ts`:
1. above the newest lab (by date; on a tie, the first written);
2. else after the last EKG block;
3. else the old end-of-O rule.

Blocks come from `penunjangBlocks`, extracted from `latestPenunjangOnly` so
both features share one detector. `labPlacement` / `describeLabPlacement`
feed a line in LabSheet. Tests cover each rule, newest-by-date order, and
"nothing else changes".

### 5. Top of the note cluttered
- **DPJP block.** Five or six lines are folded to one summary: initials, short
  route (`shortDelivery`), report shape, next clinic, and 6MWT in accent. Tap
  for the full lines. The choice is remembered per device
  (`plano.dpjpInfoOpen`).
- **Periksa lagi.** With nothing flagged it is one small line ("✓ Tidak ada
  yang janggal…") with "Periksa dengan AI" inline. With findings, the box
  stays and the AI button moves into its title row. The full-width button row
  is gone.

### Not done
- The page-top change was not render-checked in the harness (PatientPage
  needs the whole data layer). It is a markup-only change, typechecked and
  linted; check it on the device.
- `lostTokens` proves nothing was LOST, not that every finding sits in the
  right place. The preview is still the check for placement.

```
1852 tests passed (+17)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-10-04.3` — sheet UI revamp

**Problem (Avi, with five screenshots: "made partially, not finished").**

**Root cause.** It was not one bad screen. Every sheet had grown its own
controls:
- 44 px rounded pills for every choice, the same style in all modes;
- each menu entry a separate bordered card (the ⋯ menu was nine cards);
- grey 12 px text for section titles;
- an underlined link as the primary action ("Pakai format ini");
- four different "selected" styles.

Each was defensible alone, but together they read as a prototype. Three
problems were shared by all of them:
- **Width.** `Sheet` was a fixed 32rem on a laptop, so any sheet with a preview
  scrolled for everything.
- **Focus ring.** Radix focused the ✕ on open, so it drew a focus ring every
  time.
- **No hierarchy.** Nothing marked a title, a hint or a danger zone.

**Fix: one vocabulary, `components/common/ui.tsx`.**
- **Pieces:**
  - `Section` (small-caps title, hint);
  - `Segmented` (2–4 exclusive options);
  - `ChoiceChip` + `ChipRow` (multi-select, or more options than fit; ✓ when
    on; dashed for versions/jaga);
  - `ListGroup`/`ListRow` (one container of divided rows, icon left, chevron
    or ✓ right, `danger` tone, badge);
  - `Callout` (info/accent/warn/danger, with an optional action);
  - `Button` (primary/secondary/ghost/danger, sm/md);
  - `Field` + `INPUT`, `CheckRow`, `TextPane`.
- **Tap targets.** Touch keeps the 44 px floor; a fine pointer gets 36 px
  (`[@media(pointer:fine)]:min-h-9`). check:a11y still passes, because no
  sub-44 px height is written explicitly.
- **`Sheet`:**
  - a `size` prop: md 34rem, lg 46rem, xl 64rem; a phone ignores it;
  - on open, focus goes to the dialog, not the ✕ (still trapped, and Tab
    still reaches ✕ first);
  - a grab handle on the phone;
  - a larger title;
  - a rounded hover target for ✕.
- **Icons:** 13 new glyphs in `Icons.tsx`, on the same grid and stroke.

**Per sheet.**
- **CopySheet (xl):**
  - **Layout.** Options on the left (21rem); the preview on the right, sticky,
    with a 26rem textarea and a character count.
  - **Order.** The identity mismatch is moved to the top as a danger callout.
    The DPJP reminder is a callout with a "Pakai" button. Format is
    segmented; Bentuk and Bagian are chips.
  - **Grouping.** The latest-penunjang and SIMGOS-symbol switches are grouped
    under "Penyesuaian".
  - **Copy button.** It says what and how ("Salin SOAP harian · WhatsApp"),
    then the patient.
  - **Logic.** No handler or composition logic changed.
- **PatientActionsSheet:**
  - grouped sections Catatan / AI / Pasien / Pengingat / Rencana pulang /
    Arsipkan / Zona berbahaya;
  - pemantauan, titipan and pin as switch rows that show the CURRENT state;
  - discharge stages as a segmented control (a custom date shows no segment
    selected);
  - the archive button names the reason chosen;
  - delete as a danger row, with its confirm as a danger callout.
  - `ReminderPicker` restyled to match.
- **OpeningSheet** (retitled "Pembuka & penutup"):
  - a "baris pembuka saat ini" callout;
  - radio rows with ✓ for the greeting and the sentence in use;
  - the closing in use detected by `endsWith`;
  - Sapaan as two buttons.
- **ReformatSheet (xl):**
  - the summary as three stat tiles;
  - "tidak dikenali" as a warn callout;
  - the AI fallback as a callout, and as an accent callout with the length
    delta while the AI result is in use;
  - a wide before/after view.
- **LabSheet (xl):**
  - Sumber on the left: a dashed drop zone that is both a button and a
    drag-and-drop target, the AI buttons, error callouts and the raw text;
  - Hasil on the right: title and date, the date-source hint, the multi-date
    warning, bold toggle, "Akan disisipkan" pane and the unknown-values
    warning;
  - "Salin saja" moved to the footer, beside Sisipkan.
- **CompareSheet:** uses the shared `Segmented` (its local copy was deleted).
- **RenderedPreview:** taller, rounded to match.

**Render check.** A Vite harness with mocked session, repo and AI, dark mode,
at 1440×900 and 390×844. All five sheets rendered with no console errors.
Verified:
- Copy: two columns, sticky preview;
- the menu groups, switches and danger zone;
- the radio ✓ in Pembuka & penutup;
- the reformat stat tiles, warn callout and AI callout;
- Lab: drop zone and the two columns.

**Not done.** The other 16 sheets (Settings sub-sheets, Konfirmasi Jaga…) use
the new `Sheet` frame (padding, title, focus, width) but not yet the new
controls. They can move over sheet by sheet. Nothing breaks if they don't.

```
1835 tests passed (+0)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-10-04.2` — Bandingkan: pair + grouped picker

**Problem (Avi: "a mess to choose from").** Two rows of chips, one per pane,
each repeating the same flat list of every day, version and jaga note:
- **The pair was invisible.** Up to 26 near-identical pills. Which two were
  selected meant finding two highlighted chips in that wall, and the dashed
  border was the only thing marking a version.
- **"Dibuka" was not a note's name.** The open note appeared as "Min, 4 Okt
  (dibuka)", unlike every other chip.
- **Older days were unreachable.** `slice(0, 12)` meant the 13th entry onward
  could not be picked at all, and versions (10-04.1) made a single day cost
  up to three entries.

**Root cause.** The picker modelled "two independent lists" when the task is
"choose a pair". Also, the list was flat when the question is hierarchical:
which day, then which note on it.

**Fix.**
- **`domain/compareOptions.ts`** (pure, tested):
  - `groupCompareOptions`: by date, newest first. Within a date: SOAP, then
    versions, then jaga notes, by time. The open note sits in its own date
    (it may be the only note there).
  - `relativeDay` (H-n, relative to the open note; blank for the IGD entry).
  - `compareSuggestions`: SOAP asli for a version or jaga note; Hari
    sebelumnya, meaning the newest SOAP BEFORE the open day, not literally
    yesterday; then the day's other versions.
  - `defaultPartner`.
- **`CompareSheet`:**
  - **Pair.** A "Dari ⇄ Ke" pair of slots, each showing date · name and H-n or
    "dibuka". Swap exchanges the sides.
  - **List.** Tapping a slot opens ONE grouped list for that side
    (`max-h-[45vh]`, all dates). The note on the other side is labelled "sisi
    lain", not hidden, so the list keeps the same shape for both sides.
  - **Shortcuts.** "Cepat" chips set Dari = suggestion and Ke = the open note.
  - **Controls.** The mode (Antar catatan / Revisi tempelan) and the view
    (Berdampingan / Tandai perubahan) are segmented controls instead of chips
    and an underlined link.
  - **Labels.** The legend and pane headers say "Dari"/"Ke". There is a guard
    when both sides are the same note.
- **Props.** `currentLabel` is replaced by `openNote {date, kind, name}`. The
  sheet builds labels itself, so "(dibuka)" is no longer baked into a string.
- **Unchanged:** the revision mode below the controls.

**Render check.** Done at 390 px and 1100 px, with 12 days, a version and two
jaga notes:
- default H-2 · SOAP → today's SOAP;
- picker grouped and scrollable;
- picking Jaga 22.40 updates "Dari";
- shortcut + "Tandai perubahan" diff;
- swap exchanges the sides;
- no console errors.

**Not done.** The diff engine (`diffSegmentsByLine`) can still show an
unchanged line as deleted and re-inserted when the line before it changed
(seen as `- Monitoring` struck and re-added). That is the diff, not the
picker. A line-aligned diff like the revision mode's (`diffRevision`) would
fix it; this was not part of the request.

```
1835 tests passed (+6)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-10-04.1` — SOAP versions, "penunjang terbaru saja"

**Request.** dr. AHA's report carries only the newest pemeriksaan penunjang,
while the day's SOAP must keep the whole stack. The stack is what carry-forward
preserves on purpose (`carryForward`: clearing penunjang would delete the
history). Avi needed a second, editable, named SOAP for the same day,
comparable with the original. He chose to fold the jaga note into it rather
than build a parallel structure.

### Design: a version IS a jaga note with another kind
A jaga note was already "a second SOAP on the same day": own storage
(`entry.shiftNotes`), own editor slot, a rail entry, a Salin shape and a Compare
entry. Building versions beside it would have duplicated all five. So:
- `ShiftNote.kind?: 'jaga' | 'versi'` and `title?`.
  - **Absent kind = jaga**, which is every note written so far. No migration and
    no write-back.
  - Ids are prefixed `versi-`/`jaga-`.
- `noteLabel` (title → `Jaga HH.MM` → `Versi`) is the one label used by the
  chip row, the rail, Compare and aria labels.
- `defaultVersionTitle` gives `Versi dr. <DPJP>`, else `Versi n`.
- `useShiftNotes.add(body, { kind, title })` and `rename(id, title)`. Rename
  carries pending text in the same write, like `setTime`.
- **Chip row (`JagaBar`):** `+ Versi` (only while the day's SOAP has text) next
  to `+ SOAP jaga`. ⋯ also has "Buat versi SOAP".
- **`NewVersionSheet`:** name plus "Penunjang terbaru saja". The checkbox is
  ticked by default when the DPJP's format asks for it, and the sheet lists the
  blocks it will drop before anything is created. Versions copy `editor.value`,
  so unflushed typing is included.
- **`ShiftNoteEditor`:** editable name on both kinds; the time stays jaga-only.
  - A version gets the full editor (snippets, 55vh).
  - A version gets a "Penunjang terbaru saja" bar whenever older blocks are
    present.
- **Salin:** a version is the SOAP in another shape, so `body` = the version and
  every shape applies. A jaga note keeps its own shape (`activeShiftNote` is
  now jaga only).
- **Compare:** `ComparableEntry.kind` gains `versi` and a `label`. Non-day
  entries sort above their day's SOAP, newest first. The chip limit went from
  8 to 12, because one day can now be three entries.

### `domain/penunjang.ts` — `latestPenunjangOnly`
- **What is trimmed.** Only text above the first own-line A/Terapi/Plan
  heading. Below it a dated line is a plan (`Rencana Echo (06-10-2026)`), not a
  result.
- **A block** starts at a heading line carrying `(d-m-yyyy)`, `(dd/mm/yy)` and
  similar. It ends at the next such heading, an own-line bold heading, or a core
  S/O/TTV/A/P/Terapi heading. Undated blocks are never removed.
- **Which kind.** The heading is stripped of place words (PJT, IGD, CVCU,
  Lt. N…) and digits, then mapped through synonyms (EKG/ECG,
  Lab/Laboratorium, Echo/Echocardiography, Echo Hemodinamik, Thorax,
  Urinalisa, AGD, LUS). Any other heading is its own kind, by its words.
- **What is kept.** Every block on the newest date of its kind (two draws on one
  day both stay).
- **Failure direction.** Boundaries are found early rather than late. A missed
  tail of an old block stays in the text; it is never someone else's lines
  deleted.

### DPJP format
- `DpjpReportConfig.latestPenunjang`: a toggle in Settings → Format DPJP,
  available for every format, and listed by `describeConfig`.
- The seed for `aha` sets it, but **existing accounts keep their stored
  formats**. Avi needs to switch it on once for dr. AHA.
- CopySheet has a "Penunjang terbaru saja" switch, shown when it would remove
  something. Like the other preferences it is off until ticked or applied with
  "Pakai format ini" (offered, never imposed), and changing it un-applies the
  format.

### Render check
In a Vite harness with mocked entries and Playwright at 390 px, all of these
checked out, with no console errors:
- create "Versi dr. AHA" with trimming;
- the version keeps only the 03-10 EKG and 02-10 lab;
- rename to "AHA ringkas";
- type into the version, and the day SOAP still has both old blocks;
- Salin from the version copies the version;
- Salin on the day SOAP with "Pakai format ini" trims;
- Compare lists "AHA ringkas · Min, 4 Okt".

### Not done
- **Versions are per day.** They are not carried forward, the same as jaga
  notes. Tomorrow's AHA version is made again with one tap, or skipped
  entirely: "Pakai format ini" now trims the day copy directly.
- **Concurrent edits can be lost (pre-existing).** `shiftNotes` is still
  written as a whole array (`writeShiftNotes`). Editing two different
  versions/jaga notes on two devices within the same snapshot window is
  last-write-wins (pattern 5). This already applied to jaga notes, but a
  version is longer and more likely to be edited at length. The fundamental
  fix is one map leaf per note (`shiftNotes.<id>`), which needs a read path
  that accepts both shapes. It is not done in this release.
- **No undo** for the in-version "Penunjang terbaru saja" button. Versions have
  no history stack. The day SOAP is untouched, so a new version restores
  everything.
- `ShiftNotePanel.tsx` is dead code (no importer). Left in place.

```
1829 tests passed (+13)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-10-03.1`

Three requests: line bookmarks in the SOAP, Pagi/Malam in Konfirmasi Jaga, and
SIMGOS-safe symbols in Teks polos.

### 1. Konfirmasi Jaga — no Pagi/Malam

**Root cause.** The roster parser already split weekend rows into `pagi` and
`malam` shifts, and the page already offered a shift picker. Both messages,
however, printed `longDate(shift.date)`. That is the date and nothing about
WHICH team. A senior asked "are you Chief PJT on Sabtu, 5 September" cannot
tell which half of the day is meant. The shift lived in the data model and was
dropped at the last step, the string.

**Fix.**
- `shiftDateLabel(date, shift)` → `Sabtu Pagi, 5 September 2026`;
  `penuh` is unchanged. It is derived from the date and the shift kind, not
  copied from the roster's `hari` cell (the weekend `Malam` row's cells are
  merged in the PDF).
- Used in the Formasi heading, in `buildKonfirmasi` (new `shift` option) and in
  the DPJP-edit labels.
- **Pagi Formasi has no post-midnight DPJP block.** The pagi team hands over
  before 00.00, and Avi's sample Formasi has none. The block stays for Malam and
  for weekdays. The "setelah 00.00" DPJP edit row is hidden for Pagi to match.

**Not done.** The opening line is still `Assalamualaikum dokter, selamat
(waktu) dokter`. Avi's sample reads `Assalamualaikum dokter.` with no
time-of-day. Left as is, since that was not the request. The day stays
unpadded (`5 September`), matching his confirmation sample; his Formasi sample
reads `05`. Unify on his word.

### 2. Teks polos — symbols deleted, numbers changed

**Root cause.** `foldToAscii` guarantees ASCII by making its last step "remove
anything still non-ASCII". That guarantee is right. The named table in front of
it, however, only covered dashes, quotes, spaces, `°`, `≤ ≥ ×`. Everything else
was silently DELETED: `Troponin ↑` → `Troponin `, `Aspilet → CPG` →
`Aspilet  CPG`, `β-blocker` → `-blocker`. Worse, NFKD (step 2) decomposes some
characters into ASCII plus a non-ASCII joiner, and step 4 then removed the
joiner, CHANGING NUMBERS:
- `½ tab` → `1⁄2` → **`12 tab`**; `1½` → **`112`**
- `10³/µL` → **`103/uL`**

**Fix.**
- **Always on (correctness):** `spellNumbers` runs before NFKD. Vulgar
  fractions become `1/2` (with a space after a leading digit: `1 1/2`) and
  superscript runs become `^3`, `^-3`. A leftover U+2044 becomes `/`. There is
  no setting under which a changed dose is acceptable, so no switch.
- **`SYMBOL_ASCII` table (switchable, default ON):** arrows → `->`, `<-`,
  `=>`, `(naik)`, `(turun)`; `±` → `+/-`; `µg` → `mcg` (cannot be misread as
  mg), other `µ` → `u`; `≈` → `~`; `≠` → `=/=`; `÷` → `/`; Greek letters →
  `alpha`/`beta`/`delta`…; `✓ √` → `(v)`; `✗` → `(x)`; `♂ ♀` → `(L)`/`(P)`.
  Parenthesised words are padded where they would fuse with a letter or digit
  (`3,1↓` → `3,1 (turun)`).
- Threaded as `asciiSymbols` through `formatBody` → every composer (copy, jaga
  note, konsul, invasif, PDF report). The sheet passes it, so the Preview and
  the clipboard stay the same string.
- **CopySheet:** in Teks polos, when the note holds a convertible symbol, a
  checkbox "Ubah simbol agar terbaca di SIMGOS" lists each symbol, its
  replacement and its count, or "dihapus" when switched off. It is remembered
  per device (`plano.asciiSymbols`). The note is never changed.
- Other plain paths (drag-copy sanitiser, peek window, revision diff) get the
  default, ON.

**Deviation.** I offered to highlight changed characters "in the Preview". The
Teks preview is a real `<textarea>` (selectable, by design) and cannot
highlight a span. The sheet lists the changes under the Preview instead.

### 3. Line bookmarks

**Design.** The body is one free-form string, copied verbatim. So a bookmark
cannot be a marker in the text (it would reach SIMGOS), and cannot be a line
number (it would shift onto another line). It is instead **the line's trimmed
text + which occurrence**, stored on the patient (`bookmarks.<id>`, one leaf per
change, `setPatientBookmark`). Being on the patient, it survives
carry-forward: yesterday's bookmarked line is usually in today's note.
- `domain/bookmarks.ts`: `lineAt`, `resolveBookmark` (nth, else the last copy),
  `resolveBookmarks` (top-to-bottom, missing kept, duplicates merged),
  `bookmarkLabel`, `reanchorBookmarks`.
- **Re-anchoring:** an edit inside a bookmarked line is followed by mapping the
  line's start through the edit (`mapOffset`, the caret's own mapping). The new
  line takes over only if it shares ≥40% of the old text as prefix + suffix,
  so a deleted line does not hand its bookmark to a neighbour. Writes are
  debounced 1.2 s, and the local value applies immediately.
- **UI:**
  - a toolbar toggle (pressed when the caret's line is marked; works on a
    locked note);
  - a blue bar in the left margin, laid out by a transparent copy of the note
    with the textarea's METRICS;
  - chips on the JumpBar after the sections. A chip calls `revealLine`, which
    scrolls the line under the measured sticky header **without focusing**, so
    no keyboard covers it, and flashes it.
  - "n bookmark tidak ditemukan · Hapus" appears on the latest day only. On an
    older day a newer bookmark is "missing" by definition, and clearing from
    there would delete today's.

### Wrong turns
- **Bookmark fell off after one keystroke** (caught in the render check, typing
  ` koreksi` into a marked line). The re-anchor ran in an effect and stored
  the move in state. A fast second keystroke is a discrete update, so React
  rendered it before that state landed. The second pass then saw the old text,
  found no line, and dropped the bookmark. The vitest harness renders
  keystrokes one `act` at a time and could not show this. The fix is a ref
  mirror of the pending map, updated in the same tick as the move.
- The symbol summary first read `→ → ->`. The separator is now the word "jadi".

### Not done
- Bookmarks are for the day SOAP only, not jaga notes.
- No rename of a bookmark; the chip shows the line's first 24 characters.
- Two identical lines inserted above a marked duplicate can move the bookmark
  to another copy (`nth` is positional among equals).

```
1816 tests passed (+25)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-10-02.4`

**The lab block heading takes its date and unit from the report:
`*Laboratorium PJT (02-10-2026)*`.**

### Root cause

`LabSheet` built the heading from the NOTE's clinical day, in the rail's
short form: `*Laboratorium (30 Agu)*`. The text of the report was never
consulted for when the sample was taken. This was wrong in two ways:

- **Form.** Every hand-written lab heading in the corpus is
  `*Laboratorium PJT (dd-mm-yyyy)*`. `parseSections` and `sectionSlices`
  already document that form.
- **Day.** The note's day is often not the lab's day:
  - an IGD draw registered at 23:36 and resulted at 01:59;
  - a culture registered on the 5th and resulted on the 10th;
  - yesterday's result pasted into today's note.

  All of these were filed under the wrong date.

### Fix

- **`domain/lab/labMeta.ts`:**
  - `readLabMeta(text)` → `{ dates, date, unit }`.
    - **Date:** `Tgl. Registrasi`, the sample date, which is how a lab is
      referred to on rounds. Falls back to `Tgl. Hasil`.
    - **Formats:** day-first `dd/mm/yyyy` and `dd/mm/yy`, with impossible
      dates (31/02) rejected.
    - **Ignored:** date of birth and the `MAKASSAR, dd-mm-yyyy` signature
      line.
    - **Appended reports:** every distinct date is collected, and the newest
      is picked.
  - `labUnitLabel`: `PJT Perawatan Lt. N (…)` → `PJT`, `IGD …` → `IGD`, and
    anything else as printed (CVCU, HCU PJT, Poli Aritmia).
  - `headingDate` gives `dd-mm-yyyy`. `DEFAULT_LAB_TITLE` is
    "Laboratorium PJT" (Avi's example).
- **`LabSheet`:**
  - The title and date follow the report (derived from the raw text, so a
    pasted header works too) until the user edits them.
  - A date field with a line saying where the date came from (PDF, manual,
    or the note's day).
  - A warning when the text holds reports from more than one date.
  - Overrides reset after insert.
- **Tests:**
  - `labMeta.test.ts` (8): registration vs result, two-digit year, DOB and
    signature ignored, appended reports, fallbacks, wide layout, final
    heading.
  - **Corpus run.** All 36 lab PDFs were read through pdfjs in the same row
    rebuild as `extractPdfText`. Every one yielded its `Tgl. Registrasi`
    date and unit. This run was local only; the PDFs are not committed.
- **Render check.** I read two real PDFs (04-09 IGD, then 15-09 IGD) into the
  sheet. It showed the two-date warning, and the inserted block began with
  `*Laboratorium IGD (15-09-2026)*`.

### Not done

- **Mixed dates are not split.** Reports from different dates appended
  together are still parsed into one block, because `parseLab` merges values
  across reports. The sheet warns instead, and splitting per report would be
  a `parseLab` change.

```
1791 tests passed (+8)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-10-02.3`

**Back goes up to the parent screen, like an app. Sheets close on back, and
lists keep their scroll position. Archive months and weeks fold.**

### 1. Back navigation

#### Root cause

The router was a plain `BrowserRouter`, which pushes a browser history entry
for every navigation. The browser's back button therefore replayed the
session in reverse. That is the web's model, and it showed in three ways:

- **Patient days stacked.** `goToDate` pushed `/p/:id/:date`, so back from a
  patient walked through every day that had been opened.
- **Tabs stacked.** Aktif → Arsip → Kalkulator → Pengaturan meant three back
  presses to reach the board.
- **Opened on a detail, back left the app.** A cold start on `/p/x` (a shared
  link, or a reload in a new tab) had nothing under it.

Two related tells came from the same cause:

- **Back ignored open sheets.** Sheets are React state, invisible to history,
  so back left the screen with the sheet open. On the board it closed the app.
- **Lists came back at the top.** Each route mounts its own `AppShell`, so
  `#main` was new on every navigation, including back.

Patching individual call sites (`replace: true` here, `navigate(-1)` there)
cannot fix this. Links, tab buttons and `setParams` all go through the
router's history, and the stack shape is the sum of all of them.

#### Fix

The app now owns its history:

```
domain/navigation.ts   pure: screenLevel, ancestorsOf, planNavigation
lib/appHistory.ts      History for unstable_HistoryRouter that applies the plan
```

**The model:** each screen has a level.

| Level | Screens |
|---|---|
| 0 | `/` |
| 1 | the sections |
| 2 | `/p/…`, `/dokumen/:id`, `/catatan?n=`, `/checklist?c=` |

The browser stack is kept equal to the path from the board to the current
screen. Every push or replace is planned against it:

| Move | Plan |
|---|---|
| Deeper | push |
| Sideways (another day, tab or patient) | replace |
| Upward | `history.go(-n)` to the nearest entry at or above the target's level, then push or replace if that entry is not exactly the target |

A patient opened from Arsip therefore returns to Arsip, and back from any tab
returns to the board.

**Implementation details:**

- **Cold start below the board.** The fresh entry is rewritten into its
  ancestor chain (`/` and, for `/dokumen/:id`, `/dokumen`), with the detail
  pushed on top.
- **Sheets.**
  - `useBackToClose` is used by `Sheet`, `ConfirmDialog` and `NotePopover`.
    While one is open, it registers an overlay, and one extra entry with the
    same URL sits on top.
  - Back consumes that entry and closes the top overlay. If more overlays are
    open, the entry is pushed again.
  - **Closed with ✕:** the entry is left "spent". The next navigation replaces
    it, or plans from the screen underneath. A back press on a spent entry
    goes straight on up, so no press is wasted.
  - The desktop `PatientPeekWindow` is not modal and is not registered.
- **Scroll.** The scroll position of each entry is recorded when it is left
  (sessionStorage, last 200 entries). `AppShell.useRestoreScroll` puts it
  back on a POP. It re-applies for up to ~90 frames while the list fills in,
  and stops on touch or wheel.
- **Router contract kept.** Entries still carry React Router's
  `{ usr, key, idx }`, so `location.state` (`fromList`) and keys behave as
  before. The trail survives a reload (sessionStorage), and the planner
  degrades to the requested push or replace where nothing was recorded.
- **Call sites.**
  - `goToDate` passes `replace: true` explicitly.
  - The patient and Helper ← buttons use `useGoUp`, which returns to the
    entry above, or to a fallback.
  - The `history.length` guess in Helper is gone.
- **Tests.**
  - `navigation.test.ts`: levels, ancestors, every plan shape.
  - `appHistory.test.ts`, in jsdom against a real `window.history`:
    - a cold start on a patient;
    - days and tabs not stacking;
    - Arsip → patient → back;
    - going up to an ancestor;
    - back closing a sheet;
    - a spent sheet entry being skipped;
    - navigating from an open sheet.

#### Wrong turns

- I considered intercepting `window.history.pushState` under
  `BrowserRouter`. It was rejected because React Router renders the target
  before calling `pushState`, so an upward move (`go(-n)`, then render) could
  not be expressed without a flash and a desynchronised location.
- I first planned to swallow the browser's back and then `go(+1)` to keep a
  sheet's screen. It was dropped because it cannot work on the board: back at
  index 0 leaves the page without a `popstate`. Hence the extra entry per
  open sheet.

### 2. Archive folds

- **Month headers and week sub-headers are buttons.**
  - Each has `aria-expanded` and `aria-controls`, and a chevron.
  - A closed month shows its patient count and its number of weeks.
- **Defaults:** the newest month is open and older months are closed. A week
  is open unless it was closed.
- **Storage:** only explicit choices are stored, per device
  (`localStorage['plano.archiveFolds']`), so the defaults still apply to
  months that appear later. There are "Buka semua" and "Tutup semua" buttons.
- **While searching or filtering, everything is open** and the headers are
  inert. The count line says "semua bulan dibuka", because a match inside a
  folded month would read as "not found".
- `isMonthOpen`, `isWeekOpen` and `setAllFolds` live in `domain/archive`,
  with tests.
- **Render check at 390 px:**
  - default: 2 rows (September open, August closed);
  - opening August: 4;
  - closing a week: 3, which survived a reload;
  - Tutup semua: 0;
  - search: 4, all open;
  - no console errors.

### Not done

- **iOS standalone has no back button.** The edge-swipe still follows
  history, so it gets the same model, but this was not tested on a device.
- **Sheet state across navigation.** A sheet that stays mounted across a
  same-page replace (none does today) would lose its back-to-close entry.

```
1783 tests passed (+21)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-10-02.2`

**EKG heading takes the floor from the ward. A redesigned format toolbar.
English where the Indonesian term is forced. Outdated-schedule warnings in
Konfirmasi Jaga. No hospital system name in the calculator. Weekly
dividers in the archive.**

### 1. EKG heading with the patient's floor

- `Snippet.build(date, ward)`. `ekgPlace` turns "PJT Lantai 4" / "PJT Lt 4"
  into "PJT Lt. 4", keeps any other ward as recorded (CVCU), and keeps the
  visible blank "PJT Lt. ..." when there is no ward.
- The format follows Avi's example, `*EKG PJT Lt. 4 (01-10-2026)*` (no
  "di").
- The old rationale for leaving the floor blank (patients move) is
  answered by the heading staying editable on the day the ward is wrong.
- Tests: Lantai/Lt/Lt. forms, CVCU, and no ward.

### 2. Format toolbar

The bar had bare glyphs (↶ ↷ B I • 1.), a native `<select>` labelled
"Sisipkan…", and two cryptic whole-note buttons, "Aa*" and "•→-".

Now:
- **Three groups in one shadowed pill:** history · text format · insert
  and tools. Drawn SVG icons, each with a tooltip and aria-label.
- **"Sisipkan"** is a menu that opens upward and shows the first line each
  block will insert, including the EKG heading with this patient's floor.
- **"Rapikan"** holds the two whole-note rewrites, described in words.
- Menus close on an outside tap or Escape. Every control still prevents
  mousedown, so the textarea keeps its selection.
- On a phone narrower than 420 px the Rapikan label collapses to its icon,
  so the bar fits without scrolling (checked at 390 px).

### 3. English for forced Indonesian terms

Policy (Avi): use the English word where the Indonesian one reads as
forced. Applied to UI strings only; comments are unchanged.

| Was | Now |
|---|---|
| Pratinjau | Preview |
| Sematkan / Lepas sematan / Disematkan | Pin / Lepas pin / Pinned |
| Urungkan | Undo |
| Tersinkron, sinkron, disinkronkan | Synced, sync, di-sync |
| luring / daring | offline / online |
| tertunda | pending |
| Muat ulang bersih | Hard refresh |
| peramban | browser |

New revision labels read "versi offline belum digabung" and "sebelum
gabung versi offline". Existing trail entries keep their stored wording.
Kept in Indonesian because they read naturally: Salin, Unduh, Impor/Ekspor,
Rapikan, Ulangi PIN.

### 4. Outdated schedules in Konfirmasi Jaga

**Problem.** The monthly rosters are replaced by hand. After a month rolls
over without an import, the helper offered last month's names, or said
"tanggal ini tidak ada di jadwal" with no reason given.

**Fix.**
- `rosterFreshness(kind, doc, forDate, today)` in `jaga/recency.ts`, from
  the schedule's own coverage dates:
  - **outdated**: it ends before the date being confirmed, or before today;
  - **ending**: it ends within 3 days of today;
  - **ok**: otherwise. Jarkom, which has no dates, is never flagged.
- A banner above "1. Impor jadwal" lists each flagged schedule with its
  end date. Its import card is outlined red (outdated) or amber (ending).
- Tests cover all three states and Jarkom.

### 5. Calculator

The Ureum/BUN switch reads "Ureum ÷ 6" (it said "Ureum (SIMGOS) ÷ 6"). The
user-facing changelog entry for 09-30.2 is reworded the same way.

### 6. Archive by week

- `MonthGroup.weeks`: Monday–Sunday weeks clipped to the month, newest
  first, holding only weeks that contain a patient. Labelled e.g.
  "Minggu 2 · 5–11 Okt".
- Arsip renders a sub-heading and list per week inside each month.
- Test: October 2026 (1 Oct is a Thursday) gives 1–4, 5–11 … 26–31.

```
1762 tests passed (+5)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-10-02.1` — "frequently Memuat"

**Patient lists are now one shared, long-lived query, so returning to a
screen no longer reloads it. A patient's chart paints from the board's list
at once.**

### Root cause

Every "Memuat…" in the app is one of three gates:

| Gate | Shown while | How often |
|---|---|---|
| `AuthGate` (boot) | auth state is read from IndexedDB | cold start only |
| `BoardPage` / `ArchivePage` | `usePatients(...).loading` | **every mount** |
| `PatientPage` | `usePatient(id).loading` | **every open of a chart** |

`usePatients` opened its own `onSnapshot` query in a `useEffect` and closed
it on unmount, with `loading: true` until the first snapshot.
- Aktif → patient → back to Aktif therefore tore down the board's query and
  built a new one. Firestore then re-ran a composite query (`memberIds`,
  `status`, `deletedAt`, ordered) against its IndexedDB cache before it
  could answer.
- On a phone that costs from a fraction of a second to a few seconds for a
  ward-sized list, so the board said "Memuat…" on every return.
- Opening a patient did the same with its single-document listener, even
  though the board had that patient's data in hand.

No reload or service-worker issue was involved: the SW update flow is
prompt-only (`registerType: 'prompt'`, no automatic `skipWaiting`), so the
app is not reloading itself. Cold starts after the phone suspends the app
still show the boot screen; that is the OS ending the page, not Plano.

### Fix

- **`data/patientsFeed.ts`.** One query per (account, status), ref-counted.
  - The first screen to need a list starts it. When the last screen leaves,
    `active` stays live for the session, and other lists linger 5 minutes.
  - A returning screen reads the held list synchronously: no loading
    state, no second query.
  - Reattach-on-error with capped jittered backoff moved here unchanged,
    keeping the last good list meanwhile.
  - Switching account drops every feed of the previous one, and sign-out
    calls `resetPatientFeeds`.
- **`usePatients`** is now a thin subscriber to the feed, with the same
  signature and result.
- **`usePatient`** seeds from `findCachedPatient`, so a chart opened from the
  board renders at once. The document listener then takes over as before.
- Tests: a second visit causes no loading and no second query; watchers are
  notified; lingering lists stop after 5 minutes; an account switch drops
  the old feeds.

### Not done

- Documents (`useDocuments`) still open a query per visit. They are far
  smaller and rarely revisited, so this is the next candidate if it is
  still noticeable.
- The boot screen after the phone kills the app is unchanged.

```
1757 tests passed (+4)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-10-01.4`

**A phone edit refused by the server is no longer silently replaced by the
laptop's text: it is merged, or raised as a conflict, and always kept in
the trail. Adds an H-1 ICU post-op consult reminder for dr. Muhammad
Nuralim Mallapasi's operations, and PPM/TPM stickers.**

### 1. "Versi luring belum digabung" held the laptop's text

**Report.** The phone's latest SOAP never appeared in Riwayat perubahan;
the "versi luring" entry showed the same text as the desktop.

**Root cause: two faults that together erase the phone's version.**

1. **An optimistic echo was treated as a confirmation** (`useTextSync`).
   - Firestore echoes a local write from its cache at once, with
     `hasPendingWrites`. The editor took that echo as "the server has our
     text": it advanced the merge base and **cleared the draft**.
   - The phone's write carried `baseHash`. The laptop had changed the note
     in between, so the rules **refused** the write, and Firestore rolled its
     cache back to the laptop's body.
   - With no draft left, the editor simply showed the laptop text. Nothing
     was dirty, so there was no merge and no conflict. The phone's version
     vanished from the screen.
2. **The outbox kept one record per day** (`localBase`). The refused body
   stayed in the outbox for the reconciler, but under the day's key. The
   next save — now built on the laptop text shown after the rollback —
   replaced it. When the reconciler ran, it filed *that* body as "versi
   luring belum digabung": the laptop text with at most the phone's newest
   keystrokes. That is the screenshot.

**Fix.**
- `useTextSync` takes `serverPending`, wired from `useEntry`'s
  `hasPendingWrites` through `useBodyEditor`. An own echo advances the base
  and clears the draft **only when confirmed**. Until then the draft stays
  (equal to the server text, so nothing looks unsaved).
- A rollback therefore arrives as a remote change under unsaved text and
  goes through the merge:
  - different lines → merged on screen;
  - the same line on both sides → **conflict dialog**, with both versions
    snapshotted.
- The live merge is character-level. On a rollback specifically (the text
  on screen was sent and never confirmed), a same-line change is forced to
  a conflict, using `sameLineTouched` from `lateWrite`, the rule the
  background reconciler already uses. Without that, the test case merged
  "sesak berat" with "tidak sesak" into "tidak sesak berat".
- A write refused with `permission-denied` is also stored under its **own
  outbox key** (`…|refused|<at>`), which later writes for the day cannot
  overwrite. The reconciler settles it like any record and deletes it by
  key. So the refused text always reaches the trail.
- Tests (`useTextSync.rollback.test.ts`):
  - a different-line rollback keeps both edits;
  - a same-line rollback raises a conflict with the phone text still on
    screen;
  - a confirmed echo still clears the draft and adopts later remote edits.

### 2. ICU post-op consult, H-1 (dr. Muhammad Nuralim Mallapasi)

- `Patient.operationFor` holds the operation date, set as "Jadwal operasi
  (BTKV)" in the reminder picker (long-press sheet and ⋯ sheet).
- `PROCEDURE_RULES` has `{ icu-postop, "Konsul ICU post-op", dpjpId: mnm,
  daysBefore: 1 }`. `activeReminders` includes it on H-1, tickable through
  the same `reminderDone`. The picker says on which date it will appear.
- The surgeon is often not the main DPJP, so the body write now also
  derives `dpjpIds` (every consultant on the DPJP lines), and the rule
  matches on any of them.
- **Registry:** MNM matched the bare token `nuralim`, which dr. M. Zulfadly
  Nuralim (Sp.BTKV) shares, so his patients were attributed to MNM. The
  tokens are now `mallapasi`, `muhammad nuralim` and `nuralim mallapasi`.
  A note that writes only "dr. Nuralim" is no longer attributed to either.
  That is the registry's rule for ambiguous names.

### 3. PPM / TPM stickers

Text tags beside PCI / EP / BTKV: PPM `#9a3412`, TPM `#b45309`, both with
white text.

```
1753 tests passed (+6)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-10-01.3` — phone canvas, rebuilt

**The phone canvas is a grid of small blocks you arrange on the phone,
replacing the scaled-down, read-only copy of the laptop canvas.**

### Why the first version was clunky

`CanvasViewer` drew the laptop layout at its laptop width (about 1180 px)
and scaled the whole surface to the phone, about 0.3×. That gave three
problems:
- Every card was a third of its size: unreadable and untappable until
  zoomed.
- Zooming meant pinch plus panning inside a nested scroll box.
- Nothing could be moved, because the layout belonged to a screen shape the
  phone does not have.

A scaled picture of a canvas is not a canvas.

### What replaces it

- **`domain/board/phoneGrid.ts`.** The phone's own layout: one cell
  `{c, r}` per id on a 3-column grid (4 from 480 px, 5 from 640 px).
  - `placeGrid`: stored cells are kept, new ids fill free cells.
  - `moveBlock`: a move into an occupied cell swaps the two blocks.
  - `compactGrid`: "Rapikan".
  - `readingOrder`: the first-time seed, taken from the laptop canvas.
  - `sanitizePhoneGrid`: validates the stored grid.
  - Tests for each.
- **`PhoneCanvas`.** 78 px blocks showing name (2 lines), room/bed, DPJP
  initials, `done/total` or ✓, Pulang / H-1, and a count of reminders
  still due. The background is the card colour (checklist progress), as
  on the board. Sticky notes are blocks too, and tapping one shows the
  note in `NotePopover` (moved to its own file).
- **Two modes**, so a finger never has to be guessed between "open",
  "scroll" and "move":
  - **Normal:** tap opens the patient, long-press opens the quick sheet
    (checklist and reminders), and the page scrolls.
  - **Atur:** blocks follow the finger (`touch-action: none`), the target
    cell is highlighted, and empty cells are outlined with two spare rows
    below. The page auto-scrolls near the top and bottom edges.
    "Rapikan" packs the gaps.
- **Saved on the account** (`boardPhoneGrid`, replaced whole with
  `updateDoc`), and applied locally first so a drop lands at once. It is
  separate from the laptop layout, which has a different shape.
- `CanvasViewer` is removed. The laptop→account mirror stays: it seeds a
  new laptop and the phone grid's first order.

```
1747 tests passed (+7)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-10-01.2`

**No "Order obat" on the discharge day. A new "Urutan visite" sort that
walks the PJT Lantai 4 loop. On the phone, Urutan sendiri shows the
laptop's canvas, scaled down and read-only, from a copy kept on the
account.**

### 1. Order obat on the discharge day

**Before.** The checklist was one list for every patient and every day. On
the day a patient goes home, the discharge prescription replaces the daily
order, but "Order obat" stayed. The card never reached "Semua selesai",
"Belum: Order obat" kept showing, and the "belum order obat" filter kept
listing the patient.

**Fix.** `domain/checklistDay.ts`:
- `itemsForPatientDay(items, patient, date, today)` returns the steps for
  that patient on that day. A step marked `skipOnDischargeDay` is returned
  **inactive** when the discharge date (`migrateLegacyDischarge`) equals
  the date.
- Inactive is the existing "not part of today, history kept" state, so
  progress, colour, pending label and the tick map all follow with no
  second rule.
- Applied in `buildCard`, `filterPatients` (a skipped step is not "belum"),
  `PatientPage` (all three checklist placements), `QuickChecklistSheet` and
  `PatientPeekWindow`.
- **Default:** profiles predate the flag, so an unset flag means "skip" for
  the seeded "Order obat" (`c8`) only. Pengaturan → Checklist harian has a
  per-step toggle, "Lewati saat pulang hari ini".
- H-1 is unaffected: the order is still written the day before.
- Tests: skipped on the day, kept on H-1, legacy `discharge: 'today'`
  honoured, a discharge day can be complete without the step, and an
  explicit setting wins.

### 2. Urutan visite

- `WardPlan.visitRoute` holds the walking order Avi gave: **420 → 421 → 412
  … 419 → 411 → 401 … 410**. It is a loop that ends back beside 420.
- `BoardOrder` gains `'visite'`. `compareVisit` sorts by route index, then
  by bed (numeric). Rooms off the route, or wards without a route, follow
  in plain location order; patients without a location come last.
- Grouped by canonical ward name, so "PJT Lt. 4" and "PJT Lantai 4" sort
  together. The order is remembered per device like the others.

### 3. Canvas on the phone

**Constraint.** The canvas needs `min-width: 1024px` to arrange, and its
layout lived only in the laptop's localStorage, so the phone had nothing
to show.

**Approach (Avi's choice: show the laptop layout).**
- **Account mirror.** `CanvasBoard` reports every stored change
  (`onStoredChange`, skipped on mount). The board debounces 2 s and writes
  `boardCanvas: { layouts, width, at }` on the profile with `updateDoc`.
  That replaces the field outright: a merge would keep entries and flags
  the laptop has since removed. Writes identical to the account copy are
  skipped.
- **Seed.** A laptop with no local layout starts from the account copy.
  With two laptops, the last arrangement wins.
- **Phone.** `CanvasViewer` draws the layout at the width it was arranged
  at (x/w are fractions of it, y is px) and scales the surface to fit.
  Cards keep their exact positions and height caps, and unplaced patients
  are auto-placed as the laptop would place them.
  - Pinch zoom is anchored at the midpoint between the fingers; − / Pas
    layar / + buttons do the same.
  - It is read-only (no grips). A tap opens the patient, and a long press
    opens the quick sheet.
- On a phone in Urutan sendiri a **Kanvas / Daftar** switch is shown,
  remembered per device. With no account layout yet it says to arrange on
  the laptop first.
- `parseSharedCanvas` validates the account copy entry by entry
  (`sanitizeLayouts`, now shared with `readLayouts`). Tests cover it.

### Not done

- Stickers (emoji on the canvas) are not mirrored. Sticky notes and
  patient cards are.
- Arranging on the phone is not offered: its width cannot hold the layout.

```
1740 tests passed (+11)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-10-01.1`

**The Prof/dokter swap no longer rewrites DPJP titles, and the Ringkas
closing follows the note's own address. The calculators are regrouped, each
with its references; a unit converter is added; the polyuria band follows
the published definition. The board-card note is reimplemented as a
fixed strip plus a floating panel.**

### 1. "Ganti ke dokter" changed DPJP titles

**Root cause.** `toDokterForm` replaced every `\bProf\b` in the whole body,
and `toProfForm` every `dokter`/`dok`. The functions had no notion of
*address* (a vocative: "Tabe Prof", "Terima kasih dokter") versus *title*
(a word before a name: "Prof. Dr. dr. X"). So `_DPJP : Prof. Dr. dr. X_`
became `dokter. Dr. dr. X`, and a plan item `- Konsul dokter anestesi`
became `- Konsul prof anestesi`.

**Fix.** New `domain/address.ts`:
- Only the **opening paragraph** (first non-empty lines up to a blank line,
  max 3) and the **closing line** (last line, when it reads as a sign-off)
  are rewritten. The clinical body is never touched.
- Within them, `Prof` followed by `dr`/`Dr`/`drg` is a title and kept, and
  any line containing `DPJP` is skipped.
- `Prof` → `Dokter` at a sentence start, `dokter` elsewhere; case kept the
  other way.
- `opening.ts` re-exports the new functions, so the sheet is unchanged.
  Its help text now says what is and isn't touched.
- Test: prof → dokter round-trips a note with a TS professor, a DPJP
  professor and a plan mentioning "dokter" back to the identical text.

### 2. Ringkas closing turned to "Prof" on a note written to "dokter"

**Root cause.** Two faults combined:
- `closingFrom` kept the note's own closing only when it matched one of the
  configured closing sentences. Any other wording fell through to a
  generated fallback.
- The fallback chose its address with `/\bprof\b/i` over the whole opening
  block, which includes the opening line's TS/konsulen name and the
  identity/DPJP lines. A "Prof. dr. …" anywhere there signed the report
  off to "Prof".

**Fix.**
- `closingFrom` also keeps a last line that reads as a sign-off
  (`isClosingLine`: thanks or "arahan", not bulleted).
- The fallback uses `noteAddress`: the vocative in the closing, else in the
  opening paragraph, ignoring titles and DPJP lines; "dokter" by default.
- Tests: a Prof TS in the opening line stays "dokter"; an unlisted closing
  is kept verbatim.

### 3. Calculators

- **Revamp:** groups (Ginjal & cairan · Elektrolit · Konversi satuan · Alat
  lain) with a sticky jump bar, and two columns from `md`. Every card has
  the same shell: title, formula, inputs, a result block with "Salin baris",
  and a "Rujukan" list. Results appear only once every field is typed
  (urine output and sodium correction had the `Number('') = 0` fault too).
- **Unit converter** (`domain/calc/units.ts`): Ureum ↔ BUN ↔ mmol/L,
  creatinine mg/dL ↔ µmol/L, glucose mg/dL ↔ mmol/L. Every factor is
  derived from a molar mass (urea 60.06, urea N 28.014, creatinine 113.12,
  glucose 180.16), so ureum/BUN = 2.144.
- **References audit:**

| Calculator | Checked against | Result |
|---|---|---|
| Urine output — oliguria | KDIGO AKI 2012 (< 0.5 for 6–12 h; < 0.3 for ≥ 24 h) | Correct; the stages are now quoted on the card |
| Urine output — polyuria | Merck Manual: > 3 L/day in adults | **Wrong:** it was a rate > 3.0 ml/kg/h (4.3 L/day at 60 kg), not a published threshold. Now > 3 L per 24 h, a shorter collection projected to 24 h |
| Sodium correction | Katz NEJM 1973 (1.6); Hillier Am J Med 1999 (2.4) | Correct; citations on the card |
| Osmolality | 2Na + glu/18 + BUN/2.8; effective per the 2024 consensus; Spasovski 2014 | Correct since 09-30.3; citations expanded |

### 4. Board-card note

**Root cause.** Opening a note grew it **in place** and asked the layout to
make room: two columns in masonry, an uncapped height on the canvas. The
canvas places cards where the user put them, so nothing moves, and the
opened note painted over the card below. Its fill (`--warn-soft`, 25–33 %
alpha) let that card's text show through, which gave the two
interleaved texts in the screenshot.

**Fix.**
- The strip on the card is fixed: two lines (`line-clamp-2`), plus
  "+N baris · ketuk untuk membaca" when there are more.
- Tapping opens `NotePopover`: portalled to `body`, fixed-positioned under
  the strip (above it when there's more room), opaque `bg-surface`,
  shadowed, max-height from the available room with its own scroll. It
  closes on outside tap or Escape.
- Removed from the board: `notesClosed` persistence, the
  `noteExpanded`/`onToggleNote` props, and the canvas "note" uncap. The
  board never relays out for a note, and a card's measured height no longer
  depends on it.

### Also

- Test fixtures still carried a real-looking name, date of birth and RM
  from an old note (`vascularNoteCopy`, `parseLab`, `pdfReport`, `board`
  tests). They are anonymised.

### Not done

- `CanvasBoard` still has the `'note'` uncap branch (`hMaxWithNote`),
  which is now unreachable. It is left in place to keep this change out of
  the canvas sizing code.
- The note panel is read-only; editing stays on the patient page.

```
1729 tests passed (+18)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-09-30.3` — osmolality cut-offs

**The osmolality card labels its results against published cut-offs, each
with its source. Asked for by Avi as an explicit exception to "no built-in
reference ranges": these are guideline decision thresholds, not a lab's
range, and the lab range stays overridable.**

| Value | Cut-off | Label | Source |
|---|---|---|---|
| Effective | < 275 | hipotonik | Spasovski et al., Eur J Endocrinol 2014 (defined on measured osmolality; calculated effective is the proxy) |
| Effective | > 300 | ambang HHS (bila GDS ≥ 600) | Umpierrez et al., Diabetes Care 2024 |
| Total | > 320 | ambang HHS (bila GDS ≥ 600) | Umpierrez et al., Diabetes Care 2024 |
| Total | 275–295 | normal / di bawah / di atas | Usual range; replaced by Pengaturan → Rentang rujukan lab → Osmolalitas when set |

- The 2024 consensus lowered the HHS criterion from effective > 320 (2009)
  to effective > 300 or total > 320. The code uses 2024 and says so.
- `readEffective` / `readTotal` replace `bandFor` / `OSMOLALITY_BANDS`.
  Each result has a chip (accent for low, amber for high) and the card
  lists the sources under the numbers.
- Tests cover every cut-off boundary and the user-range override.

### Not done

- The copied line still carries the numbers only, not the labels.

```
1711 tests passed (+1)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-09-30.2` — osmolality calculator

**The osmolality card divided UREUM by BUN's 2.8, overstating the urea term
2.14×. It now asks which one was entered, shows the effective (tonicity)
value used for hyponatraemia, waits for all three fields, and has no
built-in range.**

### Root cause

`calculateOsmolality` was `2·Na + glucose/18 + BUN/2.8`, documented as
"BUN or ureum, mg/dL". The divisor is a unit conversion: mg/dL ÷ (molar mass
÷ 10). 2.8 is urea NITROGEN (28 g/mol). SIMGOS reports **Ureum**, the whole
molecule (60 g/mol), so its divisor is 6. The code treated two different
analytes as one, and the lab parser does the same (`Ureum: ['ureum', 'urea',
'bun', 'ur']`), which is how "BUN or ureum" read as reasonable.

| Ureum (mg/dL) | Correct urea term | Old card | Error |
|---|---|---|---|
| 30 | 5.0 | 10.7 | +5.7 |
| 60 | 10.0 | 21.4 | +11.4 |
| 180 | 30.0 | 64.3 | +34.3 |

In a cardiorenal patient (Na 128, GDS 110, ureum 180) the card said 326
("hiperosmolal"); the calculated value is 292, and the tonicity is 262,
which is hypotonic.

Three smaller faults in the same card:
- **Blank fields computed as 0.** `Number('')` is 0, so typing only the Na
  showed a finished result (280 at Na 140) while the hint said "Isi
  ketiganya".
- **Built-in 275–295 bands**, against the no-hardcoded-ranges rule.
- **No effective osmolality.** Urea is an ineffective osmole. Whether a
  hyponatraemia is hypotonic, the question before correcting sodium, is
  answered by `2·Na + glucose/18`. The card showed only the total.

### Fix

- Input is `{ sodium, glucose, urea, ureaKind: 'ureum' | 'bun' }`, with
  `UREA_DIVISOR = { ureum: 6, bun: 2.8 }`. The card has a segmented
  control, Ureum (SIMGOS) ÷ 6 by default, and the field label follows it.
- Returns `total`, `effective` and `ureaTerm`. The card shows the effective
  value first, labelled for hyponatraemia, and the total with its urea term.
  The copied line names the urea kind and both values.
- Result only when all three fields are typed.
- Bands come from Pengaturan → Rentang rujukan lab, new row "Osmolalitas"
  (`Osm`). Without it, no label and a hint where to set one. The SOAP
  checker iterates its own analytes, so the new key does not reach it.
- Tests: ureum 30 and BUN 14 give the same 290; the ureum 180 case; working
  line; bands only with a user range.

### Also

- `sodiumGlucose.ts` comment said Katz and Hillier differ by "about 6" at
  glucose 600; it is 4 (500 × 0.8/100), as the test and the card say.

### Not done

- The lab parser still files a `BUN` result under `Ureum`. SIMGOS prints
  Ureum, so no Plano data is affected today, but a BUN from another lab
  would be misread in Ur/Cr. Separating them is its own change.
- The correction formulas themselves (deficit, rate) stay in ElektroCalc.

```
1710 tests passed (+2)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-09-30.1`

**Daily reminders on the patient card (EKG, urine output, your own), ticked
off from the board. Every unchanged day counter in Periksa lagi is its own
chip with +1. Periksa lagi catches an unchanged urine output however it is
written. Settings has search and a jump bar. An in-app changelog.**

### 1. Day counters: one chip each, +1 each

**Before.** One finding listed every unchanged counter in a sentence
("H-3, POD-2, hari ke-9") with one Tampilkan, to the first. Getting to the
third meant finding it by eye, and advancing one meant typing.

**Now.** The finding carries each counter with its position (`markers`).
The panel shows a horizontally scrolling row of chips: tap a chip to select
that counter in the note, tap **+1** to advance only that one.
- `locateDayMarker` finds the counter again at its recorded position, or,
  if typing has moved it, the n-th counter with the same text.
  `bumpDayMarkerAt` changes only its digits.
- The +1 is a `transform` change, so it is one undo step.
- Test: advancing one of three counters leaves the other two untouched.

### 2. Unchanged urine output

**Root cause.** The copied-forward check (`readFlows`) knew urine only as a
line starting `Urine` with a number followed by `cc`, compared as a string.
The ward also writes `Urin`, `UO`, `Produksi urin`, `Diuresis` and `BAK`,
`ml` as often as `cc`, and adds a rate (`1,2 cc/kgBB/jam`). Any of those
forms was never reported, and a re-spaced line counted as "changed".

**Fix.** `readUrineOutput` reads the first urine line under any of those
names: the volume (a number with cc/ml, NOT followed by `/kg`) and the rate
(cc/ml per kg), as numbers. `urine-unchanged` fires when the volume is equal
and the rate is equal or missing on either side. Tampilkan lands on the
label. `readFlows` no longer reports urine, so there is no double finding;
balance is unchanged. Five ward formats are tested, plus the anchor.

### 3. Daily reminders (pengingat harian)

A patient can have reminders that show as chips on the board card: **EKG**
and **Urine output** by default, plus any kind added in Pengaturan →
Pengingat harian (rename, reorder, remove).
- Per patient and per kind: Tidak / Hari ini / Setiap hari. Set from a long
  press on the card (the quick sheet now has the picker under the
  checklist) or from the patient's ⋯ sheet. "Hari ini" stores the date,
  so it expires by itself.
- **Tap the chip to tick it.** The tick stores the clinical date, so it
  clears itself tomorrow and a standing reminder is due again. Amber while
  due, ✓ on a soft accent when done.
- Stored as `reminders.<kind>` (one field path per kind, so two devices
  setting different kinds do not overwrite each other) and
  `reminderDone {date, ids}`. The old EKG badge's `ekgHarian`/`ekgFor` are
  still read for the `ekg` kind and are deleted the first time EKG is set
  through the new picker, so no card lost its mark in the upgrade.
- Removing a kind in Settings hides it; patients' settings stay, and adding
  it back under the same name restores them.

### 4. Settings revamp

- **Search** at the top (pinned while scrolling): matches the start of any
  word in a section's title, description or keywords ("pin", "gelap",
  "reset", "pengingat"). Matching sections open; groups with no match hide
  (CSS `:has`, so each section stays self-contained); "no match" is said.
- **Jump bar:** one chip per group; the Akun & aplikasi chip has a dot
  when there is an unread changelog.
- **Six groups instead of four headings plus stray sub-headings:** Tampilan
  · Papan & harian · Format laporan · Privasi & data · Lanjutan · Akun &
  aplikasi. The old page rendered two group headings in a row in three
  places.
- Bigger targets: section headers have a chevron in a 28 px circle,
  switches are 48×28 and each Toggle row is 44 px tall. Focus rings on
  both. Setel ulang is collapsible now, so the danger button is one more
  tap away.

### 5. In-app changelog (Pengaturan → Yang baru)

- Source: **`CHANGELOG.md`** at the root, short and in Indonesian, one
  bullet per change. CHANGES.md stays the engineering record; at 300 kB of
  English it does not belong in the bundle.
- Loaded as a separate chunk (`?raw`, dynamic import) only when the
  section opens; the service worker precaches it, so it works offline.
- The newest four releases show, "Tampilkan N pembaruan sebelumnya" for
  the rest. The running version is marked "Versi ini".
- "Baru" badge (and the dot in the jump bar) until the section has been
  opened once on this device (localStorage, per device).
- `check-version.sh` excludes CHANGELOG.md like CHANGES.md: it is prose
  history. **A test fails when the newest CHANGELOG entry is not
  `APP_VERSION`**, so a release cannot pass `verify` without a user-facing
  entry.

### Wrong turns

- Search matched substrings first: "pin" found "Tata letak" (in
  "sam**pin**g") before Privasi. Now prefix of a word.
- The reminder `ReminderPicker` lived inside PatientActionsSheet; moved to
  its own file when it was added to the long-press sheet.
- The done chip was `text-fg-faint line-through`, near-invisible on the
  dark card. Now muted text on `--accent-soft` with a ✓ in accent.

### Not done

- No reminder list or filter on the board ("who still needs an EKG
  today") — the chips are per card only.
- The changelog "seen" mark is per device, not per account.

```
1708 tests passed (+15)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-09-29.8`

**Opening lines corrected for konsul KJS and konsul kelayakan. Pembuka no
longer mangles the poli template's opening. The echo list opening is
retired. A Plano export can now be imported.**

### 1. Openings (from the revised SOAP format)

| Template | Before | Now |
|---|---|---|
| Konsul KJS pasien baru | `… melaporkan pasien baru KJS *TS (Bagian) ((Nama DPJP TS))* …` | `… melaporkan konsul pasien dari *TS (Bagian) (Nama DPJP TS)* …` |
| Konsul kelayakan pra tindakan | `… melaporkan konsul baru dari *TS …*` | `Assalamualaikum dokter, tabe dokter, mohon izin melaporkan konsul kelayakan tindakan dari *TS (Bagian) ((Nama DPJP TS))* …` |

- **Pembuka sentences:** the echo "list pasien echocardiography full study"
  opening is removed. The three konsul/new-patient sentences above, plus
  "pasien baru dari *Poli …*", are added so Pembuka can switch between them.
- Seed reconciliation delivers these to every profile. A template you edited
  yourself is merged, not overwritten; a sentence you never touched is
  replaced or removed.

### 2. Pembuka replaced the poli opening wrongly

**Root cause.** The opening line was split into greeting and report at the
**first full stop**, assuming "<greeting>. <report>". The poli template is
`Assalamualaikum dokter, tabe dokter izin melaporkan …`: a comma and no full
stop. So the whole line counted as the report.
- Picking a greeting PREPENDED a second one: "Selamat pagi dokter.
  Assalamualaikum dokter, tabe …".
- Picking a sentence threw away the salam.

The same rule split a greeting-less report at the `dr.` in a DPJP's name.

**Fix.** The report starts at its reporting words (`Tabe`, `Mohon izin`,
`Izin`, `Kami mohon`). Everything before them is the greeting, whatever the
punctuation. The greeting gets its full stop, and the report is capitalised
when a greeting precedes it. Without reporting words, the old rule applies.
Tests cover the comma form and the `dr.` case.

### 3. Import a Plano export (Settings → Impor data)

For moving to a new Google account, a lost account, or starting over.
- **Preview first:** when the file was exported and from which version,
  then counts of new patients, daily notes, daily checklists and documents,
  and what will be skipped because it is already here.
- **Only adds, never overwrites.** Patients and documents already in the
  account are skipped. Catatan notes, board notes and checklist ticks are
  merged key by key (existing ones kept). Settings are replaced only if you
  tick that option.
- **Patients get new ids** owned by this account, with `importedFrom` = the
  old id. The old account's patient documents still exist under their ids,
  and the rules rightly refuse writes into them. Because of `importedFrom`,
  **importing the same file twice creates no duplicates**, and a run that
  stopped part-way can simply be repeated.
- Timestamps in the JSON are turned back into Firestore Timestamps.
  One-write fields (`baseHash`, `editing`) are dropped.
- Needs a connection. Each patient is written first and its notes after,
  because the rules check the parent patient on the server. It goes patient
  by patient, so a failure never leaves a patient without their notes.
- Tests cover the planner, the merge, idempotency and timestamp revival.

```
1693 tests passed (+10)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-09-29.7`

**Google-only sign-in, enforced. Admin page redesigned. The sidebar's
bottom is one compact card. Archive search chooses where to look. Archived
catatan jaga are a dated log. Adding a SOAP jaga is one tap, from a
template.**

### 1. "Email/Password is disabled in Firebase, yet people still sign in with it"

**Root cause, two layers.**
1. **The form was hardcoded** on the sign-in page. Disabling the provider in
   the Firebase console does not change the app; the page kept inviting
   password sign-ins.
2. **Disabling a provider does not sign anyone out.** Firebase refuses NEW
   password sign-ins (`auth/operation-not-allowed`). A session created with a
   password BEFORE the switch keeps a valid refresh token and keeps working,
   and nothing in the app or the rules looked at HOW an account signed in.
   So existing password sessions kept full access.

**Fundamental fix, on both sides.**
- **Server:** `firestore.rules` `allowed()` now also requires
  `request.auth.token.firebase.sign_in_provider == 'google.com'` on every
  data path. The admin UID is exempt, so this can never lock the owner out.
  This deploys through the existing `firestore-deploy` workflow when pushed.
- **App:** the sign-in page is Google-only (the email form and the
  `signInWithEmail` / `registerWithEmail` code are gone). A password session
  that is still signed in now sees "Masuk dengan Google" with a Keluar button
  (`decideAccess` → `not-google`) instead of the app.
- Tests: `decideAccess` refuses a password session except the admin, and a
  test checks the rules contain the provider gate.

### 2. Admin page

- Header and **summary tiles**: Akun, Aktif 7 hari, Menunggu (amber when any
  are waiting), Dicabut.
- **Access switch** as a status card with an Aktif/Nonaktif badge, still a
  two-tap confirmation.
- **Filter tabs with counts.** The page opens on Menunggu when anyone is
  waiting, else on Semua. There is also a search box.
- **Compact rows:** initial, name, status pill, "aktif 2 jam lalu", the app
  version with an **outdated version marked in red** (the usual reason a fix
  "did not work" for someone), and the patient count. Details and UID open on
  tap. Actions wrap under the row on phone.

### 3. Sidebar bottom

The DPJP box, clipboard box, sync pill and two-line footer were separate
blocks. On a patient page they were taller than the navigation above them.
Now:
- **One context card** with compact rows: `DPJP CPT <format>` / `Poli … ·
  lalu …`, a divider, then 📋 name / what · time (amber if another patient
  is open). The full text is on hover.
- **One status line:** ● Tersinkron and the version (© on hover).
- The rail scrolls if a very short window still runs out of room.

### 4. Arsip: choose where to search

"Cari di [Identitas] [Catatan arsip] [Isi SOAP]", any combination,
remembered per device. The default is Identitas + Catatan arsip. Isi SOAP
loads the notes only when chosen. The snippet comes from the archive note
first, else the SOAP. `matchArchivedScoped`, with tests.

### 5. Archived catatan jaga: always by date made

Newest first, and drag-to-reorder is off for that view (`isDateOrdered`). A
hand-sorted log is one whose order lies about when things happened.

### 6. SOAP jaga, revamped

Before: ⋯ → find "Tambah SOAP jaga" among ten actions → an empty box
stamped with the time of the tap → switch back through the date rail.

Now:
- **A row directly above the editor:** `SOAP hari ini · Jaga 21.40 ·
  Jaga 03.10 · + SOAP jaga`. One tap creates a note, one tap switches between
  notes, and switching saves the note you leave.
- **Starts from the jaga template:** S / O with a blank vitals line / A / P,
  with the **caret already on the complaint line**.
- **Editable time:** tap the time in the note's header. It accepts `3.10`,
  `03:10` and `0310`. Useful when the note is written up after the event. Any
  pending text is written in the same save.
- The template picker no longer shows (writing into the day SOAP) while a
  jaga note is open.

### Also fixed

**Every tinted fill in the app was transparent.** Tailwind emits no CSS for
`bg-accent/15` when the colour is a CSS variable. The affected places were
14 classes: search highlights, the peek's date chip, revision-trail marks,
the jaga frame header, the side panel and others. They now use
`--accent-soft` / `--danger-soft` tokens (light and dark).

```
1683 tests passed (+6)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-09-29.6` — bug audit

**Audit of the whole app (data/sync, patient page and editor, board,
parsers, shell/auth), about 45 findings. Each was checked against the code.
The confirmed ones are fixed at the root, with tests; the ones left open
are listed at the end with reasons.**

### A. Notes and data (lost or wrong-day writes)

| # | Bug | Root cause | Fix |
|---|---|---|---|
| A1 | **"Hapus catatan" silently refused** on any day that had been typed in; the clear flashed and rolled back | The rules read the MERGED document, and `baseHash` stayed stored from the previous write. A write that sent none was checked against that leftover, which never equals the current `bodyHash` | Every body write now sends `baseHash` or `deleteField()`, and so does the clear. Client-only, no rules deploy |
| A2 | **Typing lost when the day changed under the editor**: midnight rollover on a page following "today", back/forward between days | The flush lived at one call site (`goToDate`). A key change moved `latest` to the new key, so the pending debounce flushed the NEW, clean note | `useTextSync` saves the previous note, with its own writer, on the key transition itself (layout-effect cleanup). Test fails on the old code |
| A3 | **Jaga notes lost**: saved only on blur | A second editor outside the SOAP editor's durability path | Idle save (1.5 s), save on hide/pagehide/unmount, save with the OLD day's writer when the day changes, registered with the update banner |
| A4 | **For one render after a day switch, the entry hook returned the previous day's note.** Effects: a spurious conflict or "digabungkan otomatis" on the first keystroke, undo starting from another day, the card heal writing an older assessment | Subscription results were not tagged with the key they belong to | `useEntry` tags the result with `patient\|date` and reports "loading" for any other key, in the same render |
| A5 | **Carry-forward could write into the day you navigated to** while its read was in flight | The editor's setter from an old render stored under the old key but moved `latest` forward, so the flush wrote the new day | The setter refuses when its key is not current (covers every async caller); carry-forward also checks the note it was pressed on |
| A6 | **Rapikan SOAP could apply another day's AI suggestion** | The code comment promised "discarded on a different body"; nothing did it | The suggestion is stored with its source body and shown only while the note is still that body |
| A7 | **Lab insert went into the day SOAP while a jaga note was open** | Each transform chose its own target | One `activeNote {body, apply}` used by lab, reformat, opening and tidy |
| A8 | **"Perbarui kartu pasien" rebuilt every card from the day of ADMISSION** (the version before today's did too) | `fetchEntryBodies` returns newest first; the caller took `.at(-1)` | It takes the newest non-IGD day |
| A9 | **The admission note sorted as the NEWEST day** (preview, peek, history summary sent to AI) | `'igd' > '2026-…'` as strings | `compareEntryDates` puts IGD first; used by `fetchEntryBodies` and the history summary |
| A10 | Sticky-note image hung offline, leaving an orphan | Awaited the image write (server ack) before queueing the link | One `writeBatch` |
| A11 | Carry-forward banners followed you to other days | Not reset with the day | Reset with the day |

### B. Sign-out and device privacy

| # | Bug | Fix |
|---|---|---|
| B1 | **"Lupa PIN? Keluar" signed you straight back into the same lock, forever**; the next person on the device got your PIN | Sign-out clears **every** `visite.*`/`plano.*` key except four that describe the device (`lib/deviceUserState.ts`). New keys are cleared by default |
| B2 | **Sign-out deleted unsynced edits without a word** (outbox and Firestore queue) | Open editors are saved first, then it waits for the queue up to 5 s. If anything is still unsent it asks: **Tunggu sinyal / Keluar tetap** (`SignOutButton`, used in all three places) |
| B3 | The next person inherited your **Anthropic key and AI consent** | Covered by B1 |
| B4 | The clipboard pill showed the previous user's patient, and ignored initials-only | Covered by B1; the pill now follows initials-only (no RM) |
| B5 | Sign-out with another Plano tab open **kept the offline cache** while saying it was deleted | The next boot says so, and what to do |
| B6 | "Muat ulang bersih" offered offline could leave **no app at all** | It checks the server first; if unreachable, nothing is deleted and it says so |
| B7 | Sign-in page claimed "Kunci PIN aktif secara bawaan" (false) | Text corrected |

### C. Board

| # | Bug | Root cause | Fix |
|---|---|---|---|
| C1 | **Board re-rendered forever with no profile yet** (new account, first offline load): "Maximum update depth exceeded". Found by the render check, not by the reviewers | The `settings()` selector returned a NEW default object on every call | One default object, built once |
| C2 | **Drag in Titipan or during a search wiped the hand-made order of Pasien saya** | Order rebuilt from the filtered view and saved as the whole order | `reorderBoard` keeps the hidden ids in their slots (test) |
| C3 | **Initials-only leaked** name and RM: Denah lines and tooltips, peek title bar, quick-checklist title, search snippets, archive note | Each surface had its own (or no) privacy rule | Denah uses the board's `initials` and drops the RM; peek and quick checklist use `cardTitle`; snippets and the archive note go through `privateText` |
| C4 | **Peek window ticks went to yesterday** before today's note existed | Checklist/todos used the note's date | Always today |
| C5 | Quick checklist popped up after an ordinary tap | The long-press timer was a render-local `let` | A ref |
| C6 | **Batch trash/archive hit patients no longer on screen** | Selection survived scope/search changes | Pruned to the visible cards |
| C7 | Canvas placement and Rapikan during a search ignored hidden cards | Positions were computed from the filtered set | Placement runs over the whole scope; only drawing is filtered |
| C8 | Peek windows jumped 28 px when a back one was pressed | Cascade followed the live z-order | Index captured at open |
| C9 | Long-press on an archived search result did nothing | Looked up only in active patients | Both lists |

### D. Parsers and calculators (wrong clinical content)

| # | Bug (actual → expected) | Fix |
|---|---|---|
| D1 | `CA 19-9 30` → **Kalsium 19**; `CA 125 35` → Kalsium 125 | Names containing numbers (`NUMBERED_NAME`) are not claimed by the `ca` alias |
| D2 | `HbA1c 6.5` → `HbA 1`; `FT4 1.5` → `FT 4`; `Vitamin B12` → `Vitamin B 12` | The fallback label ends at the first WHOLE number, not the first digit |
| D3 | Urinalysis `Leukosit 2+` → **WBC 2+**; `Eritrosit 10` → RBC; `Glukosa Negatif` dropped | Section-scoped aliases under Urinalisis; a blood heading ends the urine section; word-result rows in the table are kept |
| D4 | `P: 20` / `S: 36,5` under O opened **Plan / Subjektif** sections (vitals then not cleared, Plan copied "20") | Inside O, a one-letter S/P label followed by a number is a field (`isVitalField`) |
| D5 | `Massa: tidak teraba`, `Class:`, `Bypass:` → **Assessment** | Stems anchored to a word start |
| D6 | "melaporkan… Tn. Budi" → name "an pasien di …"; `RM 1478911 66 tahun` → MRN **147891166** | Word-bounded honorific; the age is removed before reading the MRN |
| D7 | Archived 00:00–07:59 WITA filed under the previous day or month | Local calendar day, not UTC |
| D8 | Urine output 0.496 shown as 0.5 "Cukup" | Band from the exact rate; 3 decimals when 2 would cross a band |

Regression check on the 42 real lab PDFs (text extraction, old vs new
parser): 6 outputs changed, all for the better. Non-lab lines such as
`MR. 24` and `NHS 2` no longer appear in Lain-lain, and one qualitative row
(ANA) that used to be dropped is now kept.

### Not fixed in this release (and why)

- **Jaga notes and patient todos are still written as whole arrays**, so two
  devices editing the SAME day's jaga notes offline can overwrite each other.
  The fix is a keyed map with per-note writes, which needs a data migration
  and deserves its own release.
- **The "sent body" memory is not persisted**: after an app kill mid-offline
  typing, the reconciler may park the newest text in Riwayat instead of
  merging it. Needs the sent-body record in IndexedDB.
- **A refused body write still updates the board card** until the note is
  opened (the heal from .5 then corrects it).
- **The PIN-toggle intent is not reconciled** with a PIN actually being set
  on a new device.
- **At midnight a page that follows "today" still switches day** (no text is
  lost any more, A2). Whether it should stay on the day being written is a
  behaviour choice to make.

```
1677 tests passed (+12)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-09-29.5`

**Cardiology markers (PCI, EP, BTKV). The app says whose note is on the
clipboard, and warns when it is another patient's. Cards update
themselves. Helper has a way back. Archive rows show the archive note. The
drag handle of a card at the very top is reachable again.**

### 1. Penanda: PCI, EP study / Ablasi, Operasi BTKV

A new first group, **Tindakan kardiologi**, with three **text tags** drawn
as coloured pills (PCI red, EP purple, BTKV teal) rather than emoji. No
emoji says "PCI" to a colleague, and a guessed one is a meaning kept in one
person's head. The stored value is the text itself (`stickerTag`), so
nothing about how stickers are saved changed.

### 2. Whose note is on the clipboard

- **Always in view:** "Terakhir disalin · SOAP harian 29/09 · 11.34 /
  **Tn. X** · RM …". It sits in the sidebar above the sync pill on desktop,
  and floats above the tab bar on phone. Tap × to hide it.
- **Amber, "Clipboard berisi pasien LAIN"**, when a different patient's
  page is open. That is the moment a paste into SIMGOS would land in the
  wrong chart.
- Recorded by: **Salin** (every format), and every **Salin RM** (card,
  peek, patient page).
- The Salin sheet's title is now the patient's name; the subtitle gives the
  note date and RM. The copy button shows the name in large type.
- Limit: this is what **Plano** copied. Browsers do not let a page read the
  clipboard without a permission prompt, so something copied in another app
  afterwards is not known. That is why the label says "Terakhir disalin".

### 3. Cards update themselves ("Perbarui kartu pasien" was needed too often)

**Root cause.** Every write sets the card's preview from **the day being
written**. So opening **yesterday** to fix a line put yesterday's assessment
on the card (and moved `lastEntryDate` back). It stayed there until today's
note was typed into again. The maintenance button was being used to undo
that.

**Fundamental fix.**
- The preview only moves **forward** (`previewMovesTo`). A write to an older
  day still updates DPJP/KJS, but not the card text.
- **Heal on open:** opening a patient's **latest** day puts it on the card
  if the card says anything else (`healCardPreview`). There is no write when
  the card is already right. Any drift — a rule change, a deleted day, a
  race — fixes itself by being looked at.

**The button** is still there for rule changes, but:
- It runs **6 patients at once** instead of one by one.
- It covers **active patients only** by default. The archive (which only
  grows) is behind a checkbox.
- It skips cards that are already right.
- It takes the latest non-IGD day (it used to take the last entry, which
  could be the IGD note).

### 4. Helper had no way back

**Root cause.** `/helper` was the one route rendered **outside `AppShell`**:
no sidebar, no tab bar. In the installed app, closing the app was the only
way out.

**Fix.** It is now inside `AppShell` like every page, and has a back button
beside the title. (The WIP badge border was a Tailwind opacity-on-variable
class that emitted no CSS; it is now `border-danger`.)

### 5. Arsip: the archive note on the row

The note written at archiving ("Catatan arsip") now shows on the row, up to
3 lines, with an amber rule and search highlighting. It is also part of the
normal search (`patientHaystack`), so no toggle is needed to find a patient
by it.

### 6. Card at the very top: drag handle under the header

**Root cause.** The handle is drawn 16 px **above** its card, but card
positions are floored at the canvas's top edge. A card at y = 0 therefore
had its handle outside the canvas, under the pinned header. The canvas's
`pt-1` did nothing: cards are absolutely positioned, and padding does not
move them.

**Fix.** The canvas gets a 20 px top margin, which moves cards and stickers
alike, and no stored position changes. Measured: handle top 106 px vs header
bottom 122 px before (hidden), 126 px after (grabbable).

**Wrong turn:** the explanatory comment was first placed bare inside JSX and
rendered as text on the board. The render check caught it.

```
1665 tests passed (+3)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-09-29.4`

**Updating the installed app on a phone: found on its own, applied in one
tap, and a phone equivalent of Ctrl+Shift+R. The phone no longer waits on
Google's sign-in page before showing the app.**

### 1. Long "Memuat…" on the phone (not on the laptop)

**Root cause.** `getAuth()` attaches Firebase's popup/redirect sign-in
machinery. On a **mobile** browser only, the SDK then loads Google's sign-in
iframe from the auth domain **before** it reports the first auth state, even
when you are already signed in. So every cold start (and every update
reload) waited on a network round-trip to Google. Desktop browsers skip that
step, which is why the laptop felt instant.

Measured on this build with the sign-in hosts delayed 5 s (phone emulation):

| | Phone | Laptop |
|---|---|---|
| Before | **5.2 s** "Memuat…" | 0.2 s |
| After (signed in before) | **0.2 s** | 0.2 s |

**Fundamental fix.** `initializeAuth` with IndexedDB → localStorage
persistence. The sign-in machinery is attached at boot only when nobody was
signed in on this device (`data/authHint.ts`), because the sign-in screen
needs it ready. Sign-in calls pass it explicitly, and `getRedirectResult`
runs only on a signed-out boot. Sign-out already reloads, so the next boot
attaches it.

**Not fixed (SDK):** on boot, Firebase still refreshes the signed-in
account over the network (`getAccountInfo`), on phone and laptop alike. On
a very bad signal that can still take a while. So after 8 s the boot screen
now explains itself and offers **Muat ulang bersih**.

### 2. "Muat ulang" on the update banner sometimes did nothing

**Root cause.** `updateSW()` from vite-plugin-pwa only **posts**
`SKIP_WAITING` and returns. `applyUpdate` reloaded as soon as it returned,
before the new worker had taken over. The reload was often answered by the
**old** worker: same version, banner back. It read as "the button doesn't
work".

**Fix.** The reload now waits for `controllerchange` (the new worker in
control), with a 6 s fallback that reloads anyway. The button shows
"Memuat…" and cannot be pressed twice.

### 3. The phone found updates late

**Root cause.** The browser checks for a new `sw.js` when a page is
**navigated to**. An installed app on a phone is **resumed** from the
background for days, never navigated. So it kept running the old version
until it happened to be killed and reopened, and even then the first open
still showed the old version.

**Fix.** The app checks when it returns to the foreground (at most once a
minute), when the connection comes back, and hourly while open.

**Verified end to end** (production build, phone emulation): version A
installed → version B deployed → app backgrounded and resumed → state went
`checking → downloading → available` → apply → **B** is shown, and still B
after another reload.

### 4. Settings → Tentang

- **Periksa pembaruan**, with a status line: checking / downloading / ready /
  already newest / offline. It becomes **Pasang versi baru** when an update is
  ready.
- **Muat ulang bersih**, the phone's Ctrl+Shift+R. It unregisters the service
  worker, deletes the app's code caches and reloads from the server. Notes
  and the sync queue are **not** touched. It asks for confirmation first and
  saves open editors. Also shared with the stale-chunk recovery
  (`lib/cleanReload.ts`).

```
1662 tests passed
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-09-29.3`

**"Salin dari hari sebelumnya" no longer empties the HR in an EKG (or
echo) block.**

### HR removed from the EKG

**Root cause.** Vitals are cleared inside the **O block**, which ran from the
O heading to the next S/A/P/Terapi/Penunjang heading. A custom heading could
not end it, because blank template fields (`Nadi :  kali/menit`) parse as
custom sections too and have to stay inside O. So a
`*EKG PJT Lantai 4 (24-09-2026)*` block right after the vitals counted as O,
and `Sinus tachycardia, HR 166 bpm` lost its 166. The same happened to
`HR` / `TD` in an echo block, and the checker could read the EKG HR as the
pulse. On a note with no O heading, every section was scanned, EKG included.

**Fundamental fix** (`domain/vitals.ts`, shared by carry-forward and the
checker):
- An **investigation heading ends the O block**: EKG/ECG, echo/eko, lab,
  foto/rontgen, CT/MSCT/MRI/USG/LUS, angiografi, laporan, holter, treadmill,
  hemodinamik, penunjang, hasil (whole words).
- Investigation sections are **never** read or cleared, with or without an
  O heading.
- When an O heading exists, only O is read. A `TD` in the Plan is no longer
  touched.
- Bare `Thorax:` stays in O, because it is also the physical-exam heading.
  Only `Foto thorax` counts as an investigation.

Tests: EKG and echo blocks after the vitals, a bullet `- HR 90`, a note
without an O heading, and `Thorax:` inside O. All three investigation tests
failed on the old code.

```
1662 tests passed (+4)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-09-29.2`

**"Periksa lagi" no longer blames a plan that isn't there, and every
Tampilkan lands on the line it names. The AI check is rebuilt to add what
the rules can't see, quoting the note. Dokumen and Checklist redesigned;
checklist ticks stored safely.**

### 1. "Lab sudah ada hasilnya…" on a patient with no lab plan; Tampilkan jumped to "Planimetry"

**Root cause, two layers.**
1. The rule looked for lab words ("cek lab", "DL", …) on **every line of the
   note**, not only in the Plan. A lab word in S, O or A (a past result, a
   history line) was read as a plan that was still waiting.
2. The jump target was the **bare word `Plan`**, searched from the top of
   the note. The first match was inside `Planimetry` (an echo line in O).
   Several other findings used the same kind of loose anchor.

**Fundamental fix.**
- New `planLines(body, sections)`: the Plan is the P/Terapi section plus any
  custom sections that follow it, until the next S/O/A/Penunjang. The rule
  reads only those lines.
- The message now quotes the plan line itself: *Lab sudah ada hasilnya,
  tapi Plan masih menulis "…"*, so it can be judged without jumping.
- Every finding now carries an **exact position** (`anchorMatch`), taken from
  the text that triggered it: fluids, day marker, stale diagnosis value,
  consult (the TS line), electrolytes, anemia. No finding searches for a
  word again after the fact.
- Regression tests: the Planimetry note, and "every anchor matches its own
  text".

### 2. AI check ("Periksa dengan AI"), rebuilt

**What was wrong.** A free-text reply parsed from prose. It did not know
what the rules had already said, so it could repeat them, and its findings
had no position in the note to jump to.

**Now.**
- **Structured reply** (`askClaudeStructured`, forced tool
  `laporkan_temuan`, temperature 0): at most 6 findings, each with a level
  (Isi / Kemarin / Cek), a message and a **verbatim quote** from the note.
- **Grounded:** a finding whose quote is not in the note is dropped (and the
  count is shown). The quote is the jump target, so Tampilkan works.
- **Rule-aware:** the rule findings are sent as "do not repeat". The AI is
  pointed at what rules can't see: A↔P mismatch, abnormal values nobody
  addresses, contradictions, numbers that disagree, identity, future dates.
- **Stale marker:** after the note changes, results are marked out of date
  instead of silently pointing at old text. They clear on date/patient change.
- Still no clinical recommendations; still the H-2 "kemarin" meaning.

### 3. Checklist: ticks lost, "versi lama" banner for no reason; redesign

**Root cause.** Each tick **rewrote the whole `checklists` array** (every
list, built-in ones included) from the copy on screen.
- Two quick ticks, or two devices: the later write replaced the earlier
  (bug pattern #5).
- The first tick on a built-in list **saved a copy of it into the account**.
  From then on, any update to the built-in list showed as "outdated".

**Fundamental fix.** Ticks live apart from the lists: `checklistDone.<listId>`,
changed with one atomic `arrayUnion` / `arrayRemove` per tick
(`tickChecklistStep`). Built-in lists are never copied by ticking. Ticks
stored the old way (inside a saved list) are read and carried over on the
first new tick.

**Redesign.**
- Two panes on desktop; list → detail on phone (`?c=`, back works).
- Search over titles and steps.
- "Sedang berjalan" group first, with a progress bar per list.
- Detail: progress, **"Langkah berikutnya"** highlighted, Reset with an
  inline confirm.

### 4. Dokumen redesign

- Sticky header: search (title, category **and body**, with a highlighted
  snippet), "Dokumen baru" (floating button on phone), ⋯ menu for the rarer
  actions (add built-in formats, export, manage the selected category).
- Category chips with counts.
- Pinned documents in their own group; the rest grouped by category in a
  2-column grid with a two-line preview.
- `Highlight` moved to `components/common` (shared with Arsip).

### Not done
- AI check needs a network round-trip; nothing is cached across reloads.
- Checklist ticks are still per account, not per patient (by design).

```
1658 tests passed (+20)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

## `2026-09-29.1`

**Dropdowns readable in dark mode. "Salin dari hari sebelumnya" now empties
the TTV however it is written. "Periksa lagi" reads vitals the ward's way,
names what is left unfilled, and stays silent on a good note.**

### 1. Dropdown list unreadable in dark mode (Urutan, and every select)

**Root cause.** Chrome on Windows paints a `<select>`'s option list with the
select's own background colour. Every select here is `bg-transparent`, so it
sits flush in its control, and the list fell back to white while the options
inherited the dark theme's light text. `color-scheme: dark` was already
declared; it does not reach this.

**Fix.** One base rule: `select option, select optgroup` take `--surface`
and `--fg`. It covers all 11 selects in the app, whatever their own
background.

### 2. TTV sometimes not emptied by "Salin dari hari sebelumnya"

**Root cause, two layers.**
1. Vitals were cleared by **replacing each line with the seed template's
   blank line**, matched on the exact text before the line's **first
   colon**. It worked only for lines already shaped like that template.
   `Tensi`, `Nafas` (which the template's own comment says the ward
   writes), `TD`, `N`, `RR`, `Saturasi`, `*Tekanan Darah* :` and `TD 120/80`
   (no colon) were copied with yesterday's readings.
2. **One-line vitals** (`GCS E4V5M6; Tekanan Darah : 160/83 mmHg; Nadi : …`,
   the app's own *Follow-up ringkas* template) were never cleared at all:
   the first colon's label is `gcs e4v5m6; tekanan darah`.

The wiring was fine (`ttv` is in the default clear list). What varied was
the shape of the note, which is why it looked like "sometimes".

**Fundamental fix.** **The number is removed, not the line replaced.**
- New `domain/vitals.ts` is the **one vocabulary** for vital signs, used by
  both carry-forward and the checker. Before, each kept its own
  five-label list, which is the shared root of this bug and of the
  checker's false "Tidak ada TTV" (§3).
- Lines are read as segments (split at `;` and at a `,` that is not a
  decimal comma).
- A segment starting with any usual name of a vital has only its reading
  removed (`160/83`, `88`, `36,5`, `98`). The label, units and qualifiers
  stay as written.
- Single letters (`N`, `P`, `S`, `T`) count only inside the O block and only
  with a separator, so `S1 S2 tunggal`, the `*S:*` heading and `P 2 tablet`
  in a plan are never touched. TB/BB are not vitals.

**Wrong turn:** the first version split `S 36,5` at the decimal comma and
left `,5`. The compact-form test caught it.

### 3. "Periksa lagi" (the rule-based checker)

Audit of what it could and could not see:

| | Before | Now |
|---|---|---|
| Vitals | Only the five template names, so `TD 120/80, N 88` gave a **false "Tidak ada TTV"** | Shared vocabulary (§2): any usual name, the one-line form, bold labels |
| Blank vitals | Invisible (`Tekanan Darah :  mmHg` looked like "no TTV" or nothing) | **"TTV belum diisi: Tekanan darah, Nadi."** Exactly what carry-forward leaves |
| Empty S / A / P | — | **"S (keluhan) masih kosong."**; P judged with Terapi (the templates split the plan), empty only if both are |
| S copied | — | **"Keluhan (S) sama persis dengan kemarin."** (the one section expected to change daily) |
| Template holes | — | `hari perawatan ke  hari`, `TB :  cm` / `BB :  kg`, `()`, empty `- ` bullets (counted), `xx` / `??` |
| Hari perawatan | — | Compared with **yesterday's note**, not the admission date (a patient entered on their day 3 would be wrong every day): "masih ke-4, sama dengan kemarin" / "ke-7, kemarin ke-4" |
| Duplicate line | — | The same line (15+ chars) twice in one section: a therapy pasted twice |
| Lab planned but resulted | Fired on **any** lab + **any** "cek lab" line | A plan for the next result (`ulang`, `besok`, `serial`, `evaluasi`, `per 12 jam`, …) is left alone |
| Kept | Urine/balance copied, day counters, diagnosis value stale, TS not in DPJP, electrolyte corrected, anemia without Hb | unchanged |

**Every finding has an urgency, and the list is ordered by it**:
- **Isi**: something left unfilled.
- **Kemarin**: copied from yesterday and not updated.
- **Cek**: two parts of the note disagree.

The heading shows the count. "Tampilkan" jumps to the exact spot (new
`at` field), not the first matching text. `- ` and headings occur many
times, and a text search found the wrong one. It falls back to a search if
you have typed since the check ran.

**The first test is a complete, correct note: it must produce zero
findings, and does.** A checker that fires on a good note is one nobody
reads.

Still deterministic, still never edits.

### Not done

- **Tuning against your real notes.** The rules follow the templates' own
  shapes and the conventions already in the code. The earlier 59-note
  export was what settled format questions before; a fresh export
  (anonymised or not, it stays in the sandbox) would show which rules are
  noisy on real notes before you rely on them.
- Keystrokes typed while a note loads are still not kept (see 28.5).

```
1638 tests passed (+20)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-28.6`

**The pinned board header shrinks from ~260 px to 57 px on a laptop (one
row), and to two rows on a phone that hide while scrolling down.**

### Why

Pinning the header (28.5) made its size permanent. It stacked four rows
(search; scope chips; four order chips plus actions; the drag hint), about a
third of a 1080p screen, measured from Avi's screenshot.

### Change

| | Before | Now |
|---|---|---|
| Scope | Two 44 px pills on their own row | One segmented switch beside the search (`Saya 6 · Titipan 3`); hidden when there are no titipan, as before |
| Order | Four chips on their own row | One dropdown: `Urutan [Urutan sendiri ▾]`. Exactly one order is ever on, which is what a select is for |
| Actions | Filled 44 px boxes | Compact text buttons in the same row. The canvas's Rapikan / Urungkan / Penanda are sized to match (`CanvasBoard`, `CanvasStickers`) |
| Height | 44 px everywhere | `CONTROL`: **36 px with a mouse, 44 px on touch** (`[@media(pointer:fine)]:min-h-9`). The 44 px rule is about fingers |
| Drag hint | A permanent line in Urutan sendiri | Shown until "Mengerti" is pressed once (per device) |
| Phone | Everything stacked | Row 1: search + scope. Row 2: order + **Aksi** (a sheet with + Catatan tempel, Format lab, Pilih). While selecting, Aksi becomes **Batal** |
| Phone scrolling | Header always there | **Hides on scroll down, returns on any scroll up** (`useHideOnScroll`); never while searching or selecting, never within its own height of the top. Laptop header never hides |

Measured in Chromium (mocked data layer): laptop header **57 px** (97 px
with the one-time hint), phone **113 px**, hidden on scroll down, back on
scroll up.

### Wrong turn (caught before shipping)

`useHideOnScroll` first read `lastY` inside the `setHidden` updater. React
runs an updater when it gets to it, and by then the next line had already
set `lastY` to the new position. So it saw no movement and **never un-hid
the header**. The first hide only worked because React computed that one
update eagerly. The render check caught it; the previous position is now
captured before the update. `nextHidden` itself is pure and tested (4).

Also mine: the first draft put the phone's order dropdown on its own
full-width line, which made three rows instead of the two proposed.

### Not done

- Tablets (768–1023 px) use the phone layout, including hide-on-scroll.
- The FAB (+) on the phone is unchanged.

```
1618 tests passed (+4)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-28.5`

**Four changes: the board header stays put; typing on a just-opened note no
longer vanishes or jumps to the end; search can look inside archived notes;
the Arsip page is rebuilt around finding a patient.**

### 1. First keystrokes lost, then typing at the end of the note

**Root cause.** The editor is locked while the day's entry loads. That lock
is right: it is what stopped a blank editor wiping a note after a mobile
sign-in. But the locked editor looked ready. It was empty, with the
placeholder "Tulis SOAP hari ini…", and only a 70 % opacity to say
otherwise. For a patient not already cached on this device, loading waits
for the server, so the window lasts long enough to type into:

1. You tap in and type. The textarea is read-only, so nothing registers.
2. The entry arrives and React writes it into the focused textarea. **A
   browser puts the caret at the END whenever a textarea's value is set
   from outside**, so the next keystrokes land at the bottom of the note.

Step 2 had a second trigger with the same effect: another device's edit
adopted (or merged) while you are in the note.

**Fundamental fix.**
- **Every outside change now carries the caret through it** instead of
  dropping it at the end. `BodyEditor` sends all of its own edits through
  `emit`, which remembers the text it sent. Any other new `value` is an
  outside change, and the caret is mapped from the selection recorded just
  before it (`domain/caret.ts` `mapOffset`: before the change it keeps its
  offset, after it it moves with its text, inside it it goes to the end of
  the rewritten span).
- **Loading says "Memuat catatan…"**, not "Tulis SOAP hari ini…".
- The lock stays. Removing it would bring back the note-wipe bug.

Checked in Chromium with the real `BodyEditor`: typing while loading is
refused visibly, and when the note arrives the caret is at the start, not the
end. Then, typing mid-line while a remote edit inserts a line at the top, the
keystrokes land where they were being typed (`TD 120/80 N 88`) and the end of
the note is intact.

**Not done:** keystrokes typed during loading are still not kept. Putting
them anywhere would be a guess about where they belonged.

### 2. Board header pinned

Search, scope, order and the actions are `sticky top-0` in the page's
scroller, opaque, with a hairline under them; the cards scroll beneath. The
card area is its own stacking context (`isolate`), because canvas cards
raise themselves up to z-index 40 (bring-to-front) and would otherwise paint
over the header. Peek windows are outside it and still float above
everything.

### 3. Search inside archived notes

The board search already included archived patients, but only by name, RM,
bed, ward, diagnoses, card preview and DPJP, never by what the notes said. A
switch, **"Cari juga di isi catatan arsip (SOAP & catatan pasien)"**, on the
board (while searching) and on Arsip, adds:
- **every day's SOAP**, loaded on request (`useArchiveText`);
- **the Catatan pasien**, which is on the patient document and searchable
  immediately.

How the SOAP is loaded:
- it lives in a subcollection, so it's read once per patient version, keyed
  by `id|updatedAt` (a discharge summary written after archiving moves
  `updatedAt`);
- four patients at a time, with a progress count;
- then served from the device's cache, offline too.

Remembered per device. A match that came from the notes shows a **snippet**
of where, cut on whole words, with the words marked.

`matchesQuery`'s field list became `patientHaystack` and is shared, so
both pages match the same fields (`domain/archiveSearch.ts`).

### 4. Arsip rebuilt

| Before | Now |
|---|---|
| Search box over one long run of bordered boxes, 3 grey lines each | Pinned header: search, the notes switch, trash |
| No way to narrow except typing | **DPJP · Ruang · Alasan · Bulan** filters, each offering only values that occur, with counts; ward spellings merged (`canonicalWard`); Reset |
| Month sections only | "12 dari 142 pasien", then months, rows in one grouped card per month |
| Reason as grey text on every row | Reason tag only when it isn't "Pulang": **MENINGGAL** in red, PINDAH outlined |
| — | Search words highlighted in name, RM and snippet; a no-results state offers to search inside notes |

The search field gained an accessible label (it had only a placeholder).
Trash is unchanged in behaviour.

### Wrong turns

- The highlight first used `text-inherit`, which isn't a Tailwind class.
  The highlight colour uses `bg-[var(--warn-soft)]`, not an opacity
  modifier (see 28.3).
- My first snippet test expected the wrong words for its radius; the
  function was right.

### Not done

- Active patients' note text is not searched; this was asked for the
  archive only.
- The board header is pinned on every order, including the canvas. At
  phone height it takes about three rows.
- The board-header and Arsip changes were rendered with a mocked data
  layer; the board itself was not rendered (it needs live Firestore). Worth
  checking on a device: scroll a long board; open Arsip, switch the notes
  search on, and watch the count finish.

```
1614 tests passed (+16)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-28.4`

**Lab PDFs: results that were dropped or misread are now read correctly, and
page furniture no longer reaches "Lain-lain". Radiology, echo and procedure
PDFs are identified instead of being read as labs.**

Corpus: 42 SIMGOS PDFs from Avi (36 lab, 6 other), run through the same
extraction as the app (pdf.js, rows rebuilt from glyph positions) and the
real `parseLab`. Kept in the sandbox only. Every fixture in the tests is
invented, with the same layout.

### Root cause

Three structural faults, not a list of missing names.

**1. Value patterns were not all anchored.** An earlier release anchored the
NUMERIC result to the start of the value region, because an unanchored
search had read reference ranges as results. The word, graded and
blood-group patterns were never anchored, and made the same mistake:

| Printed | Output was | Reports |
|---|---|---|
| `GOLONGAN DARAH/ GOL.DARAH (ABO) + RHESUS`, then `Golongan darah B Rh+` | **`Golongan darah A`** (the "A" of "(ABO)" on the test-name row; first occurrence won) | 1 |
| `Vit, C - Negatif` (result `-` = not done) | `Vit C Negatif` (the reference) | 2 |
| `Warna Kuning Kuning Muda` | `Warna Kuning Kuning` | 2 |

The existing blood-group test asserted only that the words "Golongan darah"
appeared, which is how a wrong group passed.

**2. The name ended where the ALIAS ended, not where the value began.** The
value region was the raw line sliced at the normalised alias's length.
- A longer printed name left a word in front of the value, and anchored
  reading found nothing: `Hs Troponin I < 0.010` (3 reports), `Laktat
  Darah 1.2` (2).
- Punctuation shifted the slice: `Sedimen Lain - lain BAC=2` became
  `in BAC=2` (3). The comment on `matchAnalyte` described this and fixed
  only the exact-match case.
- **And a recognised analyte with no readable value was discarded
  silently**, in neither the output nor "Lain-lain", against Rule 2.

**3. The whole page was read, not the results table.** Anything shaped
"words then a number" reached "Lain-lain":
- `MAKASSAR, 15` (the signature date) on **all 36** lab reports;
- wrapped diagnosis lines: `Hypokalemia ( 2.9`, `Post PCI 1`,
  `Normoventricular Response (CHA 2`;
- per-specimen range notes: `(Darah Arteri : 0.6 - 1.5)`;
- the patient header repeated on page 2.

Plus coverage: lipids and uric acid had no aliases (2 reports), and the 6
non-lab PDFs were read as labs (`Radiografi Thorax 1`, `MR. 24`).

### Fix

| # | Change |
|---|---|
| 1 | **Every value pattern is anchored** to the start of the value region (`GRADED`, `QUALITATIVE`, `BLOOD_GROUP`, like the numeric one). Blood group must be a whole token (`AB|A|B|O` not followed by a letter). `Kuning` takes only `muda`/`tua` after it. |
| 2a | **The name is mapped, not measured**: the alias's words are found in the raw line in order, across any punctuation (`matchAnalyte`). |
| 2b | **The name extends over harmless qualifiers** until the value starts: `darah serum plasma arteri vena I T`, assay methods bare or in parentheses (`CMIA`, `( CMIA )`, `ECLIA`…). An **allowlist**: `Kalium Urin 20` is not serum K and chemistry `Bilirubin Total 0.5` is not the urinalysis bilirubin; skipping those words would put a real number under the wrong name (Rule 1). They go to "Lain-lain" under their full name. |
| 2c | **No silent drop.** A recognised row whose value can't be read falls through to "Lain-lain": with its number, or verbatim if its result is a word. A `-` result (not done) is skipped deliberately, in both paths (`Titer - <1 : 100` no longer reports the reference). |
| 3 | **Per-report table scoping**: `free → header → table → footer → free`. A report start (`HASIL PEMERIKSAAN LABORATORIUM`) begins the patient header, the table header row begins reading, and `Kesan / Saran` or `Halaman n dari m` ends it. The header row is recognised in both layouts (one row; one cell per line). **Fails open:** a report whose table header isn't found is read whole, as before. Parenthesised annotation lines and `CITY, dd-mm-yyyy` signatures are skipped anywhere. |
| 3b | **Several sources in one box.** Scoping is per report, and the sheet now separates appended PDFs/OCR with a blank line (PDF text never has one), so pasted text before or after a report is still read. |
| 4 | Aliases: `Kol Total`, `LDL`, `HDL`, `TG`, `Asam Urat`. Output `Kol total/LDL/HDL/TG 194/195/15/99` (after Ca/Mg) and `Asam urat 10.6` (after Ur/Cr). |
| 5 | `labReportKind(text)`: `lab` / `other` / `unknown`. The sheet refuses a radiology/echo/procedure PDF with a message instead of reading it. |

### Result on the corpus

| | Before | After |
|---|---|---|
| Lab reports with junk in "Lain-lain" | 36 / 36 | **0 / 36** |
| Wrong values (blood group, Vit C, Warna) | 5 rows in 3 reports | 0 |
| Recognised rows dropped silently | 8 rows in 8 reports | 0 |
| Table rows whose value is missing from the output | — | only `LED -` (not done, correct) and one ANA "Hasil" row (see Not done) |

### Wrong turns (caught before shipping)

- **Scoping to the table first made the old one-cell-per-line layout read
  nothing at all.** Its header row is split across four lines, so the header
  was never found and the parser stayed in "skip patient header" to the end.
  The existing tests caught it (6 failures). Now both layouts are recognised,
  and scoping fails open.
- A first global "table only" rule would have ignored pasted text next to a
  PDF. Made per-report, with blank-line separation.

### Not done

- **ANA IF**: the result row is labelled `Hasil` under an `ANA IF` heading
  line. It isn't read (and isn't misread). Rare; say if you want it.
- **Culture reports** (`Kultur & Sensitivitas Tidak ada pertumbuhan`) are
  labs with no numeric table, so nothing is extracted. The Kesan is the
  result there.
- Troponin I and T both print as `Troponin`. The I/T distinction is in the
  PDF, not the output.
- Sex-split ranges (`L(1.3); P(<1.1)`, `L(>55); P(>65)`) aren't parsed, so
  those values are never bolded. Unchanged; the no-hardcoded-ranges rule
  stands.

```
1598 tests passed (+14)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-28.3`

**Patient card: DPJP, KJS and RM now look different from one another.**

### Root cause

Two causes, and the second is the one worth remembering.

1. **One shape for three meanings.** DPJP, KJS and RM were all a
   `rounded border px-1 text-[10px] font-semibold` box in the card's ink.
   Mine for RM, from `2026-09-28.2`: I copied the DPJP badge's style.
2. **The differences that were meant to exist never rendered.** KJS·Kardio
   was supposed to be told apart by a `bg-current/15` tint, and the new DPJP
   pill got `bg-token-fg/15`. **Tailwind 3 emits no CSS for an opacity
   modifier on `currentColor` or on a colour defined as a bare `var(--…)`.**
   The class looks right in review and does nothing. Measured in Chromium:
   the DPJP background was `rgba(0,0,0,0)`, and `border-current/60` fell back
   to Tailwind's default grey border (nearly invisible on a light card).

### Fix: form, not hue

The card colour already means checklist progress, and a second hue on the
same surface is the collision recorded on the discharge wash. So every mark
stays in the card's own ink, which passes contrast on every card colour by
construction. They differ by shape:

| Mark | Look | Reads as |
|---|---|---|
| **DPJP** | rounded-full pill, soft fill (`bg-black/10`, `dark:bg-white/15`), no border | a person |
| **KJS · KARDIO** | square tag, **solid inverted** (`bg-token-fg text-token`), uppercase | the rarer case that changes handling: not our patient |
| **KJS · TS** | square tag, full-ink outline, uppercase | joint care, our patient |
| **RM** | no box: mono digits, a copy icon (`IconCopy`, new), dotted underline | a control, tap to copy |

Every tint uses colours that do take an opacity modifier (`black`, `white`)
or none at all.

### Tested

Rendered in Chromium, light and dark, with a DPJP and both KJS kinds:
- computed styles confirmed the fills are present;
- RM copy still works and still does not open the patient;
- no console errors.

### Not done: the same silent failure exists elsewhere (predates this)

Opacity modifiers on variable colours, 11 uses in 6 files. They render at
full strength or not at all, not at the intended softness:

- `PatientCard.tsx`:
  - `text-token-fg/50` ×4;
  - `text-token-fg/60`, `ring-current/40`, `border-token-fg/10` (the
    identity band's hairline);
- `CanvasBoard.tsx`: `text-token-fg/60`;
- `ProgressStrip.tsx`: `bg-token-accent/25`;
- `PatientPage.tsx` and `HelperPage.tsx`: `border-current/40`.

The fundamental fix is either:
- defining the token colours in the Tailwind config with `<alpha-value>`,
  which needs the tokens as RGB channels; or
- a guard test like `clampClasses.test.ts` that fails the build on
  `-(current|token…)/NN`.

Offered, not done.

```
1584 tests passed
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-28.2`

**Patient card: the bed number no longer sits beside the name. The RM number
is on the card, and tapping it copies it.**

### Why

- **Bed beside the name.** It was duplicated: the location line directly
  underneath already ends in the bed (`… Kamar 417 Bed 4`). Two copies of the
  same number, one line apart, on the line you scan to find a patient.
- **RM.** It was reachable only by opening the patient or the peek window,
  and each of those has its own "Salin RM" button. On the board the number
  itself is now the control, so the board gains no button.

### Change

| Where | Before | Now |
|---|---|---|
| Full card, name | `Ny. X · 4` | `Ny. X` |
| Full card, location row | location · DPJP · KJS | location · **`RM 123456`** · DPJP · KJS |
| Folded card | `Ny. X · 4 · DPJP` | unchanged: it has no location line, so the bed is its only "where" |
| Archive rows | `Ny. X · 4` | unchanged, for the same reason |

- `cardTitle(patient, initialsOnly, withBed = true)`; the full card passes
  `false`. `BoardCard` gains `name` (without the bed), `mrn` and `mrnHidden`.
- **The chip:**
  - A tap copies the digits only (no `RM ` prefix), the same as the patient
    page, because the paste goes into a search box.
  - It shows "Tersalin ✓" for 1.2 s.
  - The tap prevents the card's link and stops `pointerdown` and
    `contextmenu`, so it neither opens the patient nor starts long-press
    selection.
  - The hit area is 44 px, pulled into the text row with negative margins,
    so the row stays one line tall.
- **Initials-only mode:** the chip reads "Salin RM" and still copies, but the
  digits are not printed. An RM identifies a patient as surely as a name, so
  hiding the name while showing the RM would not be the privacy the mode
  promises (SPEC 18).

### Tested

- `board.test.ts` +4: `withBed`, `name` vs `title`, RM trimmed or null,
  `mrnHidden`.
- Rendered in Chromium, dark theme: normal mode and initials-only mode.
  Tapping the chip put `123456` on the clipboard, and the page stayed on
  the board. No console errors.

### Not done

- The chip is not on the peek window or the preview sheet, which already
  have their own "Salin RM".

```
1584 tests passed (+4)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-28.1`

**Catatan rebuilt. The list and the note sit side by side on a laptop, and a
note opens full screen on a phone, where back closes it. You can search, pin
notes, and reorder them by touch. Checklists continue on Enter. Deleting goes
to Sampah. Underneath, each note is now stored and saved separately, which
removes a race that could revert text you had just typed.**

### Root cause

"Clunky" had three layers. Only the first was visible.

1. **Layout.** The board and the editor were two separate screens, so every
   switch was "← Semua" and then another card. The editor stacked three bars
   above the text (shelf tabs; back/title/Arsipkan/Hapus; a wrapping
   toolbar), which on a phone took about a third of the screen. There was no
   search. Drag used the HTML drag API, which touch screens never fire, so a
   phone could not reorder. New notes were called "Catatan 7".
2. **Checklists.** A row was `<li><input type=checkbox>`. An `<input>` inside
   a contenteditable is foreign to the browser's editing engine, which caused
   three problems:
   - Enter split the row and left the box behind, so the only way to build a
     list was one toolbar press per row.
   - The caret could land beside the box instead of in the text.
   - Ticks needed native listeners (pattern 4).
3. **Storage.** All notes were **one array** on the profile (pattern 5).
   - Every keystroke rewrote every note.
   - `pendingBodies` patched the body-save path, but rename, add and delete
     built their arrays from the last render **without** it. Renaming a note,
     or adding or deleting one, within about a second of typing could write
     back the old body.
   - "Hapus" was a hard delete, unconfirmed, next to "Arsipkan". That broke
     the soft-delete rule.

### Fix

| Layer | Change |
|---|---|
| **Storage** | `notesById.<id>.<field>`, one `FieldPath` leaf per change, the same as `boardNotes` (`scratchNotes.repo.ts`). A rename, a body save and a reorder touch different fields, so none can overwrite another. `pendingBodies` and `updateScratchNotes` are **deleted**. |
| **Migration** | Zero writes. The old `notes` array (and `scratchNote`) is read for any id the map lacks. A legacy note is copied into the map whole on its first change, and after that only leaf writes happen (`materialised`, so a rename right after a body save can't copy it a second time). The array is never written again. |
| **Order** | `order` is a number. A move writes only the moved note, at the midpoint of its new neighbours. New notes go to the top. `pinned` puts a note above the rest. |
| **Delete** | Soft: `deletedAt` moves the note to Sampah. From there, "Hapus permanen…" (confirmed) writes a tombstone `{purgedAt}`, not `deleteField`. Removing the map entry would let the note's legacy copy reappear. |
| **Layout** | ≥1024 px: list pane and editor side by side, so switching is one click. Phone: the list, then the note full screen; `?n=<id>` is in the URL, so the Android back gesture closes the note instead of leaving Catatan. |
| **Editor chrome** | Two rows. The header (back · title · pin · ⋯) scrolls away. The toolbar stays and scrolls sideways instead of wrapping. Arsipkan, Pindahkan rak, Salin sebagai teks and Sampah moved into ⋯. |
| **Titles** | An empty title shows the first line of the note, in the row and as the placeholder. Enter in the title field moves into the note. |
| **Finding** | Search covers both shelves and the archive (never Sampah); every word must match, in any order. Each row shows colour, title, two lines, ☑ progress (e.g. 2/4) and the last edit time. |
| **Reorder** | A grip on each row, on pointer events with `touch-action: none`: finger, mouse or pen. The drop line shows before the drop. Arrow keys on a focused grip move the note one step. |
| **Checklists** | A row is `li[data-checked]` and the box is drawn with CSS (`.note-editor` in `index.css`). `checklistDom.ts` handles the rest: Enter continues the list; Enter on an empty row ends it; Backspace at the start of a row turns it into a plain line; the ☐ button toggles the current line (and turns a bullet list into a checklist); Ctrl/Cmd+Enter ticks. Ticking fires on pointerdown in the box, so a tap on a phone does not raise the keyboard. Ticked rows are struck through. Old `<input>` rows are converted when opened, keeping their ticks, and saved on the next edit. |
| **Paste** | Plain text only. A rich paste brought fonts, tables and stray `<li>` / `<input>` elements into rows. |

Kartu/Daftar is replaced by one list. Its rows carry what the cards did
(colour, title, first lines) plus progress and edit time, in less height.

### Tested

- `scratchNotes.test.ts` (29): migration, malformed entries, tombstones,
  views, search, titles, progress, ordering.
- `checklistDom.test.ts` (19): run on a **real DOM** (jsdom, added as a dev
  dependency). This is the first time Catatan editing is under test; it
  broke twice before with no test to catch it.
- Driven in Chromium through a throwaway harness (real page, in-memory
  profile) at 1280 px and at 390 px with touch:
  - an old checklist converted with its ticks kept;
  - tick → saved; Enter → new row; Enter twice → out of the list;
  - ☐ on a plain line; search; grip drag; new note focused with its first
    line as title;
  - Sampah → purge with no resurfacing;
  - phone open → `?n=`, back → list;
  - dark theme;
  - zero console errors.

### Wrong turns (caught before shipping)

- **Purge by `deleteField`** would have brought a legacy note straight back
  from the old array. It is now a tombstone.
- **Whole-note copy on every legacy write.** Two quick writes (body, then
  title) each carried a full copy, and the second would have reverted the
  first. That is the exact race this release removes, reintroduced in the
  migration path. A note is now copied once, then written leaf by leaf.
- The row colour used the pastel `-bg` token, which is invisible at 4 px. It
  now uses `-accent`.

### Not done

- **Update every device.** A device still on the old version keeps
  writing the old array. Its edits to a note that has already moved to the
  map won't show on updated devices. Reload each device once (update banner).
- **Undo (Ctrl+Z) does not cover** checklist Enter/Backspace/ticks. They
  change the DOM directly, outside the browser's undo stack. Typing and
  toolbar formatting still undo as before.
- Ticked rows stay where they are; there's no "move ticked to the bottom".
- Reordering works within a group (Disematkan / Lainnya), not across it. Pin
  or unpin to change group.
- `updateProfileNote` (the pre-tabs single-note writer) was already unused
  and has been left alone.

```
1580 tests passed (+32: +48 new, −16 removed with NoteCards/pendingBodies)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-27.4`

**A resident picked for a tukar jaga whose name fits two Jarkom rows can now be
resolved right there. A swap updates when its person is corrected.**

### Root cause

Mine, from `2026-09-27.3`. The "which Jarkom row?" question was attached to the
ROSTERED person on each post (`post.initials`), and hidden on swapped posts.
Yusuf's case was a swap: he was picked into CVCU. So:

- **The tukar jaga picker had no answer to give.** His legend name
  (`Ahmad Rizki Yusuf`) is now correctly treated as undecidable, so it
  offered him with no nickname: "Ahmad Rizki Yusuf YS".
- **The row that would ask the question was not shown** on a swapped post.
- **A swap stored the nickname and agama as they were at pick time.** Even a
  correct link made afterwards would not have reached a night he had already
  been swapped onto.

The fix in 27.3 answered the question for the posts it looked at, not for the
person, who can appear either way.

### Fix

1. **The picker asks.** A resident whose legend name fits several rows is
   listed once per row: nickname, the Jarkom full name, and "Jadwal: <legend
   name> — pilih yang benar". Picking one links the initials to that row
   (for every shift and device) and swaps them in with the right nickname and
   agama.
2. **Swapped posts get the same question** as rostered ones, about the person
   swapped IN (`personInitials`), not the one printed in the roster.
3. **Swaps are re-read against the directory** (`refreshSwap`). A swap picked
   from the list (it has initials) takes the directory's current nickname and
   agama. A swap typed as free text is left exactly as typed. Correcting a
   person once corrects every night they were swapped onto.

`Resident` now carries `linked` and `ambiguous`.

### Wrong turn

Ran `prettier --write` on `HelperPage.tsx` mid-edit. It reformatted about 500
unrelated lines. Reverted and the edit reapplied, so the diff holds only this
change.

### Not done

- **The link still takes one tap.** Type "Yusuf" (or "Ahmad") in the CVCU
  field and pick **Yusuf — dr. Ahmad Rifqi Yusuf**. After that he is fixed
  everywhere.

```
1548 tests passed (+3)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-27.3`

**Konfirmasi Jaga: a roster name that fits two Jarkom rows is no longer
settled by row order. You pick the row, and the pick brings the right
nickname and agama. The tukar jaga label is now a clearly visible header.**

### Root cause

The roster legend spells one resident `dr. Ahmad Rizki Yusuf`; the Jarkom
sheet has `dr. Ahmad Rifqi Yusuf` (nickname Yusuf). "Rizki" and "Rifqi" are
two letters apart, past the one-typo tolerance, so the legend name shared
exactly two words with each of two rows:

| Jarkom row | Words shared | Score |
|---|---|---|
| dr. Ahmad Rizki Imran (Rizki) | ahmad, rizki | 2/3 |
| dr. Ahmad Rifqi Yusuf (Yusuf) | ahmad, yusuf | 2/3 |

`matchJarkom` kept the first best score it met (`score > best.score`), so
**row order decided who this person was**. Rizki Imran is row 36 and Rifqi
Yusuf row 50. The wrong nickname was printed and nothing on screen said a
choice had been made. The name override by initials could not repair it
either: it changes the displayed nickname only, not the agama or the full
name.

**Two people who fit equally is a question, not a match.**

### Fix

1. **Ties are reported, not broken by order.** `resolveJarkom` ranks by the
   share of words in common, then by how rare those words are across the
   sheet. `ahmad` appears on 4 rows and says little; `yusuf` is on one. When
   both measures tie, it returns no match plus the tied rows. Here it
   genuinely ties (rizki and yusuf are each unique), so it asks rather than
   guesses.
2. **The question is asked where the name is shown.** The row shows a
   warning box: "“dr. Ahmad Rizki Yusuf” cocok dengan 2 orang di Jarkom. Yang
   mana …?", with one button per candidate, name and nickname.
3. **The answer is a link, not a label.** `setJarkomLink(initials, row)` is
   stored as a new synced state field (`links`). A linked person takes the
   row's **full name, nickname and agama**, so the greeting is corrected with
   the name. It applies in the Formasi, the confirmation messages, and the
   tukar jaga picker.
   - The link stores the row's name, so a re-imported sheet in another order
     still finds it.
   - A link to a row a newer sheet no longer has is ignored, and matching
     takes over.
4. **"Salah orang?"** under every matched name opens a picker over the whole
   sheet, for a match that is confidently wrong rather than ambiguous.
   "Kembalikan ke pencocokan otomatis" removes a link.

**No rules change needed:** `links` is one more map in the existing
`users/{uid}/jaga/state` document.

### Tukar jaga label

**Before:** a 10 px grey chip in the top corner of the message box, sitting on
the text.

**Now:**

- a header strip in the warning colour: **⇄ Tukar jaga · menggantikan
  <rostered name>**;
- the message box border in the same colour, so a swapped message stands out
  when scanning down the list;
- the small grey full-name line is hidden on swaps, because it showed the
  rostered person under the swapped-in name.

### Not done

- **Not applied to your data yet.** The fix for this resident happens when
  you tap "dr. Ahmad Rifqi Yusuf (Yusuf)" once on a shift they are on. After
  that it syncs to your other devices.
- **Tests use invented names** with the same shape as this case, not the
  real ones. Colleague names stay out of the public repo.

```
1545 tests passed (+6)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-27.2`

**Pengampu defaults now carry full names and titles, exactly as in Avi's sent
PAKAR confirmations.**

### Root cause

Mine. The previous release seeded the weekly pengampu from a condensed
restatement of Avi's request, carried over when the session was compacted,
instead of from the messages he had pasted. That restatement had cut each name
down to a surname, e.g. "Alkatiri" for "Dr. dr. Abdul Hakim Alkatiri, Sp.JP(K)",
and the seed repeated it.

**Reference data typed from memory is a copy of a copy.** The fix is in two
parts:

1. The defaults are now copied verbatim from the sent confirmations, and the
   tests check the parser's output from those same messages against them.
2. Pengaturan MR gains **"Ambil jadwal dari pesan PAKAR yang pernah
   dikirim"**. Paste one or several sent confirmations, and each weekday block
   found replaces that weekday's list. The schedule then comes from the
   messages themselves and never has to be retyped when a pengampu changes.

The line parser finds the status by its words ("menunggu", "konfirmasi",
"berhalangan", "hadir"), not by the last parentheses. It has to, because the
samples contain:

- titles with brackets of their own (`Sp.JP(K)`, `Sp.JP (K)`);
- a status glued on with no space (`Sp.JP(K)(menunggu …)`);
- a status missing its opening bracket (`Sp.JP(K)  konfirmasi … WITA)`);
- WhatsApp's invisible U+2060 around `•` bullets.

### Already-saved data

- **A weekday list or status list identical to the old seed** counts as
  "never edited" and picks up the corrected defaults. Anything else stored is
  treated as a hand edit and kept.
- **A date saved in that window** has its surname-only names shown in full,
  with statuses unchanged. Only exact matches are converted.

The status presets now follow the samples: `Konfirmasi kehadiran pukul 07:00
WITA`, `… 07:30 WITA`, `Konfirmasi berhalangan hadir`.

### Not done

- Pasting a sent confirmation sets the weekly schedule only. It does not set
  statuses for a date: a status belongs to the day it was sent for.

```
1539 tests passed (+4)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-27.1`

**Helper is split into tabs, and has a new one: Morning Report.**

### Helper tabs

Konfirmasi Jaga, Verifikasi Sensus and Morning Report are now one tab each
instead of one long page. The tab is in the URL (`/helper?tab=mr`), so reload
and the back button return to it. Only the open tab is mounted, so the jaga
sync listener still runs only while Konfirmasi Jaga is open, as before. The
Work-in-progress badge moved to the Helper title and covers all three.

### Morning Report confirmator (new, WIP)

One working state per MR date, three messages from it:

| Message | Built from |
|---|---|
| Request to the senior | your name + MR date + the chosen jaga |
| Laporan Grup Prodi | every covered jaga's pasted list, pengampu with status, Zoom block |
| Konfirmasi Grup PAKAR | pengampu with status |

- **Covered jaga:** Monday's MR covers Jumat, Sabtu Pagi/Malam, Minggu
  Pagi/Malam. Any other day covers the day before. "Jaga mulai dari" moves the
  start earlier by hand (holidays). No holiday calendar is guessed.
- **Patient lists are pasted as the senior sent them.** The parser accepts bold
  or plain, `-` or `•`, "Diagnosis:"/"Diagnosa", and renumbers per jaga.
  Numbered diagnoses stay diagnoses unless the line reads like a patient
  (Tn./Ny./RM/several ` / `). A line before the first patient is kept and
  flagged, never dropped. An empty jaga prints `(Tidak ada pasien)`.
- **Pengampu:** the weekday's scheduled list (Avi's five lists as the default),
  each starting "menunggu konfirmasi kehadiran". The status is picked from the
  account's presets or typed freely. Editing a date's list makes it that date's
  own; "Kembalikan ke jadwal" goes back to the weekday's.
- **Settings (Pengaturan MR):** your name, the Zoom block, the status presets,
  and the weekly pengampu per weekday.

**The Zoom meeting ID, passcode and host key are NOT in the repo.** The repo is
public. They are pasted once into Pengaturan MR and stored on your profile,
which only you can read.

**Storage and sync.** Settings are on the profile (`morningReport`); drafts are
under `mrDays.<date>` and pruned after 21 days. The profile was chosen because
it is already subscribed on every device and its rules already allow the owner
to write any field: **no rules deploy is needed.** Every write names one leaf
(one jaga's list, one date's pengampu), so the phone and the PC editing
different parts cannot overwrite each other.

Typing is kept local and written after a pause (`useSyncedDraft`). A value from
another device is adopted only when it actually changed and nothing typed here
is waiting to be sent. That way the echo of your own write cannot roll the field
back mid-sentence. The decision is a pure function with four tests.

### Wrong turn

The first render gave every pengampu four status chips plus a text field, about
250 px per person. That was replaced by one select with a "Ketik sendiri…"
option before shipping.

### Not done

- **Same-date pengampu edits on two devices at once:** the date's list is one
  array, so the last write wins for that list. Patient lists are per jaga and
  do not have this problem.
- **Titles:** the default pengampu were seeded as surnames only. That was
  wrong; see `2026-09-27.2`.
- **Formatting guesses, to confirm against a real send:**
  - the divider (30 `-`);
  - the blank line between patients;
  - a divider before "Pimpinan Morning Report terjadwal".
- **Rendered in isolation only** (phone and desktop width, with a mocked
  profile), not signed in against Firestore.

```
1535 tests passed (+20)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-24.2`

**A card resized while its note was open no longer springs back.**

### Root cause

Mine, from the previous release. A card whose note is open is shown at full
height so the note can be read, and dragging the height grip there was made an
explicit override — but the record of that override was held in React state,
in the canvas component.

So the height was written to storage correctly and then ignored on the next
mount: switching tabs unmounts the canvas, the in-memory set came back empty,
the card was uncapped again, and it sprang back to full height. The height was
never lost; it was overruled every time the board was rebuilt.

**A decision the user made by hand is not session state.** The override now
lives in the layout, beside the height it applies to (`hMaxWithNote`), and is
stored with it.

- Dropped on read when there is no cap, so a stray flag cannot claim a height
  nobody set.
- Ignored unless exactly `true`, like every other field read from storage.
- Cleared by the double-click that removes the cap, which is the one act that
  says "no height".
- Layouts written before the flag existed are untouched.

Five tests, including the report itself: set a height with the note open, read
it back, and it is still there. With the flag dropped from storage — the old
behaviour — that one fails.

### Not done

- **Positions and sizes are still per device**, as they have always been.
- **Not rendered here.** Worth checking: resize a card with its note open,
  switch to another tab and back, and confirm it keeps the height you gave it.

```
1515 tests passed (+5)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-24.1`

**Catatan checklist ticks save again, the height grip is back on cards with an
open note, stickers stick to cards, and consult replies are read properly.**

### 1. Catatan checklist ticks were not saved

**Root cause.** The native listener that saves a tick was bound in
`useEffect(…, [])`, which runs once, when the PAGE mounts. Since the Catatan
board, the editor only exists after a card is opened, so at mount the editor
ref was null, the effect returned early, and the listener was never attached.
Ticks changed on screen and were never written.

This is the blank-note bug of `2026-09-22.1` again, in the same component: a
DOM effect tied to the page's lifetime instead of the node's. That fix moved
the text write into a callback ref and left this listener, a few lines above
it, behind. The listener now lives in the same callback ref, attached when the
editor attaches and removed when it detaches. The rest of the file was audited
for the same shape: the one other `[]` effect listens on `document` and reads
the node only when an event fires, which is safe.

### 2. The height grip "sometimes" missing

My doing, in `2026-09-21.2`: the grip was hidden whenever a card's note was
open, on the reasoning that a cap would not apply until the note closed. That
hid it on exactly the cards being worked on.

The canvas now distinguishes WHY a card is uncapped:

- **folded** — no height grip (one line has no height to cap; the grip there was
  the dark bar under folded cards);
- **note open** — the grip is shown. Dragging it is an explicit choice of
  height, so from then on the card honours it even with the note open,
  starting from the height it is showing — not the cap stored before the note
  opened, which would make the card jump the instant the drag began.

The zero-warnings lint rule caught the new state missing from the gesture's
dependencies; a stale copy would have let a second drag re-take a card already
taken over.

### 3. Stickers stick to cards

Drop a sticker ON a card and it is stuck there: drawn inside the card's own
box, at an offset from its corner, so it moves with the card — including while
the card is being dragged — with no position kept in step by hand. Drop it on
empty canvas and it is free, as before.

- **A card that leaves the board takes its stickers with it** (filtered out,
  discharged, the other scope). Drawing them where the card used to be would
  be a mark on whichever patient is there now — the bug this whole area has
  been about.
- Sticker state moved to one owner (`useBoardStickers`) read by two places:
  the canvas draws free stickers, each card draws its own. One list, not two
  copies that could disagree.
- Drags run on window listeners instead of pointer capture: a sticker pulled
  off a card is re-drawn on the canvas mid-gesture, a different element, and
  capture on the old one would have ended with it.
- The card under the pointer is found with `elementsFromPoint` on the drop,
  which sees through the sticker to the topmost card beneath it.
- A stored attachment that cannot be read falls back to FREE at its last
  position rather than dropping the sticker.

### 4. Consult replies

**What was wrong, measured on the two notes you sent.** The parser recognised
S and O, and each TS block as its own section. The cardiology conclusion —
"Saat ini evaluasi Kardiologi … pasien kami assess dengan …" — was not
recognised at all. It is one bolded sentence of ~200 characters, and a fully
bolded line counts as a heading only up to 72 characters (a deliberate guard:
a bolded sentence is not a label). So it was swallowed into the last
investigation above it: no A in the jump bar, and the card preview, finding no
assessment, fell back to S, O and every investigation.

**The fix.**

- The conclusion is recognised by its **opening formula**, not by relaxing the
  length rule, which would start turning any bolded sentence into a section.
  It becomes section A, as a heading that owns its line, so tinting, copy and
  carry-forward treat it like any other; `carriesContent` tells the one reader
  that needs the words — the preview — that the line IS the content.
- **Card preview**: the question, then the answer —
  `Konsul: kelayakan bronkoskopi dengan general anestesi` /
  `Low Risk (Lee RCRI) 0.9% … MACE …`. The method statement that opens every
  conclusion ("berdasarkan anamnesis, pemeriksaan fisik, EKG …") is skipped;
  the finding after "pasien kami assess dengan" or "pasien termasuk (kategori)"
  is kept. With neither phrase, the whole sentence is shown rather than a
  guess.
- **Jump bar**: `Identitas · S · O · A · TS Bedah Dige… · TS EMD` — each TS block
  in note order. Their `A/`, `P/`, `I/` stay inside the block and are never read
  as this note's own A or P, as `classifyProseHeader` has always required.

**Checked against the whole export**: 237 notes, none loses a character, and the
new rule touches exactly one — the one existing consult reply.

The two notes are kept as test fixtures with the patients' names, dates of
birth and RM numbers replaced; every heading and marker line is untouched.

### Not done, and why

- **Built on two samples and one old note.** Rules this narrow will miss a
  variation — a conclusion opening "Evaluasi kardiologi saat ini …", or a TS
  block written `*TS: Pulmo*`. Each such case falls back to today's behaviour
  rather than misreading, but it will not be recognised until seen.
- **The Catatan and grip fixes have no automated test.** Both live in
  components, and this suite renders none. The Catatan fix is the same pattern
  as the blank-note fix, now applied to both effects in that file.
- **Not rendered here.** Worth checking: tick a checkbox in a Catatan note and
  reload; drag a sticker onto a card and move the card; open a consult reply's
  card on the board.

```
1510 tests passed (+17)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-23.3`

**Stickers no longer bleed between Pasien saya and Titipan.**

### Root cause

The board has two scopes over one canvas — Pasien saya and Titipan — showing
different cards at the same (x, y) positions. Stickers were stored once,
globally, so a flag placed beside a patient in one scope was drawn at the same
spot in the other, next to whatever card happened to be there. A mark meant
for one patient landed on a different one.

Card positions never had this problem, because they are keyed by patient id
and ids do not collide across scopes. A sticker has no such key — it belongs
to a position, not a patient — so the scope has to be part of where it is
stored.

### The fix

Stickers are now stored per scope. Switching between Pasien saya and Titipan
shows that scope's own stickers; a drag in progress when you switch belongs to
the scope you left, not the one now on screen.

**Existing stickers are migrated once, into Pasien saya.** Before this release
every scope read one shared key, so whatever was there was placed while
looking at some scope — most often Pasien saya, the default view. Moving it
there keeps it findable; leaving it in the old key would have made it quietly
stop appearing the moment this shipped. Titipan starts empty, since the old
key was never particularly its.

The decision of which key to read (`stickerMigrationPlan`) is a pure function,
tested on its own: migrate only for Pasien saya, only when it has never had its
own key yet, and only when the old key actually has something in it.

### Not done, and why

- **Not rendered here.** Worth checking: place a sticker while on Pasien saya,
  switch to Titipan, and confirm it is not there; switch back and confirm it
  is.

```
1493 tests passed (+5)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-23.2`

**Stickers that look like stickers, a bigger labelled set, and imported
checklist steps set apart from your own.**

### 1. Die-cut stickers

The white disc from `2026-09-22.4` solved the right problem — a bare emoji
vanished into a card of the same colour — the wrong way: a circle reads as a
button or a badge, not as something stuck on.

Each sticker is now **die-cut**, like a vinyl sticker: a white border that
follows the emoji's own outline, and a soft shadow under the whole thing. Four
offset, unblurred copies of the glyph in white make the border; one dark
shadow lifts it off the card. It still separates from every card colour in
either theme — white against the card, shadow beneath — but it keeps the shape
of the thing.

Each has a slight tilt (−8° to 8°) derived from its id, so it is slapped on
rather than aligned, and keeps the same angle every time the board draws.

### 2. More stickers, with names

33 stickers in five groups: Status (🚩 ✅ ❌ ⭐ ⚠️ ❗ ❓), Menunggu (🕒 ⏳ 📞 🔔 📝),
Klinis (🩸 🧪 💉 💊 🩺 🫀 🫁 🧠 🍽️), Disposisi (🚗 pulang, 🏠 🚑 🏥 ✂️ 🛏️) and six
colour dots.

**Every sticker has a label** — the tooltip in the picker and on the board, and
what a screen reader says. "🚗" alone does not say *pulang*, and a marker is only
useful if its meaning is shared.

### 3. Imported checklist steps in their own band

Steps added with **Ambil dari checklist harian** now sit in a block ruled above
and below with a dashed line, headed **Dari checklist: <nama checklist>**, after
your own items. One block per checklist if you imported from more than one.

A template's steps and your own reminders are different kinds of thing — one is
the ward's routine, the other is what only you know this patient needs — and in
one run they read as a single list someone wrote.

**How an item is known to be imported.** New imports record their source
(`fromChecklist`, the checklist's title). Items imported before this release
have no source, so an item whose label matches a step in one of your checklists
is treated as imported. The import only ever adds such labels, so a match almost
always is one; the one misread is an item typed by hand with exactly a step's
wording, and the cost is only which block it is drawn in.

Ticking, the ⟳ toggle and delete are unchanged, and the rows are the same
component in both groups.

### Not done

- **The sidebar's minimised Custom Checklist preview is not grouped.** It is a
  four-line glance; bands in four lines would be mostly rule.
- **Not rendered here.** Worth checking: import a checklist into a patient who
  already has your own items, and put a 🚗 on a green card.

```
1488 tests passed (+7)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-23.1`

**The census verifier's Stages 4–8, ported from Avi's `verifier.ts`, with the
confirmation loop the spec asks for.**

(This release also carries `2026-09-22.4`, which was not yet pushed.)

### What was ported

`domain/census/verifier.ts` is Avi's file: the pipeline (flatten → match →
checks → diff → report → markdown), every rule, every severity and every
message, as written. Each change is marked `PORT:` at the line where it
happens. None re-interprets a rule; each is a fix or a spec item the original
did not implement.

The re-uploaded `extraction.ts` was compared against last release's port:
schemas and prompt are identical, so the extraction layer is unchanged.

### It did not compile

In C3 the comparison object read `header /* alias */ as any: undefined` — not
valid TypeScript. The whole file failed at that line.

### Five bugs, each with a test that fails without the fix

Confirmed by reverting the fixes and watching six tests fail, then restoring
them.

1. **Issue ids collided.** An id was `ruleId + patient keys`, and C3, C9 and
   C10b have no patients — so every DPJP's count mismatch was `C3:`, every
   chief `C9:`, every category `C10b:`. Stage 6 diffs by id, so fixing one
   DPJP reported a DIFFERENT one as resolved, and two open issues collapsed
   into one. Ids now carry what the issue is about (the DPJP code, chief,
   category or RM).
2. **O5 had the same collision** (`O5:` for every vanished patient), and its
   message said "with no LEPAS RAWAT / Pindah CVCU / Operkan ke Tmn Lain
   notation found" although it never looked. It now names the patient (from
   the saved history — the original's own comment asked for this) and says
   only what it knows.
3. **One missing RM made two patients.** A name-only record was keyed apart
   from its RM-keyed twin, so a patient whose RM was left off in the LIST
   became an O3 orphan AND an O4 stale entry — two high-severity findings for
   one missing number. Name-only records now fold into the RM match with the
   same normalised name, and only when exactly one exists: two RMs sharing a
   name are two people.
4. **C3 checked only configured DPJPs.** A doctor new to the ward — exactly the
   one nobody has checked yet — was skipped silently. It now checks every code
   that appears.
5. **C9's message described something it did not do** ("if unconfirmed name
   variants are folded in"). Only confirmed aliases are folded; the message now
   says so.

### Spec items the original did not implement

- **Transposition detector (§3.4).** Two DPJPs each off by one in opposite
  directions: the total still matches, so C1 and C2 pass and C3 would report two
  unrelated mismatches. They are replaced by one issue: "Counts swapped between
  X and Y".
- **F5 (§3.5).** A dual DPJP code (`AHA-NP`) in the room grid, cosmetic when the
  other views agree. The original normalised it away and never reported it.
- **F6 (§3.5).** Same RM, different spelling of the name. Cosmetic.
- **The confirmation loop (§6, §7.6)** and O5's "carry it forward until the user
  confirms" (`domain/census/history.ts`).

### The confirmation loop

Kept on this device between runs: the last run's open issues (the baseline
for resolved / persisting / new), the RMs on the ward with their names, and
your answers.

- 🟡 items carry three buttons: *Sudah pulang / pindah*, *Memang disengaja*,
  *Salah ketik, sudah diperbaiki*. An answer closes the item on this run and
  later ones.
- **Answers close ONLY 🟡 items.** If "intentional" could close a count
  mismatch, the next shift's genuinely wrong count — same rule, same DPJP,
  same id — would be hidden by yesterday's answer.
- A vanished patient stays "on the ward" for O5 until confirmed gone, run after
  run.
- **Cleared on sign-out.** It holds names and RMs of the whole ward, and the
  next person on a shared PC must not inherit them.

### The screen

Following spec §7: pre-flight problems in red first; the verdict (CLEAN /
NOT CLEAN — n / PARTIAL) with date and patient count; resolved since last run;
issues grouped 🔴 → 🟠 → 🟡 → cosmetic, each with its view-by-view values as a
table; answered items; **Salin laporan** copies the original's markdown report.
The provisional checks from `2026-09-22.4` are deleted, not kept beside the
real verifier.

### Not done, and why

- **C4's "numbering typos" and the other cosmetic line checks** (`11.`, `3Plan:`)
  are not implemented: the spec lists them as cosmetic, the original has no rule,
  and they need the raw line grammar rather than the transcription.
- **The cascade detector is the original's**: C6 gains a note when C5 or C7 also
  fired. It does not merge them into one issue as the spec describes.
- **Chief aliases stay empty** (`confirmedChiefAliases: {}`), as in the original,
  until you confirm Gaby → Gabi. There is no screen to edit the config yet; it is
  `DEFAULT_CONFIG` in code.
- **History is per device**, like the canvas layout. Running on the phone and
  then the PC gives two separate baselines.
- **Not run against real PDFs.** 28 tests (19 verifier, 9 history) cover the
  rules on synthetic shifts — net +23, since the provisional checker's 5 were
  deleted with it. A real DENAH will find what they do not.

```
1481 tests passed (+23)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-22.4`

**Ward census verification in Helper (WIP), markers that stand out, and
images in board notes.**

### 1. Verifikasi sensus bangsal — WIP

Your `extraction.ts` (Stages 0–3), ported into the browser.

**What was ported unchanged:** the roster, the patient-line sub-schema, both
tool schemas and the whole system prompt, word for word
(`domain/census/schemas.ts`). They are the specification of what the model is
asked to do, and paraphrasing a spec while porting it is how two copies of one
instruction come to disagree. Also unchanged: the model, 16 000 tokens,
`temperature: 0`, the forced tool call, one retry on a failed self-check, and
returning the data WITH `_extractionWarnings` on the last attempt rather than
discarding it.

**What had to change:** the original is Node (`@anthropic-ai/sdk`,
`readFileSync`, a key in the server environment). Plano is a browser app, so
the call goes through `lib/ai` with the user's own key, like every other AI
feature, and the PDF comes from a file input, base64-encoded in chunks (a
single `fromCharCode(...bytes)` on a multi-megabyte PDF exceeds the argument
limit and throws).

**One behaviour change in `selfCheckProblems`, found by a test:** the original
pushed "Expected DENAH, got LIST_PASIEN" and carried on counting `roomGrid`.
With the wrong document's shape those arrays are missing and the count throws —
so dropping the LIST into the DENAH slot produced an exception instead of the
one message that says what to do. It now stops at the type mismatch.

**Its own AI switch**, off by default and off for every flag set saved before it
existed: it is the one feature that sends WHOLE documents — every patient's
name, RM and date of birth on the ward — rather than one note someone is
looking at, and that is a different decision from the others.

**What the checks cover so far** (`censusFindings`): a printed count against
the lines under it in the LIST (section headings and the header's per-DPJP
lines), and a patient — matched by RM digits, leading zeros kept — present in
one document and not the other. Nothing else yet, on purpose: chief-name
matching, holder lists and dispositions need the Stage 4–8 spec, and guessing
that "Gaby" is "Gabi" is exactly the correction the prompt forbids the model
from making. The verifier must not make it either.

**Nothing is stored** — not the PDFs, the transcriptions or the findings. The
raw JSON is viewable, collapsed, for checking the transcription itself.

### 2. Markers stand out

A bare emoji on a coloured card is an emoji on a coloured background, and the
cards come in twelve colours — a flag on the red card simply disappeared. Each
marker now sits on a white disc with a dark ring and a real shadow, which
separates from every card colour in both themes; no single tint could.

### 3. Images in board notes

Drag an image onto a note, or paste one while typing in it. Each image has
**Salin**, which puts the image itself on the clipboard (PNG, the one type
every browser's clipboard accepts), so it pastes into WhatsApp as a picture.
Right-click → copy works too; the button is for the phone.

**Where the images live, and why.** Firebase Storage is not enabled, and the
profile document was not an option: it holds settings and every Catatan note
under Firestore's 1 MiB cap, and a few photos there would push it over and break
every save to it. So each image is **its own document**
(`users/{uid}/boardImages/{id}`), the note holds only the ids, and the profile
is untouched.

Each image is re-encoded to fit: longest side 1400px, JPEG at stepped quality
until it is under 700 000 characters. JPEG because it is the only browser
encoding whose size trades for quality — a lab screenshot shrunk to fit is one
that can no longer be read. Transparent PNGs get a white background first,
since JPEG would turn them black.

The **rules** accept an image only under 900 000 characters with an
`image/jpeg` or `image/png` type, and never allow it to be updated or deleted.
The type is checked on a small field rather than by a regex over the image: a
pattern run across ~900 KB is a rule-engine limit waiting to be found in
production. Removing an image from a note only drops its id; the document stays
(no client hard-deletes). The image is written BEFORE its id is attached, so a
failure leaves an unused document, never a broken tile.

**Bounds follow the content.** The note used to report 96–640px whatever was in
it — fine for text, which scrolls, wrong for an image, which does not, and
would have been clipped under a small cap.

### 4. A note no longer looks like a patient

Paper, not a card: near-square corners, a strip of tape across the top, a
folded bottom-right corner, a stronger tilt and shadow, 📌 beside the label, and
no header band. On a board of patient cards, the one thing a note must never be
is mistaken for a patient.

### Deploy

**`firestore.rules` changed** (the image documents). Wait for
`firestore-deploy` to go green; until then image uploads are refused and the
note says so.

### Not done, and why

- **Stages 4–8 of the verifier.** Only the checks that follow from the schema
  itself are in. The rest needs the spec.
- **The roster is still the constant from your file.** Deriving it from the
  Jarkom import is the obvious next step, and it should be a decision rather
  than a quiet substitution.
- **`claude-sonnet-5`** as in your file, including its own advice to test Haiku
  against real shifts before switching. Not tested against real PDFs here.
- **Image documents are never cleaned up.** A detached image stays, per the
  no-hard-delete rule, and costs its own storage.
- **Not rendered here.** Worth checking: drop a screenshot on a note and paste
  it into WhatsApp with Salin; run the verifier on one real shift.

```
1458 tests passed (+26)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-22.3`

**Penanda moved out of the way.**

The button was pinned to the top-right corner of the canvas — which is where a
card sits. It floated over that card and covered it, and a control that hides
the thing it is meant to mark is worse than no control.

It now sits in the board toolbar beside Rapikan and Urungkan, through the same
portal slot they use. The palette hangs below the toolbar while it is open and
closes as soon as a marker is picked, so it covers a card only while it is
being used.

Nothing else changed: markers still land on the board, drag the same way, and
are still per device.

### Not done

- **A new marker still lands at the top left of the board**, which is on top of
  whatever card is there — by design, since a marker is meant to sit on the
  cards, and dragging it is the next thing you do. If it should land somewhere
  emptier, that is a placement rule worth deciding rather than guessing.

```
1443 tests passed
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-22.2`

**Compare two versions of a day's SOAP, and emoji markers on the canvas.**

### 1. Comparing two versions

Expanding a version in Riwayat perubahan already diffs it against the note as
it is NOW, which answers "what has changed since then". It could not answer
"what changed between the morning SOAP and the one after the chief's round" —
two points in the past, which is what a trail of thirty snapshots is for.

Each row now carries a **Banding** button. Pick two and the comparison appears
above the list, marked `1` and `2` on the rows it came from.

- **Ordered by `rev`, not by tap order.** A diff reads "what became what";
  picking the newer one first would print every addition as a removal.
- **Held by id, not by body.** A version can be deleted while the sheet is
  open, and a stored body would then be compared against something no longer
  in the list.
- **A third pick replaces the oldest** rather than being refused: refusing
  makes you work out which one to clear before you can do what you are already
  doing.
- The comparison sits above the list, not inside one of the two rows — it
  belongs to both.
- Picking is its own button. Tapping a row still expands it; a row that
  sometimes expanded and sometimes queued a comparison would be neither.

### 2. Penanda — emoji markers on the canvas

A **Penanda** button on the canvas opens twelve marks (🚩 ✅ ❌ ⭐ ⚠️ ❗ 🕒 📞
🩸 💉 🫀 👀). Pick one and it lands on the board; drag it next to the card it
is about.

- **They sit above the cards and take no part in the layout.** Their whole
  meaning is which card they are beside, so nothing reflows around them and
  nothing is pushed by them.
- **Per device, like the canvas layout itself.** A marker means something by
  WHERE it is, and where a card sits is already per device. Syncing markers
  while the cards stayed local would put a flag beside a different patient on
  the phone — worse than not syncing at all.
- **Coordinates are the canvas's own** (`x` a fraction of the width, `y` in
  pixels), so resizing the window keeps the marker beside the same card, which
  is the entire point of it.
- Dragged with pointer events, like the cards: the gesture survives the
  pointer leaving the marker, and it works with a finger.
- Written to storage once per drag, on release, not on every frame.
- `×` on hover removes one. No confirmation: it is two taps to place again.
- Hidden while searching or selecting, like the sticky notes.

Nothing else in the app reads a marker. What it means lives with whoever put
it there, and it is true until they move it.

### Not done, and why

- **A marker is not attached to a patient.** It is next to a card, not on one,
  so Rapikan — which re-lays the cards — leaves markers where they are and
  they will need moving. Attaching one to a patient would make it a clinical
  field, which is a different feature with a different bar.
- **The compare view is the same character-level diff** the trail already
  uses, not the word-level one from Bandingkan → revisi tempelan. Worth
  aligning them, but they answer differently shaped questions and that is its
  own change.
- **Not rendered here.** Worth checking: pick two versions of a busy day, and
  drag a flag next to a card on the ward PC.

```
1443 tests passed (+12)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-22.1`

**A note opened blank, the canvas could not bring a card forward, tighter
Catatan spacing, and initials on a folded card.**

### 1. A Catatan note sometimes opened empty

**Root cause.** The editor's text is written into the page by an effect that
runs when the TEXT changes (it has to: writing `innerHTML` on every render
moves the caret to the start). Since the board redesign, the editor only
exists once a card is opened. Opening the card that was already the active
note — the first one, or the last one you opened — mounted a fresh, empty
editor while the text had not changed, so the effect never ran. Switching tabs
changed the text, the effect ran, and the note "appeared".

The write depended on the value when what had changed was the element. It is
now also done by a callback ref, which runs exactly when the editor attaches,
reading the current note through the existing `syncRef` so it cannot hold a
stale one. The value effect stays for edits that arrive while it is open.

Recurring shape worth naming: **anything that writes into a DOM node must run
when the node appears, not only when its input changes** — the textarea
autosize had the same blind spot the other way round.

### 2. Bring a card to the front on the canvas

Stacking was fixed: the card in hand on top, expanded cards next, everything
else level. A card that ended up partly under another stayed there, with its
drag tab and grips under the other card and no way to reach them.

Now **pressing any visible part of a card raises it** above every card at rest,
and its tab and grips are reachable again. On pointer-down in the capture
phase, so it rises before the drag or resize the same press may start. Not
remembered: it means "what I am working on now".

### 3. Catatan spacing

~24px between cards → 8px. The old gap was a 12px margin plus two 4px strips
reserved above and below every card for the drag line. The drop lines now
overlay the gap instead of reserving space for it, so they still cause no jump
when they appear and cost nothing when they do not.

### 4. A folded card shows the DPJP's initials

As on the full card's badge. The full name is on hover.

### Not done

- **A card completely hidden behind another cannot be pressed**, so it cannot
  be raised this way. Rapikan still lays everything out without overlap.
- **Not rendered here.** Worth checking: open the first Catatan card straight
  after loading the page — it should not be blank.

```
1431 tests passed
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-21.4`

**The width grip is usable on a folded card; the drag tab is back to its old
size.**

Last release widened the wrong thing. The request was the width-resize grip,
not the drag tab — the drag tab is reverted to exactly what it was.

### Why the width grip was a sliver

`inset-y-6` inset it 24px from the top AND the bottom. On a full card that is a
reasonable bar. On a folded card, about 46px tall, it left the grip almost no
height at all — and a folded card is the one card where width is the only size
left to change.

Now:

- inset 4px from each end, so it spans nearly the card's whole height at any
  height;
- a 16px-wide hit area centred on the card's edge, with the visible 6px bar
  inside it. The bar used to BE the target, which is a thin thing to catch.
  8px of the hit area sits in the 12px gap between cards, so it never reaches
  the neighbour.

The height grip is unchanged.

### Not done

- **Not rendered here.** Worth checking: hover a folded card on the canvas —
  the bar on its right edge should run nearly its full height.

```
1431 tests passed
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-21.3`

**A compact pass on the patient card, and the display bugs in the screenshots.**

### What was wrong, screenshot by screenshot

| Seen | Cause | Fix |
|---|---|---|
| Header two or three lines tall on a narrow card | "−" and the eye were two 44 × 44 targets with a gap: ~90px of header, paid for out of the name and the location | One tight pair, 44px tall and 28px wide each, no gap — ~56px |
| An empty band between the header and "Belum:" | The card's minimum let the body shrink to zero, so under a small cap it became a sliver too short for text but tall enough for the fade | The minimum always keeps ONE line of body (or everything, if there is less) |
| A dark bar under a folded card | The height grip, on a card whose single line has no height to cap | Folded cards are uncapped: natural height, no grip |
| A drag tab too small to find on a folded card | 48px wide | 112px wide |

### The header controls

They stay 44px **tall** — the dimension a thumb misses on — and are 28px wide
each, still above the 24px minimum in WCAG 2.2. They sit as one group, so the
rule the header has kept since the eye's first bug still holds: a control never
shares a wrapping row with content, and the name column wraps on its own.

### Compact, not smaller

Nothing got a smaller font. What changed is the air around it:

- card padding 12px → 10px, the header band tightened to match;
- diagnoses at `leading-snug` instead of `relaxed` — a list of diagnoses reads
  fine at 1.375, and `relaxed` spent about a fifth of the body's height between
  the lines;
- the gaps above the body, the progress strip and the "Belum:" line
  trimmed.

With twelve cards on a board, every pixel of padding is paid twelve times.

### The drag tab

Wider, not taller. Canvas cards are 12px apart (`GAP_PX`), and the tab already
sits in that gap — a taller one would sit on the card above.

### Renamed

"Catatan tempel" is now **Catatan**, on the note and on the toolbar button.

### Not done, and why

- **The last visible diagnosis still fades** on a capped card. That is the
  intended signal that there is more below, drawn only when there IS more — a
  fade under every card would claim more on cards where there is none.
- **"Catatan" now names two things**: the Catatan page and the board's sticky
  notes. They are different features with the same word; say if you want the
  board's to read differently in the toolbar.
- **Not rendered here.** Worth checking on a narrow canvas card: the name,
  EKG badge and location should each fit on one line where they did not
  before.

```
1431 tests passed
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-21.2`

**An open note shows the whole card, and a folded card is a plain box.**

### 1. Opening the note squeezed the card

Under a height cap the note took its height from the body above it, so the
diagnoses faded out at exactly the moment the card was opened to be read.
Last release made the card stop OVERLAPPING in that state; it did not make it
readable.

Now, while a patient card's note is open, the canvas ignores that card's cap
and renders it at its natural height. Closing the note gives the cap back,
unchanged.

**Why the board decides, not the card.** The board already holds which notes
are open, so the canvas asks it (`isUncapped`). A card reporting "uncap me"
through its own measurement would stop measuring the moment it was uncapped —
the measurement only runs under a cap — and could never report the note
closing again.

**The height grip is hidden while a card is uncapped.** A drag there would set
a cap that does not apply until the note closes: a control whose effect you
cannot see.

The corner "show in full" toggle keeps its own state separately. An uncapped
card is not "expanded by the toggle", and offering to collapse it there would
fight the note that uncapped it.

### 2. The folded card is one plain box

Last release folded a card by hiding its body, progress and note with
conditionals through the full card — and left everything else. The EKG and
discharge badges, the KJS mark, the eye and the location all survived the
fold, so "folded" still looked like a card, and anything added to the full card
later would have survived it too.

The folded card now has its own render: **one box, the name and the DPJP as
text, and `+`**. Nothing else exists in it to leak through.

It keeps the card's colour, because the colour is the checklist progress —
information, not decoration. And it still behaves as a card on the board: it
opens the patient, selects in selection mode, and has its drag handle in custom
order.

The name wraps rather than truncating, which is the rule the full card's name
has always kept: a name cut short is a patient you cannot tell from the next.

The old scattered conditionals were removed rather than left unreachable, so
there is one folded view in the code, not two.

### Not done, and why

- **Uncapping moves the cards below it on the canvas only after Rapikan.** The
  canvas places cards by hand; an opened note makes one card taller, and the
  canvas does not push its neighbours down on its own.
- **Not rendered here.** Worth checking: open a capped card's note and confirm
  the diagnoses are all visible; fold a card and confirm only the name, DPJP
  and `+` remain.

```
1431 tests passed
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-21.1`

**The overlapping text on capped cards, remembered note state, and folding a
card to its name and DPJP.**

### 1. Why "Belum:" printed over the note

Two faults, one on top of the other.

**The minimum was measured from the box, not from what is in it.** A capped
card reported its smallest usable height as `root.offsetHeight -
body.clientHeight`. Under a cap the root is pinned to the cap (`h-full`), so
once the shrinkable body reached zero the formula returned *the cap itself*.
It could not see the header and progress strip overflowing the box, so it
reported a minimum smaller than the parts that cannot shrink, and the height
grip allowed a height that did not fit them. The note strip was left out of
the sum entirely, because it sits outside the link.

It now measures `link.scrollHeight` — the content height whatever the box is
clamped to — minus the body's current share, plus the note strip, measured
on its own.

**Nothing enforced the minimum when rendering.** The canvas slot was
`height: cap`. A cap valid when set becomes too small when the card later
grows a taller minimum — the note is opened, a badge appears — and the fixed
parts then overflowed each other. That is the screenshot: a cap set with the
note closed, then the note opened.

The canvas now keeps each card's reported bounds and renders the slot at
`max(min, min(cap, max))`: never below what the card cannot shrink past,
never above what its content needs, otherwise the cap. It re-renders only
when a card's bounds CHANGE, which is rare — the reason the bounds lived in a
ref (not re-rendering the board on every reflow) still holds.

A cap is a maximum (the field is `hMax`), so a card that needs less than its
cap now takes less, instead of sitting at the top of a tall empty slot.

### 2. The note's open/closed state is remembered

Per card, per device. The old comment said this was deliberately not
persisted — closing a note was a "crowding the board right now" act. In use it
is a standing choice about that patient, and closing the same note again after
every reload is the app forgetting what you told it.

### 3. Fold a card to its name and DPJP

A `−` beside the eye folds the card to its name and its DPJP (initials and
name); `+` unfolds it. Location, badges, body, progress and note all come back
with one tap. Remembered per card, per device, like the note.

The DPJP is the one fact kept because it is what a folded card is still
scanned for — whose patient this is.

On the canvas, a folded card reports its folded height so its slot shrinks to
fit; without that, the floor from before the fold would have kept the slot
tall and empty.

Both remembered sets are only ever toggled one id at a time, never rebuilt
from the cards on screen — a set rewritten from a filtered board would forget
every card the filter hides (recurring pattern 1).

### Not done, and why

- **Per device, not per account.** Folds follow the screen, like the canvas
  layout: the phone and the ward PC want different cards folded.
- **Remembered ids are never pruned.** A discharged patient's fold stays in
  localStorage. It is a few bytes per patient; pruning it safely would mean
  knowing every patient on every scope, which is the thing pattern 1 warns
  against guessing.
- **A folded card on the canvas can leave a gap below it** until Rapikan is
  pressed, because the canvas places by hand and does not move the cards
  underneath on its own.
- **Not rendered here.** Worth checking: cap a card, open its note, and
  confirm the card grows instead of overlapping; fold a card and reload.

```
1431 tests passed (+4)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

## `2026-09-20.3`

**Catatan tempel: sticky notes on the patient board.**

`+ Catatan tempel` in the board toolbar puts a blank yellow note on the board.
Type straight into it — there is no page behind it and no sheet; the note IS
the card, the way a paper note is written where it is stuck.

### On the canvas it is a card like any other

In `Urutan sendiri` a sticky note is dragged by the same handle and resized by
the same width and height grips as a patient card. That is not a copy of the
behaviour: the canvas was already written against ids and a `renderItem`
callback, so a note is just another id it places. A fix to dragging is a fix to
both, and there is no second drag system to drift out of step.

It honours the same height contract as `PatientCard`: under a height cap it
fills the space and scrolls inside; uncapped it grows with its text.

Notes are listed AFTER the patients, because the canvas auto-places in that
order — a new note takes the next free slot instead of pushing every arranged
card down one.

Outside the canvas (the other orders, and phones) the notes sit in their own
row above the patients. Masonry places by measurement, not by hand, so there is
nowhere for a note to be "left" among the cards.

### Storage, and the bug it was designed around

On the profile, as a **map keyed by note id**, with every change written to
exactly ONE field path — `boardNotes.<id>.text`, `.color`, `.deletedAt`.

Not an array. Catatan are one array in one document, and two quick saves there
lost the first (recurring pattern 5), which needed `pendingBodies` to fix.
Here, typing in one note and recolouring another — or editing on the phone
while the PC changes a colour — write different fields and cannot overwrite
each other. `FieldPath` rather than a dotted string, so a path cannot be
misread whatever the id contains.

Position and size are not stored here: they belong to the canvas layout, as a
patient card's do.

### Editing

- Saves after a 600 ms pause, and on blur, and when the board unmounts — a
  note left mid-sentence is saved, not dropped.
- While a note has focus it keeps its own text and ignores echoes. Replacing
  text under a caret moves the caret and eats what was typed in between; on
  blur it catches up with the stored version.
- **Colour**: the dot opens six swatches in place — kuning, oranye, merah muda,
  hijau, biru, ungu. They are the shared card tokens, so they follow the theme
  and pass `check:contrast`. Yellow is the default because that is what a
  sticky note looks like.
- **Delete**: `×`, then `Hapus?` to confirm. Soft delete, like everything else:
  the note leaves the board and its text stays in the profile.
- A slight tilt, the cheapest way to say "this is not a patient".

Hidden while searching (a search asks "which patient", and a note would sit in
the results looking like an answer) and while selecting (a note cannot be
ticked for archive).

### Not done, and why

- **Positions are per device**, exactly as patient cards' are. The note's text
  and colour sync; where it sits on the canvas does not. If that turns out
  wrong it is one change in `readLayouts`/`writeLayouts`, for both at once.
- **No undo for a deleted note.** Its text is kept, but there is no screen to
  bring it back yet.
- **Text only.** No checklist or formatting inside a note — it is for "lab jam
  14", not for a document; Catatan is where documents go.
- **Not rendered here.** Worth checking: add two notes on the ward PC, drag one
  between patient cards, cap its height, change its colour, and check the phone
  shows the same text.

```
1427 tests passed (+6)
typecheck / lint (0 warnings) / check:version / check:contrast / check:a11y / build — clean
```

---

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
