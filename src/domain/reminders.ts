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

export function activeReminders(
  patient: Pick<Patient, 'reminders' | 'reminderDone' | 'ekgHarian' | 'ekgFor'>,
  kinds: readonly ReminderKind[],
  today: ClinicalDate,
): ActiveReminder[] {
  const done = patient.reminderDone?.date === today ? new Set(patient.reminderDone.ids) : new Set<string>();
  return kinds.flatMap((kind) => {
    const mode = reminderMode(patient, kind.id, today);
    return mode ? [{ id: kind.id, label: kind.label, mode, done: done.has(kind.id) }] : [];
  });
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
