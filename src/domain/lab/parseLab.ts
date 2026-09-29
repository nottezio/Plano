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
  /**
   * Outside the reference range PRINTED ON THE SHEET, when one was printed.
   *
   * `undefined` means the question was not answerable — no range on the line,
   * a value that is not a number, a qualitative result with no stated normal.
   * That is deliberately different from `false`: nothing should be marked
   * normal on the strength of the app failing to read a range.
   *
   * There is NO built-in table of reference ranges here and there must not be.
   * Ranges differ by laboratory, by analyser and by patient age and sex, and a
   * value flagged abnormal against a range this hospital does not use is worse
   * than no flag at all. The printout states its own ranges; those are the
   * only ones this can defend.
   */
  abnormal?: boolean;
}

/** A reference range as printed, once parsed. */
interface Range {
  min: number;
  max: number;
}

/**
 * `4.5 - 8.0`, `0 - 30`, `1.005 - 1.035` — the numeric reference range.
 *
 * Only a two-sided numeric span. One-sided forms like `< 5` and `>= 90` are
 * deliberately not read: a value can be flagged against them, but the sheet
 * writes them inconsistently enough (`<5`, `< 5`, `&lt;5`) that the first
 * misparse would flag a normal result, and a wrong bold on a lab value is a
 * clinician looking twice at nothing.
 */
function parseRange(text: string): Range | null {
  const match = /^\s*(-?\d+(?:[.,]\d+)?)\s*-\s*(-?\d+(?:[.,]\d+)?)\s*$/.exec(text);
  if (!match) return null;
  const min = Number(match[1]!.replace(',', '.'));
  const max = Number(match[2]!.replace(',', '.'));
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null;
  return { min, max };
}

/**
 * Is this value outside the printed range?
 *
 * Returns `undefined` rather than guessing whenever the comparison cannot be
 * made — a graded result, a comparison operator, a word.
 */
function isOutsideRange(value: string, range: Range | null): boolean | undefined {
  if (!range) return undefined;
  // `1+`, `>=300`, `BAC=2`: real values, but not ones a numeric range answers.
  if (!/^-?\d+(?:[.,]\d+)?$/.test(value.trim())) return undefined;
  const numeric = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(numeric)) return undefined;
  return numeric < range.min || numeric > range.max;
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
    /**
     * Full urinalysis panel, in printout order.
     *
     * The sediment and ratio rows were added after the first version only
     * carried the automated-analyser fields (warna through leukosit) — the
     * printout also runs a microscopy count and two nephrology ratios below
     * that, and every one of them was falling to `unknown` (if the label and
     * value shared a line) or being silently dropped (if they did not — see
     * the lookahead in `parseLab`).
     */
    keys: [
      'Urin Warna', 'Urin pH', 'Urin BJ', 'Protein', 'Glukosa', 'Bilirubin',
      'Urobilinogen', 'Keton', 'Nitrit', 'Blood', 'Urin Eritrosit', 'Leukosit', 'Urin Vit C',
      'Sedimen Eritrosit', 'Sedimen Kristal', 'Sedimen Epitel', 'Sedimen Lain-lain',
      'Sedimen Leukosit', 'Sedimen Torak', 'Rasio Albumin Kreatinin',
      'Rasio Protein Kreatinin',
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
  //
  // `pH` is ambiguous on its own: a urinalysis panel also has a row called
  // `Ph`, written identically. This alias only fires when SECTION context
  // says blood gas — see `matchAnalyte`'s section argument — so the urine
  // row is free to claim the same word under `Urin pH` without a collision.
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
  'Urin Warna': ['warna'],
  // Matches bare `Ph`/`pH` too, disambiguated from the blood-gas alias above
  // by section context: this only fires while the current section is
  // urinalysis.
  'Urin pH': ['ph urin', 'ph'],
  'Urin BJ': ['bj', 'berat jenis'],
  Protein: ['protein'],
  Glukosa: ['glukose', 'glukosa urin', 'glukosa'],
  'Urin Eritrosit': ['eritrosit urin'],
  Bilirubin: ['bilirubine', 'bilirubin'],
  Urobilinogen: ['urobilinogen', 'urobilonegen'],
  Keton: ['keton'],
  Nitrit: ['nitrit'],
  Blood: ['blood'],
  Leukosit: ['lekosit', 'leukosit urin'],
  // Written `Vit, C` on this printout (comma, not the expected period) and
  // `Vit. C` / `Vitamin C` elsewhere. `normalise()` strips all punctuation
  // before matching, so both collapse to `vit c` regardless — the alias only
  // needs to be written once.
  'Urin Vit C': ['vit c', 'vitamin c'],
  // Microscopy / sediment count. `sedimen` is spelled with and without a
  // capital across printouts; `normalise()` lowercases before matching, so one
  // alias covers both.
  'Sedimen Eritrosit': ['sedimen eritrosit'],
  'Sedimen Kristal': ['sedimen kristal'],
  'Sedimen Epitel': ['sedimen epitel sel', 'sedimen epitel'],
  // `Sedimen Lain - lain` on the printout, `Sedimen Lain-lain` in the note —
  // both normalise to `sedimen lain lain`.
  'Sedimen Lain-lain': ['sedimen lain lain'],
  'Sedimen Leukosit': ['sedimen lekosit', 'sedimen leukosit'],
  'Sedimen Torak': ['sedimen torak'],
  'Rasio Albumin Kreatinin': ['rasio albumin creatinin', 'rasio albumin kreatinin'],
  'Rasio Protein Kreatinin': ['rasio protein creatinin', 'rasio protein kreatinin'],
  'Golongan darah': ['golongan darah', 'gol darah'],
  // Lipids and uric acid: routine on a cardiology ward, and every one of them
  // was landing in "Lain-lain" (SIMGOS prints `Kolesterol HDL`, `Kolesterol
  // LDL`, `Kolesterol Total`, `Trigliserida`, `Asam Urat`). The test-name rows
  // above them (`CHOLESTEROL HDL / HDL KOLESTEROL`) carry no value and are
  // skipped as before.
  'Kol Total': ['kolesterol total', 'cholesterol total', 'total cholesterol', 'total kolesterol'],
  LDL: ['kolesterol ldl', 'cholesterol ldl', 'ldl kolesterol', 'ldl cholesterol', 'ldl'],
  HDL: ['kolesterol hdl', 'cholesterol hdl', 'hdl kolesterol', 'hdl cholesterol', 'hdl'],
  TG: ['trigliserida', 'trigliserid', 'triglyceride', 'triglycerides', 'tg'],
  'Asam Urat': ['asam urat', 'uric acid'],
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
  { label: 'Asam urat', keys: ['Asam Urat'] },
  { label: 'Albumin', keys: ['Albumin'] },
  { label: 'GOT/GPT', keys: ['GOT', 'GPT'] },
  { label: 'Na/K/Cl', keys: ['Na', 'K', 'Cl'] },
  { label: 'Ca/Mg', keys: ['Kalsium', 'Magnesium'] },
  { label: 'Kol total/LDL/HDL/TG', keys: ['Kol Total', 'LDL', 'HDL', 'TG'] },
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
/**
 * Urinalysis grading (`1+`, `2+`, `3+`, `4+`) checked FIRST.
 *
 * Without this, `1+` matched the plain numeric pattern below, which returns
 * only `1` — dropping the `+` silently turns a graded trace result into what
 * reads as a plain count, on a panel where the difference between `1+` and
 * `3+` protein is the clinical finding.
 */
const GRADED = /^[\s:=]*([0-4]\+)/;

/**
 * ALL value patterns are anchored to the start of the value region, like the
 * numeric one below. The numeric pattern was anchored when it was found reading
 * a reference range as the result; these three were not, and made the same
 * mistake on words:
 *
 *  - `Vit, C - Negatif`: result `-` (not done), reference `Negatif`. The
 *    unanchored search found the reference and reported `Vit C Negatif`.
 *  - `Warna Kuning Kuning Muda`: `kuning\s*\w*` swallowed the reference and
 *    gave `Kuning Kuning`.
 *  - `GOLONGAN DARAH/ GOL.DARAH (ABO) + RHESUS`, the test-name row above the
 *    result, gave blood group `A` from "(ABO)". The real row said `B Rh+`, and
 *    first-occurrence-wins kept the `A`.
 */
const QUALITATIVE =
  /^[\s:=]*(non\s*reactive|reactive|negatif|negative|positif|positive|kuning(?:\s+(?:muda|tua))?|agak\s+keruh|jernih|keruh)\b/i;

/** A result word anywhere in a row, used only to decide a row is worth showing. */
const QUALITATIVE_ANYWHERE =
  /\b(non\s*reactive|reactive|negatif|negative|positif|positive)\b/i;

/**
 * Blood group, which is the one result with no number and no yes/no.
 *
 * `B Rh+` matched neither the numeric nor the qualitative pattern, so it was
 * dropped entirely — silently, which is the worst way to lose a value that
 * matters before an operation.
 */
const BLOOD_GROUP =
  /^[\s:=]*(AB|A|B|O)(?![A-Za-z0-9])\s*(?:Rh\s*)?[+-]?\s*(?:positif|negatif|pos|neg)?/i;

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

/**
 * Words a printout adds AFTER the analyte name that do not change which
 * analyte it is: `Laktat Darah 1.2`, `Hs Troponin I < 0.010`,
 * `Kreatinin Serum 1.1`.
 *
 * WHY THIS EXISTS: the name used to end where the ALIAS ended. `laktat`
 * matched, and the value region began at ` Darah 1.2`. Value reading is
 * anchored to the start of that region (see below: that anchor is what
 * stops a reference range being read as the result), so it found nothing,
 * and the row was dropped. The name really ends where the VALUE begins.
 *
 * An ALLOWLIST, not "skip any word". `Kalium Urin 20` is not serum
 * potassium, and chemistry `Bilirubin Total 0.5` is not the urinalysis
 * bilirubin. Skipping those words would report a real number under the
 * wrong name, which is the one failure worse than missing (Rule 1). Anything
 * not listed here falls through to "Lain-lain" with its full printed name.
 */
const HARMLESS_QUALIFIERS = new Set([
  'darah', 'serum', 'plasma', 'arteri', 'vena', 'i', 't',
  // Assay methods, printed bare as often as in parentheses: `HBsAg CMIA Non
  // Reactive`. How it was measured, never what.
  'cmia', 'eclia', 'clia', 'elisa', 'elfa', 'rapid', 'ict',
]);

/**
 * `extractValue`, after stepping over up to three harmless qualifier words.
 * Tries the region as given first, so every line that already parsed parses
 * identically.
 */
function extractAfterQualifiers(rest: string, key: string): string | null {
  const direct = extractValue(rest, key);
  if (direct || key === 'Golongan darah') return direct;
  let region = rest;
  for (let step = 0; step < 3; step++) {
    // A method in parentheses, `Anti HIV ( CMIA ) Non Reactive`, names how
    // it was measured, not what; it is always harmless.
    const word = /^[\s,:]*(\(\s*[A-Za-z ]+\s*\)|[A-Za-z]+)(?=[\s,:]|$)/.exec(region);
    const token = word?.[1];
    if (!token) return null;
    if (!token.startsWith('(') && !HARMLESS_QUALIFIERS.has(token.toLowerCase())) return null;
    region = region.slice(word[0].length);
    const value = extractValue(region, key);
    if (value) return value;
  }
  return null;
}

function extractValue(rest: string, key?: string): string | null {
  if (key === 'Golongan darah') {
    const group = BLOOD_GROUP.exec(rest);
    if (group?.[0]) return group[0].replace(/^[\s:=]+/, '').replace(/\s+/g, ' ').trim();
  }

  const graded = GRADED.exec(rest);
  if (graded?.[1]) return graded[1];

  const qualitative = QUALITATIVE.exec(rest);
  if (qualitative?.[1]) return qualitative[1].replace(/\s+/g, ' ').trim();

  /**
   * `>=300`, `BAC=2` — a comparison or a labelled count in front of the
   * number, kept rather than stripped.
   *
   * The bare numeric pattern below would return `300` for `>=300`, and `>=300`
   * is not the same clinical fact as `300` — one says "past the top of the
   * scale", the other says a value. `BAC=2` names WHAT the 2 is (bacteria);
   * dropping `BAC=` turns a labelled sediment count into an unlabelled one.
   *
   * ANCHORED to the start of the value region, which is the whole reason this
   * is safe. Unanchored, it searched the entire line and found the reference
   * range instead of the result: `eGFR 64 >= 90` returned `>= 90`, reporting
   * the lower limit of normal as the patient's eGFR. That is precisely the
   * mistake Rule 1 at the top of this file exists to prevent — a wrong number
   * that reads as entirely plausible. A qualifier belongs to the result only
   * when it is the first thing on the line.
   */
  const qualified = /^\s*(?:>=|<=|[<>=]|[A-Za-z]{2,5}=)\s*-?\d+(?:[.,]\d+)?/.exec(rest);
  if (qualified?.[0]) return qualified[0].replace(/\s+/g, '').trim();

  /**
   * An analyte that was NOT RESULTED. `LED  -  (L <10, P <20 )  mm`.
   *
   * The dash is the result column saying there is no result. Checked before
   * the numeric pattern because the reference range that follows is full of
   * numbers, and one of them will otherwise be reported as the patient's.
   */
  if (/^[\s:=]*-(?=[\s)]|$)/.test(rest)) return null;

  /**
   * ANCHORED, for exactly the reason the qualified pattern above is.
   *
   * That comment describes finding the reference range instead of the result,
   * and the fix was applied there and not here — one line further down, in the
   * fallback that handles the overwhelming majority of lines. So the bug it
   * describes was still live for every plain numeric result:
   *
   *     LED  -  (L <10, P <20 )  mm      ->  LED 10
   *
   * The dash means not resulted; `10` is the upper limit of normal for men,
   * read out of the reference range and reported as this patient's ESR. A
   * fabricated value that looks entirely ordinary, which is the failure this
   * file's Rule 1 exists to prevent.
   *
   * A result is the FIRST thing in the value region. Anything found later on
   * the line belongs to the reference range or the units.
   */
  const numeric = /^[\s:=]*(-?\d+(?:[.,]\d+)?)/.exec(rest);
  return numeric?.[1] ?? null;
}

/**
 * Section headings that disambiguate an alias shared by two panels.
 *
 * `Ph` alone is written by both the blood-gas panel and the urinalysis panel
 * on real printouts, with no other distinguishing text on that line. The
 * alias itself cannot resolve it — only which section the line falls under
 * can, so this is tracked separately and passed into `matchAnalyte`.
 */
const SECTION_HEADINGS: ReadonlyArray<readonly [RegExp, string]> = [
  [/analisa\s*gas\s*darah|blood\s*gas|\bagd\b/i, 'gas'],
  [/urinalisis|urinalisa|urinalysa/i, 'urine'],
  // A blood section after urinalysis ends it: without this, a hematology
  // block printed below the urine would have its Leukosit read as urine.
  [/^(?:hematolog\w*|darah\s+rutin|darah\s+lengkap|kimia\s+darah|kimia\s+klinik|elektrolit|hemostasis|koagulasi)\b/i, 'blood'],
];

/**
 * Aliases that resolve differently depending on which section they are in.
 *
 * `leukosit` and `eritrosit` are the blood count everywhere EXCEPT under
 * Urinalisis, where the same words are the urine rows. Reading them as WBC/RBC
 * there put `2+` under the blood count, or (first wins) hid the urine result
 * behind the real one.
 */
const SECTION_SCOPED: Readonly<Record<string, Partial<Record<string, string>>>> = {
  ph: { gas: 'pH', urine: 'Urin pH' },
  leukosit: { urine: 'Leukosit' },
  eritrosit: { urine: 'Urin Eritrosit' },
  glukosa: { urine: 'Glukosa' },
};

/** Scoped aliases that mean nothing outside their section (left to Lain-lain). */
const SECTION_ONLY = new Set(['glukosa']);

/**
 * Analyte names that CONTAIN a number: the number is part of the name.
 *
 * Two readers got these wrong. The two-letter alias `ca` claimed `CA 19-9 30`
 * as calcium 19, and the fallback cut every unknown label at its first digit,
 * so `HbA1c 6.5` became `HbA 1` and `FT4 1.5` became `FT 4`.
 */
const NUMBERED_NAME =
  /^(?:ca\s*-?\s*(?:19\s*-\s*9|125|15\s*-\s*3|72\s*-\s*4|27\s*[-.]\s*29)|hba1c|ft3|ft4|t3|t4|vit(?:amin)?\.?\s*b12|vit(?:amin)?\.?\s*d3|25\s*-?\s*oh\s*(?:vit(?:amin)?\.?\s*)?d|nt\s*-?\s*pro\s*-?\s*bnp|il\s*-?\s*6|cd4)\b/i;

/** The length of a numbered analyte name at the start of `line`, or 0. */
function numberedNameLength(line: string): number {
  return NUMBERED_NAME.exec(line)?.[0].length ?? 0;
}

function matchAnalyte(line: string, section: string | null): { key: string; rest: string } | null {
  const flat = normalise(line);
  if (!flat) return null;
  // `CA 19-9` is not calcium: a name with a number in it is left to the
  // fallback, which keeps the whole name.
  if (numberedNameLength(line.trim()) > 0) return null;

  for (const [alias, key] of LOOKUP) {
    // Anchored at the start: a reference range mentioning "kalium" must not
    // turn a potassium row into a second potassium row.
    const exact = flat === alias;
    if (exact || flat.startsWith(`${alias} `)) {
      const scoped = SECTION_SCOPED[alias];
      const inSection = scoped?.[section ?? ''];
      if (!inSection && SECTION_ONLY.has(alias)) continue;
      const resolvedKey = inSection ?? key;

      /**
       * `rest` is what follows the analyte name on the same line.
       *
       * When the WHOLE line is the name, that is empty by definition — and it
       * has to be computed that way rather than by arithmetic, because the
       * arithmetic below is wrong whenever normalisation changed the length.
       * `normalise` turns punctuation into spaces and collapses runs of them,
       * so `Vit, C` (6 chars) becomes `vit c` (5) and `Sedimen Lain - lain`
       * (19) becomes `sedimen lain lain` (17). Slicing the RAW line by the
       * NORMALISED alias length then left `'C'` and `'in'` behind — non-empty,
       * which suppressed the next-line lookahead, which meant the value was
       * never read and the whole row disappeared from the panel.
       *
       * Every label containing punctuation was affected. It went unnoticed
       * because the labels that happen to be plain words — `Sedimen
       * Eritrosit`, `Leukosit` — compute correctly and looked like proof the
       * logic worked.
       */
      if (exact) return { key: resolvedKey, rest: '' };

      /*
        MAPPED, NOT MEASURED. The value region used to be the raw line sliced at
        the normalised alias's LENGTH, and the comment above says why that is
        wrong. The exact-match case was fixed and the general one was not:
        `Sedimen Lain - lain BAC=2` sliced at 17 left `in BAC=2`, which read as
        nothing, and the row vanished. The alias's words are now found in the
        raw line in order, across whatever punctuation separates them.
      */
      const words = alias.split(' ').map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const head = new RegExp(`^[^a-z0-9]*${words.join('[^a-z0-9]+')}`, 'i').exec(line);
      const rest = head ? line.slice(head[0].length) : '';
      return { key: resolvedKey, rest };
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
  /*
    THE SEPARATOR IS OPTIONAL, and that is the fix for a parser that could not
    read its own output.

    This was written for pasted hospital sheets, which write
    `Na/K/Cl : 136/3.6/103`, and required the colon. Plano's own canonical
    format uses a space — `Na/K/Cl 136/3.6/103` — so every grouped row in a
    note this app had already formatted was silently dropped on the way back
    in: Na/K/Cl, Ur/Cr, GOT/GPT, MCV/MCH/MCHC, NEUT/LYMPH, APTT/INR/PT. Across
    200 lab blocks from the export that is roughly 300 lines, and the failure
    was invisible because the remaining rows still parsed and the result still
    looked like a lab block.

    Dropping the colon is not enough on its own, and the first attempt was
    wrong in a way worth recording: with `[A-Za-z0-9\s]+` in the name, the
    greedy match ate the start of the value — `Na/K/Cl 134/3.4/103` split as
    name `Na/K/Cl 13` and value `4/3.4/103`, which then failed the alias check
    and dropped the row exactly as before. The name segments must therefore
    exclude spaces and the value must be a slash-joined run beginning with a
    digit. Every grouped label in this corpus is single-word per segment
    (`Na`, `MCV`, `APTT`), and the multi-word ones — `Anti HCV` — are never
    grouped, so nothing is lost by the restriction.
  */
  const match =
    /^\s*([A-Za-z][A-Za-z0-9]*(?:\s*\/\s*[A-Za-z0-9]+)+)\s*[:=]?\s+(\d[^\s/]*(?:\s*\/\s*[^\s/]+)+.*)$/.exec(
      line,
    );
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

/**
 * Does this line look like a reference range rather than a result?
 *
 * Deliberately narrow, because this is only ever used to decide whether to
 * SKIP a line — a false positive here would swallow a real analyte's row.
 * Matches the two shapes a printout actually uses: `4.5 - 8.0` (a numeric
 * span) and a bare qualitative word standing alone (`Negatif`, `Normal`,
 * `Kuning Muda`) with nothing else on the line, which is how a printout
 * writes "the normal reading is X" for a qualitative test.
 */
function looksLikeRange(line: string): boolean {
  if (/^-?\d+(?:[.,]\d+)?\s*-\s*-?\d+(?:[.,]\d+)?$/.test(line)) return true;
  const flat = normalise(line);
  return /^(negatif|negative|normal|kuning\s*muda|jernih)$/.test(flat);
}

/**
 * The SIMGOS results table: where a report starts, its header row, and what
 * ends it.
 *
 * A SIMGOS PDF is a page, not a table. Above the table sit the patient header
 * and a Diagnosa field that wraps onto extra lines; below it, the Kesan, the
 * analyst, and a signature line `MAKASSAR, 15-09-2026 14:27:18`. All of it was
 * read as possible results, and anything shaped "words then a number" reached
 * "Lain-lain": `MAKASSAR, 15` on every report, `Hypokalemia ( 2.9`,
 * `Post PCI 1`. Those are not results that went unrecognised; they were never
 * results.
 *
 * So the text is read as a sequence of states, per report:
 *
 *   free   ─ `HASIL PEMERIKSAAN LABORATORIUM` ─▶ header   (patient block, skipped)
 *   header ─ `PEMERIKSAAN HASIL NILAI RUJUKAN` ─▶ table   (read)
 *   table  ─ `Kesan / Saran`, `Halaman 1 dari 2` ─▶ footer (skipped)
 *   footer ─ next report / next table header ─▶ header / table
 *   footer ─ a BLANK line ─▶ free
 *
 * Per report, not per text: the sheet appends several PDFs and pasted lines
 * into one box, and a global "only read the table" would have swallowed the
 * pasted lines. PDF text never contains a blank line (rows are rebuilt and
 * empties dropped), so the sheet separates appended sources with one, and
 * that is what hands control back to free text. Text with no report in it at
 * all (a paste, a note) stays `free` throughout and is read as before.
 */
const REPORT_START = /^hasil\s+pemeriksaan\s+laboratorium\b/i;
const TABLE_HEADER = /^pemeriksaan\s+hasil\s+nilai\s+rujukan\b/i;
const TABLE_END = /^(kesan\s*\/\s*saran|ahli\s+teknologi|halaman\s+\d+\s+dari\s+\d+)/i;

/**
 * Which kind of SIMGOS document a PDF's text is.
 *
 * Every lab PDF in the corpus (36 of 36) carries `HASIL PEMERIKSAAN
 * LABORATORIUM`; none of the radiology, echo, EP study or ablation reports
 * do. Those were read as if they were labs and filled "Lain-lain" with
 * `Radiografi Thorax 1`, `MR. 24`, `- Aorta 3`. The sheet uses this to say
 * "not a lab report" instead of producing that.
 *
 * `unknown` (a paste, a screenshot's OCR) is read normally.
 */
export function labReportKind(text: string): 'lab' | 'other' | 'unknown' {
  if (/hasil\s+pemeriksaan\s+laboratorium/i.test(text)) return 'lab';
  if (
    /hasil\s+pemeriksaan\s+radiologi|^\s*laporan\s+(operasi|ekokardiografi|echocardiograph|electrophy|radiofrequency)/im.test(
      text,
    )
  ) {
    return 'other';
  }
  return 'unknown';
}

/**
 * How many lines the results-table header occupies at `index`, or 0.
 *
 * Two layouts: one row (`PEMERIKSAAN HASIL NILAI RUJUKAN SATUAN`), or one
 * cell per line (`PEMERIKSAAN` / `HASIL` / `NILAI RUJUKAN` / `SATUAN`), which
 * is how some exports extract.
 */
function tableHeaderLength(lines: readonly string[], index: number): number {
  const line = lines[index]?.trim() ?? '';
  if (TABLE_HEADER.test(line)) return 1;
  if (!/^pemeriksaan$/i.test(line) || !/^hasil$/i.test(lines[index + 1]?.trim() ?? '')) return 0;
  let length = 2;
  if (/^nilai\s+rujukan$/i.test(lines[index + length]?.trim() ?? '')) length += 1;
  if (/^satuan$/i.test(lines[index + length]?.trim() ?? '')) length += 1;
  return length;
}

/** Is there a table header before this report ends (next report, or a blank line)? */
function tableHeaderAhead(lines: readonly string[], from: number): boolean {
  for (let index = from; index < lines.length; index++) {
    const line = lines[index]?.trim() ?? '';
    if (!line || REPORT_START.test(line)) return false;
    if (tableHeaderLength(lines, index) > 0) return true;
  }
  return false;
}

/**
 * Lines that annotate a row rather than being one: `(Darah Arteri : 0.6 - 1.5)`
 * under the lactate row states the reference range per specimen. Wrapped in
 * parentheses, which no result line is.
 */
const ANNOTATION = /^\(.*\)$/;

/** `MAKASSAR, 15-09-2026 …`: the signature line, for text read without a table. */
const SIGNATURE = /^[A-Za-z .]+,\s*\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/;

export interface LabParseOptions {
  /**
   * Wrap values outside their PRINTED reference range in `*…*`.
   *
   * Off by default. Bolding is a claim, and it is only defensible where the
   * sheet stated a range — see `LabValue.abnormal`. A value with no printed
   * range is never bolded, which is why this can be trusted: an unbolded value
   * means "not flagged", never "checked and normal".
   */
  boldAbnormal?: boolean;
}

/**
 * Index of the first WHOLE number in `line` (a token that is only a number,
 * optionally signed or decimal, possibly followed by a unit or `%`), or -1.
 * `B12` and `1c` are parts of words, not numbers.
 */
function wholeNumberAt(line: string): number {
  const match = /(^|[\s:=(])(-?\d+(?:[.,]\d+)?)(?![A-Za-z0-9])/.exec(line);
  return match ? match.index + (match[1]?.length ?? 0) : -1;
}

export function parseLab(raw: string, options: LabParseOptions = {}): LabParseResult {
  const found = new Map<string, string>();
  /** Printed reference range per analyte, when the sheet stated one. */
  const ranges = new Map<string, Range | null>();
  const unknown: LabValue[] = [];

  /**
   * Lines, kept as an array rather than iterated with `for..of`, because one
   * layout needs to look at the NEXT line and a plain iterator cannot peek.
   *
   * That layout is this hospital's own PDF export. Its text layer puts each
   * column on its own line — `Warna` \\n `Kuning` \\n `Kuning Muda`, not
   * `Warna Kuning Kuning Muda` — because the PDF's underlying table has one
   * cell per line and the text extraction reads cell by cell rather than row
   * by row. `matchAnalyte` finds `Warna` and returns an EMPTY `rest`, since the
   * value is not on that line to return. Every urinalysis row was silently
   * dropped this way: recognised as an analyte, worth nothing without a value,
   * and never appended to `unknown` either — a matched line only reaches the
   * `unknown` branch when nothing matches it.
   */
  const rawLines = raw.split('\n').map((line) => line.trim());

  /**
   * Which panel the current line falls under, updated as section headings are
   * seen. Needed only to resolve `Ph`, which both the blood-gas and urinalysis
   * panels write bare with nothing else on the line to tell them apart.
   */
  let section: string | null = null;

  let state: 'free' | 'header' | 'table' | 'footer' = 'free';

  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i]!;
    if (!trimmed) {
      if (state === 'footer') state = 'free';
      continue;
    }

    if (REPORT_START.test(trimmed)) {
      /*
        FAIL OPEN. Only skip the patient header if this report's table header
        is actually found further on. A layout whose header this does not
        recognise is read whole, as before this scoping existed: some page
        furniture in "Lain-lain" is a nuisance; a report that yields nothing
        at all is a lost result.
      */
      if (tableHeaderAhead(rawLines, i + 1)) state = 'header';
      continue;
    }
    const header = tableHeaderLength(rawLines, i);
    if (header > 0) {
      state = 'table';
      i += header - 1;
      continue;
    }
    if (state === 'table' && TABLE_END.test(trimmed)) state = 'footer';
    if (state === 'header' || state === 'footer') continue;
    if (ANNOTATION.test(trimmed) || SIGNATURE.test(trimmed)) continue;

    const headingMatch = SECTION_HEADINGS.find(([pattern]) => pattern.test(trimmed));
    if (headingMatch) section = headingMatch[1];

    const grouped = splitGrouped(trimmed);
    if (grouped) {
      for (const [key, value] of grouped) {
        if (!found.has(key)) found.set(key, value);
      }
      continue;
    }

    const matched = matchAnalyte(trimmed, section);
    /*
      RECOGNISED BUT NO VALUE, WITH TEXT AFTER THE NAME: not dropped.

      This used to end in `continue` with nothing recorded, so a row like
      `Bilirubin Total 0.5` (matched `bilirubin`, value not readable after
      `Total`) disappeared: not in the output, not in "Lain-lain". That broke
      Rule 2 at the top of this file and made every future misread invisible.
      Such a line now falls through to the unrecognised path below and shows
      up under its full printed name. A test-name row with no number in it
      (`CHOLESTEROL HDL / HDL KOLESTEROL`) still yields nothing there.
    */
    const matchedValue = matched ? extractAfterQualifiers(matched.rest, matched.key) : null;
    const unreadable = matched !== null && !matchedValue && matched.rest.trim() !== '';
    if (matched && !unreadable) {
      let value = matchedValue;

      /**
       * The label matched and carried no value of its own — the one-cell-
       * per-line layout. Read forward.
       *
       * At most two lines ahead, because that is the shape of every row in
       * this printout: label, result, reference range. Reading further would
       * start pulling in the NEXT analyte's label when a row has no result at
       * all, which silently attaches this row's name to a different row's
       * number — worse than the original bug, because it is wrong rather than
       * missing.
       */
      if (!value && matched.rest.trim() === '') {
        for (let ahead = 1; ahead <= 2 && i + ahead < rawLines.length; ahead++) {
          const candidate = rawLines[i + ahead]!.trim();
          if (!candidate) continue;
          value = extractValue(candidate, matched.key);
          if (value) {
            i += ahead;
            /**
             * The line immediately after the value is very likely the
             * reference range — `Kuning Muda` after `Kuning`, `4.5 - 8.0`
             * after `6.0` — and consuming it here is what the comment on this
             * function used to claim happened without actually making it
             * happen.
             *
             * Without this, the outer loop resumes at the range line fresh,
             * with no analyte attached to it. It then falls to the catch-all
             * "unmatched line" branch below, and `QUALITATIVE` — which is
             * meant to read a RESULT, not a range — matches `Kuning Muda` on
             * its own and files the reference range into "Lain-lain" as if it
             * were an unrecognised finding. A reference range is not a
             * finding, recognised or not, and asserting on `unknown` in tests
             * is how this was caught: it should never contain a line that is
             * only a number's normal range.
             */
            const next = rawLines[i + 1]?.trim();
            if (next && looksLikeRange(next)) {
              // The line being skipped IS the reference range. Read it on the
              // way past rather than discarding it — this is the only place
              // the sheet states one, and inventing ranges later is exactly
              // what must not happen.
              if (!ranges.has(matched.key)) ranges.set(matched.key, parseRange(next));
              i += 1;
            }
            break;
          }
        }
      }

      // First occurrence wins: printouts repeat analyte names in section
      // headers and footers, and the first is the result row.
      if (value && !found.has(matched.key)) {
        found.set(matched.key, value);
        if (!ranges.has(matched.key)) {
          /**
           * Same-line layout: `eGFR 64 >= 90` or `ureum 31 10 - 50 mg/dl`.
           * Whatever follows the value on the line may hold the range.
           */
          const after = matched.rest.slice(matched.rest.indexOf(value) + value.length);
          const span = /(-?\d+(?:[.,]\d+)?\s*-\s*-?\d+(?:[.,]\d+)?)/.exec(after);
          ranges.set(matched.key, span ? parseRange(span[1]!) : null);
        }
      }
      continue;
    }

    // A line with a name and a number that matched nothing known.
    //
    // The label is whatever precedes the first number, which keeps this from
    // treating a whole sentence as an analyte. Page furniture is excluded by
    // name: a printout header carries a registration number, a date and a page
    // count, and every one of them is "a word followed by a number".
    /**
     * Label first, then the value region — never the whole line.
     *
     * `extractValue` expects the text AFTER the analyte name, which is what
     * the known-analyte path passes it. This call used to hand it the entire
     * line instead, so the two callers had different contracts for the same
     * argument. That is what allowed the numeric fallback to stay unanchored
     * for years: anchoring it would have broken this caller, so it scanned the
     * whole line for the known path too and found reference ranges.
     *
     * One contract now: the argument is always the value region.
     */
    if (unreadable) {
      // `-` in the result column: not done. Nothing to report, by design.
      if (/^[\s:=]*-(?=[\s)]|$)/.test(matched.rest)) continue;
      // A recognised row whose result is a WORD that could not be read after
      // the name (`HBsAg Rapid Non Reactive`): shown as printed rather than
      // lost. Test-name rows (`SGOT (AST)`) carry no result word and stay out.
      if (!/\d/.test(trimmed)) {
        if (QUALITATIVE_ANYWHERE.test(matched.rest)) unknown.push({ key: trimmed, value: '' });
        continue;
      }
    }

    /*
      Where the name ends: after a numbered name (`CA 19-9`, `HbA1c`), else at
      the first WHOLE number, never at the first digit character.
    */
    const named = numberedNameLength(trimmed);
    const numberAt = named > 0 ? named : wholeNumberAt(trimmed);
    if (numberAt < 0) {
      /*
        No number: a row whose result is a word (`Glukosa Negatif`) inside the
        result table. It used to be dropped, against this parser's own rule
        that nothing unrecognised disappears; it is shown as printed.
      */
      if (state === 'table' && QUALITATIVE_ANYWHERE.test(trimmed)) {
        const words = trimmed.split(/\s+/);
        if (words.length <= 5) unknown.push({ key: words.join(' '), value: '' });
      }
      continue;
    }
    const digitAt = numberAt;
    // Name, then a lone `-` in the result column: not done, and every number
    // after it is the reference (`Titer - <1 : 100`). Same rule as the
    // recognised path. `Lain - lain` is not this: a word follows its dash.
    if (/^[A-Za-z][A-Za-z ]*?\s+-(?=\s*(?:$|[^A-Za-z\s]))/.test(trimmed)) continue;
    const label = trimmed.slice(0, digitAt).replace(/[:\s]+$/, '').trim();
    const value = extractValue(trimmed.slice(label.length));

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

  /**
   * `*value*` when it is outside the printed range and the option is on.
   *
   * Only the VALUE is wrapped, never the label: `Hb *8.2*` survives a paste
   * into SIMGOS as plain text with the asterisks visible, which is ugly but
   * readable, whereas bolding the whole line would put an asterisk before an
   * analyte name and read as a bullet.
   */
  const emphasise = (key: string, value: string): string => {
    if (!options.boldAbnormal) return value;
    return isOutsideRange(value, ranges.get(key) ?? null) === true ? `*${value}*` : value;
  };

  for (const group of GROUPS) {
    const present = group.keys.filter((key) => found.has(key));
    if (present.length === 0) continue;

    for (const key of present) {
      const value = found.get(key) ?? '';
      const abnormal = isOutsideRange(value, ranges.get(key) ?? null);
      known.push({ key, value, ...(abnormal === undefined ? {} : { abnormal }) });
    }

    const label =
      present.length === group.keys.length ? group.label : present.join('/');
    lines.push(
      `${label} ${present.map((key) => emphasise(key, found.get(key) ?? '')).join('/')}`,
    );
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
      lines.push(`${label} ${emphasise(key, found.get(key) ?? '')}`);
      const value = found.get(key) ?? '';
      const abnormal = isOutsideRange(value, ranges.get(key) ?? null);
      known.push({ key, value, ...(abnormal === undefined ? {} : { abnormal }) });
    }
  }

  const bloodGroup = found.get('Golongan darah');
  if (bloodGroup) lines.push(`Golongan darah ${bloodGroup}`);

  if (unknown.length > 0) {
    lines.push('');
    lines.push('Lain-lain:');
    for (const item of unknown) lines.push(item.value ? `${item.key} ${item.value}` : item.key);
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
