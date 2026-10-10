import { describe, expect, it } from 'vitest';

import {
  INR_TARGETS,
  LAST_NOMOGRAM_DAY,
  NO_WARFARIN_STOPS,
  WARFARIN_SOURCES,
  dayDose,
  lowerStartNote,
  warfarinProblems,
  warfarinStops,
} from './warfarin';
import { CROWTHER_5MG } from './warfarinProtocol';

const dose = (day: number, inr: number) => {
  const found = dayDose(day, inr)!;
  return [found.minMg, found.maxMg];
};

describe('the nomogram data matches the printed Figure', () => {
  it('has days 1–6, day 1 fixed at 5 mg', () => {
    expect(CROWTHER_5MG.map((entry) => entry.day)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(CROWTHER_5MG[0]).toMatchObject({ fixedMg: 5, rows: [] });
    expect(LAST_NOMOGRAM_DAY).toBe(6);
  });

  it('every row’s numbers are the ones its printed dose states', () => {
    for (const entry of CROWTHER_5MG) {
      for (const row of entry.rows) {
        const numbers = [...row.printed.dose.matchAll(/\d+\.\d/g)].map((match) => Number(match[0]));
        expect([row.minMg, row.maxMg]).toEqual(numbers.length === 1 ? [numbers[0], numbers[0]] : numbers);
      }
    }
  });

  it('prints the INR cells as the Figure does', () => {
    expect(CROWTHER_5MG[1]!.rows.map((row) => row.printed.inr)).toEqual(['< 1.5', '1.5 - 1.9', '2.0 - 2.5', '>2.5']);
    expect(CROWTHER_5MG[2]!.rows.map((row) => row.printed.inr)).toEqual(['< 1.5', '1.5 - 1.9', '2.0 - 2.5', '2.5 - 3.0', '> 3.0']);
  });

  it('cites its sources', () => {
    expect(WARFARIN_SOURCES.join(' ')).toMatch(/Ann Intern Med 1997;127:332–3/);
  });
});

describe('day 1', () => {
  it('is 5 mg without an INR', () => {
    expect(dayDose(1, Number.NaN)?.line).toBe('- Warfarin 5 mg/oral malam ini (hari ke-1); cek INR besok pagi');
  });
});

describe('row boundaries, day by day', () => {
  it.each([
    // day 2
    [2, 1.4, [5, 5]],
    [2, 1.5, [2.5, 2.5]],
    [2, 1.9, [2.5, 2.5]],
    [2, 2.0, [1, 2.5]],
    [2, 2.5, [1, 2.5]],
    [2, 2.6, [0, 0]],
    // day 3
    [3, 1.49, [5, 10]],
    [3, 1.5, [2.5, 5]],
    [3, 2.0, [0, 2.5]],
    [3, 2.5, [0, 2.5]],
    [3, 3.0, [0, 2.5]],
    [3, 3.1, [0, 0]],
    // day 4
    [4, 1.4, [10, 10]],
    [4, 1.5, [5, 7.5]],
    [4, 2.0, [0, 5]],
    [4, 3.0, [0, 5]],
    [4, 3.01, [0, 0]],
    // day 5
    [5, 1.4, [10, 10]],
    [5, 1.9, [7.5, 10]],
    [5, 2.1, [0, 5]],
    [5, 3.2, [0, 0]],
    // day 6
    [6, 1.2, [7.5, 12.5]],
    [6, 1.6, [5, 10]],
    [6, 2.9, [0, 7.5]],
    [6, 3.5, [0, 0]],
  ] as const)('day %s, INR %s → %j mg', (day, inr, expected) => {
    expect(dose(day, inr)).toEqual(expected);
  });

  it('an INR between printed rows shows both neighbours, never a rounded guess', () => {
    const found = dayDose(4, 1.95)!;
    expect(found.between).toBe(true);
    expect(found.rows.map((row) => row.printed.inr)).toEqual(['1.5 - 1.9', '2.0 - 3.0']);
    expect([found.minMg, found.maxMg]).toEqual([0, 7.5]);
  });

  it('writes a hold as a hold', () => {
    expect(dayDose(3, 3.4)?.line).toBe('- Warfarin tunda (0 mg) malam ini (hari ke-3, INR 3,4); cek INR besok pagi');
    expect(dayDose(4, 1.7)?.line).toBe('- Warfarin 5–7,5 mg/oral malam ini (hari ke-4, INR 1,7); cek INR besok pagi');
  });

  it('ends at day 6 and needs an INR after day 1', () => {
    expect(dayDose(7, 2)).toBeNull();
    expect(dayDose(0, 2)).toBeNull();
    expect(dayDose(3, Number.NaN)).toBeNull();
    expect(dayDose(3, 0)).toBeNull();
  });
});

describe('inputs and targets', () => {
  it('requires a target INR — none is assumed', () => {
    expect(warfarinProblems({ target: null, day: 1, inr: Number.NaN })).toEqual(['Pilih target INR.']);
    expect(warfarinProblems({ target: '2-3', day: 3, inr: Number.NaN })).toEqual(['Isi INR pagi ini.']);
    expect(warfarinProblems({ target: '2-3', day: 0, inr: 2 })).toEqual(['Isi hari ke berapa warfarin (1–6).']);
    expect(warfarinProblems({ target: '2-3', day: 1, inr: Number.NaN })).toEqual([]);
  });

  it('offers the nomogram only for 2.0–3.0, the target it was used for', () => {
    expect(INR_TARGETS.filter((target) => target.nomogram).map((target) => target.value)).toEqual(['2-3']);
  });
});

describe('hard stops and lower-dose prompts', () => {
  it.each([
    ['activeBleeding', /Perdarahan aktif/],
    ['baselineInrHigh', /INR awal/],
    ['severeLiverDisease', /hati berat/],
  ] as const)('%s returns its warning', (key, text) => {
    const found = warfarinStops({ ...NO_WARFARIN_STOPS, [key]: true });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(text);
  });

  it('none ticked: none returned', () => {
    expect(warfarinStops(NO_WARFARIN_STOPS)).toEqual([]);
    expect(lowerStartNote(new Set())).toBeNull();
  });

  it('names the published lower starts', () => {
    expect(lowerStartNote(new Set(['valve']))).toMatch(/2–3 mg/);
    expect(lowerStartNote(new Set(['hf']))).toMatch(/≤ 5 mg/);
  });
});
