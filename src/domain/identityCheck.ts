import { parseIdentity } from './parsePatient';
import type { Patient } from './types';

/**
 * Does the note in front of you belong to the patient you opened?
 *
 * The failure this exists for is copying one patient's report into another
 * patient's chat. It is not a rare kind of mistake — a note carried forward
 * from the wrong day, a template pasted from another patient, a body edited in
 * the wrong tab — and it is close to undetectable afterwards, because the
 * message reads as a perfectly coherent report about somebody.
 *
 * The check is deliberately narrow: it compares the record number written IN
 * the note against the one on the patient record, and the name against the
 * name. Those are the two things that identify a person, and both are already
 * present in every real note.
 *
 * It reports, it does not block. A mismatch has legitimate causes — the record
 * has not been filled in, or the name is spelled differently — and an app that
 * refused to copy would be worked around within a day.
 */

export type IdentityCheck =
  /** Nothing to compare: the note or the record lacks an identity. */
  | { status: 'unknown' }
  /** Note and record agree on the record number. */
  | { status: 'match' }
  /** They disagree. `noteMrn` is what the note says. */
  | { status: 'mismatch'; field: 'mrn' | 'name'; noteValue: string; recordValue: string };

/** Compared without punctuation or case: `Tn. Budi` and `TN BUDI` are one name. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(tn|ny|nn|an|sdr|sdri)\.?\s*/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function checkIdentity(patient: Patient, body: string): IdentityCheck {
  const note = parseIdentity(body);

  const recordMrn = patient.mrn?.trim();
  const noteMrn = note.mrn?.trim();

  // The record number first: it is the identifier, and two patients can share
  // a name far more easily than a number.
  if (recordMrn && noteMrn) {
    return recordMrn.replace(/^0+/, '') === noteMrn.replace(/^0+/, '')
      ? { status: 'match' }
      : { status: 'mismatch', field: 'mrn', noteValue: noteMrn, recordValue: recordMrn };
  }

  const recordName = patient.name?.trim();
  const noteName = note.name?.trim();

  if (recordName && noteName) {
    const a = normalise(recordName);
    const b = normalise(noteName);
    // Prefix comparison, so a record holding a shortened name still matches a
    // note that spells it out. A different patient does not prefix-match.
    if (a.startsWith(b) || b.startsWith(a)) return { status: 'match' };
    return { status: 'mismatch', field: 'name', noteValue: noteName, recordValue: recordName };
  }

  return { status: 'unknown' };
}
