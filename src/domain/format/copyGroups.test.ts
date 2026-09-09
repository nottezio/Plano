import { describe, expect, it } from 'vitest';

import { availableGroups, stripTrailingClosing } from './copyGroups';
import { DEFAULT_SECTION_ALIASES as ALIASES } from '../defaults';

const BODY = [
  '*S:*',
  '- sesak',
  '*O:*',
  'TTV: TD 130/80',
  '*Laboratorium PJT (04-08-2026)*',
  'Hb 10.2',
  '*Mohon izin kami assess dengan:*',
  '- Pneumonia',
  '*Mohon izin kami terapi dengan:*',
  '- Ceftriaxone',
].join('\n');

describe('availableGroups', () => {
  it('reports the groups the note actually has', () => {
    expect(availableGroups(BODY, ALIASES)).toEqual(new Set(['s', 'o', 'a', 'terapi']));
  });

  it('agrees with what a copy would produce', () => {
    /*
     * This used to be answered separately, by keyword, and two answers drift:
     * a chip could be enabled for a group that sliced to nothing, or greyed
     * out for one that had content. Both come from the same boundaries now.
     */
    expect(availableGroups('*S:*\n- x', ALIASES)).toEqual(new Set(['s']));
    expect(availableGroups('Halo dokter, tidak ada judul apapun', ALIASES)).toEqual(new Set());
  });

  it('places investigations in O rather than in a group of their own', () => {
    // A dated lab heading is inside the objective block, not a sixth chip.
    expect(availableGroups('*O:*\nTTV\n*Laboratorium (04-08)*\nHb 10', ALIASES)).toEqual(
      new Set(['o']),
    );
  });
});

describe('stripTrailingClosing', () => {
  const CLOSINGS = ['Selanjutnya mohon arahan dokter. Terima kasih dokter'];

  it('drops a trailing closing sentence', () => {
    const text = '*Plan:*\n- Echo\n\nSelanjutnya mohon arahan dokter. Terima kasih dokter.';
    expect(stripTrailingClosing(text, CLOSINGS)).toBe('*Plan:*\n- Echo');
  });

  it('leaves a plan item that merely mentions the consultant', () => {
    const text = '*Plan:*\n- Lapor dokter besok pagi';
    expect(stripTrailingClosing(text, CLOSINGS)).toBe(text);
  });

  it('does nothing when no closings are configured', () => {
    const text = '*Plan:*\n- Echo\n\nTerima kasih dokter';
    expect(stripTrailingClosing(text, [])).toBe(text);
  });
});
