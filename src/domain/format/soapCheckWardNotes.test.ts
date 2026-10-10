import { describe, expect, it } from 'vitest';

import { checkSoap, readLabs } from './soapCheck';
import { findDayMarkers } from '@/domain/dayMarkers';

/*
  False positives reported on two real notes (2026-10-10), reduced to the
  lines that caused them. Names, RMs and dates are invented.
*/

describe('readLabs with WhatsApp emphasis', () => {
  it('reads the newest line even when abnormal values are bolded', () => {
    const note = [
      '*Laboratorium PJT (08-01-2026)*',
      'Na/K/Cl *123*/3.8/*92*',
      '',
      '*Laboratorium PJT (03-01-2026)*',
      'Na/K/Cl 121/4.7/95',
    ].join('\n');
    expect(readLabs(note)).toMatchObject({ Na: 123, K: 3.8, Cl: 92 });
  });

  it('reads a bolded Hb and a decimal comma', () => {
    expect(readLabs('HGB *17.4*').Hb).toBe(17.4);
    expect(readLabs('Hb : 12,7').Hb).toBe(12.7);
  });

  it('no longer flags a diagnosis that matches the newest bolded lab', () => {
    const note = [
      '*O:*',
      'Tekanan Darah : 99/76 mmHg',
      'Nadi : 87 kali/menit',
      '*Laboratorium PJT (08-01-2026)*',
      'Na/K/Cl *123*/3.8/*92*',
      '*Laboratorium PJT (03-01-2026)*',
      'Na/K/Cl 121/4.7/95',
      '*Mohon izin kami assess dengan*',
      '- Hyponatremia (121 -> 123) Hipoosmolal (275 -> 274)',
    ].join('\n');
    expect(checkSoap({ body: note }).filter((finding) => finding.kind === 'diagnosis-value-stale')).toEqual([]);
  });
});

describe('day counters', () => {
  it('does not read "cm H20" (water) as a day counter', () => {
    expect(findDayMarkers('JVP R+3 cm H20')).toEqual([]);
    expect(findDayMarkers('JVP 5+2 mm H20')).toEqual([]);
  });

  it('still finds real counters', () => {
    expect(findDayMarkers('Meropenem H3, post WSD H-2').map((marker) => marker.value)).toEqual([3, 2]);
  });
});

describe('furosemide without a catheter', () => {
  const base = (subjective: string): string =>
    [
      '*S:*',
      `- ${subjective}`,
      '*O:*',
      'Tekanan Darah : 89/55 mmHg',
      '*Mohon izin kami terapi dengan:*',
      '- Furosemide 40mg/12 jam/IV',
    ].join('\n');
  const flagged = (body: string): boolean =>
    checkSoap({ body }).some((finding) => finding.kind === 'balance-without-catheter');

  it('stays quiet when spontaneous voiding is documented', () => {
    expect(flagged(base('BAB hari ini, BAK kesan normal.'))).toBe(false);
  });

  it('still reminds when nothing is said about voiding', () => {
    expect(flagged(base('Sesak berkurang.'))).toBe(true);
  });
});
