# Plano

Offline-first PWA for clinical rounds notes. One free-form note per patient per day, never lost, and turned into the formats rounds reporting needs. The UI is in Bahasa Indonesia; code, comments and identifiers are in English.

> Package name: `visite` (the original spec name). The product is called **Plano**.

## Why it exists

| Need at the bedside | How Plano handles it |
|---|---|
| Bad ward wifi | Every read and write works offline and reconciles later |
| One hand, five seconds | Phone-first layout, thumb-reachable actions |
| Never lose a word | The note is one free-form string; soft delete only; three-way merge on concurrent edits |
| Reporting channels | Copy sections out as SIMGOS (ASCII), WhatsApp (`wa.me` prefill), Telegram, PDF/Ringkas |
| Trust the numbers | Calculators cite their source; no hardcoded lab reference ranges |

Structure in a note is **detected, never enforced**: the parser finds section boundaries (S, O, A, P) for copy and export and never rewrites, normalises or reorders stored text.

## Stack

- React 18, TypeScript (strict), Vite, Tailwind CSS
- Zustand for state, Tiptap for the editor
- Firebase Auth and Firestore (rules in `firestore.rules`)
- Service worker via `vite-plugin-pwa` / Workbox
- Vitest for tests

## Getting started

Requires Node 20 or newer.

```bash
npm ci
```

Create `.env.local` with your Firebase web config (these are public identifiers, access is enforced by Firestore rules and Auth authorized domains):

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

```bash
npm run dev
```

To work against the local Firebase emulators instead (Auth and Firestore, project `demo-plano`), run each in its own terminal:

```bash
npm run emu
npm run dev:emu
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, then production build |
| `npm test` | Vitest, single run |
| `npm run typecheck` | App and service-worker type checks |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm run check:version` | Fails if a version string exists outside `src/version.js` |
| `npm run check:contrast` | Card colours must meet 4.5:1 contrast |
| `npm run check:a11y` | Accessibility checks |
| `npm run preflight` | Session-start check for stale base, missing bump or changelog |
| `npm run verify` | Everything above, then build. Run before shipping |

## Project layout

```
src/
  domain/       Pure logic: parser, merge, dates, calculators, census (tested)
  components/   UI by area: board, copy, notes, patient, floor, settings, ...
  store/        Zustand stores
  lib/          Firebase, sync, helpers
  routes/       Pages
  sw.ts         Service worker
  version.js    The only place a version string may live
public/         Icons and static assets
scripts/        Repo checks (version, contrast, a11y, preflight)
firestore.rules Security rules (the only real access control)
```

## Docs

| File | Contents |
|---|---|
| [`PRODUCT.md`](PRODUCT.md) | Users, purpose, constraints, principles |
| [`SPEC.md`](SPEC.md) | Canonical spec: terminology, parser rules, sync, versioning |
| [`DESIGN.md`](DESIGN.md) | Design system |
| [`CHANGELOG.md`](CHANGELOG.md), [`CHANGES.md`](CHANGES.md) | Release history |

## Versioning

The version lives only in `src/version.js` as `YYYY-MM-DD.N`. Any shipping change bumps it in the same edit and adds a changelog entry in the same commit. Never copy the version string elsewhere; `npm run check:version` enforces this.

## Deployment

Pushes to `main` run tests and checks, build, and deploy to GitHub Pages (`.github/workflows`). Firebase config comes from repository variables. Set `VITE_BASE` if not serving from `/<repo>/`.

## Privacy and clinical use

- This repository is public. Never commit patient names, MRNs, note bodies, credentials or exports. Note bodies, names and MRNs are never logged.
- Because the repo is public, any gating must live in Firestore Security Rules and Cloud Functions, never in the frontend.
- Plano is a note-taking and formatting aid, not a medical device. It does not provide diagnosis or treatment decisions. Verify every clinical value and calculation against its cited source and your hospital's protocols.

## License

[MIT](LICENSE). The software is provided as is, without warranty, including for any clinical use.
