import { describe, expect, it } from 'vitest';

import { newRosterPatient } from './floor';
import type { FloorPatient } from './report';
import { checkSlaber, nameKey, readBed, readNameCell, readSlaber } from './slaber';

const t = (text: string): string => text.split('\n').map((line) => `<w:p><w:r><w:t xml:space="preserve">${line}</w:t></w:r></w:p>`).join('');
const tc = (text: string, span = 1): string => `<w:tc><w:tcPr>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}</w:tcPr>${t(text)}</w:tc>`;
const vitals = '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>120/80</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
const tr = (...cells: string[]): string => `<w:tr><w:trPr/>${cells.join('')}</w:tr>`;

/** Invented patients; the shape of the ward's "Laporan dinas" sheet. */
const XML =
  '<w:document><w:body><w:tbl><w:tblPr/>' +
  tr(tc('LAPORAN DINAS MALAM/ TIMBANG - TERIMA PJT LANTAI 4\nHARI/TANGGAL : SENIN, 12-10-2026\nSHIFT : MALAM', 9)) +
  tr(tc('BED'), tc('NAMA'), tc('SITUASI', 2), tc('BACKGROUND'), tc('DIAGNOSA'), tc('RECOMMENDATION'), tc('DPJP +\nDR KJS'), tc('KATIM')) +
  // Cells by content: this row has ONE situasi cell, so its DPJP is a column earlier.
  tr(tc('420\nBED\n2'), tc('CONTOH SATU\nRM : 1600001\nTTL : 01-01-1960\nMRS : 12-10-2026'), `<w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr>${t('Terpasang')}${vitals}</w:tc>`, tc('-'), tc('-'), tc('-'), tc('DPJP\nDr. dr. Akhtar Fajar Muzakkar Ali Aspar, Sp.JP\n\nKJS EMD\ndr. Lain, Sp.PD'), tc('A')) +
  tr(tc('421 BED 1'), tc('CONTOH DUA\nRM : 0001600002'), tc('x'), tc('y'), tc('-'), tc('-'), tc('-'), tc('DPJP\ndr. Bedah Saja, Sp.BTKV'), tc('A')) +
  tr(tc('404'), tc('CONTOH TIGA\n1600003\nTTL: 01-01-1970'), tc('x'), tc('y'), tc('-'), tc('-'), tc('-'), tc('DPJP\ndr. Internis, Sp.PD, KKV\n\nKJS ARITMIA\nProf. Dr. dr. Muzakkir Amir, Sp.JP, Subsp.Ar(K)'), tc('A')) +
  tr(tc('418 BED 3'), tc('CONTOH EMPAT\nRM : 1600004'), tc('x'), tc('y'), tc('-'), tc('-'), tc('-'), tc('DPJP\ndr. Seseorang, Sp.JP'), tc('A')) +
  // The summary under the table: no RM, not a patient.
  tr(tc('KAMAR'), tc('NAMA'), tc(''), tc(''), tc(''), tc(''), tc(''), tc(''), tc('')) +
  '</w:tbl></w:body></w:document>';

const patient = (over: Partial<FloorPatient>): FloorPatient => ({ key: `rm:${over.rm}`, name: '', rm: '', room: '', bed: '', ...over }) as FloorPatient;

describe('the nurses\' handover sheet (13.12)', () => {
  it('reads date, shift and the patient rows; cells found by content; nested tables and summary rows ignored', () => {
    const sheet = readSlaber(XML);
    expect([sheet.day, sheet.shift]).toEqual(['SENIN, 12-10-2026', 'MALAM']);
    expect(sheet.rows.map((r) => [r.room, r.bed, r.name, r.rm, r.dpjpIds, r.cardio])).toEqual([
      ['420', '2', 'CONTOH SATU', '1600001', ['afm'], true],
      ['421', '1', 'CONTOH DUA', '0001600002', [], false],
      ['404', '', 'CONTOH TIGA', '1600003', ['mz'], true],
      ['418', '3', 'CONTOH EMPAT', '1600004', [], true],
    ]);
  });

  it('bed and name cells in the sheet\'s spellings', () => {
    expect(readBed('420\nBED\n2')).toEqual({ room: '420', bed: '2' });
    expect(readBed('413\nBed 2')).toEqual({ room: '413', bed: '2' });
    expect(readNameCell('CONTOH\n1734603\nTTL: x')).toEqual({ name: 'CONTOH', rm: '1734603' });
    expect(nameKey('H.MUH USMAN , A.MA.PD')).toBe(nameKey('Tn. H. Muh Usman'));
  });

  it('compares with the list: missing cardiology patients, list patients not on the sheet, other places', () => {
    const sheet = readSlaber(XML);
    const active = [
      patient({ rm: '1600001', name: 'Tn. Contoh Satu', room: '420', bed: '2' }),
      patient({ rm: '1600003', name: 'Tn. Contoh Tiga', room: '405', bed: '' }),
      patient({ rm: '1600009', name: 'Ny. Sudah Pulang', room: '417', bed: '1' }),
    ];
    const gone = { ...newRosterPatient(patient({ rm: '1600004', name: 'Tn. Contoh Empat' }), '', 'x'), status: 'pulang' as const };
    const check = checkSlaber(sheet, active, [gone]);
    expect(check.matched).toBe(1);
    expect(check.others).toBe(1);
    expect(check.placeDiffers.map((d) => [d.patient.name, d.row.room])).toEqual([['Tn. Contoh Tiga', '404']]);
    expect(check.missing.map((m) => [m.row.name, m.left?.status ?? null])).toEqual([['CONTOH EMPAT', 'pulang']]);
    expect(check.notOnSheet.map((p) => p.name)).toEqual(['Ny. Sudah Pulang']);
  });
});
