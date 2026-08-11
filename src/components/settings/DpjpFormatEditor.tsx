import { DPJPS, REPORT_FORMAT_LABELS } from '@/domain/dpjp';
import type { DpjpReportConfig, ReportFormat } from '@/domain/types';
import { Toggle } from './SettingsSection';

/**
 * Which report each consultant expects.
 *
 * The whole list is shown rather than only the ones with a binding, because the
 * useful question is "what does this person want" — and a list of exceptions
 * cannot answer it, since you would need to know the answer already to know
 * whether to look.
 *
 * The two switches appear only for the short PDF form, which is the only shape
 * they change. Showing them everywhere would offer settings that do nothing.
 */
const OPTIONS: ReportFormat[] = ['harian', 'diagnosis', 'ringkas'];

export function DpjpFormatEditor({
  formats,
  onChange,
}: {
  formats: Record<string, DpjpReportConfig>;
  onChange: (next: Record<string, DpjpReportConfig>) => void;
}): JSX.Element {
  const set = (id: string, patch: Partial<DpjpReportConfig>): void => {
    const current = formats[id] ?? { format: 'harian' as ReportFormat };
    const next = { ...formats, [id]: { ...current, ...patch } };

    // The plain daily handover with no extras is the default, so storing it
    // would be storing a non-exception. The map holds only what differs.
    const merged = next[id];
    if (
      merged &&
      merged.format === 'harian' &&
      !merged.verificationTime &&
      merged.staffing !== false &&
      !merged.hint
    ) {
      delete next[id];
    }

    onChange(next);
  };

  return (
    <div>
      <ul className="space-y-2">
        {DPJPS.map((dpjp) => {
          const config = formats[dpjp.id];
          const format = config?.format ?? 'harian';

          return (
            <li key={dpjp.id} className="rounded-lg border border-border p-2">
              <div className="flex items-start gap-2">
                <span className="mt-1 shrink-0 rounded border border-border px-1 text-[10px] font-semibold text-fg-muted">
                  {dpjp.initials}
                </span>
                <span className="min-w-0 flex-1 text-xs leading-relaxed">{dpjp.name}</span>
              </div>

              <select
                value={format}
                onChange={(event) =>
                  set(dpjp.id, { format: event.target.value as ReportFormat })
                }
                className="mt-2 min-h-tap w-full rounded-lg border border-border bg-surface px-2 text-sm"
              >
                {OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {REPORT_FORMAT_LABELS[option]}
                  </option>
                ))}
              </select>

              {format === 'ringkas' ? (
                <div className="mt-1">
                  <Toggle
                    label="Sertakan baris Chief / Junior"
                    checked={config?.staffing !== false}
                    onChange={(staffing) => set(dpjp.id, { staffing })}
                  />
                  <Toggle
                    label="Sertakan jam verifikasi"
                    checked={Boolean(config?.verificationTime)}
                    onChange={(verificationTime) => set(dpjp.id, { verificationTime })}
                  />
                </div>
              ) : null}

              <input
                type="text"
                value={config?.hint ?? ''}
                placeholder="Catatan (mis. kirim via Telegram)"
                onChange={(event) => set(dpjp.id, { hint: event.target.value })}
                className="mt-1 min-h-tap w-full rounded-lg border border-border bg-surface px-2 text-xs outline-none"
              />
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-[11px] text-fg-faint">
        Plano membaca nama DPJP dari baris <code>DPJP</code> di catatan, lalu mengingatkan
        format yang diharapkan saat menyalin. Tidak ada yang diubah otomatis.
      </p>
    </div>
  );
}
