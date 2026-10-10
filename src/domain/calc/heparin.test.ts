import { describe, expect, it } from 'vitest';

import {
  HEPARIN_SOURCES,
  NO_STOPS,
  acsApttPosition,
  acsStart,
  adjustDose,
  adjustProblems,
  apttRatio,
  heparinStops,
  matchRow,
  readCoagFromNote,
  startDose,
} from './heparin';
import { ESC_2023_ACS, RASCHKE_1993, TARGET_HIGH_CHOICES, withTargetHigh } from './heparinProtocol';

const CONTROL = 30; // Raschke's own control: the upper limit of a 20–30 s normal range.
const row = (ratio: number, protocol = RASCHKE_1993) => matchRow(ratio, protocol).id;
const aptt = (ratio: number) => ratio * CONTROL;

describe('the protocol data matches the printed table', () => {
  it('has the five rows of Raschke 1993 Table 2, the last open-ended', () => {
    expect(RASCHKE_1993.rows.map((entry) => entry.printed.range)).toEqual([
      'APTT <35s (<1.2 × control)',
      'APTT, 35 to 45s (1.2 to 1.5 × control)',
      'APTT, 46 to 70s (1.5 to 2.3 × control)',
      'APTT, 71 to 90s (2.3 to 3 × control)',
      'APTT >90s (>3 × control)',
    ]);
    expect(RASCHKE_1993.rows.at(-1)?.maxRatio).toBeNull();
  });

  it('each row’s numbers are the ones its printed action states', () => {
    for (const entry of RASCHKE_1993.rows) {
      const action = entry.printed.action;
      const bolus = /(\d+) u\/kg bolus/.exec(action);
      expect(entry.bolusPerKg).toBe(bolus ? Number(bolus[1]) : 0);
      const change = /(?:then|by) (\d+) u\/kg · h/.exec(action);
      const sign = /decrease/i.test(action) ? -1 : 1;
      expect(entry.rateChangePerKg).toBe(change ? sign * Number(change[1]) : 0);
      expect(entry.holdMinutes).toBe(/Hold infusion 1 hour/.test(action) ? 60 : 0);
    }
    expect(RASCHKE_1993.initial).toMatchObject({ bolusPerKg: 80, ratePerKg: 18 });
    expect(RASCHKE_1993.recheckHours).toBe(6);
    expect(RASCHKE_1993.minHoursAfterChange).toBe(4);
  });

  it('cites its sources', () => {
    expect(HEPARIN_SOURCES.join(' ')).toMatch(/Raschke.*1993;119:874–81/);
  });
});

describe('row boundaries (× control)', () => {
  it.each([
    [1.19, 'below-1.2'],
    [1.2, '1.2-1.5'],
    [1.21, '1.2-1.5'],
    [1.49, '1.2-1.5'],
    [1.5, '1.2-1.5'], // "exceeding … 1.5 times the control" is the threshold
    [1.51, '1.5-2.3'],
    [2.29, '1.5-2.3'],
    [2.3, '1.5-2.3'],
    [2.31, '2.3-3'],
    [2.99, '2.3-3'],
    [3, '2.3-3'],
    [3.01, 'above-3'],
  ])('%s × control → %s', (ratio, id) => {
    expect(row(ratio)).toBe(id);
  });

  it('the 1.5–2.5 target moves only the edge between "no change" and "decrease 2"', () => {
    const wide = withTargetHigh(RASCHKE_1993, 2.5);
    expect(row(2.31, wide)).toBe('1.5-2.3');
    expect(row(2.5, wide)).toBe('1.5-2.3');
    expect(row(2.51, wide)).toBe('2.3-3');
    expect(row(1.5, wide)).toBe('1.2-1.5');
    expect(row(3.01, wide)).toBe('above-3');
    expect(TARGET_HIGH_CHOICES.map((choice) => choice.value)).toEqual([2.3, 2.5]);
  });
});

describe('start dose', () => {
  it('80 U/kg bolus and 18 U/kg/h on actual weight', () => {
    expect(startDose(80)).toMatchObject({ bolusUnits: 6400, ratePerKg: 18, rateUnitsPerHour: 1440 });
    expect(startDose(80)?.line).toBe(
      '- Heparin bolus 6.400 U IV, lanjut 18 U/kgBB/jam (1.440 U/jam) IV kontinu (BB 80 kg); cek aPTT 6 jam',
    );
  });

  it('needs a positive weight', () => {
    expect(startDose(0)).toBeNull();
    expect(startDose(Number.NaN)).toBeNull();
    expect(startDose(-5)).toBeNull();
  });
});

describe('adjustment', () => {
  const base = { weightKg: 80, currentRatePerKg: 18, control: CONTROL };

  it('below 1.2×: 80 U/kg bolus, rate +4', () => {
    const result = adjustDose({ ...base, aptt: aptt(1.1) })!;
    expect(result).toMatchObject({ bolusUnits: 6400, newRatePerKg: 22, newRateUnitsPerHour: 1760, holdMinutes: 0 });
  });

  it('1.2–1.5×: 40 U/kg bolus, rate +2', () => {
    expect(adjustDose({ ...base, aptt: 45 })).toMatchObject({ bolusUnits: 3200, newRatePerKg: 20 });
  });

  it('in range: no change', () => {
    const result = adjustDose({ ...base, aptt: 55 })!;
    expect(result).toMatchObject({ bolusUnits: 0, newRatePerKg: 18, holdMinutes: 0 });
    expect(result.row.therapeutic).toBe(true);
    expect(result.line).toBe(
      '- Heparin: lanjut 18 U/kgBB/jam (1.440 U/jam) IV kontinu (aPTT 55 dtk = 1,83 × kontrol 30 dtk; BB 80 kg); cek aPTT 6 jam',
    );
  });

  it('2.3–3×: rate −2', () => {
    expect(adjustDose({ ...base, aptt: 80 })).toMatchObject({ bolusUnits: 0, newRatePerKg: 16 });
  });

  it('above 3×: hold 1 h, then rate −3', () => {
    const result = adjustDose({ ...base, aptt: 100 })!;
    expect(result).toMatchObject({ holdMinutes: 60, newRatePerKg: 15 });
    expect(result.line).toMatch(/^- Heparin: stop 1 jam, lalu turun ke 15 U\/kgBB\/jam/);
  });

  it('flags a decrease that would reach zero instead of printing a negative rate', () => {
    const result = adjustDose({ ...base, currentRatePerKg: 2, aptt: 100 })!;
    expect(result.newRatePerKg).toBe(0);
    expect(result.rateFloor).toBe(true);
  });

  it('works out the target in seconds for the lab’s control', () => {
    expect(adjustDose({ ...base, control: 31, aptt: 60 })?.targetSeconds).toEqual({ low: 1.5 * 31, high: 2.3 * 31 });
  });

  it('refuses missing or invalid inputs and says which', () => {
    expect(adjustDose({ ...base, aptt: 0 })).toBeNull();
    expect(adjustDose({ ...base, control: Number.NaN, aptt: 50 })).toBeNull();
    expect(adjustProblems({})).toEqual([
      'Isi berat badan (kg).',
      'Isi nilai aPTT (detik).',
      'Isi aPTT kontrol lab (detik).',
      'Isi laju heparin sekarang (U/kgBB/jam).',
    ]);
    expect(adjustProblems({ ...base, aptt: 50, currentRatePerKg: -1 })).toEqual(['Isi laju heparin sekarang (U/kgBB/jam).']);
    expect(apttRatio(50, 0)).toBeNull();
  });
});

describe('hard stops', () => {
  it('none ticked: none returned', () => {
    expect(heparinStops(NO_STOPS)).toEqual([]);
  });

  it.each([
    ['activeBleeding', /Perdarahan aktif/],
    ['plateletsOrHit', /4Ts/],
    ['baselineInrHigh', /INR awal/],
    ['severeLiverDisease', /hati berat/],
  ] as const)('%s returns its warning', (key, text) => {
    const found = heparinStops({ ...NO_STOPS, [key]: true });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(text);
  });
});

describe('reading the note', () => {
  it('reads the newest slash group, in either order', () => {
    const note = [
      '*Laboratorium PJT (07-01-2026)*',
      'PT/APTT/INR 18.2/35.8/1.81',
      '*Laboratorium PJT (03-01-2026)*',
      'PT/INR/APTT 14,2/1.39/23,6',
      'BB: 50 kg',
    ].join('\n');
    expect(readCoagFromNote(note)).toEqual({ aptt: 35.8, inr: 1.81, weightKg: 50 });
  });

  it('reads a printed control and bold values', () => {
    expect(readCoagFromNote('APTT : *52* (kontrol 31)\nBB : 37 kg')).toEqual({ aptt: 52, control: 31, weightKg: 37 });
  });

  it('returns nothing it cannot read', () => {
    expect(readCoagFromNote('Sesak berkurang')).toEqual({});
  });
});

describe('ACS (ESC 2023)', () => {
  it('gives the bolus as the published range, with no cap', () => {
    expect(acsStart(70)).toMatchObject({ bolusMinUnits: 4900, bolusMaxUnits: 7000 });
    expect(acsStart(120)).toMatchObject({ bolusMinUnits: 8400, bolusMaxUnits: 12000 });
    expect(acsStart(70)?.line).toBe(
      '- Heparin bolus 4.900–7.000 U IV (70–100 U/kg, BB 70 kg), lanjut infus IV titrasi ke aPTT 60–80 dtk',
    );
    expect(acsStart(0)).toBeNull();
  });

  it('places an aPTT against 60–80 s, inclusive', () => {
    expect(acsApttPosition(59.9)).toBe('below');
    expect(acsApttPosition(60)).toBe('in');
    expect(acsApttPosition(80)).toBe('in');
    expect(acsApttPosition(80.1)).toBe('above');
    expect(acsApttPosition(0)).toBeNull();
  });

  it('quotes Table 6 verbatim', () => {
    expect(ESC_2023_ACS.printed).toBe(
      'Initial treatment: i.v. bolus 70–100 U/kg followed by i.v. infusion titrated to achieve an aPTT of 60–80 s.',
    );
  });
});
