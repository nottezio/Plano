import { setPatientReminder } from '@/data/repositories/patients.repo';
import { DEFAULT_REMINDER_KINDS, reminderMode } from '@/domain/reminders';
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
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-sm font-medium">Pengingat harian</p>
      <p className="text-xs text-fg-muted">
        Muncul di kartu pasien dan bisa dicentang saat selesai. "Hari ini" hilang sendiri besok.
      </p>
      <ul className="mt-2 space-y-1.5">
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
            <li key={kind.id} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">{kind.label}</span>
              <span role="group" aria-label={kind.label} className="flex overflow-hidden rounded-lg border border-border text-xs">
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
                        'min-h-tap px-2.5 [@media(pointer:fine)]:min-h-8',
                        on ? 'bg-accent font-semibold text-white' : 'text-fg-muted',
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
    </div>
  );
}
