import { describe, expect, it } from 'vitest';

import { DEFAULT_CHECKLIST } from './defaults';
import { checklistProgress, resolveStates } from './checklist';
import { itemsForPatientDay, skipsOnDischargeDay } from './checklistDay';

const TODAY = '2026-10-01';
const TOMORROW = '2026-10-02';

describe('itemsForPatientDay', () => {
  it('drops Order obat on the day the patient goes home', () => {
    const items = itemsForPatientDay(DEFAULT_CHECKLIST, { dischargePlannedFor: TODAY }, TODAY, TODAY);
    const orderObat = items.find((item) => item.id === 'c8');
    expect(orderObat?.active).toBe(false);
    expect(items.filter((item) => item.active)).toHaveLength(DEFAULT_CHECKLIST.length - 1);
  });

  it('keeps it the day before (H-1) and for patients not going home', () => {
    expect(itemsForPatientDay(DEFAULT_CHECKLIST, { dischargePlannedFor: TOMORROW }, TODAY, TODAY)).toBe(DEFAULT_CHECKLIST);
    expect(itemsForPatientDay(DEFAULT_CHECKLIST, {}, TODAY, TODAY)).toBe(DEFAULT_CHECKLIST);
  });

  it('reads the legacy "today" stage', () => {
    const items = itemsForPatientDay(DEFAULT_CHECKLIST, { discharge: 'today' }, TODAY, TODAY);
    expect(items.find((item) => item.id === 'c8')?.active).toBe(false);
  });

  it('a discharge day can be complete without Order obat', () => {
    const items = itemsForPatientDay(DEFAULT_CHECKLIST, { dischargePlannedFor: TODAY }, TODAY, TODAY);
    const done = Object.fromEntries(
      items.filter((item) => item.id !== 'c8').map((item) => [item.id, { done: true, at: null, by: null }]),
    );
    const progress = checklistProgress(items, resolveStates(items, { items: done } as never));
    expect(progress.complete).toBe(true);
  });

  it('an explicit setting wins over the seed default', () => {
    expect(skipsOnDischargeDay({ ...DEFAULT_CHECKLIST[0]!, skipOnDischargeDay: true })).toBe(true);
    expect(skipsOnDischargeDay({ ...DEFAULT_CHECKLIST.find((i) => i.id === 'c8')!, skipOnDischargeDay: false })).toBe(false);
  });
});
