import { parseSections } from '../sections/parseSections';
import { penunjangBlocks } from '../penunjang';
import type { SectionAlias } from '../types';
import { insertIntoObjective } from './parseLab';

/**
 * Where a new lab block goes, and why.
 *
 * ROOT CAUSE (2026-10-05, Avi). `insertIntoObjective` put the block at the
 * END of the investigation stack. The ward stack is newest-first — today's
 * lab above yesterday's, the EKGs above the labs — so every inserted lab
 * landed at the bottom, under results days older, and had to be cut and
 * moved by hand.
 *
 * The rule now, in order (Avi, 2026-10-05):
 *  1. The note already has a lab block → directly ABOVE the newest one.
 *  2. No lab yet, but EKG blocks → directly AFTER the last EKG block, keeping
 *     the EKG → Lab order of the investigation stack.
 *  3. Neither → the old rule (end of the O block), which is the only place
 *     left that is still inside O.
 *
 * "Lab" and "EKG" are read from dated headings by the same detector as
 * "penunjang terbaru saja" (`penunjangBlocks`), so `Laboratorium IGD` and
 * `Lab PJT` are both labs, and an undated heading is never guessed at.
 */
export type LabPlacement =
  | { rule: 'above-lab'; heading: string }
  | { rule: 'after-ekg'; heading: string }
  | { rule: 'end-of-o' };

export function labPlacement(body: string, aliases?: readonly SectionAlias[]): LabPlacement {
  const blocks = penunjangBlocks(body, aliases);
  const labs = blocks.filter((block) => block.kind === 'lab');
  if (labs.length > 0) {
    // Newest by date; on a tie, the first one written (the top of the stack).
    const newest = labs.reduce((best, block) => (block.date > best.date ? block : best));
    return { rule: 'above-lab', heading: newest.heading };
  }
  const ekgs = blocks.filter((block) => block.kind === 'ekg');
  const last = ekgs[ekgs.length - 1];
  if (last) return { rule: 'after-ekg', heading: last.heading };
  return { rule: 'end-of-o' };
}

/** A sentence for the sheet: where Sisipkan will put the block. */
export function describeLabPlacement(placement: LabPlacement): string {
  const name = (heading: string): string => heading.replace(/[*_]/g, '').trim();
  switch (placement.rule) {
    case 'above-lab':
      return `Disisipkan di atas ${name(placement.heading)}.`;
    case 'after-ekg':
      return `Belum ada lab di catatan — disisipkan setelah ${name(placement.heading)}.`;
    case 'end-of-o':
      return 'Belum ada lab atau EKG bertanggal — disisipkan di akhir bagian O.';
  }
}

export function insertLabBlock(
  body: string,
  block: string,
  aliases?: readonly SectionAlias[],
): string {
  const blocks = penunjangBlocks(body, aliases);
  const labs = blocks.filter((entry) => entry.kind === 'lab');

  if (labs.length > 0) {
    const newest = labs.reduce((best, entry) => (entry.date > best.date ? entry : best));
    const before = body.slice(0, newest.start).replace(/\s*$/, '');
    const after = body.slice(newest.start);
    return `${before}${before ? '\n\n' : ''}${block.trim()}\n\n${after}`;
  }

  const ekgs = blocks.filter((entry) => entry.kind === 'ekg');
  const last = ekgs[ekgs.length - 1];
  if (last) {
    const before = body.slice(0, last.end).replace(/\s*$/, '');
    const after = body.slice(last.end).replace(/^\s*/, '');
    return `${before}\n\n${block.trim()}${after ? `\n\n${after}` : ''}`;
  }

  const boundaries = parseSections(body, aliases).map((section) => ({
    sectionId: section.sectionId,
    start: section.start,
    end: section.end,
  }));
  return insertIntoObjective(body, block, boundaries);
}
