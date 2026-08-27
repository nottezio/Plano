import { describe, expect, it } from 'vitest';

import {
  AUTO_LOCK_HOURS,
  IGD_ENTRY,
  addDays,
  clinicalDate,
  daysBetween,
  formatDayHeader,
  formatLongDate,
  formatShortDate,
  hariRawat,
  isClinicalDate,
  isDateLike,
  isIgdEntry,
  localHour,
  previousDay,
  relativeDayLabel,
  shouldAutoLock,
  yesterdayHint,
} from './clinicalDate';
import type { ClinicalDate } from './types';

const JKT = 'Asia/Jakarta'; // UTC+7, no DST
const NY = 'America/New_York'; // UTC-4/-5, has DST

/** Helper: an instant expressed as Jakarta wall-clock time. */
function jakarta(iso: string): Date {
  return new Date(`${iso}+07:00`);
}

describe('clinicalDate — rollover at 00:00', () => {
  it('a 23:59 note and a 00:01 note land on different days', () => {
    expect(clinicalDate(jakarta('2026-08-06T23:59:00'), JKT, 0)).toBe('2026-08-06');
    expect(clinicalDate(jakarta('2026-08-07T00:01:00'), JKT, 0)).toBe('2026-08-07');
  });

  it('midnight exactly belongs to the new day', () => {
    expect(clinicalDate(jakarta('2026-08-07T00:00:00'), JKT, 0)).toBe('2026-08-07');
  });

  it('crosses a month boundary', () => {
    expect(clinicalDate(jakarta('2026-08-31T23:59:00'), JKT, 0)).toBe('2026-08-31');
    expect(clinicalDate(jakarta('2026-09-01T00:00:00'), JKT, 0)).toBe('2026-09-01');
  });

  it('crosses a year boundary', () => {
    expect(clinicalDate(jakarta('2026-12-31T23:30:00'), JKT, 0)).toBe('2026-12-31');
    expect(clinicalDate(jakarta('2027-01-01T00:30:00'), JKT, 0)).toBe('2027-01-01');
  });
});

describe('clinicalDate — the rollover hour is a parameter, not a constant', () => {
  it('a 06:00 rollover keeps 01:30 on the previous day', () => {
    expect(clinicalDate(jakarta('2026-08-07T01:30:00'), JKT, 6)).toBe('2026-08-06');
    expect(clinicalDate(jakarta('2026-08-07T05:59:00'), JKT, 6)).toBe('2026-08-06');
    expect(clinicalDate(jakarta('2026-08-07T06:00:00'), JKT, 6)).toBe('2026-08-07');
  });

  it('a 06:00 rollover steps back across a month boundary', () => {
    expect(clinicalDate(jakarta('2026-09-01T02:00:00'), JKT, 6)).toBe('2026-08-31');
  });
});

describe('clinicalDate — timezone correctness', () => {
  it('the same instant is a different clinical day in Jakarta and New York', () => {
    // 2026-08-06T20:00Z = 07 Aug 03:00 Jakarta, 06 Aug 16:00 New York.
    const instant = new Date('2026-08-06T20:00:00Z');
    expect(clinicalDate(instant, JKT, 0)).toBe('2026-08-07');
    expect(clinicalDate(instant, NY, 0)).toBe('2026-08-06');
  });

  it('reports the local wall-clock hour, not the host hour', () => {
    const instant = new Date('2026-08-06T20:00:00Z');
    expect(localHour(instant, JKT)).toBe(3);
    expect(localHour(instant, NY)).toBe(16);
  });

  it('survives a DST transition in a zone that has one', () => {
    // US DST ends 2026-11-01 at 02:00 local. 05:30Z is 01:30 EDT (still 1 Nov).
    expect(clinicalDate(new Date('2026-11-01T05:30:00Z'), NY, 0)).toBe('2026-11-01');
    // 06:30Z is 01:30 EST after the fall back — still 1 Nov, not 31 Oct.
    expect(clinicalDate(new Date('2026-11-01T06:30:00Z'), NY, 0)).toBe('2026-11-01');
  });

  it('date arithmetic is unaffected by a DST boundary', () => {
    // Naive local-midnight arithmetic returns 23:00 the same day here.
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });
});

describe('hariRawat', () => {
  it('admission day is day 1', () => {
    expect(hariRawat('2026-08-06', '2026-08-06')).toBe(1);
  });

  it('counts calendar days, not elapsed 24 h periods', () => {
    expect(hariRawat('2026-08-09', '2026-08-06')).toBe(4);
  });

  it('is correct across a month boundary', () => {
    expect(hariRawat('2026-09-02', '2026-08-30')).toBe(4);
  });

  it('is correct across a year boundary', () => {
    expect(hariRawat('2027-01-02', '2026-12-30')).toBe(4);
  });

  it('is correct across a leap day', () => {
    expect(hariRawat('2028-03-01', '2028-02-28')).toBe(3);
  });
});

describe('formatting', () => {
  it('renders the long Indonesian form', () => {
    expect(formatLongDate('2026-08-06')).toBe('Kamis, 6 Agustus 2026');
  });

  it('renders the patient page header exactly as specified', () => {
    expect(formatDayHeader('2026-08-06', '2026-08-03')).toBe(
      'Kamis, 6 Agustus 2026 · Hari rawat ke-4',
    );
  });

  it('labels relative days', () => {
    expect(relativeDayLabel('2026-08-06', '2026-08-06')).toBe('Hari ini');
    expect(relativeDayLabel('2026-08-05', '2026-08-06')).toBe('Kemarin');
    expect(relativeDayLabel('2026-08-07', '2026-08-06')).toBe('Besok');
    // date-fns' Indonesian locale abbreviates Agustus as "Agt" (KBBI form).
    expect(relativeDayLabel('2026-08-01', '2026-08-06')).toBe('1 Agt');
  });
});

describe('isClinicalDate', () => {
  it('accepts a real date', () => {
    expect(isClinicalDate('2026-08-06')).toBe(true);
  });

  it('rejects malformed and impossible dates', () => {
    expect(isClinicalDate('2026-8-6')).toBe(false);
    expect(isClinicalDate('06-08-2026')).toBe(false);
    expect(isClinicalDate('2026-02-30')).toBe(false);
    expect(isClinicalDate('2026-13-01')).toBe(false);
  });
});

describe('yesterdayHint — night shift', () => {
  const base = {
    tz: JKT,
    rolloverHour: 0,
    selectedDate: '2026-08-07',
    hasYesterdayEntry: true,
  };

  it('appears between 00:00 and 06:00 when yesterday has an entry', () => {
    const hint = yesterdayHint({ ...base, now: jakarta('2026-08-07T01:30:00') });
    expect(hint).not.toBeNull();
    expect(hint?.yesterday).toBe('2026-08-06');
    expect(hint?.message).toBe('Sekarang sudah tanggal 7. Menulis untuk 6 Agustus?');
  });

  it('is silent at 06:00 and after', () => {
    expect(yesterdayHint({ ...base, now: jakarta('2026-08-07T06:00:00') })).toBeNull();
    expect(yesterdayHint({ ...base, now: jakarta('2026-08-07T14:00:00') })).toBeNull();
  });

  it('is silent when yesterday has no entry', () => {
    expect(
      yesterdayHint({
        ...base,
        hasYesterdayEntry: false,
        now: jakarta('2026-08-07T01:30:00'),
      }),
    ).toBeNull();
  });

  it('is silent when the user is already looking at another day', () => {
    expect(
      yesterdayHint({
        ...base,
        selectedDate: '2026-08-06',
        now: jakarta('2026-08-07T01:30:00'),
      }),
    ).toBeNull();
  });

  it('never redirects — it only returns a suggestion', () => {
    const hint = yesterdayHint({ ...base, now: jakarta('2026-08-07T02:00:00') });
    // The contract is data, not navigation: the selected date is untouched.
    expect(base.selectedDate).toBe('2026-08-07');
    expect(hint?.today).toBe('2026-08-07');
  });
});

describe('shouldAutoLock', () => {
  it('leaves today and yesterday unlocked', () => {
    const now = jakarta('2026-08-07T09:00:00');
    expect(shouldAutoLock('2026-08-07', now, JKT, 0)).toBe(false);
    expect(shouldAutoLock('2026-08-06', now, JKT, 0)).toBe(false);
  });

  it('locks entries at or beyond the 48 h threshold', () => {
    const now = jakarta('2026-08-07T09:00:00');
    expect(shouldAutoLock('2026-08-05', now, JKT, 0)).toBe(true);
    expect(AUTO_LOCK_HOURS).toBe(48);
  });
});

describe('previousDay', () => {
  it('steps back across a year boundary', () => {
    expect(previousDay('2027-01-01')).toBe('2026-12-31');
  });
});

describe('the admission entry is not a date', () => {
  it('does not throw when asked for the day before it', () => {
    // `previousDay(IGD_ENTRY)` made an Invalid Date, and `toISOString()` on
    // that throws — which took the whole patient page down.
    expect(() => previousDay(IGD_ENTRY)).not.toThrow();
    expect(previousDay(IGD_ENTRY)).toBe(IGD_ENTRY);
  });

  it('has no next day either', () => {
    expect(addDays(IGD_ENTRY, 1)).toBe(IGD_ENTRY);
  });

  it('still does arithmetic on real dates', () => {
    expect(addDays('2026-08-31' as ClinicalDate, 1)).toBe('2026-09-01');
    expect(previousDay('2026-09-01' as ClinicalDate)).toBe('2026-08-31');
  });

  it('reads as the admission note in the day header', () => {
    expect(formatDayHeader(IGD_ENTRY, '2026-08-20' as ClinicalDate)).toContain('SOAP Awal');
  });

  it('recognises a real date from an entry id', () => {
    expect(isDateLike('2026-08-25')).toBe(true);
    expect(isDateLike('igd')).toBe(false);
  });
});

describe('labels survive an entry id that is not a date', () => {
  it('formats the admission entry as IGD rather than throwing', () => {
    // date-fns throws on an invalid date, and these callers are all labels —
    // a page that cannot render a date should still render the page.
    expect(() => formatShortDate(IGD_ENTRY)).not.toThrow();
    expect(formatShortDate(IGD_ENTRY)).toBe('Awal');
  });

  it('returns zero days rather than NaN', () => {
    expect(daysBetween(IGD_ENTRY, '2026-08-25' as ClinicalDate)).toBe(0);
    expect(daysBetween('2026-08-20' as ClinicalDate, '2026-08-25' as ClinicalDate)).toBe(5);
  });
});

describe('sorting entry ids', () => {
  it('shows why the admission note must be excluded from the default', () => {
    // Entries come back ordered by id descending. `'igd'` beats every date
    // string, so a plain `[0]` picked it every time.
    const ids = ['2026-08-25', 'igd', '2026-08-24'].sort().reverse();
    expect(ids[0]).toBe('igd');
    expect(ids.find((id) => !isIgdEntry(id as ClinicalDate))).toBe('2026-08-25');
  });
});
