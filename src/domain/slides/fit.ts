import { GEOMETRY, SLIDE_H, SLIDE_W, SOAP_PT } from './geometry';

/**
 * The SOAP slide's font size: the largest step from 10.5 pt down to 9 pt at
 * which both text columns fit. Below 9 pt the slide is flagged instead of split
 * (owner: no "lanjutan" slide); the resident shortens the slide copy.
 *
 * An estimate, not a layout engine: Gill Sans averages ~0.42 em per character
 * on the reference slides (about 125 characters per line in the middle column
 * at 10.5 pt); 0.45 em errs toward shrinking a little early rather than letting
 * text run off the slide.
 */

const EMU_PER_PT = 12_700;
const CHAR_EM = 0.45;
const LINE_HEIGHT = 1.2;
/** Cell margins (0.1 in each side) and top/bottom insets (0.05 in each). */
const PAD_X_PT = 14.4;
const PAD_Y_PT = 7.2;

const soapBodyHeightPt = (slideH: number): number => (slideH - GEOMETRY.soapHeaderH) / EMU_PER_PT - PAD_Y_PT;

function linesNeeded(text: string, widthPt: number, pt: number): number {
  const perLine = Math.max(1, Math.floor(widthPt / (CHAR_EM * pt)));
  return text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)), 0);
}

function fits(text: string, colEmu: number, pt: number, bodyPt: number): boolean {
  if (!text) return true;
  const capacity = Math.floor(bodyPt / (pt * LINE_HEIGHT));
  return linesNeeded(text, colEmu / EMU_PER_PT - PAD_X_PT, pt) <= capacity;
}

/** Does `text`, wrapped to the box width, fit the box height at `pt`? (Free-text slide.) */
export function textFitsAt(text: string, box: { w: number; h: number }, pt: number): boolean {
  if (!text) return true;
  const heightPt = box.h / EMU_PER_PT - PAD_Y_PT;
  return linesNeeded(text, box.w / EMU_PER_PT - PAD_X_PT, pt) <= Math.floor(heightPt / (pt * LINE_HEIGHT));
}

/** The largest size from `max` down to `floor` at which the text fits; below the floor it is flagged. */
export function fitTextPt(text: string, box: { w: number; h: number }, max: number, floor: number): { pt: number; overflow: boolean } {
  for (let pt = max; pt >= floor; pt -= 0.5) if (textFitsAt(text, box, pt)) return { pt, overflow: false };
  return { pt: floor, overflow: true };
}

export function fitSoapFont(col2: string, col3: string, slideH: number = SLIDE_H): { pt: number; overflow: boolean } {
  const [, w2, w3] = GEOMETRY.soapCols;
  const bodyPt = soapBodyHeightPt(slideH);
  for (let pt = SOAP_PT.start; pt >= SOAP_PT.floor; pt -= SOAP_PT.step) {
    if (fits(col2, w2, pt, bodyPt) && fits(col3, w3, pt, bodyPt)) return { pt, overflow: false };
  }
  return { pt: SOAP_PT.floor, overflow: true };
}

// ---------------------------------------------------------------------------
// Lab table

/** Margins inside a lab cell, in points: tight, so twenty rows fit one slide. */
export const LAB_PAD_X_PT = 3.6;
export const LAB_PAD_Y_PT = 1.5;
const LAB_PT = { max: 14, floor: 7, step: 0.5 };
const LAB_CHAR_EM = 0.5;
/** Each date column beyond the first widens the table by this share of the slide, up to `LAB_MAX_W`. */
const LAB_COL_STEP = 0.11;
const LAB_MAX_W = 0.904;

export interface LabLayout {
  rect: { x: number; y: number; w: number; h: number };
  /** Column widths in EMU: the label column, then one per date. */
  columns: number[];
  pt: number;
  headerH: number;
  /** Row heights in EMU; with `headerH` they add up to `rect.h`. */
  rowHs: number[];
  /** Even the smallest size does not fit: the table runs past its box. */
  overflow: boolean;
}

/**
 * The lab slide's table sized to its content: wider with more date columns, the
 * font stepped down from 14 pt until every row (a cell may wrap) fits the box,
 * and the spare height shared out so the table still fills the box. The
 * reference slide is one date wide and 14 rows tall; a deck with five dates and
 * twenty rows ran out of its box at the fixed 14 pt.
 */
export function fitLab(
  dates: readonly string[],
  rows: ReadonlyArray<{ label: string; cells: readonly string[] }>,
  base: { x: number; y: number; w: number; h: number },
  firstShare: number,
): LabLayout {
  const n = Math.max(1, dates.length);
  const w = Math.min(Math.round(SLIDE_W * LAB_MAX_W), Math.round(base.w + (n - 1) * LAB_COL_STEP * SLIDE_W));
  const rect = { x: Math.round((SLIDE_W - w) / 2), y: base.y, w, h: base.h };
  const first = Math.round(base.w * firstShare);
  const rest = w - first;
  const columns = [first, ...Array.from({ length: n }, (_, i) => Math.floor(rest / n) + (i < rest % n ? 1 : 0))];
  const grid = [['Pemeriksaan', ...dates], ...rows.map((r) => [r.label, ...r.cells])];
  const boxPt = base.h / EMU_PER_PT;

  const needs = (pt: number): number[] =>
    grid.map((cells) => {
      const lines = Math.max(
        1,
        ...columns.map((col, c) => {
          const perLine = Math.max(1, Math.floor((col / EMU_PER_PT - 2 * LAB_PAD_X_PT) / (LAB_CHAR_EM * pt)));
          return (cells[c] ?? '').split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)), 0);
        }),
      );
      return lines * pt * LINE_HEIGHT + 2 * LAB_PAD_Y_PT;
    });

  let pt = LAB_PT.max;
  let need = needs(pt);
  while (need.reduce((a, b) => a + b, 0) > boxPt && pt > LAB_PT.floor) {
    pt -= LAB_PT.step;
    need = needs(pt);
  }
  const total = need.reduce((a, b) => a + b, 0);
  const share = Math.max(0, boxPt - total) / need.length;
  const heights = need.map((h) => Math.round((h + share) * EMU_PER_PT));
  return {
    rect,
    columns,
    pt,
    headerH: heights[0]!,
    rowHs: heights.slice(1),
    overflow: total > boxPt,
  };
}
