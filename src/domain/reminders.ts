import { addDays } from './clinicalDate';
import type { ClinicalDate, Patient } from './types';

/**
 * Daily reminders on the board card: "EKG hari ini", "Urine output", or
 * anything the user adds (GDS, balance cairan…).
 *
 * WHAT THEY ARE
 *
 * A reminder is attached to a PATIENT, as either a standing order ("setiap
 * hari": an arrhythmia patient who needs a tracing every day) or today only
 * ("hari ini": one decision about one day, which expires by itself because
 * it stores the date, not a boolean). On the card each shows as a chip that
 * can be TICKED for today; the tick belongs to the clinical date too, so it
 * clears itself tomorrow and the standing reminder is due again.
 *
 * The kinds are the user's own list (Pengaturan → Pengingat harian); EKG and
 * Urine output are the defaults. Everything is optional: a patient with no
 * reminders shows nothing.
 *
 * LEGACY: the EKG badge before this stored `ekgHarian` / `ekgFor`. Those are
 * still read for the `ekg` kind until a reminder is set through the new UI,
 * which clears them, so no card loses its mark in the upgrade.
 */
export interface ReminderKind {
  id: string;
  label: string;
}

export type ReminderSetting = { mode: 'harian' } | { mode: 'hari-ini'; date: ClinicalDate } | { mode: 'off' };

export const DEFAULT_REMINDER_KINDS: readonly ReminderKind[] = [
  { id: 'ekg', label: 'EKG' },
  { id: 'uo', label: 'Urine output' },
];

export interface ActiveReminder {
  id: string;
  label: string;
  mode: 'harian' | 'hari-ini';
  done: boolean;
}

/** The mode a patient has for one kind TODAY: 'harian', 'hari-ini' or null. */
export function reminderMode(
  patient: Pick<Patient, 'reminders' | 'ekgHarian' | 'ekgFor'>,
  kindId: string,
  today: ClinicalDate,
): 'harian' | 'hari-ini' | null {
  const setting = patient.reminders?.[kindId];
  if (setting) {
    if (setting.mode === 'harian') return 'harian';
    if (setting.mode === 'hari-ini') return setting.date === today ? 'hari-ini' : null;
    return null;
  }
  if (kindId === 'ekg') {
    if (patient.ekgHarian === true) return 'harian';
    if (patient.ekgFor === today) return 'hari-ini';
  }
  return null;
}

/**
 * Reminders that follow from a planned operation, per consultant.
 *
 * dr. Muhammad Nuralim Mallapasi's (MNM) BTKV patients go to ICU after
 * surgery and the ICU consult has to be done THE DAY BEFORE (Avi,
 * 2026-10-01). With an operation date on the patient (`operationFor`), the
 * card shows "Konsul ICU post-op" on H-1, tickable like any reminder. The
 * consultant is matched on ANY DPJP line (`dpjpIds`), because the BTKV
 * surgeon is often not the patient's main DPJP.
 */
export interface ProcedureRule {
  id: string;
  label: string;
  dpjpId: string;
  /** Days before the operation the reminder is due. */
  daysBefore: number;
}

export const PROCEDURE_RULES: readonly ProcedureRule[] = [
  { id: 'icu-postop', label: 'Konsul ICU post-op', dpjpId: 'mnm', daysBefore: 1 },
];

export function procedureReminders(
  patient: Pick<Patient, 'operationFor' | 'dpjpId' | 'dpjpIds'>,
  today: ClinicalDate,
): Array<{ id: string; label: string }> {
  const date = patient.operationFor;
  if (!date) return [];
  const ids = new Set([...(patient.dpjpIds ?? []), ...(patient.dpjpId ? [patient.dpjpId] : [])]);
  return PROCEDURE_RULES.filter(
    (rule) => ids.has(rule.dpjpId) && addDays(date, -rule.daysBefore) === today,
  ).map((rule) => ({ id: rule.id, label: rule.label }));
}

/** The rule that applies to this patient, if any, for the picker's hint. */
export function procedureRuleFor(
  patient: Pick<Patient, 'dpjpId' | 'dpjpIds'>,
): ProcedureRule | null {
  const ids = new Set([...(patient.dpjpIds ?? []), ...(patient.dpjpId ? [patient.dpjpId] : [])]);
  return PROCEDURE_RULES.find((rule) => ids.has(rule.dpjpId)) ?? null;
}

export function activeReminders(
  patient: Pick<
    Patient,
    'reminders' | 'reminderDone' | 'ekgHarian' | 'ekgFor' | 'operationFor' | 'dpjpId' | 'dpjpIds'
  >,
  kinds: readonly ReminderKind[],
  today: ClinicalDate,
): ActiveReminder[] {
  const done = patient.reminderDone?.date === today ? new Set(patient.reminderDone.ids) : new Set<string>();
  const chosen = kinds.flatMap((kind) => {
    const mode = reminderMode(patient, kind.id, today);
    return mode ? [{ id: kind.id, label: kind.label, mode, done: done.has(kind.id) }] : [];
  });
  const procedures = procedureReminders(patient, today).map((rule) => ({
    id: rule.id,
    label: rule.label,
    mode: 'hari-ini' as const,
    done: done.has(rule.id),
  }));
  return [...procedures, ...chosen];
}

/** Today's ticks after toggling one; yesterday's ticks never carry over. */
export function toggleReminderDone(
  current: Patient['reminderDone'],
  id: string,
  today: ClinicalDate,
): { date: ClinicalDate; ids: string[] } {
  const ids = current?.date === today ? [...current.ids] : [];
  return { date: today, ids: ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id] };
}

/** A new kind's id from its label, unique among `kinds`. */
export function newReminderId(label: string, kinds: readonly ReminderKind[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || 'pengingat';
  let id = base;
  let n = 2;
  while (kinds.some((kind) => kind.id === id)) id = `${base}-${String(n++)}`;
  return id;
}
