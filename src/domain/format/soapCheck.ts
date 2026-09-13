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

/** Analytes named in a diagnosis, with the value quoted beside them. */
const DIAGNOSIS_VALUES: ReadonlyArray<readonly [string, RegExp]> = [
  ['K', /hypo?kalemia[^\n]*?\(([\d.]+)/i],
  ['K', /hyper?kalemia[^\n]*?\(([\d.]+)/i],
  ['Na', /hypo?natremia[^\n]*?\((\d{2,3})/i],
  ['Na', /hyper?natremia[^\n]*?\((\d{2,3})/i],
];

/**
 * The last value in a diagnosis like `Hypokalemia (2.9 --> 3.7)`.
 *
 * The arrow form is how this corpus records a correction in progress, and the
 * number that matters is the one on the RIGHT — comparing the admission value
 * against today's lab would flag every improving patient every day.
 */
function quotedValue(text: string, pattern: RegExp): number | null {
  const line = text.split('\n').find((candidate) => pattern.test(candidate));
  if (!line) return null;
  const numbers = [...line.matchAll(/([\d]+[.,]?[\d]*)/g)]
    .map((match) => Number((match[1] ?? '').replace(',', '.')))
    .filter((value) => Number.isFinite(value));
  return numbers.at(-1) ?? null;
}

export interface SoapCheckInput {
  body: string;
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

  if (/\banemia\b/i.test(body) && labs['Hb'] === undefined) {
    findings.push({
      kind: 'anemia-without-hb',
      message: 'Diagnosis anemia tapi tidak ada Hb di catatan ini.',
      anchor: 'Anemia',
    });
  }

  return findings;
}
