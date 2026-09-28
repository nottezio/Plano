import { aliasesOrDefault } from './sections/aliases';
import { parseSections } from './sections/parseSections';
import type { SectionAlias, SectionId } from './types';

/**
 * Vital signs: ONE vocabulary for reading, checking and clearing them.
 *
 * The checker (`soapCheck`) and "Salin dari hari sebelumnya" (`carryForward`)
 * used to keep a list each, both the five labels of one seed template. So a
 * note written `TD 120/80, N 88` was "Tidak ada TTV" to the checker and was
 * never cleared by the carry-forward. The ward writes `Tensi`, `Nafas`, `TD`,
 * `N`, `RR`, `Saturasi`, and on one line with semicolons as often as on five.
 *
 * Every function here works segment by segment: a line split at `;` and at a
 * `,` that is not a decimal comma (`36,5`). A segment is a vital when it
 * STARTS with a vital's name (after any bullet or `*`/`_` emphasis).
 *
 * Single letters (`N 88`, `P 20`, `S 36.7`, `T 36.5`) count only inside the O
 * block and only with a space or colon before the number, so `S1 S2 tunggal`
 * and the `*S:*` heading can never be read as a temperature.
 */

export type VitalKey = 'Tekanan darah' | 'Nadi' | 'Pernapasan' | 'Suhu' | 'SpO2';

const KINDS: ReadonlyArray<{ key: VitalKey; long: string; short?: string; reading: string }> = [
  {
    key: 'Tekanan darah',
    long: 'tekanan\\s*darah|tensi|td|bp',
    reading: '(\\d{2,3}\\s*/\\s*\\d{2,3})',
  },
  { key: 'Nadi', long: 'frekuensi\\s*nadi|nadi|heart\\s*rate|hr', short: 'n', reading: '(\\d{2,3})' },
  {
    key: 'Pernapasan',
    long: 'frekuensi\\s*napas|pernapasan|pernafasan|respirasi|napas|nafas|rr',
    short: 'p',
    reading: '(\\d{1,2})',
  },
  { key: 'Suhu', long: 'suhu|temperatur|temp', short: 's|t', reading: '(\\d{2}(?:[.,]\\d+)?)' },
  {
    key: 'SpO2',
    long: 'spo2|sp02|spo₂|saturasi(?:\\s*o2)?|sat\\s*o2|sato2|so2',
    reading: '(\\d{2,3})',
  },
];

const LEAD = '(\\s*[-•>]*\\s*[*_]*)';

interface Pattern {
  key: VitalKey;
  /** lead · name · emphasis + separator · reading? · spaces before % */
  regex: RegExp;
  short: boolean;
}

const PATTERNS: Pattern[] = KINDS.flatMap((kind) => {
  const long: Pattern = {
    key: kind.key,
    short: false,
    regex: new RegExp(
      `^${LEAD}(${kind.long})([*_]*\\s*(?:[:=]\\s*)?)(?:${kind.reading}(\\s*(?=%))?)?`,
      'i',
    ),
  };
  if (!kind.short) return [long];
  return [
    long,
    {
      key: kind.key,
      short: true,
      // The separator is REQUIRED for a single letter: `S1` is not a suhu.
      regex: new RegExp(
        `^${LEAD}(${kind.short})([*_]*(?:\\s*[:=]\\s*|\\s+))(?:${kind.reading}(\\s*(?=%))?)?`,
        'i',
      ),
    },
  ];
});

interface SegmentVital {
  key: VitalKey;
  /** The reading, normalised (`36,5` -> `36.5`, spaces out of `120 / 80`), or null when blank. */
  reading: string | null;
  /** True when the label is followed by a colon (a template field). */
  colon: boolean;
  /** The segment with its reading removed. */
  cleared: string;
}

function readSegment(segment: string, allowShort: boolean): SegmentVital | null {
  for (const pattern of PATTERNS) {
    if (pattern.short && !allowShort) continue;
    const match = pattern.regex.exec(segment);
    if (!match) continue;
    const name = match[2] ?? '';
    const end = (match[1]?.length ?? 0) + name.length;
    // A whole word: `tdk` is not `td`, `suhunya` is not `suhu`.
    if (/[a-z0-9]/i.test(segment.charAt(end))) continue;
    const reading = match[4] ?? null;
    // A reading that is only the start of a longer number is not a reading:
    // `P 2 tablet` passes, `Nadi 1234` does not.
    if (reading && /\d/.test(segment.charAt(match[0].length - (match[5]?.length ?? 0)))) continue;
    return {
      key: pattern.key,
      reading: reading ? reading.replace(/\s+/g, '').replace(',', '.') : null,
      colon: /[:=]/.test(match[3] ?? ''),
      cleared: reading
        ? `${match[1] ?? ''}${name}${match[3] ?? ''}${segment.slice(match[0].length)}`
        : segment,
    };
  }
  return null;
}

function splitSegments(line: string): string[] {
  // A comma followed by a digit is a DECIMAL (`36,5`), not a separator.
  return line.split(/(;|,(?!\d))/);
}

/** Sections that end the O block: the vitals never live past these. */
const AFTER_OBJECTIVE = new Set<SectionId>(['penunjang', 'a', 'p', 'terapi', 's']);

/**
 * A heading that names an INVESTIGATION: its numbers are the investigation's.
 *
 * `*EKG PJT Lantai 4 (24-09-2026)*` parses as a custom section, and custom
 * sections could not end the O block, because blank template fields
 * (`Nadi :  kali/menit`) parse as custom sections too and must stay inside it.
 * So an EKG written right after the vitals was read as part of O, and its
 * `Sinus rhythm, HR 80 bpm` lost the 80 on "Salin dari hari sebelumnya".
 *
 * Whole words only. Bare `thorax` is NOT here: `Thorax:` is also the
 * physical-exam heading, which belongs to O; the X-ray is `Foto thorax`.
 */
const INVESTIGATION =
  /(?:^|[^a-z0-9])(ekg|ecg|elektrokardiogra\w*|echo\w*|eko\w*|ekokardiogra\w*|lab\w*|foto|rontgen|x-?ray|cxr|ct|msct|ctca|mri|usg|lus|lung\s+ultrasound|angiograf\w*|laporan|holter|treadmill|tmt|hemodinamik\w*|kateterisasi|penunjang|hasil)(?![a-z0-9])/i;

function isInvestigation(section: { sectionId: SectionId; label: string }): boolean {
  if (section.sectionId === 'penunjang') return true;
  return String(section.sectionId).startsWith('custom_') && INVESTIGATION.test(section.label);
}

/**
 * Walk every line, telling the callback whether it may hold vitals and
 * whether it sits in the O block.
 *
 * The O block runs from the O (or TTV) heading to the first section that is
 * S/A/P/Terapi/Penunjang OR an investigation heading. Without an O heading
 * the whole note is walked, full names only, except investigation sections.
 */
function walk(
  body: string,
  aliases: readonly SectionAlias[] | undefined,
  visit: (line: string, inObjective: boolean) => string,
): string {
  const sections = parseSections(body, aliasesOrDefault(aliases));
  const hasObjective = sections.some(
    (section) => section.sectionId === 'o' || section.sectionId === 'ttv',
  );

  /** Per section: 'o' (vitals, short names too), 'free' (full names only), or null (never). */
  const context: Array<'o' | 'free' | null> = [];
  let open = false;
  for (const section of sections) {
    if (section.sectionId === 'o' || section.sectionId === 'ttv') open = true;
    else if (AFTER_OBJECTIVE.has(section.sectionId) || isInvestigation(section)) open = false;
    if (isInvestigation(section)) context.push(null);
    else if (open) context.push('o');
    else context.push(hasObjective ? null : 'free');
  }

  let offset = 0;
  let index = 0;
  return body
    .split('\n')
    .map((line) => {
      const start = offset;
      offset += line.length + 1;
      while (index + 1 < sections.length && (sections[index + 1]?.start ?? Infinity) <= start) index++;
      const where = context[index] ?? null;
      if (where === null) return line;
      // The O heading line itself is never a vital.
      const onHeading = sections[index]?.start === start && where === 'o' &&
        (sections[index]?.sectionId === 'o' || sections[index]?.sectionId === 'ttv');
      if (onHeading) return line;
      return visit(line, where === 'o');
    })
    .join('\n');
}

export interface VitalsReading {
  /** First reading of each vital, normalised. */
  readings: Partial<Record<VitalKey, string>>;
  /** Vitals written as a template field (`Nadi :  kali/menit`) with no number anywhere. */
  blank: VitalKey[];
  /** Whether any vital was named at all, filled or not. */
  named: boolean;
}

export function readVitalSigns(body: string, aliases?: readonly SectionAlias[]): VitalsReading {
  const readings: Partial<Record<VitalKey, string>> = {};
  const labelled = new Set<VitalKey>();
  let named = false;
  walk(body, aliases, (line, inObjective) => {
    for (const [index, part] of splitSegments(line).entries()) {
      if (index % 2 === 1) continue;
      const vital = readSegment(part, inObjective);
      if (!vital) continue;
      // A bare word without colon or reading (`Pernapasan vesikuler`) is prose.
      if (!vital.reading && !vital.colon) continue;
      named = true;
      if (vital.reading && readings[vital.key] === undefined) readings[vital.key] = vital.reading;
      if (!vital.reading) labelled.add(vital.key);
    }
    return line;
  });
  const blank = [...labelled].filter((key) => readings[key] === undefined);
  return { readings, blank, named };
}

/**
 * Empty the READINGS, keep everything else as written.
 *
 * Carry-forward used to replace each vital LINE with the seed template's
 * blank line, matched on the exact text before the line's FIRST colon, so it
 * worked only on lines already shaped like that template, and never on the
 * one-line form (`GCS E4V5M6; Tekanan Darah : …; Nadi : …`), whose first
 * colon's label is `gcs e4v5m6; tekanan darah`. Removing the number instead
 * keeps the label, units and qualifiers (`kali/menit, reguler`, `% on room
 * air`) exactly as the user wrote them. Height and weight are not vitals.
 */
export function clearVitalValues(
  body: string,
  aliases?: readonly SectionAlias[],
): { body: string; changed: boolean } {
  let changed = false;
  const next = walk(body, aliases, (line, inObjective) => {
    const cleared = splitSegments(line)
      .map((part, index) => {
        if (index % 2 === 1) return part;
        const vital = readSegment(part, inObjective);
        return vital?.reading ? vital.cleared : part;
      })
      .join('');
    if (cleared !== line) changed = true;
    return cleared;
  });
  return { body: next, changed };
}
