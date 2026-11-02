import { describe, expect, it } from 'vitest';

import { HELPER_GUIDE_KEY, HELPER_GUIDE_STEPS } from './helper';
import { LIST_MAKER_GUIDE_KEY } from './listMaker';

describe('Helper guide', () => {
  it('has a welcome, then one step per tab in tab order', () => {
    expect(HELPER_GUIDE_STEPS.map((s) => s.id)).toEqual(['welcome', 'jaga', 'sensus', 'buatsensus', 'mr', 'tersimpan']);
  });

  it('every step is filled, with balanced bold marks', () => {
    for (const step of HELPER_GUIDE_STEPS) {
      expect(step.title).not.toBe('');
      expect(step.points.length).toBeGreaterThan(0);
      for (const line of [step.lead, ...step.points]) expect((line.match(/\*\*/g) ?? []).length % 2).toBe(0);
    }
  });

  it('is remembered apart from the List Maker guide', () => {
    expect(HELPER_GUIDE_KEY).not.toBe(LIST_MAKER_GUIDE_KEY);
  });
});
