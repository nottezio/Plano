import type { PdfTextItem } from '@/lib/pdfItems';

import { parseDpjpRoster } from './parseDpjp';
import { parseJarkom } from './parseJarkom';
import { parsePediatri } from './parsePediatri';
import { parseJagaRoster } from './parseRoster';
import type { JagaRosterKind } from './sync';
import type { CompactPdfItem, ParsedFrom } from './types';

/**
 * Stored schedules are re-derived when their parser improves (2026-10-05).
 *
 * WHY. A schedule is parsed once, on import, and the parse is what gets stored
 * and synced. When the October DPJP parser was fixed, the copy already in
 * Avi's account was still the broken 27-day parse — the fix reached nobody
 * until the PDF was imported again, by hand, on a device running the new
 * version. A parser fix that needs every user to redo an import is a fix that
 * mostly does not arrive.
 *
 * So each import now keeps the PDF's positioned text (`sourceItems`) and the
 * parser version that read it. On load, a schedule read by an OLDER parser is
 * parsed again from its own source with the current one, and written back so
 * every device gets the corrected copy.
 *
 * Bump a kind's version whenever its parser's OUTPUT changes for some input.
 * A schedule imported before this existed has no source to re-read; it is
 * reported as `legacy`, and the screen asks for one re-import.
 */
export const PARSER_VERSION: Readonly<Record<JagaRosterKind, number>> = {
  // 2: weekday-anchored dates at the month boundary; `INT n` kept.
  roster: 2,
  // 2: split date fragments; column boundary from the sheet's own headers.
  dpjp: 2,
  pediatri: 1,
  jarkom: 1,
};

const round = (value: number): number => Math.round(value * 10) / 10;

export function compactItems(items: readonly PdfTextItem[]): CompactPdfItem[] {
  return items.map((item) => [round(item.x), round(item.y), item.text, item.page]);
}

export function expandItems(items: readonly CompactPdfItem[]): PdfTextItem[] {
  return items.map(([x, y, text, page]) => ({ x, y, text, page }));
}

/** What to store alongside a fresh parse. */
export function provenance(kind: JagaRosterKind, items: readonly PdfTextItem[]): Required<ParsedFrom> {
  return { parser: PARSER_VERSION[kind], sourceItems: compactItems(items) };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function storedVersion(stored: Record<string, unknown>): number {
  return typeof stored.parser === 'number' ? stored.parser : 1;
}

function validItems(value: unknown): value is CompactPdfItem[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        Array.isArray(item) &&
        typeof item[0] === 'number' &&
        typeof item[1] === 'number' &&
        typeof item[2] === 'string' &&
        typeof item[3] === 'number',
    )
  );
}

/** Read by an older parser and holding no source to re-read. */
export function isLegacy(kind: JagaRosterKind, stored: unknown): boolean {
  if (!isRecord(stored)) return false;
  return storedVersion(stored) < PARSER_VERSION[kind] && !validItems(stored.sourceItems);
}

function rowsOf(kind: JagaRosterKind, value: Record<string, unknown>): number {
  const list = kind === 'dpjp' ? value.days : kind === 'jarkom' ? value.entries : value.shifts;
  return Array.isArray(list) ? list.length : 0;
}

/**
 * The stored schedule, re-parsed if an older parser read it and its source is
 * kept. `changed` says whether to write it back.
 *
 * What the user did not produce by parsing is carried over untouched: when it
 * was imported and which file it was. A re-parse that reads NOTHING keeps the
 * stored copy — a parser regression must never erase a working schedule.
 */
export function upgradeParsed(
  kind: JagaRosterKind,
  stored: unknown,
): { value: unknown; changed: boolean } {
  if (!isRecord(stored)) return { value: stored, changed: false };
  if (storedVersion(stored) >= PARSER_VERSION[kind]) return { value: stored, changed: false };
  if (!validItems(stored.sourceItems)) return { value: stored, changed: false };

  const items = expandItems(stored.sourceItems);
  const shifts = Array.isArray(stored.shifts) ? stored.shifts : [];
  const firstDate =
    shifts.length > 0 && isRecord(shifts[0]) && typeof shifts[0].date === 'string' ? shifts[0].date : '';
  const year = Number(firstDate.slice(0, 4)) || new Date().getFullYear();

  const parsed: object =
    kind === 'roster'
      ? parseJagaRoster(items)
      : kind === 'dpjp'
        ? parseDpjpRoster(items)
        : kind === 'jarkom'
          ? parseJarkom(items)
          : parsePediatri(items, year);

  if (rowsOf(kind, parsed as Record<string, unknown>) === 0) return { value: stored, changed: false };

  return {
    value: {
      ...parsed,
      importedAt: stored.importedAt,
      ...(stored.source === undefined ? {} : { source: stored.source }),
      parser: PARSER_VERSION[kind],
      sourceItems: stored.sourceItems,
    },
    changed: true,
  };
}
