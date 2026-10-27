import { regionsOf, withoutHeader } from './format/sectionSlices';
import type { CopyGroupId } from './format/copyGroups';
import { penunjangBlocks } from './penunjang';
import type { SectionAlias } from './types';

/**
 * Visite mode: the bedside cheat sheet the resident reads while presenting a
 * patient to the DPJP (Avi, 2026-10-28).
 *
 * Every line is a slice of the note, never rewritten (SPEC 1.5): this picks
 * WHICH lines, not what they say. Two existing readers do the picking, so the
 * summary can never disagree with the rest of the app:
 *  - `regionsOf` (Salin's boundary rule) for the assessment, terapi and plan;
 *  - `penunjangBlocks` ("penunjang terbaru saja") for the newest dated
 *    EKG / lab / thorax / echo / laporan block.
 */

export type VisiteSectionId = 'diagnosis' | 'ekg' | 'lab' | 'thorax' | 'tindakan' | 'echo' | 'terapi' | 'plan';

export interface VisiteSection {
  id: VisiteSectionId;
  title: string;
  /** ISO date of the block it came from; null for A / Terapi / Plan. */
  date: string | null;
  lines: string[];
}

export interface VisiteSummary {
  sections: VisiteSection[];
  /** Titles of the sections the note did not have, for the "Tidak ada" footer. */
  missing: string[];
}

export const VISITE_TITLES: Record<VisiteSectionId, string> = {
  diagnosis: 'Diagnosis',
  ekg: 'EKG terbaru',
  lab: 'Lab terbaru',
  thorax: 'Foto thorax terbaru',
  tindakan: 'Laporan tindakan terbaru',
  echo: 'Echo',
  terapi: 'Terapi',
  plan: 'Plan',
};

const ORDER: readonly VisiteSectionId[] = ['diagnosis', 'ekg', 'lab', 'thorax', 'tindakan', 'echo', 'terapi', 'plan'];
/** `regionsOf` files a TS block under Terapi; it is the consultant's, not ours. */
const CONSULT = /^\s*[*_]*\s*TS\b/i;

function linesOf(text: string): string[] {
  return text.split('\n').map((line) => line.trimEnd()).filter((line) => line.trim());
}

/** Our own block of a Salin group. For A the LAST one: an early "Diagnosis:" is a summary, "Mohon izin kami assess" is the assessment. */
function ownGroup(body: string, aliases: readonly SectionAlias[], group: CopyGroupId): string[] {
  const own = regionsOf(body, aliases).filter(
    (region) => region.group === group && !CONSULT.test(body.slice(region.start, region.end)),
  );
  const region = group === 'a' ? own.at(-1) : own[0];
  if (!region) return [];
  const text = withoutHeader(body.slice(region.start, region.end).trimEnd());
  return group === 'a' ? diagnosisLines(text) : linesOf(text);
}

const LIST_ITEM = /^\s*([-*•⁃]|\d+[.)])\s*\S/;

/**
 * The diagnosis list only. In the new-patient format "Diagnosis:" sits near the
 * top and nothing closes it, so its region ran on through TB/BB, the labs and a
 * whole CA report (up to 44 lines in the export). It ends at the first blank
 * line, or at the first non-list line once the list has started.
 */
function diagnosisLines(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) {
      if (out.length > 0) break;
      continue;
    }
    if (out.length > 0 && LIST_ITEM.test(out[0]!) && !LIST_ITEM.test(line)) break;
    out.push(line.trimEnd());
  }
  return out;
}

/** The conclusion of an echo: its Conclusion/Kesimpulan lines, else the EF line, else the first two. */
function echoLines(lines: string[]): string[] {
  const at = lines.findIndex((line) => /^[\s*_-]*(conclusion|kesimpulan)\b/i.test(line));
  if (at >= 0) {
    const inline = lines[at]!.replace(/^[\s*_-]*(conclusion|kesimpulan)\s*:?\s*/i, '');
    const after = lines.slice(at + 1);
    if (inline || after.length > 0) return inline ? [lines[at]!, ...after] : after;
  }
  const ef = lines.filter((line) => /\bEF\b/i.test(line));
  return ef.length > 0 ? ef : lines.slice(0, 2);
}

export function visiteSummary(body: string, aliases: readonly SectionAlias[]): VisiteSummary {
  const blocks = penunjangBlocks(body, aliases).map((block) => ({
    ...block,
    // The heading carries the date, which the view shows on its own.
    lines: linesOf(body.slice(block.start, block.end)).slice(1),
  }));
  /** Newest by date; on a tie, the first one written. */
  const newest = (match: (kind: string) => boolean) =>
    blocks.filter((block) => match(block.kind)).reduce<(typeof blocks)[number] | null>(
      (best, block) => (!best || block.date > best.date ? block : best),
      null,
    );

  const lab = newest((kind) => kind === 'lab');
  const found: Record<VisiteSectionId, { date: string | null; lines: string[] } | null> = {
    diagnosis: { date: null, lines: ownGroup(body, aliases, 'a') },
    ekg: newest((kind) => kind === 'ekg'),
    lab: lab && {
      date: lab.date,
      lines: blocks.filter((block) => block.kind === 'lab' && block.date === lab.date).flatMap((block) => block.lines),
    },
    thorax: newest((kind) => kind === 'thorax'),
    tindakan: newest((kind) => kind.startsWith('laporan')),
    echo: (() => {
      const echo = newest((kind) => kind === 'echo');
      return echo && { date: echo.date, lines: echoLines(echo.lines) };
    })(),
    terapi: { date: null, lines: ownGroup(body, aliases, 'terapi') },
    plan: { date: null, lines: ownGroup(body, aliases, 'plan') },
  };

  const sections: VisiteSection[] = [];
  const missing: string[] = [];
  for (const id of ORDER) {
    const hit = found[id];
    if (hit && hit.lines.length > 0) sections.push({ id, title: VISITE_TITLES[id], date: hit.date, lines: hit.lines });
    else missing.push(VISITE_TITLES[id]);
  }
  return { sections, missing };
}
