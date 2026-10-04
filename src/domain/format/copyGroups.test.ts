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

  it('recognises a hand-written sign-off that is not in the configured list', () => {
    // 2026-10-05: the stored list rarely matches what is actually typed.
    expect(stripTrailingClosing('*Plan:*\n- Echo\n\nTabe terima kasih dokter', [])).toBe(
      '*Plan:*\n- Echo',
    );
    expect(
      stripTrailingClosing('*Plan:*\n- Echo\n\nMohon arahannya dokter. Terima kasih dokter.', []),
    ).toBe('*Plan:*\n- Echo');
    expect(stripTrailingClosing('*Plan:*\n- Echo\n\nTerima kasih Prof', [])).toBe('*Plan:*\n- Echo');
  });

  it('removes a sign-off that sits before a TS block, not only at the end', () => {
    const text = '*Plan:*\n- Echo\n\nTerima kasih dokter.\n\n*TS Paru*\n- Nebu';
    expect(stripTrailingClosing(text, [])).toBe('*Plan:*\n- Echo\n\n*TS Paru*\n- Nebu');
  });

  it('never removes a list item or the opening', () => {
    const items = '*Plan:*\n- Terima kasih dokter jaga atas bantuannya\n1. Mohon arahan dokter re: CAG';
    expect(stripTrailingClosing(items, [])).toBe(items);
    const opening = 'Tabe dokter, mohon izin melaporkan pasien, terima kasih dokter';
    expect(stripTrailingClosing(opening, [])).toBe(opening);
  });
});
