import { describe, expect, it } from 'vitest';

import { buildBands } from './SectionBands';
import { DEFAULT_SECTION_ALIASES as ALIASES } from '@/domain/defaults';

const NOTE = [
  'Assalamualaikum dokter.',
  '',
  '*S :*',
  '- Sesak berkurang.',
  '',
  '*O :*',
  'Compos mentis',
  'Tensi : 100/70 mmHg',
  '',
  '*EKG di PJT (31-8-2026)*',
  'Sinus rhythm',
  '',
  '*Mohon izin kami assesst dengan*',
  '- CHF',
].join('\n');

const bands = buildBands(NOTE, ALIASES, true);

/** What the mirror draws, as text: a block that has a line ends it with one newline; an empty one has no line. */
function rebuild(parts: ReturnType<typeof buildBands>): string {
  return parts.map((band) => (band.block && band.text !== '' ? `${band.text}\n` : band.text)).join('');
}

describe('mirror bands', () => {
  /**
   * The invariant the mirror exists for.
   *
   * It sits behind the textarea and must produce the same line boxes. It does
   * NOT concatenate to the body: a heading span is `display: block`, which
   * ends its own line, so the newline after each header is deliberately
   * dropped — leaving it in would open a second line and push every band below
   * it one line down.
   *
   * So the invariant is that re-inserting exactly one newline after each block
   * span restores the body. That pins both halves of the arrangement together:
   * change the display mode without changing the slice, or the reverse, and
   * this fails. Both have been changed alone before, and both times every band
   * below the first heading ended up on the wrong line.
   */
  it('reconstructs the body when each block span regains its newline', () => {
    expect(rebuild(bands)).toBe(NOTE);
  });

  /**
   * A note that starts on blank lines (a Versi trimmed to "Penunjang terbaru
   * saja" does) has an EMPTY first block. An empty block has no line box, so
   * the newline it would "end" must stay in the following text or the blank
   * line vanishes from the mirror and every band lands one line above its
   * heading (2 Nov 2026).
   */
  it('keeps the blank line when the note starts with one', () => {
    for (const body of ['\nLung US\n\n*S :*\nsatu', '\n\n\nLung US\n\n*O :*\nsatu\n\n*EKG di PJT (31-8-2026)*\nSinus']) {
      const parts = buildBands(body, ALIASES, true);
      expect(rebuild(parts)).toBe(body);
      // The empty block carries no text, so the newline lives in what follows it.
      const first = parts[0];
      expect(first?.block && first.text === '' ? parts[1]?.text.startsWith('\n') : true).toBe(true);
    }
  });

  it('emits an anchor for each heading', () => {
    // `anchored.add()` used to run one line BEFORE the `anchored.has()` that
    // decided this, so no anchor was ever emitted and every jump button did
    // nothing at all.
    const anchors = bands.map((band) => band.anchor).filter(Boolean);
    expect(anchors).toContain('s');
    expect(anchors).toContain('o');
    expect(anchors).toContain('a');
  });

  it('anchors only the FIRST occurrence of a section', () => {
    const twice = buildBands('*O :*\nsatu\n\n*O :*\ndua', ALIASES, true);
    expect(twice.filter((band) => band.anchor === 'o')).toHaveLength(1);
  });

  it('does not anchor a field that shares its line with a value', () => {
    // `Tensi : 100/70 mmHg` is a section to the parser but not a heading.
    const anchors = bands.map((band) => band.anchor).filter(Boolean);
    expect(anchors).not.toContain('custom_tensi');
  });

  it('paints nothing when tinting is off, but still anchors', () => {
    const unpainted = buildBands(NOTE, ALIASES, false);
    expect(unpainted.every((band) => band.tint === null)).toBe(true);
    expect(unpainted.map((band) => band.anchor).filter(Boolean)).toContain('o');
    // And the geometry is still exact, because the jump bar measures against
    // it whether or not anything is painted.
    expect(rebuild(unpainted)).toBe(NOTE);
  });
});
