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

describe('furosemide: catheter and urine output', () => {
  const note = (subjective: string, objective = ''): string =>
    [
      '*S:*',
      `- ${subjective}`,
      '*O:*',
      'Tekanan Darah : 89/55 mmHg',
      objective,
      '*Mohon izin kami terapi dengan:*',
      '- Furosemide 40mg/12 jam/IV',
    ].join('\n');
  const kinds = (body: string): string[] =>
    checkSoap({ body })
      .map((finding) => finding.kind)
      .filter((kind) => kind === 'balance-without-catheter' || kind === 'urine-not-measured');
  const OUTPUT = '_Urine output 1600 cc/12 jam/50kg: 2.67 cc/kgbb/jam_';

  it('spontaneous voiding with a measured output: nothing to say', () => {
    expect(kinds(note('BAB hari ini, BAK kesan normal.', OUTPUT))).toEqual([]);
  });

  it('spontaneous voiding without an output: the urine must still be measured', () => {
    const found = checkSoap({ body: note('BAK kesan normal.') }).filter((finding) => finding.kind === 'urine-not-measured');
    expect(found[0]?.message).toMatch(/Urin harus diukur per hari \(ditampung bila tanpa kateter\)/);
    expect(kinds(note('BAK kesan normal.'))).toEqual(['urine-not-measured']);
  });

  it('catheter written with an output: nothing to say', () => {
    expect(kinds(note('BAK per kateter.', OUTPUT))).toEqual([]);
  });

  it('nothing about voiding and no output: both reminders', () => {
    expect(kinds(note('Sesak berkurang.'))).toEqual(['balance-without-catheter', 'urine-not-measured']);
  });
});
