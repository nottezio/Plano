import { describe, expect, it } from 'vitest';

import { UREUM_PER_BUN, convertCreatinine, convertGlucose, convertUrea } from './units';

describe('convertUrea', () => {
  it('ureum = BUN × 2.14 (60.06 / 28.014)', () => {
    expect(UREUM_PER_BUN).toBeCloseTo(2.144, 3);
    expect(convertUrea(30, 'ureum')).toEqual({ ureum: 30, bun: 14, mmol: 5 });
    expect(convertUrea(14, 'bun')).toEqual({ ureum: 30, bun: 14, mmol: 5 });
  });

  it('a cardiorenal ureum', () => {
    expect(convertUrea(180, 'ureum')).toEqual({ ureum: 180, bun: 84, mmol: 29.97 });
  });

  it('from mmol/L', () => {
    expect(convertUrea(10, 'mmol')).toEqual({ ureum: 60.1, bun: 28, mmol: 10 });
  });

  it('refuses nonsense', () => {
    expect(convertUrea(-1, 'ureum')).toBeNull();
    expect(convertUrea(Number.NaN, 'bun')).toBeNull();
  });
});

describe('convertCreatinine', () => {
  it('1 mg/dL = 88.4 µmol/L', () => {
    expect(convertCreatinine(1, 'mgdl')).toEqual({ mgdl: 1, umol: 88 });
    expect(convertCreatinine(2.5, 'mgdl')?.umol).toBe(221);
    expect(convertCreatinine(177, 'umol')?.mgdl).toBe(2);
  });
});

describe('convertGlucose', () => {
  it('1 mmol/L = 18 mg/dL', () => {
    expect(convertGlucose(180, 'mgdl')).toEqual({ mgdl: 180, mmol: 10 });
    expect(convertGlucose(5.5, 'mmol')).toEqual({ mgdl: 99, mmol: 5.5 });
  });
});
