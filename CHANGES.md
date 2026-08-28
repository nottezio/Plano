# Plano — CHANGES

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
