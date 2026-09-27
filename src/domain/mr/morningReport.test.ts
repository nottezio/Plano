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
  shiftLabel,
  DEFAULT_STATUS,
  pengampuFor,
  readMrConfig,
  readMrDay,
  staleMrDays,
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
      'Jaga Jumat, 25 September 2026',
      'Jaga Sabtu Pagi, 26 September 2026',
      'Jaga Sabtu Malam, 26 September 2026',
      'Jaga Minggu Pagi, 27 September 2026',
      'Jaga Minggu Malam, 27 September 2026',
    ]);
  });

  it('any other day covers the previous day only', () => {
    expect(coveredShifts('2026-09-30').map(shiftLabel)).toEqual(['Jaga Selasa, 29 September 2026']);
  });

  it('a start moved earlier stretches the range; a start on the MR day falls back', () => {
    expect(coveredShifts('2026-09-30', '2026-09-28')).toHaveLength(2);
    expect(coveredShifts('2026-09-30', '2026-09-30')).toHaveLength(1);
  });

  it('is capped so a mistyped year cannot flood the report', () => {
    expect(coveredShifts('2026-09-30', '2025-09-30').length).toBeLessThanOrEqual(20);
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
    const shifts = coveredShifts('2026-09-28').slice(0, 2);
    const text = buildProdiMessage({
      mrDate: '2026-09-28',
      shifts,
      patients: { [shiftKey(shifts[1]!)]: SENIOR_LIST },
      pengampu: [
        { name: 'dr. A', status: 'konfirmasi kehadiran pukul 07.00 WITA' },
        { name: 'dr. B', status: '' },
      ],
      zoom: 'Meeting ID: 000',
    });
    expect(text.startsWith(
      'Assalamualaikum dokter, tabe dokter mohon izin melaporkan pasien *Morning Report* pada hari *Senin, 28 September 2026* :',
    )).toBe(true);
    expect(text).toContain(`*Jaga Jumat, 25 September 2026*\n${NO_PATIENTS}\n\n${MR_DIVIDER}\n\n*Jaga Sabtu Pagi`);
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
    expect(config.pengampu['1']).toContain('Alkatiri');
    expect(config.statuses[0]).toBe(DEFAULT_STATUS);
    expect(pengampuFor('2026-09-28', {}, config)[0]).toEqual({ name: 'Alkatiri', status: DEFAULT_STATUS });
  });

  it("a date's own list wins over its weekday's", () => {
    const config = readMrConfig({ pengampu: { '1': ['dr. X'] } });
    expect(pengampuFor('2026-09-28', {}, config)).toEqual([{ name: 'dr. X', status: DEFAULT_STATUS }]);
    expect(pengampuFor('2026-09-28', { pengampu: [] }, config)).toEqual([]);
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
