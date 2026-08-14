import type { Timestamp } from 'firebase/firestore';

/**
 * SPEC 6.2 — the domain model.
 *
 * These types are the contract every repository writes through. They are
 * deliberately declared in `domain/`, not `data/`, because the merge, parser
 * and formatter layers must be usable (and unit-testable) with no Firebase
 * import in scope.
 */

/** "YYYY-MM-DD" in the user's clinical timezone. Never a Date. */
export type ClinicalDate = string;

export type SectionId =
  | '_intro'
  | 's'
  | 'o'
  | 'ttv'
  | 'penunjang'
  | 'a'
  | 'p'
  | 'terapi'
  | `custom_${string}`;

/** What shape of report a consultant expects (see dpjp.ts). */
export type ReportFormat = 'harian' | 'diagnosis' | 'ringkas';

/**
 * A consultant's reporting preferences.
 *
 * More than a single enum, because the real requirements vary along axes that
 * combine: the short PDF form goes to four consultants, but one wants a
 * verification time on it and another wants it without the Chief/Junior lines
 * because it goes to Telegram rather than the ward group. Encoding those as
 * separate formats would need one variant per combination, and a fifth
 * consultant with a new preference would need two more.
 */
export interface DpjpReportConfig {
  format: ReportFormat;
  /** `Chief :` / `Junior :` at the top. Off for reports sent to Telegram. */
  staffing?: boolean;
  /** `_Jam verifikasi HH.MM WITA_` before the closing sentence. */
  verificationTime?: boolean;
  /**
   * Strip `*bold*` and `_italic_` from the output.
   *
   * Telegram does not render WhatsApp's markers, so a report pasted there
   * arrives with the asterisks and underscores visible around every heading.
   * Plain text is the correct output for that destination, not a degraded one.
   */
  plainText?: boolean;
  /** Free note shown alongside the reminder, e.g. "kirim via Telegram". */
  hint?: string;
}

export type Sex = 'L' | 'P';
export type PatientStatus = 'active' | 'archived';
export type ArchiveReason = 'pulang' | 'pindah' | 'meninggal' | 'lainnya';
export type OutputFormat = 'whatsapp' | 'plain' | 'markdown';
export type CopyRange = 'today' | 'specific' | 'lastN' | 'all';

export interface ChecklistItemDef {
  /** nanoid — STABLE FOREVER. Never reuse an id; history is keyed by it. */
  id: string;
  order: number;
  label: string;
  /** Key into styles/tokens.css. Never a raw hex (SPEC 9.3). */
  colorToken: string;
  /** Soft-disable. Deleting would orphan every historical tick. */
  active: boolean;
}

export interface SectionAlias {
  sectionId: SectionId;
  label: string;
  aliases: string[];
  /** Output order when composing a section subset. */
  order: number;
}

export interface CopyPreset {
  id: string;
  name: string;
  format: OutputFormat;
  sections: SectionId[] | 'all';
  includeIdentity: boolean;
  includeDateHeader: boolean;
  range: CopyRange;
  lastN?: number;
}

export interface PrivacySettings {
  /** DEFAULT true — full patient names are stored (SPEC 18). */
  pinLockEnabled: boolean;
  autoLockMinutes: number;
  blurOnBackground: boolean;
  /** DEFAULT true — board shows initials + bed only. */
  boardShowInitialsOnly: boolean;
}

export interface UserSettings {
  timezone: string;
  /** DEFAULT 0 (midnight). Configurable — nothing may hardcode it (SPEC 9.1). */
  dayRolloverHour: number;
  checklistItems: ChecklistItemDef[];
  sectionAliases: SectionAlias[];
  carryForwardOnNewDay: boolean;
  carryForwardClearSections: SectionId[];
  /**
   * Starting skeletons offered on an empty day. Data, not code: the formats
   * differ per DPJP and per ward, and hardcoding them would mean a redeploy
   * every time a consultant changes how they want a handover written.
   */
  noteTemplates: NoteTemplate[];
  /** Salam presets — swapped on an existing note, per SPEC 14. */
  greetings: string[];
  /** Reporting-sentence presets ("mohon izin melaporkan …"). */
  openingSentences: string[];
  /**
   * Which report shape each DPJP expects, keyed by registry id.
   *
   * Configuration, not code: consultants change what they want, and a redeploy
   * is the wrong unit of change for that. Unset means the standard daily
   * handover, so the map only ever holds the exceptions.
   */
  dpjpFormats: Record<string, DpjpReportConfig>;
  /**
   * How bullets are written into WhatsApp output.
   *
   * `hyphen` is the default and the one that works: WhatsApp's compose box
   * turns a line starting `- ` into its own bullet list, which is the rendering
   * a handover is read with. The app's job is to hand WhatsApp something it
   * recognises, not to produce the bullets itself.
   *
   * `guarded` suppresses that conversion with invisible characters, for anyone
   * who wants literal hyphens to survive. `bullet` writes a `•` directly, which
   * WhatsApp shows as a character rather than as a list.
   */
  whatsappBullet: 'hyphen' | 'guarded' | 'bullet';
  /**
   * Tint the section HEADERS in the editor.
   *
   * Off by default: it is a scanning aid, and an aid nobody asked for that
   * changes how the note looks is an imposition. Anyone who wants it turns it
   * on once.
   */
  sectionTint: boolean;
  copyPresets: CopyPreset[];
  privacy: PrivacySettings;
  theme: 'system' | 'light' | 'dark';
}

export interface NoteTemplate {
  id: string;
  name: string;
  /** Markdown-lite, inserted verbatim into an empty day. */
  body: string;
  order: number;
}

export interface UserProfile {
  /**
   * A single free-text note belonging to the user, not to any patient.
   *
   * On the profile document rather than in a collection because there is
   * exactly one: a collection would invite a list, and a list would make you
   * choose a note before you could write in one.
   */
  scratchNote?: string;
  uid: string;
  displayName: string;
  email: string;
  createdAt: Timestamp;
  /** Bumped only by a real migration; read on boot to refuse newer schemas. */
  schemaVersion: number;
  settings: UserSettings;
}

export interface PatientArchiveInfo {
  reason: ArchiveReason;
  note?: string;
  at: Timestamp;
}

export interface Patient {
  id: string;
  ownerId: string;
  /** [ownerId] in v1 — the sharing seam (SPEC 6.1). */
  memberIds: string[];
  name: string;
  mrn?: string;
  age?: number;
  sex?: Sex;
  ward?: string;
  /** Room number. Kept apart from `ward` so the two format independently. */
  room?: string;
  bed?: string;
  dpjp?: string;
  /**
   * Registry id of the consultant detected from the note's DPJP lines.
   *
   * Denormalised for the same reason as `preview`: the board needs it for
   * every card and cannot open every note to find it. Derived, never typed —
   * refreshed on each body write, so correcting the DPJP line in the note is
   * the only place it is ever edited.
   */
  dpjpId?: string;
  /**
   * Free-form note that belongs to the PATIENT, not to a day.
   *
   * Never carried, never cleared, never rolled over — it simply persists.
   * Things like allergies, family contacts, access lines, or a reminder about
   * which consultant wants what. Kept off the daily entry deliberately: a
   * standing fact repeated into thirty days of SOAP is thirty places to
   * correct it when it changes.
   */
  notes: string;
  diagnoses: string[];
  admittedAt: ClinicalDate;
  status: PatientStatus;
  archive?: PatientArchiveInfo;
  labels: string[];
  pinned: boolean;
  colorOverride?: string | null;
  lastEntryDate?: ClinicalDate;

  /**
   * DERIVED BOARD CACHES — never a source of truth.
   *
   * The board must paint one card per patient with today's colour and a text
   * preview. Reading those from the entries and checklist subcollections costs
   * two live listeners *per patient*; at 40 patients on ward wifi that is 80
   * streams for a screen that shows four lines each.
   *
   * So both are denormalised onto the patient document, which the board
   * already subscribes to as a single query. The subcollections remain
   * authoritative: `preview` is truncated and read-only, and `boardChecklist`
   * is rewritten wholesale from the caller's live state so it can never
   * accumulate keys from a previous clinical day. If either drifts, the
   * patient page still reads the real documents.
   */
  preview?: string;
  previewDate?: ClinicalDate;
  boardChecklist?: { date: ClinicalDate; done: Record<string, boolean> };
  /** lowercase name + mrn + bed + ward + dx — powers offline search (F10). */
  searchBlob: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** deviceId, not uid — used to attribute concurrent edits (SPEC 7). */
  updatedBy: string;
  deletedAt: Timestamp | null;
}

/** ONE free-form page per clinical day. No section fields, ever (SPEC 1.2.5). */
export interface DailyEntry {
  date: ClinicalDate;
  hariRawat: number;
  body: string;
  /** Monotonic. increment() on every body write; never a device clock. */
  rev: number;
  bodyHash: string;
  locked: boolean;
  editing?: { deviceId: string; at: Timestamp } | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: string;
  deletedAt: Timestamp | null;
}

export interface EntryRevision {
  id: string;
  body: string;
  rev: number;
  deviceId: string;
  at: Timestamp;
  /** Why the snapshot was taken — shown in "Riwayat perubahan". */
  reason: 'autosave' | 'pre-merge' | 'pre-conflict' | 'restore' | 'unlock';
}

export interface ChecklistTickState {
  done: boolean;
  at: Timestamp | null;
  by: string | null;
}

export interface DailyChecklist {
  date: ClinicalDate;
  /** Separate map keys per item — ticking item 3 never clobbers item 5. */
  items: Record<string, ChecklistTickState>;
}

export interface AppDocument {
  id: string;
  title: string;
  category: string;
  body: string;
  pinned: boolean;
  order: number;
  labels: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}


/** Current schema generation. Bump only alongside a written migration. */
export const SCHEMA_VERSION = 1;
