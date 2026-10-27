import { describe, expect, it } from 'vitest';

import { readReport, reportBlockText } from './readReport';

/** Synthetic reports in the row order `lib/pdfText.ts` produces. No real patient. */
const RADIOLOGY_HEAD = [
  'HASIL PEMERIKSAAN RADIOLOGI',
  'No. RM : 00000001 No. Registrasi : 2609000001',
  'Nama : TN. CONTOH Tgl. Registrasi : 04/09/26 11.42',
  'Sex / Tgl Lahir : Laki-Laki / 01-01-1970 Tgl. Hasil : 04/09/26 15.59',
];

const THORAX = [
  ...RADIOLOGY_HEAD,
  'Radiografi Thorax 1 proyeksi',
  'Unit Pengantar : PJT Perawatan Lt. 4 (Atrium) Nama Tindakan :',
  '(AP/PA/Lateral/Top)',
  'HASIL PEMERIKSAAN :',
  'Foto Thorax AP:',
  '- Tampak berkabutan di parahilar',
  'KESAN PEMERIKSAAN :',
  '- Edema pulmonum (Interstisial)',
  '- Terpasang dual chamber pacemaker dengan generator set pada hemithorax kanan setinggi costae III-IV dengan',
  'lead I kesan pada ventrikel kanan dan lead II pada ventrikel kiri',
  'USUL PEMERIKSAAN :',
  '-',
  'MAKASSAR, 04-09-2026 16:00:00',
].join('\n');

const CT_SPLIT_TITLE = [
  ...RADIOLOGY_HEAD,
  'CT Scan Kontras Cardiac (Calcium Scoring dan',
  'Unit Pengantar : PJT Perawatan Lt. 4 (Atrium) Nama Tindakan :',
  'Angiografi Coroner)',
  'HASIL PEMERIKSAAN :',
  'Total calcium score : 369.42 unit',
  'HASIL PEMERIKSAAN RADIOLOGI',
  'No. RM : 00000001 No. Registrasi : 2609000001',
  'KESAN PEMERIKSAAN :',
  'Pada CT Coronary Angiography dan Calcium Scoring ditemukan :',
  '- Severe stenosis proximal LAD (Cad-Rads 4B)',
  '- Mild stenosis proximal RCA (Cad-Rads 2)',
  'USUL PEMERIKSAAN :',
  'HASIL PEMERIKSAAN RADIOLOGI',
  'MAKASSAR, 26-10-2026 18:16:57',
].join('\n');

const CT_OTAK = [
  ...RADIOLOGY_HEAD,
  'Unit Pengantar : IGD Jantung Nama Tindakan : CT Scan Non Kontras Otak',
  'KESAN PEMERIKSAAN :',
  '- Infark luas lobus frontotemporoparietal kanan',
  'USUL PEMERIKSAAN :',
].join('\n');

const ECHO = [
  'MR.24/R.I',
  'RS WAHIDIN SUDIROHUSODO',
  'LAPORAN EKOKARDIOGRAFI',
  'TRANSTORAKAL (TTE) STANDAR',
  'Tanggal Tindakan Jam Mulai Jam Selesai Durasi Tindakan',
  '31-08-2026 09.26 10.00 00.33',
  '1. Cardiac Valves:',
  '- Mitral : Normal Function and Movement',
  'Conclusion:',
  'Severe Aortic Stenosis due to Degeneratif',
  'Normal LV systolic function, EF 56% (TEICH), EF 55% (BIPLANE)',
  'Grade I LV Diastolic Dysfunction',
  '31-08-2026',
  'Tanda Tangan :',
].join('\n');

const CA = [
  'LAPORAN ANGIOGRAFI DIAGNOSTIK',
  'SEDERHANA',
  'Tanggal Tindakan Jam Mulai Jam Selesai Durasi Tindakan',
  '20-10-2026 08.50 09.15 00.25',
  'Laporan Operasi',
  '1. Dilakukan kanulasi ke left coronary artery dengan hasil :',
  'Left Dominant',
  'Left Main : short left main',
  'Left Anterior Descending : total oklusi di mid',
  '2.',
  'Tindakan selesai. AK 236 mGy.',
  'Kesimpulan : Coronary Artery Disease 2 Vessel Disease',
  'Saran : Konferensi Bedah',
  '20-10-2026',
  'Tanda Tangan :',
].join('\n');

/** The bullet is a lone glyph on its own row; a page header repeats after the items. */
const ABLASI = [
  'LAPORAN RADIOFREQUENCY ABLATION',
  '3D NON AF',
  'Tanggal Tindakan Jam Mulai Jam Selesai Durasi Tindakan',
  '16-09-2026 10.48 11.30 00.41',
  'Laporan Operasi',
  '1. Prosedur selesai tanpa komplikasi.',
  'Kesimpulan :',
  '',
  'PVC yang berasal dari RVOT anteroseptal origin',
  '',
  'Telah berhasil dilakukan ablasi 3D pada PVC yang berasal',
  'dari RVOT',
  'MR.24/R.I',
  'RS WAHIDIN SUDIROHUSODO',
  'LAPORAN RADIOFREQUENCY ABLATION',
  '3D NON AF',
  '16-09-2026',
  'Tanda Tangan :',
].join('\n');

const PPM = [
  'LAPORAN PPM SINGLE CHAMBER',
  'Tanggal Tindakan Jam Mulai Jam Selesai Durasi Tindakan',
  '04-09-2026 08.30 09.45 01.15',
  'Laporan Operasi',
  '1.Monitor EKG menunjukkan irama atrial fibrilasi.',
  'Merek Nama (Generator) : Enticos 4 SR, SN 1000881451',
  'Ventricle Lead : Solia S 60 cm, SN 8002630851',
  'Pengaturan : VVI',
  'Kesimpulan : Implantasi Single Chamber Berhasil',
  '04-09-2026',
].join('\n');

describe('readReport: radiology', () => {
  it('lifts the Kesan, joins the wrapped bullet and heads it like the notes do', () => {
    const report = readReport(THORAX);
    expect(report?.lines).toEqual([
      '- Edema pulmonum (Interstisial)',
      '- Terpasang dual chamber pacemaker dengan generator set pada hemithorax kanan setinggi costae III-IV dengan lead I kesan pada ventrikel kanan dan lead II pada ventrikel kiri',
    ]);
    expect(reportBlockText(report!, '2026-01-01').split('\n')[0]).toBe('*Foto Thorax PJT (04-09-2026)*');
  });

  it('names a CT from the line beside "Nama Tindakan", dropping a parenthesis the layout cut', () => {
    expect(readReport(CT_SPLIT_TITLE)?.title).toBe('CT Scan Kontras Cardiac');
    expect(readReport(CT_OTAK)?.title).toBe('CT Scan Non Kontras Otak');
  });

  it('keeps the lead sentence of the Kesan and ignores the repeated page header', () => {
    expect(readReport(CT_SPLIT_TITLE)?.lines).toEqual([
      'Pada CT Coronary Angiography dan Calcium Scoring ditemukan :',
      '- Severe stenosis proximal LAD (Cad-Rads 4B)',
      '- Mild stenosis proximal RCA (Cad-Rads 2)',
    ]);
  });
});

describe('readReport: echo', () => {
  it('lifts the Conclusion lines and stops at the signature', () => {
    const report = readReport(ECHO);
    expect(report?.title).toBe('Echocardiography Full Study');
    expect(report?.date).toBe('2026-08-31');
    expect(report?.lines).toEqual([
      'Severe Aortic Stenosis due to Degeneratif',
      'Normal LV systolic function, EF 56% (TEICH), EF 55% (BIPLANE)',
      'Grade I LV Diastolic Dysfunction',
    ]);
  });
});

describe('readReport: procedure reports', () => {
  it('angiografi: the vessel lines, then Kesimpulan and Saran, as the notes write them', () => {
    const report = readReport(CA);
    expect(report?.title).toBe('Laporan CA Diagnostik');
    expect(report?.lines).toEqual([
      '- Left Dominant',
      '- Left Main : short left main',
      '- Left Anterior Descending : total oklusi di mid',
      'Kesimpulan : Coronary Artery Disease 2 Vessel Disease',
      'Saran : Konferensi Bedah',
    ]);
  });

  it('ablasi: bullet glyphs become "- ", a wrapped item is joined, the repeated header is not read', () => {
    const report = readReport(ABLASI);
    expect(report?.title).toBe('Laporan Hasil Radioablasi');
    expect(report?.lines).toEqual([
      'Kesimpulan :',
      '- PVC yang berasal dari RVOT anteroseptal origin',
      '- Telah berhasil dilakukan ablasi 3D pada PVC yang berasal dari RVOT',
    ]);
  });

  it('PPM: device lines, then the conclusion; an unknown title is cased but keeps acronyms', () => {
    const report = readReport(PPM);
    expect(report?.title).toBe('Laporan PPM Single Chamber');
    expect(report?.lines).toEqual([
      'Merek Nama (Generator) : Enticos 4 SR, SN 1000881451',
      'Ventricle Lead : Solia S 60 cm, SN 8002630851',
      'Pengaturan : VVI',
      'Kesimpulan : Implantasi Single Chamber Berhasil',
    ]);
  });
});

describe('readReport: what it refuses', () => {
  it('returns null when the section is missing, so no heading goes over nothing', () => {
    expect(readReport(THORAX.replace(/KESAN PEMERIKSAAN :[\s\S]*USUL/, 'USUL'))).toBeNull();
    expect(readReport(ECHO.replace('Conclusion:', 'Kesan:'))).toBeNull();
    expect(readReport(CA.replace(/Kesimpulan :.*/, ''))).toBeNull();
  });

  it('returns null for text that is not one of these reports', () => {
    expect(readReport('WBC 6.01 4.00 - 10.0\nHGB 12.4 12.0 - 16.0')).toBeNull();
  });

  it('falls back to the note date when the report prints none', () => {
    const report = { title: 'Foto Thorax', date: null, lines: ['Normal'] };
    expect(reportBlockText(report, '2026-10-05')).toBe('*Foto Thorax (05-10-2026)*\nNormal');
  });
});
