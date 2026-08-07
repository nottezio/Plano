import { useCallback, useState } from 'react';

import { AppShell } from '@/components/common/AppShell';
import { AliasEditor } from '@/components/settings/AliasEditor';
import { ChecklistEditor } from '@/components/settings/ChecklistEditor';
import { ClinicalDayEditor } from '@/components/settings/ClinicalDayEditor';
import { SettingsSection, Toggle } from '@/components/settings/SettingsSection';
import { TemplateEditor } from '@/components/settings/TemplateEditor';
import { PinSetupSheet } from '@/components/privacy/PinSetupSheet';
import { useLock } from '@/store/useLock';
import { updateSettings } from '@/data/repositories/settings.repo';
import { downloadJson, exportAll } from '@/data/exportData';
import { FORMAT_LABELS } from '@/domain/format/formatters';
import { signOutAndClear, useSession } from '@/store/useSession';
import { useUI, type ThemePreference } from '@/store/useUI';
import { APP_VERSION } from '@/version.js';
import type { UserSettings } from '@/domain/types';

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'Ikuti sistem' },
  { value: 'light', label: 'Terang' },
  { value: 'dark', label: 'Gelap' },
];

export default function SettingsPage(): JSX.Element {
  const theme = useUI((state) => state.theme);
  const setTheme = useUI((state) => state.setTheme);
  const user = useSession((state) => state.user);
  const settings = useSession((state) => state.settings());

  const pinEnabled = useLock((state) => state.pinEnabled);
  const removePin = useLock((state) => state.removePin);
  const lock = useLock((state) => state.lock);
  const [pinSetupOpen, setPinSetupOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  /**
   * Every change writes immediately, by dotted path.
   *
   * There is no Save button anywhere in this app, and Settings is no exception:
   * a screen that saves on tap and a screen that saves on a button are two
   * different mental models, and mixing them is how a user loses a change they
   * believed was applied. Patching by path also means two devices editing
   * different settings do not overwrite each other.
   */
  const patch = useCallback(
    (next: Partial<UserSettings>) => {
      if (!user) return;
      void updateSettings(user.uid, next).catch((error: unknown) =>
        console.error('[settings] write rejected', error),
      );
    },
    [user],
  );

  const onExport = (): void => {
    if (!user) return;
    setExporting(true);
    setExportError(null);
    void exportAll(user.uid)
      .then(downloadJson)
      .catch((error: unknown) => {
        console.error('[settings] export failed', error);
        setExportError('Ekspor gagal. Coba lagi saat daring.');
      })
      .finally(() => setExporting(false));
  };

  return (
    <AppShell title="Pengaturan">
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        <SettingsSection title="Tampilan" description="Mode gelap untuk jaga malam.">
          <div className="flex gap-2">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                aria-pressed={theme === option.value}
                className={[
                  'min-h-tap flex-1 rounded-lg border px-3 text-sm',
                  theme === option.value
                    ? 'border-accent bg-bg-subtle font-medium text-accent'
                    : 'border-border text-fg-muted',
                ].join(' ')}
              >
                {option.label}
              </button>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          title="Checklist harian"
          description="Tambah, ubah nama, warna, urutan, atau nonaktifkan. Jumlah langkah bebas."
        >
          <ChecklistEditor
            items={settings.checklistItems}
            onChange={(checklistItems) => patch({ checklistItems })}
          />
        </SettingsSection>

        <SettingsSection
          title="Format catatan"
          description="Kerangka yang ditawarkan saat hari masih kosong. Sesuaikan dengan gaya laporan tiap DPJP."
        >
          <TemplateEditor
            templates={settings.noteTemplates}
            onChange={(noteTemplates) => patch({ noteTemplates })}
          />
        </SettingsSection>

        <SettingsSection
          title="Hari klinis"
          description="Menentukan catatan hari ini masuk ke tanggal mana."
        >
          <ClinicalDayEditor settings={settings} onChange={patch} />
        </SettingsSection>

        <SettingsSection
          title="Bagian catatan"
          description="Kata kunci yang dikenali sebagai header. Catatan lama ikut terbaca ulang, tanpa mengubah teks tersimpan."
        >
          <AliasEditor
            aliases={settings.sectionAliases}
            onChange={(sectionAliases) => patch({ sectionAliases })}
          />
        </SettingsSection>

        <SettingsSection
          title="Preset salin"
          description="Pilihan cepat di lembar salin."
        >
          <ul className="space-y-2">
            {settings.copyPresets.map((preset) => (
              <li key={preset.id} className="rounded-lg border border-border p-2">
                <input
                  type="text"
                  value={preset.name}
                  onChange={(event) =>
                    patch({
                      copyPresets: settings.copyPresets.map((candidate) =>
                        candidate.id === preset.id
                          ? { ...candidate, name: event.target.value }
                          : candidate,
                      ),
                    })
                  }
                  className="min-h-tap w-full rounded-lg border border-transparent bg-transparent px-2 text-sm font-medium outline-none focus:border-border"
                />
                <div className="mt-1 flex flex-wrap gap-2 px-2">
                  {(Object.keys(FORMAT_LABELS) as Array<keyof typeof FORMAT_LABELS>).map(
                    (format) => (
                      <button
                        key={format}
                        type="button"
                        aria-pressed={preset.format === format}
                        onClick={() =>
                          patch({
                            copyPresets: settings.copyPresets.map((candidate) =>
                              candidate.id === preset.id
                                ? { ...candidate, format }
                                : candidate,
                            ),
                          })
                        }
                        className={[
                          'min-h-tap rounded-full border px-3 text-[11px]',
                          preset.format === format
                            ? 'border-accent font-medium text-accent'
                            : 'border-border text-fg-muted',
                        ].join(' ')}
                      >
                        {FORMAT_LABELS[format]}
                      </button>
                    ),
                  )}
                </div>
                <div className="mt-1 px-2">
                  <Toggle
                    label="Sertakan identitas pasien"
                    checked={preset.includeIdentity}
                    onChange={(includeIdentity) =>
                      patch({
                        copyPresets: settings.copyPresets.map((candidate) =>
                          candidate.id === preset.id
                            ? { ...candidate, includeIdentity }
                            : candidate,
                        ),
                      })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        </SettingsSection>

        <SettingsSection
          title="Privasi"
          description="Aplikasi ini menyimpan nama lengkap pasien."
        >
          <Toggle
            label="Papan hanya menampilkan inisial"
            description="Nama lengkap tetap tampil di halaman pasien."
            checked={settings.privacy.boardShowInitialsOnly}
            onChange={(boardShowInitialsOnly) =>
              patch({ privacy: { ...settings.privacy, boardShowInitialsOnly } })
            }
          />
          <Toggle
            label="Buramkan saat aplikasi di latar belakang"
            checked={settings.privacy.blurOnBackground}
            onChange={(blurOnBackground) =>
              patch({ privacy: { ...settings.privacy, blurOnBackground } })
            }
          />
          <Toggle
            label="Kunci dengan PIN"
            description="Diperlukan setelah aplikasi tidak digunakan beberapa menit."
            checked={pinEnabled}
            onChange={(next) => {
              // The PIN itself lives only on this device, so the toggle drives
              // local state; the Firestore flag records the intent across
              // devices without ever carrying the PIN.
              patch({ privacy: { ...settings.privacy, pinLockEnabled: next } });
              if (next) setPinSetupOpen(true);
              else removePin();
            }}
          />
          {pinEnabled ? (
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setPinSetupOpen(true)}
                className="min-h-tap flex-1 rounded-lg border border-border text-xs"
              >
                Ubah PIN
              </button>
              <button
                type="button"
                onClick={lock}
                className="min-h-tap flex-1 rounded-lg border border-border text-xs"
              >
                Kunci sekarang
              </button>
            </div>
          ) : null}
          <label className="mt-2 block">
            <span className="mb-1 block text-xs text-fg-muted">Kunci otomatis setelah</span>
            <select
              value={settings.privacy.autoLockMinutes}
              onChange={(event) =>
                patch({
                  privacy: {
                    ...settings.privacy,
                    autoLockMinutes: Number(event.target.value),
                  },
                })
              }
              className="min-h-tap w-full rounded-lg border border-border bg-surface px-2 text-sm"
            >
              {[1, 3, 5, 10, 30].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} menit
                </option>
              ))}
            </select>
          </label>
        </SettingsSection>

        <SettingsSection title="Keterbukaan data">
          <p className="text-xs leading-relaxed text-fg-muted">
            Aplikasi ini menyimpan nama lengkap, nomor rekam medis, dan isi catatan pasien di
            Google Firestore serta di penyimpanan peramban perangkat ini. Data tidak
            dienkripsi ujung-ke-ujung: penyedia layanan secara teknis dapat mengaksesnya.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-fg-muted">
            Anda bertanggung jawab atas kepatuhan terhadap kebijakan rumah sakit dan UU
            Perlindungan Data Pribadi No. 27/2022. Tidak ada pelacakan, analitik, atau
            layanan pihak ketiga selain Firebase.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-fg-muted">
            PIN hanya menutup layar; ia bukan enkripsi dan bukan pengganti kunci layar
            perangkat.
          </p>
        </SettingsSection>

        <SettingsSection
          title="Ekspor data"
          description="Seluruh pasien, catatan, checklist, dan dokumen sebagai satu berkas JSON."
        >
          <p className="text-xs text-fg-muted">
            Berkas berisi nama lengkap pasien dan isi catatan tanpa enkripsi. Simpan di tempat
            yang Anda kendalikan.
          </p>
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="mt-2 min-h-tap w-full rounded-lg border border-border px-4 text-sm font-medium disabled:opacity-50"
          >
            {exporting ? 'Menyiapkan…' : 'Unduh JSON'}
          </button>
          {exportError ? (
            <p role="alert" className="mt-2 text-xs text-danger">
              {exportError}
            </p>
          ) : null}
        </SettingsSection>

        <SettingsSection title="Akun">
          <p className="truncate text-xs text-fg-muted">{user?.email ?? '—'}</p>
          <button
            type="button"
            onClick={() => void signOutAndClear()}
            className="mt-3 min-h-tap w-full rounded-lg border border-border px-3 text-sm text-danger"
          >
            Keluar
          </button>
          <p className="mt-2 text-[11px] text-fg-faint">
            Keluar menghapus seluruh data offline di perangkat ini dan memuat ulang aplikasi.
          </p>
        </SettingsSection>

        <SettingsSection title="Tentang">
          <dl className="space-y-1 text-xs text-fg-muted">
            <div className="flex justify-between gap-4">
              <dt>Versi aplikasi</dt>
              <dd className="font-mono">{APP_VERSION}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Pemilik</dt>
              <dd>Avicenna</dd>
            </div>
          </dl>
        </SettingsSection>
      </div>

      <PinSetupSheet open={pinSetupOpen} onOpenChange={setPinSetupOpen} />
    </AppShell>
  );
}
