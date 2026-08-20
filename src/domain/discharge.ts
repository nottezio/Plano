import { addDays, daysBetween } from './clinicalDate';
import type { ClinicalDate, Patient } from './types';

/**
 * Discharge planning, stored as a DATE rather than a stage.
 *
 * The first version stored `'h1' | 'today'` — a stage. That is a fact about
 * today which silently becomes wrong tomorrow: a patient marked H-1 on Monday
 * still reads "H-1" on Tuesday, when they should read "pulang hari ini", and on
 * Wednesday when they have already gone home.
 *
 * A date does not go stale. `plannedFor` is the day the patient is expected to
 * leave; everything shown is derived from it against the current clinical day,
 * so the board is correct every morning without anyone re-marking anything.
 */

export type DischargeStage =
  /** Two or more days away — planned, not imminent. */
  | 'planned'
  /** Tomorrow. */
  | 'h1'
  /** Today. */
  | 'today'
  /** The planned day has passed and the patient is still admitted. */
  | 'overdue';

export function dischargeStage(
  plannedFor: ClinicalDate | undefined,
  today: ClinicalDate,
): DischargeStage | null {
  if (!plannedFor) return null;

  const days = daysBetween(today, plannedFor);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'h1';
  return 'planned';
}

export const STAGE_LABELS: Record<DischargeStage, string> = {
  planned: 'Rencana pulang',
  h1: 'H-1',
  today: 'PULANG',
  // Named as a question rather than an accusation: the usual cause is that the
  // date moved, not that anyone forgot.
  overdue: 'Pulang?',
};

/** Token driving the card edge and badge colour. */
export const STAGE_TOKEN: Record<DischargeStage, string> = {
  planned: 'var(--discharge-planned)',
  h1: 'var(--discharge-h1)',
  today: 'var(--discharge-today)',
  overdue: 'var(--discharge-overdue)',
};

/**
 * The date a stage button should set.
 *
 * The UI still offers "H-1" and "pulang hari ini", because that is how the
 * decision is spoken — but each writes a date, so the meaning survives the
 * night.
 */
export function dateForStage(stage: 'h1' | 'today', today: ClinicalDate): ClinicalDate {
  return stage === 'today' ? today : addDays(today, 1);
}

/**
 * Reads the legacy `discharge` stage as a date, once.
 *
 * Anyone who marked a patient before this change has a stage and no date.
 * Interpreting it against the day it is READ would be wrong — a patient marked
 * H-1 last week is not going home tomorrow — so it resolves to today for
 * `today` and tomorrow for `h1`, and the next real edit replaces it. That is
 * the least-wrong reading available without a timestamp we never stored.
 */
export function migrateLegacyDischarge(
  patient: Pick<Patient, 'discharge' | 'dischargePlannedFor'>,
  today: ClinicalDate,
): ClinicalDate | undefined {
  if (patient.dischargePlannedFor) return patient.dischargePlannedFor;
  if (!patient.discharge) return undefined;
  return dateForStage(patient.discharge, today);
}
