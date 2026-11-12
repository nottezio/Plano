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

const bodyHeightPt = (SLIDE_H - GEOMETRY.soapHeaderH) / EMU_PER_PT - PAD_Y_PT;

function linesNeeded(text: string, widthPt: number, pt: number): number {
  const perLine = Math.max(1, Math.floor(widthPt / (CHAR_EM * pt)));
  return text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)), 0);
}

function fits(text: string, colEmu: number, pt: number): boolean {
  if (!text) return true;
  const capacity = Math.floor(bodyHeightPt / (pt * LINE_HEIGHT));
  return linesNeeded(text, colEmu / EMU_PER_PT - PAD_X_PT, pt) <= capacity;
}

export function fitSoapFont(col2: string, col3: string): { pt: number; overflow: boolean } {
  const [, w2, w3] = GEOMETRY.soapCols;
  for (let pt = SOAP_PT.start; pt >= SOAP_PT.floor; pt -= SOAP_PT.step) {
    if (fits(col2, w2, pt) && fits(col3, w3, pt)) return { pt, overflow: false };
  }
  return { pt: SOAP_PT.floor, overflow: true };
}
