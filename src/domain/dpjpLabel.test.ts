import { describe, expect, it } from 'vitest';

import { normaliseDpjpLabel } from './dpjpLabel';
import { detectDpjps, primaryDpjp } from './dpjp';
import { dpjpSpecialties } from './format/specialties';
import { stayStart } from './clinicalDate';

describe('DPJP label typos', () => {
  it.each(['DPJP', 'DJPJP', 'DPJ', 'DJPJ', 'DPPJ', 'dpjp'])('%s reads as DPJP', (label) => {
    expect(normaliseDpjpLabel(`_${label} Utama : dr. Contoh_`)).toBe('_DPJP Utama : dr. Contoh_');
  });

  it('leaves real words alone', () => {
    expect(normaliseDpjpLabel('DDP, PPD, dj, DPP, adpjp')).toBe('DDP, PPD, dj, DPP, adpjp');
  });

  it('a typo’d Utama line still decides the primary DPJP', () => {
    const note = [
      '_DJPJP Utama : dr. Zaenab Djafar, MKes, SpPD, SpJP_',
      '_DPJP Aritmia : Prof. Dr. dr. Muzakkir Amir, Sp.JP(K)_',
    ].join('\n');
    expect(primaryDpjp(note)?.id).toBe('zd');
    expect(detectDpjps(note).map((entry) => entry.role)).toEqual(['Utama', 'Aritmia']);
  });

  it('counts the typo’d line for "TS sudah menjawab tapi belum ada di DPJP"', () => {
    expect(dpjpSpecialties('_DJPJP HOM : Prof. dr. Contoh, Sp.PD, KHOM_').size).toBeGreaterThan(0);
  });
});

describe('stayStart', () => {
  it('takes an earlier written day over the date the patient was added', () => {
    expect(stayStart('2026-10-11', ['2026-10-10', '2026-10-11', 'IGD'])).toBe('2026-10-10');
  });

  it('keeps admittedAt when nothing was written before it', () => {
    expect(stayStart('2026-10-05', ['2026-10-10'])).toBe('2026-10-05');
    expect(stayStart('2026-10-05', [])).toBe('2026-10-05');
  });
});
