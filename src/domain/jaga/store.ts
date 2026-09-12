import type { DpjpRoster, JagaRoster, JarkomDirectory } from './types';

/**
 * Imported rosters live in localStorage, per device.
 *
 * They are reference documents, not clinical records: the same three PDFs are
 * on the programme's WhatsApp group and can be re-imported in ten seconds.
 * Putting them in Firestore would mean a schema, a sync path and a merge
 * question ("two devices imported different months") for data that is already
 * published elsewhere and replaced wholesale every month.
 *
 * If a shared copy is ever wanted, only these four functions change.
 */
const KEYS = {
  roster: 'visite.jaga.roster',
  dpjp: 'visite.jaga.dpjp',
  jarkom: 'visite.jaga.jarkom',
  sender: 'visite.jaga.sender',
  confirmed: 'visite.jaga.confirmed',
  names: 'visite.jaga.names',
} as const;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('[jaga] not saved', error);
  }
}

export const readRoster = (): JagaRoster | null => read<JagaRoster>(KEYS.roster);
export const writeRoster = (value: JagaRoster): void => write(KEYS.roster, value);
export const readDpjp = (): DpjpRoster | null => read<DpjpRoster>(KEYS.dpjp);
export const writeDpjp = (value: DpjpRoster): void => write(KEYS.dpjp, value);
export const readJarkom = (): JarkomDirectory | null => read<JarkomDirectory>(KEYS.jarkom);
export const writeJarkom = (value: JarkomDirectory): void => write(KEYS.jarkom, value);

export interface SenderIdentity {
  name: string;
  place: string;
}

export const readSender = (): SenderIdentity =>
  read<SenderIdentity>(KEYS.sender) ?? { name: '', place: '' };
export const writeSender = (value: SenderIdentity): void => write(KEYS.sender, value);

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
  all[confirmKey(date, shift)] = [...posts];
  write(KEYS.confirmed, all);
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
  return all;
}
