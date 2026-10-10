import { daysBetween } from '@/domain/clinicalDate';
import { PLACE_LABEL, PLACE_ORDER, aiPatientKey, type AiPatient, type CensusEntry, type Place } from './maker';

/**
 * How one DPJP's census changes from day to day (2026-10-10).
 *
 * Avi: "one resident holds one DPJP's census for a certain time, so the list
 * evolves; there needs to be a way to see the evolution each day". Each day's
 * census was built from that morning's lists and then forgotten: who came in
 * yesterday, who left, who moved from CVCU to the ward, whose diagnosis list
 * grew — all of it was in the resident's head or in WhatsApp scroll-back.
 *
 * A SNAPSHOT is the census as it was sent for one DPJP on one date: the
 * patients (RM key, name, place, location, diagnoses, KJS) and which places
 * the pasted lists covered. It is taken when the census is copied or saved,
 * not while lists are still being pasted: a half-pasted morning would record
 * the patients of the missing list as gone.
 *
 * Snapshots are compared to the PREVIOUS snapshot, whatever its date (a
 * weekend nobody sent is not "everyone left"). A patient missing from a place
 * the day's lists did not cover is "not checked", never "gone".
 */

export interface SnapPatient {
  /** `rm:1234567` (digits, no leading zeros), else the line key. */
  key: string;
  name: string;
  place: Place;
  /** "CVCU Bed 5", "420 Bed 4", "Lontara 1 Kamar 8"; '' when the line has none. */
  location: string;
  identity: string;
  diagnoses: string[];
  kjs: string;
}

export interface CensusSnapshot {
  code: string;
  date: string;
  patients: SnapPatient[];
  /** Places the day's pasted lists reported on. */
  covers: Place[];
  /** ms; device clock. */
  savedAt: number;
  /** 'aturan' | 'ai' — which reader built it. */
  source: string;
}

const NAME_RE = /^(?:tn|ny|nn|an|by|sdr|nona|bayi)\b\.?/i;
/** A segment that is only the DPJP code: "ARB", "dr. ARB", "ZD (KJS)", "dr.ZD-dr.AAU". */
function isCodeSegment(segment: string, code: string): boolean {
  const flat = segment.replace(/\((?:kjs|utama)\)/gi, '').replace(/\b(?:dr|prof|dokter)\.?/gi, ' ').replace(/[^A-Za-z]+/g, ' ').trim();
  return flat !== '' && flat.split(' ').every((word) => word.toUpperCase() === code.toUpperCase() || /^[A-Z]{2,4}$/.test(word) && segment.includes('-'));
}

function segmentsOf(line: string): string[] {
  return line
    .replace(/[*_]/g, '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

/** The patient's name segment: "Tn. Kahar", "Ny. Contoh"; else the longest non-numeric segment. */
export function patientName(identity: string): string {
  const segments = segmentsOf(identity);
  const named = segments.find((segment) => NAME_RE.test(segment.replace(/^\(\w+\)\s*/, '')));
  if (named) return named.replace(/\s+/g, ' ');
  const words = segments.filter((segment) => !/\d/.test(segment) && !/^\s*(?:(?:dr|prof)\.?\s*)*[A-Z]{2,4}\s*$/.test(segment) && !/^kjs\b/i.test(segment));
  return (words.sort((a, b) => b.length - a.length)[0] ?? identity).replace(/^\(\w+\)\s*/, '').slice(0, 60);
}

/**
 * Where on the ward: the segments before the name, minus the DPJP code and a
 * KJS label. "CVCU Bed 5/ Tn. Kahar/…" → "CVCU Bed 5"; "KJS Uro / ARB / 603
 * Lepa B Bed 3 / Tn. …" → "603 Lepa B Bed 3".
 */
export function patientLocation(identity: string, code: string): string {
  const segments = segmentsOf(identity);
  const nameAt = segments.findIndex((segment) => NAME_RE.test(segment.replace(/^\(\w+\)\s*/, '')));
  // No "Tn./Ny." (a "H. …" or "(BTKV) …" name): the location is what comes
  // before the first segment that is plainly not a place — a name without a
  // digit after the first place-like segment, a date, an RM, an age.
  const end =
    nameAt !== -1
      ? nameAt
      : (() => {
          const stop = segments.findIndex(
            (segment, index) =>
              index > 0 &&
              (/\b\d{1,2}[-/ ]\d{1,2}[-/ ]\d{2,4}\b|\brm\b|\d{6,}|\btahun\b|\bth\b/i.test(segment) ||
                (!/\d/.test(segment) && !isCodeSegment(segment, code) && /\d/.test(segments[index - 1] ?? ''))),
          );
          return stop === -1 ? 0 : stop;
        })();
  const before = segments.slice(0, end);
  const lead = new RegExp(String.raw`^${code.toUpperCase()}\s+(?=\S)`);
  return before
    .filter((segment) => !isCodeSegment(segment, code) && !/^kjs\b/i.test(segment))
    // RSWS writes "ARB Lontara 1 Kamar 4 Bed 2" with no slash after the code.
    .map((segment) => segment.replace(lead, '').trim())
    .filter(Boolean)
    .join(' / ');
}

function normDx(line: string): string {
  return line.replace(/^[-•*\s]+/, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function normLocation(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export type Change =
  | { kind: 'baru'; patient: SnapPatient }
  | { kind: 'keluar'; patient: SnapPatient }
  /** Missing today, but today's lists did not cover where they were. */
  | { kind: 'tidak-dicek'; patient: SnapPatient }
  | { kind: 'pindah'; patient: SnapPatient; from: string; to: string }
  | { kind: 'dx'; patient: SnapPatient; added: string[]; removed: string[] };

/** Short place names for the table, where the full label does not fit. */
export const PLACE_SHORT: Record<Place, string> = {
  RSWS: 'RSWS',
  RSUH: 'RSUH',
  IGD: 'IGD',
  CVCU: 'CVCU',
  LT4: 'Lt. 4',
  LT5: 'Lt. 5',
  LT6: 'Lt. 6',
  PJT: 'PJT',
};

export function whereText(patient: Pick<SnapPatient, 'place' | 'location'>): string {
  const label = PLACE_LABEL[patient.place];
  return patient.location ? `${label} ${patient.location}` : label;
}

/** What changed from one snapshot to the next. */
export function diffSnapshots(previous: CensusSnapshot | null, current: CensusSnapshot): Change[] {
  if (!previous) return [];
  const before = new Map(previous.patients.map((patient) => [patient.key, patient]));
  const now = new Map(current.patients.map((patient) => [patient.key, patient]));
  const covered = new Set(current.covers);
  const changes: Change[] = [];

  for (const patient of current.patients) {
    const was = before.get(patient.key);
    if (!was) {
      changes.push({ kind: 'baru', patient });
      continue;
    }
    if (was.place !== patient.place || normLocation(was.location) !== normLocation(patient.location)) {
      changes.push({ kind: 'pindah', patient, from: whereText(was), to: whereText(patient) });
    }
    const had = new Set(was.diagnoses.map(normDx));
    const has = new Set(patient.diagnoses.map(normDx));
    const added = patient.diagnoses.filter((line) => !had.has(normDx(line)));
    const removed = was.diagnoses.filter((line) => !has.has(normDx(line)));
    if (added.length > 0 || removed.length > 0) changes.push({ kind: 'dx', patient, added, removed });
  }
  for (const patient of previous.patients) {
    if (now.has(patient.key)) continue;
    changes.push({ kind: covered.has(patient.place) ? 'keluar' : 'tidak-dicek', patient });
  }
  const order: Record<Change['kind'], number> = { baru: 0, keluar: 1, 'tidak-dicek': 2, pindah: 3, dx: 4 };
  return changes.sort((a, b) => order[a.kind] - order[b.kind]);
}

export interface DayEvolution {
  date: string;
  count: number;
  changes: Change[];
  /** True for the earliest snapshot: nothing to compare with. */
  first: boolean;
}

/** Newest first, each day against the snapshot before it. */
export function evolution(snapshots: readonly CensusSnapshot[]): DayEvolution[] {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  return sorted
    .map((snapshot, index) => ({
      date: snapshot.date,
      count: snapshot.patients.length,
      changes: diffSnapshots(sorted[index - 1] ?? null, snapshot),
      first: index === 0,
    }))
    .reverse();
}

export interface GridRow {
  key: string;
  name: string;
  /** Per column date: the patient that day, null if absent, 'unchecked' if their place was not covered. */
  cells: Array<SnapPatient | null | 'unchecked'>;
  firstSeen: string;
  lastSeen: string;
  /** Calendar days from first to last seen, inclusive. */
  days: number;
  /** Present on the newest date. */
  current: boolean;
  /** Places in the order the patient went through them: "CVCU → PJT Lt. 4". */
  path: string;
}

/** Patients × dates, for the table view. Current patients first (by place), then those who left (latest first). */
export function evolutionGrid(snapshots: readonly CensusSnapshot[]): { dates: string[]; rows: GridRow[] } {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const dates = sorted.map((snapshot) => snapshot.date);
  const keys = new Map<string, string>();
  for (const snapshot of sorted) for (const patient of snapshot.patients) keys.set(patient.key, patient.name);

  const newest = sorted[sorted.length - 1];
  const rows: GridRow[] = [...keys.entries()].map(([key, name]) => {
    let lastPlace: Place | null = null;
    const cells = sorted.map((snapshot) => {
      const patient = snapshot.patients.find((candidate) => candidate.key === key) ?? null;
      if (patient) {
        lastPlace = patient.place;
        return patient;
      }
      return lastPlace && !snapshot.covers.includes(lastPlace) ? ('unchecked' as const) : null;
    });
    const seen = sorted.filter((_, index) => cells[index] && cells[index] !== 'unchecked').map((snapshot) => snapshot.date);
    const firstSeen = seen[0] ?? '';
    const lastSeen = seen[seen.length - 1] ?? '';
    const places: string[] = [];
    for (const cell of cells) {
      if (!cell || cell === 'unchecked') continue;
      const label = PLACE_SHORT[cell.place];
      if (places[places.length - 1] !== label) places.push(label);
    }
    const latestName = [...cells].reverse().find((cell): cell is SnapPatient => Boolean(cell) && cell !== 'unchecked')?.name ?? name;
    return {
      key,
      name: latestName,
      cells,
      firstSeen,
      lastSeen,
      days: firstSeen && lastSeen ? daysBetween(firstSeen, lastSeen) + 1 : 0,
      current: Boolean(newest && newest.patients.some((patient) => patient.key === key)),
      path: places.join(' → '),
    };
  });

  const placeRank = (row: GridRow): number => {
    const last = [...row.cells].reverse().find((cell): cell is SnapPatient => Boolean(cell) && cell !== 'unchecked');
    return last ? PLACE_ORDER.indexOf(last.place) : 99;
  };
  rows.sort((a, b) =>
    a.current !== b.current
      ? a.current
        ? -1
        : 1
      : a.current
        ? placeRank(a) - placeRank(b) || a.firstSeen.localeCompare(b.firstSeen)
        : b.lastSeen.localeCompare(a.lastSeen),
  );
  return { dates, rows };
}

/** A census line (rules) as a snapshot patient. */
export function snapFromEntry(entry: CensusEntry, code: string): SnapPatient {
  return {
    key: entry.key,
    name: patientName(entry.asWritten),
    place: entry.place,
    location: patientLocation(entry.asWritten, code) || (entry.location ?? ''),
    identity: entry.asWritten,
    diagnoses: entry.diagnoses,
    kjs: entry.kjs ?? '',
  };
}

/** An AI patient as a snapshot patient. Same key as the rules use (RM), so the two compare. */
export function snapFromAi(patient: AiPatient, code: string): SnapPatient {
  return {
    key: aiPatientKey(patient),
    name: patientName(patient.identity),
    place: patient.place,
    location: patientLocation(patient.identity, code),
    identity: patient.identity,
    diagnoses: patient.diagnoses,
    kjs: patient.kjs,
  };
}

/** Firestore-safe id for a DPJP's day. */
export function snapshotId(code: string, date: string): string {
  return `${code.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'X'}~${date}`;
}

/** Defensive read of a stored snapshot. */
export function readSnapshot(data: unknown): CensusSnapshot | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;
  if (typeof raw.code !== 'string' || typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null;
  const str = (value: unknown): string => (typeof value === 'string' ? value : '');
  const patients = Array.isArray(raw.patients)
    ? raw.patients
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .map((item) => ({
          key: str(item.key),
          name: str(item.name),
          place: PLACE_ORDER.find((place) => place === item.place) ?? 'PJT',
          location: str(item.location),
          identity: str(item.identity),
          diagnoses: Array.isArray(item.diagnoses) ? item.diagnoses.filter((d): d is string => typeof d === 'string') : [],
          kjs: str(item.kjs),
        }))
        .filter((patient) => patient.key)
    : [];
  const covers = Array.isArray(raw.covers)
    ? raw.covers.filter((place): place is Place => PLACE_ORDER.includes(place as Place))
    : [];
  return {
    code: raw.code,
    date: raw.date,
    patients,
    covers,
    savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : 0,
    source: str(raw.source),
  };
}
