# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Hospital residents doing clinical rounds, standing at the bedside with a phone, often one-handed, with unreliable ward wifi. Today: the owner (a resident) and a few colleagues. Intended direction: open to many residents.

The job: capture and revisit each patient's daily SOAP note quickly (about five seconds per action), then copy sections out to the channels a report actually goes through.

## Product Purpose

Plano (package name "visite") is an offline-first PWA for clinical rounds notes. It keeps one free-form note per patient per day, never loses it, and turns it into the formats rounds reporting needs. Success is that a resident can trust it at the bedside with no signal and never lose or have rewritten a word they typed.

## Positioning

Rounds-native and lossless. The note is one free-form string, and structure is only detected, never enforced: the parser finds section boundaries for copy and export and never rewrites, normalises or reorders stored text. A general notes app or a hospital EMR does not do this.

## Operating Context

- Ward devices with bad connectivity; every read and write must work offline and reconcile later.
- Clinical day rolls over at 00:00.
- Clinical text is Indonesian (`Mohon izin melaporkan pasien`, `*S:*`/`*O:*`, `assess`/`terapi`, `T/`, `A/`, `P/`, `hari rawat`, slash-delimited consult blocks).
- Outputs: SIMGOS (hospital ASCII), WhatsApp (`wa.me` prefill only, about 2,000 characters practical limit), Telegram, PDF/Ringkas.
- The owner copies notes by highlighting text in the Salin preview box by hand, not through the Salin button.
- Real-device observations from ward devices are ground truth.

## Capabilities and Constraints

- React 18, TypeScript strict, Vite, Tailwind, Zustand, Firebase (Auth + Firestore). Public repo.
- Patients live in a top-level collection with `memberIds`; sync uses a three-way merge so concurrent edits on a single SOAP string do not lose data.
- Soft delete only (`deletedAt`); hard delete only through explicit trash-and-purge. Never log note bodies, names or MRNs.
- The UI is in Bahasa Indonesia; code, comments and identifiers are in English. English terms stay where Indonesian feels forced (Preview, Pin, Undo, Synced, offline, checklist, template, sync, backup, export). The word "Alat" is never used in the UI.
- Dates display as tgl/bln/tahun (`09/10/2026`) through `DateField`, not the native date display.
- Calculators: every formula and cut-off traceable to a cited source; no hardcoded lab reference ranges.
- User-facing text stays professional: no hospital system names such as "SIMGOS" in calculator UI.
- WhatsApp programmatic sending is not possible; prefill only.
- Because the repo is public, any future gating must live in Firestore Security Rules and Cloud Functions, never the frontend.

## Brand Commitments

The product is named Plano in the UI and repo docs; "Visite" is the package and original spec name. No other binding brand rules were stated.

## Evidence on Hand

Real note exports and ward-device screenshots from the owner settle format questions; SPEC.md is canonical for terminology and parser rules. No testimonials, customer data or usage metrics exist, so none should be invented.

## Product Principles

1. Never lose a note. Data-loss bugs outrank everything, including polish.
2. Works with no signal. Offline is the default state, not a fallback.
3. Fast one-handed at the bedside. Every common action is quick and reachable by thumb.
4. The user's text is sacred. Detect structure, never impose or rewrite it.
5. Say what is true. Cited sources for clinical numbers; no invented claims.

## Accessibility & Inclusion

The repo enforces contrast and a11y gates (`npm run check:contrast`, `npm run check:a11y`) as part of `verify`. No further product-specific requirement was stated.
