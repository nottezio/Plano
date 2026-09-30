import { useCallback, useState } from 'react';

import { AppShell } from '@/components/common/AppShell';
import { AliasEditor } from '@/components/settings/AliasEditor';
import { ChecklistEditor } from '@/components/settings/ChecklistEditor';
import { ClinicalDayEditor } from '@/components/settings/ClinicalDayEditor';
import {
  SettingsGroup,
  SettingsSearchProvider,
  SettingsSection,
  Toggle,
  openSettingsSection,
} from '@/components/settings/SettingsSection';
import { ReminderKindsEditor } from '@/components/settings/ReminderKindsEditor';
import { Changelog, changelogUnseen } from '@/components/settings/Changelog';
import { DEFAULT_REMINDER_KINDS } from '@/domain/reminders';
import { StringListEditor } from '@/components/settings/StringListEditor';
import { DpjpFormatEditor } from '@/components/settings/DpjpFormatEditor';
import { TemplateEditor } from '@/components/settings/TemplateEditor';
import { AiSettings } from '@/components/settings/AiSettings';
import { ReferenceRangeSettings } from '@/components/settings/ReferenceRanges';
import { PasteInspector } from '@/components/settings/PasteInspector';
import { RebuildCards } from '@/components/settings/RebuildCards';
import { SessionLogPanel } from '@/components/settings/SessionLogPanel';
import { PinSetupSheet } from '@/components/privacy/PinSetupSheet';
import { useLock } from '@/store/useLock';
import { updateSettings } from '@/data/repositories/settings.repo';
import type { SoapLayout, WatermarkMode } from '@/domain/types';
import {
  SEED_GREETINGS,
  SEED_NOTE_TEMPLATES,
  SEED_OPENING_SENTENCES,
  SEED_SNAPSHOT,
} from '@/domain/defaults';
import { outdatedTemplates, resetTemplateToSeed } from '@/domain/seedSync';
import {
  restoreMissing,
  restoreMissingStrings,
  restoredMessage,
} from '@/domain/restoreDefaults';
import { downloadJson, exportAll } from '@/data/exportData';
import { FORMAT_LABELS } from '@/domain/format/formatters';
import { useSession } from '@/store/useSession';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { resetSettings } from '@/data/repositories/settings.repo';
import { useUI, type ThemePreference } from '@/store/useUI';
import type { NoteTemplate } from '@/domain/types';
import { APP_VERSION } from '@/version.js';
import { UpdateControls } from '@/components/common/UpdateControls';
import { ImportData } from '@/components/settings/ImportData';
import { Link } from 'react-router-dom';
import { isAdmin } from '@/domain/access';
import type { UserSettings } from '@/domain/types';

const GROUPS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'settings-tampilan', label: 'Tampilan' },
  { id: 'settings-harian', label: 'Papan & harian' },
  { id: 'settings-laporan', label: 'Format laporan' },
  { id: 'settings-privasi', label: 'Privasi & data' },
  { id: 'settings-lanjutan', label: 'Lanjutan' },
  { id: 'settings-aplikasi', label: 'Akun & aplikasi' },
];

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
  /** Templates whose body no longer matches what this build ships. */
  const staleTemplates = outdatedTemplates(settings, SEED_SNAPSHOT);
  /**
   * Two-step confirm, in the button itself.
   *
   * This discards work, and unlike the checklist equivalent there is no
   * recovery path — a template is not versioned. One tap arms, the second
   * acts, and the armed label names the template so it cannot be mistaken for
   * a different one.
   */
  const [resetTemplateId, setResetTemplateId] = useState<string | null>(null);

  const pinEnabled = useLock((state) => state.pinEnabled);
  const removePin = useLock((state) => state.removePin);
  const lock = useLock((state) => state.lock);
  const [pinSetupOpen, setPinSetupOpen] = useState(false);
  const [restored, setRestored] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState('');
  /** Read once per visit: opening the section marks it seen for next time. */
  const [unseenChangelog] = useState(changelogUnseen);

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
      .then((bundle) => {
        downloadJson(bundle);
        // Say what is missing rather than claiming success. A partial export is
        // still worth having; a silent partial one is not.
        if (bundle.incomplete && bundle.incomplete.length > 0) {
          setExportError(
            `Terunduh, tetapi catatan ${bundle.incomplete.length} pasien tidak terbaca: ${bundle.incomplete.join(', ')}`,
          );
        }
      })
      .catch((error: unknown) => {
        console.error('[settings] export failed', error);
        setExportError(
          error instanceof Error
            ? `Ekspor gagal: ${error.message}`
            : 'Ekspor gagal. Coba lagi.',
        );
      })
      .finally(() => setExporting(false));
  };

  return (
    <AppShell title="Pengaturan">
      <SettingsSearchProvider query={query}>
      <div className="settings-list mx-auto w-full max-w-3xl px-4 pb-6">
        <SettingsToolbar query={query} onQuery={setQuery} unseen={unseenChangelog} />

        <p className="settings-empty rounded-xl border border-dashed border-border p-6 text-center text-sm text-fg-muted">
          Tidak ada pengaturan yang cocok dengan “{query}”.
        </p>

        <SettingsGroup id="settings-tampilan" label="Tampilan">
          <SettingsSection
            id="tema"
            keywords="tema mode gelap terang dark light warna" title="Tampilan" description="Mode gelap untuk jaga malam." defaultOpen>
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
            id="tata-letak"
            keywords="layout panel klasik soap"
            title="Tata letak halaman SOAP"
            description="Susunan panel di samping catatan."
          >
            <div className="flex gap-2">
              {(
                [
                  ['klasik', 'Klasik', 'Semua panel terbuka, urutan lama.'],
                  ['panel', 'Panel', 'Catatan · Checklist · Custom Checklist · Tanggal, semua mulai tertutup dengan ringkasan di judulnya.'],
                ] as Array<[SoapLayout, string, string]>
              ).map(([value, label, note]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => patch({ soapLayout: value })}
                  aria-pressed={(settings.soapLayout ?? 'klasik') === value}
                  className={[
                    'min-h-tap flex-1 rounded-lg border p-2 text-left text-sm',
                    (settings.soapLayout ?? 'klasik') === value
                      ? 'border-accent bg-bg-subtle text-accent'
                      : 'border-border text-fg-muted',
                  ].join(' ')}
                >
                  <span className="block font-medium">{label}</span>
                  <span className="mt-0.5 block text-[11px] text-fg-faint">{note}</span>
                </button>
              ))}
            </div>
          </SettingsSection>
          <SettingsSection
            id="warna-bagian"
            keywords="tint header warna"
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
            id="watermark"
            keywords="watermark nama rm ketebalan"
            title="Watermark di catatan"
            description="Nama, RM dan tanggal samar di belakang teks."
          >
            <Toggle
              label="Tampilkan watermark"
              description="Menyala secara default. Gunanya menahan salah pasien saat sudah menggulir jauh dari judul."
              checked={settings.showWatermark}
              onChange={(showWatermark) => patch({ showWatermark })}
            />
            {settings.showWatermark ? (
              <>
              <div className="mb-3 flex gap-2">
                {(
                  [
                    ['ulang', 'Berulang', 'Terlihat di sepanjang catatan.'],
                    ['mengambang', 'Mengambang', 'Satu tanda yang ikut bergulir.'],
                  ] as Array<[WatermarkMode, string, string]>
                ).map(([value, label, note]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => patch({ watermarkMode: value })}
                    aria-pressed={(settings.watermarkMode ?? 'ulang') === value}
                    className={[
                      'min-h-tap flex-1 rounded-lg border p-2 text-left text-sm',
                      (settings.watermarkMode ?? 'ulang') === value
                        ? 'border-accent bg-bg-subtle text-accent'
                        : 'border-border text-fg-muted',
                    ].join(' ')}
                  >
                    <span className="block font-medium">{label}</span>
                    <span className="mt-0.5 block text-[11px] text-fg-faint">{note}</span>
                  </button>
                ))}
              </div>
              <label className="mt-2 block text-[11px] text-fg-muted">
                Ketebalan watermark
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={Math.round(settings.watermarkOpacity * 100)}
                  onChange={(event) =>
                    patch({ watermarkOpacity: Number(event.target.value) / 100 })
                  }
                  className="mt-1 w-full"
                />
                <span className="text-fg-faint">
                  {Math.round(settings.watermarkOpacity * 100)}%
                </span>
              </label>
              </>
            ) : null}
          </SettingsSection>
          <SettingsSection
            id="hari-rawat"
            keywords="hari rawat judul"
            title="Hari rawat di judul catatan"
            description="Angka hari rawat sudah terlihat di rel tanggal; ini menambahkannya di judul juga."
          >
            <Toggle
              label="Tampilkan “Hari rawat ke-N”"
              description="Mati secara default. Nyalakan bila dokter tertentu meminta angkanya di laporan."
              checked={settings.showHariRawat}
              onChange={(showHariRawat) => patch({ showHariRawat })}
            />
          </SettingsSection>
        </SettingsGroup>

        <SettingsGroup id="settings-harian" label="Papan & harian">
          <SettingsSection
            id="checklist"
            keywords="checklist centang langkah visite"
            title="Checklist harian"
            description="Tambah, ubah nama, warna, urutan, atau nonaktifkan. Jumlah langkah bebas."
          >
            <ChecklistEditor
              items={settings.checklistItems}
              onChange={(checklistItems) => patch({ checklistItems })}
            />
          </SettingsSection>
          <SettingsSection
            id="pengingat"
            title="Pengingat harian"
            description="Penanda di kartu pasien: EKG, urine output, atau buatan sendiri. Bisa dicentang."
            keywords="pengingat reminder ekg urine output uo flag penanda"
          >
            <ReminderKindsEditor
              kinds={settings.reminderKinds ?? DEFAULT_REMINDER_KINDS}
              onChange={(reminderKinds) => patch({ reminderKinds })}
            />
          </SettingsSection>
          <SettingsSection
            id="hari-klinis"
            keywords="tanggal pergantian hari jam jaga malam"
            title="Hari klinis"
            description="Menentukan catatan hari ini masuk ke tanggal mana."
          >
            <ClinicalDayEditor settings={settings} onChange={patch} />
          </SettingsSection>
        </SettingsGroup>

        <SettingsGroup id="settings-laporan" label="Format laporan">
          <SettingsSection
            id="format-catatan"
            keywords="template kerangka soap format"
            title="Format catatan"
            description="Kerangka yang ditawarkan saat hari masih kosong. Sesuaikan dengan gaya laporan tiap DPJP."
          >
            <TemplateEditor
              templates={settings.noteTemplates}
              onChange={(noteTemplates) => patch({ noteTemplates })}
            />
            {/*
              Parity with the checklist button, but NOT the same operation.

              Checklists have no reconciler, so their button is the only way an
              updated list ever arrives. Templates are merged into on every load
              by `reconcileSeeds`, so updates have already arrived — this is the
              escape hatch for the case the merge could not resolve: it hit a
              conflict, kept your copy, and nothing on screen said so.

              That makes it a RESET. It discards local edits to that template,
              which is why it names the template and asks first, where the
              checklist version simply acts.
            */}
            {staleTemplates.length > 0 ? (
              <div className="mt-2 rounded-xl border border-accent bg-bg-subtle p-3">
                <p className="text-xs text-fg">
                  {staleTemplates.length} format berbeda dari versi bawaan aplikasi.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {staleTemplates.map((template: NoteTemplate) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => {
                        if (resetTemplateId !== template.id) {
                          setResetTemplateId(template.id);
                          return;
                        }
                        patch({
                          noteTemplates: resetTemplateToSeed(settings, SEED_SNAPSHOT, template.id),
                        });
                        setResetTemplateId(null);
                      }}
                      className={[
                        'min-h-tap rounded-lg border px-3 text-xs font-medium',
                        resetTemplateId === template.id
                          ? 'border-[var(--danger)] text-[var(--danger)]'
                          : 'border-accent text-accent',
                      ].join(' ')}
                    >
                      {resetTemplateId === template.id
                        ? `Ganti "${template.name}" dengan bawaan?`
                        : template.name}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-fg-faint">
                  Perubahanmu pada format itu akan hilang. Format lain tidak tersentuh.
                </p>
              </div>
            ) : null}
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
            id="pembuka"
            keywords="pembuka laporan tabe izin melaporkan"
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
            id="salam"
            keywords="salam assalamualaikum selamat pagi"
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
            id="format-dpjp"
            keywords="dpjp konsulen format"
            title="Format per DPJP"
            description="Pengingat format laporan yang diharapkan tiap konsulen."
          >
            <DpjpFormatEditor
              formats={settings.dpjpFormats}
              onChange={(dpjpFormats) => patch({ dpjpFormats })}
            />
          </SettingsSection>
          <SettingsSection
            id="preset-salin"
            keywords="salin copy simgos whatsapp preset"
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
            id="bullet-wa"
            keywords="whatsapp wa bullet tanda hubung"
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
          <SettingsSection
            id="bagian-catatan"
            keywords="alias header bagian section"
            title="Bagian catatan"
            description="Kata kunci yang dikenali sebagai header. Catatan lama ikut terbaca ulang, tanpa mengubah teks tersimpan."
          >
            <AliasEditor
              aliases={settings.sectionAliases}
              onChange={(sectionAliases) => patch({ sectionAliases })}
            />
          </SettingsSection>
        </SettingsGroup>

        <SettingsGroup id="settings-privasi" label="Privasi & data">
          <SettingsSection
            id="privasi"
            keywords="pin kunci inisial blur privasi lock"
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
                {[1, 3, 5, 10, 15, 30, 60].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} menit
                  </option>
                ))}
              </select>
            </label>
          </SettingsSection>
          <SettingsSection
            id="ekspor"
            keywords="export unduh json backup cadangan"
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
          <SettingsSection
            id="impor"
            keywords="import pindah akun unggah cadangan"
            title="Impor data"
            description="Masukkan berkas ekspor Plano ke akun ini (pindah akun, akun hilang)."
          >
            {user ? <ImportData uid={user.uid} /> : null}
          </SettingsSection>
          <SettingsSection
            id="keterbukaan"
            keywords="data firestore uu pdp enkripsi" title="Keterbukaan data">
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
        </SettingsGroup>

        <SettingsGroup id="settings-lanjutan" label="Lanjutan">
          <SettingsSection
            id="ai"
            keywords="ai api key periksa"
            title="Fitur AI (opsional)"
            description="Pakai API key sendiri. Mati secara bawaan."
          >
            <AiSettings />
          </SettingsSection>
  <SettingsSection
            id="rujukan-lab"
            keywords="lab rujukan nilai normal referensi"
            title="Rentang rujukan lab"
            description="Opsional. Kosong secara bawaan — Plano tidak membawa angka rujukan."
          >
            <ReferenceRangeSettings />
          </SettingsSection>
          <SettingsSection
            id="perbarui-kartu"
            keywords="kartu rebuild penanda kjs"
            title="Perbarui kartu pasien"
            description="Jalankan setelah aturan kartu berubah — mis. penanda KJS tidak muncul."
          >
            <RebuildCards />
          </SettingsSection>
          <SettingsSection
            id="periksa-salin"
            keywords="simgos karakter tanda tanya paste"
            title="Periksa hasil salin"
            description="Cari karakter yang berubah jadi ? di SIMGOS."
          >
            <PasteInspector />
          </SettingsSection>
          <SettingsSection
            id="riwayat-sesi"
            keywords="sesi logout login log"
            title="Riwayat sesi"
            description="Catatan masuk/keluar aplikasi, untuk menelusuri logout mendadak."
          >
            <SessionLogPanel />
          </SettingsSection>
        </SettingsGroup>

        <SettingsGroup id="settings-aplikasi" label="Akun & aplikasi">
          <SettingsSection
            id="tentang"
            keywords="versi update pembaruan perbarui muat ulang admin" title="Tentang" collapsible={false}>
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
            <UpdateControls />
            <button
              type="button"
              onClick={() => openSettingsSection('yang-baru')}
              className="mt-2 min-h-tap w-full rounded-lg border border-border px-3 text-sm"
            >
              Lihat yang baru di versi ini
            </button>
            {/* Shown to the admin only. The page itself is protected by the
                Firestore rules, not by this link being absent. */}
            {isAdmin(user?.uid) ? (
              <Link to="/admin" className="mt-2 inline-flex min-h-tap items-center text-xs text-accent underline">
                Admin
              </Link>
            ) : null}
          </SettingsSection>
          <SettingsSection
            id="yang-baru"
            title="Yang baru"
            description="Perubahan di tiap pembaruan aplikasi."
            keywords="changelog pembaruan update versi rilis baru"
            badge={unseenChangelog ? 'Baru' : undefined}
            defaultOpen={unseenChangelog}
          >
            <Changelog />
          </SettingsSection>
          <SettingsSection
            id="akun"
            keywords="akun email keluar logout google" title="Akun" defaultOpen>
            {persistence !== 'persisted' ? (
              <p className="mb-3 rounded-lg border border-border bg-bg-subtle p-3 text-[11px] leading-relaxed text-fg-muted">
                Penyimpanan browser di perangkat ini masih bisa dihapus otomatis saat memori
                menipis — itu yang membuat sesi tiba-tiba keluar. Pasang aplikasi ke layar
                utama (Bagikan → Tambah ke Layar Utama) agar sesi dan data offline bertahan.
              </p>
            ) : null}
            <p className="truncate text-xs text-fg-muted">{user?.email ?? '—'}</p>
            <SignOutButton className="mt-3 min-h-tap w-full rounded-lg border border-border px-3 text-sm text-danger" />
            <p className="mt-2 text-[11px] text-fg-faint">
              Keluar menghapus seluruh data offline di perangkat ini dan memuat ulang aplikasi.
            </p>
          </SettingsSection>
          <SettingsSection
            id="setel-ulang"
            keywords="reset bawaan default" title="Setel ulang">
            {confirmReset ? (
              <>
                <p className="text-xs leading-relaxed text-fg-muted">
                  Semua pengaturan kembali ke bawaan: kalimat pembuka dan penutup, format SOAP
                  dan laporan tiap DPJP, template, checklist, format dokumen, warna, dan
                  privasi.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                  <strong>Tidak</strong> terpengaruh: pasien aktif, pasien di arsip, dan
                  Catatan.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="min-h-tap flex-1 rounded-lg border border-border text-sm"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={resetting}
                    onClick={() => {
                      if (!user) return;
                      setResetting(true);
                      void resetSettings(user.uid)
                        .then(() => setRestored('Pengaturan dikembalikan ke bawaan.'))
                        .catch((error: unknown) => {
                          console.error('[settings] reset failed', error);
                          setRestored('Gagal menyetel ulang. Coba lagi.');
                        })
                        .finally(() => {
                          setResetting(false);
                          setConfirmReset(false);
                        });
                    }}
                    className="min-h-tap flex-1 rounded-lg border border-danger text-sm font-medium text-danger disabled:opacity-40"
                  >
                    {resetting ? 'Menyetel ulang…' : 'Setel ulang'}
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="min-h-tap w-full rounded-lg border border-border px-3 text-sm text-danger"
              >
                Kembalikan semua pengaturan ke bawaan
              </button>
            )}
          </SettingsSection>
        </SettingsGroup>

        {restored ? (
          <p
            role="status"
            className="sticky bottom-4 rounded-lg border border-border bg-surface px-3 py-2 text-center text-xs text-fg-muted shadow-lg"
          >
            {restored}
          </p>
        ) : null}
      </div>
      </SettingsSearchProvider>

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

/**
 * Search plus a jump bar, pinned while the page scrolls.
 *
 * The page is six groups of collapsed sections. On a phone the old layout
 * meant scrolling past every heading to reach Privasi or Tentang; the chips
 * go there in one tap, and the search finds a setting by any word in its
 * title, description or keywords ("pin", "dark", "reset").
 */
function SettingsToolbar({
  query,
  onQuery,
  unseen,
}: {
  query: string;
  onQuery: (next: string) => void;
  unseen: boolean;
}): JSX.Element {
  return (
    <div className="sticky top-0 z-10 -mx-4 space-y-2 border-b border-border bg-bg px-4 pb-2 pt-3">
      <label className="relative block">
        <span className="sr-only">Cari pengaturan</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onQuery('');
          }}
          placeholder="Cari pengaturan… (mis. PIN, watermark, pengingat)"
          className="min-h-tap w-full rounded-xl border border-border bg-surface px-3 text-[15px] outline-none focus:border-accent"
        />
      </label>
      {query ? null : (
        <nav aria-label="Kelompok pengaturan" className="-mx-4 overflow-x-auto px-4">
          <ul className="flex w-max gap-2 py-1">
            {GROUPS.map((group) => (
              <li key={group.id}>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById(group.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                  className="relative min-h-tap whitespace-nowrap rounded-full border border-border bg-surface px-3 text-sm text-fg-muted [@media(pointer:fine)]:min-h-8"
                >
                  {group.label}
                  {unseen && group.id === 'settings-aplikasi' ? (
                    <span
                      aria-label="ada pembaruan baru"
                      className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent"
                    />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
