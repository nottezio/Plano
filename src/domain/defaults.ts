import { DONE_TOKEN, tokenForIndex } from './colorTokens';
import {
  FOLLOWUP_BODY,
  FOLLOWUP_DX_BODY,
  FOLLOWUP_RINGKAS_BODY,
  KONSUL_KJS_BODY,
  POLI_BARU_BODY,
  PERPINDAHAN_BODY,
  KONSUL_KELAYAKAN_BODY,
  FOLLOWUP_TPM_BODY,
  BALASAN_KONSUL_BODY,
} from './templates';
import type { NoteTemplate } from './types';
import type {
  ChecklistItemDef,
  CopyPreset,
  SectionAlias,
  UserSettings,
} from './types';

/**
 * SPEC Appendix A — ship exactly this seed. It is then fully user-editable
 * (label, order, colour, add, disable) and ANY item count must work. Nothing
 * downstream may assume seven.
 *
 * The ids are fixed literals rather than generated nanoids so that the seed is
 * reproducible across devices that first sign in offline — two devices
 * generating different ids for "Kirim ke Chief" would silently fork the
 * checklist history.
 */
export const DEFAULT_CHECKLIST: readonly ChecklistItemDef[] = [
  { id: 'c1', order: 1, label: 'Visite pasien + TTV + EKG sesuai kebutuhan', colorToken: 'step-1', active: true },
  { id: 'c2', order: 2, label: 'Update SOAP', colorToken: 'step-2', active: true },
  { id: 'c3', order: 3, label: 'Kirim ke Chief', colorToken: 'step-3', active: true },
  { id: 'c4', order: 4, label: 'SOAP dikoreksi', colorToken: 'step-4', active: true },
  { id: 'c5', order: 5, label: 'Lapor DPJP', colorToken: 'step-5', active: true },
  { id: 'c6', order: 6, label: 'Input SIMGOS', colorToken: 'step-6', active: true },
  // Inserted after SIMGOS input, where it belongs in the round. Given its own
  // id rather than renumbering the existing ones: the ids key every historical
  // tick, so shifting `c7` to a new meaning would relabel months of history.
  { id: 'c8', order: 7, label: 'Order obat', colorToken: 'step-7', active: true },
  { id: 'c7', order: 8, label: 'Plan & terapi dilaksanakan', colorToken: 'step-8', active: true },
] as const;

/** SPEC 12.1 — drives the READ-ONLY parser. Editing these re-parses on the fly. */
export const DEFAULT_SECTION_ALIASES: readonly SectionAlias[] = [
  {
    sectionId: 's',
    label: 'Subjektif',
    order: 1,
    aliases: ['S', 'S/', 'Subjektif', 'Subjective', 'Keluhan', 'Anamnesis'],
  },
  {
    sectionId: 'o',
    label: 'Objektif',
    order: 2,
    // `O/` and `O :` both appear in the corpus alongside `O:`.
    aliases: ['O', 'O/', 'Objektif', 'Objective', 'Status Generalis', 'Pemeriksaan Fisis'],
  },
  { sectionId: 'ttv', label: 'TTV', order: 3, aliases: ['TTV', 'TD/N/RR/S', 'Vital Sign', 'VS', 'Tanda Vital'] },
  // `AGD`, `Urinalisa` and `Hasil Confrence` are used constantly in the real
  // reports and were missing, so those blocks parsed as generic custom sections
  // — which meant the "O + Penunjang" copy group could miss them.
  {
    sectionId: 'penunjang',
    label: 'Penunjang',
    order: 4,
    aliases: [
      'Penunjang',
      'Pemeriksaan Penunjang',
      'Lab',
      'Laboratorium',
      'Radiologi',
      'EKG',
      'AGD',
      'Analisa Gas Darah',
      'Urinalisa',
      'Urinalisis',
      'Foto Thorax',
      'Echocardiography',
      'Echo',
      'Hasil Confrence',
      'Hasil Conference',
    ],
  },
  {
    sectionId: 'a',
    label: 'Assessment',
    order: 5,
    /**
     * Every spelling the corpus uses for the same heading: `assess`,
     * `assessment`, `assest`, `asses`, with `izin`/`ijin` and with or without
     * `pasien`. They mean one thing, and reading them as different sections is
     * why Ringkas sometimes found no diagnosis at all.
     */
    aliases: [
      // NOT `A/` — that is what a TS block uses for its own assessment, and
      // aliasing it merged the consulting team's list into the patient's.
      'A', 'Assessment', 'Asesmen', 'Diagnosis Kerja', 'Diagnosis', 'Diagnosa',
      'Mohon izin kami assess dengan', 'Mohon izin kami assessment dengan',
      'Mohon izin pasien kami assess dengan', 'Mohon ijin kami assess dengan',
      'Mohon izin kami asses dengan', 'Mohon izin kami assest dengan',
      'Mohon ijin kami assest dengan', 'Mohon izin kami Assess dengan',
    ],
  },
  {
    sectionId: 'p',
    label: 'Plan',
    order: 6,
    // `P/` omitted for the same reason as `A/`.
    aliases: ['P', 'Plan', 'Planning', 'Rencana', 'Plan Monitoring', 'Plan Diagnostik'],
  },
  {
    sectionId: 'terapi',
    label: 'Terapi',
    order: 7,
    aliases: [
      // `T/` sits alongside `Th/`: both are how the corpus actually writes
      // this heading, and without it a note using `T/` had no terapi section
      // at all — not a custom one, nothing, because a bare `T` is not an alias
      // and the header was invisible to the parser.
      //
      // Unambiguous in practice: temperature is written `Suhu`, never `T/`.
      'Terapi', 'Tx', 'Th/', 'T/', 'Medikamentosa', 'Obat',
      'Mohon izin kami terapi dengan', 'Mohon izin pasien kami terapi dengan',
      'Mohon ijin pasien kami terapi dengan', 'Mohon ijin kami terapi dengan',
      'Mohon izin kami inisial terapi dengan',
    ],
  },
] as const;

/** SPEC 12.5 — two seeded one-tap chips. */
export const DEFAULT_COPY_PRESETS: readonly CopyPreset[] = [
  {
    id: 'preset-wa-chief',
    name: 'WA ke Chief',
    format: 'whatsapp',
    sections: 'all',
    includeIdentity: false,
    includeDateHeader: false,
    range: 'today',
  },
  {
    id: 'preset-simgos',
    name: 'SIMGOS',
    format: 'plain',
    sections: 'all',
    includeIdentity: false,
    includeDateHeader: false,
    range: 'today',
  },
] as const;

/** SPEC 13 — headers only. Never invent clinical content. */
/**
 * Seeds, exported so Settings can put them back.
 *
 * These lists are the only copy of the defaults that survives a user deleting
 * theirs — settings carry no revision trail, so without an exported seed there
 * would be nothing to restore from.
 */
export const SEED_GREETINGS: readonly string[] = [
      "Assalamu'alaikum dokter.",
      'Selamat pagi dokter.',
      'Selamat siang dokter.',
      'Selamat sore dokter.',
      'Selamat malam dokter.',
];

export const SEED_OPENING_SENTENCES: readonly string[] = [
      'Tabe dokter, mohon izin melaporkan follow up pasien di *(Ruang) Kamar (no) Bed (no)* atas nama :',
      'Tabe dokter, mohon izin melaporkan pasien baru rencana tindakan dari *(Poli)* di *(Ruang) Kamar (no) Bed (no)* atas nama :',
      'Tabe dokter, mohon izin melaporkan pasien baru di *(Ruang) Kamar (no) Bed (no)* atas nama :',
      'Tabe dokter izin melaporkan follow up pasien KJS *TS (Bagian) ((Nama DPJP))* di *(Ruang) Kamar (no) Bed (no)* atas nama :',
      'Tabe dokter mohon izin melaporkan follow up perpindahan pasien dari *(Ruang asal) Bed (no)* ke *(Ruang tujuan) Kamar (no) Bed (no)* pasien atas nama :',
      // A KJS transfer: the consulting service and its DPJP are named in the
      // same sentence as the move, because both change at once and reporting
      // one without the other is what makes a handover ambiguous.
      'Tabe dokter, mohon izin melapor perpindahan pasien *KJS TS (Bagian) ((Nama DPJP)) dari (Ruang asal) bed (no)* ke *(Ruang tujuan) Kamar (no) bed (no)* atas nama :',
];

export const SEED_NOTE_TEMPLATES: readonly NoteTemplate[] = [
      { id: 'followup', order: 1, name: 'Follow-up harian', body: FOLLOWUP_BODY },
      { id: 'followup-dx', order: 2, name: 'Follow-up (Dx primer/sekunder)', body: FOLLOWUP_DX_BODY },
      {
        id: 'followup-fisis-normal',
        order: 3,
        name: 'Follow-up (fisis normal, O ringkas)',
        body: FOLLOWUP_RINGKAS_BODY,
      },
      { id: 'konsul-kjs', order: 4, name: 'Konsul KJS (pasien baru)', body: KONSUL_KJS_BODY },
      { id: 'poli-baru', order: 5, name: 'Pasien baru dari poli', body: POLI_BARU_BODY },
      { id: 'perpindahan', order: 6, name: 'Pasien perpindahan', body: PERPINDAHAN_BODY },
      {
        id: 'konsul-kelayakan',
        order: 7,
        name: 'Konsul kelayakan pra-tindakan',
        body: KONSUL_KELAYAKAN_BODY,
      },
      { id: 'followup-tpm', order: 8, name: 'Follow-up dengan TPM', body: FOLLOWUP_TPM_BODY },
      { id: 'balasan-konsul', order: 9, name: 'Balasan konsul ke TS', body: BALASAN_KONSUL_BODY },
];

export function defaultUserSettings(): UserSettings {
  return {
    timezone: 'Asia/Jakarta',
    // Plain midnight, per the user's decision. Parameterised, never hardcoded
    // downstream (SPEC 9.1).
    dayRolloverHour: 0,
    checklistItems: DEFAULT_CHECKLIST.map((item) => ({ ...item })),
    sectionAliases: DEFAULT_SECTION_ALIASES.map((alias) => ({
      ...alias,
      aliases: [...alias.aliases],
    })),
    noteTemplates: SEED_NOTE_TEMPLATES.map((template) => ({ ...template })),
    carryForwardOnNewDay: true,
    // Only S. Clearing `penunjang` would delete the accumulated EKG / lab /
    // echo stack every morning — and that stack IS the value of carrying a note
    // forward. Investigations are removed by hand when they stop being
    // relevant, never on a schedule.
    carryForwardClearSections: ['s'],
    greetings: [...SEED_GREETINGS],
    /**
     * Placeholders are spelled out rather than left blank.
     *
     * A blank gap gives no clue what belongs in it, and reads as a typo to
     * anyone glancing at the list. `(Nama DPJP)` and `(Ruang) Kamar (no) Bed
     * (no)` say what to replace and are impossible to mistake for finished
     * text — a leftover placeholder is obvious in a sent message, a leftover
     * blank is not.
     */
    closingSentences: [
      'Selanjutnya mohon arahan dokter. Terima kasih dokter',
      'Selanjutnya mohon arahannya dokter. Terima kasih dokter',
      'Selanjutnya mohon arahan Prof. Terima kasih Prof',
      'Mohon arahanta Prof, terima kasih Prof',
      'Tabe dokter, selanjutnya mohon arahannya dok. Terima kasih dok.',
      'Tabe terimakasih dokter',
    ],
    openingSentences: [...SEED_OPENING_SENTENCES],
    /**
     * Seeded with the one binding that is known: Az Hafid Nashar's handovers
     * carry the primary/secondary diagnosis split. Everything else is left
     * unset rather than guessed — a wrong reminder about what a consultant
     * wants is worse than no reminder.
     */
    dpjpFormats: {
      // The three who want the short PDF form.
      afm: { format: 'ringkas', staffing: true },
      afg: { format: 'ringkas', staffing: true },
      zd: { format: 'ringkas', staffing: true, verificationTime: true },
      // Same short form, but to Telegram and without the staffing lines.
      mz: {
        format: 'ringkas',
        staffing: false,
        plainText: true,
        hint: 'Kirim via Telegram',
      },
      ahn: { format: 'diagnosis' },
      aha: { format: 'harian', hint: 'Bila fisis normal, ringkas O jadi satu baris' },
    },
    whatsappBullet: 'hyphen',
    sectionTint: false,
    copyPresets: DEFAULT_COPY_PRESETS.map((preset) => ({ ...preset })),
    privacy: {
      // Full names are stored, so the lock is ON by default (SPEC 18).
      pinLockEnabled: true,
      autoLockMinutes: 3,
      blurOnBackground: true,
      // Full names by default. The initials mode still exists for anyone who wants
      // it, but defaulting to it made the board unreadable for its actual user —
      // and the person holding the phone already knows who these patients are.
      boardShowInitialsOnly: false,
    },
    theme: 'system',
  };
}

/** Colour for a newly added checklist item, wrapping past the 12th. */
export function nextChecklistColor(existingCount: number): string {
  return tokenForIndex(existingCount + 1) || DONE_TOKEN;
}
