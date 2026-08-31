import { parseSections } from '../sections/parseSections';
import { formatLocation } from '../identity';
import type { Patient, SectionAlias } from '../types';

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
function identityLineFrom(body: string, patient: Patient): string {
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
function dpjpLinesFrom(body: string): string[] {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^_.*DPJP.*_$/i.test(line));
}

/**
 * Height and weight, if the note carries them.
 *
 * Included because a 6MWT referral needs them and omitting them sends the
 * request back. Matched on the label rather than pulled from a fixed position:
 * they appear in different places in the three note formats.
 */
function measurementsFrom(body: string): string[] {
  const out: string[] = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (/^(TB|BB)\s*[:=]/i.test(trimmed)) out.push(trimmed);
  }
  return out;
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
    lines.push(
      `Assalamualaikum dokter dan selamat pagi dokter. Tabe dokter, mohon izin mengirimkan list pasien ${
        options.purpose
      } dari ${options.listFrom ?? location}${options.listDate ? `, ${options.listDate}` : ''}`,
    );
    lines.push('');
    // Numbered, because this is one entry in a list several people add to.
    if (identity) {
      lines.push(`1. ${identity}`);
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

  const measurements = measurementsFrom(body);
  if (measurements.length > 0) {
    lines.push(...measurements);
    lines.push('');
  }

  lines.push(
    options.closing ?? (options.listStyle ? 'Tabe terima kasih dokter' : DEFAULT_CLOSING),
  );

  // Collapse the runs of blank lines left by any absent block, so a note with
  // no DPJP line does not produce a gap where one would have been.
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
