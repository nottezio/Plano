import { consultCovered, dpjpSpecialties } from './specialties';
import { findDayMarkers } from '@/domain/dayMarkers';
import { aliasesOrDefault } from '@/domain/sections/aliases';
import { parseSections, type ParsedSection } from '@/domain/sections/parseSections';
import type { SectionAlias, SectionId } from '@/domain/types';
import { readVitalSigns } from '@/domain/vitals';

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
  | 'vitals-blank'
  | 'section-empty'
  | 'subjective-unchanged'
  | 'unfilled'
  | 'hari-rawat'
  | 'placeholder'
  | 'duplicate-line'
  | 'flow-unchanged'
  | 'day-marker'
  | 'urine-unchanged'
  | 'lab-planned-but-resulted'
  | 'diagnosis-value-stale'
  | 'consult-not-in-dpjp'
  | 'electrolyte-corrected'
  | 'anemia-without-hb'
  | 'balance-without-catheter';

/**
 * How urgent, which is also the order they are listed in:
 *  - `isi`: something left unfilled; the note is incomplete as sent.
 *  - `kemarin`: copied from yesterday and not updated.
 *  - `cek`: two parts of the note disagree.
 */
export type SoapFindingLevel = 'isi' | 'kemarin' | 'cek';

export interface SoapFinding {
  kind: SoapFindingKind;
  level: SoapFindingLevel;
  /** One line, in the user's language, naming the thing to look at. */
  message: string;
  /** The text to search for in the body, so the UI can jump to it. */
  anchor?: string;
  /** Where the anchor is, when a plain search would find the wrong copy of it. */
  at?: number;
  /**
   * Day counters (`H-3`, `hari ke-9`), each with its own position, for a
   * finding that is about several of them: the panel lists them one by one,
   * each jumpable and each can be advanced by one on its own.
   */
  markers?: Array<{ text: string; value: number; at: number }>;
}

/**
 * The first reading of each vital sign, normalised. Reads every usual name
 * (`TD`, `Tensi`, `N`, `RR`, `Saturasi`…) and the one-line form; see
 * `domain/vitals`, which carry-forward uses to clear the same fields.
 */
export function readVitals(body: string, aliases?: readonly SectionAlias[]): Record<string, string> {
  return { ...readVitalSigns(body, aliases).readings };
}

/**
 * The urine output of a note: the measured volume and, when written, the
 * rate per kg per hour, with where the line is.
 *
 * `readFlows` only knew `Urine … cc`. The ward also writes `Urin`, `UO`,
 * `Produksi urin`, `Diuresis` and `BAK`, and `ml`/`mL` as often as `cc`, so
 * an unchanged urine output written any of those ways was never reported.
 * Compared as NUMBERS (volume, and rate when both have one), so a line that
 * was re-typed with different spacing still counts as the same measurement.
 */
const URINE_LINE =
  /^[^\S\n]*[-•*_]*[^\S\n]*(urine\s*output|produksi\s+urine?|urine?|diuresis|u\.?o|bak)\b[^\n]*$/gim;

export interface UrineReading {
  volume: number;
  rate: number | null;
  text: string;
  at: number;
}

export function readUrineOutput(body: string): UrineReading | null {
  for (const match of body.matchAll(URINE_LINE)) {
    const line = match[0];
    const volume = /(\d+(?:[.,]\d+)?)\s*(?:cc|ml)\b(?!\s*\/\s*kg)/i.exec(line);
    if (!volume?.[1]) continue;
    const rate = /(\d+(?:[.,]\d+)?)\s*(?:cc|ml)\s*\/\s*kg/i.exec(line);
    const labelAt = line.search(/[A-Za-z]/);
    return {
      volume: Number(volume[1].replace(',', '.')),
      rate: rate?.[1] ? Number(rate[1].replace(',', '.')) : null,
      text: line.trim().replace(/\s+/g, ' '),
      at: (match.index ?? 0) + Math.max(0, labelAt),
    };
  }
  return null;
}

/**
 * Urine output and fluid balance, as one string each.
 *
 * These are DAILY measurements like the vitals, and they are the two most
 * often copied forward untouched: in the 2026-09-11 export, urine is identical
 * to the previous day in 13 of 41 consecutive pairs and balance in 12 of 30 —
 * roughly a third of the time, against 5 of 94 for the whole vitals block.
 *
 * Echocardiography and chest films are identical 80% of the time in the same
 * corpus and are NOT checked, because there the sameness is correct: the study
 * was not repeated. The distinction is whether the number is measured every
 * day, not whether it changed.
 */
export function readFlows(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [label, pattern] of [
    ['Urine', /urine[^\n]*?([\d.,]+\s*cc[^\n]*)/i],
    ['Balance', /balance[^\n]*?([+-]?\s*[\d.,]+\s*(?:cc|ml)[^\n]*)/i],
  ] as const) {
    const match = pattern.exec(body);
    if (match?.[1]) out[label] = match[1].replace(/\s+/g, ' ').trim();
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
  /** Section headings, from Settings. */
  aliases?: readonly SectionAlias[];
}

const LEVEL_ORDER: Record<SoapFindingLevel, number> = { isi: 0, kemarin: 1, cek: 2 };

export function checkSoap(input: SoapCheckInput): SoapFinding[] {
  const { body, previous } = input;
  const findings: SoapFinding[] = [];
  if (!body.trim()) return findings;

  const aliases = aliasesOrDefault(input.aliases);
  const sections = parseSections(body, aliases);
  const signs = readVitalSigns(body, aliases);
  const vitals: Record<string, string> = { ...signs.readings };

  if (signs.blank.length > 0) {
    findings.push({
      kind: 'vitals-blank',
      level: 'isi',
      message: `TTV belum diisi: ${signs.blank.join(', ')}.`,
      ...anchorFor(body, signs.blank[0] ?? ''),
    });
  }
  if (!signs.named) {
    findings.push({
      kind: 'vitals-missing',
      level: 'isi',
      message: 'Tidak ada TTV di catatan ini.',
    });
  } else if (previous && Object.keys(vitals).length > 0) {
    const before = readVitals(previous, aliases);
    const shared = Object.keys(vitals).filter((key) => before[key] !== undefined);
    // All of them, not some: one vital genuinely repeating is ordinary, the
    // whole block repeating is a copy that was never edited.
    if (shared.length >= 3 && shared.every((key) => before[key] === vitals[key])) {
      findings.push({
        kind: 'vitals-unchanged',
        level: 'kemarin',
        message: `TTV sama persis dengan catatan sebelumnya (${shared.join(', ')}).`,
        ...anchorFor(body, shared[0] ?? ''),
      });
    }
  }

  if (previous) {
    const urine = readUrineOutput(body);
    const urineBefore = readUrineOutput(previous);
    if (
      urine &&
      urineBefore &&
      urine.volume === urineBefore.volume &&
      (urine.rate === null || urineBefore.rate === null || urine.rate === urineBefore.rate)
    ) {
      findings.push({
        kind: 'urine-unchanged',
        level: 'kemarin',
        message: `Urine output sama dengan kemarin (${String(urine.volume)} cc${
          urine.rate !== null ? `, ${String(urine.rate)} cc/kgBB/jam` : ''
        }). Sudah diukur ulang?`,
        anchor: body.slice(urine.at, urine.at + 4),
        at: urine.at,
      });
    }

    const flows = readFlows(body);
    const before = readFlows(previous);
    for (const [label, value] of Object.entries(flows)) {
      // Urine is checked above, by its numbers, under any of its names.
      if (label === 'Urine') continue;
      if (before[label] === undefined || before[label] !== value) continue;
      findings.push({
        kind: 'flow-unchanged',
        level: 'kemarin',
        message: `${label} sama persis dengan kemarin (${value}).`,
        ...anchorMatch(body, new RegExp(`\\b${label}\\b`, 'i')),
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
        level: 'kemarin',
        message:
          unchanged.length === 1
            ? `Hitungan hari belum berubah dari kemarin: ${unchanged[0]?.text ?? ''}.`
            : `${String(unchanged.length)} hitungan hari belum berubah dari kemarin. Pilih untuk melihat, +1 untuk menaikkan.`,
        ...(unchanged[0] ? { anchor: unchanged[0].text, at: unchanged[0].start } : {}),
        markers: unchanged.map((marker) => ({ text: marker.text, value: marker.value, at: marker.start })),
      });
    }
  }

  // A lab both planned and resulted in the same note. The plan line is the one
  // to remove; the result is why.
  const labs = readLabs(body);
  /*
    ONLY LINES IN THE PLAN, and the finding points at the line.

    This used to test EVERY line of the note, so a `Periksa lab…` or `Cek DL`
    anywhere (anamnesis, penunjang, a quoted consult reply) counted as "still
    written in the Plan", and "Tampilkan" searched for the bare word `Plan`,
    whose first hit in an echo report is "Planimetry". Reported 29 September
    on a patient with no lab plan at all.

    Only a one-off "check this" counts. `Cek elektrolit ulang besok`,
    `serial`, `evaluasi`, `per 12 jam` are plans for the NEXT result.
  */
  const planHit = planLines(body, sections).find(
    ({ line }) =>
      /^\s*-?\s*(?:cek|periksa|rencana)\s+(?:lab\b|laboratorium|darah\s*rutin|elektrolit|dl\b)/i.test(line) &&
      !/\b(?:ulang|besok|serial|evaluasi|kontrol|tiap|setiap|per\s*\d|post|jam|pagi|sore|malam|h\+?\d)/i.test(line),
  );
  if (planHit && Object.keys(labs).length > 0) {
    const text = planHit.line.trim();
    findings.push({
      kind: 'lab-planned-but-resulted',
      level: 'cek',
      message: `Lab sudah ada hasilnya, tapi Plan masih menulis “${text.replace(/^[-•]\s*/, '')}”.`,
      anchor: text,
      at: planHit.offset + planHit.line.indexOf(text),
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
        level: 'cek',
        message: `Diagnosis menyebut ${analyte} ${quoted}, lab terbaru ${measured}.`,
        ...anchorMatch(body, pattern),
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

    Matched by SPECIALTY, not by spelling (`specialties.ts`): `TS Pulmo` and
    `DPJP Pulmonologi`, `TS Gizi Klinik` and `DPJP Gizi`, `TS Rehab` and
    `DPJP KFR` are each one service, and a consultant's title (`Sp.N`) names
    the specialty even under a generic label. The first-five-letters match
    this replaced flagged the last two on a note that listed both.
  */
  const covered = dpjpSpecialties(body);

  const services = new Set(
    [...body.matchAll(/^[*_\s]*TS\s+([A-Za-z][\w ]{2,25}?)[*_:\s]*$/gim)]
      .map((match) => (match[1] ?? '').trim())
      .filter(Boolean),
  );

  for (const service of services) {
    if (consultCovered(service, covered)) continue;
    findings.push({
      kind: 'consult-not-in-dpjp',
      level: 'cek',
      message: `TS ${service} sudah menjawab tapi belum ada di daftar DPJP.`,
      ...anchorMatch(body, new RegExp(`^[*_\\s]*TS\\s+${escapeRegex(service)}`, 'im')),
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
      level: 'cek',
      message: `${analyte} sudah ${measured} (dalam rentang) — tambahkan "perbaikan" di diagnosisnya?`,
      ...anchorFor(body, line.trim().slice(0, 40)),
    });
  }

  if (/\banemia\b/i.test(body) && labs['Hb'] === undefined) {
    findings.push({
      kind: 'anemia-without-hb',
      level: 'cek',
      message: 'Diagnosis anemia tapi tidak ada Hb di catatan ini.',
      ...anchorMatch(body, /\banemia\b/i),
    });
  }

  /*
    A diuretic or a fluid balance, with no urinary catheter written anywhere
    (Avi, 2026-10-07).

    Furosemide is given to make urine, and a balance is only as good as the
    urine it counts: without a catheter the output is an estimate, and the
    "1.83 cc/kgBB/jam" that the next line computes from it is precision the
    number does not have. A reminder, not a rule: a patient who voids into a
    measured urinal is fine, which is why it says "tulis bila sudah".

    Only the Plan/Terapi lines can trigger it, so a furosemide in the history
    or a "balance" in a consult's text does not; a line that stops the drug
    does not either. Any mention of a catheter anywhere (`BAK per kateter`,
    `terpasang DC`, `Foley`) silences it.
  */
  const plan = planLines(body, sections);
  const stopped = /\b(?:stop|aff|hentikan|dihentikan|tunda|ditunda|off)\b/i;
  const diuretic = plan.find(({ line }) => /\b(?:furosemid|furosemide|lasix)\b/i.test(line) && !stopped.test(line));
  const balance = plan.find(({ line }) =>
    /balan(?:ce|s)\s*cairan|\bbalance\b|urine?\s*output|produksi\s*urin|\bdiuresis\b|intake[\s-]*output|\bI\s*\/\s*O\b/i.test(line),
  );
  const catheter = /kateter|catheter|foley|\bDC\b|dower|urine?\s*bag/i.test(body);
  const trigger = diuretic ?? balance;
  if (trigger && !catheter) {
    const what = diuretic ? 'Furosemide diberikan' : 'Plan memantau balance cairan / urine output';
    const text = trigger.line.trim();
    findings.push({
      kind: 'balance-without-catheter',
      level: 'cek',
      message: `${what}, tapi kateter urin (Foley) belum tercatat. Pertimbangkan pemasangan, atau tulis bila sudah terpasang.`,
      anchor: text,
      at: trigger.offset + trigger.line.indexOf(text),
    });
  }

  findings.push(...checkSections(sections, previous, aliases));
  findings.push(...checkUnfilled(body));
  findings.push(...checkHariRawat(body, previous));
  findings.push(...checkDuplicates(sections));

  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => LEVEL_ORDER[a.finding.level] - LEVEL_ORDER[b.finding.level] || a.index - b.index)
    .map(({ finding }) => finding);
}

/** An anchor with its position, for text that may occur more than once. */
function anchorFor(body: string, text: string, from = 0): Pick<SoapFinding, 'anchor' | 'at'> {
  if (!text) return {};
  const at = body.toLowerCase().indexOf(text.toLowerCase(), from);
  return at >= 0 ? { anchor: body.slice(at, at + text.length), at } : { anchor: text };
}

/** The exact text a pattern matched, and where: never a bare-word search. */
function anchorMatch(body: string, pattern: RegExp): Pick<SoapFinding, 'anchor' | 'at'> {
  const flags = pattern.flags.replace('g', '');
  const match = new RegExp(pattern.source, flags).exec(body);
  if (!match) return {};
  const text = match[0].trim();
  return { anchor: text, at: match.index + match[0].indexOf(text) };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Section ids that end the plan. */
const NOT_PLAN = new Set<SectionId>(['_intro', 's', 'o', 'ttv', 'a', 'penunjang']);

/**
 * Every line of the plan, with its offset: the P and Terapi sections and the
 * plan's own sub-blocks after them (`Plan Monitoring:` parses as a custom
 * section), until the next S / O / A / Penunjang.
 */
function planLines(
  body: string,
  sections: readonly ParsedSection[],
): Array<{ line: string; offset: number }> {
  const out: Array<{ line: string; offset: number }> = [];
  let inPlan = false;
  for (const section of sections) {
    if (section.sectionId === 'p' || section.sectionId === 'terapi') inPlan = true;
    else if (NOT_PLAN.has(section.sectionId)) inPlan = false;
    if (!inPlan) continue;
    let offset = section.start + (section.headerLine?.length ?? 0);
    for (const line of body.slice(offset, section.end).split('\n')) {
      out.push({ line, offset });
      offset += line.length + 1;
    }
  }
  return out;
}

/** Content with bullets, emphasis and whitespace removed: what is actually written. */
function substance(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^[\s\-•*_>]+|[\s*_]+$/g, ''))
    .filter(Boolean)
    .join('\n')
    .trim();
}

const SECTION_NAMES: Partial<Record<SectionId, string>> = {
  s: 'S (keluhan)',
  a: 'A (assessment)',
};

/**
 * EMPTY SECTIONS, and S copied unchanged.
 *
 * After "Salin dari hari sebelumnya" the S section is emptied on purpose, to
 * be rewritten; left empty, the note goes out with no complaint at all. A and
 * P are never cleared, so an empty one is a template never filled in. P is
 * judged together with Terapi, because the templates split the plan across
 * `P/ Plan Diagnostik` and `Plan Terapi`: only when BOTH are empty is there
 * no plan.
 *
 * S identical to yesterday's is the one section expected to change daily; the
 * others legitimately carry forward.
 */
function checkSections(
  sections: readonly ParsedSection[],
  previous: string | undefined,
  aliases: readonly SectionAlias[],
): SoapFinding[] {
  const out: SoapFinding[] = [];
  for (const id of ['s', 'a'] as const) {
    const found = sections.filter((section) => section.sectionId === id);
    if (found.length > 0 && found.every((section) => !substance(section.text))) {
      out.push({
        kind: 'section-empty',
        level: 'isi',
        message: `${SECTION_NAMES[id]} masih kosong.`,
        ...(found[0]?.headerLine ? { anchor: found[0].headerLine.trim(), at: found[0].start } : {}),
      });
    }
  }
  const plans = sections.filter((section) => section.sectionId === 'p' || section.sectionId === 'terapi');
  if (plans.length > 0 && plans.every((section) => !substance(section.text))) {
    out.push({
      kind: 'section-empty',
      level: 'isi',
      message: 'P (plan / terapi) masih kosong.',
      ...(plans[0]?.headerLine ? { anchor: plans[0].headerLine.trim(), at: plans[0].start } : {}),
    });
  }

  if (previous) {
    const today = sections.filter((section) => section.sectionId === 's').map((section) => substance(section.text)).join('\n');
    const before = parseSections(previous, aliases)
      .filter((section) => section.sectionId === 's')
      .map((section) => substance(section.text))
      .join('\n');
    if (today.length >= 20 && today.replace(/\s+/g, ' ') === before.replace(/\s+/g, ' ')) {
      const first = sections.find((section) => section.sectionId === 's');
      out.push({
        kind: 'subjective-unchanged',
        level: 'kemarin',
        message: 'Keluhan (S) sama persis dengan kemarin.',
        ...(first?.headerLine ? { anchor: first.headerLine.trim(), at: first.start } : {}),
      });
    }
  }
  return out;
}

/**
 * TEMPLATE HOLES left unfilled.
 *
 * Each pattern is a gap that only exists because a template put a label down
 * and nothing was typed after it. They are the shapes the seeded templates
 * leave: `hari perawatan ke  hari`, `TB :  cm`, `()`, a bullet with nothing
 * on it. Placeholders people type to come back to (`xx`, `??`) are here too.
 */
function checkUnfilled(body: string): SoapFinding[] {
  const out: SoapFinding[] = [];

  const rawat = /hari\s+(?:perawatan|rawat)\s+ke[\s-]*(?=hari\b|[,.;]|$)/im.exec(body);
  if (rawat) {
    out.push({ kind: 'unfilled', level: 'isi', message: 'Hari perawatan belum diisi.', anchor: rawat[0], at: rawat.index });
  }

  for (const [label, unit] of [['TB', 'cm'], ['BB', 'kg']] as const) {
    const hole = new RegExp(`^\\s*${label}\\s*:?\\s*${unit}\\b`, 'im').exec(body);
    if (hole) {
      out.push({ kind: 'unfilled', level: 'isi', message: `${label} belum diisi.`, anchor: hole[0].trim(), at: hole.index + hole[0].indexOf(label) });
    }
  }

  const brackets = /\(\s*\)/.exec(body);
  if (brackets) {
    out.push({ kind: 'unfilled', level: 'isi', message: 'Ada kurung kosong “()”.', anchor: brackets[0], at: brackets.index });
  }

  const bullets = [...body.matchAll(/^[ \t]*[-•][ \t]*$/gm)];
  if (bullets.length > 0) {
    out.push({
      kind: 'unfilled',
      level: 'isi',
      message: bullets.length === 1 ? 'Ada 1 butir “-” kosong.' : `Ada ${bullets.length} butir “-” kosong.`,
      anchor: bullets[0]?.[0] ?? '-',
      ...(bullets[0]?.index !== undefined ? { at: bullets[0].index } : {}),
    });
  }

  const placeholder = /(?<![\w])(?:xx+|XX+|\?{2,})(?![\w])/.exec(body);
  if (placeholder) {
    out.push({
      kind: 'placeholder',
      level: 'isi',
      message: `Masih ada penanda sementara “${placeholder[0]}”.`,
      anchor: placeholder[0],
      at: placeholder.index,
    });
  }
  return out;
}

/**
 * HARI PERAWATAN not moved on from yesterday's note.
 *
 * Compared with YESTERDAY'S NOTE, not with the admission date: a patient
 * entered in the app on their third day has an admission date that is the
 * day they were entered, and a rule built on it would be wrong about exactly
 * those patients every day of their stay. Yesterday's own number is the one
 * the author last checked.
 */
const HARI_RAWAT = /hari\s+(?:perawatan|rawat)\s+(?:ke[\s-]*)?(\d{1,3})\b/i;

function checkHariRawat(body: string, previous: string | undefined): SoapFinding[] {
  if (!previous) return [];
  const today = HARI_RAWAT.exec(body);
  const before = HARI_RAWAT.exec(previous);
  if (!today?.[1] || !before?.[1]) return [];
  const now = Number(today[1]);
  const then = Number(before[1]);
  if (now === then + 1) return [];
  return [
    {
      kind: 'hari-rawat',
      level: now === then ? 'kemarin' : 'cek',
      message:
        now === then
          ? `Hari perawatan masih ke-${now}, sama dengan kemarin.`
          : `Hari perawatan ke-${now}, kemarin ke-${then}.`,
      anchor: today[0],
      at: today.index,
    },
  ];
}

/**
 * The SAME line twice in one section: a therapy or plan pasted twice.
 * Short lines are skipped (`- Pantau`, `- Diet`), and so are headings.
 */
function checkDuplicates(sections: readonly ParsedSection[]): SoapFinding[] {
  for (const section of sections) {
    const seen = new Map<string, number>();
    const contentStart = section.start + (section.headerLine?.length ?? 0);
    let offset = contentStart;
    for (const line of section.text.split('\n')) {
      const key = line.replace(/^[\s\-•*_>]+/, '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (key.length >= 15) {
        if (seen.has(key)) {
          return [
            {
              kind: 'duplicate-line',
              level: 'cek',
              message: `Baris ganda: “${line.trim().slice(0, 50)}${line.trim().length > 50 ? '…' : ''}”.`,
              anchor: line.trim(),
              at: offset + line.indexOf(line.trim()),
            },
          ];
        }
        seen.set(key, offset);
      }
      offset += line.length + 1;
    }
  }
  return [];
}
