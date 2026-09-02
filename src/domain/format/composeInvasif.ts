import { formatLocation } from '../identity';
import { parseSections } from '../sections/parseSections';
import { dpjpLinesFrom, identityLineFrom, measurementsFrom } from './composeKonsul';
import {
  isInvestigationHeading,
  orderInvestigations,
} from '../reformat/orderInvestigations';
import type { Patient, SectionAlias } from '../types';

/**
 * "Nyanyian Grup Invasif" — announcing a planned procedure to the invasive
 * group.
 *
 * Built on the same readers as the konsul composer, deliberately. Both take
 * the identity line, the DPJP lines, the assessment and the measurements from
 * the note as written; only the framing sentences and the extra procedure
 * fields differ. Two composers with their own copies of those readers would
 * drift the first time one of them was corrected — and the corrections so far
 * have all been to the readers, not the framing.
 *
 * The procedure, its date, and the BPJS class are NOT in the note. They are
 * asked for, because inventing them is worse than asking: a wrong procedure
 * date sent to the invasive group books a room.
 */
export interface InvasifOptions {
  /** e.g. `Advanced PCI`. */
  procedure: string;
  /** e.g. `Minggu, 16-08-2026`. Free text — the group writes it several ways. */
  scheduledFor?: string;
  /** e.g. `BPJS Kelas I`. Free text: some patients are not BPJS at all. */
  payer?: string;
  /**
   * Append the investigation blocks — the longer "laporan" form.
   *
   * The two messages are a pair, not two formats. The short one ends by asking
   * permission to send the investigations; this is that follow-up, so it
   * carries them and swaps to the shorter sign-off.
   */
  includeInvestigations?: boolean;
  greeting?: string;
  closing?: string;
}

const DEFAULT_GREETING = 'Assalamualaikum Wr. Wb. Tabe dokter,';
const DEFAULT_CLOSING = 'Mohon ijin mengirimkan pemeriksaan penunjang pasien dokter.';

/**
 * The follow-up message is not asking to send anything — it IS the sending.
 */
const LAPORAN_CLOSING = 'Tabe terima kasih dokter.';

export function composeInvasif(
  body: string,
  patient: Patient,
  aliases: readonly SectionAlias[],
  options: InvasifOptions,
): string {
  const sections = parseSections(body, aliases);

  /**
   * The assessment, copied exactly, first occurrence only.
   *
   * Same rule as the konsul: a `*TS BTKV*` block writes its own assessment
   * further down, and announcing a consulting service's assessment as ours to
   * the group that will do the procedure would be wrong in the one document
   * whose whole purpose is to say what we think is going on.
   */
  const assessment = sections.find((section) => section.sectionId === 'a');
  const diagnoses = (assessment?.text ?? '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  const location = formatLocation(patient);
  const lines: string[] = [];

  lines.push(
    `${options.greeting ?? DEFAULT_GREETING} mohon izin melaporkan rencana tindakan dari${
      location ? ` *${location}*` : ''
    } atas nama:`,
  );
  lines.push('');

  const identity = identityLineFrom(body, patient);
  if (identity) {
    lines.push(identity);
    lines.push('');
  }

  const dpjp = dpjpLinesFrom(body);
  if (dpjp.length > 0) {
    lines.push(...dpjp);
    lines.push('');
  }

  if (diagnoses.length > 0) {
    lines.push('*Diagnosis :*');
    lines.push(...diagnoses);
    lines.push('');
  }

  /**
   * The procedure line carries its date in the same emphasis.
   *
   * It is the single fact the group reads this message for, and splitting the
   * date onto its own line buried it under the diagnoses in the corpus
   * example.
   */
  if (options.procedure.trim()) {
    const when = options.scheduledFor?.trim();
    lines.push(
      `*Rencana Tindakan : ${options.procedure.trim()}${when ? ` (${when})` : ''}*`,
    );
    lines.push('');
  }

  // BB and TB in the order the group's messages use, which is the reverse of
  // the note's.
  const measurements = measurementsFrom(body);
  const weight = measurements.find((line) => /^BB/i.test(line));
  const height = measurements.find((line) => /^TB/i.test(line));
  const tail = [weight, height, options.payer?.trim() || null].filter(Boolean);
  if (tail.length > 0) {
    lines.push(...(tail as string[]));
    lines.push('');
  }

  if (options.includeInvestigations) {
    /**
     * Investigation blocks, in the ward's canonical order.
     *
     * Selected with `isInvestigationHeading` — the same predicate the bangsal
     * reformatter orders by — so the two cannot disagree about what counts as
     * an investigation. Ordered with `orderInvestigations` for the same
     * reason: the group reads these in one order, and the note stores them in
     * whatever order they arrived.
     *
     * Only headings that OWN THEIR LINE are eligible, so `Ur/Cr : 23/0.48`
     * inside a lab block is not mistaken for a block of its own.
     */
    /**
     * A block runs from its heading to the NEXT investigation heading.
     *
     * Not `section.text`. Every `WBC : 5.650` and `Ur/Cr : 23/0.48` inside a
     * lab block is itself a section to the parser, so the lab heading's own
     * text is empty and all its values sit in the sections after it. Taking
     * only the heading's text emitted the heading with nothing under it —
     * a lab block reduced to its date.
     *
     * Slicing the body between heading offsets keeps whatever is in there,
     * fields and all, exactly as written.
     */
    const starts = sections
      .filter(
        (section) =>
          section.ownsLine &&
          section.headerLine !== null &&
          isInvestigationHeading(section.headerLine),
      )
      .map((section) => section.start);

    if (starts.length > 0) {
      /**
       * A block ends at the next investigation heading, or at the next heading
       * that is clearly NOT one — an `*A:*` after the echo report ends it —
       * whichever comes first. Running to the end of the body would sweep the
       * therapy and plan in behind the last block.
       */
      const boundaries = sections
        .filter((section) => section.ownsLine)
        .map((section) => section.start);

      const rendered = starts.flatMap((start) => {
        const next = boundaries.find((offset) => offset > start) ?? body.length;
        return body.slice(start, next).trimEnd().split('\n');
      });

      lines.push(...orderInvestigations(rendered));
      lines.push('');
    }
  }

  lines.push(
    options.closing ??
      (options.includeInvestigations ? LAPORAN_CLOSING : DEFAULT_CLOSING),
  );

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
