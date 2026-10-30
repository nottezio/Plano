import { roomNamed } from '@/domain/denahPlan';
import { DPJPS, detectDpjps, dpjpById } from '@/domain/dpjp';
import type { ChatMessage } from './chat';
import type { PatientTag } from './marks';
import type { UsulPrint } from './printSettings';

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
  /** An usul H-1 is open (not accepted yet): never a colour, a small marker when the list is set to print it. */
  usul?: boolean | undefined;
  /** How the usul tag prints (label and Word colour); set by `forPrint` from the print setup, never stored. */
  usulPrint?: UsulPrint | undefined;
  /** The DPJP code prints yellow; set by `forPrint` from the print setup, never stored. */
  codeAmber?: boolean | undefined;
  /**
   * Entered by hand (pediatri patients have no SOAP in the floor group).
   * Stays on the list without daily reports until removed.
   */
  manual?: boolean | undefined;
  /** The stored WhatsApp text was edited in Plano ("Ubah SOAP", 12.11). */
  edited?: boolean | undefined;
  /**
   * When it was edited (local "YYYY-MM-DDTHH:MM", the clock of `sentAt`).
   * `sentAt` stays the message's own stamp so a re-paste does not undo the
   * edit; this is what the "SOAP baru" / "SOAP dd/mm" freshness reads.
   */
  editedAt?: string | undefined;
  /**
   * Read from a sent LIST, not a SOAP (12.12: a list from a colleague outside
   * Plano). Only A/Terapi/Plan, so it never replaces a real SOAP.
   */
  fromList?: boolean | undefined;
  /** The three fields of a hand-entered patient, for editing it again. */
  manualFields?: ManualFields | undefined;
  /** The floor's own marks on this patient (13.10, `marks.ts`); list only, never from a SOAP. */
  tags?: PatientTag[] | undefined;
  /** The residents' handover notes on the list (13.14): handed over to, new chief. */
  operkan?: string | undefined;
  gantiChief?: string | undefined;
  /** On the list view only: the SOAP arrived after the last sent list, or is from before today (13.11). */
  soap?: 'baru' | 'lama' | undefined;
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
  Lt 5 (Oct 2026 export): "Mohon ijn kami terapi dengan" (izin typed "ijn")
  and "… pasien kami asessment dengan" (one s first) were missed too, so the
  list carried no Terapi and a newer SOAP read as a summary of the older one.
*/
const ASSESS =
  /^\W*mohon\s+i[zj]i?n\b[^\n]{0,24}?\b(?:as+e?s+\w*|diagnos[ai]s?)\b(?:[^\n]{0,16}\bdengan\b|\s*:)/i;
const DX = /^\W*(?:diagnos[ai]s?|diagnosa|asses+t?ment)\W*$/i;
const TERAPI = /^\W*mohon\s+i[zj]i?n\b[^\n]{0,24}?\b(?:inisial\s+)?terapi\b(?:[^\n]{0,16}\bdengan\b|\s*:)/i;
/**
 * A sign-off ends the tail. Never a bulleted line: "- Mohon arahan DPJP" in a
 * plan is an instruction, not the closing.
 */
const CLOSING =
  /^\s*[*_]*(?:tabe\b[^\n]*?)?(?:selanjutnya\s+)?mohon\s+arahan|^\s*[*_]*tabe[,.]?\s+(?:dokter[,.]?\s+)?terima\s+kasih|^\s*[*_]*terima\s*kasih|^\s*[*_]*jam\s+verifikasi/i;
const PLAN = /^\W*(?:plan|p)\W*(?:\s|$)/i;
/** "Saat ini evaluasi kardiologi berdasarkan …", "Kesimpulan :": a consultation's own assessment. */
const EVALUATION = /^\W*(?:saat\s+ini\s+)?(?:hasil\s+)?evaluasi\s+kardiologi\b|^\W*kesimpulan\s*(?:kardiologi\s*)?:/i;
const TS_HEAD = /^\W*TS\s+\S/;

/** Zero-width characters WhatsApp keeps from copied text (U+2060 before "Tn." in a Lt. 4 SOAP, 2026-10-16). */
const INVISIBLE = /[\u200B-\u200F\u2060\uFEFF\u00AD]/g;

function clean(line: string): string {
  return line.replace(INVISIBLE, '').replace(/[*_~]/g, '').replace(/\s+/g, ' ').trim();
}

function findOpening(lines: string[]): number {
  return lines.findIndex((line) => /\batas\s+nama\b/i.test(line));
}

/** When the SOAP on the list was last brought up to date: its edit, else its message. */
export function soapStamp(report: Pick<FloorPatient, 'sentAt' | 'editedAt'>): string {
  return report.editedAt && report.editedAt > report.sentAt ? report.editedAt : report.sentAt;
}

/** "Kamar 421 Bed 4" on a line of its own under the identity (a numbered SOAP names no room in its opening). */
function roomLine(lines: string[], opening: number): string {
  if (/\bkamar\s*:?\s*\d{3}/i.test(lines[opening] ?? '')) return '';
  for (let i = opening + 1; i < Math.min(lines.length, opening + 6); i += 1) {
    const line = clean(lines[i] ?? '');
    if (/^kamar\s*:?\s*\d{3}/i.test(line)) return line;
  }
  return '';
}

/** Room/bed: the LAST "Kamar" in the opening — "dari IGD … ke PJT Lt. 4 Kamar 408". */
function readPlace(opening: string): { room: string; bed: string; floor: string } {
  const flat = clean(opening);
  const after = /\bke\s+(.*)$/i.exec(flat)?.[1] ?? flat;
  /*
    Lt. 5 export (Oct 2026): "Kamar 508 B" / "Kamar 508 A ," (the room letter
    after a space) read as room 508, so 508A and 508B were one room; "Kamar
    VIP 501" / "Kamar Super VIP 501" read no room; "Kamr 510" (typo) neither.
  */
  const room = [...after.matchAll(/\bkam(?:a)?r\s*:?\s*(?:(?:super\s*-?\s*)?vip\s*)?(\d{3})(?:([A-Da-d])|\s([A-Da-d]))?\b/gi)].at(-1);
  const tail = room ? after.slice((room.index ?? 0) + room[0].length) : after;
  // "Bed bed 4" (Lt. 5, 2026-10-12): the word typed twice is still bed 4.
  const bed = /\bbed\s*:?\s*(?:bed\s*:?\s*)?(\w+)/i.exec(tail);
  // "Lt .4", "Lt.4", "Lantai 4" (12.12: "Lt .4" was missed).
  const written = /\b(?:lantai|lt)\s*\.?\s*(\d+)/i.exec(after)?.[1] ?? '';
  let number = room ? `${room[1] ?? ''}${(room[2] ?? room[3] ?? '').toUpperCase()}` : '';
  // "PJT Lantai 5 Bed 508 A" (Lt. 5): the room written as the bed, no "Kamar".
  const roomAsBed = !number && written ? new RegExp(`\\bbed\\s*:?\\s*(${written}\\d{2})(?:\\s?([A-Da-d]))?\\b`, 'i').exec(after) : null;
  if (roomAsBed) return { room: `${roomAsBed[1]}${(roomAsBed[2] ?? '').toUpperCase()}`, bed: '', floor: written };
  // A room named, not numbered: "Kamar Super VIP", "Lt.4 Supervip".
  if (!number && /\bsuper\s*-?\s*vip\b/i.test(after)) number = roomNamed(written, 'Super VIP');
  // A unit, not a ward room (19 Oct 2026): "CVCU Bed 9", "HCU Bed 1",
  // "ICU bed 4", "CVCU VIP 1". Only when no ward room was named, so "dari
  // CVCU Bed 9 ke PJT Lt.4 Kamar 417" stays 417. A unit has no floor.
  if (!number && !written) {
    const unit = unitPlace(after);
    if (unit) return { room: unit.room, bed: unit.bed || (bed?.[1] ?? ''), floor: '' };
  }
  // "PJT Kamar 417": the floor is the room's first digit.
  const floor = written || (/^\d{3}/.test(number) ? number.charAt(0) : '');
  return { room: number, bed: bed?.[1] ?? '', floor };
}

/**
 * A CVCU/HCU/ICU place: "CVCU Bed 1" → CVCU/1, "CVCU VIP 1" → "CVCU VIP"/1,
 * "CVCU Super VIP" / "CVCU Isolasi" → that room, no bed (19 Oct 2026).
 */
const UNIT = /\b(I?CVCU|HCU|ICU)\b(?:\s*(?:bed|b)\s*\.?\s*:?\s*(\w+)|\s+(super\s*-?\s*vip|vip|isolasi)\b\s*(\d*))?/i;

export function unitPlace(text: string): { room: string; bed: string; rest: string } | null {
  const match = UNIT.exec(text);
  if (!match?.[1]) return null;
  const unit = match[1].toUpperCase();
  const rest = text.slice((match.index ?? 0) + match[0].length);
  if (match[2]) return { room: unit, bed: match[2], rest };
  if (match[3]) {
    const label = /super/i.test(match[3]) ? 'Super VIP' : /vip/i.test(match[3]) ? 'VIP' : 'Isolasi';
    return { room: `${unit} ${label}`, bed: match[4] ?? '', rest };
  }
  return { room: unit, bed: '', rest };
}

function readIdentity(lines: string[], opening: number): string {
  for (let i = opening + 1; i < Math.min(lines.length, opening + 5); i += 1) {
    const line = clean(lines[i] ?? '');
    if (!line) continue;
    // "1. Ny. X / 25 tahun / RM 1": the list number is not part of the name.
    if (/\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\bRM\b|\d{6,}/i.test(line)) return line.replace(/^\d{1,2}\s*\.\s+/, '');
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
  /*
    A consultation answered with an echo or a pre-operative evaluation (Lt. 5,
    2026-10-05: "konsul byname dari TS Geriatri … Pasien dikonsulkan untuk
    evaluasi echocardiography") has no Diagnosis/assess heading: its A is the
    paragraph "Saat ini evaluasi kardiologi berdasarkan …, pasien dengan …".
    The list carried nothing for it. That paragraph (to the sign-off) is the
    A/P now, as written.
  */
  if (start === -1) start = lines.findIndex((line) => EVALUATION.test(line));
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

/** "Usul H-1": the resident proposes it; the supervisor has not agreed yet (26 Oct 2026). */
const USUL_H1 = /\busul\s+H\s*-?\s*1\b/i;

/** What the Plan lines say: the firm discharge flag, and whether an usul H-1 stands in it. */
function readPlan(body: string): { flag: DischargeFlag; usul: boolean } {
  let inPlan = false;
  let flag: DischargeFlag = null;
  let usul = false;
  for (const line of body.split('\n')) {
    if (TS_HEAD.test(line)) inPlan = false;
    else if (PLAN.test(line)) inPlan = true;
    else if (/^\W*(?:diagnosis|terapi|selesai)\W*:?\s*$/i.test(line)) inPlan = false;
    if (!inPlan) continue;
    if (/\b(?:rawat\s+jalan|pulang|aff\s+rawat|discharge)\b.*\bhari\s+ini\b/i.test(line)) return { flag: 'today', usul: false };
    // A proposal is not a plan: "Usul H-1 hari ini" must not read as "H-1 hari ini".
    if (USUL_H1.test(line)) {
      usul = true;
      continue;
    }
    if (/\bH\s*-\s*1\b.*\bhari\s+ini\b|\brencana\s+H\s*-?\s*1\b|\b(?:pulang|rawat\s+jalan)\s+besok\b/i.test(line)) flag = 'tomorrow';
  }
  // A firm line anywhere in the Plan outranks an usul: the supervisor has decided.
  return { flag, usul: usul && flag === null };
}

/** Red (H-1) / green (pulang hari ini), from the Plan lines only — never the diagnosis. */
export function dischargeFlag(body: string): DischargeFlag {
  return readPlan(body).flag;
}

/** The Plan only proposes H-1 ("usul H-1"), with no firm discharge line: a chip to confirm, never a colour. */
export function usulH1(body: string): boolean {
  return readPlan(body).usul;
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

  const place = readPlace(`${lines[opening] ?? ''} ${roomLine(lines, opening)}`);
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

/** "1. Ny. X / 25 tahun / RM 114976": a numbered identity under a shared opening. */
const NUMBERED_IDENTITY = /^[\s*_]*\d{1,2}\s*\.\s+(?:Tn|Ny|Nn|An|By|Sdri?)\b.*\bRM\s*:?\s*\d{4,}/i;

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
  /*
    One opening, several patients: "… pasien PJT Lantai 4 atas nama:" then
    "1. Ny. X / 25 tahun / RM 114976", "Kamar 421 Bed 4", … and "2. Tn. Y / …".
    Each numbered identity starts a patient; the opening above is shared.
  */
  const numbered = lines.map((line, i) => (NUMBERED_IDENTITY.test(line) ? i : -1)).filter((i) => i >= 0);
  const shared = openings.length === 1 && numbered.length >= 2 && numbered[0]! > openings[0]!;
  if (openings.length <= 1 && !shared) {
    const one = readReport(message);
    return one ? [one] : [];
  }
  const parts = shared
    ? numbered.map((at, k) => [...lines.slice(0, numbered[0]), ...lines.slice(at, numbered[k + 1] ?? lines.length)].join('\n'))
    : openings.map((at, k) => {
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
/** "1. …", and "1..519 Bed 2/…" with the dot doubled (Lt. 5-6, 2026-10-14: those patients were lost). */
const LIST_PATIENT = /^[\s*_]*(?:\d{1,2}\s*\.+\s*)?(.+?)[\s*_]*$/;
/** An unnumbered line counts only when it reads like an identity. */
const LOOKS_LIKE_IDENTITY = /\bRM\b|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\b(?:Tn|Ny|Nn|An|By)\b\.?/i;
/** "bad" is "bed" mistyped (Lt. 5, 29-10: "513 bad 1/ …", "510 bad 6/ …" — both of dr. YP's patients were lost). */
const LIST_ROOM = /^(\d{3}[A-Za-z]?)(?:\s*(?:bed|bad|be|b)\.?\s*(\w+)|\s+([A-Za-z]))?\s*\/+\s*(.*)$/i;
/** A separator, and (Lt. 5, 29-10) one with text glued after it: "_________________List Pasien Lt. 6  0  pasien". */
const LIST_SEPARATOR = /^\s*[-_=]{5,}/;
const LIST_KJS_HEAD = /^[\s*_]*KJS[\s*_:]*$/i;
/**
 * "🫀 dr. ZD — 2 pasien", "Prof. PK 3 Pasien", and (2026-10-14) the count in
 * brackets: "Dr.AHA  (1 pasien)", "Prof. MZ ( 3 Pasien)". The bracket form
 * was missed, so the patients under it stayed with the heading above (AHA's
 * under AFG, MZ's under PK).
 */
const LIST_DPJP_HEAD = /^[\s*_]*(?:\p{Extended_Pictographic}|\u200d|\ufe0f|\p{Emoji_Modifier})*\s*(?:dr|prof)\.?\s*([A-Za-z]{2,4})\s*(?::|—|–|-|\()?\s*\d*\s*pas(?:i)?en/iu;

function dpjpByCode(code: string): (typeof DPJPS)[number] | null {
  const wanted = code.trim().toLowerCase();
  return DPJPS.find((d) => d.initials.toLowerCase() === wanted) ?? null;
}

/** "dr.ZD", "prof.MZ", "PT", "dr.ZD-dr.AAU" → the (first) DPJP named. */
function codeSegment(segment: string): (typeof DPJPS)[number] | null {
  const match = /^(?:dr|prof)?\.?\s*([A-Za-z]{2,4})(?:\s*-.*)?$/i.exec(segment.trim());
  return match?.[1] ? dpjpByCode(match[1]) : null;
}

/**
 * CVCU/HCU/ICU List Pasien (19 Oct 2026). Unlike a ward list there are no
 * DPJP headings: a numbered place line ("1. CVCU Bed 1", "16. CVCU VIP 1",
 * "1. ICU bed 4"), then the identity on the next line with the DPJP and the
 * residents inside it. Written by a different resident each day, so the
 * identity is read by what it contains, not by position:
 *   "Tn. X/…/RM …/dr. PT - dr. AHA (Bima- dr. Kepala)"
 *   "(X RM 123/ Pasien dr MAA)"          short entry, whole line in brackets
 *   "(BTKV) Ny. X/…/RM …/ dr AFG"        BTKV patient
 *   "…/RM …/ ARB", "…/ dr/ PT", "…/ Prof.PK", "… ( Pemantauan ) (Sekar - dr. Kepala)"
 * The first DPJP code named is the DPJP; the last bracket with a name in it
 * holds the residents (junior, then chief).
 */
const UNIT_LINE = /^[\s*_]*\d{1,2}\s*\.+\s*((?:I?CVCU|HCU|ICU)\b.*)$/i;
/** "ICU : 2 pasien", "HCU: 3 Pasien": a unit heading, not part of the patient above. */
const UNIT_HEAD = /^[\s*_]*(?:I?CVCU|HCU|ICU)\b[^:\n]{0,20}:\s*\d+\s*pasien\b/i;
/** A DPJP code as written in an identity: "dr. PT", "dr MAA", "dr/ PT", "Prof.PK", "dr.AFM". */
const IDENTITY_CODE = /(?:[Pp]asien\s+)?\b(?:[Dd][Rr]|[Pp][Rr][Oo][Ff])\s*\.?\s*\/?\s*([A-Z]{2,4})\b/g;
const NOT_RESIDENTS = /^\s*(?:pemantauan|btkv|kjs\b.*|)\s*$/i;

/** The residents in the last bracket that names someone; '' when none. */
function lastBracket(text: string): string {
  const groups = [...text.matchAll(/\(([^()]*)\)/g)].map((m) => m[1] ?? '');
  return [...groups].reverse().find((g) => /[A-Za-z]{3}/.test(g) && !NOT_RESIDENTS.test(g)) ?? '';
}

/** A unit identity line → the shape `listPatient` reads: "identity / dr.CODE - dr. Junior / dr. Chief". */
function unitIdentity(raw: string, placeResidents: string): string {
  let text = clean(raw);
  // The whole entry in brackets: "(X RM 123/ Pasien dr MAA)".
  if (/^\(.*\)$/.test(text) && !/\)\s*\(/.test(text)) text = text.slice(1, -1).trim();
  const btkv = /\bBTKV\b/i.test(text);
  text = text.replace(/^\(\s*BTKV\s*\)\s*/i, '');
  const residents = lastBracket(text) || placeResidents;
  // Brackets are notes or residents, never identity; an unclosed one at the end too.
  text = text.replace(/\([^()]*\)/g, ' ').replace(/\(\s*$/, ' ');
  let code = '';
  const segments = text
    .split('/')
    .map((segment) => {
      const found = [...segment.matchAll(IDENTITY_CODE)]
        .map((m) => m[1] ?? '')
        .filter((c) => dpjpByCode(c));
      if (!code && found[0]) code = found[0];
      const left = segment.replace(IDENTITY_CODE, ' ').replace(/\bpasien\b/gi, ' ').replace(/[\s-]+/g, ' ').trim();
      // A segment that is only a code: "ARB", "PT" after "dr/" (and that "dr").
      if (!left || /^(?:dr|prof)\.?$/i.test(left) || (dpjpByCode(left) && left.length <= 4)) {
        if (!code && dpjpByCode(left)) code = left;
        return '';
      }
      return found.length > 0 ? left : segment.trim();
    })
    .filter(Boolean)
    // "X RM 123": the RM on its own, so the name is read as a name.
    .flatMap((segment) => segment.replace(/\s+(RM\s*:?\s*\d)/i, ' / $1').split(' / '));
  const people = residents
    .split(/\s*(?:\/|-|,)\s*/)
    .map((who) => who.replace(/^(?:dr\.?\s*)+/i, '').trim())
    .filter((who) => /[A-Za-z]{2}/.test(who));
  return (
    segments.join(' / ') +
    (code ? ` / dr.${code}` : '') +
    (btkv ? ' (KJS BTKV)' : '') +
    (people.length > 0 ? ` - ${people.map((who) => `dr. ${who}`).join(' / ')}` : '')
  );
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
  /** A unit place line was read; its identity is on the next non-blank line. */
  let unitAwaiting: { line: string; room: string; bed: string; residents: string } | null = null;
  for (let line of message.text.split('\n')) {
    if (unitAwaiting) {
      if (!line.trim()) continue;
      const pending: { line: string; room: string; bed: string; residents: string } = unitAwaiting;
      unitAwaiting = null;
      // "Kosong": an empty bed.
      if (/^[\s*_]*kosong[\s*_.]*$/i.test(line)) continue;
      // "Pasien BTKV - dr. NP": no RM and no name, nobody to file.
      if (!readRm(line) && !/\b(?:Tn|Ny|Nn|An|By|Sdri?)\b\.?/i.test(line) && !/^\s*\(/.test(line)) continue;
      current = {
        line: `${pending.line}\n${line}`,
        rest: unitIdentity(line, pending.residents),
        room: pending.room,
        bed: pending.bed,
        dpjp: null,
        kjsOf: null,
        body: [],
      };
      continue;
    }
    const unit = UNIT_LINE.exec(line);
    const unitAt = unit?.[1] ? unitPlace(unit[1]) : null;
    if (unitAt) {
      flush();
      inKjs = false;
      const tail = unitAt.rest.trim();
      // The identity on the same line ("1. CVCU Bed 1 / Tn. …").
      if (/^\/\s*\S/.test(tail)) {
        current = { line, rest: unitIdentity(tail.replace(/^\/\s*/, ''), ''), room: unitAt.room, bed: unitAt.bed, dpjp: null, kjsOf: null, body: [] };
      } else {
        unitAwaiting = { line, room: unitAt.room, bed: unitAt.bed, residents: lastBracket(tail) };
      }
      continue;
    }
    if (UNIT_HEAD.test(line)) {
      flush();
      continue;
    }
    const separator = LIST_SEPARATOR.exec(line);
    if (separator) {
      flush();
      inKjs = false;
      // The text glued after it is a heading line of its own ("List Pasien Lt. 6", "🫀dr. AHA …").
      line = line.slice(separator[0].length);
      if (!line.trim()) continue;
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

/**
 * A list block whose diagnoses stand right under the patient line with no
 * heading (Lt. 4 lists of 09-10 and 11-10: "- STEMI Inferoposterior …" then
 * "Mohon izin kami terapi dengan:"). `listBody` found no A, so the block came
 * through as raw text with no Diagnosis section. The heading is put in when
 * the first line is a bullet; a list block has no S/O, so a first bullet
 * there is the A. A SOAP never comes here.
 */
function headlessDx(text: string): string {
  const lines = text.split('\n');
  const at = lines.findIndex((line) => line.trim());
  const first = lines[at] ?? '';
  // "A/" written as the heading (Lt. 4, 11-10 evening): the A of the block.
  if (/^\W*A\s*\/\s*$/.test(first)) return ['Diagnosis:', ...lines.slice(at + 1)].join('\n');
  return /^\s*[-•]\s*\S/.test(first) ? `Diagnosis:\n${text}` : '';
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
    /*
      The same patient twice as an own line (Lt. 5, 29-10: "3. 604/Tn. X" with
      nothing under it in dr. AHA's part, then again under "List Pasien Lt. 6"
      with the A/Terapi/Plan): the first, empty one used to win and the list
      showed no diagnosis. The one with a body is kept.
    */
    if (!seen.body.trim() && patient.body.trim() && patient.kjsDpjpIds.length === 0) {
      Object.assign(seen, { body: patient.body, full: patient.full, room: seen.room || patient.room, bed: seen.bed || patient.bed });
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
    // A unit room ("CVCU") has no floor; a ward room's floor is its first digit.
    floor: /^\d/.test(input.room) ? input.room.charAt(0) : '',
    // Under a KJS heading the code (if ours) is the utama; the section's DPJP is the consultant.
    dpjpId: input.kjsOf && dpjpId === input.kjsOf ? null : dpjpId,
    kjsDpjpIds: input.kjsOf ? [input.kjsOf] : [],
    ...(dpjpCode ? { dpjpCode } : {}),
    btkv,
    body: listBody(text) || listBody(headlessDx(text)) || text,
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

/**
 * The text a hand-entered patient shows (13.12, Avi: "why is the UI of a
 * manual patient different from a WhatsApp one?"). It was a private shape —
 * "Diinput manual oleh …", the identity, then "Diagnosis:/Terapi:/Plan:" —
 * so the SOAP window read it as other sections, with other jump chips, than
 * every report from the group. Now it is written as a ward report: the
 * opening with room/bed, the identity, the DPJP Utama line, and the group's
 * own headings. Everything that reads a SOAP reads it the same way.
 */
export function manualFullText(input: {
  room: string;
  bed: string;
  dpjpId: string | null;
  identity: string;
  fields: ManualFields;
  sender: string;
}): string {
  const place = input.room ? ` Kamar ${input.room}${input.bed ? ` Bed ${input.bed}` : ''}` : '';
  const dpjp = input.dpjpId ? dpjpById(input.dpjpId)?.name : undefined;
  const block = (heading: string, text: string): string[] => (text.trim() ? [heading, text.trim(), ''] : []);
  return [
    `Diinput manual oleh ${input.sender || 'anggota'}.`,
    `Mohon izin melaporkan pasien${place} atas nama:`,
    '',
    input.identity.replace(/\s+/g, ' ').trim(),
    '',
    ...(dpjp ? [`DPJP Utama : ${dpjp}`, ''] : []),
    ...block('Mohon izin kami assess dengan:', input.fields.diagnosis),
    ...block('Mohon izin kami terapi dengan:', input.fields.terapi),
    ...block('Plan:', input.fields.plan),
  ]
    .join('\n')
    .trimEnd();
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
    full: manualFullText({ ...input, identity }),
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
/**
 * A newer message that is only a summary of a SOAP already seen ("Post Tindakan"
 * with a Diagnosis block and a "Verifikasi" line, no Terapi). "Latest wins"
 * made it replace the full SOAP, so the list lost the terapi.
 */
export function isSummaryOf(report: FloorPatient, earlier: FloorPatient): boolean {
  const terapi = (p: FloorPatient): boolean => /^Terapi:/m.test(p.body);
  return !report.fromList && !earlier.fromList && terapi(earlier) && !terapi(report);
}

export function latestOf(reports: readonly FloorPatient[]): FloorPatient[] {
  const byKey = new Map<string, FloorPatient>();
  for (const patient of reports) {
    const previous = byKey.get(patient.key);
    if (previous && isSummaryOf(patient, previous)) {
      byKey.set(patient.key, { ...previous, chief: previous.chief || patient.chief, junior: previous.junior || patient.junior });
      continue;
    }
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
      /*
        Residents written once (a "Chief :" header) carry over to a later
        report without one. So does the DPJP (Lt. 5, Oct 2026: a follow-up
        that left out its "DPJP Utama dan Tindakan" line was filed under no
        DPJP, though the day before named one).
      */
      const keepDpjp = !patient.dpjpId && patient.kjsDpjpIds.length === 0 && previous?.dpjpId;
      byKey.set(patient.key, {
        ...patient,
        ...(keepDpjp ? { dpjpId: previous.dpjpId } : {}),
        chief: patient.chief || previous?.chief || '',
        junior: patient.junior || previous?.junior || '',
      });
    }
  }
  return [...byKey.values()];
}
