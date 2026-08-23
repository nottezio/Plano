# Plano — update `2026-08-23.2`

**15 changed files.** Includes `2026-08-23.1` if you have not uploaded it.
Nothing to delete.

---

## 1. The CVCU → bangsal reformatter, third attempt

Your before/after pair was what it needed. The first version reordered by
guesswork and broke notes; the second only unwrapped headers, which was safe and
did too little — its output still read as a CVCU note.

**What was missing: the vitals are buried mid-sentence.**

```
Circulation: TD 121/84 mmHg, nadi 80 x/menit reguler, BJ I/II murni reguler, ...
```

Unwrapping `Circulation:` leaves that whole sentence intact. It now splits on
commas and classifies each fragment, so the vitals lift out and the examination
findings stay behind:

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

Investigations move below and each gets a `*…*` heading. The bare `EKG` label
that only introduced the block is dropped, since every block now carries its
own.

Values keep their qualifiers — `80 x/menit reguler` stays `reguler` — because
the fragment is moved rather than rewritten.

**Nothing is discarded.** Fragments matching nothing go under `Lain-lain:` and
are counted in the preview, so a wrong guess is visible before you apply it.

Two bugs my own tests caught while building it: `SpO₂` never matched, because
the subscript is not a word character so `\b` after it never holds; and the
first draft dropped `akral hangat` into the wrong bucket.

## 2. Two optional formatting actions

Both on the toolbar, both **actions rather than automatic**. Applying either on
paste would edit text the moment it arrives, and the one time it guessed wrong
there would be no way to tell what the original said.

- **`Aa*`** — restores `*bold*` on headings and `_italic_` on DPJP and referral
  lines that a plain-text paste stripped. Never touches a line that already has
  a marker, so running it twice changes nothing.
- **`•→-`** — turns the iPhone bullet into a hyphen. Line starts only; a `•`
  mid-sentence is never list syntax.

## 3. From `2026-08-23.1`

Templates: `Pasien baru (admisi)` and `Konsul rawat bersama` removed; KJS and
poli replaced from your reports; `Pasien perpindahan` added; the primer/sekunder
split confined to the AHN template, with a test asserting exactly one template
carries it.

Patient page opens the most recent day that **has** a note rather than a blank
today. Lab extractor reachable from the board. `Ambil dari catatan hari ini` in
the identity sheet. Scrollbars in the app's own colours.

## Still open

**Lab extraction format**, against the three PDFs you sent. Worth doing against
real parser output rather than by eye, and I would rather do it in its own pass
than rush it into this one.

## Verification

```
612 tests passed  (+8)
check:version   OK
check:contrast  All card colours meet 4.5:1
check:a11y      62 components
build           clean
```
