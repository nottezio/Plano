import { describe, expect, it } from 'vitest';

import { checkSoap, readLabs, readVitals } from './soapCheck';

const VITALS = [
  'Tekanan Darah : 121/82 mmHg',
  'Nadi : 86 kali/menit, reguler',
  'Pernapasan : 18 kali/menit',
  'Suhu : 36.6 derajat Celcius',
  'SpO2 : 98 % on room air',
].join('\n');

const kinds = (body: string, previous?: string): string[] =>
  checkSoap({ body, previous }).map((finding) => finding.kind);

describe('readVitals', () => {
  it('reads the block the corpus actually writes', () => {
    expect(readVitals(VITALS)).toEqual({
      'Tekanan darah': '121/82',
      Nadi: '86',
      Pernapasan: '18',
      Suhu: '36.6',
      SpO2: '98',
    });
  });

  it('normalises the decimal comma, which appears in half the notes', () => {
    expect(readVitals('Suhu : 36,8 derajat Celcius')['Suhu']).toBe('36.8');
  });
});

describe('readLabs', () => {
  it('reads Na/K/Cl as three values from one line', () => {
    expect(readLabs('Na/K/Cl 136/3.6/103')).toMatchObject({ Na: 136, K: 3.6, Cl: 103 });
  });

  it('reads the spaced and colonned variant too', () => {
    expect(readLabs('Na/K/Cl : 129/4.3/103')).toMatchObject({ Na: 129, K: 4.3 });
  });

  it('reads haemoglobin under either spelling', () => {
    expect(readLabs('HGB 11.9')['Hb']).toBe(11.9);
    expect(readLabs('Hb: 14.4')['Hb']).toBe(14.4);
  });
});

describe('vitals', () => {
  it('says nothing when the vitals changed', () => {
    const before = 'Tekanan Darah : 130/80\nNadi : 70\nSuhu : 36.5\nSpO2 : 98';
    expect(kinds(VITALS, before)).not.toContain('vitals-unchanged');
  });

  it('flags a block copied forward unedited', () => {
    expect(kinds(VITALS, VITALS)).toContain('vitals-unchanged');
  });

  it('does not flag one repeated vital', () => {
    // A temperature genuinely the same two days running is ordinary; the whole
    // block repeating is a copy nobody edited.
    const before = 'Tekanan Darah : 130/80\nNadi : 70\nPernapasan : 20\nSuhu : 36.6\nSpO2 : 95';
    expect(kinds(VITALS, before)).not.toContain('vitals-unchanged');
  });

  it('flags a note with no vitals at all', () => {
    expect(kinds('A:\n- CHF NYHA III')).toContain('vitals-missing');
  });
});

describe('stale numbers', () => {
  it('flags a diagnosis quoting a potassium the lab has moved past', () => {
    const body = `${VITALS}\nNa/K/Cl 136/3.7/103\nA:\n- Hypokalemia (2.9)`;
    expect(kinds(body)).toContain('diagnosis-value-stale');
  });

  it('accepts the arrow form, where the right-hand number is current', () => {
    // `Hypokalemia (2.9 --> 3.7)` is how a correction in progress is written.
    // Comparing the admission value would flag every improving patient daily.
    const body = `${VITALS}\nNa/K/Cl 136/3.7/103\nA:\n- Hypokalemia (2.9 --> 3.7)`;
    expect(kinds(body)).not.toContain('diagnosis-value-stale');
  });

  it('tolerates a trailing zero rather than calling it a mismatch', () => {
    const body = `${VITALS}\nNa/K/Cl 136/3.60/103\nA:\n- Hypokalemia (3.6)`;
    expect(kinds(body)).not.toContain('diagnosis-value-stale');
  });

  it('flags anemia with no haemoglobin anywhere in the note', () => {
    expect(kinds(`${VITALS}\nA:\n- Anemia normositik normokrom`)).toContain('anemia-without-hb');
  });

  it('is quiet when the haemoglobin is there', () => {
    expect(kinds(`${VITALS}\nHGB 9.1\nA:\n- Anemia`)).not.toContain('anemia-without-hb');
  });
});

describe('plan versus result', () => {
  it('flags a lab still planned after its result is in the note', () => {
    const body = `${VITALS}\nNa/K/Cl 136/3.6/103\nP:\n- Cek elektrolit`;
    expect(kinds(body)).toContain('lab-planned-but-resulted');
  });

  it('leaves a planned lab alone when nothing has resulted', () => {
    expect(kinds(`${VITALS}\nP:\n- Cek darah rutin`)).not.toContain('lab-planned-but-resulted');
  });
});

describe('day counters', () => {
  it('flags a counter that did not move from yesterday', () => {
    const body = `${VITALS}\nA:\n- post PPM H-2`;
    expect(kinds(body, `${VITALS}\nA:\n- post PPM H-2`)).toContain('day-marker');
  });

  it('says nothing once it has been advanced', () => {
    const body = `${VITALS}\nA:\n- post PPM H-3`;
    expect(kinds(body, `${VITALS}\nA:\n- post PPM H-2`)).not.toContain('day-marker');
  });

  it('stays quiet once the banner has been dismissed by hand', () => {
    const note = `${VITALS}\nA:\n- post PPM H-2`;
    const findings = checkSoap({ body: note, previous: note, dayMarkersDismissed: true });
    expect(findings.map((f) => f.kind)).not.toContain('day-marker');
  });
});

describe('an empty note', () => {
  it('produces nothing at all', () => {
    // A blank day is a day not started, not a day with five problems.
    expect(checkSoap({ body: '   ' })).toEqual([]);
  });
});
