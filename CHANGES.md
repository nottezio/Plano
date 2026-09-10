# Plano — CHANGES

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
