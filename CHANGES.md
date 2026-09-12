# Plano — CHANGES

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
