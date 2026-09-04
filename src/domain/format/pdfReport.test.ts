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
    // Date AND time. A bare clock is ambiguous the moment the note is read on
    // any day but the one it was written, and this line exists to record a
    // moment.
    expect(output).toContain('_Verifikasi 08.14_');
    expect(output.indexOf('Verifikasi')).toBeLessThan(output.indexOf('Terima kasih'));
    expect(output.indexOf('Verifikasi')).toBeGreaterThan(output.indexOf('Diagnosis:'));
  });

  it('combines both switches independently', () => {
    const output = composePdfReport(BODY, {
      ...OPTIONS,
      staffing: false,
      verificationTime: '08.14',
    });
    expect(output).not.toContain('Chief :');
    expect(output).toContain('Verifikasi 08.14');
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
    expect(output).toContain('Verifikasi 08.14');
  });
});

describe('the Ringkas bugs from real notes', () => {
  it('does not swallow the whole SOAP when there is no clinical heading', () => {
    // A KJS report opens straight into diagnoses. The opening used to fall back
    // to `body.length`, so the entire note became the "opening" of a report
    // meant to be four lines long.
    const noHeadings = [
      'Assalamualaikum dokter. Melaporkan pasien di *PJT Lt 4 Kamar 418* atas nama:',
      '*Tn. Aco Ridwan/01-06-1967/41 tahun/RM 01690671*',
      '_DPJP Kardio : dr. Aussie Fitriani Ghaznawie, Sp.JP_',
      '',
      '*Diagnosis*',
      '- Severe Mitral Regurgitation',
      '',
      '*Mohon izin kami terapi dengan:*',
      '- Furosemide 40mg/24jam/oral',
      '- Spironolactone 25mg/24jam/oral',
    ].join('\n');

    const out = composePdfReport(noHeadings, OPTIONS);
    expect(out).toContain('Tn. Aco Ridwan');
    expect(out).toContain('Severe Mitral Regurgitation');
    expect(out).not.toContain('Furosemide');
    expect(out).not.toContain('Spironolactone');
  });

  it('stops the diagnosis list at the therapy heading', () => {
    // No `*Plan:*` here: with one present the opening runs to it, which is a
    // separate limitation noted in CHANGES rather than something this asserts.
    const note = [
      'Melaporkan pasien atas nama:',
      '*Tn. A / 50 tahun / RM 123456*',
      '',
      '*Mohon izin kami assess dengan:*',
      '- CAD 3VD',
      '- Hypertensive Heart Disease',
      '',
      '*Mohon izin kami terapi dengan:*',
      '- Aspilet 80mg',
    ].join('\n');

    const out = composePdfReport(note, OPTIONS);
    expect(out).toContain('CAD 3VD');
    expect(out).toContain('Hypertensive Heart Disease');
    expect(out).not.toContain('Aspilet');
  });

  it('stops it at a TS block too', () => {
    const note = [
      'Melaporkan pasien atas nama:',
      '*Tn. A / 50 tahun / RM 123456*',
      '',
      '*Diagnosis*',
      '- Severe Mitral Stenosis',
      '',
      '*TS BTKV*',
      'A/',
      '- Pro MVR',
    ].join('\n');

    const out = composePdfReport(note, OPTIONS);
    expect(out).toContain('Severe Mitral Stenosis');
    expect(out).not.toContain('Pro MVR');
  });
});

/**
 * The report signs off in the NOTE's words.
 *
 * It used to end with a hardcoded "…arahan dokter. Terima kasih dokter", so a
 * note addressed to a Prof went out addressed to "dokter". This file's own
 * opening comment says a report that regenerates what the note already states
 * will drift from it — this was that drift.
 */
describe('closing sentence', () => {
  const CLOSINGS = [
    'Selanjutnya mohon arahan dokter. Terima kasih dokter',
    'Selanjutnya mohon arahan Prof. Terima kasih Prof',
  ];

  const withClosing = (last: string): string =>
    ['*S:*', '- sesak', '', '*A:*', '- CHF', '', last].join('\n');

  it("reuses the note's own sign-off verbatim", () => {
    const output = composePdfReport(withClosing('Selanjutnya mohon arahan Prof. Terima kasih Prof.'), {
      ...OPTIONS,
      closings: CLOSINGS,
    });
    expect(output.trimEnd().endsWith('Selanjutnya mohon arahan Prof. Terima kasih Prof.')).toBe(true);
    expect(output).not.toContain('Terima kasih dokter');
  });

  it('falls back when the note has no closing', () => {
    const output = composePdfReport('*S:*\n- sesak', { ...OPTIONS, closings: CLOSINGS });
    expect(output.trimEnd().endsWith('Terima kasih dokter')).toBe(true);
  });

  it('does not mistake a plan item for a sign-off', () => {
    // Only the last non-empty line can be a closing, and it must match a
    // configured one. "lapor Prof" is an instruction, not a farewell.
    const output = composePdfReport(
      ['*A:*', '- CHF', '', '*Plan:*', '- Lapor Prof besok pagi'].join('\n'),
      { ...OPTIONS, closings: CLOSINGS },
    );
    // Falls back rather than treating the plan line as a farewell. (Ringkas
    // does not carry the Plan section itself, which is why only the closing is
    // asserted here.)
    expect(output.trimEnd().endsWith('Terima kasih dokter')).toBe(true);
    expect(output).not.toContain('Lapor Prof besok pagi. Terima kasih');
  });
});
