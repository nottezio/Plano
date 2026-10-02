import { describe, expect, it } from 'vitest';

import { DEFAULT_LAB_TITLE, headingDate, labTitleFor, labUnitLabel, readLabMeta } from './labMeta';
import { labHeading } from './parseLab';

/** Header rows as the PDF reader rebuilds them (cells joined by one space). Names anonymised. */
const header = (registered: string, resulted: string, unit: string): string =>
  [
    'HASIL PEMERIKSAAN LABORATORIUM',
    'No. RM : 01234567 No. Registrasi : 2609142110',
    `Nama : CONTOH PASIEN Tgl. Registrasi : ${registered}`,
    `Sex / Tgl Lahir : Laki-Laki / 07-06-1981 Tgl. Hasil : ${resulted}`,
    `No. Lab : 1011601062609140132 Unit Pengantar : ${unit}`,
    'Diagnosa : ACS Dokter Perujuk : dr. CONTOH, Sp.JP',
    'PEMERIKSAAN HASIL NILAI RUJUKAN SATUAN',
    'Hemoglobin 13.2 13.0 - 17.0 g/dL',
  ].join('\n');

describe('readLabMeta', () => {
  it('takes the registration (sample) date, not the result date', () => {
    const meta = readLabMeta(header('04/09/2026 23:36:06', '05/09/2026 01:59:26', 'IGD Jantung'));
    expect(meta.date).toBe('2026-09-04');
    expect(meta.unit).toBe('IGD');
  });

  it('reads two-digit years and dotted times', () => {
    expect(readLabMeta(header('14/09/26 23.50', '15/09/26 00.23', 'CVCU')).date).toBe('2026-09-14');
  });

  it('ignores the date of birth and the signature line', () => {
    const meta = readLabMeta(`${header('02/10/2026 08:00:00', '02/10/2026 09:00:00', 'PJT Perawatan Lt. 4 (Atrium)')}\nAhli Teknologi : CONTOH MAKASSAR, 03-10-2026 07:00:00`);
    expect(meta.dates).toEqual(['2026-10-02']);
    expect(meta.unit).toBe('PJT');
  });

  it('collects every date when several reports are appended, newest as the pick', () => {
    const text = `${header('14/09/2026 21:00:55', '14/09/2026 22:13:02', 'IGD Jantung')}\n\n${header('15/09/2026 09:07:56', '15/09/2026 10:38:20', 'PJT Perawatan Lt. 4 (Atrium)')}`;
    const meta = readLabMeta(text);
    expect(meta.dates).toEqual(['2026-09-14', '2026-09-15']);
    expect(meta.date).toBe('2026-09-15');
  });

  it('falls back to the result date, and to nothing for a plain paste', () => {
    expect(readLabMeta('Tgl. Hasil : 03/09/2026 14:43:09').date).toBe('2026-09-03');
    expect(readLabMeta('Hb 12.1\nNa 135').date).toBeNull();
    expect(readLabMeta('Tgl. Registrasi : 31/02/2026 10:00').date).toBeNull();
  });

  it('reads the wide layout too (columns padded with spaces)', () => {
    const wide =
      '  No. Lab               : 1011601062609210059                    Unit Pengantar         : PJT Perawatan Lt. 5 (Ventrikel)\n' +
      '  Nama                  : CONTOH                                 Tgl. Registrasi        : 21/09/2026 12:49:58';
    expect(readLabMeta(wide)).toEqual({ dates: ['2026-09-21'], date: '2026-09-21', unit: 'PJT' });
  });
});

describe('heading', () => {
  it('is written as Avi writes it', () => {
    const meta = readLabMeta(header('02/10/2026 08:00:00', '02/10/2026 09:00:00', 'PJT Perawatan Lt. 4 (Atrium)'));
    expect(labHeading(headingDate(meta.date!), labTitleFor(meta))).toBe('*Laboratorium PJT (02-10-2026)*');
  });

  it('names other units as printed, and defaults to PJT', () => {
    expect(labUnitLabel('IGD Sentral 2')).toBe('IGD');
    expect(labUnitLabel('HCU PJT')).toBe('HCU PJT');
    expect(labUnitLabel('Poli Aritmia')).toBe('Poli Aritmia');
    expect(labTitleFor({ dates: [], date: null, unit: null })).toBe(DEFAULT_LAB_TITLE);
  });
});
