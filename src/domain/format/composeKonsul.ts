import { parseSections } from '../sections/parseSections';
import { formatLocation } from '../identity';
import { normaliseDpjpLabel } from '../dpjpLabel';
import { formatBody, type BulletStyle } from './formatters';
import type { OutputFormat, Patient, SectionAlias } from '../types';

/**
 * A konsul — a referral to another service, composed from the day's note.
 *
 * Not a template to fill in. Everything here already exists in the SOAP: the
 * identity line, the DPJP lines, the assessment, the height and weight. Asking
 * for them again would be asking a resident to retype what is on screen, which
 * is the thing this app exists to stop, and every retype is a chance for the
 * diagnosis in the referral to drift from the diagnosis in the chart.
 *
 * So this READS the note and rearranges it. Nothing is reworded: the
 * assessment lines are copied exactly as written, bullets and all, because a
 * referral that paraphrases the assessment is a referral that disagrees with
 * the chart.
 */

export interface KonsulOptions {
  /** What the referral is for, e.g. `6MWT`. Appears in the opening line. */
  purpose: string;
  greeting?: string;
  closing?: string;
  /**
   * The "list pasien" shape, used for the echo full-study request.
   *
   * A different sentence and a numbered patient — it is one line of a list
   * several residents add to, not a letter about one patient. The body is
   * identical, which is why it is a flag here rather than a second composer:
   * two functions emitting the same identity, DPJP and diagnosis blocks would
   * drift the moment one of them was corrected.
   */
  listStyle?: boolean;
  /** Ward the list is sent from, e.g. `PJT Lt. 4`. */
  listFrom?: string;
  /** Clinical date of the list, already formatted. */
  listDate?: string;
  /**
   * The destination format. Defaults to WhatsApp, where these messages are
   * sent.
   *
   * This composer used to return its joined lines as they were. It was the
   * only path to the clipboard, along with `composeInvasif`, that never went
   * through `formatBody`. So the Format chip did nothing here, and a
   * zero-width space or NBSP in the note reached the clipboard even with
   * "Teks polos" selected (see CHANGES.md).
   */
  format?: OutputFormat;
  bullet?: BulletStyle;
  /** Plain only: spell symbols in ASCII (`→` → `->`). See `SYMBOL_ASCII`. */
  asciiSymbols?: boolean | undefined;
}

const DEFAULT_GREETING = 'Assalamualaikum dokter. Tabe dokter,';
const DEFAULT_CLOSING = 'Tabe terimakasih banyak dokter, mohon arahan ta dokter.';

/**
 * The identity line, as the note writes it.
 *
 * Preferred over rebuilding one from the patient record. The note's line is
 * what the DPJP already reads every morning, in the form they read it, and it
 * carries the date of birth — which the patient record does not always have,
 * and which a referral needs.
 */
export function identityLineFrom(body: string, patient: Patient): string {
  const bold = /^\s*\*([^*\n]*\/[^*\n]*)\*\s*$/m.exec(body);
  if (bold?.[1]) return `*${bold[1].trim()}*`;

  const parts = [
    patient.name?.trim(),
    patient.age !== undefined ? `${patient.age} tahun` : null,
    patient.mrn ? `RM ${patient.mrn}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `*${parts.join('/')}*` : '';
}

/**
 * `_DPJP …_` lines, verbatim and in order.
 *
 * A patient often has two or three — Kardio, Tindakan, plus another service —
 * and which ones are named is a clinical fact about who is responsible, not a
 * formatting choice. Taking all of them and reordering none is the only safe
 * handling.
 */
export function dpjpLinesFrom(body: string): string[] {
  /*
    Through `normaliseDpjpLabel` (2026-10-12): this was a second DPJP reader
    keyed on the exact letters, so a note's "_DJPJP Utama : dr. …_" — the
    typo 11.1 taught the parser — was dropped from the konsul, and the
    referral went out without the main DPJP. The label is sent corrected
    ("DPJP Utama"); the name after it is untouched.
  */
  return body
    .split('\n')
    .map((line) => normaliseDpjpLabel(line.trim()))
    .filter((line) => /^_.*DPJP.*_$/i.test(line));
}

/**
 * Height and weight, if the note carries them.
 *
 * Included because a 6MWT referral needs them and omitting them sends the
 * request back. Matched on the label rather than pulled from a fixed position:
 * they appear in different places in the three note formats.
 */
export function measurementsFrom(body: string): string[] {
  const out: string[] = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (/^(TB|BB)\s*[:=]/i.test(trimmed)) out.push(trimmed);
  }
  return out;
}

/**
 * What a consult asks for that the note does not have yet.
 *
 * 6MWT is the case that keeps coming back: the walk test is reported per
 * metre and interpreted against the patient's size, so the request is sent
 * back when height and weight are missing. The note usually has them — they
 * are simply on a day the consult was not composed from.
 *
 * A reminder, never a block: a consult sent without them is still a consult,
 * and a copy button that refused would be worked around within a day.
 */
/**
 * Whether a konsul for this purpose carries TB and BB (2026-10-12).
 *
 * One answer for both the reminder and the message: they used to disagree —
 * the reminder asked only for 6MWT, the message added TB/BB to EVERY konsul,
 * echo full study included, where Avi's ward does not send them.
 */
export function konsulNeedsMeasurements(purpose: string): boolean {
  // `6 MWT`, `6mwt`, `Tes 6MWT`, `six minute walk test`.
  return /6\s*-?\s*mwt|six\s*minute/i.test(purpose);
}

export function missingKonsulMeasurements(purpose: string, body: string): Array<'TB' | 'BB'> {
  if (!konsulNeedsMeasurements(purpose)) return [];

  const present = measurementsFrom(body);
  const has = (label: 'TB' | 'BB'): boolean =>
    present.some((line) => new RegExp(`^${label}\\s*[:=]\\s*\\S`, 'i').test(line));

  return (['TB', 'BB'] as const).filter((label) => !has(label));
}

/** "PJT Lt 4", "PJT Lt. 4" → "PJT Lantai 4", as the list is written. */
function longWard(ward: string): string {
  return ward.trim().replace(/\b(?:lt\.?|lantai)\s*(\d+)/i, 'Lantai $1');
}

/**
 * The identity line with the room added inside the bold: "*… / RM 1738411 /
 * Kamar 406 Bed 1*". From the patient record, else the note's opening line
 * ("di *PJT Lt 4 Kamar 421 Bed 4*"); unchanged when it already names a room.
 */
function withRoom(identity: string, patient: Patient, body: string): string {
  if (/\bkamar\b/i.test(identity)) return identity;
  let room = patient.room?.trim();
  let bed = patient.bed?.trim();
  if (!room) {
    const opening = /\bKamar\s+([\w-]+)(?:\s+Bed\s+([\w-]+))?/i.exec(body.split('\n').slice(0, 3).join(' '));
    room = opening?.[1];
    bed = opening?.[2];
  }
  if (!room) return identity;
  const place = `Kamar ${room}${bed ? ` Bed ${bed}` : ''}`;
  return identity.replace(/\*$/, ` / ${place}*`);
}

export function composeKonsul(
  body: string,
  patient: Patient,
  aliases: readonly SectionAlias[],
  options: KonsulOptions,
): string {
  const sections = parseSections(body, aliases);

  /**
   * The assessment, copied exactly.
   *
   * First occurrence only, matching every other consumer of sections: a
   * `*TS BTKV*` block writes its own assessment further down, and sending a
   * consulting service's assessment out as ours would be wrong in a document
   * whose entire purpose is to state what we think is going on.
   */
  const assessment = sections.find((section) => section.sectionId === 'a');
  const diagnoses = (assessment?.text ?? '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  const location = formatLocation(patient);
  const lines: string[] = [];

  const identity = identityLineFrom(body, patient);

  if (options.listStyle) {
    /*
      Worded as the ward's own list (Avi's example, 2026-10-12): "rencana
      pasien … tanggal *8 Oktober 2026* dari *PJT Lantai 4* atas nama:", and
      the room on the patient's line, since the echo team walks to the bed.
    */
    const from = longWard(options.listFrom || patient.ward || '');
    lines.push(
      `${options.greeting ?? DEFAULT_GREETING} mohon izin mengirimkan rencana pasien ${options.purpose}${
        options.listDate ? ` tanggal *${options.listDate}*` : ''
      }${from ? ` dari *${from}*` : ''} atas nama:`,
    );
    lines.push('');
    // Numbered, because this is one entry in a list several people add to.
    if (identity) {
      lines.push(`1. ${withRoom(identity, patient, body)}`);
    }
  } else {
    lines.push(
      `${options.greeting ?? DEFAULT_GREETING} Mohon izin mengirimkan konsul pasien rencana ${options.purpose}${
        location ? ` di *${location}*` : ''
      } atas nama:`,
    );
    lines.push('');
    if (identity) lines.push(identity);
  }

  if (identity) lines.push('');

  const dpjp = dpjpLinesFrom(body);
  if (dpjp.length > 0) {
    lines.push(...dpjp);
    lines.push('');
  }

  if (diagnoses.length > 0) {
    lines.push('*Diagnosis:*');
    lines.push(...diagnoses);
    lines.push('');
  }

  const measurements = konsulNeedsMeasurements(options.purpose) ? measurementsFrom(body) : [];
  if (measurements.length > 0) {
    lines.push(...measurements);
    lines.push('');
  }

  lines.push(
    options.closing ?? (options.listStyle ? 'Tabe terima kasih dokter' : DEFAULT_CLOSING),
  );

  // Collapse the runs of blank lines left by any absent block, so a note with
  // no DPJP line does not produce a gap where one would have been.
  return formatBody(
    lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    options.format ?? 'whatsapp',
    options.bullet,
    { asciiSymbols: options.asciiSymbols },
  );
}
