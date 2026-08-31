import { describe, expect, it } from 'vitest';

import { sanitizeCopiedText } from './useSanitizedCopy';

/**
 * Text copied by SELECTING it never went through a formatter.
 *
 * Two reports, one gap: assessment text arriving in SIMGOS on a black block
 * (the `text/html` flavour carried the dark theme's colours), and stray `?`
 * (the `text/plain` flavour carried invisible and non-ASCII characters).
 */
describe('sanitizeCopiedText', () => {
  it('removes invisible characters regardless of destination', () => {
    // They carry no meaning anywhere and were the original source of stray `?`.
    expect(sanitizeCopiedText('Compos\u200B mentis\u2060', false)).toBe('Compos mentis');
  });

  it('turns a non-ASCII space into a real space rather than deleting it', () => {
    // Deleting would join the words: `Nadi78`.
    expect(sanitizeCopiedText('Nadi\u00A078', false)).toBe('Nadi 78');
  });

  it('turns an invisible line separator into a newline', () => {
    expect(sanitizeCopiedText('baris satu\u2028baris dua', false)).toBe('baris satu\nbaris dua');
  });

  it('leaves visible non-ASCII alone when the destination is not SIMGOS', () => {
    // `°C` renders correctly in WhatsApp. Folding always would degrade every
    // WhatsApp copy in order to fix a SIMGOS one.
    expect(sanitizeCopiedText('Suhu : 36.8 °C', false)).toBe('Suhu : 36.8 °C');
  });

  it('folds visible non-ASCII when the SIMGOS preview is on screen', () => {
    expect(sanitizeCopiedText('Suhu : 36.8 °C', true)).not.toMatch(/[^\x00-\x7F]/);
  });

  it('folds subscripts, which SIMGOS prints as ?', () => {
    expect(sanitizeCopiedText('SpO₂ 99%', true)).not.toMatch(/[^\x00-\x7F]/);
  });

  it('leaves ordinary text untouched in both modes', () => {
    const plain = '- Congestive Heart Failure NYHA II (HFpEF)';
    expect(sanitizeCopiedText(plain, false)).toBe(plain);
    expect(sanitizeCopiedText(plain, true)).toBe(plain);
  });
});
