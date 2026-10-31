import { describe, expect, it } from 'vitest';

import { latestPenunjangOnly } from './penunjang';
import { carryVersion } from './versionCarry';

// Synthetic, in the shape of a real dr. AHA follow-up (full SOAP) and the
// shortened version the resident makes from it. No real patient.
const SOAP_YESTERDAY = `Tabe dokter, mohon izin melaporkan follow up pasien di *PJT Lantai 4 Kamar 400 bed 1* atas nama :

*Tn. Contoh / 01-01-1960 / 66 tahun / RM 0000000*

*S:*
- Sekarang nyeri dada tidak ada, sesak nafas tidak ada.
- BAB dan BAK kesan normal.

*O:*
Compos Mentis GCS (E4V5M6)
Tekanan Darah : 135/88 mmHg
Nadi : 80 kali/menit, reguler
SpO2 : 98 % on room air

BB: 55 kg
TB: 160 cm

Anemis tidak ada, ikterus tidak ada
BJ I/II murni reguler, murmur tidak terdengar
Edema ekstremitas tidak ada, akral hangat

*EKG Lt. 4 (29-10-2026)*
Sinus rhythm, HR 68 bpm, VES (+)

*EKG Lt. 4 (28-10-2026)*
Sinus rhythm, HR 63 bpm

*Laboratorium PJT (30-10-2026)*
WBC 5.05
HGB 14.9
PLT 209

*Mohon izin kami assess dengan:*
- Chronic Coronary Syndrome
- Coronary Artery Disease 2 Vessel Disease

*Mohon izin kami terapi dengan:*
- Clopidogrel 75 mg/24 jam/oral
- Candesartan 8 mg/24 jam/oral
- Bisoprolol 2,5 mg/24 jam/oral

*Plan:*
- Monitoring tanda vital dan hemodinamik
- Konferensi bedah (Jumat, 30-10-2026)

Selanjutnya mohon arahan dokter.`;

const VERSION_YESTERDAY = `Tabe dokter, mohon izin melaporkan follow up pasien di *PJT Lantai 4 Kamar 400 bed 1* atas nama :

*Tn. Contoh / 01-01-1960 / 66 tahun / RM 0000000*

*S:* Saat ini pasien tidak ada keluhan.

*O:* Compos Mentis GCS (E4V5M6)
Tekanan Darah : 135/88 mmHg ; Nadi : 80 kali/menit, reguler ; SpO2 : 98 % on room air

_Pemeriksaan fisik dalam batas normal_

*EKG Lt. 4 (29-10-2026)* Sinus rhythm, HR 68 bpm, VES (+)

*Laboratorium PJT (30-10-2026)* WBC 5.05 ; HGB 14.9 ; PLT 209

*Mohon izin kami assess dengan:*
- Chronic Coronary Syndrome
- Coronary Artery Disease 2 Vessel Disease

*Mohon izin kami terapi dengan:*
- Clopidogrel 75 mg/24 jam/oral
- Candesartan 8 mg/24 jam/oral
- Bisoprolol 2,5 mg/24 jam/oral

*Plan:*
- Monitoring tanda vital dan hemodinamik
- Konferensi bedah (Jumat, 30-10-2026)

Selanjutnya mohon arahan dokter.`;

const edit = (text: string, from: string, to: string): string => {
  expect(text).toContain(from);
  return text.replace(from, to);
};

describe('carryVersion', () => {
  it('returns yesterday’s version untouched when the SOAP did not change', () => {
    const result = carryVersion(SOAP_YESTERDAY, VERSION_YESTERDAY, SOAP_YESTERDAY);
    expect(result.text).toBe(VERSION_YESTERDAY);
    expect(result.applied).toEqual([]);
    expect(result.pending).toEqual([]);
  });

  it('replaces whole lines the version shares (plan, therapy)', () => {
    const today = edit(
      SOAP_YESTERDAY,
      '- Konferensi bedah (Jumat, 30-10-2026)',
      '- Rawat jalan hari ini (Sabtu, 31-10-2026)',
    );
    const result = carryVersion(SOAP_YESTERDAY, VERSION_YESTERDAY, today);
    expect(result.text).toContain('- Rawat jalan hari ini (Sabtu, 31-10-2026)');
    expect(result.text).not.toContain('Konferensi bedah');
    expect(result.pending).toEqual([]);
  });

  it('swaps a changed vital sign inside the folded vitals line', () => {
    const today = edit(
      edit(SOAP_YESTERDAY, 'Tekanan Darah : 135/88 mmHg', 'Tekanan Darah : 120/80 mmHg'),
      'Nadi : 80 kali/menit, reguler',
      'Nadi : 72 kali/menit, reguler',
    );
    const result = carryVersion(SOAP_YESTERDAY, VERSION_YESTERDAY, today);
    expect(result.text).toContain(
      'Tekanan Darah : 120/80 mmHg ; Nadi : 72 kali/menit, reguler ; SpO2 : 98 % on room air',
    );
    expect(result.applied).toHaveLength(2);
    expect(result.pending).toEqual([]);
  });

  it('adds a new drug after the last one and drops a stopped one', () => {
    const today = edit(
      edit(SOAP_YESTERDAY, '- Candesartan 8 mg/24 jam/oral\n', ''),
      '- Bisoprolol 2,5 mg/24 jam/oral',
      '- Bisoprolol 2,5 mg/24 jam/oral\n- Atorvastatin 20 mg/24 jam/oral',
    );
    const result = carryVersion(SOAP_YESTERDAY, VERSION_YESTERDAY, today);
    expect(result.text).toContain(
      '- Clopidogrel 75 mg/24 jam/oral\n- Bisoprolol 2,5 mg/24 jam/oral\n- Atorvastatin 20 mg/24 jam/oral\n\n*Plan:*',
    );
    expect(result.text).not.toContain('Candesartan');
    expect(result.pending).toEqual([]);
  });

  it('puts a new EKG above the folded old one, so the newest-only trim can drop the old', () => {
    const today = edit(
      SOAP_YESTERDAY,
      '*EKG Lt. 4 (29-10-2026)*',
      '*EKG Lt. 4 (31-10-2026)*\nSinus rhythm, HR 70 bpm\n\n*EKG Lt. 4 (29-10-2026)*',
    );
    const result = carryVersion(SOAP_YESTERDAY, VERSION_YESTERDAY, today);
    expect(result.text).toContain(
      '_Pemeriksaan fisik dalam batas normal_\n\n*EKG Lt. 4 (31-10-2026)*\nSinus rhythm, HR 70 bpm\n\n*EKG Lt. 4 (29-10-2026)* Sinus',
    );
    expect(result.pending).toEqual([]);

    const trimmed = latestPenunjangOnly(result.text, []);
    expect(trimmed.text).toContain('*EKG Lt. 4 (31-10-2026)*');
    expect(trimmed.text).not.toContain('(29-10-2026)');
  });

  it('lists what the version wrote differently instead of guessing (S, physical exam)', () => {
    const today = edit(
      edit(
        SOAP_YESTERDAY,
        '- Sekarang nyeri dada tidak ada, sesak nafas tidak ada.',
        '- Sekarang nyeri dada tidak ada, sesak nafas saat aktivitas.',
      ),
      'Edema ekstremitas tidak ada, akral hangat',
      'Edema pretibial (+/+), akral hangat',
    );
    const result = carryVersion(SOAP_YESTERDAY, VERSION_YESTERDAY, today);
    expect(result.text).toBe(VERSION_YESTERDAY);
    expect(result.pending).toEqual([
      {
        before: ['- Sekarang nyeri dada tidak ada, sesak nafas tidak ada.'],
        after: ['- Sekarang nyeri dada tidak ada, sesak nafas saat aktivitas.'],
      },
      {
        before: ['Edema ekstremitas tidak ada, akral hangat'],
        after: ['Edema pretibial (+/+), akral hangat'],
      },
    ]);
  });

  it('does not match a value inside a longer one', () => {
    const soap = 'Lab\nPLT 20\n';
    const result = carryVersion(soap, 'Lab PLT 209', 'Lab\nPLT 25\n');
    expect(result.text).toBe('Lab PLT 209');
    expect(result.pending).toHaveLength(1);
  });

  it('leaves a line the version has twice as pending', () => {
    const soap = 'A\n- Monitoring\nB\n';
    const version = 'A\n- Monitoring\nB\n- Monitoring';
    const result = carryVersion(soap, version, 'A\n- Monitoring ketat\nB\n');
    expect(result.text).toBe(version);
    expect(result.pending).toEqual([{ before: ['- Monitoring'], after: ['- Monitoring ketat'] }]);
  });
});
