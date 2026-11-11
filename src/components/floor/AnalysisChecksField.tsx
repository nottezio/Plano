import { updateSettings } from '@/data/repositories/settings.repo';
import type { UserSettings } from '@/domain/types';
import { useSession } from '@/store/useSession';

type Check = keyof NonNullable<UserSettings['analysisChecks']>;

const CHECKS: ReadonlyArray<{ key: Check; label: string; hint: string }> = [
  { key: 'belumSoap', label: 'Belum SOAP hari ini', hint: 'Pasien yang diikuti lantai tanpa SOAP bertanggal hari ini.' },
  { key: 'terlewat', label: 'Rencana pulang terlewat', hint: 'Pasien yang masih di lantai setelah tanggal rencana pulangnya (H-1 atau pulang yang tidak jadi).' },
  { key: 'usulLama', label: 'Usul H-1 terlalu lama', hint: 'Usul H-1 yang sudah sehari atau lebih ditandai warna peringatan, sebagai pengingat bertanya ke DPJP.' },
];

/**
 * The three Analisis checks (11 Nov 2026, Avi: "a setting in Setelan to enable
 * or disable it"). Saved in the user's account (`settings.analysisChecks`),
 * like the list order: the same on every device, and one person's choice does
 * not hide them for the rest of the floor. One small write per tap, to the
 * user's own document.
 */
export function AnalysisChecksField(): JSX.Element {
  const uid = useSession((s) => s.user?.uid ?? null);
  const saved = useSession((s) => s.profile?.settings?.analysisChecks);
  return (
    <div className="space-y-2">
      {CHECKS.map(({ key, label, hint }) => (
        <label key={key} className="flex min-h-8 items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={saved?.[key] !== false}
            disabled={!uid}
            onChange={(e) => {
              if (uid) void updateSettings(uid, { analysisChecks: { ...saved, [key]: e.target.checked } });
            }}
          />
          <span>
            {label}
            <span className="block text-xs text-fg-muted">{hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
