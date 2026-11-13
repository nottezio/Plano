import { describe, expect, it } from 'vitest';

import {
  buildReport,
  dayKey,
  lastDays,
  quotaLevel,
  readsFor,
  summarizeAccount,
  type DayCounts,
  type DeviceUsage,
} from './usage';

const NOW = new Date(2026, 10, 13, 12, 0, 0).getTime();
const TODAY = dayKey(NOW);
const YESTERDAY = lastDays(NOW)[1] as string;

describe('readsFor', () => {
  const query = { fromCache: false, isQuery: true, size: 40, changes: 2 };

  it('bills nothing from the cache', () => {
    expect(readsFor({ ...query, fromCache: true }, true)).toBe(0);
    expect(readsFor({ ...query, fromCache: true }, false)).toBe(0);
  });

  it('bills every document on the first server snapshot, at least one', () => {
    expect(readsFor(query, true)).toBe(40);
    expect(readsFor({ ...query, size: 0 }, true)).toBe(1);
  });

  it('bills only changed documents afterwards', () => {
    expect(readsFor(query, false)).toBe(2);
    expect(readsFor({ ...query, changes: 0 }, false)).toBe(0);
  });

  it('bills a single document once per server snapshot', () => {
    const doc = { fromCache: false, isQuery: false, size: 1, changes: 1 };
    expect(readsFor(doc, true)).toBe(1);
    expect(readsFor(doc, false)).toBe(1);
  });
});

describe('quotaLevel', () => {
  it('warns from 30,000 and alarms from 40,000', () => {
    expect(quotaLevel(29_999)).toBe('ok');
    expect(quotaLevel(30_000)).toBe('warn');
    expect(quotaLevel(39_999)).toBe('warn');
    expect(quotaLevel(40_000)).toBe('danger');
  });
});

describe('lastDays', () => {
  it('lists today first, seven days', () => {
    const days = lastDays(NOW);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe(TODAY);
    expect(new Set(days).size).toBe(7);
  });
});

describe('buildReport', () => {
  it('reports today, the five biggest sources and the week', () => {
    const days: Record<string, DayCounts> = {
      [TODAY]: {
        reads: 100,
        writes: 4,
        errors: 1,
        by: { a: 10, b: 50, c: 5, d: 20, e: 8, f: 7 },
      },
      [YESTERDAY]: { reads: 30, writes: 0, errors: 0, by: {} },
    };
    const report = buildReport(days, NOW);
    expect(report).toMatchObject({ day: TODAY, reads: 100, writes: 4, errors: 1 });
    expect(report.top.map((source) => source.l)).toEqual(['b', 'd', 'a', 'e', 'f']);
    expect(report.week).toEqual({ [TODAY]: 100, [YESTERDAY]: 30 });
  });

  it('is empty before anything was counted', () => {
    expect(buildReport({}, NOW)).toMatchObject({ day: TODAY, reads: 0, top: [], week: {} });
  });
});

describe('summarizeAccount', () => {
  const device = (over: Partial<DeviceUsage>): DeviceUsage => ({
    day: TODAY,
    reads: 0,
    writes: 0,
    errors: 0,
    top: [],
    week: {},
    ...over,
  });

  it('adds up devices that reported today', () => {
    const summary = summarizeAccount(
      {
        phone: device({ reads: 100, writes: 2, errors: 1, top: [{ l: 'patients', r: 80 }], week: { [TODAY]: 100 } }),
        laptop: device({ reads: 50, top: [{ l: 'patients', r: 20 }, { l: 'floors', r: 30 }], week: { [TODAY]: 50 } }),
      },
      NOW,
    );
    expect(summary).toMatchObject({ readsToday: 150, readsWeek: 150, writesToday: 2, errorsToday: 1, devices: 2 });
    expect(summary.top).toEqual([
      { l: 'patients', r: 100 },
      { l: 'floors', r: 30 },
    ]);
  });

  it('counts a device that last reported yesterday only in the week', () => {
    const summary = summarizeAccount(
      { old: device({ day: YESTERDAY, reads: 900, week: { [YESTERDAY]: 900 } }) },
      NOW,
    );
    expect(summary.readsToday).toBe(0);
    expect(summary.readsWeek).toBe(900);
    expect(summary.devices).toBe(1);
  });

  it('ignores a device silent for more than a week', () => {
    const summary = summarizeAccount({ gone: device({ day: '2020-01-01', reads: 5, week: { '2020-01-01': 5 } }) }, NOW);
    expect(summary).toMatchObject({ readsToday: 0, readsWeek: 0, devices: 0 });
  });
});
