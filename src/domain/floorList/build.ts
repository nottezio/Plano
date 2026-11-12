import { formatLongDate } from '@/domain/clinicalDate';
import { dpjpById, isTrioDpjp } from '@/domain/dpjp';
import { visitIndex } from '@/domain/denahPlan';
import { BOLD_RE, SINGLE_BOLD_RE } from '@/domain/format/formatters';
import { otherDepartmentUtama, type FloorPatient } from './report';

/**
 * List Maker, step 3: the patients → the List Pasien message (12.8).
 *
 * The shape is the one the floor sends every morning and Avi's printed list
 * (31-08-2026): opening, counts, one line per DPJP, then each DPJP's block
 * with its patients' A/P. Black text only — emphasis is WhatsApp `*bold*`,
 * which the Word export turns into bold.
 */

/** The order the floor's list uses; a DPJP not here follows, then pediatri. */
export const LIST_DPJP_ORDER = ['ks', 'pt', 'aha', 'afg', 'mz', 'ahn', 'arb', 'zd', 'afm', 'im', 'pk', 'maa', 'np'] as const;
export const PEDIATRI_DPJP_IDS = ['aau', 'yp'] as const;

const PROF = new Set(['mz', 'im', 'pk']);
const SEPARATOR = '-------------------------------------';

export function dpjpTitle(id: string): string {
  const initials = dpjpById(id)?.initials ?? id.toUpperCase();
  return `${PROF.has(id) ? 'Prof.' : 'dr.'} ${initials}`;
}

export function isPediatri(id: string | null): boolean {
  return id !== null && (PEDIATRI_DPJP_IDS as readonly string[]).includes(id);
}

/** "417 Bed 4/KS/<identity> (KJS BTKV) - dr. Junior / dr. Chief". */
/** The DPJP code printed on a line: ours, or the one written on a sent list ("TM", 13.10). */
export function dpjpCodeOf(patient: Pick<FloorPatient, 'dpjpId' | 'dpjpCode'> & { pelimpahan?: string | undefined }): string {
  const own = patient.dpjpId ? (dpjpById(patient.dpjpId)?.initials ?? '') : (patient.dpjpCode ?? '');
  // Pelimpahan of the day: "AFG->ZD", the DPJP on leave then the one covering.
  return own && patient.pelimpahan ? `${own}->${patient.pelimpahan}` : own;
}

export function patientLine(patient: FloorPatient): string {
  const place = patient.room ? `${patient.room}${patient.bed ? ` Bed ${patient.bed}` : ''}` : '';
  const code = dpjpCodeOf(patient);
  const head = [place, code, patient.identity].filter(Boolean).join('/');
  const residents = [patient.junior, patient.chief].filter(Boolean).map((name) => `dr. ${name}`).join(' / ');
  return `${head}${patient.btkv ? ' (KJS BTKV)' : ''}${residents ? ` - ${residents}` : ''}`;
}

/** Visit-route order on the floor, then room number, then bed. */
export function byRoute(ward: string) {
  return (a: FloorPatient, b: FloorPatient): number => {
    const ia = visitIndex(ward, a.room) ?? 999;
    const ib = visitIndex(ward, b.room) ?? 999;
    if (ia !== ib) return ia - ib;
    if (a.room !== b.room) return a.room.localeCompare(b.room);
    return a.bed.localeCompare(b.bed, undefined, { numeric: true });
  };
}

export interface FloorCounts {
  total: number;
  kardio: number;
  btkv: number;
  tsLain: number;
  pediatri: number;
  byDpjp: Map<string, { own: number; btkv: number; kjs: number }>;
}

/** KJS TS Lain: cardiology as the consulting side for a non-BTKV specialty. */
function isTsLain(patient: FloorPatient): boolean {
  if (patient.btkv || isPediatri(patient.dpjpId)) return false;
  return /\bKJS\b/i.test(patient.full.slice(0, 400)) || otherDepartmentUtama(patient.full);
}

export function floorCounts(patients: readonly FloorPatient[]): FloorCounts {
  const byDpjp = new Map<string, { own: number; btkv: number; kjs: number }>();
  const row = (id: string) => {
    let entry = byDpjp.get(id);
    if (!entry) byDpjp.set(id, (entry = { own: 0, btkv: 0, kjs: 0 }));
    return entry;
  };
  let pediatri = 0;
  let btkv = 0;
  let tsLain = 0;
  for (const patient of patients) {
    if (isPediatri(patient.dpjpId)) pediatri += 1;
    else if (patient.btkv) btkv += 1;
    else if (isTsLain(patient)) tsLain += 1;
    if (patient.dpjpId) {
      const entry = row(patient.dpjpId);
      entry.own += 1;
      if (patient.btkv) entry.btkv += 1;
    }
    for (const id of patient.kjsDpjpIds) row(id).kjs += 1;
  }
  return {
    total: patients.length,
    kardio: patients.length - pediatri - btkv - tsLain,
    btkv,
    tsLain,
    pediatri,
    byDpjp,
  };
}

export interface ListOptions {
  /** "PJT Lantai 4". */
  ward: string;
  /** ISO date of the list. */
  date: string;
  /** "04.00". */
  time: string;
  /** Trio patients (AFM, AFG, ZD) print their whole SOAP, not only the A/P (Setelan). */
  trioFullSoap?: boolean;
}

export function dpjpOrder(patients: readonly FloorPatient[]): string[] {
  const seen = new Set<string>([...LIST_DPJP_ORDER]);
  const extra = patients
    .flatMap((patient) => [patient.dpjpId, ...patient.kjsDpjpIds])
    .filter((id): id is string => id !== null && !seen.has(id) && !isPediatri(id));
  return [...LIST_DPJP_ORDER, ...new Set(extra), ...PEDIATRI_DPJP_IDS];
}

/**
 * "dr. AFG : 2 pasien (1 kardio, 1 KJS BTKV)" (12.12). It read "1 pasien
 * (1 BTKV)", which Avi pointed out reads as TWO patients — one kardio and one
 * BTKV — when the BTKV patient is one of the n. Now the split is spelled out,
 * and a DPJP whose patients are all BTKV reads "1 pasien KJS BTKV". "+ n KJS"
 * stays: those are patients filed under another DPJP, added on top.
 */
export function countLabel(n: number, extra: { btkv: number; kjs: number }): string {
  const kardio = n - extra.btkv;
  const own =
    extra.btkv === 0
      ? `${n} pasien`
      : kardio === 0
        ? `${n} pasien KJS BTKV`
        : `${n} pasien (${kardio} kardio, ${extra.btkv} KJS BTKV)`;
  return extra.kjs > 0 ? `${own} + ${extra.kjs} KJS` : own;
}

/** WhatsApp bold markers off (the same spans the Word export reads as bold); the text is kept. */
export function unbold(text: string): string {
  return text.replace(BOLD_RE, '$1').replace(SINGLE_BOLD_RE, '$1$2');
}

// The message's own framing, which the list already says elsewhere: the greeting and "mohon izin
// melaporkan … atas nama:" line, the DPJP lines, Chief/Junior (all in the patient's header), and
// "Selanjutnya mohon arahan dokter. Terima kasih" in its spellings ("arahannya", "arahanta").
// `[\W_]*`: WhatsApp italics (`_DPJP …_`) and bold (`*…*`) wrap a line, and `\W` alone would not skip the underscore.
const OPENING_LINE = /^[\W_]*(?:assalamu|selamat\s+(?:pagi|siang|sore|malam)\b)|\bi[jz]in\s+melaporkan\b/i;
const CLOSING_LINE = /^[\W_]*(?:(?:selanjutnya|tabe)\b.*(?:\barah\w*|terima\s+kasih)|terima\s+kasih\b)/i;
const DPJP_LINE = /^[\W_]*dpjp\b/i;
const CHIEF_LINE = /^[\W_]*(?:chief|junior)\s*:/i;
const squash = (text: string): string => text.replace(/[\s*_]/g, '').toLowerCase();

/**
 * The whole SOAP of a patient for the list text, minus the lines the list already carries: the
 * opening, the name line (the header's), the DPJP lines, Chief/Junior and the closing. The
 * clinical text between them is untouched.
 */
export function soapForList(patient: Pick<FloorPatient, 'full' | 'identity' | 'rm'>): string {
  return stripReportFrame(patient.full, { identity: patient.identity, rm: patient.rm });
}

/**
 * A report minus its frame (opening, name line, DPJP lines, Chief/Junior, closing). Shared by
 * the list's Trio full SOAP and Slide MZ, which both show the clinical text under a header that
 * already names the patient. Lines are dropped whole; no kept line is changed.
 */
export function stripReportFrame(body: string, frame: { identity?: string; rm?: string }): string {
  const idKey = frame.identity ? squash(frame.identity) : null;
  const rm = (frame.rm ?? '').replace(/^0+/, '');
  const rmLine = rm ? new RegExp(`\\bRM\\s*:?\\s*0*${rm}\\b`, 'i') : null;
  return body
    .split('\n')
    .filter((raw, i) => {
      const line = raw.trim();
      if (!line) return true;
      if (OPENING_LINE.test(line) || CLOSING_LINE.test(line) || DPJP_LINE.test(line)) return false;
      // The name line and Chief/Junior sit in the first lines; an RM further down is a lab or a report.
      if (i < 8 && (CHIEF_LINE.test(line) || squash(line) === idKey || (rmLine?.test(line) && line.includes('/')))) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildFloorList(patients: readonly FloorPatient[], options: ListOptions): string {
  const counts = floorCounts(patients);
  const floor = /\d+/.exec(options.ward)?.[0] ?? '';
  const lt = floor ? `LT ${floor}` : options.ward;
  const order = dpjpOrder(patients);
  const sorted = [...patients].sort(byRoute(options.ward));

  const out: string[] = [
    `Tabe dokter mohon izin mengirimkan *List Pasien ${options.ward}, ${formatLongDate(options.date)}, ${options.time} WITA*`,
    `🟡JUMLAH PASIEN : ${counts.total}`,
    `🫀KARDIO FU : ${lt} (${counts.kardio})`,
    `🤕KJS BTKV: ${lt} (${counts.btkv})`,
    `🤝KJS TS Lain : ${lt} (${counts.tsLain})`,
    `👶🏻PEDIATRI : ${lt} (${counts.pediatri}) PEDI KJS(0)`,
    '',
  ];

  for (const id of order) {
    const row = counts.byDpjp.get(id) ?? { own: 0, btkv: 0, kjs: 0 };
    out.push(`${isPediatri(id) ? '👶🏻' : '🫀'} ${dpjpTitle(id)} : ${countLabel(row.own, row)}`);
  }

  for (const id of order) {
    const row = counts.byDpjp.get(id) ?? { own: 0, btkv: 0, kjs: 0 };
    out.push('', SEPARATOR, `*${isPediatri(id) ? '👶🏻' : '🫀'} ${dpjpTitle(id)} : ${countLabel(row.own, row)}*`);
    const own = sorted.filter((patient) => patient.dpjpId === id);
    own.forEach((patient, k) => {
      if (k > 0) out.push('');
      out.push(`*${k + 1}. ${patientLine(patient)}*`);
      // Only the patient's line is bold (9 Nov 2026, Avi): the A/P's own `*Plan:*` is not.
      const text = options.trioFullSoap && isTrioDpjp(patient.dpjpId) && patient.full ? soapForList(patient) : patient.body;
      if (text) out.push(unbold(text));
    });
    const kjs = sorted.filter((patient) => patient.kjsDpjpIds.includes(id));
    if (kjs.length > 0) {
      out.push('', 'KJS');
      kjs.forEach((patient, k) => out.push(`${k + 1}. ${patientLine(patient)}`));
    }
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

const SHORT_RULE = '_'.repeat(47);

/** "512 Bed 2 / Tn. X / 08-11-1957 / RM 1 / KS / Naima": place, identity, DPJP code, junior; no A/P, no chief. */
export function shortLine(patient: FloorPatient): string {
  const place = patient.room ? `${patient.room}${patient.bed ? ` Bed ${patient.bed}` : ''}` : '';
  return [place, patient.identity, dpjpCodeOf(patient), patient.junior].filter(Boolean).join(' / ');
}

/** Held by a division or tagged "tidak di-FU": counted as the list's Non-Follow Up (the Residen rule). */
function isNonFollowUp(patient: FloorPatient): boolean {
  return Boolean(patient.division) || Boolean(patient.tags?.some((tag) => tag.noFollowUp));
}

/**
 * The short list (13 Nov 2026, Avi): who is on the floor, by DPJP, one line each
 * and no A/P — "Total pasien / Follow up / Non-Follow Up", a block per DPJP closed
 * by a rule, and the closing line. Dated "Jumat, 13-11-2026 pukul 04:00".
 */
export function buildShortList(patients: readonly FloorPatient[], options: ListOptions): string {
  const sorted = [...patients].sort(byRoute(options.ward));
  const nonFollowUp = sorted.filter(isNonFollowUp).length;
  const weekday = formatLongDate(options.date).split(',')[0] ?? '';
  const [year, month, day] = options.date.split('-');
  const out: string[] = [
    `*Tabe dokter izin mengirimkan List pasien pendek ${weekday}, ${day ?? ''}-${month ?? ''}-${year ?? ''} pukul ${options.time.replace('.', ':')}*`,
    `Total pasien : ${sorted.length} Pasien`,
    `Follow up: ${sorted.length - nonFollowUp} Pasien`,
    `Non-Follow Up: ${nonFollowUp} Pasien`,
    '',
  ];
  for (const id of dpjpOrder(sorted)) {
    const own = sorted.filter((patient) => patient.dpjpId === id);
    const kjs = sorted.filter((patient) => patient.kjsDpjpIds.includes(id));
    out.push(`- ${dpjpTitle(id)}: ${own.length} pasien${kjs.length > 0 ? ` + ${kjs.length} KJS` : ''}`);
    own.forEach((patient, k) => out.push(`${k + 1}. ${shortLine(patient)}`));
    if (kjs.length > 0) {
      out.push('KJS:');
      kjs.forEach((patient, k) => out.push(`${k + 1}. ${shortLine(patient)}`));
    }
    out.push(SHORT_RULE);
  }
  out.push('', 'Tabe dokter, selanjutnya mohon arahannya dokter. Terima kasih dokter');
  return out.join('\n');
}

export interface ListPart {
  /** "🫀 dr. KS : 2 pasien" (bold stars removed). */
  heading: string;
  /** The patients under it (the text as copied, minus the heading). */
  body: string;
  /** Patients in the part, own + KJS (0 = an empty DPJP). */
  count: number;
}

/**
 * The list message cut at its separators, for the coloured view (12.12, Avi:
 * "colour the list by section (DPJP) like the sensus result"). Display only:
 * the copied text is `buildFloorList` unchanged.
 */
export function splitFloorList(text: string): { intro: string; parts: ListPart[] } {
  const [intro = '', ...chunks] = text.split(`\n${SEPARATOR}\n`);
  const parts = chunks.map((chunk) => {
    const [first = '', ...rest] = chunk.split('\n');
    const body = rest.join('\n').trim();
    // Own patients are the bold "*N. …*" lines; the KJS ones follow a "KJS" line, unbolded. A numbered
    // line inside a SOAP (full SOAP of a trio patient, a numbered plan) is not a patient.
    let inKjs = false;
    let count = 0;
    for (const line of body.split('\n')) {
      if (line === 'KJS') inKjs = true;
      else if (inKjs ? /^\d+\.\s/.test(line) : /^\*\d+\.\s/.test(line)) count += 1;
    }
    return { heading: first.replace(/^\*|\*$/g, ''), body, count };
  });
  return { intro: intro.trimEnd(), parts };
}

