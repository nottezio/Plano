import { DPJPS } from '@/domain/dpjp';
import { MR_DIVIDER, dayName } from '@/domain/mr/morningReport';

/**
 * Sensus maker — one consultant's patients, pulled out of the ward lists.
 *
 * Every morning each ward's senior sends a list: PJT Lantai 4, PJT Lantai 5
 * and 6, CVCU/HCU/ICU PJT, RSWS, RSUH. Each groups patients by DPJP, and each
 * spells things its own way: the DPJP code sits first, second or last on the
 * identity line; the diagnosis block is headed "Diagnosis:", "Diagnosa ;" or
 * "Mohon izin kami assess dengan"; the CVCU list puts the bed on its own line.
 * The census for one DPJP is those patients, regrouped by place, with only
 * their diagnoses.
 *
 * Text in, text out, no storage — so every format is tested against
 * anonymised copies of the real lists.
 *
 * SELECTION, NOT REWRITE. The identity line and every diagnosis line are the
 * sender's own text. Three things are changed, and only these:
 * - On PJT lists, the DPJP code moves to the front ("417 Bed 3/MZ/…" →
 *   "MZ/417 Bed 3/…"), the shape of the census sample. Anything after a
 *   trailing code (the resident's name: "…/dr.ZD/resa") is dropped.
 * - Bullets "•" and "*" become "-"; invisible joiners are removed.
 * - Numbering restarts in each group.
 */

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export type SourceKind = 'pjt-ward' | 'pjt-icu' | 'rsws' | 'rsuh' | 'unknown';

/** Where a patient is, as the census groups them. */
export type Place = 'RSWS' | 'RSUH' | 'CVCU' | 'LT4' | 'LT5' | 'LT6' | 'PJT';

export const PLACE_ORDER: readonly Place[] = ['RSWS', 'RSUH', 'CVCU', 'LT4', 'LT5', 'LT6', 'PJT'];

export const PLACE_LABEL: Record<Place, string> = {
  RSWS: 'RSWS',
  RSUH: 'RSUH',
  CVCU: 'CVCU/HCU/ICU PJT',
  LT4: 'PJT Lt.4',
  LT5: 'PJT Lt.5',
  LT6: 'PJT Lt.6',
  PJT: 'PJT',
};

export const SOURCE_LABEL: Record<SourceKind, string> = {
  'pjt-ward': 'PJT bangsal',
  'pjt-icu': 'CVCU/HCU/ICU PJT',
  rsws: 'RSWS',
  rsuh: 'RSUH',
  unknown: 'Tidak dikenali',
};

export interface CensusEntry {
  /** DPJP codes, uppercase. More than one for a joint patient ("dr.ZD-dr.AAU"). */
  dpjps: string[];
  /** From the section header, used only when the line names no DPJP. */
  fromHeader: boolean;
  place: Place;
  /**
   * The identity line, ready to print once a DPJP code is put in front:
   * `prefix` is null when the line is printed as written (it already starts
   * with the DPJP, the hospital lists' shape).
   */
  location: string | null;
  rest: string;
  verbatim: boolean;
  diagnoses: string[];
  /** Listed under "Pasien Baru": also listed in full below, so the lesser copy. */
  fromNewList: boolean;
  /** RM digits without leading zeros, else the normalised start of the line. */
  key: string;
  /** For warnings: the line as it was. */
  raw: string;
}

export interface ParsedSource {
  kind: SourceKind;
  /** e.g. "PJT Lt. 4", "RSWS", from the list's own header. */
  label: string;
  entries: CensusEntry[];
  /** DPJP codes named in the section headers, uppercase. */
  headerDpjps: string[];
}

// ───────────────────────────────────────────────────────────────
// Line cleaning
// ───────────────────────────────────────────────────────────────

const INVISIBLE_RE = /[​-‏⁠﻿­]/g;
/** Emoji, variation selectors and ZWJ — markers like 🔵 🔴 🫀 👶🏻. */
const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️‍]/gu;

function clean(line: string): string {
  return line.replace(INVISIBLE_RE, '').replace(EMOJI_RE, '').replace(/ /g, ' ');
}

/** For matching headers: no emphasis marks, no emoji, single spaces. */
function plain(line: string): string {
  return clean(line).replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();
}

function isSeparator(line: string): boolean {
  return /^[\s\-—–_=.]{5,}$/.test(clean(line)) && /[-—–_=]{3,}/.test(line);
}

// ───────────────────────────────────────────────────────────────
// DPJP codes
// ───────────────────────────────────────────────────────────────

/** The registry's codes plus every code a pasted list names in a header. */
export function knownCodes(sources: readonly ParsedSource[]): Set<string> {
  const codes = new Set(DPJPS.map((dpjp) => dpjp.initials.toUpperCase()));
  for (const source of sources) for (const code of source.headerDpjps) codes.add(code);
  return codes;
}

const TITLE = String.raw`(?:(?:dr|prof|dokter)\.?\s*)`;
const SECTION_RE = new RegExp(String.raw`^${TITLE}+([A-Za-z]{2,4})\b\s*(?:[:(]|$)`, 'i');

/** "*🫀 dr. KS : 2 pasien*", "Prof.MZ (1 Pasien)" → "KS" / "MZ". */
export function sectionDpjp(line: string): string | null {
  const text = plain(line);
  if (!/pasi?e?n|paisen|pasen/i.test(text)) return null;
  const match = SECTION_RE.exec(text);
  return match ? match[1]!.toUpperCase() : null;
}

const CODE_RE = new RegExp(
  String.raw`^(${TITLE}*)([A-Za-z]{2,4})(?:\s*\([^)]*\))?(?:\s*-\s*(${TITLE}*)([A-Za-z]{2,4}))?\s*\*?$`,
  'i',
);

/**
 * The DPJP codes a slash segment names, or null.
 *
 * A bare code must be written in capitals ("MZ"); with a title any case goes
 * ("prof.MZ", "dr.zd"). Without that rule a resident's name — "resa", "tika"
 * — would read as a code. And it must be a code someone actually uses: "PCC"
 * and "BTKV" are capitals too.
 */
export function segmentCodes(segment: string, known: ReadonlySet<string>): string[] | null {
  const text = plain(segment);
  const match = CODE_RE.exec(text);
  if (!match) return null;
  const out: string[] = [];
  const take = (title: string | undefined, code: string | undefined): boolean => {
    if (!code) return true;
    const upper = code.toUpperCase();
    if (!title && code !== upper) return false;
    if (!known.has(upper)) return false;
    out.push(upper);
    return true;
  };
  if (!take(match[1], match[2])) return null;
  if (!take(match[3], match[4])) return null;
  return out.length > 0 ? out : null;
}

// ───────────────────────────────────────────────────────────────
// Source detection
// ───────────────────────────────────────────────────────────────

export function detectSource(text: string): { kind: SourceKind; label: string; floor: Place | null } {
  const lines = text.split(/\r?\n/).map(plain);
  const header = lines.find((line) => /list\s+pasien/i.test(line) && !/^\d/.test(line)) ?? '';
  if (/cvcu|hcu|icu/i.test(header)) return { kind: 'pjt-icu', label: 'CVCU/HCU/ICU PJT', floor: 'CVCU' };
  if (/\brsuh\b/i.test(header)) return { kind: 'rsuh', label: 'RSUH', floor: 'RSUH' };
  if (/\brsws\b/i.test(header)) return { kind: 'rsws', label: 'RSWS', floor: 'RSWS' };
  const floor = /(?:lantai|lt)\.?\s*([456])/i.exec(header);
  if (floor) {
    const floors = [...header.matchAll(/(?:lantai|lt)\.?\s*([456])/gi)].map((m) => m[1]).join(' dan ');
    return { kind: 'pjt-ward', label: `PJT Lt. ${floors}`, floor: `LT${floor[1]}` as Place };
  }
  return { kind: 'unknown', label: 'Tidak dikenali', floor: null };
}

// ───────────────────────────────────────────────────────────────
// Parsing one list
// ───────────────────────────────────────────────────────────────

/** "1. …", "3..420 Bed 1/…", "1.518 bed 1/…", "🔵 4. PT / …". */
const ENTRY_RE = /^\s*[*_\s]*(\d{1,3})\s*\.+\s*(\S.*)$/;
/** A real patient line names a person, a record number or a birth date. */
const IDENTITY_RE = /\b(?:RM|Tn|Ny|Nn|An|By|Sdr|Nona)\b\.?|\d{6,}|\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b|\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b/i;
const ICU_LOCATION_RE = /^\(?\s*(?:cvcu|hcu|icu)\b/i;

const DX_HEAD_RE = /^(?:diagnos[ai]s?|diagnosa)\b\s*[:;]?\s*(.*)$/i;
const ASSESS_HEAD_RE = /^mohon\s+i[zj]in\s+(?:pasien\s+)?kami\s+assess?\w*(?:\s+dengan)?\s*[:;]?\s*(.*)$/i;
const DX_STOP_RE =
  /^(?:mohon\s+i[zj]in|plan\b|planning\b|premedikasi|selesai|terapi\b|instruksi|ts\b|[atpid]\s*\/|tabe\b|note\b|catatan\b|diagnos)/i;
const EXCLUDED_SECTION_RE = /^pasien\s+(?:pulang|meninggal|pindah)\b/i;
const NEW_SECTION_RE = /^pasien\s+baru\b/i;

function looksLikeLocation(segment: string): boolean {
  const text = plain(segment);
  if (!text) return false;
  if (/^(?:tn|ny|nn|an|by|sdr|nona|h)\b\.?/i.test(text)) return false;
  if (/^rm\b/i.test(text) || /^\d{6,}$/.test(text)) return false;
  if (/^\d{1,2}[-/ ]\d{1,2}[-/ ]\d{2,4}$/.test(text)) return false;
  return /\d/.test(text) || /\b(?:bed|kamar|vip|supervip|cvcu|hcu|icu|igd|lontara|pcc|lantai|lt|ruang|isolasi|perinatologi|picu|nicu)\b/i.test(text);
}

/** The RM (digits, leading zeros dropped) or the line's first words. */
export function entryKey(line: string): string {
  const text = plain(line);
  const rm = /\bRM\s*:?\s*0*(\d{5,9})/i.exec(text) ?? /(?:^|[^\d-])0*(\d{6,9})(?![\d-])/.exec(text);
  if (rm) return `rm:${rm[1]}`;
  return `line:${text.toLowerCase().replace(/[^a-z]+/g, ' ').trim().slice(0, 40)}`;
}

function normaliseDxLine(line: string): string {
  const text = clean(line).replace(/\s+$/, '');
  const bullet = /^\s*(?:[•*·▪◦‣-]|•)\s*(.*)$/.exec(text);
  if (bullet) return `- ${(bullet[1] ?? '').trim()}`;
  return text.trim();
}

interface Segment {
  text: string;
  start: number;
  end: number;
}

function segments(line: string): Segment[] {
  const out: Segment[] = [];
  let start = 0;
  for (let i = 0; i <= line.length; i += 1) {
    if (i === line.length || line[i] === '/') {
      out.push({ text: line.slice(start, i), start, end: i });
      start = i + 1;
    }
  }
  return out;
}

function tidy(text: string): string {
  return text
    .replace(/^[\s/]+|[\s/*]+$/g, '')
    // A resident's nickname in brackets at the end — "(Resa)", "(Tika)" —
    // is for the ward, not the consultant. Capitalised words only: "(EP)"
    // and "(KJS …)" say something about the patient and stay.
    .replace(/\s*\(\s*[A-Z][a-z]{2,10}\s*\)\s*$/, '')
    .replace(/[\s/*]+$/, '');
}

/**
 * The identity line, split around its DPJP code.
 *
 * `heading` is the CVCU list's bed line ("CVCU Bed 11"), which there stands
 * on its own above the patient.
 */
function splitIdentity(
  line: string,
  heading: string | null,
  known: ReadonlySet<string>,
  hospital: boolean,
): { codes: string[]; location: string | null; rest: string; verbatim: boolean } {
  const text = clean(line).replace(/^\s*kosong(?=\s*(?:tn|ny|nn|an|by)\b)/i, '').trim();
  const segs = segments(text);
  let tokenAt = -1;
  let codes: string[] = [];
  for (let i = 0; i < segs.length; i += 1) {
    const found = segmentCodes(segs[i]!.text, known);
    if (found) {
      tokenAt = i;
      codes = found;
      break;
    }
  }

  // The hospital lists already lead with the DPJP; their line is printed as
  // written. So is any line whose code is the first segment.
  if (hospital || (tokenAt === 0 && !heading)) {
    return { codes, location: null, rest: tidy(text), verbatim: true };
  }

  if (heading) {
    const end = tokenAt > 0 ? segs[tokenAt]!.start : text.length;
    return { codes, location: tidy(heading), rest: tidy(text.slice(0, end)), verbatim: false };
  }

  if (tokenAt === 1) {
    return {
      codes,
      location: tidy(segs[0]!.text),
      rest: tidy(text.slice(segs[1]!.end + 1)),
      verbatim: false,
    };
  }

  const hasLocation = looksLikeLocation(segs[0]!.text);
  const from = hasLocation ? segs[0]!.end + 1 : 0;
  const to = tokenAt > 1 ? segs[tokenAt]!.start : text.length;
  return {
    codes,
    location: hasLocation ? tidy(segs[0]!.text) : null,
    rest: tidy(text.slice(from, to)),
    verbatim: false,
  };
}

function placeFor(kind: SourceKind, location: string | null, fallback: Place | null): Place {
  if (kind === 'rsws') return 'RSWS';
  if (kind === 'rsuh') return 'RSUH';
  if (kind === 'pjt-icu') return 'CVCU';
  const room = location ? /\b([456])\d{2}\b/.exec(location) : null;
  if (room) return `LT${room[1]}` as Place;
  if (location && ICU_LOCATION_RE.test(location)) return 'CVCU';
  return fallback && fallback.startsWith('LT') ? fallback : 'PJT';
}

/**
 * Parse one pasted list. `known` decides which capitals are DPJP codes; pass
 * `knownCodes` over every pasted list so a code named only in another list's
 * header still counts.
 */
export function parseSource(text: string, known?: ReadonlySet<string>, kindOverride?: SourceKind): ParsedSource {
  const detected = detectSource(text);
  const kind = kindOverride ?? detected.kind;
  const lines = text.split(/\r?\n/);
  const headerDpjps: string[] = [];
  for (const line of lines) {
    if (ENTRY_RE.test(plain(line))) continue;
    const code = sectionDpjp(line);
    if (code && !headerDpjps.includes(code)) headerDpjps.push(code);
  }
  const codes = known ?? new Set([...DPJPS.map((dpjp) => dpjp.initials.toUpperCase()), ...headerDpjps]);
  const hospital = kind === 'rsws' || kind === 'rsuh';

  let floor: Place | null =
    kindOverride && kindOverride !== detected.kind
      ? kindOverride === 'rsws'
        ? 'RSWS'
        : kindOverride === 'rsuh'
          ? 'RSUH'
          : kindOverride === 'pjt-icu'
            ? 'CVCU'
            : null
      : detected.floor;
  let section: string | null = null;
  let mode: 'normal' | 'excluded' | 'new' = 'normal';
  const entries: CensusEntry[] = [];

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i]!;
    const text = plain(raw);
    i += 1;
    if (!text) continue;

    if (isSeparator(raw)) {
      if (/={3,}/.test(raw)) mode = 'normal';
      continue;
    }

    // "List Pasien Lt. 6 1 pasien" inside the Lt. 5 and 6 list.
    const floorSwitch = /^list\s+pasien\s+(?:lantai|lt)\.?\s*([456])\b/i.exec(text);
    if (floorSwitch && kind === 'pjt-ward') {
      floor = `LT${floorSwitch[1]}` as Place;
      continue;
    }

    if (EXCLUDED_SECTION_RE.test(text)) {
      mode = 'excluded';
      continue;
    }
    if (NEW_SECTION_RE.test(text)) {
      mode = 'new';
      continue;
    }

    const entry = ENTRY_RE.exec(text);
    if (!entry) {
      const code = sectionDpjp(raw);
      if (code) {
        section = code;
        mode = 'normal';
      }
      continue;
    }

    const body = entry[2]!;
    let identityLine: string | null = null;
    let heading: string | null = null;
    // Strip the number from the ORIGINAL line, so spacing inside survives.
    const original = clean(raw).replace(/^\s*[*_\s]*\d{1,3}\s*\.+\s*/, '');

    if (kind === 'pjt-icu' && ICU_LOCATION_RE.test(body) && !body.includes('/')) {
      // The CVCU shape: the bed alone, the patient on the next line.
      let j = i;
      while (j < lines.length && !plain(lines[j]!)) j += 1;
      const next = j < lines.length ? lines[j]! : '';
      if (next.includes('/') && IDENTITY_RE.test(plain(next)) && !ENTRY_RE.test(plain(next))) {
        heading = original;
        identityLine = next;
        i = j + 1;
      } else {
        continue; // "Kosong", "Pasien dr TM", "Pasien Pediatri": nobody to list.
      }
    } else if (body.includes('/') && IDENTITY_RE.test(body)) {
      identityLine = original;
    } else {
      continue;
    }

    // The diagnosis block: from its heading to the first blank line or the
    // next block (therapy, plan, a consultant's own assessment).
    const diagnoses: string[] = [];
    let state: 'before' | 'in' | 'done' = 'before';
    while (i < lines.length) {
      const line = lines[i]!;
      const flat = plain(line);
      if (ENTRY_RE.test(flat) && (flat.includes('/') || ICU_LOCATION_RE.test(flat.replace(ENTRY_RE, '$2')))) break;
      if (isSeparator(line)) break;
      if (!/^\s*\d/.test(flat) && sectionDpjp(line)) break;
      if (EXCLUDED_SECTION_RE.test(flat) || NEW_SECTION_RE.test(flat)) break;
      i += 1;
      if (state === 'done') continue;
      if (state === 'before') {
        const head = DX_HEAD_RE.exec(flat) ?? ASSESS_HEAD_RE.exec(flat);
        if (head) {
          state = 'in';
          const inline = (head[1] ?? '').trim();
          if (inline) diagnoses.push(normaliseDxLine(inline));
        }
        continue;
      }
      if (!flat) {
        if (diagnoses.length > 0) state = 'done';
        continue;
      }
      if (DX_STOP_RE.test(flat.replace(/^[-•*\s]+/, '')) && !/^\s*[-•*]/.test(clean(line))) {
        state = 'done';
        continue;
      }
      diagnoses.push(normaliseDxLine(line));
    }

    if (mode === 'excluded') continue;

    const split = splitIdentity(identityLine, heading, codes, hospital);
    const fromHeader = split.codes.length === 0;
    const dpjps = fromHeader ? (section ? [section] : []) : split.codes;
    entries.push({
      dpjps,
      fromHeader,
      place: placeFor(kind, split.location ?? heading, floor),
      location: split.location,
      rest: split.rest,
      verbatim: split.verbatim,
      diagnoses,
      fromNewList: mode === 'new',
      key: entryKey(identityLine),
      raw: clean(identityLine).trim(),
    });
  }

  return { kind, label: kindOverride ? SOURCE_LABEL[kind] : detected.label, entries, headerDpjps };
}

// ───────────────────────────────────────────────────────────────
// Building the census
// ───────────────────────────────────────────────────────────────

export type CensusAddress = 'dokter' | 'prof';

export function identityLine(entry: CensusEntry, code: string): string {
  if (entry.verbatim) return entry.rest;
  return [code, entry.location, entry.rest].filter((part) => part && part.trim()).join('/');
}

/**
 * One DPJP's patients from every list, each patient once.
 *
 * A patient appears twice when a list repeats a block (the Lt. 5 list carried
 * one patient three times) or names them under "Pasien Baru" and again below.
 * The copy with a diagnosis wins; then the one from the body of the list.
 */
export function entriesFor(sources: readonly ParsedSource[], code: string): CensusEntry[] {
  const wanted = code.toUpperCase();
  const byKey = new Map<string, CensusEntry>();
  const order: string[] = [];
  for (const source of sources) {
    for (const entry of source.entries) {
      if (!entry.dpjps.includes(wanted)) continue;
      const held = byKey.get(entry.key);
      if (!held) {
        byKey.set(entry.key, entry);
        order.push(entry.key);
        continue;
      }
      const better =
        (held.diagnoses.length === 0 && entry.diagnoses.length > 0) ||
        (held.fromNewList && !entry.fromNewList && entry.diagnoses.length >= held.diagnoses.length);
      if (better) byKey.set(entry.key, entry);
    }
  }
  return order.map((key) => byKey.get(key)!);
}

/** Every DPJP with at least one patient, most patients first. */
export function dpjpCounts(sources: readonly ParsedSource[]): Array<{ code: string; count: number }> {
  const codes = new Set<string>();
  for (const source of sources) for (const entry of source.entries) for (const code of entry.dpjps) codes.add(code);
  return [...codes]
    .map((code) => ({ code, count: entriesFor(sources, code).length }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

/** Patients no DPJP could be read for: shown, so none is silently missing. */
export function unassigned(sources: readonly ParsedSource[]): CensusEntry[] {
  return sources.flatMap((source) => source.entries.filter((entry) => entry.dpjps.length === 0));
}

export function dpjpFullName(code: string): string {
  const found = DPJPS.find((dpjp) => dpjp.initials.toUpperCase() === code.toUpperCase());
  return found ? found.name : `dr. ${code.toUpperCase()}`;
}

function dmy(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}-${month}-${year}`;
}

function placesText(places: readonly Place[]): string {
  const hospitals = places.filter((place) => place === 'RSWS' || place === 'RSUH');
  const floors = places
    .filter((place) => place === 'LT4' || place === 'LT5' || place === 'LT6')
    .map((place) => place.slice(2));
  const pjt = places.some((place) => place === 'CVCU' || place === 'PJT' || place.startsWith('LT'));
  const parts: string[] = [...hospitals];
  if (floors.length > 0) parts.push(`PJT Lt. ${floors.join(' dan ')}`);
  else if (pjt) parts.push('PJT');
  return parts.join(', ');
}

export interface CensusGroupInput {
  place: Place;
  patients: Array<{ identity: string; diagnoses: string[] }>;
}

/** The message, from groups already decided (by the rules or by AI). */
export function formatCensus(input: {
  code: string;
  date: string;
  address: CensusAddress;
  groups: readonly CensusGroupInput[];
}): string {
  const groups = PLACE_ORDER.map((place) => ({
    place,
    patients: input.groups.filter((group) => group.place === place).flatMap((group) => group.patients),
  })).filter((group) => group.patients.length > 0);
  const total = groups.reduce((sum, group) => sum + group.patients.length, 0);
  const count = (places: readonly Place[]): number =>
    groups.filter((group) => places.includes(group.place)).reduce((sum, group) => sum + group.patients.length, 0);
  const addressee = input.address === 'prof' ? 'Prof' : 'Dokter';

  const head = [
    `Assalamualaikum. Tabe ${addressee}, mohon izin melaporkan Sensus pasien:`,
    `_*${dpjpFullName(input.code)}*_`,
    `Di ${placesText(groups.map((group) => group.place)) || '-'} (${dayName(input.date)}, ${dmy(input.date)})`,
    `*TOTAL: ${total} Pasien*`,
  ];
  for (const hospital of ['RSWS', 'RSUH'] as const) {
    const n = count([hospital]);
    if (n > 0) head.push(`*${hospital}: ${n} Pasien*`);
  }
  const pjt = count(['CVCU', 'LT4', 'LT5', 'LT6', 'PJT']);
  if (pjt > 0) head.push(`*PJT: ${pjt} Pasien*`);

  const blocks = groups.map((group) => {
    const title =
      group.place === 'RSWS' || group.place === 'RSUH'
        ? `*${PLACE_LABEL[group.place]} ${group.patients.length} pasien*`
        : `*${PLACE_LABEL[group.place]}, ${group.patients.length} pasien*`;
    const rows = group.patients.map((patient, index) =>
      [
        `${index + 1}. ${patient.identity}`,
        'Diagnosis:',
        ...(patient.diagnoses.length > 0 ? patient.diagnoses : ['-']),
      ].join('\n'),
    );
    return [title, ...rows].join('\n');
  });

  return [
    head.join('\n'),
    ...blocks.map((block) => `${MR_DIVIDER}\n${block}`),
    '',
    `Tabe terima kasih ${input.address === 'prof' ? 'Prof' : 'dokter'}`,
  ].join('\n');
}

/** The rules' census for one DPJP. */
export function buildCensus(input: {
  sources: readonly ParsedSource[];
  code: string;
  date: string;
  address: CensusAddress;
}): { text: string; entries: CensusEntry[] } {
  const entries = entriesFor(input.sources, input.code);
  const groups: CensusGroupInput[] = entries.map((entry) => ({
    place: entry.place,
    patients: [{ identity: identityLine(entry, input.code), diagnoses: entry.diagnoses }],
  }));
  return {
    text: formatCensus({ code: input.code, date: input.date, address: input.address, groups }),
    entries,
  };
}

// ───────────────────────────────────────────────────────────────
// AI mode (optional; off unless enabled in Settings → AI)
// ───────────────────────────────────────────────────────────────

/**
 * AI does the EXTRACTION only: which patients are this DPJP's, where they
 * are, their identity line and diagnoses. `formatCensus` still writes the
 * message, so both modes produce the same shape and the AI can never change
 * the greeting, the counts or the order of places.
 */
export const SENSUS_AI_TOOL = {
  name: 'sensus_pasien',
  description: 'Daftar pasien satu DPJP yang diambil dari list ruangan yang ditempel.',
  input_schema: {
    type: 'object',
    properties: {
      patients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            place: { type: 'string', enum: [...PLACE_ORDER] },
            identity: {
              type: 'string',
              description:
                'Baris identitas persis seperti ditulis. Untuk list PJT: kode DPJP di depan lalu lokasi, mis. "MZ/417 Bed 3/Ny. X / 18-11-1989/ RM 1729668". Untuk list RSWS/RSUH: baris apa adanya.',
            },
            diagnoses: {
              type: 'array',
              items: { type: 'string' },
              description: 'Baris diagnosis persis seperti ditulis, satu per item, diawali "- ". Tanpa terapi dan plan.',
            },
          },
          required: ['place', 'identity', 'diagnoses'],
        },
      },
    },
    required: ['patients'],
  },
} as const;

export function sensusAiSystem(): string {
  return [
    'Anda membantu residen kardiologi menyusun sensus pasien per DPJP dari beberapa list ruangan (WhatsApp).',
    'Aturan:',
    '- Ambil HANYA pasien milik DPJP yang diminta. Kode DPJP di baris pasien lebih menentukan daripada judul bagian (pasien bisa salah tempel di bagian DPJP lain). Pasien gabungan (mis. "dr.ZD-dr.AAU") milik keduanya.',
    '- Abaikan bagian "Pasien Pulang", "Pasien Meninggal", "Pasien Pindah". Pasien di "Pasien Baru" yang juga tercantum di bawah dihitung sekali.',
    '- Setiap pasien sekali saja walau tercantum berulang.',
    '- Lokasi (place): RSWS dan RSUH dari list rumah sakitnya; CVCU untuk CVCU/HCU/ICU PJT; LT4/LT5/LT6 dari nomor kamar (4xx/5xx/6xx) atau judul list; PJT bila lantai tidak diketahui.',
    '- Identitas dan diagnosis disalin persis, jangan diterjemahkan, dirapikan, atau ditambah. Buang nama residen di akhir baris (mis. "/resa", "(Resa)").',
    '- Diagnosis: hanya blok "Diagnosis"/"Diagnosa"/"Mohon izin kami assess dengan" milik kardiologi, bukan blok TS lain, terapi, atau plan.',
  ].join('\n');
}

export function sensusAiPrompt(input: { code: string; texts: readonly string[] }): string {
  return [
    `DPJP yang diminta: ${input.code.toUpperCase()} (${dpjpFullName(input.code)})`,
    '',
    ...input.texts.map((text, index) => `=== LIST ${index + 1} ===\n${text.trim()}`),
  ].join('\n');
}

/** Defensive read of the tool output: anything malformed is dropped, not trusted. */
export function readAiCensus(raw: unknown): CensusGroupInput[] {
  const patients = (raw as { patients?: unknown })?.patients;
  if (!Array.isArray(patients)) return [];
  const out: CensusGroupInput[] = [];
  for (const item of patients) {
    const record = item as { place?: unknown; identity?: unknown; diagnoses?: unknown };
    const place = PLACE_ORDER.find((candidate) => candidate === record.place);
    if (!place || typeof record.identity !== 'string' || !record.identity.trim()) continue;
    const diagnoses = Array.isArray(record.diagnoses)
      ? record.diagnoses.filter((line): line is string => typeof line === 'string' && line.trim() !== '').map(normaliseDxLine)
      : [];
    out.push({ place, patients: [{ identity: tidy(clean(record.identity)), diagnoses }] });
  }
  return out;
}
