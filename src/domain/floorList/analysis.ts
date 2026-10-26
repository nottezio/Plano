import { localStamp, usulDays, usulOpen, type Edition, type RosterPatient } from './floor';
import { dpjpById } from '@/domain/dpjp';
import type { FloorPatient } from './report';

/**
 * Analisis (13.12, Avi: "a data analyst that shows the movement and history
 * of the patients on the floor: pulang hari ini, rencana H-1, pindah
 * ruangan…"). Everything is read from what Plano already keeps — each roster
 * patient's log (who did what, when), status and dates, and the saved
 * editions — so nothing new is stored and nothing can drift.
 */

export type MoveKind = 'masuk' | 'pulang' | 'pindah' | 'kamar' | 'rencana' | 'usul' | 'lain';

export const MOVE_LABEL: Record<MoveKind, string> = {
  masuk: 'Masuk',
  pulang: 'Pulang',
  pindah: 'Pindah ruangan',
  kamar: 'Pindah kamar',
  rencana: 'Rencana pulang',
  usul: 'Usul H-1',
  lain: 'Lainnya',
};

/**
 * The Analisis sections whose names the list's editors may change (26 Oct 2026,
 * Avi: "rename 'Pindah ruangan' / 'Rencana H-1 (pulang besok)' and the others").
 * The key is stable; the title is what the floor calls it, in the panel's
 * blocks and tiles and in the WhatsApp summary.
 */
export type SectionKey = 'census' | 'pulangHariIni' | 'rencanaH1' | 'usulH1' | 'pulang' | 'pindah' | 'kamar' | 'masuk';

export const SECTION_KEYS: readonly SectionKey[] = ['census', 'pulangHariIni', 'rencanaH1', 'usulH1', 'pulang', 'pindah', 'kamar', 'masuk'];

/** The names as they were before they could be changed (the blocks' titles). */
export const SECTION_TITLE: Record<SectionKey, string> = {
  census: 'Di lantai',
  pulangHariIni: 'Rencana pulang hari ini (masih di lantai)',
  rencanaH1: 'Rencana H-1 (pulang besok)',
  usulH1: 'Usul H-1 (menunggu konfirmasi DPJP)',
  pulang: 'Sudah pulang',
  pindah: 'Pindah ruangan',
  kamar: 'Pindah kamar (di lantai ini)',
  masuk: 'Masuk list',
};

/** The shorter names on the count tiles, used until a section is renamed. */
export const TILE_TITLE: Record<SectionKey, string> = {
  census: 'Di lantai',
  pulangHariIni: 'Rencana pulang hari ini',
  rencanaH1: 'Rencana H-1',
  usulH1: 'Usul H-1',
  pulang: 'Pulang',
  pindah: 'Pindah ruangan',
  kamar: 'Pindah kamar',
  masuk: 'Masuk',
};

export type SectionTitles = Partial<Record<SectionKey, string>>;

export const SECTION_TITLE_MAX = 60;

/** A stored map as clean titles: known keys, trimmed text, nothing blank or equal to the default. */
export function readSectionTitles(raw: unknown): SectionTitles {
  if (!raw || typeof raw !== 'object') return {};
  const out: SectionTitles = {};
  for (const key of SECTION_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    const text = typeof value === 'string' ? value.trim().slice(0, SECTION_TITLE_MAX) : '';
    if (text && text !== SECTION_TITLE[key]) out[key] = text;
  }
  return out;
}

/** A section's name: the floor's own, else the block title. */
export const sectionTitle = (titles: SectionTitles, key: SectionKey): string => titles[key] || SECTION_TITLE[key];

/** The count tile's name: the floor's own, else the short one. */
export const tileTitle = (titles: SectionTitles, key: SectionKey): string => titles[key] || TILE_TITLE[key];

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
  // Before the plan check below: "Usul H-1 …" contains "H-1" but decides nothing (26 Oct 2026).
  if (/^Usul H-1/i.test(what)) return 'usul';
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
  /** Proposed H-1 the supervisor has not accepted: uncoloured, with the days it has waited. */
  usulH1: Array<{ patient: FloorPatient; days: number }>;
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
    usulH1: roster
      .filter((p) => usulOpen(p))
      .map((p) => ({ patient: active.find((a) => a.key === p.key) ?? p.report, days: Math.max(0, usulDays(p, date) ?? 0) }))
      .sort((a, b) => b.days - a.days),
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
export function daySummaryText(day: DaySummary, ward: string, titles: SectionTitles = {}): string {
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
  const name = (key: SectionKey): string => sectionTitle(titles, key);
  const [y, m, d] = day.date.split('-');
  return [
    `*Ringkasan ${ward} — ${d}/${m}/${y}*`,
    '',
    ...block(name('pulangHariIni'), day.pulangHariIni.map((p) => line(p))),
    ...block(name('rencanaH1'), day.rencanaH1.map((p) => line(p))),
    ...block(
      name('usulH1'),
      day.usulH1.map(({ patient, days }) => line(patient, days === 0 ? 'usul hari ini' : `usul sejak ${days} hari`)),
    ),
    '',
    ...block(name('pulang'), day.pulang.map((p) => line(p.report))),
    ...block(name('pindah'), day.pindah.map((p) => line(p.report, `ke ${p.pindahKe || '…'}`))),
    ...block(name('kamar'), day.kamar.map((mv) => line(mv.patient, mv.what.replace(/^Pindah kamar\s*/i, '')))),
    '',
    ...block(name('masuk'), day.masuk.map((mv) => line(mv.patient, mv.what === 'Masuk list' ? 'baru' : mv.what.toLowerCase()))),
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
