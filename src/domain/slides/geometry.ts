/**
 * Slide MZ: where every object sits, and in which colours.
 *
 * The positions are MEASURED from the decks residents already send Prof MZ
 * (PowerPoint "Parcel" theme, 16:9): the owner asked for the same layout he is
 * used to reading, with only the colours refreshed. So these are not design
 * choices to tune; changing one moves an object away from where the reader's
 * eye already goes. The 3- and 4-photo grids and photo + text are new layouts
 * kept inside the same band under the title.
 *
 * Units are EMU (914 400 per inch), the unit PresentationML stores.
 */

export const SLIDE_W = 12_192_000;
export const SLIDE_H = 6_858_000;

/** EMU. May be negative or larger than the slide: a moved photo can hang off the edge. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ImageLayout = 'one' | 'two' | 'three' | 'four' | 'photoText';

/** Percent of the slide (x/w of width, y/h of height) to EMU. */
export function pct(x: number, y: number, w: number, h: number): Rect {
  return {
    x: Math.round((x / 100) * SLIDE_W),
    y: Math.round((y / 100) * SLIDE_H),
    w: Math.round((w / 100) * SLIDE_W),
    h: Math.round((h / 100) * SLIDE_H),
  };
}

const soapCol1 = Math.round(0.11 * SLIDE_W);
const soapCol2 = Math.round(0.585 * SLIDE_W);

export const GEOMETRY = {
  /** Title slide: the boxed patient line, then the DPJP line under it. */
  titleBox: pct(8.2, 34.8, 82.3, 24.0),
  titleSub: pct(10.3, 62.2, 78.0, 19.7),
  /** The SOAP table fills the whole slide. */
  soapTable: pct(0, 0, 100, 100),
  soapCols: [soapCol1, soapCol2, SLIDE_W - soapCol1 - soapCol2] as [number, number, number],
  soapHeaderH: Math.round(0.0555 * SLIDE_H),
  /** Boxed title at the top of image, lab and text slides. */
  pageTitle: pct(18.3, 3.3, 63.4, 9.3),
  closingBox: pct(18.3, 36.1, 63.4, 17.3),
  labTable: pct(24.5, 18.6, 50.9, 76.2),
  labFirstColShare: 0.486,
  textOnly: pct(2.7, 13.5, 94.7, 84.0),
  /** The text half of the photo + text layout; the photo half is `photos.photoText[0]`. */
  photoTextBox: pct(54.0, 15.7, 41.0, 79.3),
  photos: {
    one: [pct(21.3, 13.6, 57.4, 84.0)],
    two: [pct(8.1, 15.7, 39.6, 79.3), pct(50.0, 15.7, 42.4, 79.3)],
    three: [pct(4.0, 15.7, 29.5, 79.3), pct(35.3, 15.7, 29.5, 79.3), pct(66.5, 15.7, 29.5, 79.3)],
    four: [
      pct(14.0, 15.7, 35.0, 39.0),
      pct(51.0, 15.7, 35.0, 39.0),
      pct(14.0, 56.5, 35.0, 39.0),
      pct(51.0, 56.5, 35.0, 39.0),
    ],
    photoText: [pct(5.0, 15.7, 47.0, 79.3)],
  } satisfies Record<ImageLayout, Rect[]>,
} as const;

/** Palette B ("Parcel diperhalus", owner's pick 2026-11-12). Hex without `#`, as DrawingML wants it. */
export const PALETTE_B = {
  bg: 'F4F1EC',
  titleBgFrom: '8FA4AB',
  titleBgTo: '6F878F',
  boxFill: 'FFFFFF',
  boxLine: '3D3D3D',
  accent: 'C96731',
  head: 'B85C2B',
  idCol: 'F1E4DC',
  body: 'FBF7F4',
  body2: 'F6EEE8',
  grid: 'E3D3C8',
  sec: '9A4A20',
  ink: '2B2B2B',
  /** Subtitle on the title slide: dark enough on the blue-grey gradient. */
  subInk: '1F2A2E',
} as const;

/** The reference theme's font. Android has no Gill Sans MT; viewers there substitute. */
export const FONT = 'Gill Sans MT';

/** SOAP body text: start size, step down, floor. No "lanjutan" slide below the floor. */
export const SOAP_PT = { start: 10.5, step: 0.5, floor: 9 } as const;
