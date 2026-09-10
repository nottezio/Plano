import { describe, expect, it } from 'vitest';

import {
  STAGE_LABELS,
  STAGE_SHORT,
  dateForStage,
  dischargeStage,
  migrateLegacyDischarge,
  type DischargeStage,
} from './discharge';
import type { ClinicalDate } from './types';

const TODAY = '2026-08-19' as ClinicalDate;

describe('dischargeStage', () => {
  it('evolves without anyone re-marking the patient', () => {
    // The whole point: marked H-1 on the 18th for the 19th, and on the 19th it
    // reads PULANG by itself.
    const planned = '2026-08-19' as ClinicalDate;
    expect(dischargeStage(planned, '2026-08-18' as ClinicalDate)).toBe('h1');
    expect(dischargeStage(planned, '2026-08-19' as ClinicalDate)).toBe('today');
  });

  it('shows a further-out plan as planned rather than imminent', () => {
    expect(dischargeStage('2026-08-22' as ClinicalDate, TODAY)).toBe('planned');
  });

  it('flags a date that has passed, because that is the one worth noticing', () => {
    expect(dischargeStage('2026-08-18' as ClinicalDate, TODAY)).toBe('overdue');
  });

  it('is null when no discharge is planned', () => {
    expect(dischargeStage(undefined, TODAY)).toBeNull();
  });
});

describe('dateForStage', () => {
  it('writes tomorrow for H-1 and today for pulang hari ini', () => {
    expect(dateForStage('h1', TODAY)).toBe('2026-08-20');
    expect(dateForStage('today', TODAY)).toBe(TODAY);
  });

  it('crosses a month boundary correctly', () => {
    expect(dateForStage('h1', '2026-08-31' as ClinicalDate)).toBe('2026-09-01');
  });
});

describe('migrateLegacyDischarge', () => {
  it('leaves an existing date alone', () => {
    expect(
      migrateLegacyDischarge(
        { discharge: 'h1', dischargePlannedFor: '2026-08-25' as ClinicalDate },
        TODAY,
      ),
    ).toBe('2026-08-25');
  });

  it('reads a legacy stage against today, which is the least-wrong reading', () => {
    // No timestamp was ever stored, so a stage set last week cannot be dated.
    expect(migrateLegacyDischarge({ discharge: 'h1' }, TODAY)).toBe('2026-08-20');
    expect(migrateLegacyDischarge({ discharge: 'today' }, TODAY)).toBe(TODAY);
  });

  it('returns nothing when the patient was never marked', () => {
    expect(migrateLegacyDischarge({}, TODAY)).toBeUndefined();
  });
});

describe('stage wording', () => {
  const STAGES: DischargeStage[] = ['planned', 'h1', 'today', 'overdue'];

  it('has both a full phrase and a chip-sized form for every stage', () => {
    // The two maps are read in different places — a stage added to one and
    // forgotten in the other renders an empty chip rather than failing loudly.
    for (const stage of STAGES) {
      expect(STAGE_LABELS[stage]).toBeTruthy();
      expect(STAGE_SHORT[stage]).toBeTruthy();
      expect(STAGE_SHORT[stage].length).toBeLessThanOrEqual(STAGE_LABELS[stage].length);
    }
  });

  it('never repeats "pulang" in the short form — the car glyph already says it', () => {
    for (const stage of STAGES) {
      expect(STAGE_SHORT[stage].toLowerCase()).not.toContain('pulang');
    }
  });

  it('says "pulang" in full in the phrase a screen reader gets', () => {
    expect(STAGE_LABELS.today.toLowerCase()).toContain('pulang');
    expect(STAGE_LABELS.h1.toLowerCase()).toContain('pulang');
  });
});
