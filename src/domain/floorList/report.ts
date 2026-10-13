import { roomNamed } from '@/domain/denahPlan';
import { DPJPS, detectDpjps } from '@/domain/dpjp';
import type { ChatMessage } from './chat';
import type { PatientTag } from './marks';

/**
 * List Maker, step 2: one follow-up message → one patient on the floor (12.8).
 *
 * The messages are the ward's own reports ("mohon izin melaporkan follow up
 * pasien di PJT Lantai 4 Kamar 417 Bed 4 atas nama: …"), written by several
 * residents with their own habits. Everything here is read from the text
 * as written; nothing is rewritten except the two headings the list renames
 * ("Mohon izin kami assess dengan" → "Diagnosis:", "Mohon izin kami terapi
 * dengan" → "Terapi:"), as in Avi's list.
 *
 * WHAT THE LIST CARRIES: the A/P tail — Diagnosis, Terapi, Selesai, Plan and
 * every TS block after them — not S/O. It starts at the LAST "assess"
 * heading, because some residents put a diagnosis summary above S/O as well
 * (the "Chief :" messages), and the one that matters is the A of the SOAP.
 */

export type DischargeFlag = 'today' | 'tomorrow' | null;

export interface FloorPatient {
  /** `rm:<digits>`, or `name:<room>:<name>` when no RM could be read. */
  key: string;
  rm: string;
  name: string;
  /** The identity line as written, emphasis and stray spaces removed. */
  identity: string;
  room: string;
  bed: string;
  /** Floor number when the opening names "Lantai N" / "Lt N" ('' otherwise). */
  floor: string;
  /** Registry id of the cardiology DPJP the patient is filed under. */
  dpjpId: string | null;
  /** Cardiology DPJPs who see the patient as KJS (DPJP Aritmia …). */
  kjsDpjpIds: string[];
  /** Co-managed with BTKV (a BTKV DPJP line, or "KJS TS BTKV" in the opening). */
  btkv: boolean;
  /** The A/P tail for the list ('' when the message has none). */
  body: string;
  /** The whole message: what the denah opens. */
  full: string;
  chief: string;
  /** From a "Junior :" line only ('' otherwise). */
  junior: string;
  /** Nickname derived from the sender ("dr. Muh Bima …" → "Bima"). */
  senderNick: string;
  sender: string;
  sentAt: string;
  index: number;
  discharge: DischargeFlag;
  /**
   * Entered by hand (pediatri patients have no SOAP in the floor group).
   * Stays on the list without daily reports until removed.
   */
  manual?: boolean | undefined;
  /** The stored WhatsApp text was edited in Plano ("Ubah SOAP", 12.11). */
  edited?: boolean | undefined;
  /**
   * Read from a sent LIST, not a SOAP (12.12: a list from a colleague outside
   * Plano). Only A/Terapi/Plan, so it never replaces a real SOAP.
   */
  fromList?: boolean | undefined;
  /** The three fields of a hand-entered patient, for editing it again. */
  manualFields?: ManualFields | undefined;
  /** The floor's own marks on this patient (13.10, `marks.ts`); list only, never from a SOAP. */
  tags?: PatientTag[] | undefined;
  /** A DPJP code written on a sent list that is not one of ours ("TM/…", 13.10): printed as written. */
  dpjpCode?: string | undefined;
  /** Held by a cardiology division, not the ward residents (13.9, `divisionOf`). */
  division?: string | undefined;
}

export interface ManualFields {
  diagnosis: string;
  terapi: string;
  plan: string;
}

/** Surgeons: never the cardiology DPJP a patient is filed under. */
const BTKV_IDS = new Set(DPJPS.filter((d) => /BTKV/i.test(d.name)).map((d) => d.id));

/*
  The A and T headings, every spelling in the Lt 4 (Sept) and Lt 5 (Oct)
  exports (12.12): "Mohon izin kami assess/asses/assesst/assessment/
  assesstment dengan", "… asses pasien dengan", "Mohon izin dok, pasien kami
  diagnosis dengan", "Mohon Izin Kami Asses:" (no "dengan"), and the same for
  "terapi" ("… terapi pasien dengan", "… inisial terapi dengan",
  "Mohon izin kami Terapi:"). 29 of 402 Lt 4 reports had an empty list body
  with the old, narrower pattern.
*/
const ASSESS =
  /^\W*mohon\s+(?:izin|ijin)\b[^\n]{0,24}?\b(?:asses+t?\w*|diagnos[ai]s?)\b(?:[^\n]{0,16}\bdengan\b|\s*:)/i;
const DX = /^\W*(?:diagnos[ai]s?|diagnosa|asses+t?ment)\W*$/i;
const TERAPI = /^\W*mohon\s+(?:izin|ijin)\b[^\n]{0,24}?\b(?:inisial\s+)?terapi\b(?:[^\n]{0,16}\bdengan\b|\s*:)/i;
/**
 * A sign-off ends the tail. Never a bulleted line: "- Mohon arahan DPJP" in a
 * plan is an instruction, not the closing.
 */
const CLOSING =
  /^\s*[*_]*(?:tabe\b[^\n]*?)?(?:selanjutnya\s+)?mohon\s+arahan|^\s*[*_]*tabe[,.]?\s+(?:dokter[,.]?\s+)?terima\s+kasih|^\s*[*_]*terima\s*kasih|^\s*[*_]*jam\s+verifikasi/i;
const PLAN = /^\W*(?:plan|p)\W*(?:\s|$)/i;
const TS_HEAD = /^\W*TS\s+\S/;

function clean(line: string): string {
  return line.replace(/[*_~]/g, '').replace(/\s+/g, ' ').trim();
}

function findOpening(lines: string[]): number {
  return lines.findIndex((line) => /\batas\s+nama\b/i.test(line));
}

/** Room/bed: the LAST "Kamar" in the opening — "dari IGD … ke PJT Lt. 4 Kamar 408". */
function readPlace(opening: string): { room: string; bed: string; floor: string } {
  const flat = clean(opening);
  const after = /\bke\s+(.*)$/i.exec(flat)?.[1] ?? flat;
  const room = [...after.matchAll(/\bkamar\s*:?\s*(\d{3}[A-Za-z]?)/gi)].at(-1);
  const tail = room ? after.slice((room.index ?? 0) + room[0].length) : after;
  const bed = /\bbed\s*:?\s*(\w+)/i.exec(tail);
  // "Lt .4", "Lt.4", "Lantai 4" (12.12: "Lt .4" was missed).
  const written = /\b(?:lantai|lt)\s*\.?\s*(\d+)/i.exec(after)?.[1] ?? '';
  let number = room?.[1] ?? '';
  // A room named, not numbered: "Kamar Super VIP", "Lt.4 Supervip".
  if (!number && /\bsuper\s*-?\s*vip\b/i.test(after)) number = roomNamed(written, 'Super VIP');
  // "PJT Kamar 417": the floor is the room's first digit.
  const floor = written || (/^\d{3}/.test(number) ? number.charAt(0) : '');
  return { room: number, bed: bed?.[1] ?? '', floor };
}

function readIdentity(lines: string[], opening: number): string {
  for (let i = opening + 1; i < Math.min(lines.length, opening + 5); i += 1) {
    const line = clean(lines[i] ?? '');
    if (!line) continue;
    if (/\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\bRM\b|\d{6,}/i.test(line)) return line;
  }
  // "atas nama: Tn. … / RM …" on the opening line itself.
  const same = /\batas\s+nama\s*:?\s*(.+)$/i.exec(clean(lines[opening] ?? ''));
  return same?.[1]?.trim() ?? '';
}

function readRm(identity: string): string {
  const labelled = /\bRM\s*:?\s*(\d{4,12})\b/i.exec(identity);
  if (labelled?.[1]) return labelled[1];
  // Unlabelled: a run of 6+ digits that is not part of a date.
  const bare = identity
    .replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, ' ')
    .match(/\b\d{6,12}\b/);
  return bare?.[0] ?? '';
}

function readName(identity: string): string {
  const parts = identity.split('/').map((part) => part.trim()).filter(Boolean);
  const titled = parts.find((part) => /^(?:Tn|Ny|Nn|An|Sdri?|By)\b\.?/i.test(part));
  return (titled ?? parts.find((part) => /[A-Za-z]{3}/.test(part) && !/\bRM\b|tahun|\bth\b/i.test(part)) ?? '').trim();
}

/** "Jul 26 - dr. Contoh Nama" → "Nama"-style nickname: the first given name. */
export function nicknameOf(sender: string): string {
  const SKIP = new Set(['dr', 'dr.', 'muh', 'muh.', 'muhammad', 'moh', 'nurul', 'andi', 'a.', 'siti', 'st.', 'nur']);
  const words = sender
    .replace(/^[A-Za-z]{3}\s+\d{2}\s+-\s+/, '')
    .replace(/[^\p{L}\s.]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const name = words.find((word) => !SKIP.has(word.toLowerCase()));
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
}

function fileDpjp(text: string): { dpjpId: string | null; kjs: string[]; btkvDpjp: boolean } {
  const detected = detectDpjps(text);
  const cardio = detected.filter((d) => !BTKV_IDS.has(d.id));
  const role = (d: { role: string | null }): string => (d.role ?? '').toLowerCase();
  const filed =
    cardio.find((d) => /utama/.test(role(d))) ??
    cardio.find((d) => /kardio/.test(role(d))) ??
    cardio.find((d) => !/aritmia|eko|intervensi/.test(role(d))) ??
    cardio[0] ??
    null;
  const consult = (d: { role: string | null }): boolean => /aritmia|eko\b|intervensi|kjs/.test(role(d)) && !/tindakan|utama|pelimpahan/.test(role(d));
  const btkvDpjp = detected.some((d) => BTKV_IDS.has(d.id));
  /*
    Utama of another department and our DPJPs only as consultants ("DPJP
    Utama: dr. X, Sp.PD" + "DPJP KJS Aritmia: Prof. MZ", 13.10): no own
    cardiology DPJP. It used to be filed as MZ's own patient (the first
    cardiologist found); now MZ's KJS, so it shows once, in MZ's KJS part.
  */
  if (cardio.length > 0 && cardio.every(consult) && otherDepartmentUtama(text)) {
    return { dpjpId: null, kjs: [...new Set(cardio.map((d) => d.id))], btkvDpjp };
  }
  const kjs = cardio.filter((d) => d !== filed && consult(d)).map((d) => d.id);
  return { dpjpId: filed?.id ?? null, kjs, btkvDpjp };
}

/**
 * Whether a report is for this floor (12.12). The floor written, or read from
 * the room ("PJT Kamar 417"). A report with neither — "pasien baru di IGD
 * PJT Redzone" — is not on any floor yet and is not filed: it used to slip
 * in, with no room, because a missing floor counted as a match.
 */
export function onFloorNumber(report: Pick<FloorPatient, 'floor'>, floor: string): boolean {
  return !floor || report.floor === floor;
}

/**
 * The patient belongs to another department (12.12): a "DPJP … Utama" line
 * names a doctor who is neither one of our cardiology DPJPs nor BTKV —
 * "DPJP Urologi (Utama)", "DPJP GH (Utama)", "DPJP Bedah Onkologi (Utama)".
 * Counted as KJS TS Lain even when the message never says "KJS".
 */
export function otherDepartmentUtama(text: string): boolean {
  for (const line of text.split('\n')) {
    const flat = clean(line);
    const match = /^-?\s*DPJP\b([^:]*)\butama\b([^:]*):\s*(.+)$/i.exec(flat);
    if (!match) continue;
    const label = `${match[1]} ${match[2]}`;
    const who = match[3] ?? '';
    if (/BTKV|\bBKV\b/i.test(label + who)) continue;
    if (detectDpjps(flat).length > 0) continue;
    if (/kardio/i.test(label)) continue;
    return true;
  }
  return false;
}

/** The A/P tail, with the two headings renamed. */
export function listBody(text: string): string {
  const lines = text.split('\n');
  let start = -1;
  lines.forEach((line, i) => {
    if (ASSESS.test(line)) start = i;
  });
  if (start === -1) {
    const dx = lines.map((line, i) => (DX.test(line) ? i : -1)).filter((i) => i >= 0);
    // A diagnosis block that is followed by therapy is the A of the SOAP.
    start = dx.reverse().find((i) => lines.slice(i).some((line) => TERAPI.test(line) || /^\W*terapi\W*$/i.test(line))) ?? dx.at(-1) ?? -1;
  }
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (CLOSING.test(lines[i] ?? '')) {
      end = i;
      break;
    }
  }
  const out = lines.slice(start, end).map((line, i) => {
    if (i === 0 && (ASSESS.test(line) || DX.test(line))) return 'Diagnosis:';
    if (TERAPI.test(line)) return 'Terapi:';
    return line.replace(/\s+$/, '');
  });
  while (out.length > 0 && out.at(-1)!.trim() === '') out.pop();
  return out.join('\n');
}

/** Red (H-1) / green (pulang hari ini), from the Plan lines only — never the diagnosis. */
export function dischargeFlag(body: string): DischargeFlag {
  const lines = body.split('\n');
  let inPlan = false;
  let flag: DischargeFlag = null;
  for (const line of lines) {
    if (TS_HEAD.test(line)) inPlan = false;
    else if (PLAN.test(line)) inPlan = true;
    else if (/^\W*(?:diagnosis|terapi|selesai)\W*:?\s*$/i.test(line)) inPlan = false;
    if (!inPlan) continue;
    if (/\b(?:rawat\s+jalan|pulang|aff\s+rawat|discharge)\b.*\bhari\s+ini\b/i.test(line)) return 'today';
    if (/\bH\s*-\s*1\b.*\bhari\s+ini\b|\b(?:usul|rencana)\s+H\s*-?\s*1\b|\b(?:pulang|rawat\s+jalan)\s+besok\b/i.test(line)) flag = 'tomorrow';
  }
  return flag;
}

/** One message → one patient, or null when it is not a patient report. */
export function readReport(message: ChatMessage): FloorPatient | null {
  const text = message.text;
  if (/mengirimkan\s+\*?list/i.test(text.slice(0, 200))) return null;
  const lines = text.split('\n');
  const opening = findOpening(lines);
  if (opening === -1) return null;
  const identity = readIdentity(lines, opening);
  const rm = readRm(identity);
  const name = readName(identity);
  if (!rm && !name) return null;

  const place = readPlace(lines[opening] ?? '');
  const { dpjpId, kjs, btkvDpjp } = fileDpjp(text);
  const body = listBody(text);
  const chief = /^\W*chief\s*:\s*(.+)$/im.exec(text)?.[1]?.trim() ?? '';
  const junior = /^\W*junior\s*:\s*(.+)$/im.exec(text)?.[1]?.trim() ?? '';

  return {
    key: rm ? `rm:${rm.replace(/^0+/, '')}` : `name:${place.room}:${name.toLowerCase()}`,
    rm,
    name,
    identity,
    room: place.room,
    bed: place.bed,
    floor: place.floor,
    dpjpId,
    kjsDpjpIds: kjs,
    btkv:
      btkvDpjp ||
      /KJS\s+(?:TS\s+)?BTKV|\bTS\s+BTKV\b/i.test(lines.slice(0, opening + 1).join(' ')) ||
      // "DPJP BTKV (Utama) : …" for a surgeon the registry does not know.
      lines.some((line) => /^\W*DPJP[^:\n]*\bBTKV\b|^\W*DPJP[^\n]*Sp\.?\s*BTKV/i.test(line)),
    body,
    full: text.trim(),
    chief,
    junior,
    senderNick: message.sender === 'You' ? '' : nicknameOf(message.sender),
    sender: message.sender,
    sentAt: message.sentAt,
    index: message.index,
    // Colour is decided on the roster by hand (12.12); the Plan is read only
    // for a suggestion (`floor.ts` `suggestionFor`).
    discharge: null,
  };
}

/**
 * Every patient once: the LATEST report wins (by stamp, then by position).
 * RM leading zeros are ignored for matching ("01720060" = "1720060").
 */
export function latestPatients(messages: readonly ChatMessage[]): FloorPatient[] {
  return latestOf(messages.flatMap(readReports));
}

/**
 * Every report in one message. A message can hold more than one opening
 * ("… atas nama:"): a short summary followed by the full SOAP of the same
 * patient (seen once in the floor's chat), or — possible, not yet seen — two
 * patients. Each part is read on its own; for the same patient the later part
 * wins (`latestOf`), so nobody after the first is lost.
 */
export function readReports(message: ChatMessage): FloorPatient[] {
  if (isListMessage(message.text)) return readListMessage(message);
  const lines = message.text.split('\n');
  const openings = lines.map((line, i) => (/\batas\s+nama\b/i.test(line) ? i : -1)).filter((i) => i >= 0);
  if (openings.length <= 1) {
    const one = readReport(message);
    return one ? [one] : [];
  }
  const parts = openings.map((at, k) => {
    // The first part keeps anything above its opening ("Chief :" headers).
    const from = k === 0 ? 0 : at;
    const to = openings[k + 1] ?? lines.length;
    return lines.slice(from, to).join('\n');
  });
  return parts
    .map((text, k) => readReport({ ...message, text, index: message.index + k / parts.length }))
    .filter((patient): patient is FloorPatient => patient !== null)
    // Every part is part of one message: the denah shows the whole of it.
    .map((patient) => ({ ...patient, full: message.text.trim() }));
}

/*
  A sent List Pasien comes in (at least) three shapes in the Lt 4 / Lt 5
  exports (12.12):
    A  "*1. 419 bed 4/KS/Tn. X / 01-07-1960 / 66 tahun / RM 1607407 (KJS BTKV) - dr. Ari / dr. Gaby*"
       then the A/Terapi/Plan, DPJP sections between dashed lines;
    B  "1.510 bed 6/Tn. X/ 29-05-73/ 53 Tahun/ RM 1733993/dr.KS/naima" — the DPJP
       code and the resident's nickname at the END, sections between "_____";
    C  the short list: "🫀 dr. ZD — 2 pasien" then "1. 414 bed 1/ Ny. X/ dr. Qalby/dr. Mirna".
  So the reader does not rely on a layout: a DPJP heading line sets the
  current DPJP; a numbered line that starts with a room ("419 bed 4/",
  "508 A/", "410/") or a DPJP code ("ZD/") starts a patient; the lines under
  it are its A/Terapi/Plan until the next patient, heading, separator or
  sign-off. A numbered diagnosis or drug ("1. Gagal napas …") never starts with
  a room and a slash, so it stays in the body.
*/
const LIST_PATIENT = /^[\s*_]*(?:\d{1,2}\s*\.\s*)?(.+?)[\s*_]*$/;
/** An unnumbered line counts only when it reads like an identity. */
const LOOKS_LIKE_IDENTITY = /\bRM\b|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\b(?:Tn|Ny|Nn|An|By)\b\.?/i;
const LIST_ROOM = /^(\d{3}[A-Za-z]?)(?:\s*(?:bed|be|b)\.?\s*(\w+)|\s+([A-Za-z]))?\s*\/+\s*(.*)$/i;
const LIST_SEPARATOR = /^\s*[-_=]{5,}\s*$/;
const LIST_KJS_HEAD = /^[\s*_]*KJS[\s*_:]*$/i;
const LIST_DPJP_HEAD = /^[\s*_]*(?:\p{Extended_Pictographic}|\u200d|\ufe0f|\p{Emoji_Modifier})*\s*(?:dr|prof)\.?\s*([A-Za-z]{2,4})\s*(?::|—|–|-)?\s*\d*\s*pas(?:i)?en/iu;

function dpjpByCode(code: string): (typeof DPJPS)[number] | null {
  const wanted = code.trim().toLowerCase();
  return DPJPS.find((d) => d.initials.toLowerCase() === wanted) ?? null;
}

/** "dr.ZD", "prof.MZ", "PT", "dr.ZD-dr.AAU" → the (first) DPJP named. */
function codeSegment(segment: string): (typeof DPJPS)[number] | null {
  const match = /^(?:dr|prof)?\.?\s*([A-Za-z]{2,4})(?:\s*-.*)?$/i.exec(segment.trim());
  return match?.[1] ? dpjpByCode(match[1]) : null;
}

export function isListMessage(text: string): boolean {
  return /mengirimkan\s+\*?list\b/i.test(text.slice(0, 200));
}

/**
 * A sent List Pasien, read back into patients (12.12, Avi: "import a list
 * from people outside Plano"): a colleague without Plano sends the list to
 * the group; pasted into Tempel, each patient becomes a report (room/bed,
 * DPJP, identity, residents, and the A/Terapi/Plan printed under it). Lines
 * under a "KJS" heading are skipped: the same patient is listed in full under
 * its own DPJP.
 *
 * 13.10: lines under a KJS heading are READ, not skipped. The skip assumed the
 * patient is also listed under its own DPJP — false when the utama is of
 * another department (or a DPJP not ours, "TM/…"): there is no own section,
 * and the patient vanished. A KJS line is merged into the patient's own line
 * when there is one (the consultant joins `kjsDpjpIds`), else kept as a
 * patient whose only cardiology DPJP is the consultant.
 */
export function readListMessage(message: ChatMessage): FloorPatient[] {
  const patients: FloorPatient[] = [];
  let section: string | null = null;
  let inKjs = false;
  let current: ListLine | null = null;
  const flush = (): void => {
    if (current) {
      const patient = listPatient(current, message, patients.length);
      if (patient) patients.push(patient);
    }
    current = null;
  };
  for (const line of message.text.split('\n')) {
    if (LIST_SEPARATOR.test(line)) {
      flush();
      inKjs = false;
      continue;
    }
    if (LIST_KJS_HEAD.test(line)) {
      flush();
      inKjs = true;
      continue;
    }
    const head = LIST_DPJP_HEAD.exec(line);
    if (head?.[1] && dpjpByCode(head[1])) {
      flush();
      section = dpjpByCode(head[1])!.id;
      inKjs = false;
      continue;
    }
    const isNumbered = /^[\s*_]*\d{1,2}\s*\./.test(line);
    const numbered = LIST_PATIENT.exec(line)?.[1] ?? '';
    const room = LIST_ROOM.exec(numbered);
    const codeFirst = !room && isNumbered ? /^([A-Za-z]{2,4})\s*\/\s*(.*)$/.exec(numbered) : null;
    const startsPatient = (room && (isNumbered || LOOKS_LIKE_IDENTITY.test(room[4] ?? ''))) || (codeFirst?.[1] && dpjpByCode(codeFirst[1]));
    if (startsPatient) {
      flush();
      const dpjp = inKjs ? null : section;
      const kjsOf = inKjs ? section : null;
      current = room
        ? { line, rest: room[4] ?? '', room: room[1] ?? '', bed: room[2] ?? room[3] ?? '', dpjp, kjsOf, body: [] }
        : { line, rest: numbered, room: '', bed: '', dpjp, kjsOf, body: [] };
      continue;
    }
    if (CLOSING.test(line)) {
      flush();
      continue;
    }
    current?.body.push(line);
  }
  flush();
  return mergeKjs(patients);
}

interface ListLine {
  line: string;
  rest: string;
  room: string;
  bed: string;
  /** The DPJP section the line is in (null under a KJS heading). */
  dpjp: string | null;
  /** Under a KJS heading: the DPJP whose KJS it is. */
  kjsOf: string | null;
  body: string[];
}

/** One patient per key: a KJS line joins the patient's own line (13.10). */
function mergeKjs(patients: FloorPatient[]): FloorPatient[] {
  const byKey = new Map<string, FloorPatient>();
  const out: FloorPatient[] = [];
  // Own lines first, so a KJS line listed before its own DPJP still merges.
  const ordered = [...patients.filter((p) => p.kjsDpjpIds.length === 0), ...patients.filter((p) => p.kjsDpjpIds.length > 0)];
  for (const patient of ordered) {
    const seen = byKey.get(patient.key);
    if (!seen) {
      byKey.set(patient.key, patient);
      out.push(patient);
      continue;
    }
    const kjs = patient.kjsDpjpIds.filter((id) => id !== seen.dpjpId && !seen.kjsDpjpIds.includes(id));
    seen.kjsDpjpIds.push(...kjs);
  }
  return out.sort((a, b) => a.index - b.index);
}

function listPatient(input: ListLine, message: ChatMessage, n: number): FloorPatient | null {
  const btkv = /\bBTKV\b/i.test(input.rest);
  /*
    "(KJS BTKV)", "(KJS Aritmia)", and the bare " - KJS BTKV" written after
    the residents ("…/dr. Didi/FU Ari - KJS BTKV", 13-10 list): notes about
    the patient, never part of a name. Left in, "Ari - KJS BTKV" became a
    resident of its own on the denah's Residen blocks.
  */
  let rest = clean(input.rest.replace(/\(\s*KJS[^)]*\)/gi, '').replace(/\s+-\s*KJS\b[^/]*$/i, ''));
  let residents: string[] = [];
  // "… - dr. Ari / dr. Gaby", "… - dr. Yudi - dr. Gabi", "…/dr. Avi - dr. Arya".
  const dash = /\s+-\s+(?=dr\.?\s)/i.exec(rest);
  let dashed: string[] = [];
  if (dash) {
    dashed = rest.slice(dash.index + dash[0].length).split(/\s*(?:\/|\s-\s)\s*(?=dr\.?\s)/i);
    rest = rest.slice(0, dash.index);
  }
  const segments = rest.split('/').map((part) => part.trim()).filter(Boolean);
  let dpjpId = input.dpjp;
  let dpjpCode = '';
  // Shape A: the code first ("KS/Tn. …").
  const first = segments[0] ? codeSegment(segments[0]) : null;
  if (first && segments[0]!.trim().length <= 4) {
    dpjpId = first.id;
    segments.shift();
  } else if (segments.length > 1 && /^[A-Z]{2,4}$/.test(segments[0]!.trim()) && readName(segments.slice(1).join(' / '))) {
    // A code that is not one of ours ("TM/HENDRA …", the utama of another
    // department): kept to print, never a DPJP box of its own (13.10).
    dpjpCode = segments.shift()!.trim();
    if (input.kjsOf) dpjpId = null;
  } else {
    // Shape B: "…/dr.ZD/naima" — the code, then the resident's nickname.
    const at = segments.findIndex((part, i) => i > 0 && codeSegment(part) !== null);
    if (at > 0) {
      dpjpId = codeSegment(segments[at]!)!.id;
      residents = segments.slice(at + 1).filter((part) => !/tindakan|kjs/i.test(part));
      segments.splice(at);
    }
  }
  // Shape C: "Ny. X/ dr. Qalby/dr. Mirna" — residents written as "dr. Name".
  if (residents.length === 0) {
    const firstDoctor = segments.findIndex((part, i) => i > 0 && /^dr\.?\s*\S/i.test(part));
    if (firstDoctor > 0) residents = segments.splice(firstDoctor);
  }
  // "… / FU Ari - dr. Didi": the follow-up resident named in the identity.
  const fu = segments.findIndex((part, i) => i > 0 && /^(?:dr\.?\s*)?FU\s+\S/i.test(part));
  if (fu > 0) residents = [...segments.splice(fu, 1), ...residents];
  residents = [...residents, ...dashed];
  const identity = segments.join(' / ');
  const rm = readRm(identity);
  const name = readName(identity) || clean(segments[0] ?? '');
  if (!rm && !name) return null;
  /*
    "FU" marks the junior wherever it is written (12.12: "dr. Didi / dr. FU
    Avi" puts the chief first); without it, junior then chief.
  */
  const names = residents.map((who) => clean(who).replace(/^(?:dr\.?\s*)+/i, '')).filter(Boolean);
  const fuAt = names.findIndex((who) => /^FU\s+/i.test(who));
  const [junior = '', chief = ''] =
    fuAt >= 0 ? [names[fuAt]!.replace(/^FU\s+/i, ''), names.find((_, i) => i !== fuAt) ?? ''] : names;
  const text = input.body.join('\n').replace(/^\n+|\s+$/g, '');
  return {
    key: rm ? `rm:${rm.replace(/^0+/, '')}` : `name:${input.room}:${name.toLowerCase()}`,
    rm,
    name,
    identity,
    room: input.room,
    bed: input.bed,
    floor: input.room.charAt(0),
    // Under a KJS heading the code (if ours) is the utama; the section's DPJP is the consultant.
    dpjpId: input.kjsOf && dpjpId === input.kjsOf ? null : dpjpId,
    kjsDpjpIds: input.kjsOf ? [input.kjsOf] : [],
    ...(dpjpCode ? { dpjpCode } : {}),
    btkv,
    body: listBody(text) || text,
    full: `${clean(input.line)}\n${text}`.trim(),
    chief: chief.charAt(0).toUpperCase() + chief.slice(1),
    junior: junior.charAt(0).toUpperCase() + junior.slice(1),
    senderNick: nicknameOf(message.sender),
    sender: message.sender,
    sentAt: message.sentAt,
    index: message.index + n / 1000,
    discharge: null,
    fromList: true,
  };
}

/** A hand-entered patient (12.10): the same shape as a read report. */
export function manualPatient(input: {
  room: string;
  bed: string;
  dpjpId: string | null;
  identity: string;
  fields: ManualFields;
  sentAt: string;
  sender: string;
  /** Kept when editing, so the patient stays the same entry. */
  key?: string | undefined;
}): FloorPatient {
  const identity = input.identity.replace(/\s+/g, ' ').trim();
  const rm = readRm(identity);
  const name = readName(identity) || identity;
  const section = (label: string, text: string): string => (text.trim() ? `${label}:\n${text.trim()}` : '');
  const body = [
    section('Diagnosis', input.fields.diagnosis),
    section('Terapi', input.fields.terapi),
    section('Plan', input.fields.plan),
  ]
    .filter(Boolean)
    .join('\n\n');
  const place = input.room ? `Kamar ${input.room}${input.bed ? ` Bed ${input.bed}` : ''}` : '';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    key: input.key ?? (rm ? `rm:${rm.replace(/^0+/, '')}` : `manual:${input.room}:${slug}`),
    rm,
    name,
    identity,
    room: input.room,
    bed: input.bed,
    floor: '',
    dpjpId: input.dpjpId,
    kjsDpjpIds: [],
    btkv: false,
    body,
    full: [`Diinput manual oleh ${input.sender || 'anggota'}${place ? ` · ${place}` : ''}`, '', identity, '', body].join('\n'),
    chief: '',
    junior: '',
    senderNick: '',
    sender: input.sender,
    sentAt: input.sentAt,
    index: 0,
    discharge: null,
    manual: true,
    manualFields: { ...input.fields },
  };
}

/** The same rule over reports already read (stored ones). */
export function latestOf(reports: readonly FloorPatient[]): FloorPatient[] {
  const byKey = new Map<string, FloorPatient>();
  for (const patient of reports) {
    const previous = byKey.get(patient.key);
    // A real SOAP always outranks a line read from a sent list (12.12).
    const rank = previous && Boolean(patient.fromList) !== Boolean(previous.fromList) ? (patient.fromList ? -1 : 1) : 0;
    const later =
      !previous ||
      rank > 0 ||
      (rank === 0 &&
        (patient.sentAt && previous.sentAt
          ? patient.sentAt > previous.sentAt || (patient.sentAt === previous.sentAt && patient.index > previous.index)
          : patient.index > previous.index));
    if (later) {
      // Residents written once (a "Chief :" header) carry over to a later report without one.
      byKey.set(patient.key, {
        ...patient,
        chief: patient.chief || previous?.chief || '',
        junior: patient.junior || previous?.junior || '',
      });
    }
  }
  return [...byKey.values()];
}
