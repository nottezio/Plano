import type { SectionId } from '../types';

/**
 * A faint background per part of the note, so you can see where you are while
 * scrolling without reading a word.
 *
 * Six bands, not one per section: the note has a dozen headings but only a
 * handful of *parts*, and colouring every heading differently would produce a
 * stripe pattern that carries no meaning. Investigations sit with O because
 * that is where they are read.
 *
 * The values are tokens, so each has a light and a dark variant. A tint that
 * works on white is invisible on the night-shift background, and one bright
 * enough for both would compete with the text — which is the failure mode to
 * avoid, since this is meant to be seen only when you are not reading.
 */
export type SectionTint =
  | 'identitas'
  | 's'
  | 'o'
  | 'a'
  | 'terapi'
  | 'ts'
  | null;

/**
 * Matched at WORD START, never as a bare substring.
 *
 * `includes('plan')` matched `Im-plan-tasi`, so a real note's
 * `*Laporan Implantasi PPM (04-09-2026)*` was tinted as therapy. That was two
 * bugs in one, and the second was the expensive one: the bands mark only the
 * FIRST heading of each kind, so the Laporan line — which sits above the
 * assessment — CLAIMED the therapy colour, and the actual
 * `*Mohon izin kami terapi dengan:*` and `*Plan:*` headings below it were
 * left plain. A stray substring match upstream silently switched off the
 * tint on the two sections that matter most.
 *
 * Word START rather than whole word, because these are stems: `diagnos` has
 * to reach `diagnosis` and `diagnosa`, `monitor` has to reach `monitoring`,
 * `angiograf` has to reach `angiografi`. What they must NOT do is match in
 * the middle of an unrelated word, and that is exactly what `\b` prevents.
 */
const KEYWORDS: Array<[SectionTint, readonly string[]]> = [
  ['ts', ['ts', 'konsul', 'balasan']],
  ['a', ['assess', 'diagnos', 'problem', 'masalah']],
  ['terapi', ['terapi', 'obat', 'plan', 'rencana', 'monitor', 'edukasi']],
  [
    'o',
    [
      'ekg', 'lab', 'penunjang', 'foto', 'thorax', 'echo', 'ct', 'mri', 'usg',
      'rontgen', 'angiograf', 'laporan', 'pemeriksaan', 'objektif', 'ttv',
      'tanda vital', 'lus',
    ],
  ],
  ['s', ['keluhan', 'subjektif', 'anamnesis']],
];

/**
 * `_intro` is the greeting, location, identity and DPJP lines — the block that
 * says who this is. It gets its own band because it is the one part you look
 * at to confirm you are in the right note.
 */
export function tintFor(sectionId: SectionId, label: string): SectionTint {
  if (sectionId === '_intro') return 'identitas';
  if (sectionId === 's') return 's';
  if (sectionId === 'o' || sectionId === 'ttv' || sectionId === 'penunjang') return 'o';
  if (sectionId === 'a') return 'a';
  if (sectionId === 'p' || sectionId === 'terapi') return 'terapi';

  const haystack = `${sectionId} ${label}`.toLowerCase();
  for (const [tint, words] of KEYWORDS) {
    if (words.some((word) => startsWord(haystack, word))) return tint;
  }

  // Unrecognised headings get no tint rather than a guessed one: a wrong band
  // is worse than a plain one, because the bands are read without thinking.
  return null;
}

/**
 * Does `stem` begin a word anywhere in `haystack`?
 *
 * Built as a regex per call rather than precompiled: the list is a dozen short
 * literals, this runs once per heading, and a lazily-built cache would be more
 * code than the thing it saves. `_` is excluded from the boundary because
 * section ids are snake_case — `custom_laporan_implantasi` has to let
 * `laporan` match.
 */
function startsWord(haystack: string, stem: string): boolean {
  const index = haystack.indexOf(stem);
  if (index < 0) return false;
  for (let at = index; at >= 0; at = haystack.indexOf(stem, at + 1)) {
    const before = at === 0 ? '' : haystack[at - 1]!;
    if (!/[a-z0-9]/.test(before)) return true;
  }
  return false;
}

export const TINT_VAR: Record<Exclude<SectionTint, null>, string> = {
  identitas: 'var(--sec-identitas)',
  s: 'var(--sec-s)',
  o: 'var(--sec-o)',
  a: 'var(--sec-a)',
  terapi: 'var(--sec-terapi)',
  ts: 'var(--sec-ts)',
};
