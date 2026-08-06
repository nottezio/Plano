import { describe, expect, it } from 'vitest';

import {
  ARCHIVE_REASON_LABELS,
  archiveDate,
  archiveSummary,
  groupByMonth,
  monthLabel,
} from './archive';
import { makePatient } from './testFactories';
import type { Patient } from './types';

function withArchive(overrides: Parameters<typeof makePatient>[0], millis?: number): Patient {
  const patient = makePatient({ status: 'archived', ...overrides });
  return {
    ...patient,
    archive: {
      reason: 'pulang',
      at: (millis === undefined
        ? { toMillis: undefined }
        : { toMillis: () => millis }) as Patient['archive'] extends undefined
        ? never
        : NonNullable<Patient['archive']>['at'],
    },
  };
}

describe('archiveDate', () => {
  it('uses the archive timestamp once the server has resolved it', () => {
    const patient = withArchive({}, Date.UTC(2026, 7, 6, 3, 0, 0));
    expect(archiveDate(patient)).toBe('2026-08-06');
  });

  it('falls back to the last entry while the write is still queued', () => {
    const patient = withArchive({ lastEntryDate: '2026-07-29', admittedAt: '2026-07-20' });
    expect(archiveDate(patient)).toBe('2026-07-29');
  });

  it('falls back to admission when there is no entry at all', () => {
    const patient = withArchive({ admittedAt: '2026-07-20' });
    expect(archiveDate(patient)).toBe('2026-07-20');
  });
});

describe('groupByMonth', () => {
  it('groups by month, newest month first', () => {
    const groups = groupByMonth([
      withArchive({ id: 'a', lastEntryDate: '2026-07-15' }),
      withArchive({ id: 'b', lastEntryDate: '2026-08-02' }),
      withArchive({ id: 'c', lastEntryDate: '2026-08-20' }),
    ]);

    expect(groups.map((group) => group.key)).toEqual(['2026-08', '2026-07']);
    expect(groups[0]?.patients.map((patient) => patient.id)).toEqual(['c', 'b']);
  });

  it('labels months in Indonesian', () => {
    expect(monthLabel('2026-08')).toBe('Agustus 2026');
    expect(monthLabel('2027-01')).toBe('Januari 2027');
  });

  it('handles an empty list', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe('archiveSummary', () => {
  it('labels the reason', () => {
    expect(archiveSummary(withArchive({}, 0))).toBe('Pulang');
  });

  it('appends the free-text note when there is one', () => {
    const patient = withArchive({}, 0);
    const withNote: Patient = {
      ...patient,
      archive: { ...patient.archive!, note: 'rawat jalan poli paru' },
    };
    expect(archiveSummary(withNote)).toBe('Pulang — rawat jalan poli paru');
  });

  it('covers every reason', () => {
    expect(Object.keys(ARCHIVE_REASON_LABELS)).toEqual([
      'pulang',
      'pindah',
      'meninggal',
      'lainnya',
    ]);
  });
});
