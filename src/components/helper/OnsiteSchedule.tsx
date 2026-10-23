import { DPJPS } from '@/domain/dpjp';
import {
  DEFAULT_ONSITE_IGD,
  ONSITE_IGD_HOURS,
  WEEKDAYS,
  WEEKDAY_LABEL,
  type OnsiteDay,
  type OnsiteSchedule,
} from '@/domain/jaga/onsite';
import { updateSettings } from '@/data/repositories/settings.repo';
import { useSession } from '@/store/useSession';

/**
 * Jadwal DPJP Onsite IGD, editable (12.5). One row per weekday: who, and
 * whether the MALAM team's Formasi carries the line as well.
 *
 * Each change writes ONE weekday leaf (`settings.onsiteIgd.<day>`, merged by
 * `updateSettings`), never the whole map, so two devices editing different
 * days cannot overwrite each other.
 */
export function OnsiteScheduleEditor({ schedule }: { schedule: OnsiteSchedule }): JSX.Element {
  const uid = useSession((s) => s.user?.uid ?? null);

  const write = (day: string, next: OnsiteDay): void => {
    if (uid) void updateSettings(uid, { onsiteIgd: { [day]: next } });
  };

  const isDefault = WEEKDAYS.every(
    (day) =>
      schedule[day]?.id === DEFAULT_ONSITE_IGD[day]?.id && schedule[day]?.malam === DEFAULT_ONSITE_IGD[day]?.malam,
  );

  // Monday first, as the rota is read.
  const order = [...WEEKDAYS.slice(1), WEEKDAYS[0]];

  return (
    <details className="rounded-xl border border-border px-3 text-xs">
      <summary className="flex min-h-tap cursor-pointer items-center font-medium text-fg-muted">
        Jadwal DPJP Onsite IGD ({ONSITE_IGD_HOURS})
      </summary>
      <div className="space-y-2 pb-3">
        <ul className="space-y-1.5">
          {order.map((day) => {
            const entry = schedule[day] ?? { id: '', malam: false };
            const label = WEEKDAY_LABEL[day] ?? day;
            return (
              <li key={day} className="flex flex-wrap items-center gap-2">
                <span className="w-14 shrink-0 font-medium">{label}</span>
                <select
                  aria-label={`DPJP Onsite ${label}`}
                  value={entry.id}
                  onChange={(event) => write(day, { ...entry, id: event.target.value })}
                  className="min-h-tap min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-xs"
                >
                  <option value="">— tidak ada —</option>
                  {DPJPS.map((dpjp) => (
                    <option key={dpjp.id} value={dpjp.id}>
                      {dpjp.initials} — {dpjp.name}
                    </option>
                  ))}
                </select>
                <label className="flex min-h-tap items-center gap-1.5 text-fg-muted">
                  <input
                    type="checkbox"
                    checked={entry.malam}
                    disabled={!entry.id}
                    onChange={(event) => write(day, { ...entry, malam: event.target.checked })}
                  />
                  Tim malam juga
                </label>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex-1 text-xs text-fg-faint">Tersimpan di akun; berlaku untuk semua perangkat.</p>
          {!isDefault && (
            <button
              type="button"
              className="min-h-tap rounded-lg px-2 text-xs font-medium text-accent"
              onClick={() => {
                if (uid) void updateSettings(uid, { onsiteIgd: { ...DEFAULT_ONSITE_IGD } });
              }}
            >
              Kembalikan jadwal awal
            </button>
          )}
        </div>
      </div>
    </details>
  );
}
