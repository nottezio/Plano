import { GEOMETRY, SLIDE_H, SOAP_PT } from './geometry';

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
