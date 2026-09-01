import { describe, expect, it } from 'vitest';

import { parseSections } from './parseSections';
import { DEFAULT_SECTION_ALIASES as ALIASES } from '../defaults';

/**
 * A heading owns its line; a field shares it with its value.
 *
 * The parser marks both as sections — that is how `Penunjang: Hb 12` gets
 * grouped for copying — but only one of them is a heading. Without this
 * distinction the tint layer painted a colour band on every echo measurement
 * and every vital sign, striping a note across text nobody had marked up.
 */
const NOTE = [
  '*O :*',
  'Compos mentis',
  'BSA : 1,80 m2',
  'LVOT diameter : 2,0 cm',
  'LVSV : 41,8 mL',
  '',
  'Lung ultrasound',
  'Hemithorax bilateral : pleural line reguler, lung sliding (+)',
  '',
  '*Plan :*',
  '- Monitoring',
].join('\n');

describe('ownsLine', () => {
  const sections = parseSections(NOTE, ALIASES);
  const byLabel = (needle: string) =>
    sections.find((section) => (section.headerLine ?? '').includes(needle));

  it('is true for a real heading', () => {
    expect(byLabel('*O :*')?.ownsLine).toBe(true);
    expect(byLabel('*Plan :*')?.ownsLine).toBe(true);
  });

  it('is false for a measurement that shares its line with a value', () => {
    // These are the lines that came out tinted in the note.
    expect(byLabel('LVSV')?.ownsLine).toBe(false);
    expect(byLabel('BSA')?.ownsLine).toBe(false);
    expect(byLabel('LVOT diameter')?.ownsLine).toBe(false);
    expect(byLabel('Hemithorax bilateral')?.ownsLine).toBe(false);
  });

  it('is false for the intro, which has no header at all', () => {
    const intro = parseSections('halo dokter\n\n*S :*\nx', ALIASES).find(
      (section) => section.sectionId === '_intro',
    );
    expect(intro?.ownsLine).toBe(false);
  });

  it('is true for a heading with trailing spaces before the newline', () => {
    // Trailing whitespace is not content; a heading followed by nothing but
    // spaces still owns its line.
    const [first] = parseSections('*S :*   \nkeluhan', ALIASES);
    expect(first?.ownsLine).toBe(true);
  });

  it('does not change which sections the parser finds', () => {
    // The distinction is for consumers that decorate. Copy grouping still
    // needs `Penunjang: Hb 12` to be a section.
    const withInline = parseSections('*O :*\nPenunjang: Hb 12', ALIASES);
    expect(withInline.some((section) => section.sectionId === 'penunjang')).toBe(true);
  });
});
