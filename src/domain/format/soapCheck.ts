import { findDayMarkers } from '@/domain/dayMarkers';

/**
 * Checks a note against yesterday's for the things that get forgotten.
 *
 * WHY THIS IS DETERMINISTIC AND NOT A MODEL
 *
 * Every finding here is a comparison of two numbers that are both written in
 * the note. A model could do it, and would also occasionally invent a
 * discrepancy or miss an obvious one — and the whole value of a checker is
 * that you stop reading it the first time it is wrong twice. These rules are
 * boring on purpose: they fire on an exact mismatch and are silent otherwise.
 *
 * WHY IT NEVER EDITS
 *
 * Every finding names a place and says what looks stale. It does not fix
 * anything, because each of these has a legitimate reason to be exactly as it
 * is — vitals genuinely identical two days running, a diagnosis deliberately
 * quoting the admission value, a lab ordered again the same day. A checker
 * that corrected would be wrong about a patient roughly once a week; one that
 * asks is never wrong, only sometimes ignorable.
 */

export type SoapFindingKind =
  | 'vitals-unchanged'
  | 'vitals-missing'
  | 'day-marker'
  | 'lab-planned-but-resulted'
  | 'diagnosis-value-stale'
  | 'consult-not-in-dpjp'
  | 'electrolyte-corrected'
  | 'anemia-without-hb';

export interface SoapFinding {
  kind: SoapFindingKind;
  /** One line, in the user's language, naming the thing to look at. */
  message: string;
  /** The text to search for in the body, so the UI can jump to it. */
  anchor?: string;
}

const VITALS: ReadonlyArray<readonly [string, RegExp]> = [
  ['Tekanan darah', /tekanan\s*darah\s*:?\s*([0-9]{2,3}\/[0-9]{2,3})/i],
  ['Nadi', /nadi\s*:?\s*(\d{2,3})/i],
  ['Pernapasan', /pernapasan\s*:?\s*(\d{1,2})/i],
  ['Suhu', /suhu\s*:?\s*(\d{2}[.,]\d)/i],
  ['SpO2', /spo2\s*:?\s*(\d{2,3})/i],
];

export function readVitals(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [label, pattern] of VITALS) {
    const match = pattern.exec(body);
    if (match?.[1]) out[label] = match[1].replace(',', '.');
  }
  return out;
}

/**
 * Electrolytes and counts, from the shapes this corpus actually writes.
 *
 * `Na/K/Cl 136/3.6/103` is the common one and has to be read as three values
 * in one line; `HGB 11.9` and `Hb: 14.4` are the other. Anything else is left
 * alone — a parser that guesses at unfamiliar lab formats produces findings
 * nobody can act on, which is worse than no finding.
 */
export function readLabs(body: string): Record<string, number> {
  const out: Record<string, number> = {};

  const triple = /\bNa\s*\/\s*K\s*\/\s*Cl\s*:?\s*(\d{2,3})\s*\/\s*([\d.]+)\s*\/\s*(\d{2,3})/i.exec(body);
  if (triple) {
    out['Na'] = Number(triple[1]);
    out['K'] = Number(triple[2]);
    out['Cl'] = Number(triple[3]);
  }

  for (const [key, pattern] of [
    ['K', /\bK(?:alium)?\s*:\s*([\d.]+)/i],
    ['Na', /\bNa(?:trium)?\s*:\s*(\d{2,3})/i],
    ['Hb', /\b(?:Hb|HGB)\s*:?\s*([\d.]+)/i],
  ] as const) {
    // The triple wins where both exist: it is the line the lab printed, and a
    // stray `K :` elsewhere in a sentence is not a result.
    if (out[key] !== undefined) continue;
    const match = pattern.exec(body);
    if (match?.[1]) out[key] = Number(match[1]);
  }

  return out;
}

/**
 * Analytes named in a diagnosis, matched to THEIR OWN bracket.
 *
 * `[^\n(]*` before the bracket is what makes this safe: it allows words
 * between the diagnosis and its value but stops at the first `(`, so the
 * capture is the analyte's own group and never a later one.
 */
const DIAGNOSIS_VALUES: ReadonlyArray<readonly [string, RegExp]> = [
  ['K', /hypo?kalemia[^\n(]*\(([^)]*)\)/i],
  ['K', /hyper?kalemia[^\n(]*\(([^)]*)\)/i],
  ['Na', /hypo?natremia[^\n(]*\(([^)]*)\)/i],
  ['Na', /hyper?natremia[^\n(]*\(([^)]*)\)/i],
];

/**
 * The current value in a diagnosis like `Hypokalemia (2.9 --> 3.7)`.
 *
 * The arrow form is how this corpus records a correction in progress, so the
 * number that matters is the one on the RIGHT — comparing the admission value
 * against today's lab would flag every improving patient every day.
 *
 * SCOPED TO THE ANALYTE'S OWN BRACKET, and that is the fix for the false
 * positive reported on 12 September. This used to take the last number on the
 * whole LINE, which works right up until the line carries a second value:
 *
 *   - Moderate Hyponatremia (131 -> 129 -> 136) Hipoosmolal (265)
 *
 * The last number there is the osmolality. The checker reported "diagnosis
 * menyebut Na 265, lab terbaru 136" — confidently, about a note that was
 * entirely correct. A checker is worth having only while it is right, and this
 * was wrong in the most damaging way: plausibly.
 */
function quotedValue(text: string, pattern: RegExp): number | null {
  const match = pattern.exec(text);
  const group = match?.[1];
  if (!group) return null;
  const numbers = [...group.matchAll(/(\d+[.,]?\d*)/g)]
    .map((found) => Number((found[1] ?? '').replace(',', '.')))
    .filter((value) => Number.isFinite(value));
  return numbers.at(-1) ?? null;
}

/**
 * Reference ranges, SUPPLIED BY THE USER, never shipped.
 *
 * Plano does not hardcode reference ranges — that rule exists because a range
 * is a property of the laboratory that printed the result, and a number baked
 * into an app is one nobody can correct when the lab changes its assay. So
 * this arrives from Settings, is empty by default, and every check that
 * depends on it is simply silent until it is filled in.
 *
 * Keyed by the same analyte names `readLabs` returns.
 */
export type ReferenceRanges = Partial<Record<string, { low: number; high: number }>>;

export interface SoapCheckInput {
  body: string;
  /** From Settings. Empty means the range-dependent checks do not run. */
  ranges?: ReferenceRanges;
  /** Yesterday's note, where there is one. */
  previous?: string | undefined;
  /** True when the day counters have already been reviewed and dismissed. */
  dayMarkersDismissed?: boolean;
}

export function checkSoap(input: SoapCheckInput): SoapFinding[] {
  const { body, previous } = input;
  const findings: SoapFinding[] = [];
  if (!body.trim()) return findings;

  const vitals = readVitals(body);

  if (Object.keys(vitals).length === 0) {
    findings.push({
      kind: 'vitals-missing',
      message: 'Tidak ada TTV di catatan ini.',
    });
  } else if (previous) {
    const before = readVitals(previous);
    const shared = Object.keys(vitals).filter((key) => before[key] !== undefined);
    // All of them, not some: one vital genuinely repeating is ordinary, the
    // whole block repeating is a copy that was never edited.
    if (shared.length >= 3 && shared.every((key) => before[key] === vitals[key])) {
      findings.push({
        kind: 'vitals-unchanged',
        message: `TTV sama persis dengan catatan sebelumnya (${shared.join(', ')}).`,
        anchor: 'Tekanan Darah',
      });
    }
  }

  if (!input.dayMarkersDismissed && previous) {
    const markers = findDayMarkers(body);
    const before = findDayMarkers(previous);
    const unchanged = markers.filter((marker) =>
      before.some((other) => other.text.toLowerCase() === marker.text.toLowerCase()),
    );
    if (unchanged.length > 0) {
      findings.push({
        kind: 'day-marker',
        message: `Hitungan hari belum berubah dari kemarin: ${unchanged.map((m) => m.text).join(', ')}.`,
        ...(unchanged[0] ? { anchor: unchanged[0].text } : {}),
      });
    }
  }

  // A lab both planned and resulted in the same note. The plan line is the one
  // to remove; the result is why.
  const labs = readLabs(body);
  const plansLab = /(?:^|\n)\s*-?\s*(?:cek|periksa|rencana)\s+(?:lab|darah\s*rutin|elektrolit|dl\b)/i.test(
    body,
  );
  if (plansLab && Object.keys(labs).length > 0) {
    findings.push({
      kind: 'lab-planned-but-resulted',
      message: 'Lab sudah ada hasilnya tapi masih tertulis di Plan.',
      anchor: 'Plan',
    });
  }

  for (const [analyte, pattern] of DIAGNOSIS_VALUES) {
    const quoted = quotedValue(body, pattern);
    const measured = labs[analyte];
    if (quoted === null || measured === undefined) continue;
    // A tolerance, not equality: `3.60` and `3.6` are the same result, and
    // flagging that would make the checker noise.
    if (Math.abs(quoted - measured) > 0.05) {
      findings.push({
        kind: 'diagnosis-value-stale',
        message: `Diagnosis menyebut ${analyte} ${quoted}, lab terbaru ${measured}.`,
        anchor: analyte,
      });
    }
  }

  /*
    A consulting service has answered, but the DPJP list still does not name
    them.

    49 entries in the 2026-09-11 export are in exactly this state. It matters
    because the DPJP header is what the report is addressed FROM — a service
    that is co-managing the patient and is missing from it does not get the
    note, and nobody notices until they ask why they were not told.

    Matched on the first few letters of the service, because the two lines
    rarely spell it the same: `TS Pulmo` in the block, `DPJP Pulmonologi` in
    the header.
  */
  const dpjpLines = body
    .split('\n')
    .filter((line) => /DPJP/i.test(line))
    .join(' ')
    .toLowerCase();

  const services = new Set(
    [...body.matchAll(/^[*_\s]*TS\s+([A-Za-z][\w ]{2,25}?)[*_:\s]*$/gim)]
      .map((match) => (match[1] ?? '').trim())
      .filter(Boolean),
  );

  for (const service of services) {
    const stem = service.replace(/[^a-z]/gi, '').slice(0, 5).toLowerCase();
    if (stem.length < 3) continue;
    if (dpjpLines.includes(stem)) continue;
    findings.push({
      kind: 'consult-not-in-dpjp',
      message: `TS ${service} sudah menjawab tapi belum ada di daftar DPJP.`,
      anchor: 'DPJP',
    });
  }

  /*
    An electrolyte that has come back into range while its diagnosis still
    reads as the deficit.

    Runs ONLY where the user has supplied a range for that analyte. Without one
    there is no honest way to say a number is normal, and guessing would be
    hardcoding a reference range by another route.

    Silent once the line already says `perbaikan` — the reminder is for a line
    nobody has revisited, not a nag about one that has been.
  */
  for (const [analyte, pattern] of DIAGNOSIS_VALUES) {
    const range = input.ranges?.[analyte];
    const measured = labs[analyte];
    if (!range || measured === undefined) continue;
    if (measured < range.low || measured > range.high) continue;

    const line = body.split('\n').find((candidate) => pattern.test(candidate));
    if (!line || /perbaikan/i.test(line)) continue;

    findings.push({
      kind: 'electrolyte-corrected',
      message: `${analyte} sudah ${measured} (dalam rentang) — tambahkan "perbaikan" di diagnosisnya?`,
      anchor: line.trim().slice(0, 40),
    });
  }

  if (/\banemia\b/i.test(body) && labs['Hb'] === undefined) {
    findings.push({
      kind: 'anemia-without-hb',
      message: 'Diagnosis anemia tapi tidak ada Hb di catatan ini.',
      anchor: 'Anemia',
    });
  }

  return findings;
}
