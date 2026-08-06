import { DONE_TOKEN, tokenForIndex } from './colorTokens';
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
  { id: 'c7', order: 7, label: 'Plan & terapi dilaksanakan', colorToken: 'step-7', active: true },
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
    includeIdentity: true,
    includeDateHeader: true,
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
export const DEFAULT_TEMPLATE_BODY = [
  'S:',
  '',
  'O:',
  'TTV:',
  '',
  'Penunjang:',
  '',
  'A:',
  '',
  'P:',
  '',
  'Terapi:',
  '',
].join('\n');

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
    carryForwardOnNewDay: true,
    carryForwardClearSections: ['s', 'penunjang'],
    defaultTemplateId: null,
    copyPresets: DEFAULT_COPY_PRESETS.map((preset) => ({ ...preset })),
    privacy: {
      // Full names are stored, so the lock is ON by default (SPEC 18).
      pinLockEnabled: true,
      autoLockMinutes: 3,
      blurOnBackground: true,
      boardShowInitialsOnly: true,
    },
    theme: 'system',
  };
}

/** Colour for a newly added checklist item, wrapping past the 12th. */
export function nextChecklistColor(existingCount: number): string {
  return tokenForIndex(existingCount + 1) || DONE_TOKEN;
}
