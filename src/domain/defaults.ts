import { DONE_TOKEN, tokenForIndex } from './colorTokens';
import {
  ADMISI_BODY,
  FOLLOWUP_BODY,
  FOLLOWUP_DX_BODY,
  FOLLOWUP_RINGKAS_BODY,
  KONSUL_KJS_BODY,
  POLI_BARU_BODY,
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
  { sectionId: 's', label: 'Subjektif', order: 1, aliases: ['S', 'Subjektif', 'Subjective', 'Keluhan'] },
  { sectionId: 'o', label: 'Objektif', order: 2, aliases: ['O', 'Objektif', 'Objective', 'Status Generalis'] },
  { sectionId: 'ttv', label: 'TTV', order: 3, aliases: ['TTV', 'TD/N/RR/S', 'Vital Sign', 'VS', 'Tanda Vital'] },
  { sectionId: 'penunjang', label: 'Penunjang', order: 4, aliases: ['Penunjang', 'Pemeriksaan Penunjang', 'Lab', 'Laboratorium', 'Radiologi', 'EKG'] },
  { sectionId: 'a', label: 'Assessment', order: 5, aliases: ['A', 'Assessment', 'Asesmen', 'Diagnosis Kerja'] },
  { sectionId: 'p', label: 'Plan', order: 6, aliases: ['P', 'Plan', 'Planning', 'Rencana'] },
  { sectionId: 'terapi', label: 'Terapi', order: 7, aliases: ['Terapi', 'Tx', 'Th/', 'Medikamentosa', 'Obat'] },
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
      { id: 'admisi', order: 4, name: 'Pasien baru (admisi)', body: ADMISI_BODY },
      { id: 'konsul-kjs', order: 5, name: 'Konsul KJS (pasien baru)', body: KONSUL_KJS_BODY },
      { id: 'poli-baru', order: 6, name: 'Pasien baru dari poli', body: POLI_BARU_BODY },
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
