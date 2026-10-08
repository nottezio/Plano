import { setPatientReminder, updatePatient } from '@/data/repositories/patients.repo';
import { DateField } from '@/components/common/DateField';
import { addDays, formatShortDate } from '@/domain/clinicalDate';
import { DEFAULT_REMINDER_KINDS, procedureRuleFor, reminderMode } from '@/domain/reminders';
import type { Patient } from '@/domain/types';
import { useSession } from '@/store/useSession';

/**
 * Daily reminders for this patient: for each kind (EKG, Urine output, and
 * whatever was added in Pengaturan), Tidak / Hari ini / Setiap hari.
 *
 * One control per kind instead of the two EKG actions ("Tandai EKG hari
 * ini", "Tandai perlu EKG harian"), which covered one kind, closed the sheet
 * on every tap and did not show which state was on.
 */
export function ReminderPicker({ patient, today }: { patient: Patient; today: string }): JSX.Element {
  const kinds = useSession((state) => state.settings().reminderKinds) ?? DEFAULT_REMINDER_KINDS;
  return (
    // Title and explanation come from the surrounding Section (actions sheet).
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      <ul className="divide-y divide-border">
        {kinds.map((kind) => {
          const mode = reminderMode(patient, kind.id, today);
          const set = (next: 'off' | 'hari-ini' | 'harian'): void => {
            void setPatientReminder(
              patient.id,
              kind.id,
              next === 'hari-ini' ? { mode: 'hari-ini', date: today } : { mode: next },
            ).catch((error: unknown) => console.error('[actions] reminder rejected', error));
          };
          return (
            <li key={kind.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{kind.label}</span>
              <span role="group" aria-label={kind.label} className="flex rounded-xl border border-border bg-bg-subtle p-0.5 text-xs">
                {(
                  [
                    ['off', 'Tidak'],
                    ['hari-ini', 'Hari ini'],
                    ['harian', 'Setiap hari'],
                  ] as const
                ).map(([value, label]) => {
                  const on = (mode ?? 'off') === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set(value)}
                      className={[
                        'min-h-tap rounded-lg px-2.5 [@media(pointer:fine)]:min-h-8',
                        on ? 'bg-surface font-semibold text-fg shadow-sm ring-1 ring-border' : 'text-fg-muted hover:text-fg',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ul>
      <OperationDate patient={patient} />
    </div>
  );
}

/**
 * The planned operation date. For a consultant with a procedure rule (dr.
 * Nuralim Mallapasi: ICU post-op consult on H-1) the hint says when the
 * reminder will appear; for anyone else the date is simply recorded.
 */
function OperationDate({ patient }: { patient: Patient }): JSX.Element {
  const rule = procedureRuleFor(patient);
  const date = patient.operationFor;
  return (
    <div className="px-3 py-2">
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="min-w-0 flex-1 font-medium">Jadwal operasi (BTKV)</span>
        <DateField
          value={date ?? ''}
          allowEmpty
          ariaLabel="Jadwal operasi"
          onChange={(next) => {
            void updatePatient(patient.id, { operationFor: next || undefined }).catch((error: unknown) =>
              console.error('[actions] operation date rejected', error),
            );
          }}
          className="w-40"
        />
      </label>
      {date && rule ? (
        <p className="mt-1 text-xs text-fg-muted">
          {rule.label} muncul di kartu {formatShortDate(addDays(date, -rule.daysBefore))} (H-{rule.daysBefore}).
        </p>
      ) : rule ? (
        <p className="mt-1 text-xs text-fg-muted">DPJP ini: {rule.label.toLowerCase()} H-{rule.daysBefore} sebelum operasi.</p>
      ) : null}
    </div>
  );
}
