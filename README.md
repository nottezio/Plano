# Visite

Offline-first PWA for daily inpatient rounds (*visite*) notes.
Build spec: [`SPEC.md`](./SPEC.md). Owner: Avicenna.

One free-form page per patient per clinical day. Structure is **detected**,
never enforced — there are no S/O/A/P input boxes, and the parser never rewrites
what was typed.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # fill in the Firebase web config
npm run dev
```

The service worker is disabled in dev by design. To exercise it:

```bash
npm run build && npm run preview
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck (app + service worker), then production build |
| `npm run preview` | Serve `dist/` — the only way to test the service worker |
| `npm test` | 248 domain unit tests, pinned to `TZ=UTC` |
| `npm run typecheck` | `tsc --noEmit` over both programs |
| `npm run check:version` | Fails if a version string exists outside `src/version.js` |
| `npm run check:contrast` | Fails if any card colour drops below 4.5:1, light or dark |
| `npm run check:a11y` | Fails on sub-44px tap targets or hardcoded hex colours |
| `npm run verify` | All of the above, in order. Run this before shipping. |

---

## Deploying to GitHub Pages

Pages serves static files only. Firestore, Auth and the security rules live in
Firebase and deploy separately.

1. **Firebase console** — create a project; enable Authentication providers
   *Google* and *Email/Password*; create a Firestore database.
2. **Authorized domains** (Authentication → Settings) — add `<user>.github.io`.
   Sign-in fails with `auth/unauthorized-domain` without it.
3. **Rules and indexes** — `firebase deploy --only firestore:rules,firestore:indexes`
   The board query returns nothing at all until the composite index exists.
4. **Repository variables** (Settings → Secrets and variables → Actions →
   *Variables*) — the six `VITE_FIREBASE_*` values, plus `VITE_BASE`:
   - project page `https://<user>.github.io/<repo>/` → `/<repo>/`
   - user page or custom domain → `/`
5. **Pages source** — Settings → Pages → Build and deployment → *GitHub Actions*.
6. Push to `main`. The workflow runs every guard above, then deploys.

Notes:

- The `VITE_FIREBASE_*` values are **public identifiers, not secrets** — they
  ship in every web bundle by design. Data is protected by `firestore.rules` and
  the authorized-domains list, never by hiding the config.
- Pages has no SPA rewrite, so the build emits `404.html` as a copy of
  `index.html`. Deep links like `/p/abc/2026-08-06` work cold; the service
  worker's navigation route handles them offline.
- On iOS, add the app to the Home Screen. Safari evicts IndexedDB from *browser
  tabs* after ~7 days of non-use; installed apps are exempt. The app says so.

---

## Architecture

```
src/
  domain/          Pure logic. No React, no Firebase. All the tests live here.
    clinicalDate   Rollover, hari rawat, formatting, night-shift hint
    checklist      Tick state, card colour, progress, Settings editors
    sections/      Read-only, lossless section parser + alias config
    merge/         Three-way merge over diff-match-patch
    format/        markdown-lite → WhatsApp / plain / Markdown, composition
    board, archive, carryForward
  data/            Firebase boundary. Repositories, paths, export.
  hooks/           React ↔ domain ↔ data wiring
  components/      UI, grouped by surface
  routes/          One file per screen
```

**The UI never imports `firebase/firestore` directly.** Everything crosses a
repository.

---

## Non-obvious decisions

Each looks arbitrary until it bites. Ordered by how much damage the alternative
would have done.

### Data safety

- **`patch_apply` succeeding is not a merge safety test.** diff-match-patch's
  matcher is fuzzy, so a patch can "apply" onto a region the other device also
  rewrote and produce a mash of both — two devices appending at the same
  position both report success. The real test is structural: which ranges of the
  *base* did each side touch? Disjoint → merge. Overlapping → ask the user.
- **`localBase` exists because Firestore's cache is not a merge base.** The
  cache holds the latest known document, which after a remote edit is the
  *remote* version, not the common ancestor. Merging against it degenerates to
  last-write-wins. The base is stored separately in IndexedDB and advanced only
  on server-confirmed snapshots.
- **Both versions are snapshotted to the revision trail *before* a resolution is
  applied**, not after. If the app dies in between, the losing version is
  already recoverable.
- **A resolution that provably loses nothing always exists** ("Simpan
  keduanya"). Deliberately ugly, deliberately last. Dismissing the conflict
  dialog falls back to it rather than silently keeping one side.
- **There is no delete.** Patients are archived, and archived records stay
  editable and copyable — discharge summaries get written after discharge.
  `firestore.rules` denies `delete` outright, so this is enforced at the server.
- **Autosave force-flushes after 15 s of continuous typing**, not only on idle.
  Someone who types for two minutes straight and then drops the phone must not
  lose two minutes waiting for a gap that never came.

### Correctness

- **All clinical-date arithmetic is UTC.** Parsing `2026-08-06` as *local*
  midnight and adding a day returns 23:00 the same day in any DST zone — and
  since doc ids *are* these strings, that is a note landing in the wrong day.
  Timezone enters in exactly one place: deciding which calendar date "now" is.
- **Tests run under `TZ=UTC`.** A machine already set to `Asia/Jakarta` would
  pass the clinical-date tests while hiding the exact bug they exist to catch.
- **There is no checklist reset anywhere.** The checklist doc id *is* the
  clinical date, so a new day is a document that does not exist yet. No timer,
  no cron, nothing to double-fire, correct on a device that slept for a week.
- **No regex lookbehind.** Safari only gained support in 16.4, and a lookbehind
  throws at *parse* time — taking down the whole bundle on exactly the iPads
  this runs on. Left boundaries are captured and re-emitted.

### Structure and format

- **The parser only reads.** `parseSections` returns offsets and slices into the
  stored body, never a rewritten copy. The losslessness invariant —
  `sections.map(s => body.slice(s.start, s.end)).join('') === body` — is
  asserted over twelve bodies. `mergeSections` is a *separate* function so that
  invariant can hold unconditionally on the primary output.
- **markdown-lite is the only stored format.** WhatsApp's `*bold*` and
  Markdown's `*italic*` are the same character meaning different things, so
  storing either makes every round-trip lossy. One canonical model in, three
  pure formatters out.
- **Copying *all* sections is byte-faithful** apart from the format conversion
  the user asked for. Re-composing from parsed blocks would silently normalise
  their own spacing.
- **The editor is a plain `<textarea>`.** A WYSIWYG owns the document model, and
  then the stored body stops being exactly what was typed — breaking the
  parser's contract, byte-faithful copy, and the merge that operates on plain
  text.

### Performance and platform

- **The board reads one query, not 2N listeners.** `preview` and
  `boardChecklist` are denormalised onto the patient document. The
  subcollections stay authoritative; the caches are derived, truncated, and
  rewritten wholesale so a stale clinical date cannot leak yesterday's ticks.
  **Anything that *writes* a tick reads the authoritative document** — the cache
  is one write behind by design.
- **The Firebase SDK is its own chunk.** ~760 kB that changes on Google's
  schedule; the app chunk is ~35 kB and changes every deploy. One chunk would
  force a full SDK re-download on every update, over hospital wifi, mid-round.
- **Two TypeScript programs.** `src/sw.ts` is typechecked by `tsconfig.sw.json`
  because the `DOM` and `WebWorker` libs declare conflicting globals.
- **`src/version.js` is plain JS** so `vite.config.ts` can import it at
  config-load time. `check:version` fails the build if the string is duplicated.
- **One text-sync hook, two editors.** SOAP entries and documents share
  `useTextSync` — same debounce, same force-flush triggers, same merge.
  Documents omit only the revision trail, and that omission is explicit.

### Product

- **A patient is created by tapping +, not by filling in a form.** Identity is
  optional metadata; the board titles an unnamed patient by the first line of
  their note. Requiring a name before you can write is exactly the structure
  the prime directive forbids imposing — the note *is* the record.
- **Soft presence is a hint, never a lock.** A hard lock is worse than the
  problem: the holder walks away, the document stays locked, and the person who
  needs to write is stuck — offline, with no way to release it.
- **No Save button anywhere, including Settings.** Two save models in one app is
  how a user loses a change they believed was applied. Settings patch by dotted
  path, so two devices editing different settings never overwrite.
- **The PIN is a shoulder-surfing deterrent, not encryption.** Notes sit in
  IndexedDB in plaintext because Firestore's offline cache requires it. Blur
  fires instantly on backgrounding; the lock waits `autoLockMinutes`, because a
  lock that demands a PIN every time you check a message gets switched off.
- **Checklist items are disabled, never deleted.** Deleting a definition orphans
  every historical tick keyed by its id. Renaming keeps the id, so a rename
  relabels history retroactively.

---

## Privacy

This app stores full patient names, MRNs and note bodies in Google Firestore and
in browser storage. It is **not** end-to-end encrypted. There is no analytics, no
tracking, and no third-party service other than Firebase.

The operator is responsible for compliance with hospital policy and Indonesian
UU PDP No. 27/2022. Settings → *Keterbukaan data* states this in-app, and
Settings → *Ekspor data* produces a complete JSON copy so the record is never
hostage to this application.

Defaults are privacy-forward: the board shows initials + bed only, background
blur is on, and PIN lock is offered on first run.

---

## Phase status

| Phase | State |
|---|---|
| P0 — scaffold, tokens, PWA shell | shipped |
| P1 — Firebase, auth, rules, repositories, `localBase`, sync pill | shipped |
| P2 — `clinicalDate.ts`, `checklist.ts` | shipped |
| P3 — `parseSections.ts` + alias config | shipped |
| P4 — Board: cards, colours, progress strip, search, filters, FAB | shipped |
| P5 — Patient page: date rail, editor, autosave, carry-forward, lock | shipped |
| P6 — `threeWayMerge.ts`, conflict dialog, revision trail, presence | shipped |
| P7 — Checklist UI: page pills + quick sheet | shipped |
| P8 — Copy engine: formatters, copy sheet, per-section copy | shipped |
| P9 — Archive | shipped |
| P10 — Documents | shipped |
| P11 — Settings: checklist editor, aliases, clinical day, export | shipped |
| P12 — Privacy: PIN lock, auto-lock, background blur, disclosure | shipped |
| P13 — Polish: a11y pass, error boundaries, docs | shipped |

## Known gaps

- **Not verified against a live Firebase project.** Every phase was typechecked,
  unit-tested and built; sign-in, offline writes, reconnect merges and iOS
  standalone install need a real project and real devices.
- **No component or E2E tests.** The domain layer has 248 tests; the React layer
  has none. Playwright against `npm run preview` is the obvious next step.
- **Export is sequential.** Fine at ward scale, slow at hundreds of patients.
- **Sharing is a seam, not a feature.** `memberIds` and `addMember` exist so
  sharing needs no migration, but there is no UI for it.
