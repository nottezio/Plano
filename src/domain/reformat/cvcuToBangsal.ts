/**
 * CVCU layout → bangsal layout.
 *
 * A CVCU note organises O by organ system — Airway, Breathing, Circulation,
 * Disability, Exposure, Fluid, Glucose & Gut, Haematology, Infection — with the
 * investigations scattered inside whichever system they belong to. A bangsal
 * note puts vital signs in a flat list, then the examination, then every dated
 * investigation stacked below.
 *
 * Same facts, different order. Retyping that on transfer is half an hour and an
 * invitation to drop a line.
 *
 * ONE RULE ABOVE ALL: nothing is discarded. Any line that is not recognised is
 * carried through rather than dropped, because a reformatter that silently
 * loses a finding is worse than none — the note still looks complete, and
 * nobody goes back to check.
 *
 * The output is a DRAFT, shown in a preview before it replaces anything. "Same
 * facts, different order" is a judgement this code makes, and it can be wrong.
 */

/** Organ-system headers a CVCU note uses, with or without emphasis. */
const SYSTEM_HEADERS = [
  'airway',
  'breathing',
  'circulation',
  'disability',
  'exposure',
  'fluid',
  'glucose',
  'gut',
  'hypo',
  'hyperthermia',
  'haematology',
  'hematology',
  'infection',
];

/** Vital signs, wherever in the note they were written. */
const VITAL_PATTERNS: RegExp[] = [
  /\bGCS\b/i,
  /\b(tekanan darah|TD)\b\s*:?\s*\d/i,
  /\b(nadi|HR)\b\s*:?\s*\d/i,
  /\b(pernapasan|RR|respirasi)\b\s*:?\s*\d/i,
  /\bsuhu\b\s*:?\s*\d/i,
  /\b(spo2|saturasi)\b/i,
];

/** Investigations, recognised by their opening word in both layouts. */
const INVESTIGATION_START =
  /^\s*\*?\s*(EKG|Lab|Laboratorium|Foto|Rontgen|Thorax|Echo|Echocardiography|USG|CT|MRI|LUS|Lung ultrasound|Laporan|Angiograf|PTCA|Urin)/i;

const EXAM_HINTS =
  /\b(JVP|bunyi (jantung|napas|pernapasan)|BJ I|vesikuler|rhonki|ronkhi|wheezing|akral|edema|anemis|ikterus|abdomen|peristaltik|konjungtiva|sklera|CRT|patent)\b/i;

/**
 * Strips a leading organ-system header, returning what was on the line after it.
 *
 * These are written both ways — `*Circulation* :` on its own line, and
 * `*Airway* : Patent, SpO2 96% on Room Air` with the finding on the same line.
 * Treating the whole line as a header dropped the finding with it, which is
 * exactly the silent loss this file is built to avoid. My own test caught it.
 *
 * Returns `null` when the line is not a system header at all.
 */
function stripSystemHeader(line: string): string | null {
  // Split at the first colon rather than pattern-matching the name. A lazy
  // group matched one letter and reported `Airway` as `a`, so the header was
  // never recognised and the finding after it kept the header attached.
  const colon = line.indexOf(':');
  if (colon === -1) {
    const bare = line.replace(/[*_]/g, '').trim().toLowerCase();
    if (bare.length > 0 && bare.length <= 40 && SYSTEM_HEADERS.some((h) => bare.startsWith(h))) {
      return '';
    }
    return null;
  }

  const name = line.slice(0, colon).replace(/[*_]/g, '').trim().toLowerCase();
  if (name.length === 0 || name.length > 40) return null;
  if (!SYSTEM_HEADERS.some((header) => name.startsWith(header))) return null;

  return line.slice(colon + 1).trim();
}

export interface ReformatResult {
  body: string;
  /** What moved where, so the user can check rather than trust. */
  summary: {
    vitals: number;
    exam: number;
    investigations: number;
    unrecognised: number;
  };
}

const EMPTY_SUMMARY = { vitals: 0, exam: 0, investigations: 0, unrecognised: 0 };

/**
 * Only the O section is rearranged.
 *
 * Everything before it — greeting, identity, DPJP lines, S — and everything
 * from A onward is untouched, which keeps the blast radius of a wrong guess
 * inside one section.
 */
function locateObjective(lines: readonly string[]): { start: number; end: number } | null {
  const start = lines.findIndex((line) => /^\s*\*?\s*O\s*[:/]/i.test(line));
  if (start === -1) return null;

  const end = lines.findIndex(
    (line, index) =>
      index > start &&
      (/^\s*\*?\s*(A|P)\s*[:/]/i.test(line) ||
        /mohon i[zj]in kami (assess|terapi)/i.test(line) ||
        /^\s*\*?\s*(Plan|Diagnosis)\b/i.test(line)),
  );

  return { start, end: end === -1 ? lines.length : end };
}

export function cvcuToBangsal(body: string): ReformatResult {
  const lines = body.split('\n');
  const bounds = locateObjective(lines);

  // No O section to rearrange: return the note untouched rather than guess at
  // its structure.
  if (!bounds) return { body, summary: { ...EMPTY_SUMMARY } };

  const head = lines.slice(0, bounds.start);
  const middle = lines.slice(bounds.start, bounds.end);
  const tail = lines.slice(bounds.end);

  const vitals: string[] = [];
  const exam: string[] = [];
  const investigations: string[] = [];
  const other: string[] = [];

  // The O header keeps whatever followed it on the same line — usually
  // `Compos mentis`.
  const objectiveHeader = middle[0] ?? '*O:*';
  let insideInvestigation = false;

  for (const line of middle.slice(1)) {
    if (INVESTIGATION_START.test(line)) {
      insideInvestigation = true;
      investigations.push(line);
      continue;
    }

    // The header itself is layout, not a finding — but anything written after
    // it on the same line IS a finding, and gets sorted like any other.
    const afterHeader = stripSystemHeader(line);
    const content = afterHeader === null ? line : afterHeader;

    if (afterHeader !== null) {
      insideInvestigation = false;
      if (content.length === 0) continue;
    }

    if (VITAL_PATTERNS.some((pattern) => pattern.test(content))) {
      insideInvestigation = false;
      // A line can hold vitals AND exam findings — `TD 103/73, Nadi 94, JVP
      // R+3, BJ I/II murni` is one line in a CVCU note. Splitting it would
      // reword the note; it goes with the vitals, where it reads correctly.
      vitals.push(content.trim());
      continue;
    }

    if (EXAM_HINTS.test(content)) {
      insideInvestigation = false;
      exam.push(content.trim());
      continue;
    }

    if (afterHeader !== null) {
      other.push(content);
      continue;
    }

    // A blank line ends an investigation block; anything else inside one
    // belongs to it, which is how multi-line echo and angiography reports stay
    // attached to their heading.
    if (insideInvestigation) {
      if (line.trim().length === 0) insideInvestigation = false;
      investigations.push(line);
      continue;
    }

    other.push(line);
  }

  const keptOther = trimBlanks(other).filter((line) => line.trim().length > 0);

  const rebuilt = [
    objectiveHeader,
    ...vitals,
    ...(exam.length > 0 ? ['', ...exam] : []),
    // Unrecognised lines are kept and placed where they can be seen. Losing one
    // silently is the failure this function must not have.
    ...(keptOther.length > 0 ? ['', ...keptOther] : []),
    ...(investigations.length > 0 ? ['', ...trimBlanks(investigations)] : []),
  ];

  return {
    body: [...head, ...rebuilt, '', ...trimLeadingBlanks(tail)].join('\n'),
    summary: {
      vitals: vitals.length,
      exam: exam.length,
      investigations: investigations.filter((line) => INVESTIGATION_START.test(line)).length,
      unrecognised: keptOther.length,
    },
  };
}

function trimBlanks(lines: readonly string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start]?.trim() === '') start += 1;
  while (end > start && lines[end - 1]?.trim() === '') end -= 1;
  return lines.slice(start, end);
}

function trimLeadingBlanks(lines: readonly string[]): string[] {
  let start = 0;
  while (start < lines.length && lines[start]?.trim() === '') start += 1;
  return lines.slice(start);
}
