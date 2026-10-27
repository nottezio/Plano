import { describe, expect, it } from 'vitest';

import { DEFAULT_SECTION_ALIASES as ALIASES } from './defaults';
import { visiteSummary } from './visite';

/** Synthetic note in the corpus shape. No real patient. */
const NOTE = [
  'Tabe dokter, mohon izin melaporkan follow up pasien',
  '*Tn. Contoh/60 tahun/RM 1234567*',
  '',
  '*S :*',
  '- Sesak berkurang',
  '',
  '*O :*',
  'Tensi : 120/70 mmHg',
  '',
  '*EKG di PJT Lt. 4 (01-10-2026)*',
  'AF NVR 90',
  '',
  '*EKG PJT Lt. 4 (03-10-2026)*',
  'Sinus rhythm, HR 72',
  '',
  '*Laboratorium PJT (02-10-2026)*',
  'WBC : 9.000',
  '',
  '*Laboratorium IGD (02-10-2026)*',
  'Kalium : 3.1',
  '',
  '*Laboratorium PJT (29-09-2026)*',
  'WBC : 12.000',
  '',
  '*Foto Thorax PJT (30-09-2026)*',
  '- Cardiomegaly',
  '',
  '*Laporan CA Diagnostik (17-09-2026)*',
  'Kesimpulan : CAD 2VD',
  '',
  '*Laporan PPM Single Chamber (20-09-2026)*',
  'Kesimpulan : Implantasi berhasil',
  '',
  '*Echocardiography Full Study (25-09-2026)*',
  '1. Cardiac Valves: normal',
  'Conclusion:',
  'Mildly Abnormal LV systolic function, EF 45% (TEICH)',
  'Grade I LV Diastolic Dysfunction',
  '',
  '*Echo Hemodinamik CVCU (04-10-2026)*',
  'CO 4.2',
  '',
  '*Mohon izin kami assess dengan:*',
  '- ADHF',
  '- AF',
  '',
  '*Mohon izin kami terapi dengan:*',
  '- Furosemide 40 mg/12 jam/iv',
  '',
  '*Plan :*',
  '- Echo ulang',
  '',
  '*TS Pulmo*',
  'P/',
  '- Spirometri',
].join('\n');

const byId = (body: string) => Object.fromEntries(visiteSummary(body, ALIASES).sections.map((s) => [s.id, s]));

describe('visiteSummary', () => {
  it('returns the sections in the fixed bedside order', () => {
    expect(visiteSummary(NOTE, ALIASES).sections.map((s) => s.id)).toEqual([
      'diagnosis', 'ekg', 'lab', 'thorax', 'tindakan', 'echo', 'terapi', 'plan',
    ]);
  });

  it('drops the heading line of A, Terapi and Plan', () => {
    const s = byId(NOTE);
    expect(s.diagnosis?.lines).toEqual(['- ADHF', '- AF']);
    expect(s.terapi?.lines).toEqual(['- Furosemide 40 mg/12 jam/iv']);
  });

  it('drops a heading written without a colon (2026-10-28, from a real note)', () => {
    const note = [
      '*O :*', 'TD 120/80', '',
      '*Mohon izin kami assest dengan*', '- Hipertensi Emergency', '',
      '*Mohon izin kami terapi dengan*', '- Amlodipin', '',
      'Plan', '- Echo',
    ].join('\n');
    const s = byId(note);
    expect(s.diagnosis?.lines).toEqual(['- Hipertensi Emergency']);
    expect(s.terapi?.lines).toEqual(['- Amlodipin']);
    expect(s.plan?.lines).toEqual(['- Echo']);
  });

  it('stops the diagnosis at the end of its list, even when nothing closes it', () => {
    const note = ['*Diagnosis :*', '- Ischemic Heart Disease', '- CAD 2VD', '_Rencana tindakan : PCI (Senin)_', 'TB 172cm', 'Hb 12'].join('\n');
    expect(byId(note).diagnosis?.lines).toEqual(['- Ischemic Heart Disease', '- CAD 2VD']);
  });

  it('keeps only the newest EKG, and every lab block on the newest lab date', () => {
    const s = byId(NOTE);
    expect(s.ekg?.date).toBe('2026-10-03');
    expect(s.ekg?.lines).toEqual(['Sinus rhythm, HR 72']);
    expect(s.lab?.date).toBe('2026-10-02');
    expect(s.lab?.lines).toEqual(['WBC : 9.000', 'Kalium : 3.1']);
  });

  it('picks the one newest procedure report of any kind', () => {
    expect(byId(NOTE).tindakan).toMatchObject({ title: 'Laporan tindakan terbaru', date: '2026-09-20', lines: ['Kesimpulan : Implantasi berhasil'] });
  });

  it('shows only the echo conclusion, and ignores Echo Hemodinamik', () => {
    const s = byId(NOTE);
    expect(s.echo?.date).toBe('2026-09-25');
    expect(s.echo?.lines).toEqual(['Mildly Abnormal LV systolic function, EF 45% (TEICH)', 'Grade I LV Diastolic Dysfunction']);
  });

  it('falls back to the EF line, then to the first two lines', () => {
    const ef = '*O :*\n*Echo (01-10-2026)*\nLA dilatasi\nEF 35% biplane\nMR moderate';
    expect(byId(ef).echo?.lines).toEqual(['EF 35% biplane']);
    const plain = '*O :*\n*Echo (01-10-2026)*\nLA dilatasi\nMR moderate\nTR mild';
    expect(byId(plain).echo?.lines).toEqual(['LA dilatasi', 'MR moderate']);
  });

  it('never shows a consulting team block under our Plan', () => {
    expect(byId(NOTE).plan?.lines).toEqual(['- Echo ulang']);
  });

  it('leaves out what a note does not have, and names it', () => {
    const summary = visiteSummary('Pasien tenang, makan baik.', ALIASES);
    expect(summary.sections).toEqual([]);
    expect(summary.missing).toContain('Diagnosis');
    expect(summary.missing).toContain('Plan');
  });

  it('only shows lines that are in the note as written', () => {
    for (const section of visiteSummary(NOTE, ALIASES).sections) {
      for (const line of section.lines) expect(NOTE).toContain(line);
    }
  });
});
