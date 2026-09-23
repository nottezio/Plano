import { describe, expect, it } from 'vitest';

import { MAX_IMAGE_SIDE, QUALITY_STEPS, TARGET_DATA_URL, fitWithin } from './boardImages';

describe('fitWithin', () => {
  it('leaves a small image alone and never enlarges it', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('caps the longest side and keeps the proportions', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: MAX_IMAGE_SIDE, height: 1050 });
    expect(fitWithin(1000, 5600)).toEqual({ width: 250, height: MAX_IMAGE_SIDE });
  });

  it('survives an empty image', () => {
    expect(fitWithin(0, 0)).toEqual({ width: 0, height: 0 });
  });
});

describe('limits', () => {
  it('aims well under the rules’ hard limit of 900 000 characters', () => {
    expect(TARGET_DATA_URL).toBeLessThan(900_000);
  });

  it('tries qualities from best to worst', () => {
    expect([...QUALITY_STEPS].sort((a, b) => b - a)).toEqual([...QUALITY_STEPS]);
  });
});
