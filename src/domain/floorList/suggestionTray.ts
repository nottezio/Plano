import { chiefSuggestions, isJamDinas, nextJamDinas } from './chiefHandover';
import { suggestionActions, suggestionFor, suggestionWords, type FloorDoc, type RosterPatient, type StatusChange } from './floor';

/**
 * The "Saran" tray at the top of the List Maker (28 Oct 2026): every pending
 * suggestion, chief handover and "Plan menyebut H-1 / pulang / usul" alike, as
 * one list of rows with the same shape. Only ever a proposal: a row does
 * nothing until a tap on one of its actions, and Abaikan is always there.
 */

/** What a tap writes to the roster entry (the same fields the Atur panel writes). */
export interface TrayWrite {
  fields: Partial<RosterPatient>;
  /** Left out for Abaikan: a dismissal is not a status change. */
  log?: Pick<StatusChange, 'what'>;
}

export interface TrayAction {
  label: string;
  write: TrayWrite;
  /** The line shown for a moment after the tap ("H-1", "Chief → dr. Kirana"). */
  done: string;
}

export interface TrayRow {
  /** Unique across kinds and reports: a new SOAP is a new suggestion for the same patient. */
  id: string;
  kind: 'discharge' | 'chief';
  key: string;
  room: string;
  bed: string;
  name: string;
  /** The sentence, in three parts so the middle can be bold: "Plan menyebut", "H-1", "". */
  lead: string;
  strong: string;
  tail: string;
  actions: TrayAction[];
  dismiss: TrayAction;
}

export interface Tray {
  rows: TrayRow[];
  /** Outside jam dinas: how many patients change chief next time, and when (null = none). */
  later: { count: number; at: Date } | null;
}

const dr = (name: string): string => `dr. ${name.replace(/^dr(\.\s*|\s+)/i, '')}`;

/** "H-1 (dari saran Plan)" -> "H-1": the log line without its explanation. */
export const doneText = (what: string): string => what.replace(/\s*\([^)]*\)\s*$/, '');

export function buildTray(roster: readonly RosterPatient[], floor: FloorDoc, date: string, now: Date): Tray {
  const rows: TrayRow[] = [];

  for (const entry of roster) {
    const mark = suggestionFor(entry, date);
    if (mark === null) continue;
    rows.push({
      id: `d:${entry.key}:${entry.report.sentAt}`,
      kind: 'discharge',
      key: entry.key,
      room: entry.report.room,
      bed: entry.report.bed,
      name: entry.report.name,
      lead: 'Plan menyebut',
      strong: suggestionWords(mark),
      tail: '',
      actions: suggestionActions(entry, mark, date).map((action) => ({
        label: action.label,
        write: { fields: action.fields, log: { what: action.what } },
        done: doneText(action.what),
      })),
      dismiss: { label: 'Abaikan', write: { fields: { dismissed: entry.report.sentAt } }, done: 'Diabaikan' },
    });
  }

  const dinas = isJamDinas(now);
  const chief = chiefSuggestions(roster, floor, date, now);
  for (const { entry, from, to } of chief) {
    const done = `Chief → ${dr(to)}`;
    rows.push({
      id: `c:${entry.key}`,
      kind: 'chief',
      key: entry.key,
      room: entry.report.room,
      bed: entry.report.bed,
      name: entry.report.name,
      lead: `Chief ${from || 'belum ada'} →`,
      strong: dr(to),
      tail: '',
      actions: [
        {
          label: 'Terima',
          write: { fields: { chief: to, ...(entry.gantiChief ? { gantiChief: '' } : {}) }, log: { what: `${done} (saran jam dinas)` } },
          done,
        },
      ],
      dismiss: { label: 'Abaikan', write: { fields: { chiefDismissed: now.toISOString() } }, done: 'Diabaikan' },
    });
  }

  let later: Tray['later'] = null;
  if (!dinas) {
    const count = chiefSuggestions(roster, floor, date, now, { ignoreClock: true }).length;
    if (count > 0) later = { count, at: nextJamDinas(now) };
  }
  return { rows, later };
}
