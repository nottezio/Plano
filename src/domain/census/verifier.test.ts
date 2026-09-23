import { describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG, diffAgainstPrevious, matchPatients, flatten, verify } from './verifier';
import type { DenahExtraction, ListExtraction, PatientLine } from './verify';

/* ------------------------------------------------------------------ */
/* Fixtures: a small shift, consistent unless a test breaks it.        */
/* ------------------------------------------------------------------ */

const line = (
  name: string,
  rm: string | null,
  dpjp: string,
  extra: Partial<PatientLine> = {},
): PatientLine => ({
  sourceLine: `${dpjp}/${name}/RM ${rm ?? ''}`,
  entryNumberRaw: '1.',
  room: '404',
  bed: 1,
  dpjpRaw: dpjp,
  nameRaw: name,
  rm,
  dobRaw: null,
  ageRaw: null,
  tags: [],
  residentRaw: 'Yudi',
  chiefRaw: 'Gabi',
  dispositionNotes: [],
  unknownNames: [],
  ...extra,
});

const kahar = line('Tn. Kahar', '1709802', 'IM');
const udis = line('Tn. Udis', '1607407', 'KS', { tags: ['KJS BTKV'], residentRaw: 'Qalby', chiefRaw: 'Arya' });
const suharti = line('Suharti', '769889', 'NP', { residentRaw: null, chiefRaw: null });

function denah(grid: PatientLine[], over: Partial<DenahExtraction> = {}): DenahExtraction {
  const byCode = new Map<string, PatientLine[]>();
  for (const l of grid) byCode.set(l.dpjpRaw, [...(byCode.get(l.dpjpRaw) ?? []), l]);
  const holders = grid.filter((l) => l.residentRaw);
  return {
    documentType: 'DENAH',
    shiftDateRaw: null,
    shiftDateIso: '2026-09-23',
    roomBlocks: [{ room: '404', label: null, bedsListed: 6, occupiedBeds: grid.map((_, i) => i + 1) }],
    roomGrid: grid,
    dpjpTable: [...byCode].map(([code, entries]) => ({ headerRaw: code, dpjpCode: code, entries })),
    chiefTally: [
      { lineRaw: 'dr. Gabi', chiefRaw: 'dr. Gabi', count: grid.filter((l) => l.chiefRaw === 'Gabi').length },
      { lineRaw: 'dr. Arya', chiefRaw: 'dr. Arya', count: grid.filter((l) => l.chiefRaw === 'Arya').length },
    ],
    holderList: [{ residentHeaderRaw: '*Yudi*', entries: holders }],
    operkanKeTmnLain: [],
    gantiChief: [],
    tidakDiFU: {
      present: true,
      entries: ['YP', 'AAU', 'NP'].map((cat) => ({
        categoryRaw: cat,
        count: grid.filter((l) => l.dpjpRaw === cat).length,
      })),
    },
    selfCheck: { roomGridPatientCount: grid.length, dpjpTableEntryCount: grid.length, holderListEntryCount: holders.length },
    extractionNotes: [],
    ...over,
  };
}

function listDoc(entries: PatientLine[], over: Partial<ListExtraction['header']> = {}): ListExtraction {
  const byCode = new Map<string, PatientLine[]>();
  for (const l of entries) byCode.set(l.dpjpRaw, [...(byCode.get(l.dpjpRaw) ?? []), l]);
  const btkv = entries.filter((l) => l.tags.includes('KJS BTKV')).length;
  return {
    documentType: 'LIST_PASIEN',
    shiftDateRaw: null,
    shiftDateIso: '2026-09-23',
    header: {
      jumlahPasien: entries.length,
      kardio: entries.length - btkv,
      kjsBtkv: btkv,
      kjsTsLain: 0,
      pediatri: 0,
      pediKjs: 0,
      perDpjp: [...byCode].map(([code, rows]) => ({ lineRaw: code, dpjpCode: code, count: rows.length })),
      ...over,
    },
    sections: [...byCode].map(([code, rows]) => ({
      headingRaw: `*dr. ${code} : ${String(rows.length)} pasien*`,
      dpjpCode: code,
      headingCount: rows.length,
      entries: rows.map((row) => ({ ...row, hasClinicalDetail: true })),
    })),
    selfCheck: { headerPerDpjpLineCount: byCode.size, bodyEntryCount: entries.length },
    extractionNotes: [],
  };
}

const rules = (report: ReturnType<typeof verify>): string[] => report.issues.map((i) => i.ruleId);

/* ------------------------------------------------------------------ */

describe('a consistent shift', () => {
  it('is CLEAN', () => {
    const grid = [kahar, udis, suharti];
    const report = verify(denah(grid), listDoc(grid));
    expect(report.issues).toEqual([]);
    expect(report.verdict).toBe('CLEAN');
    expect(report.patientCount).toBe(3);
  });
});

describe('the original rules, as written', () => {
  it('O3: a patient in the room grid with no LIST entry', () => {
    const report = verify(denah([kahar, udis]), listDoc([kahar]));
    expect(rules(report)).toContain('O3');
  });

  it('O4: a LIST entry with no room-grid line (likely discharged)', () => {
    const report = verify(denah([kahar]), listDoc([kahar, udis]));
    expect(rules(report)).toContain('O4');
  });

  it('P2: different shift dates are flagged first', () => {
    const d = denah([kahar]);
    d.shiftDateIso = '2026-09-22';
    expect(verify(d, listDoc([kahar])).issues[0]?.ruleId).toBe('P2');
  });

  it('F3: a stale chief in the LIST after rotation', () => {
    const report = verify(denah([kahar]), listDoc([{ ...kahar, chiefRaw: 'Arya' }]));
    expect(rules(report)).toContain('F3');
  });

  it('F4: the room differs between views (the Haruna case)', () => {
    const report = verify(denah([kahar]), listDoc([{ ...kahar, room: '402' }]));
    expect(rules(report)).toContain('F4');
  });

  it('unassigned categories are not expected in the holder-list', () => {
    const report = verify(denah([kahar, suharti]), listDoc([kahar, suharti]));
    expect(rules(report)).not.toContain('O2');
  });
});

describe('PORT fixes', () => {
  it('compiles: C3 fires with a normal comparison object', () => {
    const report = verify(denah([kahar, udis]), listDoc([kahar, udis], {
      perDpjp: [
        { lineRaw: 'IM', dpjpCode: 'IM', count: 3 },
        { lineRaw: 'KS', dpjpCode: 'KS', count: 1 },
      ],
    }));
    const c3 = report.issues.find((i) => i.ruleId === 'C3');
    expect(c3?.comparison).toMatchObject({ header: '3', roomGrid: '1' });
  });

  it('gives each DPJP its own C3 id, so diffing cannot confuse them', () => {
    const grid = [kahar, udis];
    const report = verify(denah(grid), listDoc(grid, {
      perDpjp: [
        { lineRaw: 'IM', dpjpCode: 'IM', count: 4 },
        { lineRaw: 'KS', dpjpCode: 'KS', count: 4 },
      ],
    }));
    const ids = report.issues.filter((i) => i.ruleId === 'C3').map((i) => i.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('marks the RIGHT DPJP resolved when only one is fixed', () => {
    const grid = [kahar, udis];
    const bad = verify(denah(grid), listDoc(grid, {
      perDpjp: [
        { lineRaw: 'IM', dpjpCode: 'IM', count: 4 },
        { lineRaw: 'KS', dpjpCode: 'KS', count: 4 },
      ],
    }));
    const fixedIm = verify(
      denah(grid),
      listDoc(grid, { perDpjp: [
        { lineRaw: 'IM', dpjpCode: 'IM', count: 1 },
        { lineRaw: 'KS', dpjpCode: 'KS', count: 4 },
      ] }),
      DEFAULT_CONFIG,
      bad.issues,
    );
    expect(fixedIm.resolvedSinceLastRun.map((i) => i.title)).toEqual(['Per-DPJP count mismatch: IM']);
    expect(fixedIm.issues.find((i) => i.ruleId === 'C3')?.status).toBe('persisting');
  });

  it('checks a DPJP that is not in the configured roster', () => {
    const newDoc = line('Ny. Baru', '999', 'XY');
    const report = verify(denah([newDoc]), listDoc([newDoc], {
      perDpjp: [{ lineRaw: 'XY', dpjpCode: 'XY', count: 3 }],
    }));
    expect(report.issues.some((i) => i.id.startsWith('C3:XY:'))).toBe(true);
  });

  it('O5: one issue per vanished patient, named, with its own id', () => {
    const report = verify(
      denah([kahar]),
      listDoc([kahar]),
      DEFAULT_CONFIG,
      [],
      new Set(['1709802', '1607407', '769889']),
      { '1607407': 'Tn. Udis' },
    );
    const vanished = report.issues.filter((i) => i.ruleId === 'O5');
    expect(vanished).toHaveLength(2);
    expect(new Set(vanished.map((i) => i.id)).size).toBe(2);
    expect(vanished.map((i) => i.title)).toContain('Patient vanished: Tn. Udis');
    // It no longer claims a notation search that never happened.
    expect(vanished.every((i) => !/notation found/.test(i.detail))).toBe(true);
  });

  it('matches a line whose RM is missing to the same patient by name', () => {
    const noRm = { ...kahar, rm: null };
    const report = verify(denah([kahar]), listDoc([noRm]));
    // One patient, not an O3 orphan plus an O4 stale entry.
    expect(rules(report)).not.toContain('O3');
    expect(rules(report)).not.toContain('O4');
  });

  it('does not merge a name-only line when two RMs share the name', () => {
    const twinA = line('Tn. Ahmad', '111', 'IM');
    const twinB = line('Tn. Ahmad', '222', 'IM');
    const views = flatten(denah([twinA, twinB]), listDoc([{ ...twinA, rm: null }]), DEFAULT_CONFIG);
    const matched = matchPatients(views);
    expect(matched.some((m) => m.key === 'name:ahmad')).toBe(true);
  });

  it('C9 says what it counted', () => {
    const d = denah([kahar]);
    d.chiefTally = [{ lineRaw: 'dr. Gabi 5', chiefRaw: 'dr. Gabi', count: 5 }];
    const c9 = verify(d, listDoc([kahar])).issues.find((i) => i.ruleId === 'C9');
    expect(c9?.detail).toContain('confirmed aliases');
    expect(c9?.detail).not.toContain('if unconfirmed name variants are folded in');
  });
});

describe('spec items the original did not implement', () => {
  it('transposition: two counts swapped, total still right, reported once', () => {
    const grid = [kahar, udis, line('Ny. Sari', '333', 'KS', { residentRaw: 'Qalby', chiefRaw: 'Arya' })];
    const report = verify(denah(grid), listDoc(grid, {
      perDpjp: [
        { lineRaw: 'IM', dpjpCode: 'IM', count: 2 },
        { lineRaw: 'KS', dpjpCode: 'KS', count: 1 },
      ],
    }));
    const swapped = report.issues.filter((i) => i.ruleId === 'C3T');
    expect(swapped).toHaveLength(1);
    expect(swapped[0]?.title).toBe('Counts swapped between IM and KS');
    expect(rules(report)).not.toContain('C3');
    expect(rules(report)).not.toContain('C2');
  });

  it('F5: a dual code in the room grid is cosmetic when other views agree', () => {
    const report = verify(denah([{ ...kahar, dpjpRaw: 'IM-NP' }]), listDoc([kahar]));
    const f5 = report.issues.find((i) => i.ruleId === 'F5');
    expect(f5?.severity).toBe('cosmetic');
  });

  it('F6: same RM, different spelling of the name', () => {
    const report = verify(denah([kahar]), listDoc([{ ...kahar, nameRaw: 'Tn. Kahhar' }]));
    expect(report.issues.find((i) => i.ruleId === 'F6')?.severity).toBe('cosmetic');
  });
});

describe('diffAgainstPrevious (Stage 6, original)', () => {
  it('splits into persisting, new and resolved by id', () => {
    const a = { id: 'x', ruleId: 'O3', severity: 'high' as const, title: 'a', detail: '', patients: [], status: 'new' as const };
    const b = { ...a, id: 'y', title: 'b' };
    const c = { ...a, id: 'z', title: 'c' };
    const { issues, resolved } = diffAgainstPrevious([a, c], [a, b]);
    expect(issues.map((i) => [i.id, i.status])).toEqual([['x', 'persisting'], ['z', 'new']]);
    expect(resolved.map((i) => i.id)).toEqual(['y']);
  });
});
