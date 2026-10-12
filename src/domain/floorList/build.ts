import { formatLongDate } from '@/domain/clinicalDate';
import { dpjpById } from '@/domain/dpjp';
import { visitIndex } from '@/domain/denahPlan';
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
export function patientLine(patient: FloorPatient): string {
  const place = patient.room ? `${patient.room}${patient.bed ? ` Bed ${patient.bed}` : ''}` : '';
  const code = patient.dpjpId ? (dpjpById(patient.dpjpId)?.initials ?? '') : '';
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
}

function dpjpOrder(patients: readonly FloorPatient[]): string[] {
  const seen = new Set<string>([...LIST_DPJP_ORDER]);
  const extra = patients
    .flatMap((patient) => [patient.dpjpId, ...patient.kjsDpjpIds])
    .filter((id): id is string => id !== null && !seen.has(id) && !isPediatri(id));
  return [...LIST_DPJP_ORDER, ...new Set(extra), ...PEDIATRI_DPJP_IDS];
}

function countLabel(n: number, extra: { btkv: number; kjs: number }): string {
  const btkv = extra.btkv > 0 ? ` (${extra.btkv} BTKV)` : '';
  const kjs = extra.kjs > 0 ? ` + ${extra.kjs} KJS` : '';
  return `${n} pasien${kjs}${btkv}`;
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
      if (patient.body) out.push(patient.body);
    });
    const kjs = sorted.filter((patient) => patient.kjsDpjpIds.includes(id));
    if (kjs.length > 0) {
      out.push('', '*KJS*');
      kjs.forEach((patient, k) => out.push(`${k + 1}. ${patientLine(patient)}`));
    }
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
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
    const count = body.split('\n').filter((line) => /^\*?\d+\.\s/.test(line)).length;
    return { heading: first.replace(/^\*|\*$/g, ''), body, count };
  });
  return { intro: intro.trimEnd(), parts };
}

