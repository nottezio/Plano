import { describe, expect, it } from 'vitest';
import { labHeading } from '@/domain/lab/parseLab';
import { headingDate } from '@/domain/lab/labMeta';
import { applyLabOverrides, labGridFromDays, mergeLabGrids, type LabGrid } from './labTable';

// Blocks in the shape the Lab formatter inserts under O; values are synthetic.
const block = (iso: string, lines: string[]): string => [labHeading(headingDate(iso), 'Laboratorium PJT'), ...lines].join('\n');
const LAB_A = block('2026-10-02', ['WBC 6.780', 'HGB 14.2', 'PLT 312.000', 'NEUT/LYMPH 67.2/24.3', 'Ur/Cr 16/0.98 (eGFR 90)', 'Na/K/Cl 136/4.6/107', 'GOT/GPT 19/12']);
const LAB_B = block('2026-10-05', ['APTT/INR/PT 28.3/0.94/9.8', 'HBsAg NR', 'Anti HCV NR']);
const note = (lab: string): string => ['S :', '- Baik', 'O :', 'TD 120/80', '', lab, '', 'Diagnosis:', '- Contoh'].join('\n');
const d = (date: string, body: string) => ({ date, body });

describe('labGridFromDays', () => {
  it('one column per lab date, oldest first', () => {
    expect(labGridFromDays([d('2026-10-05', note(LAB_B)), d('2026-10-02', note(LAB_A))]).dates).toEqual(['2026-10-02', '2026-10-05']);
  });

  it('keeps combined rows and maps labels to the slide names', () => {
    const g = labGridFromDays([d('2026-10-02', note(LAB_A))]);
    const cell = (label: string) => g.rows.find((r) => r.label === label)?.cells['2026-10-02'];
    expect(cell('Na/K/Cl')).toBe('136/4.6/107');
    expect(cell('Hb (g/dL)')).toBe('14.2');
    expect(cell('N/L')).toBe('67.2/24.3');
    expect(cell('Ureum/Kreatinin')).toBe('16/0.98 (eGFR 90)');
    expect(cell('SGOT/SGPT')).toBe('19/12');
  });

  it('joins HBsAg and anti HCV into one row', () => {
    const g = labGridFromDays([d('2026-10-05', note(LAB_B))]);
    expect(g.rows.find((r) => r.label === 'HbsAg/anti HCV')?.cells['2026-10-05']).toBe('NR/NR');
  });

  it('orders rows like the reference slide', () => {
    const g = labGridFromDays([d('2026-10-02', note(LAB_A)), d('2026-10-05', note(LAB_B))]);
    expect(g.rows.map((r) => r.label).slice(0, 4)).toEqual(['WBC (/µL)', 'Hb (g/dL)', 'Plt (/µL)', 'N/L']);
  });

  it('a lab block carried into later notes counts once (date from the heading)', () => {
    expect(labGridFromDays([d('2026-10-02', note(LAB_A)), d('2026-10-03', note(LAB_A))]).dates).toEqual(['2026-10-02']);
  });

  it('no lab blocks gives an empty grid', () => {
    expect(labGridFromDays([d('2026-10-02', 'S :\n- baik')]).dates).toEqual([]);
  });

  it('stops at the next heading', () => {
    const body = `${LAB_A}\nDiagnosis:\n- Contoh 1`;
    expect(labGridFromDays([d('2026-10-02', body)]).rows.map((r) => r.label)).not.toContain('- Contoh');
  });
});

describe('applyLabOverrides', () => {
  const six: LabGrid = {
    dates: ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'],
    rows: [{ label: 'Hb (g/dL)', cells: { '2026-10-02': '14', '2026-10-07': '13' } }],
  };

  it('override wins and the newest 5 dates are kept, as dd-mm-yyyy', () => {
    const t = applyLabOverrides(six, { 'Hb (g/dL)|2026-10-07': '12.0' });
    expect(t.dates).toEqual(['03-10-2026', '04-10-2026', '05-10-2026', '06-10-2026', '07-10-2026']);
    expect(t.rows[0]?.cells.at(-1)).toBe('12.0');
  });

  it('picked dates that no longer exist fall back to the default window (never zero columns)', () => {
    expect(applyLabOverrides(six, {}, ['1999-01-01']).dates).toHaveLength(5);
  });

  it('picked dates replace the default window', () => {
    expect(applyLabOverrides(six, {}, ['2026-10-02']).dates).toEqual(['02-10-2026']);
  });
});

describe('mergeLabGrids', () => {
  it('unions dates and rows; the second grid wins a shared cell', () => {
    const a: LabGrid = { dates: ['2026-10-01'], rows: [{ label: 'Hb (g/dL)', cells: { '2026-10-01': '11' } }] };
    const b: LabGrid = { dates: ['2026-10-01', '2026-10-02'], rows: [{ label: 'Hb (g/dL)', cells: { '2026-10-01': '12', '2026-10-02': '13' } }] };
    const m = mergeLabGrids(a, b);
    expect(m.dates).toEqual(['2026-10-01', '2026-10-02']);
    expect(m.rows[0]?.cells['2026-10-01']).toBe('12');
  });
});
