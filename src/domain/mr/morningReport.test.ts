import { describe, expect, it } from 'vitest';

import {
  MR_DIVIDER,
  NO_PATIENTS,
  buildPakarMessage,
  buildProdiMessage,
  buildRequestMessage,
  coveredShifts,
  defaultMrDate,
  formatShiftBlock,
  parsePatients,
  shiftKey,
  parseShiftKey,
  stepMrDate,
  mrReadiness,
  shiftLabel,
  DEFAULT_STATUS,
  pengampuFor,
  readMrConfig,
  readMrDay,
  staleMrDays,
  DEFAULT_PENGAMPU,
  DEFAULT_STATUSES,
  parsePengampuLine,
  parsePengampuMessage,
} from './morningReport';

// Anonymised: initials, dates and RM numbers are invented.
const SENIOR_LIST = `*1. Tn. AB / 01-02-1960 / 66 tahun / RM 1000001 / IGD PJT Red Zone Bed 3 / DPJP : Prof. XY*
*Diagnosis:*
- NSTEMI
- CHF NYHA II

2. Ny. CD / 03-04-1970 / 56 tahun / RM 1000002 / CVCU Bed 1 / DPJP : dr. ZZ
Diagnosis :
• ADHF
• AF RVR`;

describe('covered shifts', () => {
  it('Monday covers Jumat through Minggu Malam', () => {
    expect(coveredShifts('2026-09-28').map(shiftLabel)).toEqual([
      'Dinas Jumat, 25 September 2026',
      'Jaga Jumat, 25 September 2026',
      'Jaga Sabtu Pagi, 26 September 2026',
      'Jaga Sabtu Malam, 26 September 2026',
      'Jaga Minggu Pagi, 27 September 2026',
      'Jaga Minggu Malam, 27 September 2026',
    ]);
  });

  it('any other day covers the previous day only: its Dinas, then its Jaga', () => {
    expect(coveredShifts('2026-09-30').map(shiftLabel)).toEqual([
      'Dinas Selasa, 29 September 2026',
      'Jaga Selasa, 29 September 2026',
    ]);
  });

  it('a Jaga list stored before Dinas existed keeps its key', () => {
    const jaga = coveredShifts('2026-09-30')[1]!;
    expect(shiftKey(jaga)).toBe('2026-09-29:full');
    expect(parseShiftKey('2026-09-29:dinas')).toEqual({ date: '2026-09-29', part: 'dinas' });
  });

  it('a start moved earlier stretches the range; a start on the MR day falls back', () => {
    expect(coveredShifts('2026-09-30', '2026-09-28')).toHaveLength(4);
    expect(coveredShifts('2026-09-30', '2026-09-30')).toHaveLength(2);
  });

  it('is capped so a mistyped year cannot flood the report', () => {
    // 14 days at most, two lists each.
    expect(coveredShifts('2026-09-30', '2025-09-30').length).toBeLessThanOrEqual(28);
  });

  it('prepares Monday from Friday evening', () => {
    expect(defaultMrDate('2026-09-25')).toBe('2026-09-28');
    expect(defaultMrDate('2026-09-26')).toBe('2026-09-28');
    expect(defaultMrDate('2026-09-28')).toBe('2026-09-29');
  });
});

describe('parsePatients', () => {
  it('reads bold and plain patients, both bullet styles, both labels', () => {
    const { patients, unplaced } = parsePatients(SENIOR_LIST);
    expect(unplaced).toEqual([]);
    expect(patients).toEqual([
      {
        header: 'Tn. AB / 01-02-1960 / 66 tahun / RM 1000001 / IGD PJT Red Zone Bed 3 / DPJP : Prof. XY',
        diagnoses: ['NSTEMI', 'CHF NYHA II'],
      },
      {
        header: 'Ny. CD / 03-04-1970 / 56 tahun / RM 1000002 / CVCU Bed 1 / DPJP : dr. ZZ',
        diagnoses: ['ADHF', 'AF RVR'],
      },
    ]);
  });

  it('keeps numbered diagnoses as diagnoses, not new patients', () => {
    const { patients } = parsePatients(
      '1. Tn. EF / RM 1000003 / DPJP : dr. Q\nDiagnosis:\n1. STEMI anterior\n2. Hipertensi\n2. Ny. GH / RM 1000004 / DPJP : dr. R\nDiagnosis: CAP',
    );
    expect(patients.map((p) => p.diagnoses)).toEqual([['STEMI anterior', 'Hipertensi'], ['CAP']]);
  });

  it('never drops a line it cannot place', () => {
    expect(parsePatients('tabe dok ini listnya\n1. Tn. IJ / RM 1000005').unplaced).toEqual([
      'tabe dok ini listnya',
    ]);
  });
});

describe('messages', () => {
  it('request to the senior matches the sample', () => {
    expect(
      buildRequestMessage({ sender: 'Avi', mrDate: '2026-09-28', shift: { date: '2026-09-26', part: 'malam' } }),
    ).toBe(
      'Assalamualaikum wr. wb. dokter, mohon maaf mengganggu dok, tabe dokter saya Avi Dokter PJ MR hari Senin tgl 28 September 2026 dok, mohon izin apakah boleh meminta list Jaga Sabtu Malam, 26 September 2026 yang akan di MR kan dok?\nTabe mohon arahannya dokter',
    );
  });

  it('an empty jaga says so', () => {
    expect(formatShiftBlock({ date: '2026-09-25', part: 'full' }, '  \n')).toBe(
      `*Jaga Jumat, 25 September 2026*\n${NO_PATIENTS}`,
    );
  });

  it('Prodi message: header, renumbered blocks, dividers, pengampu, zoom, closing', () => {
    const shifts = coveredShifts('2026-09-28').slice(0, 3);
    const text = buildProdiMessage({
      mrDate: '2026-09-28',
      shifts,
      patients: { [shiftKey(shifts[2]!)]: SENIOR_LIST },
      pengampu: [
        { name: 'dr. A', status: 'konfirmasi kehadiran pukul 07.00 WITA' },
        { name: 'dr. B', status: '' },
      ],
      zoom: 'Meeting ID: 000',
    });
    expect(text.startsWith(
      'Assalamualaikum dokter, tabe dokter mohon izin melaporkan pasien *Morning Report* pada hari *Senin, 28 September 2026* :',
    )).toBe(true);
    expect(text).toContain(
      `*Dinas Jumat, 25 September 2026*\n${NO_PATIENTS}\n\n${MR_DIVIDER}\n\n*Jaga Jumat, 25 September 2026*\n${NO_PATIENTS}\n\n${MR_DIVIDER}\n\n*Jaga Sabtu Pagi`,
    );
    expect(text).toContain('*2. Ny. CD / 03-04-1970');
    expect(text).toContain('*Diagnosis:*\n- ADHF\n- AF RVR');
    expect(text).toContain(
      'Pimpinan Morning Report terjadwal :\n- dr. A (konfirmasi kehadiran pukul 07.00 WITA)\n- dr. B',
    );
    expect(text.endsWith('Meeting ID: 000\n\nTabe terima kasih dokter.')).toBe(true);
  });

  it('PAKAR message matches the sample shape', () => {
    expect(
      buildPakarMessage({
        mrDate: '2026-09-28',
        pengampu: [{ name: 'dr. A', status: 'menunggu konfirmasi kehadiran' }],
      }),
    ).toBe(
      'Assalamualaikum Dokter\nMohon izin melaporkan konfirmasi kehadiran Pengampu MR, Senin, 28 September 2026:\n\nPimpinan Morning Report terjadwal:\n- dr. A (menunggu konfirmasi kehadiran)\n\nTabe terima kasih dokter',
    );
  });
});

describe('stored shape', () => {
  it('falls back to the scheduled names and default statuses', () => {
    const config = readMrConfig(undefined);
    expect(config.pengampu['1']).toContain('Dr. dr. Abdul Hakim Alkatiri, Sp.JP(K)');
    expect(config.statuses[0]).toBe(DEFAULT_STATUS);
    expect(pengampuFor('2026-09-28', {}, config)[0]).toEqual({
      name: 'Dr. dr. Abdul Hakim Alkatiri, Sp.JP(K)',
      status: DEFAULT_STATUS,
    });
  });

  it("a date's own list wins over its weekday's", () => {
    const config = readMrConfig({ pengampu: { '1': ['dr. X'] } });
    expect(pengampuFor('2026-09-28', {}, config)).toEqual([{ name: 'dr. X', status: DEFAULT_STATUS }]);
    expect(pengampuFor('2026-09-28', { pengampu: [] }, config)).toEqual([]);
  });

  it('replaces the surname-only seed of the first release, keeps real edits', () => {
    const seeded = readMrConfig({
      pengampu: { '1': ['Alkatiri', 'Idar Mappangara', 'Almudai', 'Bogie Putra Palinggi'] },
      statuses: [
        'menunggu konfirmasi kehadiran',
        'konfirmasi kehadiran pukul 07.00 WITA',
        'konfirmasi kehadiran pukul 07.30 WITA',
        'konfirmasi berhalangan hadir',
      ],
    });
    expect(seeded.pengampu['1']).toEqual(DEFAULT_PENGAMPU[1]);
    expect(seeded.statuses).toEqual(DEFAULT_STATUSES);
    expect(readMrConfig({ pengampu: { '1': ['Alkatiri'] } }).pengampu['1']).toEqual(['Alkatiri']);
  });

  it('shows full names on a date saved with the old seed, statuses intact', () => {
    const list = pengampuFor(
      '2026-09-28',
      { pengampu: [{ name: 'Bogie Putra Palinggi', status: 'hadir' }, { name: 'dr. X', status: '' }] },
      readMrConfig(undefined),
    );
    expect(list).toEqual([
      { name: 'dr. Bogie Putra Palinggi, Sp.JP', status: 'hadir' },
      { name: 'dr. X', status: '' },
    ]);
  });

  it('reads garbage without throwing', () => {
    expect(readMrDay({ patients: { a: 1, b: 'x' }, pengampu: [null, { name: 3 }] })).toEqual({
      patients: { b: 'x' },
      pengampu: [{ name: '', status: '' }],
    });
  });

  it('prunes drafts past the keep window', () => {
    expect(staleMrDays({ '2026-08-01': {}, '2026-09-20': {} }, '2026-09-27')).toEqual(['2026-08-01']);
  });
});

// Avi's sent confirmations, verbatim, including WhatsApp's U+2060 around bullets.
const SENT = `Pengampu MR, *Jumat, 25 September 2026*:
*Pimpinan Morning Report terjadwal :*
•\u2060  \u2060Dr. dr. Akhtar Fajar Muzakkir, Sp.JP(K)  (menunggu konfirmasi kehadiran)
•\u2060  \u2060\u2060dr. Zaenab Djafar, M.Kes, Sp.PD, Sp.JP(K) (menunggu konfirmasi kehadiran)
•\u2060  \u2060\u2060dr. Irmarisyani Sudirman, Sp.JP(K) (menunggu konfirmasi kehadiran)
•\u2060  \u2060\u2060dr. Sitti Multazam Sp.JP, FIHA (menunggu konfirmasi kehadiran)

pengampu MR *Selasa, 22 September 2026*:
*Pimpinan Morning Report terjadwal:*
- dr. Az Hafid Nashar, Sp.JP(K) (menunggu konfirmasi kehadiran)
- dr. Andi Alief Utama Armyn, M.Kes, Sp.JP, Subsp. KPPJB (K) (menunggu konfirmasi kehadiran)
- Prof. dr. Peter Kabo, Ph.D, Sp.FK, Sp.JP(K) (menunggu konfirmasi kehadiran)
- dr. Andi Renata Bastario, Sp.JP(K)  konfirmasi kehadiran pukul 07:30 WITA)`;

describe('reading sent confirmations', () => {
  it('splits name and status whatever the brackets do', () => {
    expect(parsePengampuLine('•\u2060  \u2060\u2060Dr. dr. Abdul Hakim Alkatiri, Sp.JP(K)(menunggu konfirmasi kehadiran)')).toEqual({
      name: 'Dr. dr. Abdul Hakim Alkatiri, Sp.JP(K)',
      status: 'menunggu konfirmasi kehadiran',
    });
    expect(parsePengampuLine('- dr. Fadillah Maricar, Sp.JP (K), FIHA (Konfirmasi kehadiran pukul 07:30 WITA)')).toEqual({
      name: 'dr. Fadillah Maricar, Sp.JP (K), FIHA',
      status: 'Konfirmasi kehadiran pukul 07:30 WITA',
    });
    expect(parsePengampuLine('- Dr. dr. Khalid Saleh, Sp.PD-KKV (Menunggu Konfirmasi kehadiran ) ')).toEqual({
      name: 'Dr. dr. Khalid Saleh, Sp.PD-KKV',
      status: 'Menunggu Konfirmasi kehadiran',
    });
  });

  it('finds each weekday block and its pengampu, and they match the defaults', () => {
    const blocks = parsePengampuMessage(SENT);
    expect(blocks.map((b) => b.weekday)).toEqual([5, 2]);
    expect(blocks[0]!.pengampu.map((p) => p.name)).toEqual(DEFAULT_PENGAMPU[5]);
    expect(blocks[1]!.pengampu.map((p) => p.name)).toEqual(DEFAULT_PENGAMPU[2]);
    expect(blocks[1]!.pengampu[3]!.status).toBe('konfirmasi kehadiran pukul 07:30 WITA');
  });
});

describe('stepMrDate', () => {
  it('skips the weekend in both directions', () => {
    // 2026-10-09 is a Friday, 2026-10-12 a Monday.
    expect(stepMrDate('2026-10-09', 1)).toBe('2026-10-12');
    expect(stepMrDate('2026-10-12', -1)).toBe('2026-10-09');
    expect(stepMrDate('2026-10-06', 1)).toBe('2026-10-07');
  });
});

describe('mrReadiness', () => {
  const shifts = [
    { date: '2026-10-05', part: 'full' as const },
    { date: '2026-10-06', part: 'pagi' as const },
  ];
  const base = {
    sender: 'Avi',
    shifts,
    patients: { [shiftKey(shifts[0]!)]: '1. Tn. A' },
    pengampu: [
      { name: 'dr. Satu', status: DEFAULT_STATUS },
      { name: 'dr. Dua', status: 'Konfirmasi kehadiran pukul 07:00 WITA' },
    ],
    zoom: '',
  };

  it('says what is missing, in page order', () => {
    expect(mrReadiness(base).map((item) => [item.label, item.ok, item.detail])).toEqual([
      ['Nama pengirim', true, 'Avi'],
      ['List pasien', false, '1/2 list terisi'],
      ['Konfirmasi pengampu', false, '1/2 sudah konfirmasi'],
      ['Blok Zoom', false, 'isi di Pengaturan MR'],
    ]);
  });

  it('is all green when everything is in', () => {
    const ready = mrReadiness({
      ...base,
      patients: { [shiftKey(shifts[0]!)]: 'x', [shiftKey(shifts[1]!)]: 'y' },
      pengampu: [{ name: 'dr. Dua', status: 'hadir via Zoom' }],
      zoom: 'Meeting ID',
    });
    expect(ready.every((item) => item.ok)).toBe(true);
  });

  it('a blank pengampu row is not counted', () => {
    const item = mrReadiness({ ...base, pengampu: [{ name: ' ', status: DEFAULT_STATUS }] })[2];
    expect(item?.detail).toBe('belum ada pengampu');
  });
});

describe('request to the senior', () => {
  it("keeps Avi's wording for a Jaga list", () => {
    const text = buildRequestMessage({ sender: 'Avi', mrDate: '2026-10-06', shift: { date: '2026-10-05', part: 'full' } });
    expect(text).toContain('apakah boleh meminta list Jaga Senin, 5 Oktober 2026 yang akan di MR kan dok?');
  });

  it('names the Dinas list the same way', () => {
    const text = buildRequestMessage({ sender: 'Avi', mrDate: '2026-10-06', shift: { date: '2026-10-05', part: 'dinas' } });
    expect(text).toContain('apakah boleh meminta list Dinas Senin, 5 Oktober 2026 yang akan di MR kan dok?');
  });
});
