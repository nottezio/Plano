import { DPJPS, detectDpjps } from '@/domain/dpjp';
import type { ChatMessage } from './chat';

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
  /** The three fields of a hand-entered patient, for editing it again. */
  manualFields?: ManualFields | undefined;
}

export interface ManualFields {
  diagnosis: string;
  terapi: string;
  plan: string;
}

/** Surgeons: never the cardiology DPJP a patient is filed under. */
const BTKV_IDS = new Set(DPJPS.filter((d) => /BTKV/i.test(d.name)).map((d) => d.id));

const ASSESS = /^\W*mohon\s+(?:izin|ijin)\s+(?:pasien\s+)?(?:kami\s+)?asses+t?\w*\s+dengan\b/i;
const DX = /^\W*(?:diagnos[ai]s?|diagnosa)\W*$/i;
const TERAPI = /^\W*mohon\s+(?:izin|ijin)\s+(?:pasien\s+)?(?:kami\s+)?terapi\s+dengan\b/i;
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
  const floor = /\b(?:lantai|lt)\.?\s*(\d+)/i.exec(after);
  return { room: room?.[1] ?? '', bed: bed?.[1] ?? '', floor: floor?.[1] ?? '' };
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
  const kjs = cardio
    .filter((d) => d !== filed && /aritmia|eko\b|intervensi|kjs/.test(role(d)) && !/tindakan|utama|pelimpahan/.test(role(d)))
    .map((d) => d.id);
  return { dpjpId: filed?.id ?? null, kjs, btkvDpjp: detected.some((d) => BTKV_IDS.has(d.id)) };
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
    discharge: dischargeFlag(body),
  };
}

export type GoneReason = 'pulang' | 'tanpa-laporan';

export interface GonePatient {
  patient: FloorPatient;
  reason: GoneReason;
}

function dayBefore(date: string): string {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() - 1);
  return at.toISOString().slice(0, 10);
}

/**
 * The patients still on the floor for the list of `date`.
 *
 * - `pulang`: the last report, from an earlier day, said they go home that day.
 * - `tanpa-laporan`: no report since the day before the list. Every patient
 *   gets a follow-up every day, so silence means they left (or moved) without
 *   a message saying so — on the 4 days of the floor's chat this matched the
 *   sent lists. Not dropped silently: the page lists them to put back.
 *
 * A report with no readable date is kept (nothing to judge it by).
 *
 * Red/green are read RELATIVE TO THE REPORT: "H-1" / "pulang besok" written
 * yesterday is "pulang hari ini" on today's list.
 */
export function onFloor(
  patients: readonly FloorPatient[],
  date: string,
): { present: FloorPatient[]; gone: GonePatient[] } {
  const present: FloorPatient[] = [];
  const gone: GonePatient[] = [];
  const oldest = dayBefore(date);
  for (const patient of patients) {
    const day = patient.sentAt.slice(0, 10);
    if (day && day < date && patient.discharge === 'today') gone.push({ patient, reason: 'pulang' });
    else if (day && day < oldest && !patient.manual) gone.push({ patient, reason: 'tanpa-laporan' });
    else if (day && day === oldest && patient.discharge === 'tomorrow') present.push({ ...patient, discharge: 'today' });
    else present.push(patient);
  }
  return { present, gone };
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
    discharge: dischargeFlag(body),
    manual: true,
    manualFields: { ...input.fields },
  };
}

/** The same rule over reports already read (stored ones). */
export function latestOf(reports: readonly FloorPatient[]): FloorPatient[] {
  const byKey = new Map<string, FloorPatient>();
  for (const patient of reports) {
    const previous = byKey.get(patient.key);
    const later =
      !previous ||
      (patient.sentAt && previous.sentAt ? patient.sentAt > previous.sentAt || (patient.sentAt === previous.sentAt && patient.index > previous.index) : patient.index > previous.index);
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
