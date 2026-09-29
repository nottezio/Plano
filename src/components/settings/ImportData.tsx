import { useRef, useState } from 'react';

import { prepareImport, runImport } from '@/data/importData';
import { parseBundle, type ImportPlan } from '@/domain/importBundle';

type State =
  | { phase: 'idle' }
  | { phase: 'reading' }
  | { phase: 'ready'; plan: ImportPlan; fileName: string }
  | { phase: 'running'; done: number; total: number }
  | { phase: 'done'; plan: ImportPlan; failed: string[] }
  | { phase: 'error'; message: string };

/**
 * Settings → Impor: bring a Plano export into this account.
 *
 * Shown as a preview first (what is in the file, what is already here and
 * will be skipped), because an import cannot be undone by a button: it only
 * ADDS, never overwrites, but what it adds stays.
 */
export function ImportData({ uid }: { uid: string }): JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [withProfile, setWithProfile] = useState(true);
  const [replaceSettings, setReplaceSettings] = useState(false);

  const onFile = async (file: File): Promise<void> => {
    setState({ phase: 'reading' });
    if (!navigator.onLine) {
      setState({ phase: 'error', message: 'Impor butuh koneksi internet. Coba lagi saat daring.' });
      return;
    }
    const parsed = parseBundle(await file.text());
    if (!parsed.ok) {
      setState({ phase: 'error', message: parsed.error });
      return;
    }
    try {
      const plan = await prepareImport(uid, parsed.bundle);
      setState({ phase: 'ready', plan, fileName: file.name });
    } catch (error) {
      console.error('[import] prepare failed', error);
      setState({ phase: 'error', message: 'Tidak bisa membaca data akun ini. Periksa koneksi, lalu coba lagi.' });
    }
  };

  const start = (plan: ImportPlan): void => {
    setState({ phase: 'running', done: 0, total: 1 });
    void runImport(uid, plan, { profile: withProfile, replaceSettings }, ({ done, total }) =>
      setState({ phase: 'running', done, total }),
    ).then(({ failed }) => setState({ phase: 'done', plan, failed }));
  };

  const when = (iso: string): string =>
    iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  return (
    <div className="space-y-2 text-xs">
      <p className="text-fg-muted">
        Untuk pindah akun, akun hilang, atau mulai ulang: pilih berkas hasil "Unduh JSON". Impor
        hanya <strong>menambah</strong>; pasien, dokumen, dan catatan yang sudah ada di akun ini tidak
        ditimpa, dan mengimpor berkas yang sama dua kali tidak membuat duplikat.
      </p>

      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void onFile(file);
        }}
      />

      {state.phase === 'idle' || state.phase === 'error' || state.phase === 'done' ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="min-h-tap w-full rounded-lg border border-border px-4 text-sm font-medium"
        >
          Pilih berkas ekspor…
        </button>
      ) : null}

      {state.phase === 'reading' ? <p className="text-fg-muted">Membaca berkas…</p> : null}
      {state.phase === 'error' ? (
        <p role="alert" className="text-danger">
          {state.message}
        </p>
      ) : null}

      {state.phase === 'ready' ? (
        <div className="space-y-2 rounded-lg border border-border bg-bg-subtle p-3">
          <p className="font-medium text-fg">{state.fileName}</p>
          <p className="text-fg-muted">
            Diekspor {when(state.plan.exportedAt)}
            {state.plan.appVersion ? ` · v${state.plan.appVersion}` : ''}
          </p>
          <ul className="grid grid-cols-2 gap-1 text-fg">
            <li>{state.plan.counts.patients} pasien baru</li>
            <li>{state.plan.counts.entries} catatan harian</li>
            <li>{state.plan.counts.checklists} checklist harian</li>
            <li>{state.plan.counts.documents} dokumen</li>
          </ul>
          {state.plan.skippedPatients.length > 0 || state.plan.skippedDocuments > 0 ? (
            <p className="text-fg-muted">
              Dilewati karena sudah ada: {state.plan.skippedPatients.length} pasien,{' '}
              {state.plan.skippedDocuments} dokumen.
            </p>
          ) : null}
          {Object.keys(state.plan.profile).length > 0 ? (
            <div className="space-y-1">
              <label className="flex min-h-tap items-center gap-2">
                <input type="checkbox" checked={withProfile} onChange={(event) => setWithProfile(event.target.checked)} />
                Tambahkan Catatan, catatan papan, dan checklist dari berkas
              </label>
              <label className="flex min-h-tap items-center gap-2">
                <input
                  type="checkbox"
                  checked={replaceSettings}
                  disabled={!withProfile}
                  onChange={(event) => setReplaceSettings(event.target.checked)}
                />
                Ganti pengaturan akun ini dengan pengaturan di berkas
              </label>
            </div>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setState({ phase: 'idle' })}
              className="min-h-tap flex-1 rounded-lg border border-border px-3 text-sm"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => start(state.plan)}
              className="min-h-tap flex-1 rounded-lg bg-accent px-3 text-sm font-medium text-white"
            >
              Impor
            </button>
          </div>
        </div>
      ) : null}

      {state.phase === 'running' ? (
        <p className="font-medium" aria-live="polite">
          Mengimpor {state.done}/{state.total}… Jangan tutup aplikasi.
        </p>
      ) : null}

      {state.phase === 'done' ? (
        <p role="status" className={state.failed.length > 0 ? 'text-danger' : 'text-fg'}>
          {state.failed.length > 0
            ? `Selesai sebagian. Gagal: ${state.failed.join(', ')}. Impor berkas yang sama lagi untuk melanjutkan; yang sudah masuk dilewati.`
            : `Selesai: ${state.plan.counts.patients} pasien, ${state.plan.counts.entries} catatan, ${state.plan.counts.documents} dokumen ditambahkan.`}
        </p>
      ) : null}
    </div>
  );
}
