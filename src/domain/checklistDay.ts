import { migrateLegacyDischarge } from './discharge';
import type { ChecklistItemDef, ClinicalDate, Patient } from './types';

/**
 * The checklist as it applies to ONE patient on ONE day.
 *
 * On the day a patient goes home some steps do not exist: there is no daily
 * "Order obat" for a patient whose discharge prescription is being written.
 * Showing it anyway left the card one step short of "Semua selesai" on every
 * discharge, and the board's colour and "Belum: Order obat" kept asking for
 * work that was never going to be done.
 *
 * Such steps are returned INACTIVE for that day, not removed: every function
 * downstream already treats an inactive step as "not part of today" while
 * keeping its history, so progress, colour, filters and the tick map all
 * follow without a second rule.
 */

/** Seed id of "Order obat" (see defaults.ts). */
const ORDER_OBAT_ID = 'c8';

/**
 * Whether a step is skipped on the discharge day. An explicit setting wins;
 * without one, the seeded "Order obat" step is skipped — profiles created
 * before the setting existed have it unset.
 */
export function skipsOnDischargeDay(item: ChecklistItemDef): boolean {
  return item.skipOnDischargeDay ?? item.id === ORDER_OBAT_ID;
}

/** The discharge fields, each possibly absent. */
export interface DischargeFields {
  discharge?: Patient['discharge'] | undefined;
  dischargePlannedFor?: ClinicalDate | undefined;
}

export function isDischargeDay(patient: DischargeFields, date: ClinicalDate, today: ClinicalDate): boolean {
  const fields: Pick<Patient, 'discharge' | 'dischargePlannedFor'> = {
    ...(patient.discharge ? { discharge: patient.discharge } : {}),
    ...(patient.dischargePlannedFor ? { dischargePlannedFor: patient.dischargePlannedFor } : {}),
  };
  return migrateLegacyDischarge(fields, today) === date;
}

export function itemsForPatientDay(
  items: readonly ChecklistItemDef[],
  patient: DischargeFields | null | undefined,
  date: ClinicalDate,
  today: ClinicalDate,
): readonly ChecklistItemDef[] {
  if (!patient || !isDischargeDay(patient, date, today)) return items;
  if (!items.some((item) => item.active && skipsOnDischargeDay(item))) return items;
  return items.map((item) =>
    item.active && skipsOnDischargeDay(item) ? { ...item, active: false } : item,
  );
}
