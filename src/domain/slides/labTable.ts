import { headingDate } from '@/domain/lab/labMeta';
import { matchInvestigationHeading } from '@/domain/sections/investigationHeading';
import type { ClinicalDate } from '@/domain/types';

/**
 * The lab table slide, read from the dated lab blocks already in the notes.
 *
 * The Lab formatter writes each result set as `*Laboratorium PJT (02-10-2026)*`
 * followed by `LABEL value` lines (`HGB 14.2`, `Na/K/Cl 136/4.6/107`). This
 * reads those lines back as written: values are copied, never recomputed or
 * judged (no reference ranges, by project rule). Labels are renamed to the
 * ones on the residents' slides, and a few single-analyte lines are joined
 * into the combined rows those slides use.
 *
 * The column date is the date in the heading, not the day of the note: a lab
 * block carried forward into tomorrow's note is the same result, not a new one.
 */

export interface LabGrid {
  dates: ClinicalDate[];
  rows: Array<{ label: string; cells: Partial<Record<ClinicalDate, string>> }>;
}

/** Formatter label (lowercase) → slide row label. Unlisted labels keep their own name. */
const RENAME: Readonly<Record<string, string>> = {
  wbc: 'WBC (/µL)',
  leukosit: 'WBC (/µL)',
  hgb: 'Hb (g/dL)',
  hb: 'Hb (g/dL)',
  plt: 'Plt (/µL)',
  trombosit: 'Plt (/µL)',
  'neut/lymph': 'N/L',
  'n/l': 'N/L',
  'ur/cr': 'Ureum/Kreatinin',
  'ureum/kreatinin': 'Ureum/Kreatinin',
  'na/k/cl': 'Na/K/Cl',
  'aptt/inr/pt': 'APTT/INR/PT',
  'got/gpt': 'SGOT/SGPT',
  'sgot/sgpt': 'SGOT/SGPT',
};

/** Lines joined into one row, in this order, with `/`. */
const JOINED: Readonly<Record<string, { label: string; part: number; of: number }>> = {
  hbsag: { label: 'HbsAg/anti HCV', part: 0, of: 2 },
  'anti hcv': { label: 'HbsAg/anti HCV', part: 1, of: 2 },
};

/** The reference slide's row order; anything else follows in first-seen order. */
const ORDER = ['WBC (/µL)', 'Hb (g/dL)', 'Plt (/µL)', 'N/L', 'Ureum/Kreatinin', 'Na/K/Cl', 'APTT/INR/PT', 'SGOT/SGPT', 'HbsAg/anti HCV'];

const LAB_STEM = /^(?:lab\b|laboratorium)/i;
/** `LABEL value`: the value starts at the first token that is a number, a comparison, or a qualitative result. */
const VALUE_LINE = /^[ \t>*_~-]*([A-Za-z][A-Za-z0-9 ./%-]*?)\s*:?\s+((?:[<>≤≥]?\s*\d|NR\b|R\b|non\b|neg|pos|reaktif|negatif|positif).*)$/i;
/** A line that opens another section (`Diagnosis:`, `EKG ...`, `*Plan*`) ends the block. */
const SECTION_LINE = /^[ \t*_~]*[A-Za-z][^:\d]{0,40}:[ \t*_~]*$/;

interface Cell {
  label: string;
  value: string;
  joined?: { part: number; of: number };
}

function readBlock(lines: readonly string[], from: number): Cell[] {
  const cells: Cell[] = [];
  let blanks = 0;
  for (let i = from; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (!line.trim()) {
      blanks += 1;
      if (blanks >= 2) break;
      continue;
    }
    blanks = 0;
    if (matchInvestigationHeading(line) || SECTION_LINE.test(line)) break;
    const match = VALUE_LINE.exec(line);
    if (!match) continue;
    const raw = match[1]!.trim();
    const key = raw.toLowerCase();
    const value = match[2]!.trim();
    const joined = JOINED[key];
    if (joined) cells.push({ label: joined.label, value, joined: { part: joined.part, of: joined.of } });
    else cells.push({ label: RENAME[key] ?? raw, value });
  }
  return cells;
}

export function labGridFromDays(days: ReadonlyArray<{ date: ClinicalDate; body: string }>): LabGrid {
  const byDate = new Map<ClinicalDate, Map<string, string>>();
  const firstSeen: string[] = [];

  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const lines = day.body.split('\n');
    lines.forEach((line, index) => {
      const heading = matchInvestigationHeading(line);
      if (!heading?.date || !LAB_STEM.test(heading.stem)) return;
      const column = new Map<string, string>();
      const parts = new Map<string, string[]>();
      for (const cell of readBlock(lines, index + 1)) {
        if (!firstSeen.includes(cell.label)) firstSeen.push(cell.label);
        if (cell.joined) {
          const slots = parts.get(cell.label) ?? Array.from({ length: cell.joined.of }, () => '');
          slots[cell.joined.part] = cell.value;
          parts.set(cell.label, slots);
        } else {
          column.set(cell.label, cell.value);
        }
      }
      for (const [label, slots] of parts) column.set(label, slots.join('/'));
      if (column.size > 0) byDate.set(heading.date, column);
    });
  }

  const dates = [...byDate.keys()].sort();
  const labels = [...ORDER.filter((label) => firstSeen.includes(label)), ...firstSeen.filter((label) => !ORDER.includes(label))];
  return {
    dates,
    rows: labels.map((label) => ({
      label,
      cells: Object.fromEntries(dates.flatMap((date) => {
        const value = byDate.get(date)?.get(label);
        return value === undefined ? [] : [[date, value]];
      })),
    })),
  };
}

/** Union of two grids; `b` wins a cell both have (Plano's notes over an imported deck). */
export function mergeLabGrids(a: LabGrid, b: LabGrid): LabGrid {
  const dates = [...new Set([...a.dates, ...b.dates])].sort();
  const labels = [...new Set([...a.rows.map((r) => r.label), ...b.rows.map((r) => r.label)])];
  const find = (grid: LabGrid, label: string) => grid.rows.find((r) => r.label === label)?.cells ?? {};
  return {
    dates,
    rows: labels.map((label) => ({ label, cells: { ...find(a, label), ...find(b, label) } })),
  };
}

const DEFAULT_COLUMNS = 5;

export function applyLabOverrides(
  grid: LabGrid,
  overrides: Readonly<Record<string, string>>,
  pickedDates?: readonly ClinicalDate[],
): { dates: string[]; rows: Array<{ label: string; cells: string[] }> } {
  const picked = pickedDates?.length ? grid.dates.filter((date) => pickedDates.includes(date)) : [];
  // Never zero columns: a table with no date column is invalid PPTX (PowerPoint "repairs" it).
  const dates = picked.length ? picked : grid.dates.slice(-DEFAULT_COLUMNS);
  return {
    dates: dates.map(headingDate),
    rows: grid.rows.map((row) => ({
      label: row.label,
      cells: dates.map((date) => overrides[`${row.label}|${date}`] ?? row.cells[date] ?? ''),
    })),
  };
}
