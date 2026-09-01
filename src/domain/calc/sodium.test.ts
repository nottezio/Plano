import { describe, expect, it } from 'vitest';

import { calculateOsmolality } from './sodium';


describe('calculateOsmolality', () => {
  it('applies the standard formula', () => {
    // 2(140) + 90/18 + 14/2.8 = 280 + 5 + 5 = 290
    expect(calculateOsmolality({ sodium: 140, glucose: 90, bun: 14 })?.value).toBe(290);
  });

  it('matches a hypoosmolal case from a real note', () => {
    const result = calculateOsmolality({ sodium: 126, glucose: 100, bun: 20 });
    expect(result?.value).toBe(264.7);
    expect(result?.band).toBe('low');
  });

  it('bands the result', () => {
    expect(calculateOsmolality({ sodium: 150, glucose: 200, bun: 40 })?.band).toBe('high');
    expect(calculateOsmolality({ sodium: 140, glucose: 90, bun: 14 })?.band).toBe('normal');
  });

  it('accepts zero glucose and BUN but not zero sodium', () => {
    expect(calculateOsmolality({ sodium: 140, glucose: 0, bun: 0 })?.value).toBe(280);
    expect(calculateOsmolality({ sodium: 0, glucose: 90, bun: 14 })).toBeNull();
  });

  it('shows its working', () => {
    expect(calculateOsmolality({ sodium: 140, glucose: 90, bun: 14 })?.line).toBe(
      'Osmolalitas = 2(140) + 90/18 + 14/2.8 = 290 mOsm/kg',
    );
  });
});

