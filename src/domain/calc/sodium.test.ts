import { describe, expect, it } from 'vitest';

import { bandFor, calculateOsmolality } from './sodium';

describe('calculateOsmolality', () => {
  it('BUN: 2·Na + glucose/18 + BUN/2.8', () => {
    // 2(140) + 90/18 + 14/2.8 = 280 + 5 + 5 = 290
    const result = calculateOsmolality({ sodium: 140, glucose: 90, urea: 14, ureaKind: 'bun' });
    expect(result?.total).toBe(290);
    expect(result?.effective).toBe(285);
  });

  it('Ureum is divided by 6 (urea 60 g/mol), not by BUN\'s 2.8', () => {
    // Ureum 30 mg/dL = BUN 14 mg/dL = 5 mmol/L: the same sample, the same answer.
    const ureum = calculateOsmolality({ sodium: 140, glucose: 90, urea: 30, ureaKind: 'ureum' });
    expect(ureum?.total).toBe(290);
    expect(ureum?.ureaTerm).toBe(5);
  });

  it('the old bug: ureum 180 divided by 2.8 added 64 mOsm instead of 30', () => {
    const right = calculateOsmolality({ sodium: 128, glucose: 110, urea: 180, ureaKind: 'ureum' })!;
    // 256 + 6.1 + 30 = 292.1 total; effective 262.1 — hypotonic.
    expect(right.total).toBe(292.1);
    expect(right.effective).toBe(262.1);
    const asIfBun = calculateOsmolality({ sodium: 128, glucose: 110, urea: 180, ureaKind: 'bun' })!;
    expect(asIfBun.total).toBe(326.4);
  });

  it('matches a hypoosmolal case from a real note (BUN)', () => {
    expect(calculateOsmolality({ sodium: 126, glucose: 100, urea: 20, ureaKind: 'bun' })?.total).toBe(264.7);
  });

  it('accepts zero glucose and urea but not zero or non-finite sodium', () => {
    expect(calculateOsmolality({ sodium: 140, glucose: 0, urea: 0, ureaKind: 'ureum' })?.total).toBe(280);
    expect(calculateOsmolality({ sodium: 0, glucose: 90, urea: 14, ureaKind: 'bun' })).toBeNull();
    expect(calculateOsmolality({ sodium: Number.NaN, glucose: 90, urea: 14, ureaKind: 'bun' })).toBeNull();
  });

  it('shows its working, naming the urea kind and the effective value', () => {
    expect(calculateOsmolality({ sodium: 140, glucose: 90, urea: 30, ureaKind: 'ureum' })?.line).toBe(
      'Osmolalitas = 2(140) + 90/18 + Ureum 30/6 = 290 mOsm/kg · efektif (tanpa urea) 285 mOsm/kg',
    );
  });
});

describe('bandFor', () => {
  it('labels only against a range the user entered', () => {
    expect(bandFor(270, undefined)).toBeNull();
    const range = { low: 275, high: 295 };
    expect(bandFor(270, range)).toBe('low');
    expect(bandFor(285, range)).toBe('normal');
    expect(bandFor(300, range)).toBe('high');
  });
});
