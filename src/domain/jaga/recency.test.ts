import { describe, expect, it } from 'vitest';

import { compareRosters, coverageOf, describeVersion, nearestYear, refuseOlder } from './recency';

const roster = (dates: string[], extra: Record<string, unknown> = {}) => ({
  title: 't',
  initials: {},
  importedAt: '2026-09-01T00:00:00.000Z',
  shifts: dates.map((date) => ({ date, shift: 'penuh', hari: '', posts: {} })),
  ...extra,
});

describe('compareRosters', () => {
  it('prefers the schedule that runs later, whatever the import order', () => {
    const september = roster(['2026-09-01', '2026-09-30'], { importedAt: '2026-09-01T00:00:00.000Z' });
    const august = roster(['2026-08-01', '2026-08-31'], { importedAt: '2026-09-20T00:00:00.000Z' });
    expect(compareRosters('roster', september, august)).toBeGreaterThan(0);
  });

  it('breaks a tie on dates with the PDF document date (a corrected re-issue)', () => {
    const first = roster(['2026-09-30'], { source: { documentDate: '2026-08-25T00:00:00.000Z' } });
    const revised = roster(['2026-09-30'], {
      source: { documentDate: '2026-08-28T00:00:00.000Z' },
      importedAt: '2026-08-01T00:00:00.000Z',
    });
    expect(compareRosters('roster', revised, first)).toBeGreaterThan(0);
  });

  it('skips a document date only one side has, then falls back to import time', () => {
    const old = roster(['2026-09-30'], { importedAt: '2026-09-01T00:00:00.000Z' });
    const fresh = roster(['2026-09-30'], {
      importedAt: '2026-09-02T00:00:00.000Z',
      source: { documentDate: '2020-01-01T00:00:00.000Z' },
    });
    expect(compareRosters('roster', fresh, old)).toBeGreaterThan(0);
  });

  it('orders Jarkom by document date, having no schedule dates', () => {
    const semester1 = { entries: [], importedAt: '2026-09-10T00:00:00.000Z', source: { documentDate: '2026-01-05T00:00:00.000Z' } };
    const semester2 = { entries: [], importedAt: '2026-09-01T00:00:00.000Z', source: { documentDate: '2026-07-05T00:00:00.000Z' } };
    expect(compareRosters('jarkom', semester2, semester1)).toBeGreaterThan(0);
  });

  it('reads DPJP dates from `days`', () => {
    const later = { days: [{ date: '2026-10-31' }], importedAt: '2026-01-01T00:00:00.000Z' };
    const earlier = { days: [{ date: '2026-09-30' }], importedAt: '2026-12-01T00:00:00.000Z' };
    expect(compareRosters('dpjp', later, earlier)).toBeGreaterThan(0);
  });

  it('is antisymmetric, so two devices can never both upload', () => {
    const a = roster(['2026-09-30'], { importedAt: '2026-09-02T00:00:00.000Z' });
    const b = roster(['2026-09-30'], { source: { documentDate: '2026-08-01T00:00:00.000Z' } });
    expect(Math.sign(compareRosters('roster', a, b))).toBe(-Math.sign(compareRosters('roster', b, a)));
  });

  it('ranks a missing document below a present one', () => {
    expect(compareRosters('roster', roster(['2026-09-01']), null)).toBeGreaterThan(0);
    expect(compareRosters('roster', null, null)).toBe(0);
  });
});

describe('coverageOf', () => {
  it('ignores rows without a usable date', () => {
    const doc = { shifts: [{ date: '2026-09-02' }, { date: 'rusak' }, {}, { date: '2026-09-01' }] };
    expect(coverageOf('pediatri', doc)).toEqual({ start: '2026-09-01', end: '2026-09-02' });
  });
});

describe('refuseOlder', () => {
  it('refuses an older schedule and says what each covers', () => {
    const refusal = refuseOlder(
      'roster',
      roster(['2026-08-01', '2026-08-31']),
      roster(['2026-09-01', '2026-09-30']),
    );
    expect(refusal).toEqual({
      incoming: '1 Agu 2026 – 31 Agu 2026',
      stored: '1 Sep 2026 – 30 Sep 2026',
    });
  });

  it('allows a newer one, the same one again, or a first import', () => {
    const sep = roster(['2026-09-30']);
    expect(refuseOlder('roster', roster(['2026-10-31']), sep)).toBeNull();
    expect(refuseOlder('roster', { ...sep, importedAt: '2026-09-05T00:00:00.000Z' }, sep)).toBeNull();
    expect(refuseOlder('roster', sep, null)).toBeNull();
  });
});

describe('describeVersion', () => {
  it('falls back to the import date when nothing else is known', () => {
    expect(describeVersion('jarkom', { entries: [], importedAt: '2026-09-17T03:00:00.000Z' })).toBe(
      'diimpor 17 Sep 2026',
    );
  });
});

describe('nearestYear', () => {
  it('dates a January sheet viewed in December to the next year', () => {
    expect(nearestYear(1, '2026-12-20')).toBe(2027);
  });

  it('dates a December sheet viewed in January to the previous year', () => {
    expect(nearestYear(12, '2027-01-03')).toBe(2026);
  });

  it('keeps the viewed year for a nearby month', () => {
    expect(nearestYear(9, '2026-10-01')).toBe(2026);
  });
});
