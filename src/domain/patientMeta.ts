/**
 * Whether an autosave has anything new for the patient document (2026-11-01).
 *
 * Every body save also wrote the patient document (preview, DPJP, lab plans,
 * `updatedAt`). `updatedAt` changes every time, so every autosave changed the
 * document, and every listener on it (the board, the patient page, any other
 * device) paid one read for it: about half of the reads a typed SOAP cost.
 * Typing in S, O or P changes none of the fields the card shows.
 *
 * `cached` is the patient as this device holds it; `fields` is what the save
 * would write, without the timestamps. True when any field differs, or when
 * there is no cached copy to compare with (then it writes, as before).
 * Values are compared as JSON: strings, numbers, arrays and plain objects.
 */
export function patientMetaChanged(
  cached: Readonly<Record<string, unknown>> | undefined,
  fields: Readonly<Record<string, unknown>>,
): boolean {
  if (!cached) return true;
  return Object.entries(fields).some(([key, value]) => JSON.stringify(cached[key] ?? null) !== JSON.stringify(value ?? null));
}
