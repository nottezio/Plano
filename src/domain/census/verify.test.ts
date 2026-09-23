import { describe, expect, it } from 'vitest';

import {
  selfCheckProblems,
  type DenahExtraction,
  type ListExtraction,
  type PatientLine,
} from './verify';

const line = (name: string, rm: string | null, dpjp = 'IM'): PatientLine => ({
  sourceLine: name,
  entryNumberRaw: '1.',
  room: '404',
  bed: 1,
  dpjpRaw: dpjp,
  nameRaw: name,
  rm,
  dobRaw: null,
  ageRaw: null,
  tags: [],
  residentRaw: null,
  chiefRaw: null,
  dispositionNotes: [],
  unknownNames: [],
});

const denah = (grid: PatientLine[]): DenahExtraction => ({
  documentType: 'DENAH',
  shiftDateRaw: null,
  shiftDateIso: null,
  roomBlocks: [{ room: '404', label: null, bedsListed: 4, occupiedBeds: grid.map((_, i) => i + 1) }],
  roomGrid: grid,
  dpjpTable: [{ headerRaw: 'Prof. IM', dpjpCode: 'IM', entries: grid }],
  chiefTally: [],
  holderList: [],
  operkanKeTmnLain: [],
  gantiChief: [],
  tidakDiFU: { present: false, entries: [] },
  selfCheck: { roomGridPatientCount: grid.length, dpjpTableEntryCount: grid.length, holderListEntryCount: 0 },
  extractionNotes: [],
});

const list = (entries: PatientLine[], headingCount: number | null, headerCount: number | null): ListExtraction => ({
  documentType: 'LIST_PASIEN',
  shiftDateRaw: null,
  shiftDateIso: null,
  header: {
    jumlahPasien: null, kardio: null, kjsBtkv: null, kjsTsLain: null, pediatri: null, pediKjs: null,
    perDpjp: [{ lineRaw: 'IM', dpjpCode: 'IM', count: headerCount }],
  },
  sections: [{ headingRaw: '*DPJP Prof. IM : 2 pasien*', dpjpCode: 'IM', headingCount, entries }],
  selfCheck: { headerPerDpjpLineCount: 1, bodyEntryCount: entries.length },
  extractionNotes: [],
});

describe('selfCheckProblems (ported)', () => {
  it('passes a consistent transcription', () => {
    expect(selfCheckProblems(denah([line('A', '1')]), 'DENAH')).toEqual([]);
  });

  it('catches a dropped row the model did not count', () => {
    const d = denah([line('A', '1')]);
    d.selfCheck.roomGridPatientCount = 2;
    expect(selfCheckProblems(d, 'DENAH')).toContain('roomGrid 1 ≠ selfCheck 2');
  });

  it('reports the wrong document type instead of throwing on its shape', () => {
    // The LIST dropped into the DENAH slot: no roomGrid at all.
    expect(selfCheckProblems(list([], 0, 0), 'DENAH')).toEqual(['Expected DENAH, got LIST_PASIEN']);
  });
});
