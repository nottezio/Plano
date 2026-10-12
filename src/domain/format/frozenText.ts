import { SELESAI_HEADING } from './insertTerapi';
import { parseSections } from '@/domain/sections/parseSections';
import type { SectionAlias } from '@/domain/types';

/**
 * The parts of a note that are not OURS to keep current (12.12, Avi).
 *
 * ROOT CAUSE of the "3 hitungan hari belum berubah" on a note where only one
 * counter was ours: the day-counter check treated every "H-n" in the note as
 * a running count to advance. Two kinds of text are frozen by design:
 *
 *  - FINISHED THERAPY — the "Selesai :" sub-list (up to its first blank line)
 *    and any line that stops the drug ("--> STOP", "aff"): "Ceftriaxone (H-3)"
 *    there is how long it RAN, and it must never become H-4.
 *  - CONSULTANTS' BLOCKS — "*TS Divisi Aritmia*", "TS HOM" …: pasted verbatim
 *    from the consulting team's own SOAP. Their "Post PPM Replacement H-3" is
 *    their count, on their day; we copy it, we do not edit it.
 *
 * A TS block runs from its heading until the next of our own S/O/A/Terapi
 * headings, or the end of the note. Its own A/, P/, I/ and "Plan …" lines stay
 * inside it.
 */
export interface FrozenRange {
  start: number;
  end: number;
  why: 'selesai' | 'stop' | 'ts';
}

const TS_HEADING = /^TS\s+\S/i;
const OURS = new Set(['s', 'o', 'a', 'terapi']);
const STOPPED = /(?:-->|->|→)\s*stop\b|\b(?:stop|aff|dihentikan|hentikan)\b/i;

export function frozenRanges(body: string, aliases?: readonly SectionAlias[]): FrozenRange[] {
  const ranges: FrozenRange[] = [];

  let offset = 0;
  let selesaiFrom = -1;
  for (const line of body.split('\n')) {
    const end = offset + line.length;
    if (SELESAI_HEADING.test(line)) selesaiFrom = offset;
    else if (selesaiFrom >= 0 && !line.trim()) {
      ranges.push({ start: selesaiFrom, end: offset, why: 'selesai' });
      selesaiFrom = -1;
    }
    if (STOPPED.test(line)) ranges.push({ start: offset, end, why: 'stop' });
    offset = end + 1;
  }
  if (selesaiFrom >= 0) ranges.push({ start: selesaiFrom, end: body.length, why: 'selesai' });

  const sections = parseSections(body, aliases);
  let tsFrom = -1;
  for (const section of sections) {
    const heading = (section.headerLine ?? '').replace(/[*_~:]/g, '').trim();
    if (section.ownsLine && TS_HEADING.test(heading)) {
      if (tsFrom < 0) tsFrom = section.start;
    } else if (tsFrom >= 0 && section.ownsLine && OURS.has(section.sectionId)) {
      ranges.push({ start: tsFrom, end: section.start, why: 'ts' });
      tsFrom = -1;
    }
  }
  if (tsFrom >= 0) ranges.push({ start: tsFrom, end: body.length, why: 'ts' });

  return ranges;
}

export function isFrozen(ranges: readonly FrozenRange[], at: number): boolean {
  return ranges.some((range) => at >= range.start && at < range.end);
}
