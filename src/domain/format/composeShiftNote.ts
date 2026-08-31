import { formatBody } from './formatters';
import { formatLocation } from '../identity';
import type { OutputFormat, Patient, ShiftNote } from '../types';
import type { BulletStyle } from './formatters';

/**
 * One jaga note, composed to be sent on its own.
 *
 * A jaga note is reported separately from the morning SOAP — it is a complaint
 * reviewed on a shift, sent when it happens, to whoever is on. So it needs the
 * same treatment as the daily note: an identity line so the reader knows whose
 * chart it is, and a run through the formatters so it survives WhatsApp and
 * SIMGOS.
 *
 * `renderShiftNotes` in `shiftNotes.ts` is the OTHER case and stays separate:
 * that appends ticked notes underneath a day's report. This one stands alone.
 * Sharing an implementation would mean one of the two carrying an identity
 * line it should not have.
 */
export function composeShiftNote(
  note: ShiftNote,
  patient: Patient,
  options: {
    format: OutputFormat;
    bullet: BulletStyle;
    includeIdentity: boolean;
  },
): string {
  const lines: string[] = [];

  if (options.includeIdentity) {
    const location = formatLocation(patient);
    const identity = [
      patient.name?.trim() || null,
      patient.age !== undefined ? `${patient.age} tahun` : null,
      patient.mrn ? `RM ${patient.mrn}` : null,
    ]
      .filter(Boolean)
      .join('/');

    if (identity) lines.push(`*${identity}*`);
    if (location) lines.push(`_${location}_`);
    if (lines.length > 0) lines.push('');
  }

  /**
   * The heading names it as a jaga note and carries the clock time.
   *
   * Without it the reader gets a bare paragraph of findings with no indication
   * that it is an out-of-hours review rather than a second morning note, and
   * the time is the single most load-bearing fact about a shift complaint.
   */
  lines.push(`*SOAP Jaga ${note.time}*`);
  lines.push(note.body.trim());

  // Through the same formatters as the daily note: WhatsApp emphasis survives,
  // SIMGOS gets guaranteed ASCII. A jaga note pasted into SIMGOS has exactly
  // the same `?` problem as any other text, and no reason to solve it twice.
  return formatBody(lines.join('\n').trim(), options.format, options.bullet);
}
