import { DPJPS, REPORT_FORMAT_LABELS } from '@/domain/dpjp';
import type { ReportFormat } from '@/domain/types';

/**
 * Which report shape each consultant expects.
 *
 * The whole list is shown rather than only the ones with a binding, because
 * the useful question is "what does this person want", and a list of exceptions
 * cannot answer it — you would have to know the answer already to know whether
 * to look.
 *
 * Unset means the standard daily handover, so the map stored underneath only
 * ever holds the exceptions.
 */
const OPTIONS: ReportFormat[] = ['harian', 'diagnosis', 'ringkas'];

export function DpjpFormatEditor({
  formats,
  onChange,
}: {
  formats: Record<string, ReportFormat>;
  onChange: (next: Record<string, ReportFormat>) => void;
}): JSX.Element {
  const set = (id: string, value: ReportFormat): void => {
    const next = { ...formats };
    // `harian` is the default, so storing it would be storing a non-exception.
    if (value === 'harian') delete next[id];
    else next[id] = value;
    onChange(next);
  };

  return (
    <div>
      <ul className="space-y-2">
        {DPJPS.map((dpjp) => (
          <li key={dpjp.id} className="rounded-lg border border-border p-2">
            <div className="flex items-start gap-2">
              <span className="mt-1 shrink-0 rounded border border-border px-1 text-[10px] font-semibold text-fg-muted">
                {dpjp.initials}
              </span>
              <span className="min-w-0 flex-1 text-xs leading-relaxed">{dpjp.name}</span>
            </div>
            <select
              value={formats[dpjp.id] ?? 'harian'}
              onChange={(event) => set(dpjp.id, event.target.value as ReportFormat)}
              className="mt-2 min-h-tap w-full rounded-lg border border-border bg-surface px-2 text-sm"
            >
              {OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {REPORT_FORMAT_LABELS[option]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[11px] text-fg-faint">
        Plano membaca nama DPJP dari baris <code>DPJP</code> di catatan, lalu mengingatkan
        format yang diharapkan saat menyalin. Tidak ada yang diubah otomatis.
      </p>
    </div>
  );
}
