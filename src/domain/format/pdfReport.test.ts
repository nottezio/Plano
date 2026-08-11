import { describe, expect, it } from 'vitest';

import { composePdfReport } from './pdfReport';
import { DEFAULT_SECTION_ALIASES as ALIASES } from '../sections/aliases';

const BODY = [
  "Assalamualaikum dokter. Tabe dokter, mohon izin melaporkan follow up pasien di *PJT Lt. 4 Kamar 418 Bed 4* atas nama:",
  '',
  '*Tn. Hamzah Rahuddin / 01-01-1973 / 53 thn / RM 1656066*',
  '',
  '_DPJP Utama dan Tindakan : Dr. dr. Akhtar Fajar M, SpJP, Subsp. IKKV(K), KI(K)_',
  '',
  '_Pasien Post tindakan : CA Standby PCI  (Rabu, 15-07-2026)_',
  '',
  '*S:*',
  '- nyeri dada tidak ada',
  '',
  '*O:*',
  'TD 116/72 mmHg',
  '',
  '*A:*',
  '- Chronic Coronary Syndrome Clinical Presentation Type III',
  '- Coronary Artery Disease 2 Vessel Disease',
  '',
  '*Mohon izin pasien kami terapi dengan :*',
  '- Clopidogrel 75mg',
  '',
  '*Plan :*',
  '- Monitoring',
].join('\n');

const OPTIONS = { aliases: ALIASES, format: 'whatsapp' as const };

describe('composePdfReport', () => {
  const output = composePdfReport(BODY, OPTIONS);

  it('leaves Chief and Junior blank', () => {
    expect(output).toContain('Chief :');
    expect(output).toContain('Junior :');
    expect(output).not.toMatch(/Chief : \w/);
  });

  it('keeps the opening block verbatim', () => {
    expect(output).toContain('mohon izin melaporkan follow up pasien');
    expect(output).toContain('Tn. Hamzah Rahuddin / 01-01-1973 / 53 thn / RM 1656066');
    expect(output).toContain('DPJP Utama dan Tindakan : Dr. dr. Akhtar Fajar M');
    expect(output).toContain('Pasien Post tindakan : CA Standby PCI');
  });

  it('includes the diagnoses under a Diagnosis heading', () => {
    expect(output).toContain('Diagnosis:');
    expect(output).toContain('Chronic Coronary Syndrome Clinical Presentation Type III');
    expect(output).toContain('Coronary Artery Disease 2 Vessel Disease');
  });

  it('omits S, O, therapy and plan — that is the point of this format', () => {
    expect(output).not.toContain('nyeri dada tidak ada');
    expect(output).not.toContain('TD 116/72');
    expect(output).not.toContain('Clopidogrel');
    expect(output).not.toContain('Monitoring');
  });

  it('ends with the closing sentence', () => {
    expect(output.trimEnd().endsWith('Terima kasih dokter')).toBe(true);
  });

  it('accepts Chief and Junior when they are known', () => {
    const named = composePdfReport(BODY, { ...OPTIONS, chief: 'Malika', junior: 'Ghazi' });
    expect(named).toContain('Chief : Malika');
    expect(named).toContain('Junior : Ghazi');
  });

  it('picks up Diagnosis Primer / Sekunder headings too', () => {
    const dx = [
      'Assalamualaikum dokter. Tabe dokter, melaporkan pasien atas nama:',
      '',
      '*Diagnosis Primer :*',
      '- CCS III',
      '',
      '*Diagnosis Sekunder :*',
      '- DM Type 2',
      '',
      '*S:*',
      '- keluhan tidak ada',
    ].join('\n');

    const output = composePdfReport(dx, OPTIONS);
    expect(output).toContain('CCS III');
    expect(output).toContain('DM Type 2');
    expect(output).not.toContain('keluhan tidak ada');
  });

  it('still produces a usable report when there is no assessment yet', () => {
    const thin = 'Assalamualaikum dokter. Melaporkan pasien atas nama:\n\n*S:*\n- x';
    const output = composePdfReport(thin, OPTIONS);
    expect(output).toContain('Diagnosis:');
    expect(output).toContain('Terima kasih dokter');
  });

  it('collapses runs of blank lines', () => {
    expect(composePdfReport(BODY, OPTIONS)).not.toMatch(/\n{3,}/);
  });
});

describe('per-consultant variants of the short form', () => {
  it('omits the staffing lines when the report goes to Telegram', () => {
    const output = composePdfReport(BODY, { ...OPTIONS, staffing: false });
    expect(output).not.toContain('Chief :');
    expect(output).not.toContain('Junior :');
    // Everything else is unchanged.
    expect(output).toContain('Tn. Hamzah Rahuddin');
    expect(output).toContain('Diagnosis:');
    expect(output.trimEnd().endsWith('Terima kasih dokter')).toBe(true);
  });

  it('adds the verification time before the closing sentence', () => {
    const output = composePdfReport(BODY, { ...OPTIONS, verificationTime: '08.14' });
    expect(output).toContain('_Jam verifikasi 08.14 WITA_');
    expect(output.indexOf('Jam verifikasi')).toBeLessThan(output.indexOf('Terima kasih'));
    expect(output.indexOf('Jam verifikasi')).toBeGreaterThan(output.indexOf('Diagnosis:'));
  });

  it('combines both switches independently', () => {
    const output = composePdfReport(BODY, {
      ...OPTIONS,
      staffing: false,
      verificationTime: '08.14',
    });
    expect(output).not.toContain('Chief :');
    expect(output).toContain('Jam verifikasi 08.14');
  });

  it('keeps staffing by default, so an unconfigured consultant is unaffected', () => {
    expect(composePdfReport(BODY, OPTIONS)).toContain('Chief :');
  });
});

describe('plain-text output for a destination that renders no markers', () => {
  it('carries no bold or italic markers', () => {
    const output = composePdfReport(BODY, {
      ...OPTIONS,
      format: 'plain',
      staffing: false,
    });

    expect(output).not.toContain('*');
    expect(output).not.toMatch(/_[^\s]/);
    // The content is all still there — only the decoration is gone.
    expect(output).toContain('Tn. Hamzah Rahuddin');
    expect(output).toContain('DPJP Utama dan Tindakan');
    expect(output).toContain('Diagnosis:');
    expect(output).toContain('Chronic Coronary Syndrome');
  });

  it('still honours the other switches', () => {
    const output = composePdfReport(BODY, {
      ...OPTIONS,
      format: 'plain',
      staffing: false,
      verificationTime: '08.14',
    });
    expect(output).not.toContain('Chief :');
    expect(output).toContain('Jam verifikasi 08.14 WITA');
  });
});
