import { describe, expect, it } from 'vitest';

import { impossibleVitals } from '@/domain/vitals';
import { checkSoap, type SoapFindingKind } from './soapCheck';

/* Names, RMs and dates are invented. */

const IDENTITY = '*Tn. Budi Santoso / 01-01-1970 / 56 tahun / RM 0123456*';
const record = { name: 'Tn. Budi Santoso', mrn: '123456' };
const kinds = (body: string, context = {}): SoapFindingKind[] => checkSoap({ body, context }).map((f) => f.kind);
const find = (body: string, kind: SoapFindingKind, context = {}) => checkSoap({ body, context }).find((f) => f.kind === kind);

describe('identity against the record', () => {
  it('is silent on the right patient, leading zeros and a near spelling included', () => {
    expect(kinds(IDENTITY, record)).not.toContain('identity-mismatch');
    expect(kinds(IDENTITY, { name: 'Tn. Budy', mrn: '0123456' })).not.toContain('identity-mismatch');
  });

  it('flags another RM, pointing at it', () => {
    const body = `S:\n${IDENTITY.replace('0123456', '7654321')}`;
    const finding = find(body, 'identity-mismatch', record);
    expect(finding?.message).toContain('7654321');
    expect(body.slice(finding?.at, (finding?.at ?? 0) + 10)).toBe('RM 7654321');
  });

  it('flags another name when the RM agrees or is not on record', () => {
    expect(find(IDENTITY, 'identity-mismatch', { name: 'Ny. Suarni', mrn: '123456' })?.message).toContain('Tn. Budi Santoso');
    expect(kinds(IDENTITY, { name: 'Ny. Suarni' })).toContain('identity-mismatch');
  });

  it('is silent with nothing to compare: initials, no record, no identity line', () => {
    expect(kinds('*Tn. A / 50 tahun / RM 123456*', { name: 'Tn. Budi', mrn: '123456' })).not.toContain('identity-mismatch');
    expect(kinds(IDENTITY, {})).not.toContain('identity-mismatch');
    expect(kinds('S:\nsesak', record)).not.toContain('identity-mismatch');
  });

  it('runs before other checks of its level', () => {
    const body = `${IDENTITY}\nHyponatremia (120)\nNa/K/Cl 130/4/100`;
    expect(checkSoap({ body, context: { name: 'Ny. Suarni' } }).filter((f) => f.level === 'cek')[0]?.kind).toBe('identity-mismatch');
  });
});

describe('impossible vitals', () => {
  const o = (line: string): string => `*O:*\n${line}`;

  it('finds typing slips the ordinary reader refuses to read', () => {
    expect(impossibleVitals(o('TD 1200/80')).map((v) => v.raw)).toEqual(['1200/80']);
    expect(impossibleVitals(o('Nadi 1234')).map((v) => v.raw)).toEqual(['1234']);
    expect(impossibleVitals(o('Suhu 365')).map((v) => v.key)).toEqual(['Suhu']);
    expect(impossibleVitals(o('SpO2 198%')).map((v) => v.key)).toEqual(['SpO2']);
  });

  it('finds a systolic not above the diastolic', () => {
    expect(impossibleVitals(o('TD 80/120')).map((v) => v.raw)).toEqual(['80/120']);
  });

  it('keeps sick but real readings silent', () => {
    expect(impossibleVitals(o('TD 60/30; Nadi 220; RR 44; Suhu 40,5; SpO2 62%'))).toEqual([]);
    expect(impossibleVitals(o('Tekanan Darah : 120/80 mmHg\nNadi : 88 kali/menit\nSuhu : 36.7'))).toEqual([]);
  });

  it('does not read other things under one-letter labels', () => {
    expect(impossibleVitals(o('P 2 tablet'))).toEqual([]);
    expect(impossibleVitals(o('S1 S2 tunggal'))).toEqual([]);
    expect(impossibleVitals(o('T 120/80'))).toEqual([]);
  });

  it('leaves investigations alone', () => {
    expect(impossibleVitals('*O:*\nNadi 88\n*EKG PJT (01-01-2026)*\nHR 400 bpm')).toEqual([]);
  });

  it('reaches the checker', () => {
    expect(find(o('TD 1200/80'), 'vitals-impossible')?.anchor).toBe('1200/80');
  });
});

describe('arithmetic', () => {
  it('accepts a urine rate within the rounding it was written to', () => {
    expect(kinds('Urine output 1100 cc/24 jam/55kg: 0.83 cc/kgbb/jam')).not.toContain('arithmetic');
    expect(kinds('Urine output 1100 cc/24 jam/55kg: 0.8 cc/kgbb/jam')).not.toContain('arithmetic');
  });

  it('flags a urine rate that its own numbers do not give', () => {
    expect(find('Urine output 1100 cc/24 jam/55kg: 1.83 cc/kgbb/jam', 'arithmetic')?.message).toContain('0.83');
  });

  it('leaves a urine line without hours or weight alone', () => {
    expect(kinds('Urine output 1100 cc: 1.83 cc/kgbb/jam')).not.toContain('arithmetic');
  });

  it('checks a balance line, with or without IWL and thousands marks', () => {
    expect(kinds('Balance cairan: input 2000 cc - output 1700 cc = +300 cc')).not.toContain('arithmetic');
    expect(kinds('Balance: intake 1.500 cc - output 1.700 cc - IWL 800 cc = -1000 cc')).not.toContain('arithmetic');
    expect(find('Balance cairan: input 2000 cc - output 1700 cc = +800 cc', 'arithmetic')?.message).toContain('+300');
    expect(find('Balance: input 1000 - output 1500 = 500 cc', 'arithmetic')?.message).toContain('-500');
  });

  it('reads the calculator line, and a written (-)', () => {
    const line = 'Balance cairan 24 jam: input 2000 cc (oral 500, IV 1500) + air metabolisme 300 cc - output 1700 cc (urine 1500, lain 200) - IWL 900 cc = -300 cc';
    expect(kinds(line)).not.toContain('arithmetic');
    expect(kinds('Balance: input 1000 - output 1500 = (-) 500 cc')).not.toContain('arithmetic');
  });

  it('leaves a balance with no parts or no total alone', () => {
    expect(kinds('Balance -300 cc')).not.toContain('arithmetic');
    expect(kinds('Balance input 2000 output 1700')).not.toContain('arithmetic');
  });
});

describe('planned test with no result', () => {
  const on = { date: '2026-11-07' };
  const note = (plan: string, rest = ''): string => `*S:*\n- sesak\n${rest}\n*P:*\n${plan}`;

  it('flags a past date with no trace outside the Plan', () => {
    const finding = find(note('- Cek Procalcitonin (06-11-2026)'), 'planned-no-result', on);
    expect(finding?.message).toContain('Cek Procalcitonin (06-11-2026)');
  });

  it('is silent on today and later: the sample may still be pending', () => {
    expect(kinds(note('- Cek Procalcitonin (07-11-2026)'), on)).not.toContain('planned-no-result');
    expect(kinds(note('- Cek Procalcitonin (08-11)'), on)).not.toContain('planned-no-result');
  });

  it('is silent once any of the tests appears outside the Plan', () => {
    expect(kinds(note('- Cek Procalcitonin (06-11-2026)', '*O:*\nProcalcitonin 1.2'), on)).not.toContain('planned-no-result');
    expect(kinds(note('- Cek AGD dan Laktat (06-11-2026)', '*O:*\nLaktat 2'), on)).not.toContain('planned-no-result');
  });

  it('is silent on a cancelled or done line, and without a date or note date', () => {
    expect(kinds(note('- Cek Procalcitonin (06-11-2026) batal'), on)).not.toContain('planned-no-result');
    expect(kinds(note('- Cek Procalcitonin'), on)).not.toContain('planned-no-result');
    expect(kinds(note('- Cek Procalcitonin (06-11-2026)'), {})).not.toContain('planned-no-result');
  });

  it('does not read a birth date or a plain plan line', () => {
    expect(kinds(note('- Terapi lanjut (06-11-2026)'), on)).not.toContain('planned-no-result');
  });
});

describe('day counter against its start date', () => {
  const on = { date: '2026-11-07' };

  it('flags a counter its own start date does not give', () => {
    const finding = find('- Meropenem (H-9) mulai 05-11-2026', 'counter-vs-start', on);
    expect(finding?.anchor).toBe('H-9');
    expect(finding?.message).toContain('hari ke-3');
  });

  it('accepts the start day counted as 0 or as 1', () => {
    expect(kinds('- Meropenem (H-3) mulai 05-11-2026', on)).not.toContain('counter-vs-start');
    expect(kinds('- Meropenem (H-2) start 5/11', on)).not.toContain('counter-vs-start');
  });

  it('reads a date right after the counter as its start', () => {
    const finding = find('- Meropenem (H-5) 6/11', 'counter-vs-start', on);
    expect(finding?.anchor).toBe('H-5');
    expect(finding?.message).toContain('mulai 6/11');
    expect(finding?.message).toContain('hari ke-2');
    expect(kinds('- Meropenem (H-2) 6/11', on)).not.toContain('counter-vs-start');
    expect(kinds('- Meropenem (H-1) 6-11-2026', on)).not.toContain('counter-vs-start');
  });

  it('judges each counter by the date right after it', () => {
    const line = '- Meropenem (H-2) 6/11, Amikasin (H-9) 5/11';
    expect(checkSoap({ body: line, context: on }).filter((f) => f.kind === 'counter-vs-start').map((f) => f.anchor)).toEqual(['H-9']);
  });

  it('does not read a date further along the line, or numbers that are not dates', () => {
    expect(kinds('- Meropenem (H-9) ganti ke Azitromisin 6-11', on)).not.toContain('counter-vs-start');
    expect(kinds('- post PPM H-3 120/80', on)).not.toContain('counter-vs-start');
    expect(kinds('- Meropenem (H-9) 45/90', on)).not.toContain('counter-vs-start');
  });

  it('is silent on a future start, several counters with one marked date, or no note date', () => {
    expect(kinds('- Meropenem (H-9) mulai 09-11-2026', on)).not.toContain('counter-vs-start');
    expect(kinds('- Meropenem (H-9) 9/11', on)).not.toContain('counter-vs-start');
    expect(kinds('- Meropenem (H-9), Amikasin (H-2) mulai 05-11-2026', on)).not.toContain('counter-vs-start');
    expect(kinds('- Meropenem (H-9) mulai 05-11-2026', {})).not.toContain('counter-vs-start');
  });
});
