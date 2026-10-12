import { describe, expect, it } from 'vitest';

import { soapParts } from './soapParts';

const SOAP = [
  'Tabe dokter, mohon izin melaporkan follow up pasien di PJT Lantai 4 Kamar 417 Bed 1 atas nama:',
  '',
  'Tn. Contoh / 01-01-1960 / RM 1234500',
  '',
  'S:',
  '- baik',
  '',
  'O:',
  'Compos mentis',
  'EKG di PJT Lt.4 12-10-2026:',
  'Sinus rhythm',
  '',
  'Mohon izin kami assess dengan',
  '- CHF',
  '',
  'Mohon izin kami terapi dengan:',
  '- Furosemide',
  '',
  'Plan:',
  '- Monitoring',
  '',
  '*TS GER*',
  'A/',
  '- Frailty',
].join('\n');

describe('soapParts (12.12)', () => {
  it('cuts the SOAP at S, O, A, Terapi, Plan and each TS block; the rest stays inside its part', () => {
    const parts = soapParts(SOAP);
    expect(parts.map((p) => p.label)).toEqual(['', 'S', 'O', 'Assessment', 'Terapi', 'Plan', 'TS GER']);
    expect(parts.find((p) => p.label === 'O')!.text).toContain('Sinus rhythm');
    expect(parts.find((p) => p.label === 'TS GER')!.tint).toBe('ts');
  });

  it('an early "Diagnosis :" summary keeps its own name; a bare "TS BTKV" line starts a block', () => {
    const text = 'atas nama:\nTn. X\n\nDiagnosis :\n- CAD\n\nS:\n- baik\n\nPlan:\n- Monitoring\n\nTS BTKV\nA/\n- CAD\nP/\n- CABG';
    expect(soapParts(text).map((p) => p.label)).toEqual(['', 'Diagnosis', 'S', 'Plan', 'TS BTKV']);
  });

  it('joined back, the parts are the text unchanged', () => {
    expect(soapParts(SOAP).map((p) => p.text).join('')).toBe(SOAP);
  });
});
