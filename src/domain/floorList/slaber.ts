import { DPJPS, dpjpsNamedIn } from '@/domain/dpjp';
import type { RosterPatient } from './floor';
import type { FloorPatient } from './report';

/**
 * The nurses' handover sheet ("slaber", "Laporan dinas … / timbang terima",
 * a Word table: BED | NAMA | SITUASI | BACKGROUND | DIAGNOSA | … | DPJP + DR
 * KJS | …) checked against the list (13.12, Avi: "verify the list by
 * comparing the nurses' slaber with the List Maker").
 *
 * The sheet has every patient on the floor, cardiology or not. A row is ours
 * when its DPJP column names one of our DPJPs (utama, KJS Kardio, KJS
 * Aritmia…) or a cardiologist (Sp.JP); BTKV-only and other departments are
 * not on the cardiology list. Matched to the list by RM, else by name.
 */

export interface SlaberRow {
  room: string;
  bed: string;
  name: string;
  rm: string;
  /** Our DPJPs named in the DPJP column (any role). */
  dpjpIds: string[];
  /** Cardiology involved: one of ours, or any Sp.JP. */
  cardio: boolean;
  /** The DPJP column as written, for display. */
  dpjpText: string;
}

export interface Slaber {
  /** "SENIN, 12-10-2026" as written. */
  day: string;
  /** "MALAM" / "PAGI" / "SORE" as written. */
  shift: string;
  rows: SlaberRow[];
}

const BTKV_IDS = new Set(DPJPS.filter((d) => /BTKV/i.test(d.name)).map((d) => d.id));

const decode = (text: string): string =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');

/** A cell's text: paragraphs as lines, breaks as newlines. */
function cellText(xml: string): string {
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g) ?? [];
  return paragraphs
    .map((p) =>
      [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:br\s*\/>|<w:cr\s*\/>|<w:tab\s*\/>/g)]
        .map((m) => (m[1] !== undefined ? decode(m[1]) : m[0].startsWith('<w:tab') ? ' ' : '\n'))
        .join(''),
    )
    .join('\n')
    .trim();
}

interface Cell {
  /** The grid column it starts at (merged cells span several). */
  col: number;
  text: string;
}

/**
 * The top-level `<w:name>` elements of a fragment, nesting respected: the
 * sheet has small tables (vital signs) inside its cells, and a plain
 * non-greedy match ended a row at the first nested `</w:tr>`.
 */
function topLevel(xml: string, name: string): string[] {
  const re = new RegExp(`<${name}(?=[\\s>/])[^>]*?(/?)>|</${name}>`, 'g');
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  for (const m of xml.matchAll(re)) {
    const closing = m[0].startsWith('</');
    if (!closing && m[1] === '/') {
      if (depth === 0) out.push(m[0]);
      continue;
    }
    if (!closing) {
      if (depth === 0) start = m.index ?? 0;
      depth += 1;
    } else if (depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) out.push(xml.slice(start, (m.index ?? 0) + m[0].length));
    }
  }
  return out;
}

/** The rows of every top-level table, each cell at its grid column. */
function tableRows(xml: string): Cell[][] {
  const rows: Cell[][] = [];
  for (const table of topLevel(xml, 'w:tbl')) {
    const inner = table.replace(/^<w:tbl[^>]*>/, '').replace(/<\/w:tbl>$/, '');
    for (const row of topLevel(inner, 'w:tr')) {
      const body = row.replace(/^<w:tr[^>]*>/, '').replace(/<\/w:tr>$/, '');
      let col = 0;
      const cells: Cell[] = [];
      for (const cell of topLevel(body, 'w:tc')) {
        // The cell's own properties come first, before any nested table.
        const span = Number(/^<w:tc[^>]*>\s*<w:tcPr>[\s\S]*?<w:gridSpan w:val="(\d+)"/.exec(cell)?.[1] ?? '1');
        // A nested table's text is not the cell's own (vital signs inside SITUASI).
        const own = cell.replace(/<w:tbl(?=[\s>])[\s\S]*<\/w:tbl>/g, '');
        cells.push({ col, text: cellText(own) });
        col += span;
      }
      rows.push(cells);
    }
  }
  return rows;
}

const at = (row: Cell[], col: number): string => row.find((c) => c.col === col)?.text ?? '';

/** "420 BED 1", "420\nBED\n2", "413\nBed 2", "401" → room, bed. */
export function readBed(text: string): { room: string; bed: string } {
  const flat = text.replace(/\s+/g, ' ').trim();
  const room = /\b(\d{3}[A-Za-z]?)\b/.exec(flat)?.[1] ?? '';
  const bed = /\bbed\s*:?\s*(\d+)/i.exec(flat)?.[1] ?? '';
  return { room, bed };
}

/** The patient cell: name on the first line, then "RM : 1729366" (or the number alone). */
export function readNameCell(text: string): { name: string; rm: string } {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const name = (lines[0] ?? '').replace(/\s+/g, ' ');
  const rm = /\bRM\s*[:;.]?\s*(\d{5,10})/i.exec(text)?.[1] ?? lines.find((l) => /^\d{5,10}$/.test(l)) ?? '';
  return { name, rm };
}

export function readSlaber(documentXml: string): Slaber {
  const rows = tableRows(documentXml);
  const all = rows.flat().map((c) => c.text).join('\n');
  const day = /HARI\s*\/\s*TANGGAL\s*:\s*([^\n]+)/i.exec(all)?.[1]?.trim() ?? '';
  const shift = /SHIFT\s*:\s*([A-Za-z]+)/i.exec(all)?.[1]?.trim() ?? '';
  const headerAt = rows.findIndex((row) => row.some((c) => /^BED\b/i.test(c.text)) && row.some((c) => /^NAMA\b/i.test(c.text)));
  if (headerAt === -1) return { day, shift, rows: [] };
  const header = rows[headerAt]!;
  const colOf = (re: RegExp): number => header.find((c) => re.test(c.text))?.col ?? -1;
  const bedCol = colOf(/^BED\b/i);
  const nameCol = colOf(/^NAMA\b/i);
  const dpjpCol = colOf(/DPJP/i);
  const out: SlaberRow[] = [];
  for (const row of rows.slice(headerAt + 1)) {
    /*
      The cells are found by what they hold, the header column only as a
      fallback: rows of the same sheet split and merge cells differently
      (one SITUASI cell or two), so a column number drifts from row to row.
    */
    const nameCell = row.find((c) => /\bRM\s*[:;.]|\bTTL\b|\bMRS\b/i.test(c.text))?.text ?? at(row, nameCol);
    const { name, rm } = readNameCell(nameCell);
    // A patient row has an RM; the summary rows under the table do not.
    if (!rm) continue;
    const { room, bed } = readBed(row[0]?.text || at(row, bedCol));
    const dpjpText = row.find((c) => /^DPJP\b/i.test(c.text))?.text ?? (dpjpCol >= 0 ? at(row, dpjpCol) : '');
    const named = dpjpsNamedIn(dpjpText);
    const dpjpIds = named.filter((id) => !BTKV_IDS.has(id));
    out.push({ room, bed, name, rm, dpjpIds, cardio: dpjpIds.length > 0 || /\bSp\.?\s*JP\b/i.test(dpjpText), dpjpText });
  }
  return { day, shift, rows: out };
}

// ── comparison ─────────────────────────────────────────────────────────────

/** Names compared without titles, punctuation or case ("TN. H. MUH USMAN, A.MA.PD" ~ "Tn. H. Muh Usman"). */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/,.*$/, '')
    .replace(/\b(?:tn|ny|nn|an|by|sdr|sdri|dr|dra|drs|ir|h|hj|st|prof)\b\.?/g, ' ')
    .replace(/[^a-z]/g, '');
}

const rmKey = (rm: string): string => rm.replace(/\D/g, '').replace(/^0+/, '');

export interface SlaberCheck {
  /** On the sheet with cardiology, not on the list (maybe a missed patient). */
  missing: Array<{ row: SlaberRow; left: RosterPatient | null }>;
  /** On the list, not on the sheet (gone, or the sheet is behind). */
  notOnSheet: FloorPatient[];
  /** On both, another room or bed. */
  placeDiffers: Array<{ row: SlaberRow; patient: FloorPatient }>;
  /** On both and in the same place. */
  matched: number;
  /** Sheet rows without cardiology (not expected on the list). */
  others: number;
}

export function checkSlaber(sheet: Slaber, active: readonly FloorPatient[], roster: readonly RosterPatient[]): SlaberCheck {
  const byRm = new Map(active.filter((p) => p.rm).map((p) => [rmKey(p.rm), p]));
  const byName = new Map(active.map((p) => [nameKey(p.name), p]));
  const leftByRm = new Map(roster.filter((p) => p.status !== 'dirawat' && p.report.rm).map((p) => [rmKey(p.report.rm), p]));
  const seen = new Set<string>();
  const out: SlaberCheck = { missing: [], notOnSheet: [], placeDiffers: [], matched: 0, others: 0 };
  for (const row of sheet.rows) {
    const found = (row.rm && byRm.get(rmKey(row.rm))) || byName.get(nameKey(row.name)) || null;
    if (found) {
      seen.add(found.key);
      const same = found.room === row.room && (!row.bed || !found.bed || found.bed === row.bed);
      if (same) out.matched += 1;
      else out.placeDiffers.push({ row, patient: found });
      continue;
    }
    if (!row.cardio) {
      out.others += 1;
      continue;
    }
    out.missing.push({ row, left: (row.rm && leftByRm.get(rmKey(row.rm))) || null });
  }
  out.notOnSheet = active.filter((p) => !seen.has(p.key));
  return out;
}
