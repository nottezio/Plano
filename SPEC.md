# MASTER BUILD PROMPT — "VISITE" (Clinical Rounds Note App)

> **What this file is:** a production-grade prompt/spec to paste into an AI coding agent
> (Claude Code, Cursor, Windsurf, or a chat session). It is written *to the AI*, not to you.
> Feed it once at the start, then drive the build phase by phase (§19).
>
> **Owner:** Avicenna · **Doc version:** 2026-08-06.2
>
> **Changes from .1:** SOAP is now a **single free-form body per day** (Google-Keep-style), not
> discrete section fields. Section-selective copy is now a **parser**, not a schema (§12).
> Clinical day rollover is **00:00**. Patients moved to a **top-level collection with `memberIds`**
> so future sharing needs no migration. Conflict handling upgraded to **3-way merge** (§7).

---

## 0. HOW TO USE THIS PROMPT

| Step | Action |
|---|---|
| 1 | Save as `SPEC.md` in repo root; tell the agent to read it fully before writing code. |
| 2 | Say: `Execute Phase 0.` The agent builds one phase per response. |
| 3 | Review, then say `Continue` / `Execute Phase N`. |
| 4 | Any bug report → agent must follow the RCA protocol in §1.4. |
| 5 | Every shipped change → version bump per §16. Non-negotiable. |

---

## 1. ROLE & OPERATING RULES FOR THE AI

### 1.1 Role
You are a senior front-end architect specialising in **offline-first PWAs** and **local-first data sync**, building a clinical workflow tool for a hospital resident. You are also acting as a clinical-informatics engineer: patient safety, data-loss prevention, and privacy are functional requirements, not nice-to-haves.

### 1.2 Prime directives
1. **Never lose a note.** Data-loss bugs outrank every other concern including UI polish. Soft-delete only; keep local revisions.
2. **Works with no signal.** The ward has bad wifi. Every read and write must succeed offline and reconcile later.
3. **Fast on a phone, one-handed, in 5 seconds.** The user is standing at a bedside.
4. **No silent overwrites.** If two devices disagree on user-authored text, auto-merge only when provably safe; otherwise surface it.
5. **Do not impose structure on the note body.** The user types freely. Structure is *detected*, never enforced.

### 1.3 Output protocol
- Build **one phase per response** (§19).
- If output would be long, stop at a **logical breakpoint** (end of a function/file), state exactly what comes next, and emit:
  `[PAUSED - Reply 'Continue' to proceed]`
- **Never truncate mid-line.**
- Every response that ships code must state the new `APP_VERSION`.
- State assumptions inline; do not stall the build to ask unless it is a genuine toss-up.

### 1.4 Debugging protocol (mandatory)
When given a bug, error, or regression:
1. Do **not** ship a superficial patch or wrap it in a generic `try/catch`.
2. Produce a short **Root-Cause Analysis**: why it failed at the architectural/logical level.
3. Then present:
   - **The Root Cause** — the structural problem.
   - **The Fundamental Fix** — changes that eliminate the class of bug in that subsystem.
4. If a stopgap is needed, label it **"Temporary Workaround"** and state why the fundamental fix is still required.

### 1.5 Anti-patterns — explicitly forbidden
- ❌ One 3000-line `index.html`. This is a real app, not a demo.
- ❌ Hardcoding a version string anywhere except `src/version.js`.
- ❌ Storing WhatsApp-formatted text as the source of truth (§12.2).
- ❌ **The parser rewriting, normalising, or reformatting the stored note body.** Parse output is derived and read-only. Ever.
- ❌ Forcing the user into separate S/O/A/P input boxes.
- ❌ Hard deletes from the client.
- ❌ A midnight timer/cron to "reset" the checklist (§9.2).
- ❌ Using device clock for conflict-resolution ordering.
- ❌ `try { ... } catch(e) {}` that swallows errors.
- ❌ Blocking the UI on network. Optimistic writes always.

---

## 2. PRODUCT CONTEXT

**User:** an Indonesian hospital resident (dokter) managing an inpatient list across shifts and daily rounds (visite).

**Mental model:** Google Keep, but each "note" is a **patient**, and each patient accumulates a **day-by-day SOAP** — one free-form page per day — until discharge or transfer, at which point the note is **archived**.

**Daily loop per patient:**
```
visite → tulis SOAP hari ini → kirim ke Chief → dikoreksi
      → lapor DPJP → input SIMGOS → laksanakan plan & terapi
```
That loop is the checklist, and it **resets every clinical day**.

**Devices:** laptop (primary writing), iPad (rounds), phone (bedside + WhatsApp handoff). All three, same account, synced.

**Tenancy:** each account sees only its own patients. Sharing is **not** built in v1 but the schema must make it a config change, not a migration (§6.1).

**UI language:** Bahasa Indonesia. Code, comments, identifiers: English.

---

## 3. NON-GOALS (v1)

- Not an EMR. No HL7/FHIR, no SIMGOS API — output is **copy-to-clipboard** only.
- No shared boards, comments, or @mentions **in v1** (schema-ready only).
- No file/image attachments.
- No rich template editor UI — schema + picker only (§13).
- No push notifications. No native app-store build. PWA only.
- **No structured SOAP fields.** Explicitly rejected by the user.

---

## 4. TECH STACK (LOCKED)

| Layer | Choice | Why |
|---|---|---|
| Framework | **React 18 + TypeScript (strict)** | typed domain model prevents whole classes of clinical-data bugs |
| Build | **Vite** | fast, first-class PWA plugin |
| Styling | **Tailwind CSS** + CSS variables for color tokens | color tokens are domain data (§9.3) |
| UI primitives | headless (Radix) or shadcn/ui | accessible sheets/dialogs on touch |
| State | **Zustand** (UI/drafts) + Firestore listeners (server state) | no Redux ceremony |
| Backend | **Firebase**: Auth + Firestore + Hosting | §4.1 |
| Offline | Firestore `persistentLocalCache` + `persistentMultipleTabManager` | durable offline write queue, one line |
| Merge | **`diff-match-patch`** | 3-way merge of the single note body (§7.3) |
| Editor | plain `<textarea>` (auto-grow) + overlay affordances | Keep-like. Do **not** ship a heavy WYSIWYG. |
| PWA | `vite-plugin-pwa` (Workbox, `injectManifest`) | installable, precached shell |
| Dates | `date-fns` + `date-fns-tz` | timezone-correct clinical day (§9.1) |
| IDs | `nanoid` | client-generated IDs → offline creates work |
| Routing | React Router v6 | deep links to `/p/:id/:date` |

**Node 20+. No jQuery, no Moment, no CDN script tags for app code.**

### 4.1 Why Firestore

| Option | Verdict |
|---|---|
| **Firestore** ✅ chosen | Real offline queue, real-time listeners, Auth + rules included, already known to the user. |
| Supabase | Better SQL; weaker offline without PowerSync/Electric. Not worth the swap. |
| Yjs/Automerge CRDT | The only thing that beats a 3-way merge on a single text blob. Correct *eventual* answer, wrong v1 answer. Seam preserved (§7.6). |
| PouchDB/CouchDB | Good replication, but you still hand-resolve revision trees and self-host. |

> **Honest note the agent must respect:** collapsing SOAP into one field *increases* conflict surface versus per-section fields. §7 is therefore mandatory, not optional. Skipping the 3-way merge means shipping a data-loss bug.

---

## 5. ARCHITECTURE & STRUCTURE

Modular, offline-first, installable. **Not** a single-file prototype.

```
src/
  version.js                 # SINGLE source of truth for version (§16)
  main.tsx
  App.tsx
  routes/
    BoardPage.tsx            # tab: Aktif
    ArchivePage.tsx          # tab: Arsip
    DocumentsPage.tsx        # tab: Dokumen
    SettingsPage.tsx         # tab: Pengaturan
    PatientPage.tsx          # /p/:patientId/:date?
  domain/                    # PURE. No React, no Firebase. Unit-tested.
    clinicalDate.ts          # rollover logic (§9.1)
    checklist.ts             # state + card color resolution (§9.3)
    sections/
      aliases.ts             # default + user-defined section aliases
      parseSections.ts       # READ-ONLY structural parse of the body (§12.1)
    format/
      markdownLite.ts        # canonical inline format (§12.2)
      toWhatsApp.ts
      toPlain.ts             # SIMGOS
      compose.ts             # section/date selection → output string
    merge/
      threeWayMerge.ts       # diff-match-patch wrapper (§7.3)
    templates.ts             # token interpolation
    carryForward.ts          # yesterday → today body transform (§10 F4)
  data/
    firebase.ts
    localBase.ts             # IndexedDB store of last-synced body per (patient,date)
    repositories/
      patients.repo.ts  entries.repo.ts  checklist.repo.ts
      documents.repo.ts templates.repo.ts settings.repo.ts
    TextSyncAdapter.ts       # seam for future CRDT (§7.6)
  store/
    useSession.ts  useUI.ts  useDrafts.ts  useLock.ts
  components/
    board/  patient/  copy/  common/
  hooks/
  styles/tokens.css
```

**Repository rule:** UI never imports `firebase/firestore` directly. All access flows through `data/repositories/*`.

---

## 6. DATA MODEL (Firestore)

```
patients/{patientId}                    ← TOP-LEVEL (see §6.1)
  ├─ (doc) Patient  { ownerId, memberIds: [uid], ... }
  ├─ entries/{YYYY-MM-DD}               ← one doc per clinical day, ONE body field
  │    └─ revisions/{autoId}            ← capped snapshot trail
  └─ checklist/{YYYY-MM-DD}

users/{uid}
  ├─ (doc) UserProfile + settings
  ├─ documents/{documentId}             ← personal, never shared
  └─ templates/{templateId}             ← personal, never shared
```

### 6.1 Why patients are top-level
Isolation today, sharing tomorrow — with **zero migration**. `memberIds: [ownerId]` on create; rules require `request.auth.uid in resource.data.memberIds`. To share later: push a uid into `memberIds` and add an invite UI. Board query is `where('memberIds','array-contains', uid)`. Nesting patients under `users/{uid}` would have forced an export/re-import later.

### 6.2 Types

```ts
export type ClinicalDate = string;   // "YYYY-MM-DD"
export type SectionId =
  | '_intro' | 's' | 'o' | 'ttv' | 'penunjang' | 'a' | 'p' | 'terapi'
  | `custom_${string}`;

export interface UserProfile {
  uid: string; displayName: string; email: string;
  createdAt: Timestamp;
  schemaVersion: number;
  settings: UserSettings;
}

export interface UserSettings {
  timezone: string;                     // default "Asia/Jakarta"
  dayRolloverHour: number;              // DEFAULT 0 (midnight). Configurable. (§9.1)
  checklistItems: ChecklistItemDef[];   // fully user-editable, any count
  sectionAliases: SectionAlias[];       // drives the parser (§12.1)
  carryForwardOnNewDay: boolean;        // default true
  carryForwardClearSections: SectionId[]; // default ['s','penunjang']
  defaultTemplateId: string | null;
  copyPresets: CopyPreset[];
  privacy: {
    pinLockEnabled: boolean;            // DEFAULT true (full names are stored)
    autoLockMinutes: number;            // default 3
    blurOnBackground: boolean;          // default true
    boardShowInitialsOnly: boolean;     // default true — full name only inside the note
  };
  theme: 'system' | 'light' | 'dark';
}

export interface ChecklistItemDef {
  id: string;         // nanoid — STABLE FOREVER. Never reuse an id.
  order: number;
  label: string;
  colorToken: string; // key into tokens.css, never a raw hex
  active: boolean;    // soft-disable; deleting would corrupt history
}

export interface SectionAlias {
  sectionId: SectionId;
  label: string;        // display name, e.g. "Penunjang"
  aliases: string[];    // e.g. ["Penunjang","Pemeriksaan Penunjang","Lab","Radiologi"]
  order: number;        // output order when composing
}

export interface Patient {
  id: string;
  ownerId: string;
  memberIds: string[];                  // [ownerId] in v1 — the sharing seam
  name: string;                         // FULL NAME (see §18)
  mrn?: string;
  age?: number;
  sex?: 'L' | 'P';
  ward?: string; bed?: string; dpjp?: string;
  diagnoses: string[];
  admittedAt: ClinicalDate;
  status: 'active' | 'archived';
  archive?: { reason: 'pulang'|'pindah'|'meninggal'|'lainnya'; note?: string; at: Timestamp };
  labels: string[];
  pinned: boolean;
  colorOverride?: string | null;
  lastEntryDate?: ClinicalDate;
  searchBlob: string;                   // lowercase name+mrn+bed+ward+dx
  createdAt: Timestamp; updatedAt: Timestamp; updatedBy: string;  // deviceId
  deletedAt: Timestamp | null;
}

/** ONE free-form page per clinical day. No section fields. */
export interface DailyEntry {
  date: ClinicalDate;                   // == doc id
  hariRawat: number;                    // denormalised at write time
  body: string;                         // markdown-lite, the whole SOAP page
  rev: number;                          // monotonic; increment() on every body write
  bodyHash: string;                     // short hash of body, for cheap change detection
  locked: boolean;                      // past days auto-lock after 48h, unlockable
  editing?: { deviceId: string; at: Timestamp } | null;  // soft presence (§7.5)
  createdAt: Timestamp; updatedAt: Timestamp; updatedBy: string;
  deletedAt: Timestamp | null;
}

export interface DailyChecklist {
  date: ClinicalDate;
  items: Record<string, { done: boolean; at: Timestamp|null; by: string|null }>;
}

export interface AppDocument {          // "Dokumen" tab
  id: string; title: string;
  category: 'jadwal_poli' | 'format' | 'lainnya' | string;
  body: string;                         // markdown-lite, same editor & copy engine
  pinned: boolean; order: number; labels: string[];
  createdAt: Timestamp; updatedAt: Timestamp; deletedAt: Timestamp | null;
}

export interface SoapTemplate {
  id: string; name: string;
  body: string;                         // full-page scaffold with tokens (§13)
  isDefault: boolean; updatedAt: Timestamp;
}

export interface CopyPreset {
  id: string; name: string;             // e.g. "Penunjang saja"
  format: 'whatsapp' | 'plain' | 'markdown';
  sections: SectionId[] | 'all';
  includeIdentity: boolean;
  includeDateHeader: boolean;
  range: 'today' | 'specific' | 'lastN' | 'all';
  lastN?: number;
}
```

### 6.3 Modelling rules
- `patientId` / `documentId` / `templateId` are **client-generated nanoids** → offline creation works instantly.
- Entry and checklist doc IDs are the **clinical date string** → idempotent upsert, no duplicate-day rows, and the daily reset becomes free (§9.2).
- Never delete a `ChecklistItemDef`; set `active: false`.
- Everything soft-deletes via `deletedAt`.

---

## 7. SYNC & CONFLICT POLICY

With one `body` field per day, field-level merge no longer saves us. This section is the compensating control. **Implement it fully; it is not optional.**

### 7.1 What still helps
- One doc **per patient per day** → different days never collide; different patients never collide.
- Checklist items remain **separate map keys** → ticking item 3 on the phone never clobbers item 5 on the iPad.

Remaining conflict surface: **the same patient's same day, edited on two devices, one of them stale.** Everything below targets exactly that.

### 7.2 Local write path
1. Keystrokes update the Zustand draft immediately. UI never blocks on network.
2. Debounce **800 ms idle**; force-flush on blur, route change, `visibilitychange`, `beforeunload`, and every 15 s of continuous typing.
3. Write: `updateDoc(entryRef, { body, rev: increment(1), bodyHash, updatedAt: serverTimestamp(), updatedBy: deviceId })`.
4. On write confirmation (`!metadata.hasPendingWrites`), persist the body to `localBase` (IndexedDB) as the **merge base** for that `(patientId, date)`.
5. Firestore's offline queue handles retry/persistence. Do not build a custom queue.

### 7.3 Three-way merge (the fundamental fix)
```ts
// domain/merge/threeWayMerge.ts
mergeBody(base: string, local: string, remote: string):
  { status: 'clean'; merged: string } | { status: 'conflict'; local: string; remote: string }
```
Algorithm:
1. If `local === remote` → clean, no-op.
2. If `local === base` → adopt `remote` (we had no changes).
3. If `remote === base` → keep `local` (they had no changes).
4. Otherwise: `patches = dmp.patch_make(base, local)`; `[merged, results] = dmp.patch_apply(patches, remote)`.
   - all `results === true` → **clean**; save `merged`, toast *"Perubahan dari perangkat lain digabungkan otomatis"*.
   - any failure → **conflict**.

On conflict, open the **"Versi berbeda terdeteksi"** dialog: side-by-side *Versi Anda* / *Versi tersimpan*, with a highlighted diff, and three actions:
- **Pakai versi saya**
- **Pakai versi tersimpan**
- **Gabungkan manual** → both bodies concatenated with a `----- versi lain (perangkat X, 14:32) -----` separator, cursor placed at the separator.

**Never auto-pick a winner on a dirty conflict.** Both versions must remain recoverable via §7.4 regardless of the choice.

### 7.4 Safety nets
- **Revision trail:** on every flush where `body` changed materially, append `{ body, at, deviceId, rev }` to `entries/{date}/revisions`. Cap **30**, prune oldest. Expose as "Riwayat perubahan" with preview + one-tap restore (restore itself creates a new revision).
- **Pre-merge snapshot:** always append a revision *before* applying a merge or a conflict resolution.
- **Soft delete only.** "Sampah" view; purge after 30 days via an explicit user action.
- **Ordering:** `serverTimestamp()` for all comparisons. Device clock is used **only** to compute the clinical date (§9.1).
- **Sync pill:** `Tersinkron` / `Menyimpan…` / `Offline — N perubahan tertunda`, driven by `metadata.hasPendingWrites` + `navigator.onLine`.

### 7.5 Soft presence lock (prevention beats resolution)
- While a body editor is focused, heartbeat `editing = { deviceId, at: serverTimestamp() }` every 30 s; clear on blur.
- If a snapshot shows `editing.deviceId !== myDeviceId` and `editing.at` is < 90 s old, show a non-blocking banner: *"Sedang diedit di perangkat lain (iPad) — perubahan akan digabungkan."*
- Never hard-block editing. This is a hint, not a lock.

### 7.6 CRDT upgrade seam (build the seam, not the CRDT)
Route **all** body reads/writes through:
```ts
export interface TextSyncAdapter {
  subscribe(path: TextPath, cb: (body: string, rev: number) => void): Unsubscribe;
  write(path: TextPath, next: string, baseRev: number): Promise<WriteResult>;
}
```
v1 ships `FirestoreBodyAdapter` + `threeWayMerge`. If true concurrent co-editing is ever needed (i.e. when sharing ships), implement `YjsAdapter` behind the same interface. **Do not implement Yjs now.**

---

## 8. SECURITY RULES

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isMember(pid) {
      return request.auth != null &&
             request.auth.uid in get(/databases/$(database)/documents/patients/$(pid)).data.memberIds;
    }

    match /patients/{pid} {
      allow read, update, delete: if request.auth != null
        && request.auth.uid in resource.data.memberIds;
      allow create: if request.auth != null
        && request.resource.data.ownerId == request.auth.uid
        && request.resource.data.memberIds == [request.auth.uid];

      match /{sub=**} {
        allow read, write: if isMember(pid);
      }
    }

    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```
- Auth: Google Sign-In + email/password. **No anonymous auth** — this holds identifiable patient data.
- Ship `firestore.indexes.json` for: `patients` where `memberIds array-contains X && status == 'active' && deletedAt == null`, ordered by `pinned desc, updatedAt desc`.
- Note the `get()` in `isMember` bills one read per subcollection rule evaluation. Acceptable at this scale; document it.

---

## 9. DOMAIN LOGIC

### 9.1 Clinical day — rollover at **00:00**

```ts
clinicalDate(now: Date, tz: string, rolloverHour: number): ClinicalDate
// = calendar date in tz, minus 1 day if localHour < rolloverHour
```
- Defaults: `timezone: "Asia/Jakarta"`, **`dayRolloverHour: 0`** (plain midnight, per user decision).
- Still implement the parameter and expose it in Settings — the logic must not hardcode midnight.
- `hariRawat = differenceInCalendarDays(date, admittedAt) + 1`.
- The patient header **always** states the active clinical day explicitly:
  `Kamis, 6 Agustus 2026 · Hari rawat ke-4`.

**Night-shift affordance (required).** Because the day flips at midnight, a resident writing at 01:30 lands on a new date. When the local clock is between `00:00` and `06:00` **and** the selected date is today **and** yesterday's entry exists:
show a dismissible inline hint above the editor —
*"Sekarang sudah tanggal 7. Menulis untuk 6 Agustus?"* with a one-tap switch to yesterday's page.
This is a hint only; it never redirects automatically.

### 9.2 Checklist "reset" — architectural, not scheduled
There is **no reset job.** The checklist doc is keyed by clinical date: a new day is a new doc ID, and a missing doc means all items unchecked. Correct across timezones, correct offline, correct on a device that slept for a week, impossible to double-fire.

```ts
getChecklist(date) => docExists ? doc.items : allUnchecked(settings.checklistItems)
```
Writes are `setDoc({ merge: true })` upserts that create the day's doc on first tick.

### 9.3 Card color from checklist state
**Rule:** the card takes the color of the **lowest-order `active` item still unchecked** — i.e. *what still needs doing*. All done → the `done` token. A manual `colorOverride` beats everything.

```ts
resolveCardColor(items, states, override) {
  if (override) return override;
  const pending = items.filter(i => i.active).sort(byOrder).find(i => !states[i.id]?.done);
  return pending ? pending.colorToken : 'done';
}
```

Default seed — **fully editable in Settings (label, order, color, add/remove; any item count, not just 7):**

| # | Item | Token | Light bg | Accent |
|---|---|---|---|---|
| 1 | Visite pasien + TTV + EKG sesuai kebutuhan | `step-1` | `#FEE2E2` | `#DC2626` |
| 2 | Update SOAP | `step-2` | `#FFEDD5` | `#EA580C` |
| 3 | Kirim ke Chief | `step-3` | `#FEF9C3` | `#CA8A04` |
| 4 | SOAP dikoreksi | `step-4` | `#ECFCCB` | `#65A30D` |
| 5 | Lapor DPJP | `step-5` | `#CCFBF1` | `#0D9488` |
| 6 | Input SIMGOS | `step-6` | `#DBEAFE` | `#2563EB` |
| 7 | Plan & terapi dilaksanakan | `step-7` | `#EDE9FE` | `#7C3AED` |
| ✓ | Semua selesai | `done` | `#DCFCE7` | `#16A34A` |

Ship a **palette of 12 tokens** so added items get distinct colors. Provide dark-mode variants for every token.

**Accessibility:** color is never the only signal. Every card also renders an **N-segment progress strip** (N = active item count) plus a chip with the pending item's short label.

---

## 10. FEATURE SPECS & ACCEPTANCE CRITERIA

### F1 — Auth & tenancy
Google + email/password; persistent session; sign-out clears local cache and `localBase`.
**AC:** Two accounts in the same browser profile never see each other's patients, including after an offline period.

### F2 — Board (tab "Aktif")
- Google-Keep-style **masonry** grid; 1 col (phone) / 2–3 (tablet) / 4–6 (desktop).
- Card renders: title (initials or full name per `boardShowInitialsOnly` + bed), `Hari rawat ke-N`, **first 3–4 lines of today's body** as preview (fallback: most recent day's body), label chips, pin, N-segment progress strip, relative `updatedAt`, background = §9.3 color.
- Order: pinned first, then `updatedAt desc`.
- Instant client-side search over `searchBlob`. Filter chips: ward, label, and per-checklist-item "belum …" filters generated from `checklistItems`.
**AC:** Ticking a checklist item recolors the card on all devices within ~1 s online, instantly offline.

### F3 — Create patient
FAB → sheet: Nama*, No. RM, Umur, JK, Ruang, Bed, DPJP, Diagnosis (chips), Tanggal masuk (default = today's clinical date), Label. Optionally seed today's body from the default template.
**AC:** Creating a patient in airplane mode succeeds, appears instantly, syncs on reconnect, no duplicate.

### F4 — Patient detail & the daily page ⭐ (changed)
- Header: identity strip, active clinical date, `Hari rawat ke-N`, status, archive.
- **Day navigation:** horizontal date rail (newest right, today auto-selected) + `‹ ›` + date picker. Days with content are marked.
- **Body editor:** a single auto-growing `<textarea>` filling the page. No section boxes. No forced structure. Monospace-optional, generous line-height, `spellcheck` on, `autocapitalize="sentences"`.
- **Formatting toolbar** (compact, above keyboard on mobile): Bold, Italic, Bullet, and **"Sisipkan bagian"** → inserts a recognised header line (`Penunjang:`) at the cursor. This is how the user opts into parseable structure without being forced into it.
- **Detected-section gutter:** parsed headers (§12.1) get a subtle left-gutter marker with a copy icon rendered as an **overlay**. It must never alter the text.
- Autosave per §7.2; microcopy "Tersimpan" — no save button.
- **Carry forward:** opening a date with no entry offers *"Salin dari hari sebelumnya"* (default ON). It copies the **whole body**, then blanks the *content* of sections listed in `carryForwardClearSections` (default `S` and `Penunjang`) while keeping their headers. Show a one-line summary of what was cleared. If the body has no detected sections, copy it verbatim and warn: *"Periksa kembali data lama (lab/keluhan)."*
- Past entries auto-lock after 48 h; unlock is one tap and is recorded in `revisions`.
**AC:** Same-day edits from two devices with one offline either auto-merge cleanly or raise the conflict dialog — never silently drop text.

### F5 — Daily checklist
- Rendered at the top of the patient page as tappable pills in each item's color; targets ≥44 px; wraps to multiple rows for N > 7.
- Long-press shows who ticked it and when.
- Tickable from the board card too (long-press → quick checklist sheet) so rounds don't require opening the note.
**AC:** At midnight (local tz) all patients show unchecked with no background job and no network.

### F6 — Copy / export — see §12.

### F7 — Archive
Archive asks reason: **Pulang / Pindah / Meninggal / Lainnya** (+ note). Archived patients leave the board and appear in "Arsip", grouped by month, searchable, read-only with "Buka kembali".
**AC:** Archiving never deletes entries; all daily pages remain readable and copyable.

### F8 — Documents tab
Free-form notes for `jadwal poli`, `format lain`, etc. Category chips; pinned first; **same editor, same parser, same copy engine** as SOAP.

### F9 — Settings
Checklist editor (label / drag order / color / add / disable), section alias editor (§12.1), timezone + rollover hour, carry-forward toggles, copy presets, privacy block (PIN, auto-lock, blur, initials-on-board), theme, JSON export, sign out. Footer: `© Avicenna` + version.

### F10 — Search
Client-side, offline, over active + archived. Debounced 150 ms. Matches name, RM, bed, ward, diagnosis, and body text of the last 7 days.

### F11 — Trash
Soft-deleted patients / entries / documents; restore; "Kosongkan sampah" behind a typed confirmation.

---

## 11. UI SPEC

### 11.1 Shell
- **Bottom tab bar on phone**, left rail on tablet/desktop: `Aktif · Arsip · Dokumen · Pengaturan`.
- Top bar: search, sync pill, avatar.
- **Footer on every page:** `© Avicenna` · `v{APP_VERSION}` — small, subtle, always present in Settings and at the bottom of the board scroll.

### 11.2 Breakpoints
| Device | Layout |
|---|---|
| Phone < 640 | 1 column; full-screen patient page; bottom sheets; FAB bottom-right |
| Tablet 640–1024 | 2–3 columns; **iPad landscape = split view** (list 38% / page 62%) |
| Desktop > 1024 | 4–6 columns; patient page opens as a wide modal over a dimmed board (Keep-like); `Esc` closes |

### 11.3 Interaction
- Touch targets ≥ 44×44 px; primary actions thumb-reachable.
- Swipe left on a card (phone) → quick archive, with undo toast.
- Long-press card → quick checklist sheet.
- Keyboard (desktop): `/` search · `n` new patient · `c` copy sheet · `←/→` day nav · `Esc` close · `Cmd/Ctrl+B` bold · `Cmd/Ctrl+I` italic.
- Destructive actions get a **7 s undo toast**, not a confirm dialog — except purge.

### 11.4 Visual
Neutral clinical base (white / `#0B0F14` dark); color signal belongs to the checklist alone. System font stack. Generous line-height in the body (read at speed under fluorescent light). Respect `prefers-reduced-motion`. **Dark mode is a hard requirement** (night shifts).

---

## 12. PARSER + FORMATTER SPEC ⭐ (the key redesign)

The note body is one free string. Section-selective copy is therefore a **read-only parse**, never a schema.

### 12.1 Section parser — `parseSections(body, aliases)`

**Header detection.** A line is a section header if, after trimming, it matches:
```
^[\s>*_#-]{0,4}(ALIAS)\s*[:.\)]\s*(.*)$
```
where `ALIAS` is any alias from `settings.sectionAliases`, matched **case-insensitively as a whole token**. Text after the delimiter on the same line belongs to that section.

**Default aliases (user-editable in Settings):**

| sectionId | label | aliases |
|---|---|---|
| `s` | Subjektif | S, Subjektif, Subjective, Keluhan |
| `o` | Objektif | O, Objektif, Objective, Status Generalis |
| `ttv` | TTV | TTV, TD/N/RR/S, Vital Sign, VS, Tanda Vital |
| `penunjang` | Penunjang | Penunjang, Pemeriksaan Penunjang, Lab, Laboratorium, Radiologi, EKG |
| `a` | Assessment | A, Assessment, Asesmen, Diagnosis Kerja |
| `p` | Plan | P, Plan, Planning, Rencana |
| `terapi` | Terapi | Terapi, Tx, Th/, Medikamentosa, Obat |

**Output:**
```ts
interface ParsedSection {
  sectionId: SectionId;   // '_intro' for text before the first header
  label: string;
  headerLine: string | null;
  start: number; end: number;  // char offsets into body
  text: string;                // content WITHOUT the header line
}
parseSections(body, aliases): ParsedSection[]
```

**Invariants (assert in tests):**
- `sections.map(s => body.slice(s.start, s.end)).join('') === body` — the parse is lossless and total.
- The parser **never mutates, normalises, or reorders** the body.
- Zero headers detected → a single `_intro` section labelled "Catatan".
- Repeated headers (`Penunjang:` twice in one day) → merged into one `sectionId` in output order, both ranges retained.
- Unknown headers (`Konsul:`) → a `custom_<slug>` section, offered in the copy UI automatically. **Never discard text.**

### 12.2 Canonical inline format — markdown-lite
Store *only* this. Never store WhatsApp or SIMGOS output.

| Meaning | Stored as |
|---|---|
| bold | `**teks**` |
| italic | `_teks_` |
| strikethrough | `~~teks~~` |
| bullet | `- ` line prefix |
| numbered | `1. ` line prefix |

> **Rationale (put this in a code comment):** WhatsApp uses `*bold*`, Markdown uses `*italic*`. Storing WA syntax makes every future export a regex minefield and corrupts on round-trip. One canonical model, N pure formatters.

### 12.3 Formatters — pure, unit-tested
```ts
toWhatsApp(doc: ComposedDoc): string
toPlain(doc: ComposedDoc): string   // SIMGOS
toMarkdown(doc: ComposedDoc): string
```
**`toWhatsApp`** — `**x**`→`*x*`; `_x_`→`_x_`; `~~x~~`→`~x~`; section headers emitted as `*PENUNJANG*` on their own line; bullets → `• `; max one blank line between blocks; trim trailing whitespace.

**`toPlain` (SIMGOS)** — strip **all** of `* _ ~ \` #`; headers → `PENUNJANG:` uppercase; bullets → `- `; collapse ≥2 blank lines to 1; normalise `\r\n`→`\n`; strip emoji; ASCII-safe.
**AC:** assert `toPlain` output matches `/^[^*_~`#]*$/s` in a unit test.

### 12.4 Composer
```ts
compose({ patient, entries, sections, range, includeIdentity, includeDateHeader, includeChecklist }): ComposedDoc
```
- Identity header (optional): `Tn. A / 45th / RM 123456 / Melati 3B / DPJP: dr. X`
- Date header (optional): `SOAP — Kamis, 6 Agustus 2026 (Hari rawat ke-4)`
- `sections: 'all'` → emit the body **verbatim** (only inline-format conversion applied). This is the default and must be byte-faithful to what the user typed.
- A section subset → emit only those parsed ranges, in `sectionAliases` order, skipping empties.
- Multi-day ranges → one block per day, separated by a rule.

### 12.5 Copy UI
- **Per-section quick copy:** gutter copy icon next to each detected header → copies that section in the last-used format. Toast: `Penunjang disalin (WhatsApp)`. One tap — this is the answer to "copy only Penunjang".
- **Full sheet:** Format (WhatsApp / SIMGOS / Markdown) → Rentang (Hari ini / Tanggal tertentu / 3 hari terakhir / Semua) → Bagian (auto-listed from the parse, multi-select, + "Seluruh catatan") → Opsi (identitas, tanggal, status checklist) → **live preview** → `Salin` + `Bagikan` (Web Share API).
- **Presets** as one-tap chips. Seed two: `WA ke Chief` (whole note, WhatsApp, identity on) and `SIMGOS` (whole note, plain, identity off).

### 12.6 Clipboard notes (iOS will bite you)
- Call `navigator.clipboard.writeText()` **synchronously inside the gesture handler**; pre-compute the string when the sheet opens. Do not `await` before the call on iOS Safari.
- Fallback: hidden `<textarea>` + `document.execCommand('copy')`. Requires HTTPS.
- Always confirm with a toast — silent clipboard failure is unacceptable here.

---

## 13. TEMPLATES (schema now, UI later)
- `SoapTemplate.body` is a **full-page scaffold string** (headers + blank lines), matching the free-form model.
- Tokens: `{{nama}} {{umur}} {{jk}} {{rm}} {{bed}} {{ruang}} {{dpjp}} {{dx}} {{tanggal}} {{hari_rawat}}`.
- Minimal UI: "Gunakan template" on an empty day; template manager is a later phase.
- Seed exactly one built-in default containing only header lines. **Do not invent clinical content** — the user will author templates later.

---

## 14. DOCUMENTS TAB
- Seed categories: `Jadwal Poli`, `Format Lain`, `Lainnya`; user can add more.
- Identical editor, parser, and copy engine as SOAP.
**AC:** A document copies to WhatsApp format with formatting preserved, identically to a patient note.

---

## 15. SETTINGS — see F9. Additional rules
- Renaming a checklist item updates it everywhere retroactively (lookup is by `id`, never stored per-day).
- Reordering changes card colors immediately; show a live swatch preview row.
- **Any item count must work** — N items → N-segment progress strip, N palette colors, N filter chips. Do not hardcode 7 anywhere.
- Editing section aliases re-parses all bodies on the fly (parse is derived, so no data migration is possible or needed).

---

## 16. VERSIONING PROTOCOL (mandatory)

```js
// src/version.js — the ONLY place a version string may exist
export const APP_VERSION = '2026-08-06.1';   // YYYY-MM-DD.N
export const CACHE_NAME  = `visite-${APP_VERSION}`;
```
- Every consumer **imports** it. Zero hardcoded duplicates.
- Bump `APP_VERSION` **in the same edit** as any shipping change (JS, CSS, cache-relevant asset). `N` increments for same-day builds.
- Service-worker cache name derives from `CACHE_NAME`; old caches deleted on `activate`.
- Version displayed in the footer next to `© Avicenna`.
- **Before declaring any task complete:** confirm the bump, then run
  `grep -rn "20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]\.[0-9]" src/ public/ --exclude=version.js`
  and report that it returned nothing.

---

## 17. PWA / OFFLINE
- `vite-plugin-pwa` with `injectManifest`; precache the app shell; `CacheFirst` for fonts/icons.
- Manifest: name `Visite`, `display: standalone`, maskable 192/512 icons, theme color matching the shell.
- iOS: `apple-touch-icon`, `apple-mobile-web-app-capable`, `viewport-fit=cover`, safe-area insets for the bottom tab bar.
- **Update flow:** on a new SW `waiting`, show *"Versi baru tersedia — Muat ulang"*. **Never auto-reload while the editor is dirty.**
- **iOS storage caveat:** Safari evicts IndexedDB after ~7 days of non-use for browser tabs; installed home-screen PWAs are exempt. Show a first-visit iOS prompt: *"Tambahkan ke Layar Utama"* with a one-line reason.
- The app must fully boot and render cached patients with the network disabled.

---

## 18. PRIVACY & SAFETY — full patient names are stored, so this tightens

| Control | v1 |
|---|---|
| Transport / at rest | TLS + Firestore encryption at rest |
| Access | Firestore rules, `memberIds`-scoped (§8) |
| App lock | 4–6 digit PIN, **enabled by default**, auto-lock after 3 min and on `visibilitychange` |
| Shoulder surfing | Blur/obscure content when backgrounded (default on) |
| Board display | **Initials + bed by default** (`boardShowInitialsOnly: true`); full name only inside the note |
| Analytics | **None.** No third-party scripts. No error reporter that ships note text. |
| Logging | Never `console.log` bodies, names, or MRNs in production builds |
| Export | JSON export is user-initiated and local-only |
| Legal | First-run notice: the user is responsible for compliance with hospital policy and **UU PDP No. 27/2022** |

**Roadmap (do not build now):** field-level E2EE for `name`/`mrn` using a passphrase-derived key. Cost: server-side search on those fields becomes impossible. Revisit if sharing ships.

---

## 19. BUILD PHASES

One phase per response. State the version bump each time.

| Phase | Deliverable | Done when |
|---|---|---|
| **P0** | Scaffold, TS strict, Tailwind, `version.js`, tokens.css, PWA shell, footer `© Avicenna` + version | `npm run build` clean; installable; offline shell loads |
| **P1** | Firebase init, Auth, rules, repositories, `deviceId`, `localBase` (IndexedDB), sync pill | Sign in; write offline; reconnect; data persists |
| **P2** | `clinicalDate.ts` + `checklist.ts` + unit tests | Midnight rollover, tz correctness, and color resolution pass for N = 3, 7, 12 items |
| **P3** | `parseSections.ts` + alias config + unit tests | Losslessness invariant holds; unknown/duplicate/no headers all pass |
| **P4** | Board: masonry cards, colors, progress strip, preview text, search, filters, FAB, create sheet | Cards render and recolor live across two browsers |
| **P5** | Patient page: date rail, full-page body editor, toolbar, autosave, carry-forward, lock | Typing on two devices on *different* days is conflict-free |
| **P6** | `threeWayMerge.ts` + conflict dialog + revision trail + restore + soft presence | Forced stale-edit auto-merges when disjoint; raises the dialog when overlapping; nothing is ever lost |
| **P7** | Checklist UI (page + quick sheet from card) | Works offline; new clinical day starts clean |
| **P8** | Formatters + composer + copy sheet + gutter quick-copy + presets | `toPlain` regex assertion passes; iOS standalone copy verified |
| **P9** | Archive + Arsip tab + Trash | Archiving preserves every daily page |
| **P10** | Documents tab | Copy behaves identically to SOAP |
| **P11** | Settings: checklist editor, alias editor, rollover, privacy block, PIN lock, JSON export | Renaming a checklist item relabels history retroactively |
| **P12** | Templates schema + picker | Tokens interpolate into a full-page scaffold |
| **P13** | Polish: dark mode, a11y, shortcuts, iPad split view, update toast | §20 fully green |

---

## 20. DEFINITION OF DONE

**Data integrity**
- [ ] Airplane-mode create/edit/tick → reconnect → no loss, no duplicates
- [ ] Disjoint same-day edits on two devices auto-merge with no dialog
- [ ] Overlapping same-day edits raise the conflict dialog; both versions recoverable from revisions
- [ ] Revision restore returns the exact prior body
- [ ] No hard deletes reachable from the UI

**Parser**
- [ ] Losslessness invariant asserted
- [ ] No-header, duplicate-header, and unknown-header bodies all copy correctly
- [ ] Editing a body never triggers a parser-side rewrite (assert body byte-equality across a parse cycle)

**Clinical correctness**
- [ ] Rollover at 00:00 Asia/Jakarta; a 23:59 note and a 00:01 note land on different days
- [ ] The 00:00–06:00 "menulis untuk kemarin?" hint appears and never auto-redirects
- [ ] Checklist unchecked at midnight with no network and no timer
- [ ] `hari rawat` correct across month and year boundaries
- [ ] Carry-forward clears S and Penunjang content but keeps headers

**Output**
- [ ] WhatsApp paste renders bold/italic correctly in iOS and Android WhatsApp
- [ ] SIMGOS output contains none of `* _ ~ \` #`
- [ ] Section-only copy is one tap
- [ ] "Seluruh catatan" copy is byte-faithful apart from inline-format conversion
- [ ] Copy works inside the iOS standalone PWA

**Platform**
- [ ] Phone / iPad (portrait + landscape split) / laptop verified
- [ ] Installs to iOS home screen; boots offline
- [ ] Dark mode complete; contrast ≥ 4.5:1 on every card color
- [ ] Keyboard navigable; visible focus rings

**Privacy**
- [ ] PIN lock on by default; auto-lock fires; content blurs on background
- [ ] Board shows initials by default
- [ ] No note text, name, or MRN in any production log

**Hygiene**
- [ ] `APP_VERSION` bumped; grep confirms no hardcoded versions
- [ ] Footer shows `© Avicenna` + version
- [ ] Zero TS errors; zero console errors on cold boot

---

## APPENDIX A — Checklist seed (ship exactly; user-editable, any count)

```ts
export const DEFAULT_CHECKLIST: ChecklistItemDef[] = [
  { id: 'c1', order: 1, label: 'Visite pasien + TTV + EKG sesuai kebutuhan', colorToken: 'step-1', active: true },
  { id: 'c2', order: 2, label: 'Update SOAP',                                colorToken: 'step-2', active: true },
  { id: 'c3', order: 3, label: 'Kirim ke Chief',                             colorToken: 'step-3', active: true },
  { id: 'c4', order: 4, label: 'SOAP dikoreksi',                             colorToken: 'step-4', active: true },
  { id: 'c5', order: 5, label: 'Lapor DPJP',                                 colorToken: 'step-5', active: true },
  { id: 'c6', order: 6, label: 'Input SIMGOS',                               colorToken: 'step-6', active: true },
  { id: 'c7', order: 7, label: 'Plan & terapi dilaksanakan',                 colorToken: 'step-7', active: true },
];
```

## APPENDIX B — WhatsApp formatting cheat sheet

| Style | WhatsApp | Markdown-lite (stored) |
|---|---|---|
| Bold | `*teks*` | `**teks**` |
| Italic | `_teks_` | `_teks_` |
| Strikethrough | `~teks~` | `~~teks~~` |
| Monospace | ` ```teks``` ` | `` `teks` `` |
| Headings | unsupported → emit bold | composer-generated |

## APPENDIX C — Assumptions (flag before P5 if wrong)

1. **One free-form page per clinical day.** No section input fields. Structure is optional and detected.
2. **Rollover at 00:00 Asia/Jakarta**, with a 00:00–06:00 "write for yesterday?" hint.
3. **Card color = lowest-order unchecked item.** All done → green.
4. **Patients are top-level with `memberIds`**; isolation in v1, sharing without migration later.
5. **Full patient names stored** → PIN lock on by default, initials on the board by default.
6. **Checklist is fully user-editable**, any count; nothing hardcodes 7.
7. UI in Bahasa Indonesia; code in English.
