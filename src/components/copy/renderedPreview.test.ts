import { describe, expect, it } from 'vitest';

import { findNonAsciiChars, toPlain, toWhatsApp } from '@/domain/format/formatters';

/**
 * The preview shows two things that must not be confused: the characters that
 * get copied, and a rendering of how they will look. These assert the property
 * that makes the split necessary.
 */
describe('copying the rendered view would lose the formatting', () => {
  const body = '*Mohon izin kami terapi dengan*\n- Clopidogrel 75mg';

  it('the copyable text keeps its markers', () => {
    expect(toWhatsApp(body)).toContain('*Mohon izin kami terapi dengan*');
  });

  it('the same text stripped of markers is a different message', () => {
    // What a selection from a rendered preview would produce: the words,
    // without the asterisks that made them bold.
    expect(toPlain(body)).not.toContain('*');
    expect(toPlain(body)).toContain('Mohon izin kami terapi dengan');
  });
});

describe('what SIMGOS renders as `?`', () => {
  it('flags characters the WhatsApp format leaves in', () => {
    // A date header separator and a bullet character both survive toWhatsApp
    // and are exactly what a manual paste into SIMGOS turns into `?`.
    const withMiddot = 'Kamis, 6 Agustus 2026 \u00B7 Hari rawat ke-4';
    expect(findNonAsciiChars(toWhatsApp(withMiddot))).toContain('\u00B7');
  });

  it('finds nothing in plain output, which is the fix offered', () => {
    const messy = 'Suhu 36.7\u00B0C\nEF 55\u201360 %\n\u2022 Clopidogrel';
    expect(findNonAsciiChars(toPlain(messy))).toEqual([]);
  });

  it('reports each offending character once', () => {
    expect(findNonAsciiChars('\u00B7 a \u00B7 b \u00B7')).toEqual(['\u00B7']);
  });
});
