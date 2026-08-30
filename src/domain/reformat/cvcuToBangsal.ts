/**
 * CVCU layout → bangsal layout.
 *
 * Rewritten against a real before/after pair rather than from the shape of the
 * two formats. Three versions now: the first reordered by guesswork and broke
 * notes; the second only unwrapped headers, which was safe and did too little.
 * This one does what the worked example does, and no more.
 *
 * The transform, in order:
 *
 *  1. Vitals are LIFTED OUT of the organ-system lines. In a CVCU note they are
 *     buried mid-sentence — `Circulation: TD 121/84 mmHg, nadi 80 x/menit
 *     reguler, BJ I/II murni reguler, ...` — so the line is split on commas and
 *     each fragment classified. That is the part the header-unwrapping version
 *     could not do, and the reason its output still read as a CVCU note.
 *  2. Vitals print in the ward's canonical order and labels.
 *  3. Examination findings follow, in the order they were written.
 *  4. Investigations move below, each wrapped in `*…*` if it was not already.
 *
 * Nothing is discarded. Fragments that match nothing are kept under a heading
 * that says so, because a reformatter that silently drops a finding is worse
 * than none — the note still looks complete and nobody goes back to check.
 */

const SYSTEM_HEADERS = [
  'airway', 'breathing', 'circulation', 'disability', 'exposure', 'fluid',
  'glucose', 'gut', 'glucose & gut', 'hypo', 'hyperthermia', 'haematology',
  'hematology', 'infection', 'pemeriksaan fisik lainnya',
];

/** Each vital, its canonical label, and how it is recognised. */
const VITALS: ReadonlyArray<{ key: string; label: string; test: RegExp }> = [
  { key: 'gcs', label: '', test: /\b(compos mentis|GCS)\b/i },
  { key: 'td', label: 'Tekanan Darah', test: /\b(TD|tensi|tekanan darah)\b/i },
  { key: 'nadi', label: 'Nadi', test: /\b(nadi|HR)\b/i },
  { key: 'rr', label: 'Pernapasan', test: /\b(RR|pernapasan|nafas|napas)\b/i },
  { key: 'suhu', label: 'Suhu', test: /\bsuhu\b/i },
  // No trailing `\b` after `SpO₂`: the subscript is not a word character, so a
  // boundary never matches after it and the vital was silently skipped.
  { key: 'spo2', label: 'SpO2', test: /\b(SpO2|SpO₂|saturasi)/i },
];

const EXAM = /\b(anemis|ikterus|ikterik|JVP|BJ I|bunyi jantung|murmur|gallop|BP |vesikuler|bunyi pernapasan|ronkhi|rhonki|wheezing|abdomen|peristaltik|hepar|lien|edema|akral|CTR|CRT)\b/i;

const INVESTIGATION =
  /^\s*\*?\s*(EKG|Lab|Laboratorium|Foto|Rontgen|Thorax|Echo|Echocardiography|USG|CT|MRI|LUS|Lung ultrasound|Laporan|Angiograf|PTCA|Holter|Urinalis|Analisa Gas|AGD)\b/i;

/** A bare `EKG` or `Laboratorium` line that only labels the block below it. */
const BARE_LABEL = /^\s*(EKG|Lab|Laboratorium|Foto Thorax|Echo)\s*:?\s*$/i;

import { orderInvestigations } from './orderInvestigations';

export interface ReformatResult {
  body: string;
  summary: { vitals: number; exam: number; investigations: number; unmatched: number };
}

function splitHeader(line: string): { rest: string } | null {
  const colon = line.indexOf(':');
  if (colon === -1) {
    const bare = line.replace(/[*_]/g, '').trim().toLowerCase();
    return bare && bare.length <= 45 && SYSTEM_HEADERS.some((h) => bare === h || bare.startsWith(`${h} `))
      ? { rest: '' }
      : null;
  }
  const name = line.slice(0, colon).replace(/[*_]/g, '').trim().toLowerCase();
  if (!name || name.length > 45) return null;
  if (!SYSTEM_HEADERS.some((h) => name === h || name.startsWith(h))) return null;
  return { rest: line.slice(colon + 1).trim() };
}

function objectiveBounds(lines: readonly string[]): { start: number; end: number } | null {
  const start = lines.findIndex((line) => /^\s*\*?\s*O\s*[:/]/i.test(line));
  if (start === -1) return null;
  const end = lines.findIndex(
    (line, index) =>
      index > start &&
      (/^\s*\*?\s*(A|P)\s*[:/]/i.test(line) ||
        /mohon i[zj]in (kami|pasien)/i.test(line) ||
        /^\s*\*?\s*(Plan|Diagnosis)\b/i.test(line)),
  );
  return { start, end: end === -1 ? lines.length : end };
}

export function cvcuToBangsal(body: string): ReformatResult {
  const lines = body.split('\n');
  const bounds = objectiveBounds(lines);
  if (!bounds) return { body, summary: { vitals: 0, exam: 0, investigations: 0, unmatched: 0 } };

  const head = lines.slice(0, bounds.start);
  const middle = lines.slice(bounds.start + 1, bounds.end);
  const tail = lines.slice(bounds.end);

  const vitals = new Map<string, string>();
  const exam: string[] = [];
  const investigations: string[] = [];
  const unmatched: string[] = [];

  let inInvestigation = false;

  for (const raw of middle) {
    const line = raw.trim();

    if (INVESTIGATION.test(line)) {
      inInvestigation = true;
      // A bare `EKG` label adds nothing once each block carries its own
      // heading, and would otherwise sit alone above the first one.
      if (!BARE_LABEL.test(line)) investigations.push(wrapHeading(line));
      continue;
    }

    if (line.length === 0) {
      if (inInvestigation) investigations.push('');
      continue;
    }

    const header = splitHeader(line);
    const content = header ? header.rest : line;
    if (header) inInvestigation = false;
    if (!content) continue;

    if (inInvestigation && !header) {
      investigations.push(raw);
      continue;
    }

    // Split on commas and semicolons: a CVCU line packs several findings into
    // one sentence, and they belong in different places in a bangsal note.
    for (const piece of content.split(/[,;]/).map((part) => part.trim()).filter(Boolean)) {
      const vital = VITALS.find((candidate) => candidate.test.test(piece));
      if (vital && !vitals.has(vital.key)) {
        vitals.set(vital.key, piece);
        continue;
      }
      if (EXAM.test(piece)) {
        exam.push(piece);
        continue;
      }
      if (!vital) unmatched.push(piece);
    }
  }

  const vitalLines: string[] = [];
  for (const { key, label } of VITALS) {
    const value = vitals.get(key);
    if (!value) continue;
    vitalLines.push(label ? formatVital(label, value) : capitalise(value));
  }

  const rebuilt = [
    lines[bounds.start] ?? '*O:*',
    ...vitalLines,
    ...(exam.length > 0 ? ['', ...joinExam(exam)] : []),
    ...(unmatched.length > 0 ? ['', 'Lain-lain:', ...unmatched.map((line) => `- ${line}`)] : []),
    /**
     * Investigations in the ward's canonical order — EKG, laboratory, chest
     * film, cross-sectional imaging, echo, lung ultrasound — rather than in
     * the order a CVCU note happens to scatter them across its A–H sections.
     *
     * This is block-level, and that is what makes it safe. The reordering that
     * broke notes and was reverted (HANDOFF §5) moved individual LINES, which
     * meant judging each line's meaning from its wording. `orderInvestigations`
     * reads headings only, moves each block whole, and never inspects content.
     */
    ...(investigations.length > 0
      ? ['', ...orderInvestigations(trimBlanks(investigations))]
      : []),
  ];

  return {
    body: [...head, ...rebuilt, '', ...trimLeadingBlanks(tail)].join('\n'),
    summary: {
      vitals: vitalLines.length,
      exam: exam.length,
      investigations: investigations.filter((line) => line.startsWith('*')).length,
      unmatched: unmatched.length,
    },
  };
}

/**
 * `TD 121/84 mmHg` → `Tekanan Darah : 121/84 mmHg`.
 *
 * The value is taken from the fragment rather than reformatted, so a unit or a
 * qualifier written alongside it survives — `80 x/menit reguler` keeps its
 * `reguler`.
 */
function formatVital(label: string, piece: string): string {
  const value = piece.replace(
    /^\s*(TD|tensi|tekanan darah|nadi|HR|RR|pernapasan|nafas|napas|suhu|SpO2|SpO₂|saturasi)\s*:?\s*/i,
    '',
  );
  return `${label} : ${value.trim()}`;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Investigation headings are emphasised in a bangsal note; CVCU ones often are not. */
function wrapHeading(line: string): string {
  const bare = line.replace(/^\*+|\*+$/g, '').trim();
  return `*${bare}*`;
}

/**
 * Examination fragments regrouped into the ward's five lines.
 *
 * One fragment per line produced a correct but unreadable note — a CVCU
 * sentence carries eight findings, and eight one-line entries is not how anyone
 * reads an examination. A bangsal note groups them by system, always in the
 * same order, which is why it can be scanned.
 *
 * Anything matching no group keeps its own line rather than being forced into
 * one, since a wrong grouping reads as a wrong finding.
 */
const EXAM_GROUPS: ReadonlyArray<{ test: RegExp; fallback: string }> = [
  { test: /\b(anemis|ikterus|ikterik|konjungtiva|sklera)\b/i, fallback: '' },
  { test: /\bJVP\b/i, fallback: '' },
  { test: /\b(BJ I|bunyi jantung|murmur|gallop|thrill)\b/i, fallback: '' },
  { test: /\b(BP |bunyi pernapasan|vesikuler|ronkhi|rhonki|wheezing)\b/i, fallback: '' },
  { test: /\b(abdomen|peristaltik|hepar|lien)\b/i, fallback: '' },
  { test: /\b(edema|akral|CTR|CRT)\b/i, fallback: '' },
];

function joinExam(exam: readonly string[]): string[] {
  const buckets: string[][] = EXAM_GROUPS.map(() => []);
  const loose: string[] = [];

  for (const fragment of exam) {
    const index = EXAM_GROUPS.findIndex((group) => group.test.test(fragment));
    if (index === -1) loose.push(fragment);
    else buckets[index]?.push(fragment);
  }

  return [
    ...buckets.filter((bucket) => bucket.length > 0).map((bucket) => capitalise(bucket.join(', '))),
    ...loose.map((line) => capitalise(line)),
  ];
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
