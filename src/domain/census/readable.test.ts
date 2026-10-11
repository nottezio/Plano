import { describe, expect, it } from 'vitest';

import { readableReport, readableText, shiftDateLabel, transcriptionWarning } from './readable';
import { verify } from './verifier';
import type { DenahExtraction, ListExtraction, PatientLine } from './verify';

/*
  The shape of Avi's Residency Helper report (11 Oct): one numbered item per
  patient, counts reconciled in one place, the clean ones counted, and advice.
  Names are invented (public repo).
*/

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

const karim = line('Tn. Karim', '8000014', 'IM');
const udin = line('Tn. Udin', '8000017', 'KS', { tags: ['KJS BTKV'], residentRaw: 'Qalby', chiefRaw: 'Arya' });

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


const read = (d: DenahExtraction | null, l: ListExtraction | null, previousRms?: Set<string>) => {
  const report = verify(d, l);
  return readableReport({
    issues: report.issues,
    denah: d,
    list: l,
    shiftDate: report.shiftDate,
    ...(previousRms ? { previousRms } : {}),
  });
};

const newcomer = line('Tn. Baru', '8000099', 'IM', { room: '420', bed: 2, sourceLine: 'IM/Tn. Baru/01-01-1975/50 tahun/RM 8000099 - dr. Yudi / dr. Gabi' });
const leaver = line('Ny. Pulang', '8000077', 'KS', { room: '416', bed: 1 });

describe('readableReport', () => {
  it('a clean shift says so, with the patient count', () => {
    const r = read(denah([karim, udin]), listDoc([karim, udin]));
    expect(r.headline).toBe('Bersih: semua cocok');
    expect(r.patients).toEqual([]);
    expect(r.clean.count).toBe(2);
  });

  it('one patient missing from three places is ONE item, not three', () => {
    // In the room grid only: the verifier fires O1, O2 and O3 for him.
    const grid = [karim, udin, newcomer];
    const d = denah(grid);
    d.dpjpTable = d.dpjpTable.map((col) => ({ ...col, entries: col.entries.filter((e) => e !== newcomer) }));
    d.holderList = d.holderList.map((h) => ({ ...h, entries: h.entries.filter((e) => e !== newcomer) }));
    const r = read(d, listDoc([karim, udin]));
    const item = r.patients.find((p) => p.name === 'Tn. Baru');
    expect(item?.kind).toBe('hanya-denah');
    expect(item?.summary).toBe('hanya ada di denah kamar, tidak ada di bagian lain');
    expect(item?.place).toBe('420/2');
    expect(item?.issues.map((i) => i.ruleId).sort()).toEqual(['O1', 'O2', 'O3']);
    expect(item?.presence.filter((c) => c.present === false).map((c) => c.label)).toEqual(['tabel DPJP', 'holder list', 'LIST PASIEN']);
    // The line as written, to find it again.
    expect(item?.source?.text).toContain('RM 8000099');
    expect(r.patients.filter((p) => p.name === 'Tn. Baru')).toHaveLength(1);
  });

  it('a patient still in the LIST but gone from the denah is a stale carry-over', () => {
    const r = read(denah([karim, udin]), listDoc([karim, udin, leaver]));
    const item = r.patients.find((p) => p.name === 'Ny. Pulang');
    expect(item?.kind).toBe('sisa');
    expect(item?.summary).toBe('sudah tidak ada di denah kamar, masih tertulis di LIST PASIEN');
    expect(item?.meaning).toContain('LIST PASIEN belum diperbarui');
    expect(r.advice[0]).toBe('Tanyakan ke penyusun LIST: apakah Ny. Pulang sudah pulang/pindah? Bila ya, hapus dari LIST dan sesuaikan jumlahnya.');
  });

  it('reconciles the counts in one block and names the patients behind them', () => {
    // LIST still counts the leaver: header 3 against a room grid of 2.
    const r = read(denah([karim, udin]), listDoc([karim, udin, leaver]));
    expect(r.counts?.title).toBe('Jumlah pasien tidak cocok');
    const rows = Object.fromEntries((r.counts?.rows ?? []).map((row) => [row.label, row]));
    expect(rows['Denah kamar']?.value).toBe('2');
    expect(rows['Header LIST (jumlah pasien)']?.value).toBe('3');
    expect(rows['Denah kamar']?.odd).toBe(true);
    expect(r.counts?.relatedNames).toEqual(['Ny. Pulang']);
    // Per DPJP, only the ones that disagree.
    expect(r.counts?.perDpjp.map((d) => d.dpjp)).toEqual(['KS']);
  });

  it('a header that disagrees with its own breakdown is said plainly', () => {
    const r = read(denah([karim, udin]), listDoc([karim, udin], { jumlahPasien: 4 }));
    expect(r.counts?.notes).toContain('Header LIST tidak cocok dengan rinciannya sendiri (4 vs 2).');
  });

  it('a room that differs is one item with the odd value marked', () => {
    const r = read(denah([karim, udin]), listDoc([{ ...karim, room: '402' }, udin]));
    const item = r.patients.find((p) => p.name === 'Tn. Karim');
    expect(item?.kind).toBe('beda-data');
    const room = item?.mismatches.find((m) => m.label === 'Kamar');
    expect(room?.values.filter((v) => v.odd).map((v) => v.where)).toEqual(['LIST PASIEN']);
  });

  it('cosmetic-only differences are listed apart, not numbered', () => {
    const r = read(denah([karim, udin]), listDoc([{ ...karim, nameRaw: 'Tn. Kariem' }, udin]));
    expect(r.patients).toEqual([]);
    expect(r.minor).toHaveLength(1);
    expect(r.headline).toBe('Hanya perbedaan kecil');
  });

  it('names new admissions among the clean patients when there is a previous run', () => {
    const r = read(denah([karim, udin]), listDoc([karim, udin]), new Set(['8000014']));
    expect(r.clean.newNames).toEqual(['Tn. Udin']);
  });

  it('speaks Indonesian: no rule jargon reaches the person', () => {
    const r = read(denah([karim, udin]), listDoc([karim, udin, leaver], { jumlahPasien: 5 }));
    const text = readableText(r);
    for (const word of ['Orphaned', 'room grid', 'Stale', 'view', 'JUMLAH PASIEN ≠']) expect(text).not.toContain(word);
    expect(text).toContain('*Verifikasi List — Rabu, 23-09-2026*');
    expect(text).toContain('*1. Ny. Pulang (416/1) · KS*');
    expect(text).toContain('*Saran*');
  });
});

describe('shiftDateLabel', () => {
  it('names the weekday', () => {
    expect(shiftDateLabel('2026-08-29')).toBe('Sabtu, 29-08-2026');
    expect(shiftDateLabel(null)).toBeNull();
    expect(shiftDateLabel('29 Agustus')).toBe('29 Agustus');
  });
});

describe('ordering and links', () => {
  it('a patient in one place only comes before a value that differs', () => {
    const grid = [karim, udin, newcomer];
    const d = denah(grid);
    d.dpjpTable = d.dpjpTable.map((col) => ({ ...col, entries: col.entries.filter((e) => e !== newcomer) }));
    d.holderList = d.holderList.map((h) => ({ ...h, entries: h.entries.filter((e) => e !== newcomer) }));
    const r = read(d, listDoc([karim, { ...udin, room: '402' }]));
    expect(r.patients.map((p) => p.kind)).toEqual(['hanya-denah', 'beda-data']);
    // The holder total is off because of him: said so.
    expect(r.other.find((o) => o.title === 'Jumlah di holder list tidak cocok')?.detail).toContain('Kemungkinan karena Tn. Baru');
  });
});

describe('transcriptionWarning', () => {
  it('turns the self-check into a sentence', () => {
    expect(transcriptionWarning('DENAH: roomGrid 20 ≠ selfCheck 21')).toBe(
      'DENAH: AI menghitung 21 pasien di denah kamar, tetapi menyalin 20. Mungkin ada baris yang terlewat atau terulang.',
    );
    expect(transcriptionWarning('LIST: Expected LIST_PASIEN, got DENAH')).toBe(
      'LIST PASIEN: PDF yang dipilih sebagai LIST_PASIEN ternyata DENAH. Periksa apakah PDF tertukar.',
    );
    expect(transcriptionWarning('DENAH: roomBlocks occupied 0 ≠ roomGrid 5')).toContain('Bed terisi di gambar denah (0)');
    expect(transcriptionWarning('something new')).toBe('something new');
  });
});
