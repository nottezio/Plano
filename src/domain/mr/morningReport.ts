/**
 * Morning Report (MR) confirmator — the three messages the PJ MR sends.
 *
 *   1. To a senior, the evening before: "may I have the list of Jaga X".
 *   2. To Grup Prodi, in the morning: every covered jaga with its patients,
 *      the scheduled pengampu with their attendance, and the Zoom block.
 *   3. To Grup PAKAR: the pengampu attendance alone.
 *
 * Pure text in, text out. Nothing here knows about storage or the page, so the
 * whole format is testable against the samples it was written from.
 *
 * WHAT IS NOT HERE: the Zoom meeting ID, passcode and host key. The repo is
 * public; those are per-account data typed once in the page's settings and
 * synced with the profile (see `data/repositories/morningReport.repo`).
 */

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** Long enough to read as a rule in WhatsApp on a phone, short enough not to wrap. */
export const MR_DIVIDER = '-'.repeat(30);

function parseIso(date: string): Date | null {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toIso(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}

export function addDays(date: string, days: number): string {
  const at = parseIso(date);
  if (!at) return date;
  at.setDate(at.getDate() + days);
  return toIso(at);
}

/** 0 = Minggu … 6 = Sabtu; -1 for an unreadable date. */
export function weekday(date: string): number {
  return parseIso(date)?.getDay() ?? -1;
}

export function dayName(date: string): string {
  return DAY_NAMES[weekday(date)] ?? '';
}

/** `2026-09-28` → `28 September 2026`. */
export function dateText(date: string): string {
  const at = parseIso(date);
  if (!at) return date;
  return `${at.getDate()} ${MONTH_NAMES[at.getMonth()]} ${at.getFullYear()}`;
}

/** `2026-09-28` → `Senin, 28 September 2026`. */
export function longDateText(date: string): string {
  return `${dayName(date)}, ${dateText(date)}`;
}

/**
 * The MR this page most likely prepares: tomorrow's, because the request to
 * the senior goes out the evening before. A Saturday or Sunday has no MR, so
 * from Friday evening onwards it is Monday's.
 */
export function defaultMrDate(today: string): string {
  let next = addDays(today, 1);
  while (weekday(next) === 0 || weekday(next) === 6) next = addDays(next, 1);
  return next;
}

// ---------------------------------------------------------------------------
// Covered shifts
// ---------------------------------------------------------------------------

/**
 * `full` is a weekday jaga (afternoon to morning, one team). On Saturday and
 * Sunday the day is split into a pagi and a malam team, each reported as its
 * own block.
 */
export type ShiftPart = 'full' | 'pagi' | 'malam';

export interface MrShift {
  date: string;
  part: ShiftPart;
}

export function shiftKey(shift: MrShift): string {
  return `${shift.date}:${shift.part}`;
}

export function parseShiftKey(key: string): MrShift | null {
  const [date, part] = key.split(':');
  if (!date || !parseIso(date)) return null;
  if (part !== 'full' && part !== 'pagi' && part !== 'malam') return null;
  return { date, part };
}

/** `Jaga Sabtu Malam, 26 September 2026`. */
export function shiftLabel(shift: MrShift): string {
  const part = shift.part === 'pagi' ? ' Pagi' : shift.part === 'malam' ? ' Malam' : '';
  return `Jaga ${dayName(shift.date)}${part}, ${dateText(shift.date)}`;
}

/**
 * Where the covered range starts by default.
 *
 * Monday's MR covers everything since Friday's (Jumat, Sabtu Pagi/Malam,
 * Minggu Pagi/Malam). Any other day covers the previous day only. A holiday
 * stretches this; the page lets the start be moved earlier by hand rather
 * than guessing a holiday calendar here.
 */
export function defaultCoverStart(mrDate: string): string {
  return weekday(mrDate) === 1 ? addDays(mrDate, -3) : addDays(mrDate, -1);
}

/** Saturdays and Sundays are split; other days are one jaga. */
export function isSplitDay(date: string): boolean {
  const day = weekday(date);
  return day === 0 || day === 6;
}

/**
 * Every jaga from `start` up to the day before the MR, oldest first.
 *
 * A start on or after the MR date is treated as the default: an empty report
 * is never what anyone meant. Capped at 14 days so a mistyped year cannot
 * produce a thousand blocks.
 */
export function coveredShifts(mrDate: string, start?: string | null): MrShift[] {
  const last = addDays(mrDate, -1);
  let from = start && parseIso(start) && start <= last ? start : defaultCoverStart(mrDate);
  if (addDays(from, 14) <= last) from = addDays(last, -13);
  const out: MrShift[] = [];
  for (let date = from; date <= last; date = addDays(date, 1)) {
    if (isSplitDay(date)) {
      out.push({ date, part: 'pagi' }, { date, part: 'malam' });
    } else {
      out.push({ date, part: 'full' });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

export interface MrPatient {
  /** Identity line without its number: `Tn. X / dd-mm-yyyy / … / DPJP : …`. */
  header: string;
  diagnoses: string[];
}

export interface ParsedPatients {
  patients: MrPatient[];
  /** Non-empty lines before the first patient. Shown, never silently dropped. */
  unplaced: string[];
}

/** WhatsApp emphasis around a whole line: `*…*`, `_…_`, `*_…_*`. */
function stripEmphasis(line: string): string {
  let out = line.trim();
  for (;;) {
    const next = out.replace(/^([*_~])(.*)\1$/s, '$2').trim();
    if (next === out) return out;
    out = next;
  }
}

const NUMBERED_RE = /^(\d{1,2})\s*[.)]\s*(.+)$/;
const DIAGNOSIS_RE = /^diagnos[ai]s?\s*[:：]?\s*(.*)$/i;
const BULLET_RE = /^(?:[-•·▪◦]|\*(?=\s))\s*(.*)$/;

/**
 * Does a numbered line read as a patient's identity rather than a numbered
 * diagnosis? Seniors number diagnoses too ("1. ADHF"), so a number alone
 * cannot start a new patient once a diagnosis list is open.
 */
export function looksLikePatientHeader(text: string): boolean {
  if (/^(?:tn|ny|nn|an|by|sdr|sdri|nona|tuan|nyonya)\b\.?\s/i.test(text)) return true;
  if (/\bRM\b\s*:?\s*\d/i.test(text)) return true;
  return (text.match(/\s\/\s?|\s?\/\s/g) ?? []).length >= 2;
}

/**
 * Reads the list a senior sends into patients and diagnoses.
 *
 * Tolerant by design: bold or not, `-` or `•`, "Diagnosis:" or "Diagnosa",
 * with or without a blank line between patients. Nothing is discarded — a
 * line that fits nowhere before the first patient is returned in `unplaced`,
 * and one after it lands in that patient's diagnoses, where it will be seen.
 */
export function parsePatients(text: string): ParsedPatients {
  const patients: MrPatient[] = [];
  const unplaced: string[] = [];
  let current: MrPatient | null = null;
  let inDiagnosis = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = stripEmphasis(raw);
    if (!line) continue;

    const numbered = NUMBERED_RE.exec(line);
    if (numbered) {
      const rest = stripEmphasis(numbered[2] ?? '');
      if (!current || !inDiagnosis || looksLikePatientHeader(rest)) {
        current = { header: rest, diagnoses: [] };
        patients.push(current);
        inDiagnosis = false;
        continue;
      }
      current.diagnoses.push(rest);
      continue;
    }

    const diagnosis = DIAGNOSIS_RE.exec(line);
    if (diagnosis && current) {
      inDiagnosis = true;
      const inline = stripEmphasis(diagnosis[1] ?? '');
      if (inline) current.diagnoses.push(inline);
      continue;
    }

    if (!current) {
      // An unnumbered first patient is still a patient if it reads like one.
      if (looksLikePatientHeader(line)) {
        current = { header: line, diagnoses: [] };
        patients.push(current);
        continue;
      }
      unplaced.push(line);
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    const item = stripEmphasis(bullet ? (bullet[1] ?? '') : line);
    if (!item) continue;
    if (!inDiagnosis && !bullet && looksLikePatientHeader(line)) {
      current = { header: line, diagnoses: [] };
      patients.push(current);
      continue;
    }
    // A bullet or loose line after the header is a diagnosis even without
    // the "Diagnosis:" label; the label is added back on output.
    inDiagnosis = true;
    current.diagnoses.push(item);
  }

  return { patients, unplaced };
}

/** One patient as it appears in the Prodi message. `index` is 1-based. */
export function formatPatient(patient: MrPatient, index: number): string {
  const lines = [`*${index}. ${patient.header}*`];
  if (patient.diagnoses.length > 0) {
    lines.push('*Diagnosis:*', ...patient.diagnoses.map((item) => `- ${item}`));
  }
  return lines.join('\n');
}

export const NO_PATIENTS = '(Tidak ada pasien)';

/** One jaga's block: bold label, then its patients or `(Tidak ada pasien)`. */
export function formatShiftBlock(shift: MrShift, text: string): string {
  const { patients, unplaced } = parsePatients(text);
  const body =
    patients.length > 0
      ? [...unplaced, ...patients.map((patient, i) => formatPatient(patient, i + 1))].join('\n\n')
      : unplaced.length > 0
        ? unplaced.join('\n')
        : NO_PATIENTS;
  return `*${shiftLabel(shift)}*\n${body}`;
}

// ---------------------------------------------------------------------------
// Pengampu and messages
// ---------------------------------------------------------------------------

export interface Pengampu {
  name: string;
  status: string;
}

export const DEFAULT_STATUS = 'menunggu konfirmasi kehadiran';

export const DEFAULT_STATUSES = [
  DEFAULT_STATUS,
  'konfirmasi kehadiran pukul 07.00 WITA',
  'konfirmasi kehadiran pukul 07.30 WITA',
  'konfirmasi berhalangan hadir',
];

/**
 * The scheduled pengampu per weekday (1 = Senin … 5 = Jumat), as Avi gave
 * them. Only a starting point: each account keeps its own copy once edited,
 * and a given date's list can differ from its weekday's.
 */
export const DEFAULT_PENGAMPU: Record<number, string[]> = {
  1: ['Alkatiri', 'Idar Mappangara', 'Almudai', 'Bogie Putra Palinggi'],
  2: ['Az Hafid Nashar', 'Andi Alief Utama Armyn', 'Peter Kabo', 'Andi Renata Bastario'],
  3: [
    'Pendrik Tandean',
    'Yulius Patimang',
    'Fadillah Maricar',
    'Frizt Alfred Tandean',
    'Aussie Fitriani Ghaznawie',
  ],
  4: [
    'Muzakkir Amir',
    'Khalid Saleh',
    'Peter Kabo',
    'Amelia Arindanie',
    'Muhammad Asrul Apris',
    'Sumarni',
  ],
  5: ['Akhtar Fajar Muzakkir', 'Zaenab Djafar', 'Irmarisyani Sudirman', 'Sitti Multazam'],
};

export function pengampuLines(list: readonly Pengampu[]): string[] {
  return list
    .filter((entry) => entry.name.trim())
    .map((entry) => {
      const status = entry.status.trim();
      return status ? `- ${entry.name.trim()} (${status})` : `- ${entry.name.trim()}`;
    });
}

/** To the senior, the evening before. */
export function buildRequestMessage(input: {
  sender: string;
  mrDate: string;
  shift: MrShift;
}): string {
  const sender = input.sender.trim() || '…';
  const shift = shiftLabel(input.shift).replace(/^Jaga /, '');
  return [
    `Assalamualaikum wr. wb. dokter, mohon maaf mengganggu dok, tabe dokter saya ${sender} Dokter PJ MR hari ${dayName(input.mrDate)} tgl ${dateText(input.mrDate)} dok, mohon izin apakah boleh meminta list Jaga ${shift} yang akan di MR kan dok?`,
    'Tabe mohon arahannya dokter',
  ].join('\n');
}

/** To Grup Prodi, the morning of. */
export function buildProdiMessage(input: {
  mrDate: string;
  shifts: readonly MrShift[];
  patients: Readonly<Record<string, string>>;
  pengampu: readonly Pengampu[];
  zoom: string;
}): string {
  const blocks = input.shifts.map((shift) =>
    formatShiftBlock(shift, input.patients[shiftKey(shift)] ?? ''),
  );
  const parts = [
    `Assalamualaikum dokter, tabe dokter mohon izin melaporkan pasien *Morning Report* pada hari *${longDateText(input.mrDate)}* :`,
    blocks.join(`\n\n${MR_DIVIDER}\n\n`),
    MR_DIVIDER,
    ['Pimpinan Morning Report terjadwal :', ...pengampuLines(input.pengampu)].join('\n'),
  ];
  const zoom = input.zoom.trim();
  if (zoom) parts.push(zoom);
  parts.push('Tabe terima kasih dokter.');
  return parts.join('\n\n');
}

/** To Grup PAKAR: attendance only. */
export function buildPakarMessage(input: { mrDate: string; pengampu: readonly Pengampu[] }): string {
  return [
    'Assalamualaikum Dokter',
    `Mohon izin melaporkan konfirmasi kehadiran Pengampu MR, ${longDateText(input.mrDate)}:`,
    '',
    'Pimpinan Morning Report terjadwal:',
    ...pengampuLines(input.pengampu),
    '',
    'Tabe terima kasih dokter',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Stored shape (profile fields `morningReport` and `mrDays`)
// ---------------------------------------------------------------------------

/** Per-account settings. Every field optional: an unset one uses the default. */
export interface MrConfig {
  sender?: string;
  /** Pasted once from the Zoom invite. Never in the repo. */
  zoom?: string;
  statuses?: string[];
  /** Weekday (`'1'` … `'5'`) → names. */
  pengampu?: Record<string, string[]>;
}

/** One MR date's working state. */
export interface MrDay {
  /** First covered date, when moved from the default. */
  start?: string;
  /** The shift the request to the senior asks about (`shiftKey`). */
  target?: string;
  /** `shiftKey` → the list as pasted. */
  patients?: Record<string, string>;
  /** This date's pengampu with their attendance. Absent until first edited. */
  pengampu?: Pengampu[];
}

const isString = (value: unknown): value is string => typeof value === 'string';

/** Defensive read: the profile is typed data only by convention. */
export function readMrConfig(raw: unknown): Required<MrConfig> {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const pengampu: Record<string, string[]> = {};
  for (const day of ['1', '2', '3', '4', '5']) {
    const stored = (source.pengampu as Record<string, unknown> | undefined)?.[day];
    pengampu[day] = Array.isArray(stored)
      ? stored.filter(isString)
      : [...(DEFAULT_PENGAMPU[Number(day)] ?? [])];
  }
  const statuses = Array.isArray(source.statuses) ? source.statuses.filter(isString) : [];
  return {
    sender: isString(source.sender) ? source.sender : '',
    zoom: isString(source.zoom) ? source.zoom : '',
    statuses: statuses.length > 0 ? statuses : [...DEFAULT_STATUSES],
    pengampu,
  };
}

export function readMrDay(raw: unknown): MrDay {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const day: MrDay = {};
  if (isString(source.start)) day.start = source.start;
  if (isString(source.target)) day.target = source.target;
  if (source.patients && typeof source.patients === 'object') {
    day.patients = Object.fromEntries(
      Object.entries(source.patients as Record<string, unknown>).filter(
        (entry): entry is [string, string] => isString(entry[1]),
      ),
    );
  }
  if (Array.isArray(source.pengampu)) {
    day.pengampu = source.pengampu
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
      .map((entry) => ({
        name: isString(entry.name) ? entry.name : '',
        status: isString(entry.status) ? entry.status : '',
      }));
  }
  return day;
}

/**
 * The date's pengampu: its own list once edited, otherwise its weekday's
 * scheduled names, all awaiting confirmation.
 */
export function pengampuFor(mrDate: string, day: MrDay, config: Required<MrConfig>): Pengampu[] {
  if (day.pengampu) return day.pengampu;
  return (config.pengampu[String(weekday(mrDate))] ?? []).map((name) => ({
    name,
    status: DEFAULT_STATUS,
  }));
}

/** Drafts older than this are removed so the profile document cannot grow without end. */
export const MR_KEEP_DAYS = 21;

export function staleMrDays(days: Readonly<Record<string, unknown>>, today: string): string[] {
  const cutoff = addDays(today, -MR_KEEP_DAYS);
  return Object.keys(days).filter((date) => date < cutoff);
}
