import { addDays } from '@/domain/clinicalDate';
import { DPJPS, detectDpjps } from '@/domain/dpjp';
import { splitChat } from '@/domain/floorList/chat';
import type { ClinicalDate } from '@/domain/types';
import { entryKey, isDiagnosisHeading, parseSource, PLACE_ORDER, type CensusEntry, type ParsedSource, type Place } from './maker';

/**
 * A DPJP's census from their WhatsApp group (2026-11-14).
 *
 * WHY. dr. KS's census goes out early in the morning, before the ward lists
 * arrive (about 07.00), so it cannot be read from them. Every patient of his
 * is reported in his own group instead: new patients, konsul, follow-ups and
 * transfers, each a full SOAP. The resident exports that chat (yesterday and
 * today) and the census is read from the reports.
 *
 * ONE ROW PER PATIENT. The same patient is reported once a day or more
 * (follow-up yesterday morning, again today; IGD at night, then "pindah ke
 * CVCU"). Reports are grouped by RM; the NEWEST report sets the place and the
 * identity line, the newest report with a diagnosis block sets the diagnoses.
 * The older reports stay as the patient's timeline, so the resident can see
 * why a row says what it says: that is the baseline to check against.
 *
 * WHAT IS READ, from the export of 13-14 Nov 2026 (77 messages, 34 patients):
 *   - the place from the greeting: "… di CVCU bed 3 atas nama", and for a
 *     transfer the side after "ke" ("dari IGD PJT Redzone bed 1 ke CVCU Bed 12");
 *   - the cardiology diagnoses under "Mohon izin kami assess dengan" (the same
 *     heading the ward lists use, read by the same code). The "A/" blocks under
 *     "TS BTKV", "TS Anestesi" are the other services' and are not read;
 *   - "KJS <service>" from "KJS TS BTKV", "konsul baru dari TS Neurologi";
 *   - a hint that the patient is going home ("Rawat jalan hari ini", "Boleh
 *     pulang"), shown for the resident to decide. Nothing is dropped by itself.
 *
 * KEPT, NOT THE CHAT. The digest below is what is stored (with the day's
 * lists, synced): a few KB. The export itself (hundreds of KB of full SOAPs)
 * never leaves the import.
 */

export type ReportKind = 'baru' | 'konsul' | 'follow up' | 'pindah' | 'laporan';

export interface ChatReport {
  /** "YYYY-MM-DD HH:MM", from the WhatsApp stamp. */
  at: string;
  kind: ReportKind;
  /** The place as the greeting wrote it ("CVCU Bed 12"); '' when it names none. */
  location: string;
  /** A transfer's origin ("IGD PJT Redzone bed 1"). */
  from?: string;
}

export interface ChatPatient {
  key: string;
  /** The identity line of the newest report, as written. */
  identity: string;
  location: string;
  place: Place;
  diagnoses: string[];
  kjs: string | null;
  /** Oldest first. */
  reports: ChatReport[];
  /** The newest report's line about going home, if any ("Rawat jalan hari ini"). */
  homeHint: string | null;
  /** The two newest diagnosis blocks differ. */
  dxChanged: boolean;
}

export interface ChatDigest {
  v: 1;
  /** The file the resident picked. */
  file: string;
  /** The DPJP whose group it is (registry initials), as read; the resident can change it. */
  code: string;
  /** The window read: the census date and the day before. */
  from: ClinicalDate;
  to: ClinicalDate;
  /** Messages in the window, and the reports among them. */
  messages: number;
  reports: number;
  /** Newest stamp in the window. */
  lastAt: string;
  /** Messages outside the window, not read. */
  older: number;
  patients: ChatPatient[];
  /** Keys the resident left out of the census. */
  skipped: string[];
}

// ───────────────────────────────────────────────────────────────
// Messages
// ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  /** '' when the paste carried no readable stamp. */
  date: ClinicalDate | '';
  time: string;
  body: string;
}

/**
 * The export cut into messages by the List Maker's reader (`splitChat`): iOS
 * and Android exports, copied messages and the markdown export, dates read
 * from the stamps, never guessed.
 */
export function splitMessages(text: string): ChatMessage[] {
  return splitChat(text).map((message) => ({
    date: message.sentAt.slice(0, 10) as ClinicalDate | '',
    time: message.sentAt.slice(11, 16),
    body: message.text,
  }));
}

// ───────────────────────────────────────────────────────────────
// One report
// ───────────────────────────────────────────────────────────────

const RM_LINE_RE = /\bRM\b\s*:?\s*0*\d{5,}/i;

const clean = (line: string): string => line.replace(/[​-‏⁠﻿]/g, '').replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();

function kindOf(greeting: string): ReportKind {
  if (/\b(?:perpindahan|pindah)\b/i.test(greeting)) return 'pindah';
  if (/\bkonsul\b/i.test(greeting)) return 'konsul';
  if (/\bpasien\s+baru\b/i.test(greeting)) return 'baru';
  if (/\bfollow\s*-?\s*up\b/i.test(greeting)) return 'follow up';
  return 'laporan';
}

/** A word a place starts with. "TS", "poli" and a consultant's name are not places. */
const PLACE_START_RE =
  /^(?:igd|pjt|cvcu|iccu|icu|hcu|rsws|rsuh|lontara|palem|pcc|mochil|bangsal|ic|sandeq|katinting|lepa|pinisi|lt|lantai|kamar|bed|ruang\w*)\b/i;

/** The place in the greeting: after the last "di"/"dari" that names one, or for a transfer after "ke". */
export function greetingPlace(greeting: string, kind: ReportKind): { location: string; from?: string } {
  let text = greeting.split(/\batas\s+nama\b/i)[0] ?? '';
  // Consultants' names and titles in brackets carry "di"/"dari" of their own.
  for (let i = 0; i < 3; i += 1) text = text.replace(/\([^()]*\)/g, ' ');
  const marks = [...text.matchAll(/(?:^|\s)(di|ke|dari)\s+/gi)]
    .map((m) => ({ word: m[1]!.toLowerCase(), at: m.index! + m[0].length, start: m.index! }))
    .filter((m) => PLACE_START_RE.test(text.slice(m.at)));
  const piece = (from: number, to?: number): string =>
    text
      .slice(from, to)
      .replace(/^bangsal\s+/i, '')
      .replace(/[\s,:]*(?:\bpasien)?[\s,:]*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  if (kind === 'pindah') {
    const to = marks.filter((m) => m.word === 'ke').at(-1);
    if (to) {
      const origin = marks.filter((m) => m.word === 'dari' && m.at < to.start).at(-1);
      return { location: piece(to.at), ...(origin ? { from: piece(origin.at, to.start) } : {}) };
    }
  }
  const last = marks.filter((m) => m.word !== 'ke').at(-1) ?? marks.at(-1);
  return { location: last ? piece(last.at) : '' };
}

/**
 * The census place of a ward name. RSUH and RSWS by their wards (PCC, Lontara,
 * Palem, Mochil, HCU Central/BC, IC are RSWS: their ward list names them);
 * then the PJT floors, intensive care, IGD.
 */
export function placeOfLocation(location: string): Place {
  const text = location.toLowerCase();
  if (/\brsuh\b|\bsandeq\b|\bkatinting\b|\blepa\b|\bpinisi\b/.test(text)) return 'RSUH';
  if (/\brsws\b|\blontara\b|\bpalem\b|\bpcc\b|\bmochil\b|\bhcu\s*(?:central|bc)\b|\bic\s+lt\b/.test(text)) return 'RSWS';
  const floor = /\b(?:lantai|lt)\.?\s*([456])\b/.exec(text) ?? /\bkamar\s*([456])\d{2}\b/.exec(text);
  if (floor) return `LT${floor[1]}` as Place;
  if (/\b(?:cvcu|iccu|icu|hcu)\b/.test(text)) return 'CVCU';
  if (/\bigd\b|zone\b|redzone|rezone|bluezone/.test(text)) return 'IGD';
  return 'PJT';
}

/** "KJS BTKV" from "KJS TS BTKV" / "KJS dari TS Neuro" / "konsul baru dari TS Neurologi". */
function kjsOfGreeting(greeting: string): string | null {
  const ts = /\b(?:KJS|konsul)\b.*?\bTS\.?\s+(Bedah\s+[A-Za-z]+|[A-Za-z]+)/i.exec(greeting);
  if (ts) return `KJS ${ts[1]}`;
  return /\bKJS\b/i.test(greeting) ? 'KJS' : null;
}

const HOME_RE =
  /\b(?:boleh\s+(?:pulang|rawat\s+jalan)|rawat\s+jalan\s+(?:hari\s+ini|besok)|pulang\s+hari\s+ini|(?:rencana|direncanakan)\s+(?:rawat\s+jalan|pulang)|obat\s+pulang|pulang\s+paksa|meninggal\s+dunia|pasien\s+meninggal)\b/i;

function homeHintOf(lines: readonly string[]): string | null {
  for (const line of lines) {
    const flat = clean(line).replace(/^[-•*\s]+/, '');
    if (HOME_RE.test(flat) && !/\b(?:riwayat|bila|jika|apabila)\b/i.test(flat)) return flat.slice(0, 120);
  }
  return null;
}

/**
 * A konsul reply has no diagnosis list: cardiology's answer is one sentence,
 * "Saat ini evaluasi kardiologi berdasarkan …, pasien termasuk kategori Low
 * Risk (…) untuk tindakan DSA" (10 of the 13-14 Nov export). The part after
 * "pasien termasuk / kami assess dengan / dengan" is taken, as written.
 */
const EVALUATION_RE =
  /^saat\s+ini\s+evaluasi\b.*?\bpasien\s+(?:termasuk\s+(?:kategori\s+)?|kami\s+(?:di)?ass?es+\w*\s+dengan\s+|dengan\s+)(.+)$/i;

/** The cardiology diagnoses: the first diagnosis block after the identity, read like a ward list's. */
function diagnosesOf(lines: readonly string[]): string[] {
  const head = lines.findIndex(isDiagnosisHeading);
  if (head >= 0) {
    const text = ['1. X/ RM 1000000', ...lines.slice(head)].join('\n');
    const found = parseSource(text, new Set(), 'pjt-ward').entries[0]?.diagnoses ?? [];
    if (found.length > 0) return found;
  }
  for (const line of lines) {
    const evaluation = EVALUATION_RE.exec(clean(line));
    if (evaluation) return [`- ${evaluation[1]!.replace(/[.\s]+$/, '')}`];
  }
  return [];
}

export interface ReadReport {
  key: string;
  identity: string;
  report: ChatReport;
  diagnoses: string[];
  kjs: string | null;
  homeHint: string | null;
  /** Registry ids of the DPJPs the report names on its DPJP lines. */
  dpjpIds: string[];
}

/** A patient report, or null for chatter ("Siapa yang jaga?", a deleted message). */
export function readReport(message: ChatMessage): ReadReport | null {
  const lines = message.body.split('\n');
  const at = lines.findIndex((line, index) => index < 25 && line.includes('/') && RM_LINE_RE.test(line));
  if (at < 0) return null;
  const greeting = lines.slice(0, at).map(clean).filter(Boolean).join(' ');
  const kind = kindOf(greeting);
  const place = greetingPlace(greeting, kind);
  const rest = lines.slice(at + 1);
  return {
    key: entryKey(lines[at]!),
    identity: clean(lines[at]!),
    report: { at: `${message.date} ${message.time}`, kind, ...place },
    diagnoses: diagnosesOf(rest),
    kjs: kjsOfGreeting(greeting),
    homeHint: homeHintOf(rest),
    dpjpIds: detectDpjps(message.body).map((found) => found.id),
  };
}

// ───────────────────────────────────────────────────────────────
// The digest
// ───────────────────────────────────────────────────────────────

/**
 * The patients reported in the window (the census date and the day before),
 * each once, newest report first in what it says.
 */
export function digestChat(input: { text: string; file: string; censusDate: ClinicalDate }): ChatDigest {
  const from = addDays(input.censusDate, -1);
  const all = splitMessages(input.text);
  // A message with no readable stamp cannot be placed in time; it is read, in chat order.
  const inWindow = all.filter((m) => !m.date || (m.date >= from && m.date <= input.censusDate));
  const reports = inWindow.map(readReport).filter((r): r is ReadReport => r !== null);

  const votes = new Map<string, number>();
  for (const report of reports) for (const id of report.dpjpIds) votes.set(id, (votes.get(id) ?? 0) + 1);
  const topId = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];
  const code = DPJPS.find((dpjp) => dpjp.id === topId)?.initials ?? '';

  const byKey = new Map<string, ReadReport[]>();
  for (const report of reports) byKey.set(report.key, [...(byKey.get(report.key) ?? []), report]);
  const patients: ChatPatient[] = [...byKey.values()].map((list) => {
    const newest = list.at(-1)!;
    const withDx = list.filter((r) => r.diagnoses.length > 0);
    const located = [...list].reverse().find((r) => r.report.location);
    const location = located?.report.location ?? '';
    const lastDx = withDx.at(-1)?.diagnoses ?? [];
    const prevDx = withDx.at(-2)?.diagnoses;
    return {
      key: newest.key,
      identity: newest.identity,
      location,
      place: placeOfLocation(location),
      diagnoses: lastDx,
      kjs: [...list].reverse().find((r) => r.kjs)?.kjs ?? null,
      reports: list.map((r) => r.report),
      homeHint: newest.homeHint,
      dxChanged: !!prevDx && prevDx.join('\n') !== lastDx.join('\n'),
    };
  });
  patients.sort(
    (a, b) => PLACE_ORDER.indexOf(a.place) - PLACE_ORDER.indexOf(b.place) || a.location.localeCompare(b.location, 'id', { numeric: true }),
  );

  return {
    v: 1,
    file: input.file,
    code,
    from,
    to: input.censusDate,
    messages: inWindow.length,
    reports: reports.length,
    lastAt: inWindow.length > 0 ? `${inWindow.at(-1)!.date} ${inWindow.at(-1)!.time}` : '',
    older: all.filter((m) => m.date && m.date < from).length,
    patients,
    skipped: [],
  };
}

/** The stored digest (a box's text), or null when the text is not one. */
export function readDigest(text: string): ChatDigest | null {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) return null;
    const digest = value as Partial<ChatDigest>;
    if (digest.v !== 1 || !Array.isArray(digest.patients)) return null;
    return { skipped: [], ...digest } as ChatDigest;
  } catch {
    return null;
  }
}

/** The patient's line as residents write it: "CVCU Bed 12/ Tn. …". */
function asWritten(patient: ChatPatient): string {
  return patient.location ? `${patient.location}/ ${patient.identity}` : patient.identity;
}

/**
 * The digest as a pasted list, for the census, "Perlu dicek" and Bandingkan.
 * The text is a readable summary of each patient's newest report; `span`
 * points into it. A chat covers no place: it lists who was reported, and says
 * nothing about a ward nobody wrote from.
 */
export function chatSource(digest: ChatDigest): { source: ParsedSource; text: string } {
  const lines: string[] = [];
  const entries: CensusEntry[] = [];
  const skipped = new Set(digest.skipped);
  for (const patient of digest.patients) {
    if (skipped.has(patient.key)) continue;
    const start = lines.length;
    const last = patient.reports.at(-1);
    lines.push(`[${last?.at ?? ''} · ${last?.kind ?? ''}] ${asWritten(patient)}`, 'Diagnosis:', ...(patient.diagnoses.length > 0 ? patient.diagnoses : ['-']));
    entries.push({
      dpjps: digest.code ? [digest.code] : [],
      fromHeader: false,
      place: patient.place,
      location: patient.location || null,
      rest: patient.identity,
      verbatim: false,
      asWritten: asWritten(patient),
      diagnoses: patient.diagnoses,
      dxWasTherapy: false,
      fromNewList: false,
      key: patient.key,
      raw: patient.identity,
      kjs: patient.kjs,
      span: { start, end: lines.length },
      fromChat: true,
    });
    lines.push('');
  }
  return {
    source: { kind: 'grup-wa', label: 'Grup WhatsApp DPJP', entries, headerDpjps: digest.code ? [digest.code] : [], covers: [] },
    text: lines.join('\n'),
  };
}
