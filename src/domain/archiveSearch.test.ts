import { describe, expect, it } from 'vitest';

import {
  NO_ARCHIVE_FILTERS,
  archiveFacets,
  findSnippet,
  hasArchiveFilters,
  matchArchived,
  matchesArchiveFilters,
  searchTokens,
} from './archiveSearch';
import { makePatient } from './testFactories';
import type { Patient } from './types';

const at = (iso: string) =>
  ({ toMillis: () => Date.parse(`${iso}T08:00:00Z`) }) as unknown as NonNullable<Patient['archive']>['at'];

const archived = (over: Partial<Patient>, reason: 'pulang' | 'meninggal' = 'pulang', date = '2026-09-10') =>
  makePatient({ status: 'archived', archive: { reason, at: at(date) }, ...over });

describe('matchArchived', () => {
  const soap = 'S: sesak\nO: TD 90/60\nP: Furosemid 40 mg iv, konsul TS Nefro untuk HD';
  const patient = archived({ name: 'Tn. Contoh', diagnoses: ['CHF'], notes: 'Alergi seftriakson' });

  it('matches the fields alone, with no snippet', () => {
    expect(matchArchived(patient, searchTokens('contoh chf'))).toEqual({ patient, snippet: null });
  });

  it('does not look in the notes unless they are given', () => {
    expect(matchArchived(patient, searchTokens('nefro'))).toBeNull();
  });

  it('finds words in the SOAP and says where', () => {
    const match = matchArchived(patient, searchTokens('nefro'), soap);
    expect(match?.snippet).toContain('konsul TS Nefro');
  });

  it('finds words in the Catatan pasien', () => {
    expect(matchArchived(patient, searchTokens('seftriakson'), `${patient.notes}\n${soap}`)).not.toBeNull();
  });

  it('needs every word, across fields and notes, in any order', () => {
    expect(matchArchived(patient, searchTokens('contoh furosemid'), soap)).not.toBeNull();
    expect(matchArchived(patient, searchTokens('contoh digoxin'), soap)).toBeNull();
  });
});

describe('findSnippet', () => {
  it('cuts around the first hit on one line, with ellipses', () => {
    const text = `${'a'.repeat(100)}\nkonsul Nefro\n${'b'.repeat(100)}`;
    const snippet = findSnippet(text, ['nefro'], 10)!;
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
    expect(snippet).toContain('konsul Nefro');
    expect(snippet).not.toContain('\n');
  });

  it('cuts on whole words', () => {
    const snippet = findSnippet('Alergi seftriakson dan sesak berat, konsul Nefro untuk HD segera hari ini', ['nefro'], 12)!;
    expect(snippet).toBe('…konsul Nefro untuk HD…');
  });

  it('is null when nothing is found', () => {
    expect(findSnippet('abc', ['x'])).toBeNull();
  });
});

describe('filters and facets', () => {
  const a = archived({ id: 'a', dpjpId: 'pk', ward: 'PJT Lt. 4' }, 'pulang', '2026-09-10');
  const b = archived({ id: 'b', dpjpId: 'pk', ward: 'PJT Lantai 4' }, 'meninggal', '2026-08-02');
  const c = archived({ id: 'c', dpjpId: 'mz', ward: 'CVCU' }, 'pulang', '2026-09-20');
  const all = [a, b, c];

  it('offers only values that occur, counted, ward spellings merged', () => {
    const facets = archiveFacets(all);
    expect(facets.dpjps.map((f) => [f.value, f.count])).toEqual([['pk', 2], ['mz', 1]]);
    expect(facets.wards).toHaveLength(2);
    expect(facets.wards[0]?.count).toBe(2);
    expect(facets.reasons.map((f) => f.value).sort()).toEqual(['meninggal', 'pulang']);
    expect(facets.months.map((f) => f.value)).toEqual(['2026-09', '2026-08']);
  });

  it('filters by each facet, and by all of them together', () => {
    const wardPk = archiveFacets(all).wards[0]!.value;
    expect(all.filter((p) => matchesArchiveFilters(p, { ...NO_ARCHIVE_FILTERS, dpjp: 'pk' }))).toEqual([a, b]);
    expect(all.filter((p) => matchesArchiveFilters(p, { ...NO_ARCHIVE_FILTERS, ward: wardPk }))).toEqual([a, b]);
    expect(all.filter((p) => matchesArchiveFilters(p, { ...NO_ARCHIVE_FILTERS, reason: 'meninggal' }))).toEqual([b]);
    expect(all.filter((p) => matchesArchiveFilters(p, { ...NO_ARCHIVE_FILTERS, month: '2026-09' }))).toEqual([a, c]);
    expect(
      all.filter((p) =>
        matchesArchiveFilters(p, { dpjp: 'pk', ward: wardPk, reason: 'pulang', month: '2026-09' }),
      ),
    ).toEqual([a]);
  });

  it('knows when any filter is on', () => {
    expect(hasArchiveFilters(NO_ARCHIVE_FILTERS)).toBe(false);
    expect(hasArchiveFilters({ ...NO_ARCHIVE_FILTERS, month: '2026-09' })).toBe(true);
  });
});

describe('matchArchivedScoped (2026-09-29)', () => {
  it('searches only the chosen scopes', async () => {
    const { matchArchivedScoped } = await import('./archiveSearch');
    const { makePatient } = await import('./testFactories');
    const patient = makePatient({
      name: 'Tn. Contoh',
      archive: { reason: 'pulang', at: null as never, note: 'Kontrol poli valvular' },
    } as never);
    const soap = 'P: furosemid 40 mg';
    const identity = new Set(['identitas'] as const);
    const note = new Set(['arsip'] as const);
    const all = new Set(['identitas', 'arsip', 'soap'] as const);
    expect(matchArchivedScoped(patient, ['contoh'], identity, soap)).not.toBeNull();
    expect(matchArchivedScoped(patient, ['valvular'], identity, soap)).toBeNull();
    expect(matchArchivedScoped(patient, ['valvular'], note, soap)?.from).toBe('arsip');
    expect(matchArchivedScoped(patient, ['contoh'], note, soap)).toBeNull();
    expect(matchArchivedScoped(patient, ['furosemid'], note, soap)).toBeNull();
    const hit = matchArchivedScoped(patient, ['contoh', 'furosemid'], all, soap);
    expect(hit?.from).toBe('soap');
    expect(hit?.snippet).toContain('furosemid');
  });
});
