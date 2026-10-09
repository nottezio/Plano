/**
 * Saved Helper results — a message Helper built, kept on the account.
 *
 * Every Helper tool turns pasted text into a message and, until now, forgot
 * it: the Sensus lists lived on one device for one day, the Verifikasi report
 * was gone on reload, and a census sent at 07:00 could not be found again at
 * 10:00 when the consultant asked for it on the PC.
 *
 * WHAT IS KEPT is the finished text and what it is for — never the pasted
 * inputs. A ward list holds every patient in the hospital, tens of KB each,
 * and is worth one morning; the census built from it holds one consultant's
 * patients and is the thing worth finding again.
 *
 * ONE RECORD PER (kind, date, subject). The id is derived from those three,
 * not random, so:
 *   - pressing Simpan twice, or on two devices offline, writes the SAME
 *     document instead of two copies the list then has to deduplicate;
 *   - re-saving after a correction updates the record in place, which is what
 *     "the ARB census for 9 October" means — there is one;
 *   - saving again after deleting revives it (`deletedAt: null`).
 */

export const HELPER_RESULT_KINDS = [
  'sensus',
  'formasi',
  'mr-senior',
  'mr-pengampu',
  'mr-prodi',
  'mr-pakar',
  'verifikasi',
] as const;

export type HelperResultKind = (typeof HELPER_RESULT_KINDS)[number];

/** Which Helper tool made it — the filter chips on the Tersimpan tab. */
export type HelperResultGroup = 'buatsensus' | 'jaga' | 'mr' | 'sensus';

export const KIND_LABEL: Record<HelperResultKind, string> = {
  sensus: 'Sensus DPJP',
  formasi: 'Formasi Jaga',
  'mr-senior': 'MR · ke senior',
  'mr-pengampu': 'MR · ke pengampu',
  'mr-prodi': 'MR · Grup Prodi',
  'mr-pakar': 'MR · Grup PAKAR',
  verifikasi: 'Verifikasi List',
};

export const KIND_GROUP: Record<HelperResultKind, HelperResultGroup> = {
  sensus: 'buatsensus',
  formasi: 'jaga',
  'mr-senior': 'mr',
  'mr-pengampu': 'mr',
  'mr-prodi': 'mr',
  'mr-pakar': 'mr',
  verifikasi: 'sensus',
};

/** Same order and names as the Helper tabs. */
export const GROUP_LABEL: ReadonlyArray<readonly [HelperResultGroup, string]> = [
  ['jaga', 'Konfirmasi Jaga'],
  ['sensus', 'Verifikasi List'],
  ['buatsensus', 'Buat Sensus'],
  ['mr', 'Morning Report'],
];

/**
 * Firestore's document cap is 1 MiB. A census of 40 patients is ~6 KB and a
 * Verifikasi report ~20 KB, so this is far above any real result and far
 * below the cap even at 4 bytes a character. The rules enforce the same
 * number, so a write can never be the one that fails for size.
 */
export const MAX_RESULT_CHARS = 100_000;

export interface HelperResult {
  id: string;
  kind: HelperResultKind;
  /** ISO date the result is FOR: the census date, the shift, the MR. */
  forDate: string;
  /** What distinguishes two results of one kind on one date: the DPJP code, the shift. */
  subject: string;
  title: string;
  text: string;
  /** ms since epoch, from the saving device. Sort key; never a server timestamp,
   *  which reads back null until the write lands and would sort offline saves last. */
  savedAt: number;
  /** Set when the text was changed on the Tersimpan tab rather than re-saved from its tool. */
  editedAt: number | null;
  /** Soft delete (SPEC 1.5). ms, so Undo and the filter need no Timestamp. */
  deletedAt: number | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Lower-case, Firestore-safe, short. "ARB" → "arb", "" → "-". */
function slug(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned || '-';
}

/**
 * The record's id. Never contains `/`, never `.` or `..`, never `__x__` —
 * the three things Firestore refuses in an id.
 */
export function helperResultId(kind: HelperResultKind, forDate: string, subject: string): string {
  return `${kind}~${forDate}~${slug(subject)}`;
}

export function isHelperResultKind(value: unknown): value is HelperResultKind {
  return typeof value === 'string' && (HELPER_RESULT_KINDS as readonly string[]).includes(value);
}

/**
 * A stored record, or null when it is not one this version can show.
 *
 * Read defensively: the collection is written by every installed version of
 * the app, and an older or newer one may have left a shape this one does not
 * know. Such a record is skipped, not crashed on.
 */
export function readHelperResult(id: string, data: unknown): HelperResult | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;
  if (!isHelperResultKind(raw.kind)) return null;
  if (typeof raw.text !== 'string' || typeof raw.forDate !== 'string' || !ISO_DATE.test(raw.forDate)) {
    return null;
  }
  const savedAt = typeof raw.savedAt === 'number' && Number.isFinite(raw.savedAt) ? raw.savedAt : 0;
  const subject = typeof raw.subject === 'string' ? raw.subject : '';
  return {
    id,
    kind: raw.kind,
    forDate: raw.forDate,
    subject,
    title:
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title
        : defaultTitle(raw.kind, subject),
    text: raw.text,
    savedAt,
    editedAt: typeof raw.editedAt === 'number' ? raw.editedAt : null,
    deletedAt: typeof raw.deletedAt === 'number' ? raw.deletedAt : null,
  };
}

export function defaultTitle(kind: HelperResultKind, subject: string): string {
  const label = KIND_LABEL[kind];
  return subject.trim() ? `${label} ${subject.trim()}` : label;
}

/** Not deleted, newest first; ties (same millisecond) by id so the order is stable. */
export function liveResults(results: readonly HelperResult[]): HelperResult[] {
  return results
    .filter((result) => result.deletedAt === null)
    .sort((a, b) => b.savedAt - a.savedAt || a.id.localeCompare(b.id));
}

/**
 * The Tersimpan list's filter: one tool (or all), and a free-text search over
 * title and text — "ARB", a patient's name, an RM.
 */
export function filterResults(
  results: readonly HelperResult[],
  group: HelperResultGroup | null,
  query: string,
): HelperResult[] {
  const needle = query.trim().toLowerCase();
  return results.filter(
    (result) =>
      (group === null || KIND_GROUP[result.kind] === group) &&
      (!needle ||
        result.title.toLowerCase().includes(needle) ||
        result.text.toLowerCase().includes(needle)),
  );
}

/**
 * What the Simpan button should say for the text on screen.
 *
 *   'new'      — nothing saved for this kind/date/subject (or it was deleted)
 *   'same'     — saved, and identical: "Tersimpan"
 *   'changed'  — saved, but the tool's text has moved on: "Perbarui"
 *
 * Trailing whitespace is ignored: copying and re-pasting a message, or an
 * editor adding a final newline, is not a change worth a button.
 */
export function saveState(
  existing: HelperResult | undefined,
  text: string,
): 'new' | 'same' | 'changed' {
  if (!existing || existing.deletedAt !== null) return 'new';
  return existing.text.trimEnd() === text.trimEnd() ? 'same' : 'changed';
}

/** Results grouped by the date they are for, newest date first — the list's sections. */
export function groupByForDate(results: readonly HelperResult[]): Array<[string, HelperResult[]]> {
  const map = new Map<string, HelperResult[]>();
  for (const result of results) {
    const list = map.get(result.forDate);
    if (list) list.push(result);
    else map.set(result.forDate, [result]);
  }
  return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
}
