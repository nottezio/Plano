/**
 * Lab reformatter.
 *
 * A lab printout is a wide table: analyte, result, reference range, unit, one
 * row per test, sixty rows deep. What goes into a handover is a dozen compact
 * lines with related analytes grouped onto one — `MCV/MCH/MCHC 97/33/34`. The
 * transcription is mechanical, repetitive, and exactly the kind of thing that
 * introduces a transposed digit at two in the morning.
 *
 * Two rules shape everything here:
 *
 *  1. **Values are copied, never computed or corrected.** Whatever is read off
 *     the sheet goes through untouched, including a value the parser thinks is
 *     implausible. A lab reformatter that silently "fixes" a number is worse
 *     than no reformatter.
 *  2. **Nothing recognised is dropped, and nothing unrecognised is guessed.**
 *     Analytes that match a known name are grouped; everything else is emitted
 *     verbatim in its own section, so an unfamiliar test is visible rather than
 *     missing.
 */

export interface LabValue {
  /** Canonical analyte key, e.g. `HGB`. */
  key: string;
  /** The value exactly as it appeared. */
  value: string;
}

/**
 * Panels that print as their own block, the way the notes write them.
 *
 * A blood gas is eight values that mean nothing apart; listing them among the
 * chemistry — or worse, under "Lain-lain" — loses the fact that they are one
 * measurement. Same for a urinalysis.
 */
const PANELS: ReadonlyArray<{ heading: string; keys: readonly string[] }> = [
  {
    heading: 'Analisa Gas Darah :',
    keys: ['pH', 'PO2', 'PCO2', 'SO2', 'HCO3', 'BE', 'ctO2', 'ctCO2', 'Laktat'],
  },
  {
    heading: 'Urinalisis :',
    keys: [
      'Urin warna', 'Urin pH', 'Urin BJ', 'Protein', 'Glukosa', 'Bilirubin',
      'Urobilinogen', 'Keton', 'Nitrit', 'Blood', 'Leukosit',
    ],
  },
];

export interface LabParseResult {
  /** Recognised analytes, in the order the output groups them. */
  known: LabValue[];
  /** Lines that looked like a result but matched no known analyte. */
  unknown: LabValue[];
  formatted: string;
}

/**
 * Analyte aliases.
 *
 * Keys are what the output prints; the arrays are what a printout might call
 * the same test. Matching is case-insensitive and ignores punctuation, because
 * the same machine prints `Ur/Cr`, `UREUM`, and `Ureum darah` on different
 * report templates.
 */
const ALIASES: Record<string, readonly string[]> = {
  WBC: ['wbc', 'leukosit', 'leucocyte'],
  RBC: ['rbc', 'eritrosit'],
  HGB: ['hgb', 'hb', 'hemoglobin'],
  HCT: ['hct', 'hematokrit', 'ht'],
  MCV: ['mcv'],
  MCH: ['mch'],
  MCHC: ['mchc'],
  PLT: ['plt', 'trombosit', 'platelet'],
  NEUT: ['neut', 'neutrofil', 'neutrophil'],
  LYMPH: ['lymph', 'limfosit', 'lymphocyte'],
  APTT: ['aptt'],
  INR: ['inr'],
  PT: ['pt', 'protrombin', 'prothrombin'],
  GDS: ['gds', 'glukosa sewaktu', 'gula darah sewaktu'],
  GDP: ['gdp', 'glukosa puasa'],
  Ureum: ['ureum', 'urea', 'bun', 'ur'],
  Kreatinin: ['kreatinin', 'creatinin', 'creatinine', 'cr'],
  eGFR: ['egfr', 'gfr'],
  Albumin: ['albumin'],
  GOT: ['got', 'sgot', 'ast'],
  GPT: ['gpt', 'sgpt', 'alt'],
  Na: ['natrium', 'sodium', 'na'],
  K: ['kalium', 'potassium', 'k'],
  Cl: ['klorida', 'chloride', 'cl'],
  HBsAg: ['hbsag'],
  'Anti HCV': ['anti hcv', 'antihcv', 'hcv'],
  'Anti HIV': ['anti hiv', 'antihiv', 'hiv'],
  CRP: ['crp'],
  Troponin: ['troponin', 'hstroponin', 'hs troponin'],
  'D-Dimer': ['d dimer', 'ddimer'],
  Magnesium: ['magnesium', 'mg'],
  Kalsium: ['kalsium', 'calcium', 'ca'],
  LED: ['led', 'esr'],
  // Blood gas. These were falling into "Lain-lain", which buried a whole panel.
  pH: ['ph'],
  PO2: ['po2', 'p o 2'],
  PCO2: ['pco2', 'p c o 2'],
  SO2: ['so2', 's o 2'],
  HCO3: ['hco3', 'h c o 3'],
  BE: ['be', 'base excess'],
  ctO2: ['cto2'],
  ctCO2: ['ctco2'],
  Laktat: ['laktat', 'lactate'],
  // Urinalysis, reported as its own block in every note that carries it.
  'Urin warna': ['warna'],
  'Urin pH': ['ph urin'],
  'Urin BJ': ['bj', 'berat jenis'],
  Protein: ['protein'],
  Glukosa: ['glukose', 'glukosa urin'],
  Bilirubin: ['bilirubine', 'bilirubin'],
  Urobilinogen: ['urobilinogen', 'urobilonegen'],
  Keton: ['keton'],
  Nitrit: ['nitrit'],
  Blood: ['blood'],
  Leukosit: ['lekosit', 'leukosit urin'],
  'Golongan darah': ['golongan darah', 'gol darah'],
};

/**
 * How analytes combine on one line.
 *
 * Ordered: this is also the order of the output. A group prints only if at
 * least one member was found, and prints only the members that were.
 */
const GROUPS: ReadonlyArray<{ label: string; keys: readonly string[] }> = [
  { label: 'WBC', keys: ['WBC'] },
  { label: 'RBC', keys: ['RBC'] },
  { label: 'HGB', keys: ['HGB'] },
  { label: 'HCT', keys: ['HCT'] },
  { label: 'MCV/MCH/MCHC', keys: ['MCV', 'MCH', 'MCHC'] },
  { label: 'PLT', keys: ['PLT'] },
  { label: 'NEUT/LYMPH', keys: ['NEUT', 'LYMPH'] },
  { label: 'LED', keys: ['LED'] },
  { label: 'APTT/INR/PT', keys: ['APTT', 'INR', 'PT'] },
  { label: 'GDS', keys: ['GDS'] },
  { label: 'GDP', keys: ['GDP'] },
  { label: 'Ur/Cr', keys: ['Ureum', 'Kreatinin'] },
  { label: 'Albumin', keys: ['Albumin'] },
  { label: 'GOT/GPT', keys: ['GOT', 'GPT'] },
  { label: 'Na/K/Cl', keys: ['Na', 'K', 'Cl'] },
  { label: 'Ca/Mg', keys: ['Kalsium', 'Magnesium'] },
  { label: 'CRP', keys: ['CRP'] },
  { label: 'Troponin', keys: ['Troponin'] },
  { label: 'D-Dimer', keys: ['D-Dimer'] },
  { label: 'HBsAg', keys: ['HBsAg'] },
  { label: 'Anti HCV', keys: ['Anti HCV'] },
  { label: 'Anti HIV', keys: ['Anti HIV'] },
];

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Longest alias first, so `anti hcv` wins over `hcv`. */
const LOOKUP: ReadonlyArray<readonly [string, string]> = Object.entries(ALIASES)
  .flatMap(([key, aliases]) => aliases.map((alias) => [alias, key] as const))
  .sort((a, b) => b[0].length - a[0].length);

/**
 * The value on a result line.
 *
 * Takes the FIRST number after the analyte name and stops. Lab rows carry a
 * reference range and often a second numeric column, and taking the last number
 * would report the upper limit of normal as the patient's result — a mistake
 * that reads as plausible, which is the worst kind.
 *
 * Non-numeric results (`Reactive`, `Non Reactive`, `Negatif`) are matched
 * separately and passed through as written.
 */
const QUALITATIVE =
  /\b(non\s*reactive|reactive|negatif|negative|positif|positive|kuning\s*\w*|jernih|keruh)\b/i;

/**
 * Blood group, which is the one result with no number and no yes/no.
 *
 * `B Rh+` matched neither the numeric nor the qualitative pattern, so it was
 * dropped entirely — silently, which is the worst way to lose a value that
 * matters before an operation.
 */
const BLOOD_GROUP = /\b(A|B|AB|O)\s*(Rh)?\s*[+-]?\s*(positif|negatif|pos|neg)?/i;

/**
 * Report furniture that looks exactly like a result line.
 *
 * Every one of these is "a word followed by a number", which is the shape this
 * parser looks for. Excluding them by name is unglamorous and it is also the
 * only thing that works: there is no structural difference between
 * `Halaman 1 dari 2` and `Albumin 3.3`.
 */
/**
 * Recognised, and deliberately not reported.
 *
 * A third category, distinct from "unknown". These are genuine results — red
 * cell indices, the platelet and differential extras — that a handover never
 * carries. Dumping them into "Lain-lain" would bury the one genuinely
 * unfamiliar test under eight routine ones, which defeats the point of having
 * that section at all.
 *
 * They are omitted, not lost: the full report is still the source of truth, and
 * anything here can be added to ALIASES and GROUPS the day it starts mattering.
 */
const OMITTED_ANALYTES: readonly string[] = [
  'rdw sd',
  'rdw cv',
  'rdw',
  'pdw',
  'mpv',
  'pct',
  'mono',
  'eo',
  'baso',
  'nrbc',
  'p lcr',
  'plcr',
  'ig',
];

const IGNORED_LABELS: readonly string[] = [
  'halaman',
  'page',
  'no lab',
  'no rm',
  'registrasi',
  'tgl',
  'tanggal',
  'lahir',
  'hasil',
  'dokter',
  'unit',
  'ruang',
  'nama',
  'sex',
  'umur',
  'diagnosa',
  'nilai rujukan',
];

function extractValue(rest: string, key?: string): string | null {
  if (key === 'Golongan darah') {
    const group = BLOOD_GROUP.exec(rest);
    if (group?.[0]) return group[0].replace(/\s+/g, ' ').trim();
  }

  const qualitative = QUALITATIVE.exec(rest);
  if (qualitative?.[0]) return qualitative[0].replace(/\s+/g, ' ').trim();

  const numeric = /-?\d+(?:[.,]\d+)?/.exec(rest);
  return numeric ? numeric[0] : null;
}

function matchAnalyte(line: string): { key: string; rest: string } | null {
  const flat = normalise(line);
  if (!flat) return null;

  for (const [alias, key] of LOOKUP) {
    // Anchored at the start: a reference range mentioning "kalium" must not
    // turn a potassium row into a second potassium row.
    if (flat === alias || flat.startsWith(`${alias} `)) {
      const rest = line.slice(line.toLowerCase().indexOf(alias.split(' ')[0] ?? '') + alias.length);
      return { key, rest };
    }
  }

  return null;
}

/**
 * A line already in handover form: `Na/K/Cl: 141/4.4/103`.
 *
 * The printout parser reads one analyte per row, which is right for a lab
 * report — but a note carries the compact grouped form, and pasting a previous
 * day's block back in has to work too. Both are the same information; only the
 * shape differs.
 *
 * Split only when the counts match. `Ur/Cr: 30` is ambiguous — is 30 the urea
 * or the creatinine? — and a guess there puts a number under the wrong name,
 * which is exactly the failure that reads as plausible.
 */
function splitGrouped(line: string): Array<[string, string]> | null {
  const match = /^\s*([A-Za-z][A-Za-z0-9\s]*(?:\/[A-Za-z0-9\s]+)+)\s*[:=]\s*(.+)$/.exec(line);
  if (!match?.[1] || !match[2]) return null;

  const names = match[1].split('/').map((name) => name.trim());
  const values = match[2].split('/').map((value) => value.trim());
  if (names.length < 2 || names.length !== values.length) return null;

  const pairs: Array<[string, string]> = [];
  for (const [index, name] of names.entries()) {
    const key = resolveAlias(name);
    const value = values[index];
    if (!key || !value || !/\d/.test(value)) return null;
    pairs.push([key, value]);
  }

  return pairs;
}

/** Canonical key for an analyte name, or null when it is not one we know. */
function resolveAlias(name: string): string | null {
  const flat = normalise(name);
  if (!flat) return null;
  for (const [alias, key] of LOOKUP) {
    if (flat === alias) return key;
  }
  return null;
}

export function parseLab(raw: string): LabParseResult {
  const found = new Map<string, string>();
  const unknown: LabValue[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const grouped = splitGrouped(trimmed);
    if (grouped) {
      for (const [key, value] of grouped) {
        if (!found.has(key)) found.set(key, value);
      }
      continue;
    }

    const matched = matchAnalyte(trimmed);
    if (matched) {
      const value = extractValue(matched.rest, matched.key);
      // First occurrence wins: printouts repeat analyte names in section
      // headers and footers, and the first is the result row.
      if (value && !found.has(matched.key)) found.set(matched.key, value);
      continue;
    }

    // A line with a name and a number that matched nothing known.
    //
    // The label is whatever precedes the first number, which keeps this from
    // treating a whole sentence as an analyte. Page furniture is excluded by
    // name: a printout header carries a registration number, a date and a page
    // count, and every one of them is "a word followed by a number".
    const value = extractValue(trimmed);
    const label = trimmed.slice(0, trimmed.search(/-?\d/)).replace(/[:\s]+$/, '').trim();

    // Analyte names are one to three words. That single constraint is what
    // separates a real unrecognised result from OCR noise: garbled text arrives
    // as a run of short fake words followed by a number, and passing it through
    // as "Lain-lain" presents nonsense as if it were a lab value.
    const words = label.split(/\s+/).filter(Boolean);
    const flatLabel = normalise(label);

    if (
      value &&
      !OMITTED_ANALYTES.includes(flatLabel) &&
      label.length >= 2 &&
      label.length <= 30 &&
      words.length <= 3 &&
      /[A-Za-z]/.test(label) &&
      !IGNORED_LABELS.some((word) => normalise(label).includes(word))
    ) {
      unknown.push({ key: label, value });
    }
  }

  const known: LabValue[] = [];
  const lines: string[] = [];

  for (const group of GROUPS) {
    const present = group.keys.filter((key) => found.has(key));
    if (present.length === 0) continue;

    for (const key of present) known.push({ key, value: found.get(key) ?? '' });

    const label =
      present.length === group.keys.length ? group.label : present.join('/');
    lines.push(`${label} ${present.map((key) => found.get(key)).join('/')}`);
  }

  // eGFR is written in parentheses after Ur/Cr, not on a line of its own.
  const egfr = found.get('eGFR');
  if (egfr) {
    const index = lines.findIndex((line) => line.startsWith('Ur/Cr '));
    if (index >= 0) lines[index] = `${lines[index]} (eGFR ${egfr})`;
    else lines.push(`eGFR ${egfr}`);
  }

  for (const panel of PANELS) {
    const present = panel.keys.filter((key) => found.has(key));
    if (present.length === 0) continue;
    lines.push('');
    lines.push(panel.heading);
    for (const key of present) {
      const label = key.startsWith('Urin ') ? key.slice(5) : key;
      lines.push(`${label} ${found.get(key)}`);
      known.push({ key, value: found.get(key) ?? '' });
    }
  }

  const bloodGroup = found.get('Golongan darah');
  if (bloodGroup) lines.push(`Golongan darah ${bloodGroup}`);

  if (unknown.length > 0) {
    lines.push('');
    lines.push('Lain-lain:');
    for (const item of unknown) lines.push(`${item.key} ${item.value}`);
  }

  return { known, unknown, formatted: lines.join('\n') };
}

/** Heading for the dated block this gets pasted under. */
export function labHeading(date: string, source = 'Laboratorium'): string {
  return `*${source} (${date})*`;
}

/**
 * Where a lab block belongs in the note.
 *
 * Investigations are read as part of the objective findings, and every handover
 * you write stacks them under O. Appending to the end of the note put them
 * after Plan, which is both wrong to read and wrong to copy: the "O + Penunjang"
 * copy group selects by section, so a block sitting under Plan would be copied
 * with the plan instead.
 *
 * Inserted at the END of the O block — after any existing dated blocks, so the
 * stack grows downward in the order results arrived — and before the next
 * unrelated section. With no O section at all it appends, which is the only
 * honest fallback: guessing a position inside a note is worse than the end.
 */
export function insertIntoObjective(
  body: string,
  block: string,
  boundaries: readonly { sectionId: string; start: number; end: number }[],
): string {
  const objectiveIds = ['o', 'ttv', 'penunjang'];
  const clinicalAfter = ['a', 'p', 'terapi'];

  const objective = boundaries.filter((section) => objectiveIds.includes(section.sectionId));
  if (objective.length === 0) {
    const trimmed = body.trimEnd();
    return trimmed ? `${trimmed}\n\n${block}` : block;
  }

  const lastObjectiveEnd = Math.max(...objective.map((section) => section.end));

  // Any custom block (an EKG, a previous lab) sitting between O and the next
  // clinical heading is part of the investigation stack, so insert after it.
  const nextClinical = boundaries
    .filter((section) => section.start >= lastObjectiveEnd)
    .filter((section) => clinicalAfter.includes(section.sectionId))
    .sort((a, b) => a.start - b.start)[0];

  const at = nextClinical ? nextClinical.start : body.length;
  const before = body.slice(0, at).trimEnd();
  const after = body.slice(at);

  return `${before}\n\n${block}${after ? `\n\n${after.trimStart()}` : ''}`;
}
