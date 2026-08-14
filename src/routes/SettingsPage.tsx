import { useCallback, useState } from 'react';

import { AppShell } from '@/components/common/AppShell';
import { AliasEditor } from '@/components/settings/AliasEditor';
import { ChecklistEditor } from '@/components/settings/ChecklistEditor';
import { ClinicalDayEditor } from '@/components/settings/ClinicalDayEditor';
import { SettingsGroup, SettingsSection, Toggle } from '@/components/settings/SettingsSection';
import { StringListEditor } from '@/components/settings/StringListEditor';
import { DpjpFormatEditor } from '@/components/settings/DpjpFormatEditor';
import { TemplateEditor } from '@/components/settings/TemplateEditor';
import { PinSetupSheet } from '@/components/privacy/PinSetupSheet';
import { useLock } from '@/store/useLock';
import { updateSettings } from '@/data/repositories/settings.repo';
import {
  SEED_GREETINGS,
  SEED_NOTE_TEMPLATES,
  SEED_OPENING_SENTENCES,
} from '@/domain/defaults';
import {
  restoreMissing,
  restoreMissingStrings,
  restoredMessage,
} from '@/domain/restoreDefaults';
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
  const persistence = useSession((state) => state.storagePersistence);
  const settings = useSession((state) => state.settings());

  const pinEnabled = useLock((state) => state.pinEnabled);
  const removePin = useLock((state) => state.removePin);
  const lock = useLock((state) => state.lock);
  const [pinSetupOpen, setPinSetupOpen] = useState(false);
  const [restored, setRestored] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  /**
   * Puts back seeded entries that are missing, without touching the rest.
   *
   * Merging rather than replacing matters: someone who deleted one preset and
   * edited three others needs the missing one back, not their three edits
   * reverted. Restoring must never become a second way to lose work.
   */
  const announce = (count: number): void => {
    setRestored(restoredMessage(count));
    window.setTimeout(() => setRestored(null), 4000);
  };
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
        <SettingsGroup label="Sehari-hari" />

        <SettingsSection title="Tampilan" description="Mode gelap untuk jaga malam." defaultOpen>
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
          defaultOpen
        >
          <ChecklistEditor
            items={settings.checklistItems}
            onChange={(checklistItems) => patch({ checklistItems })}
          />
        </SettingsSection>

        <SettingsGroup label="Format laporan" />

        <SettingsSection
          title="Format catatan"
          description="Kerangka yang ditawarkan saat hari masih kosong. Sesuaikan dengan gaya laporan tiap DPJP."
        >
          <TemplateEditor
            templates={settings.noteTemplates}
            onChange={(noteTemplates) => patch({ noteTemplates })}
          />
          <RestoreButton
            onClick={() => {
              const { next, restored: count } = restoreMissing(
                settings.noteTemplates,
                SEED_NOTE_TEMPLATES,
                (template) => template.name,
              );
              if (count > 0) patch({ noteTemplates: next });
              announce(count);
            }}
          />
        </SettingsSection>

        <SettingsSection
          title="Salam"
          description="Pilihan salam yang bisa ditukar di catatan yang sudah jadi."
        >
          <StringListEditor
            values={settings.greetings}
            onChange={(greetings) => patch({ greetings })}
            placeholder="Selamat pagi dokter."
          />
          <RestoreButton
            onClick={() => {
              const { next, restored: count } = restoreMissingStrings(
                settings.greetings,
                SEED_GREETINGS,
              );
              if (count > 0) patch({ greetings: next });
              announce(count);
            }}
          />
        </SettingsSection>

        <SettingsSection
          title="Kalimat pembuka"
          description="Kerangka kalimat laporan. Ruang, kamar dan poli tetap diisi manual."
        >
          <StringListEditor
            multiline
            values={settings.openingSentences}
            onChange={(openingSentences) => patch({ openingSentences })}
            placeholder="Tabe dokter, mohon izin melaporkan…"
          />
          <RestoreButton
            onClick={() => {
              const { next, restored: count } = restoreMissingStrings(
                settings.openingSentences,
                SEED_OPENING_SENTENCES,
              );
              if (count > 0) patch({ openingSentences: next });
              announce(count);
            }}
          />
        </SettingsSection>

        <SettingsSection
          title="Format per DPJP"
          description="Pengingat format laporan yang diharapkan tiap konsulen."
        >
          <DpjpFormatEditor
            formats={settings.dpjpFormats}
            onChange={(dpjpFormats) => patch({ dpjpFormats })}
          />
        </SettingsSection>

        <SettingsSection
          title="Warna bagian catatan"
          description="Latar samar di belakang judul tiap bagian, untuk memindai posisi."
        >
          <Toggle
            label="Beri warna pada judul bagian"
            description="Identitas, S, O + penunjang, A, Terapi + Plan, dan TS masing-masing berbeda."
            checked={settings.sectionTint}
            onChange={(sectionTint) => patch({ sectionTint })}
          />
        </SettingsSection>

        <SettingsSection
          title="Bullet di WhatsApp"
          description="WhatsApp mengubah baris yang diawali “- ” menjadi daftar bulatnya sendiri."
        >
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['hyphen', 'Tanda hubung — jadi bullet di WA'],
                ['guarded', 'Tanda hubung — tetap “-” di WA'],
                ['bullet', 'Bulatan • langsung'],
              ] as Array<[typeof settings.whatsappBullet, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={settings.whatsappBullet === value}
                onClick={() => patch({ whatsappBullet: value })}
                className={[
                  'min-h-tap rounded-full border px-3 text-xs',
                  settings.whatsappBullet === value
                    ? 'border-accent bg-bg-subtle font-medium text-accent'
                    : 'border-border text-fg-muted',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-fg-faint">
            Pilihan pertama membiarkan WhatsApp membuat daftar bulatnya sendiri — ini yang
            dipakai untuk laporan. Pilihan kedua menyisipkan karakter tak terlihat agar
            tanda hubung tetap apa adanya, untuk tujuan selain WhatsApp.
          </p>
        </SettingsSection>

        <SettingsGroup label="Lanjutan" />

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

        <SettingsGroup label="Akun & data" />

        <SettingsSection title="Akun" defaultOpen>
          {persistence !== 'persisted' ? (
            <p className="mb-3 rounded-lg border border-border bg-bg-subtle p-3 text-[11px] leading-relaxed text-fg-muted">
              Penyimpanan browser di perangkat ini masih bisa dihapus otomatis saat memori
              menipis — itu yang membuat sesi tiba-tiba keluar. Pasang aplikasi ke layar
              utama (Bagikan → Tambah ke Layar Utama) agar sesi dan data offline bertahan.
            </p>
          ) : null}
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

        <SettingsSection title="Tentang" collapsible={false}>
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
        {restored ? (
          <p
            role="status"
            className="sticky bottom-4 rounded-lg border border-border bg-surface px-3 py-2 text-center text-xs text-fg-muted shadow-lg"
          >
            {restored}
          </p>
        ) : null}
      </div>

      <PinSetupSheet open={pinSetupOpen} onOpenChange={setPinSetupOpen} />
    </AppShell>
  );
}

/**
 * Deliberately quiet and always present, not shown only when something is
 * missing: noticing that a preset is gone is the hard part, and a button that
 * appears only once you have noticed is no help at all.
 */
function RestoreButton({ onClick }: { onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 min-h-tap text-xs text-accent underline"
    >
      Pulihkan format bawaan yang hilang
    </button>
  );
}
