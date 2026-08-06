import { sortedAliases } from '@/domain/sections/aliases';
import type { SectionAlias, SectionId, UserSettings } from '@/domain/types';
import { Toggle } from './SettingsSection';

/**
 * Common Indonesian zones first; the full IANA list follows when the browser
 * exposes it. A free-text field here would let a typo silently move every
 * clinical date by hours.
 */
function timezones(): string[] {
  const preferred = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'];
  const all =
    typeof Intl.supportedValuesOf === 'function'
      ? (Intl.supportedValuesOf('timeZone') as string[])
      : [];
  return [...preferred, ...all.filter((zone) => !preferred.includes(zone))];
}

export function ClinicalDayEditor({
  settings,
  onChange,
}: {
  settings: UserSettings;
  onChange: (patch: Partial<UserSettings>) => void;
}): JSX.Element {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs text-fg-muted">Zona waktu</span>
        <select
          value={settings.timezone}
          onChange={(event) => onChange({ timezone: event.target.value })}
          className="min-h-tap w-full rounded-lg border border-border bg-surface px-2 text-sm"
        >
          {timezones().map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-fg-muted">Jam pergantian hari</span>
        <select
          value={settings.dayRolloverHour}
          onChange={(event) => onChange({ dayRolloverHour: Number(event.target.value) })}
          className="min-h-tap w-full rounded-lg border border-border bg-surface px-2 text-sm"
        >
          {Array.from({ length: 24 }, (_, hour) => (
            <option key={hour} value={hour}>
              {String(hour).padStart(2, '0')}:00
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[11px] text-fg-faint">
          Catatan yang ditulis sebelum jam ini masuk ke tanggal sebelumnya. Mengubahnya tidak
          memindahkan catatan yang sudah ada.
        </span>
      </label>

      <Toggle
        label="Salin dari hari sebelumnya"
        description="Menawarkan salinan catatan kemarin saat hari baru masih kosong."
        checked={settings.carryForwardOnNewDay}
        onChange={(next) => onChange({ carryForwardOnNewDay: next })}
      />

      <div>
        <span className="mb-1 block text-xs text-fg-muted">Bagian yang dikosongkan</span>
        <div className="flex flex-wrap gap-2">
          {sortedAliases([...settings.sectionAliases]).map((alias: SectionAlias) => {
            const active = settings.carryForwardClearSections.includes(alias.sectionId);
            return (
              <button
                key={alias.sectionId}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange({
                    carryForwardClearSections: active
                      ? settings.carryForwardClearSections.filter(
                          (id) => id !== alias.sectionId,
                        )
                      : ([...settings.carryForwardClearSections, alias.sectionId] as SectionId[]),
                  })
                }
                className={[
                  'min-h-tap rounded-full border px-3 text-xs',
                  active
                    ? 'border-accent bg-bg-subtle font-medium text-accent'
                    : 'border-border text-fg-muted',
                ].join(' ')}
              >
                {alias.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-fg-faint">
          Keluhan dan hasil penunjang lama terbaca sebagai temuan hari ini bila ikut tersalin.
        </p>
      </div>
    </div>
  );
}
