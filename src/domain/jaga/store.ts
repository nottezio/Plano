import type { DpjpRoster, JagaRoster, JarkomDirectory, PediatriRoster } from './types';
import type { JagaRosterKind, JagaState, JagaStateField } from './sync';
import { JAGA_MAP_FIELDS } from './sync';

/**
 * Konfirmasi Jaga data: localStorage on this device, synced to the account.
 *
 * localStorage stays the place the page reads from. Reads are synchronous,
 * work with no signal, and the page was built around them. What changed is
 * that every write here ALSO goes to the account through `JagaRemote`, and
 * changes from other devices are written back into localStorage by the sync
 * hook (`useJagaSync`). The merge rules live in `sync.ts`.
 *
 * This used to be deliberately per-device, on the reasoning that the PDFs are
 * on the WhatsApp group and re-importing takes ten seconds. That held for the
 * rosters and not for the working state: a confirmation ticked on a phone was
 * invisible on the ward PC, and the evening round is done on both.
 */
const KEYS = {
  roster: 'visite.jaga.roster',
  dpjp: 'visite.jaga.dpjp',
  jarkom: 'visite.jaga.jarkom',
  sender: 'visite.jaga.sender',
  confirmed: 'visite.jaga.confirmed',
  names: 'visite.jaga.names',
  posts: 'visite.jaga.posts',
  dpjpEdits: 'visite.jaga.dpjpEdits',
  religion: 'visite.jaga.religion',
  pediatri: 'visite.jaga.pediatri',
  owner: 'visite.jaga.owner',
} as const;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Where writes go besides localStorage. Set by the sync hook while signed in;
 * `null` otherwise, and then this module is exactly as local as it was.
 *
 * Module state rather than a parameter on every function, because the
 * callers are event handlers on one page and threading a uid through each of
 * them would change every call site for no gain in safety.
 */
export interface JagaRemote {
  putRoster(kind: JagaRosterKind, value: unknown): void;
  /** `key === null` writes the whole field; `value === null` deletes the key. */
  putState(field: JagaStateField, key: string | null, value: unknown): void;
}

let remote: JagaRemote | null = null;

export function setJagaRemote(next: JagaRemote | null): void {
  remote = next;
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('[jaga] not saved', error);
  }
}

export const readRoster = (): JagaRoster | null => read<JagaRoster>(KEYS.roster);
export const readDpjp = (): DpjpRoster | null => read<DpjpRoster>(KEYS.dpjp);
export const readPediatri = (): PediatriRoster | null => read<PediatriRoster>(KEYS.pediatri);
export const readJarkom = (): JarkomDirectory | null => read<JarkomDirectory>(KEYS.jarkom);

function writeRosterKind(kind: JagaRosterKind, value: unknown): void {
  write(KEYS[kind], value);
  remote?.putRoster(kind, value);
}

export const writeRoster = (value: JagaRoster): void => writeRosterKind('roster', value);
export const writeDpjp = (value: DpjpRoster): void => writeRosterKind('dpjp', value);
export const writePediatri = (value: PediatriRoster): void => writeRosterKind('pediatri', value);
export const writeJarkom = (value: JarkomDirectory): void => writeRosterKind('jarkom', value);

export interface SenderIdentity {
  name: string;
  place: string;
}

export const readSender = (): SenderIdentity =>
  read<SenderIdentity>(KEYS.sender) ?? { name: '', place: '' };
export const writeSender = (value: SenderIdentity): void => {
  write(KEYS.sender, value);
  remote?.putState('sender', null, value);
};

/**
 * Who has replied, per date and shift.
 *
 * Keyed by both because a weekend has two teams and confirming the Pagi chief
 * says nothing about the Malam one — a single per-date set would mark half the
 * board confirmed as soon as the first shift was done.
 *
 * Kept forever rather than cleared nightly. It is a few bytes per jaga, and
 * the alternative is a cleanup rule that has to decide when a date is safely
 * past — which on a night shift crossing midnight is exactly the question
 * nobody wants a background task answering.
 */
type ConfirmedMap = Record<string, string[]>;

const confirmKey = (date: string, shift: string): string => `${date}:${shift}`;

export function readConfirmed(date: string, shift: string): Set<string> {
  const all = read<ConfirmedMap>(KEYS.confirmed) ?? {};
  return new Set(all[confirmKey(date, shift)] ?? []);
}

export function writeConfirmed(date: string, shift: string, posts: ReadonlySet<string>): void {
  const all = read<ConfirmedMap>(KEYS.confirmed) ?? {};
  const key = confirmKey(date, shift);
  all[key] = [...posts];
  write(KEYS.confirmed, all);
  remote?.putState('confirmed', key, all[key]);
}

/**
 * Manual name overrides, keyed by the roster's initials.
 *
 * Matching the roster legend to the Jarkom sheet is fuzzy by necessity — the
 * two documents are typed by different people and disagree by a letter on real
 * colleagues — and 14 of 104 names have no Jarkom row at all. That residue is
 * not going away by tuning the matcher, and the cost of getting one wrong is
 * naming the wrong person in a report that goes to a consultant.
 *
 * So the resolved name is correctable, and the correction is remembered
 * against the INITIALS rather than the date: `AV` is the same person in every
 * shift they appear in, so fixing them once fixes every Formasi they are ever
 * in, including the ones already generated.
 *
 * An override always wins. It is the only source in this feature that a person
 * typed deliberately, and a parser has no standing to overrule it.
 */
export type NameOverrides = Record<string, string>;

export const readNameOverrides = (): NameOverrides => read<NameOverrides>(KEYS.names) ?? {};

export function setNameOverride(initials: string, name: string): NameOverrides {
  const all = readNameOverrides();
  // An emptied field REMOVES the override rather than storing a blank — an
  // empty string would otherwise win over the parsed name and print nothing.
  if (name.trim()) all[initials] = name.trim();
  else delete all[initials];
  write(KEYS.names, all);
  remote?.putState('names', initials, all[initials] ?? null);
  return all;
}

/**
 * Who is ACTUALLY on a post, for one date and one shift.
 *
 * Deliberately separate from `NameOverrides`, which is keyed by initials and
 * fixes who an initial REFERS TO — a permanent correction to a bad match,
 * right in every shift that person appears in.
 *
 * A tukar jaga is the opposite kind of fact: the roster is correct about the
 * person, and wrong about this one day. Storing it by initials would rewrite
 * that resident's name in every other shift on the board, which is a worse
 * error than the one being fixed.
 *
 * Also how an empty post gets filled. Paediatrics keeps its own roster and its
 * column is blank in every row, so its name can only ever come from here.
 */
export interface PostSwap {
  /** What the Formasi prints. */
  name: string;
  /** Set when the person was picked from the directory rather than typed. */
  initials?: string;
  /**
   * Their agama, carried with them.
   *
   * The whole reason a swap stores a person rather than a string: the
   * confirmation message opens with a greeting chosen by religion, and a
   * swapped-in resident who arrives as bare text would silently get the
   * neutral greeting — or worse, the previous occupant's.
   */
  muslim?: boolean;
}

type PostMap = Record<string, Record<string, PostSwap>>;

const postKey = (date: string, shift: string): string => `${date}:${shift}`;

export function readPostOverrides(date: string, shift: string): Record<string, PostSwap> {
  return (read<PostMap>(KEYS.posts) ?? {})[postKey(date, shift)] ?? {};
}

export function setPostOverride(
  date: string,
  shift: string,
  postId: string,
  swap: PostSwap | null,
): Record<string, PostSwap> {
  const all = read<PostMap>(KEYS.posts) ?? {};
  const key = postKey(date, shift);
  const day = { ...(all[key] ?? {}) };
  // A cleared swap falls back to the roster rather than printing blank —
  // undoing a swap should restore what the schedule said, not erase the post.
  if (swap && swap.name.trim()) day[postId] = { ...swap, name: swap.name.trim() };
  else delete day[postId];
  all[key] = day;
  write(KEYS.posts, all);
  remote?.putState('posts', key, Object.keys(day).length > 0 ? day : null);
  return day;
}

/**
 * Religion, corrected by hand, keyed by initials.
 *
 * Jarkom is a semester old and the rota is not, so a resident who joined since
 * has no row and no agama — and the greeting falls back to the neutral form
 * for them forever. This is the way to fix that, and it is by INITIALS rather
 * than by date: a person's religion is not a property of a shift.
 *
 * Three states, not two. `undefined` means "whatever Jarkom says", which is
 * different from an explicit answer — otherwise the first time anyone opened
 * this control it would commit a guess for everybody.
 */
export function readReligion(): Record<string, boolean> {
  return read<Record<string, boolean>>(KEYS.religion) ?? {};
}

export function setReligion(initials: string, muslim: boolean | null): Record<string, boolean> {
  const all = readReligion();
  if (muslim === null) delete all[initials];
  else all[initials] = muslim;
  write(KEYS.religion, all);
  remote?.putState('religion', initials, muslim);
  return all;
}

/**
 * A consultant swap, by date.
 *
 * By date and not by shift: the DPJP roster is published per calendar day, and
 * the pair after 00.00 is the next day's row — so an edit to "tomorrow's DPJP"
 * made tonight is the same edit as "today's DPJP" made tomorrow, and keying it
 * any other way would need it entered twice.
 */
export interface DpjpEdit {
  utama?: string;
  tindakan?: string;
}

export function readDpjpEdit(date: string): DpjpEdit {
  return (read<Record<string, DpjpEdit>>(KEYS.dpjpEdits) ?? {})[date] ?? {};
}

export function setDpjpEdit(date: string, edit: DpjpEdit): DpjpEdit {
  const all = read<Record<string, DpjpEdit>>(KEYS.dpjpEdits) ?? {};
  const next: DpjpEdit = {};
  if (edit.utama?.trim()) next.utama = edit.utama.trim();
  if (edit.tindakan?.trim()) next.tindakan = edit.tindakan.trim();
  if (Object.keys(next).length > 0) all[date] = next;
  else delete all[date];
  write(KEYS.dpjpEdits, all);
  remote?.putState('dpjpEdits', date, all[date] ?? null);
  return next;
}

/* ------------------------------------------------------------------------ */
/* Whole-state access, for the sync hook only.                              */
/* ------------------------------------------------------------------------ */

const STATE_KEYS: Record<JagaStateField, string> = {
  sender: KEYS.sender,
  names: KEYS.names,
  religion: KEYS.religion,
  confirmed: KEYS.confirmed,
  posts: KEYS.posts,
  dpjpEdits: KEYS.dpjpEdits,
};

export function readRosterKind(kind: JagaRosterKind): unknown {
  return read<unknown>(KEYS[kind]);
}

/**
 * Store a roster that came FROM the account. localStorage only: sending it
 * back would be an echo. Returns whether anything changed, so the page
 * re-reads only when it has to.
 */
export function applyRosterKind(kind: JagaRosterKind, value: unknown): boolean {
  const before = localStorage.getItem(KEYS[kind]);
  const after = JSON.stringify(value);
  if (before === after) return false;
  write(KEYS[kind], value);
  return true;
}

export function readJagaState(): JagaState {
  const state: JagaState = {};
  const sender = read<unknown>(KEYS.sender);
  if (sender !== null) state.sender = sender;
  for (const field of JAGA_MAP_FIELDS) {
    const value = read<Record<string, unknown>>(STATE_KEYS[field]);
    if (value) state[field] = value;
  }
  return state;
}

/** Store state that came from the account. localStorage only, like above. */
export function applyJagaState(state: JagaState): boolean {
  let changed = false;
  const fields: JagaStateField[] = ['sender', ...JAGA_MAP_FIELDS];
  for (const field of fields) {
    const value = state[field];
    if (value === undefined) continue;
    const after = JSON.stringify(value);
    if (localStorage.getItem(STATE_KEYS[field]) === after) continue;
    write(STATE_KEYS[field], value);
    changed = true;
  }
  return changed;
}

/**
 * Which account this device's local copy belongs to.
 *
 * localStorage belongs to the browser, not to a person. On a shared ward PC,
 * the next resident to sign in would otherwise have the previous one's ticks,
 * swaps and sender name uploaded into THEIR account at the first sync. So the
 * copy is claimed by the account that syncs it. A different account starts
 * from its own data, and the local copy is cleared first.
 *
 * Unclaimed data (from before sync existed) goes to the first account that
 * syncs on this device. Before this release there was only one user per
 * device in practice, so that is its owner.
 */
export function claimJagaLocal(uid: string): boolean {
  const owner = read<string>(KEYS.owner);
  if (owner === uid) return false;
  let cleared = false;
  if (owner !== null) {
    for (const [name, key] of Object.entries(KEYS)) {
      if (name === 'owner') continue;
      try {
        localStorage.removeItem(key);
      } catch {
        // Storage unavailable: nothing to clear, and nothing will be read.
      }
    }
    cleared = true;
  }
  write(KEYS.owner, uid);
  return cleared;
}

/**
 * Put one shift's Formasi back to the imported schedule.
 *
 * Clears exactly what makes it differ from the PDFs:
 *   - the tukar jaga on this date and shift;
 *   - the DPJP swaps for the dates this Formasi prints (the shift's date and
 *     the one after 00.00). Those are keyed by date, so the other shift on
 *     the same date loses them too. The button says so.
 *   - the confirmation ticks of posts that HAD a swap: a tick recorded that
 *     the swapped-in resident replied, and after the reset that post names
 *     somebody else.
 *
 * Kept: name corrections ("Selalu") and religion, which are facts about a
 * person rather than about this shift, and ticks on posts nobody swapped.
 */
export function resetShiftEdits(
  date: string,
  shift: string,
  dpjpDates: readonly string[],
): void {
  const swapped = Object.keys(readPostOverrides(date, shift));
  for (const postId of swapped) setPostOverride(date, shift, postId, null);
  for (const day of dpjpDates) {
    if (Object.keys(readDpjpEdit(day)).length > 0) setDpjpEdit(day, {});
  }
  if (swapped.length > 0) {
    const ticks = readConfirmed(date, shift);
    const kept = new Set([...ticks].filter((postId) => !swapped.includes(postId)));
    if (kept.size !== ticks.size) writeConfirmed(date, shift, kept);
  }
}

/** How many edits a reset would clear, so the button can say it, or hide. */
export function countShiftEdits(
  date: string,
  shift: string,
  dpjpDates: readonly string[],
): { swaps: number; dpjp: number } {
  return {
    swaps: Object.keys(readPostOverrides(date, shift)).length,
    dpjp: dpjpDates.filter((day) => Object.keys(readDpjpEdit(day)).length > 0).length,
  };
}
