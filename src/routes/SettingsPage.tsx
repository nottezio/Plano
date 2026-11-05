import { useCallback, useEffect, useState, type CSSProperties } from 'react';

import { AppShell } from '@/components/common/AppShell';
import { AliasEditor } from '@/components/settings/AliasEditor';
import { ChecklistEditor } from '@/components/settings/ChecklistEditor';
import { ClinicalDayEditor } from '@/components/settings/ClinicalDayEditor';
import {
  SettingsGroup,
  SettingsSearchProvider,
  SettingsSection,
  SettingsSubgroup,
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
import { HeparinSettingsEditor } from '@/components/settings/HeparinSettings';
import { PasteInspector } from '@/components/settings/PasteInspector';
import { RebuildCards } from '@/components/settings/RebuildCards';
import { SessionLogPanel } from '@/components/settings/SessionLogPanel';
import { FeedbackForm } from '@/components/settings/FeedbackForm';
import { PinSetupSheet } from '@/components/privacy/PinSetupSheet';
import { useLock } from '@/store/useLock';
import { updateSettings } from '@/data/repositories/settings.repo';
import type { SoapLayout, WatermarkMode } from '@/domain/types';
import { STICKY_STYLES, stickyPaper, stickyStyleOf } from '@/domain/boardNotes';
import { CANVAS_BACKGROUNDS, canvasBackgroundOf } from '@/domain/boardBackground';
import { CARD_STYLES, DENSITIES, TEXT_SIZES, cardStyleOf, densityOf, textSizeOf } from '@/domain/appearance';
import { CanvasRooms } from '@/components/board/CanvasBackdrop';
import { THEMES } from '@/domain/theme';
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
import { useUI } from '@/store/useUI';
import { PALETTES, SURFACES } from '@/domain/palette';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { PAGE_X } from '@/components/common/PageFrame';
import type { NoteTemplate } from '@/domain/types';
import { APP_VERSION } from '@/version.js';
import { UpdateControls } from '@/components/common/UpdateControls';
import { ImportData } from '@/components/settings/ImportData';
import { Link, useSearchParams } from 'react-router-dom';
import { isAdmin } from '@/domain/access';
import type { UserSettings } from '@/domain/types';

/**
 * One screen per category, ordered by how often each is touched. `blurb` says
 * what is inside, so a row on the phone list is findable without opening it.
 */
const CATEGORIES = [
  { id: 'laporan', label: 'Laporan & salin', blurb: 'Format catatan, preset salin, kalimat pembuka, DPJP' },
  { id: 'papan', label: 'Papan & harian', blurb: 'Checklist, pengingat, hari klinis, gaya kartu' },
  { id: 'tampilan', label: 'Tampilan', blurb: 'Warna, ukuran teks, kepadatan, halaman catatan' },
  { id: 'privasi', label: 'Privasi & data', blurb: 'PIN, ekspor dan impor, keterbukaan data' },
  { id: 'akun', label: 'Akun & aplikasi', blurb: 'Akun, versi, yang baru, setel ulang' },
  { id: 'lanjutan', label: 'Lanjutan', blurb: 'AI, rujukan lab, heparin, riwayat sesi' },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

export default function SettingsPage(): JSX.Element {
  const theme = useUI((state) => state.theme);
  const setTheme = useUI((state) => state.setTheme);
  const palette = useUI((state) => state.palette);
  const surface = useUI((state) => state.surface);
  const setPalette = useUI((state) => state.setPalette);
  const setSurface = useUI((state) => state.setSurface);
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
  /**
   * The open category lives in the URL (`?k=`), so the phone's back gesture
   * returns to the category list and a reload keeps your place. On `lg` there is
   * always one open: the first, until another is picked.
   */
  const [params, setParams] = useSearchParams();
  const picked = CATEGORIES.find((category) => category.id === params.get('k'))?.id ?? null;
  const active: CategoryId = picked ?? CATEGORIES[0].id;
  const searching = query.trim() !== '';
  const go = (id: CategoryId | null): void => setParams(id ? { k: id } : {});
  useEffect(() => {
    document.getElementById('main')?.scrollTo({ top: 0 });
  }, [picked]);
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

  const privacyValue =
    [
      pinEnabled ? 'PIN' : '',
      settings.privacy.boardShowInitialsOnly ? 'Inisial' : '',
      settings.privacy.blurOnBackground ? 'Buram' : '',
    ]
      .filter(Boolean)
      .join(' · ') || 'Mati';

  return (
    <AppShell title="Pengaturan">
      <SettingsSearchProvider query={query} active={active}>
        {/* Phone: a list of categories, then one category at a time. From `lg` the list is a pinned
            rail and the first category is already open. Typing in the search shows matches from
            every category, flat. */}
        <div className={`settings-list ${PAGE_X} pb-24 sm:pb-10 lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-10`}>
          {searching ? <span className="hidden lg:block" /> : <CategoryRail active={active} unseen={unseenChangelog} onPick={go} />}
          <div className="min-w-0">
            <SettingsToolbar query={query} onQuery={setQuery} />

            <CategoryHome hidden={picked !== null || searching} unseen={unseenChangelog} onPick={go} />

            <div className={picked || searching ? '' : 'hidden lg:block'}>
              {picked && !searching ? (
                <button
                  type="button"
                  onClick={() => go(null)}
                  className="-ml-2 mt-1 inline-flex min-h-tap items-center gap-1 rounded-lg px-2 text-sm text-accent hover:bg-bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent lg:hidden"
                >
                  <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 4L6 8l4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Pengaturan
                </button>
              ) : null}

              <p className="settings-empty mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-fg-muted">
                Tidak ada pengaturan yang cocok dengan “{query}”.
              </p>

        <SettingsGroup id="laporan" label="Laporan & salin">
          <SettingsSubgroup>
            <SettingsSection
              id="format-catatan"
              keywords="template kerangka soap format"
              title="Format catatan"
            value={`${settings.noteTemplates.length} format`}
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
                  <p className="mt-1 text-xs text-fg-faint">
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
              id="preset-salin"
              keywords="salin copy simgos whatsapp preset"
              title="Preset salin"
            value={`${settings.copyPresets.length} preset`}
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
                              'min-h-tap rounded-full border px-3 text-xs',
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
              id="bullet-wa"
              keywords="whatsapp wa bullet tanda hubung"
              title="Bullet di WhatsApp"
            value={{ hyphen: 'Bullet WA', guarded: 'Tanda hubung', bullet: 'Bulatan' }[settings.whatsappBullet]}
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
              <p className="mt-2 text-xs text-fg-faint">
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
          </SettingsSubgroup>
        </SettingsGroup>
        <SettingsGroup id="papan" label="Papan & harian">
          <SettingsSubgroup label="Harian">
            <SettingsSection
              id="checklist"
              keywords="checklist centang langkah visite"
              title="Checklist harian"
            value={`${settings.checklistItems.length} langkah`}
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
          </SettingsSubgroup>
          <SettingsSubgroup label="Kartu & papan">
            <SettingsSection
              id="catatan-kartu"
              keywords="catatan kartu pasien kuning strip papan"
              title="Catatan di kartu pasien"
            value={settings.showCardNote === true ? 'Tampil' : 'Mati'}
              description="Catatan pasien sudah tampil di sticky Catatan pasien; ini menampilkannya juga sebagai strip kuning di bawah kartu."
            >
              <Toggle
                label="Tampilkan catatan di bawah kartu"
                description="Mati secara default."
                checked={settings.showCardNote === true}
                onChange={(showCardNote) => patch({ showCardNote })}
              />
            </SettingsSection>
            <SettingsSection
              id="gaya-kartu"
              keywords="gaya kartu pasien pastel netral garis tepi outline warna chip status"
              title="Gaya kartu pasien"
              value={CARD_STYLES.find((entry) => entry.id === cardStyleOf(settings.cardStyle))?.label}
              description="Cara papan menampilkan warna checklist. Warna tetap berasal dari checklist; identitas, DPJP, Pemantauan dan H-1 / Pulang selalu terlihat."
            >
              <div role="radiogroup" aria-label="Gaya kartu pasien" className="grid grid-cols-3 gap-2">
                {CARD_STYLES.map((entry) => {
                  const on = cardStyleOf(settings.cardStyle) === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => patch({ cardStyle: entry.id })}
                      className={[
                        'flex min-h-tap flex-col items-start gap-2 rounded-xl border p-2.5 text-left',
                        on ? 'border-accent bg-[var(--accent-soft)]' : 'border-border bg-surface',
                      ].join(' ')}
                    >
                      {/* Drawn with the board card's own rules (data-patient-card), so the sample cannot drift from it. */}
                      <span aria-hidden="true" data-sample-style={entry.id} data-density="normal" data-text-size="normal" className="block w-full">
                        <span
                          data-patient-card
                          data-color-token="step-6"
                          className="block overflow-hidden rounded-xl border border-black/5 bg-token p-d-card text-token-fg dark:border-white/10"
                        >
                          <span className="card-band -mx-d-card -mt-d-card mb-d-flag block border-b border-[color-mix(in_srgb,var(--token-fg)_10%,transparent)] bg-black/[0.05] px-d-card py-d-band text-xs font-semibold dark:bg-white/[0.04]">
                            Nama pasien
                          </span>
                          <span className="card-status inline-block text-[11px] font-semibold">5/8 · Cek lab</span>
                        </span>
                      </span>
                      <span className="text-sm font-medium text-fg">{entry.label}</span>
                      <span className="text-xs text-fg-muted">{entry.hint}</span>
                    </button>
                  );
                })}
              </div>
            </SettingsSection>
            <SettingsSection
              id="tampilan-sticky"
              keywords="sticky note catatan tempel post-it kertas paku bergaris gaya tampilan"
              title="Tampilan sticky note"
              value={STICKY_STYLES.find((entry) => entry.id === stickyStyleOf(settings.stickyStyle))?.label}
              description="Gaya kertas untuk sticky note di papan. Hanya mengubah tampilan; isi dan warna catatan tidak berubah."
            >
              <div role="radiogroup" aria-label="Tampilan sticky note" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {STICKY_STYLES.map((entry) => {
                  const on = stickyStyleOf(settings.stickyStyle) === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => patch({ stickyStyle: entry.id })}
                      className={[
                        'flex min-h-tap flex-col items-start gap-2 rounded-xl border p-2.5 text-left',
                        on ? 'border-accent bg-[var(--accent-soft)]' : 'border-border bg-surface',
                      ].join(' ')}
                    >
                      {/* A small sample drawn with the note's own rules, so the picker cannot drift from the board. */}
                      <span
                        aria-hidden="true"
                        data-sticky={entry.id}
                        style={
                          entry.id === 'klasik'
                            ? { backgroundColor: 'var(--card-step-3-bg)', color: 'var(--card-step-3-fg)' }
                            : (stickyPaper('kuning', entry.id) as CSSProperties)
                        }
                        className={[
                          'relative mt-1.5 block h-14 w-full rounded-sm',
                          entry.id === 'bergaris' ? 'pt-4' : 'pt-3',
                        ].join(' ')}
                      >
                        <span className="mx-3 mt-1 block h-1.5 w-2/3 rounded-full bg-current opacity-40" />
                        <span className="mx-3 mt-1.5 block h-1.5 w-1/2 rounded-full bg-current opacity-25" />
                      </span>
                      <span className="text-sm font-medium text-fg">{entry.label}</span>
                      <span className="text-xs text-fg-muted">{entry.hint}</span>
                    </button>
                  );
                })}
              </div>
            </SettingsSection>
            <SettingsSection
              id="latar-kanvas"
              keywords="latar kanvas background papan titik gabus denah vinyet polos kisi"
              title="Latar kanvas"
              value={CANVAS_BACKGROUNDS.find((entry) => entry.id === canvasBackgroundOf(settings.canvasBackground))?.label}
              description="Latar di belakang kartu saat papan memakai Urutan sendiri (kanvas). Hanya tampilan; posisi kartu dan coretan tidak berubah."
            >
              <div role="radiogroup" aria-label="Latar kanvas" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CANVAS_BACKGROUNDS.map((entry) => {
                  const on = canvasBackgroundOf(settings.canvasBackground) === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => patch({ canvasBackground: entry.id })}
                      className={[
                        'flex min-h-tap flex-col items-start gap-2 rounded-xl border p-2.5 text-left',
                        on ? 'border-accent bg-[var(--accent-soft)]' : 'border-border bg-surface',
                      ].join(' ')}
                    >
                      {/* A small sample drawn with the board's own rules, so the picker cannot drift from it. */}
                      <span
                        aria-hidden="true"
                        data-canvas-bg={entry.id}
                        className="relative block h-14 w-full overflow-hidden rounded-md border border-border"
                      >
                        {entry.id === 'denah' ? <CanvasRooms rows={3} compact /> : null}
                        <span className="absolute left-2 top-2 h-7 w-9 rounded bg-surface shadow-card" />
                        <span className="absolute left-14 top-4 h-7 w-9 rounded bg-surface shadow-card" />
                      </span>
                      <span className="text-sm font-medium text-fg">{entry.label}</span>
                      <span className="text-xs text-fg-muted">{entry.hint}</span>
                    </button>
                  );
                })}
              </div>
            </SettingsSection>
          </SettingsSubgroup>
        </SettingsGroup>
        <SettingsGroup id="tampilan" label="Tampilan">
          <SettingsSubgroup label="Warna">
            <SettingsSection
              id="tema"
              keywords="tema mode gelap terang dark light senja lembut mata warna sistem"
              title="Mode warna"
              value={THEMES.find((entry) => entry.id === theme)?.name}
              description="Terang, Gelap, atau Senja yang lembut di mata. Tersimpan di perangkat ini."
            >
              <ThemePicker theme={theme} onChange={setTheme} />
            </SettingsSection>
            <SettingsSection
              id="warna"
              keywords="warna palet tema aksen latar oled hitam kertas theme palette colour color"
              title="Warna aplikasi"
              value={`${PALETTES.find((entry) => entry.id === palette)?.name ?? ''} · ${SURFACES.find((entry) => entry.id === surface)?.name ?? ''}`}
              description="Warna tombol dan pilihan, serta latar. Tersimpan di perangkat ini. Hitam pekat hanya untuk mode Gelap."
            >
              <div className="space-y-3">
                <p className="text-xs font-semibold text-fg-muted">Warna tombol dan pilihan</p>
                <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
                  {PALETTES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={palette === p.id}
                      onClick={() => setPalette(p.id)}
                      className={[
                        'flex min-h-tap items-center gap-2 rounded-lg border px-2.5 text-sm',
                        palette === p.id ? 'border-accent font-medium text-accent' : 'border-border text-fg-muted',
                      ].join(' ')}
                    >
                      <span aria-hidden="true" className="flex shrink-0 overflow-hidden rounded-full border border-border">
                        <span className="h-5 w-2.5" style={{ background: p.swatch[0] }} />
                        <span className="h-5 w-2.5" style={{ background: p.swatch[1] }} />
                      </span>
                      {p.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs font-semibold text-fg-muted">Latar</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {SURFACES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={surface === option.id}
                      onClick={() => setSurface(option.id)}
                      className={[
                        'min-h-tap rounded-lg border px-3 py-1.5 text-left text-sm',
                        surface === option.id ? 'border-accent font-medium text-accent' : 'border-border text-fg-muted',
                      ].join(' ')}
                    >
                      {option.name}
                      <span className="block text-xs font-normal text-fg-faint">{option.note}</span>
                    </button>
                  ))}
                </div>
              </div>
            </SettingsSection>
            <SettingsSection
              id="warna-bagian"
              keywords="tint header warna"
              title="Warna bagian catatan"
              value={settings.sectionTint ? 'Aktif' : 'Mati'}
              description="Latar samar di belakang judul tiap bagian, untuk memindai posisi."
            >
              <Toggle
                label="Beri warna pada judul bagian"
                description="Identitas, S, O + penunjang, A, Terapi + Plan, dan TS masing-masing berbeda."
                checked={settings.sectionTint}
                onChange={(sectionTint) => patch({ sectionTint })}
              />
            </SettingsSection>
          </SettingsSubgroup>
          <SettingsSubgroup label="Teks & jarak">
            <SettingsSection
              id="ukuran-teks"
              keywords="ukuran teks huruf font besar kecil catatan"
              title="Ukuran teks"
              value={TEXT_SIZES.find((entry) => entry.id === textSizeOf(settings.textSize))?.label}
              description="Teks catatan SOAP, judul kartu pasien dan baris daftar. Label kecil (11 px) tetap."
            >
              <div role="radiogroup" aria-label="Ukuran teks" className="grid grid-cols-3 gap-2">
                {TEXT_SIZES.map((entry) => {
                  const on = textSizeOf(settings.textSize) === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => patch({ textSize: entry.id })}
                      className={[
                        'flex min-h-tap flex-col items-start gap-2 rounded-xl border p-2.5 text-left',
                        on ? 'border-accent bg-[var(--accent-soft)]' : 'border-border bg-surface',
                      ].join(' ')}
                    >
                      <span aria-hidden="true" data-text-size={entry.id} className="flex h-[4.5rem] w-full items-center rounded-md border border-border bg-bg-subtle px-2 text-note text-fg">
                        Aa 120/80
                      </span>
                      <span className="text-sm font-medium text-fg">{entry.label}</span>
                      <span className="text-xs text-fg-muted">{entry.hint}</span>
                    </button>
                  );
                })}
              </div>
            </SettingsSection>
            <SettingsSection
              id="kepadatan"
              keywords="kepadatan padat ramai jarak kompak longgar padding baris"
              title="Kepadatan"
              value={DENSITIES.find((entry) => entry.id === densityOf(settings.density))?.label}
              description="Jarak di dalam kartu pasien, baris daftar dan kepala halaman pasien. Tombol tetap 44 px; isi tidak berubah."
            >
              <div role="radiogroup" aria-label="Kepadatan" className="grid grid-cols-3 gap-2">
                {DENSITIES.map((entry) => {
                  const on = densityOf(settings.density) === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => patch({ density: entry.id })}
                      className={[
                        'flex min-h-tap flex-col items-start gap-2 rounded-xl border p-2.5 text-left',
                        on ? 'border-accent bg-[var(--accent-soft)]' : 'border-border bg-surface',
                      ].join(' ')}
                    >
                      {/* Drawn with the app's own spacing variables, so the sample cannot drift from the board. */}
                      <span aria-hidden="true" data-density={entry.id} className="block h-[4.5rem] w-full overflow-hidden rounded-md border border-border bg-bg-subtle p-d-card">
                        <span className="block h-2 w-2/3 rounded-full bg-fg-faint" />
                        <span className="mt-d-gap block h-1.5 w-full rounded-full bg-border-strong" />
                        <span className="mt-d-gap block h-1.5 w-3/4 rounded-full bg-border-strong" />
                        <span className="mt-d-flag block h-2 w-1/3 rounded-full bg-border-strong" />
                      </span>
                      <span className="text-sm font-medium text-fg">{entry.label}</span>
                      <span className="text-xs text-fg-muted">{entry.hint}</span>
                    </button>
                  );
                })}
              </div>
            </SettingsSection>
          </SettingsSubgroup>
          <SettingsSubgroup label="Halaman catatan">
            <SettingsSection
              id="tata-letak"
              keywords="layout panel klasik soap tab status rail warna"
              title="Tata letak halaman SOAP"
            value={{ klasik: 'Klasik', panel: 'Panel', tab: 'Tab status', rail: 'Rail warna' }[settings.soapLayout ?? 'klasik']}
              description="Susunan panel di samping catatan."
            >
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['klasik', 'Klasik', 'Semua panel terbuka, urutan lama.'],
                    ['panel', 'Panel', 'Catatan · Checklist · Custom Checklist · Tanggal, semua mulai tertutup dengan ringkasan di judulnya.'],
                    ['tab', 'Tab status', 'Empat tab menampilkan semua hitungan, satu isi terbuka. Centang langsung dari daftar.'],
                    ['rail', 'Rail warna', 'Rail warna seperti di kartu pasien, yang belum selesai terlihat dan bisa langsung dicentang.'],
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
                    <span className="mt-0.5 block text-xs text-fg-faint">{note}</span>
                  </button>
                ))}
              </div>
            </SettingsSection>
            <SettingsSection
              id="watermark"
              keywords="watermark nama rm ketebalan"
              title="Watermark di catatan"
            value={settings.showWatermark ? ((settings.watermarkMode ?? 'ulang') === 'ulang' ? 'Berulang' : 'Mengambang') : 'Mati'}
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
                      <span className="mt-0.5 block text-xs text-fg-faint">{note}</span>
                    </button>
                  ))}
                </div>
                <label className="mt-2 block text-xs text-fg-muted">
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
            value={settings.showHariRawat ? 'Tampil' : 'Mati'}
              description="Angka hari rawat sudah terlihat di rel tanggal; ini menambahkannya di judul juga."
            >
              <Toggle
                label="Tampilkan “Hari rawat ke-N”"
                description="Mati secara default. Nyalakan bila dokter tertentu meminta angkanya di laporan."
                checked={settings.showHariRawat}
                onChange={(showHariRawat) => patch({ showHariRawat })}
              />
            </SettingsSection>
          </SettingsSubgroup>
        </SettingsGroup>
        <SettingsGroup id="privasi" label="Privasi & data">
          <SettingsSubgroup>
            <SettingsSection
              id="privasi"
              keywords="pin kunci inisial blur privasi lock"
              title="Privasi"
            value={privacyValue}
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
                Google Firestore serta di penyimpanan browser perangkat ini. Data tidak
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
          </SettingsSubgroup>
        </SettingsGroup>
        <SettingsGroup id="akun" label="Akun & aplikasi">
          <SettingsSubgroup>
            <SettingsSection
              id="akun"
              keywords="akun email keluar logout google" title="Akun"
            value={user?.email ?? undefined}
            defaultOpen>
              {persistence !== 'persisted' ? (
                <p className="mb-3 rounded-lg border border-border bg-bg-subtle p-3 text-xs leading-relaxed text-fg-muted">
                  Penyimpanan browser di perangkat ini masih bisa dihapus otomatis saat memori
                  menipis — itu yang membuat sesi tiba-tiba keluar. Pasang aplikasi ke layar
                  utama (Bagikan → Tambah ke Layar Utama) agar sesi dan data offline bertahan.
                </p>
              ) : null}
              <p className="truncate text-xs text-fg-muted">{user?.email ?? '—'}</p>
              <Link
                to="/akun"
                className="mt-3 flex min-h-tap w-full items-center justify-center rounded-lg border border-border px-3 text-sm text-accent"
              >
                Buka halaman Akun (username)
              </Link>
              <SignOutButton className="mt-3 min-h-tap w-full rounded-lg border border-border px-3 text-sm text-danger" />
              <p className="mt-2 text-xs text-fg-faint">
                Keluar menghapus seluruh data offline di perangkat ini dan memuat ulang aplikasi.
              </p>
            </SettingsSection>
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
              id="laporan-saran"
              keywords="bug masalah error laporan saran fitur feedback umpan balik"
              title="Laporkan masalah / saran fitur"
              description="Kirim langsung ke pemilik Plano."
            >
              <FeedbackForm />
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
          </SettingsSubgroup>
        </SettingsGroup>
        <SettingsGroup id="lanjutan" label="Lanjutan">
          <SettingsSubgroup>
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
              id="heparin"
              keywords="heparin aptt kontrol nomogram antikoagulan kalkulator"
              title="Heparin (aPTT)"
              description="Kontrol aPTT lab dan target untuk kartu heparin di Kalkulator. Tersimpan di perangkat ini."
            >
              <HeparinSettingsEditor />
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
              keywords="sesi logout login log memuat lambat loading"
              title="Riwayat sesi"
              description="Catatan masuk/keluar dan pemuatan yang lambat, untuk menelusuri logout mendadak atau “Memuat…” yang lama."
            >
              <SessionLogPanel />
            </SettingsSection>
          </SettingsSubgroup>
        </SettingsGroup>

              {restored ? (
                <p
                  role="status"
                  className="sticky bottom-4 mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-center text-xs text-fg-muted shadow-pop"
                >
                  {restored}
                </p>
              ) : null}
            </div>
          </div>
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

function ChevronRight(): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-fg-faint">
      <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Phone entry point: one row per category, with what is inside it. Hidden once a category is open. */
function CategoryHome({
  hidden,
  unseen,
  onPick,
}: {
  hidden: boolean;
  unseen: boolean;
  onPick: (id: CategoryId) => void;
}): JSX.Element {
  return (
    <nav aria-label="Kategori pengaturan" className={hidden ? 'hidden' : 'lg:hidden'}>
      <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {CATEGORIES.map((category) => (
          <li key={category.id}>
            <button
              type="button"
              onClick={() => onPick(category.id)}
              className="flex min-h-[3.5rem] w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:[outline-offset:-2px] focus-visible:outline-accent"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">{category.label}</span>
                <span className="mt-0.5 block text-xs text-fg-muted">{category.blurb}</span>
              </span>
              {unseen && category.id === 'akun' ? (
                <span aria-label="ada pembaruan baru" className="h-2 w-2 shrink-0 rounded-full bg-accent" />
              ) : null}
              <ChevronRight />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Wide screens: the same categories as a pinned column, the open one marked. */
function CategoryRail({
  active,
  unseen,
  onPick,
}: {
  active: CategoryId;
  unseen: boolean;
  onPick: (id: CategoryId) => void;
}): JSX.Element {
  return (
    <nav aria-label="Kategori pengaturan" className="sticky top-24 hidden self-start pt-6 lg:block">
      <ul className="space-y-1">
        {CATEGORIES.map((category) => (
          <li key={category.id}>
            <button
              type="button"
              aria-current={active === category.id ? 'page' : undefined}
              onClick={() => onPick(category.id)}
              className={[
                'flex min-h-9 w-full items-center rounded-lg px-3 text-left text-sm transition-colors',
                active === category.id ? 'bg-[var(--accent-soft)] font-medium text-accent' : 'text-fg-muted hover:bg-bg-subtle hover:text-fg',
              ].join(' ')}
            >
              {category.label}
              {unseen && category.id === 'akun' ? (
                <span aria-label="ada pembaruan baru" className="ml-2 h-2 w-2 rounded-full bg-accent" />
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Search, pinned while the page scrolls. It finds a setting by any word in its
 * title, description or keywords ("pin", "dark", "reset") across every category.
 */
function SettingsToolbar({
  query,
  onQuery,
}: {
  query: string;
  onQuery: (next: string) => void;
}): JSX.Element {
  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-transparent bg-bg px-4 py-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
      <label className="relative block">
        <span className="sr-only">Cari pengaturan</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onQuery('');
          }}
          placeholder="Cari pengaturan… (mis. PIN)"
          className="min-h-tap w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
        />
      </label>
    </div>
  );
}
