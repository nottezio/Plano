import { describe, expect, it } from 'vitest';

import { calculateTransfusion } from './transfusion';

describe('calculateTransfusion', () => {
  it('gives ΔHb × BB × 4 and the bag count', () => {
    expect(calculateTransfusion({ weightKg: 55, hbNow: 7.5, hbTarget: 10, bagMl: 250 })).toEqual({
      volumeMl: 550,
      bags: 2.2,
      line: 'Transfusi PRC Hb 7.5 → 10 g/dL, BB 55 kg: 550 cc (±2.2 kantong @250 cc)',
    });
  });

  it('returns null for a target not above the current Hb or a missing weight', () => {
    expect(calculateTransfusion({ weightKg: 55, hbNow: 10, hbTarget: 10, bagMl: 250 })).toBeNull();
    expect(calculateTransfusion({ weightKg: 0, hbNow: 7, hbTarget: 10, bagMl: 250 })).toBeNull();
    expect(calculateTransfusion({ weightKg: 55, hbNow: 7, hbTarget: 10, bagMl: 0 })).toBeNull();
  });
});
