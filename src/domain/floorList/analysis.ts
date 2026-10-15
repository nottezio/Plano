import { localStamp, type Edition, type RosterPatient } from './floor';
import { dpjpById } from '@/domain/dpjp';
import type { FloorPatient } from './report';

/**
 * Analisis (13.12, Avi: "a data analyst that shows the movement and history
 * of the patients on the floor: pulang hari ini, rencana H-1, pindah
 * ruangan…"). Everything is read from what Plano already keeps — each roster
 * patient's log (who did what, when), status and dates, and the saved
 * editions — so nothing new is stored and nothing can drift.
 */

export type MoveKind = 'masuk' | 'pulang' | 'pindah' | 'kamar' | 'rencana' | 'lain';

export const MOVE_LABEL: Record<MoveKind, string> = {
  masuk: 'Masuk',
  pulang: 'Pulang',
  pindah: 'Pindah ruangan',
  kamar: 'Pindah kamar',
  rencana: 'Rencana pulang',
  lain: 'Lainnya',
};

export interface Movement {
  /** Local wall clock, "2026-10-13T09:05". */
  at: string;
  kind: MoveKind;
  what: string;
  by: string;
  key: string;
  patient: FloorPatient;
}

/** The kind of a logged change, from the wording the app writes. */
export function moveKind(what: string): MoveKind {
  if (/^(?:Masuk list|Masuk lagi|Dikembalikan)/i.test(what)) return 'masuk';
  if (/^Pulang$/i.test(what)) return 'pulang';
  if (/^Pindah ke\b/i.test(what)) return 'pindah';
  if (/^Pindah kamar\b/i.test(what)) return 'kamar';
  if (/H-1|pulang hari ini|rencana pulang|tanpa warna/i.test(what)) return 'rencana';
  return 'lain';
}

/** An ISO time (as logged) on the local clock. */
const local = (iso: string): string => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '' : localStamp(at);
};

/** Every logged change, newest first. */
export function movements(roster: readonly RosterPatient[]): Movement[] {
  return roster
    .flatMap((p) =>
      p.log.map((entry) => ({ at: local(entry.at), kind: moveKind(entry.what), what: entry.what, by: entry.by, key: p.key, patient: p.report })),
    )
    .filter((m) => m.at)
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

function addDays(date: string, n: number): string {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + n);
  return at.toISOString().slice(0, 10);
}

export interface DaySummary {
  date: string;
  /** Went home on this date. */
  pulang: RosterPatient[];
  /** Left for another unit (ICU, CVCU, another floor) on this date. */
  pindah: RosterPatient[];
  /** Moved room or bed on the floor on this date. */
  kamar: Movement[];
  /** Came onto the list on this date (new, back, or brought back). */
  masuk: Movement[];
  /** Still on the floor, green: going home today. */
  pulangHariIni: FloorPatient[];
  /** Still on the floor, red: going home tomorrow. */
  rencanaH1: FloorPatient[];
}

export function daySummary(date: string, roster: readonly RosterPatient[], active: readonly FloorPatient[], moves: readonly Movement[]): DaySummary {
  const leftOn = (p: RosterPatient): boolean => Boolean(p.leftAt) && local(p.leftAt).slice(0, 10) === date;
  const onDay = (m: Movement): boolean => m.at.slice(0, 10) === date;
  return {
    date,
    pulang: roster.filter((p) => p.status === 'pulang' && leftOn(p)),
    pindah: roster.filter((p) => p.status === 'pindah' && leftOn(p)),
    kamar: moves.filter((m) => m.kind === 'kamar' && onDay(m)),
    masuk: moves.filter((m) => m.kind === 'masuk' && onDay(m)),
    pulangHariIni: active.filter((p) => p.discharge === 'today'),
    rencanaH1: active.filter((p) => p.discharge === 'tomorrow'),
  };
}

export interface DayCount {
  date: string;
  masuk: number;
  pulang: number;
  pindah: number;
  kamar: number;
  /** Patients on the last list saved that day, if any. */
  census: number | null;
}

/** The `days` days up to `date`, oldest first. */
export function weekCounts(date: string, moves: readonly Movement[], editions: readonly Edition[], days = 7): DayCount[] {
  return Array.from({ length: days }, (_, i) => addDays(date, i - days + 1)).map((day) => {
    const on = (kind: MoveKind): number => moves.filter((m) => m.kind === kind && m.at.slice(0, 10) === day).length;
    // Editions come newest first: the first of the day is the day's last list.
    const last = editions.find((e) => e.date === day);
    return { date: day, masuk: on('masuk'), pulang: on('pulang'), pindah: on('pindah'), kamar: on('kamar'), census: last ? last.patients.length : null };
  });
}

/** Days on the list, from when the patient was added (not the hospital admission). */
export function daysOnList(patient: RosterPatient, date: string): number | null {
  if (!patient.addedAt) return null;
  const from = local(patient.addedAt).slice(0, 10);
  if (!from) return null;
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * The day's summary as a WhatsApp message (2026-10-14, Avi: "copy this list
 * into a WhatsApp message — add DPJP and remove the time"). Same sections and
 * order as the panel; each patient as "420/4 KS/Tn. Kahar", the ward lists'
 * own shape, with what happened after a dash ("ke CVCU", "baru",
 * "dikembalikan ke list", "417/1 → 420/2"). No clock times: the group reads
 * the day, not the minute. Empty sections keep their heading with "-", so
 * "0" is stated, not missing.
 */
export function daySummaryText(day: DaySummary, ward: string): string {
  const code = (p: FloorPatient): string => {
    const own = p.dpjpId ? (dpjpById(p.dpjpId)?.initials ?? '') : (p.dpjpCode ?? '');
    return own || (p.kjsDpjpIds[0] ? (dpjpById(p.kjsDpjpIds[0])?.initials ?? '') : '');
  };
  const line = (p: FloorPatient, note = ''): string => {
    const place = p.room ? `${p.room}${p.bed ? `/${p.bed}` : ''} ` : '';
    const who = [code(p), p.name].filter(Boolean).join('/');
    return `${place}${who}${note ? ` - ${note}` : ''}`;
  };
  const block = (title: string, lines: readonly string[]): string[] => [`*${title} (${lines.length})*`, ...(lines.length > 0 ? lines : ['-'])];
  const [y, m, d] = day.date.split('-');
  return [
    `*Ringkasan ${ward} — ${d}/${m}/${y}*`,
    '',
    ...block('Rencana pulang hari ini (masih di lantai)', day.pulangHariIni.map((p) => line(p))),
    ...block('Rencana H-1 (pulang besok)', day.rencanaH1.map((p) => line(p))),
    '',
    ...block('Sudah pulang', day.pulang.map((p) => line(p.report))),
    ...block('Pindah ruangan', day.pindah.map((p) => line(p.report, `ke ${p.pindahKe || '…'}`))),
    ...block('Pindah kamar (di lantai ini)', day.kamar.map((mv) => line(mv.patient, mv.what.replace(/^Pindah kamar\s*/i, '')))),
    '',
    ...block('Masuk list', day.masuk.map((mv) => line(mv.patient, mv.what === 'Masuk list' ? 'baru' : mv.what.toLowerCase()))),
  ].join('\n');
}

/**
 * Changes grouped by day, newest day first, each day newest first (2026-10-16,
 * Avi: the history "should be lined by days for ease of categorizing").
 */
export function movesByDay(moves: readonly Movement[]): Array<{ date: string; moves: Movement[] }> {
  const days = new Map<string, Movement[]>();
  for (const move of [...moves].sort((a, b) => (a.at < b.at ? 1 : -1))) {
    const day = move.at.slice(0, 10);
    days.set(day, [...(days.get(day) ?? []), move]);
  }
  return [...days.entries()].sort(([a], [b]) => (a < b ? 1 : -1)).map(([date, list]) => ({ date, moves: list }));
}
