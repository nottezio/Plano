import type { CensusEntry, ParsedSource, Place } from './maker';

/**
 * The census against the lists it came from (2026-10-11, Avi: "I need to
 * be able to easily compare the sensus list and the extracted sensus").
 *
 * Every patient block the parser read from each pasted list, in the list's
 * own order, paired with the census row it became — or marked as not in the
 * census. Plus the census rows that no list block accounts for (an AI row
 * that names a patient the lists do not have). Pairing is by the patient key
 * (RM, else the start of the line), the same key the census and the AI check
 * already use, so a duplicate listing ("Pasien Baru" and again below) points
 * at the same row.
 */

export type CompareOwner = 'mine' | 'other' | 'unassigned';

export interface CompareRowInput {
  key: string;
  place: Place;
  identity: string;
  diagnoses: readonly string[];
}

export interface CompareBlock {
  list: number;
  start: number;
  end: number;
  entry: CensusEntry;
  owner: CompareOwner;
  /** Index into `rows`, or null when this block is not in the census. */
  row: number | null;
}

export interface CompareRow extends CompareRowInput {
  index: number;
  /** "1" for the first patient of its place, as the message numbers it. */
  number: number;
  /** True when at least one list block was paired with this row. */
  found: boolean;
}

export interface CensusComparison {
  /** Per pasted list, its patient blocks in list order. */
  lists: CompareBlock[][];
  rows: CompareRow[];
  /** This DPJP's blocks that are not in the census. */
  missing: CompareBlock[];
  /** Census rows no list block accounts for. */
  unmatched: CompareRow[];
}

export function compareCensus(input: {
  sources: readonly ParsedSource[];
  code: string;
  rows: readonly CompareRowInput[];
}): CensusComparison {
  const code = input.code.toUpperCase();
  const rowByKey = new Map<string, number>();
  input.rows.forEach((row, index) => {
    if (!rowByKey.has(row.key)) rowByKey.set(row.key, index);
  });

  const perPlace = new Map<Place, number>();
  const rows: CompareRow[] = input.rows.map((row, index) => {
    const number = (perPlace.get(row.place) ?? 0) + 1;
    perPlace.set(row.place, number);
    return { ...row, index, number, found: false };
  });

  const lists = input.sources.map((source, list) =>
    source.entries
      .filter((entry) => entry.span !== undefined)
      .map((entry): CompareBlock => {
        const owner: CompareOwner = entry.dpjps.includes(code) ? 'mine' : entry.dpjps.length === 0 ? 'unassigned' : 'other';
        const row = rowByKey.get(entry.key) ?? null;
        if (row !== null) rows[row]!.found = true;
        return { list, start: entry.span!.start, end: entry.span!.end, entry, owner, row };
      }),
  );

  return {
    lists,
    rows,
    missing: lists.flat().filter((block) => block.owner === 'mine' && block.row === null),
    unmatched: rows.filter((row) => !row.found),
  };
}
