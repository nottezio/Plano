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
 *
 * `dinas` (2026-10-05) is a weekday's daytime service: its patients go to MR
 * too, requested from a different senior ("List Pasien MR Dinas …"), and are
 * reported before that day's jaga. The jaga keeps the key `full`, so lists
 * stored before Dinas existed stay where they were.
 */
export type ShiftPart = 'dinas' | 'full' | 'pagi' | 'malam';

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
  if (part !== 'dinas' && part !== 'full' && part !== 'pagi' && part !== 'malam') return null;
  return { date, part };
}

/** `Jaga Sabtu Malam, 26 September 2026`, `Dinas Senin, 5 Oktober 2026`. */
export function shiftLabel(shift: MrShift): string {
  if (shift.part === 'dinas') return `Dinas ${dayName(shift.date)}, ${dateText(shift.date)}`;
  const part = shift.part === 'pagi' ? ' Pagi' : shift.part === 'malam' ? ' Malam' : '';
  return `Jaga ${dayName(shift.date)}${part}, ${dateText(shift.date)}`;
}

/** The column heading inside a date's row: `Dinas`, `Jaga`, `Pagi`, `Malam`. */
export function partLabel(part: ShiftPart): string {
  return part === 'dinas' ? 'Dinas' : part === 'full' ? 'Jaga' : part === 'pagi' ? 'Jaga Pagi' : 'Jaga Malam';
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
      // Daytime first: the order the day happened and the order it is reported.
      out.push({ date, part: 'dinas' }, { date, part: 'full' });
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
  'Konfirmasi kehadiran pukul 07:00 WITA',
  'Konfirmasi kehadiran pukul 07:30 WITA',
  'Konfirmasi berhalangan hadir',
];

/**
 * The scheduled pengampu per weekday (1 = Senin … 5 = Jumat), with titles
 * exactly as they appear in Avi's sent PAKAR confirmations. Only a starting
 * point: each account keeps its own copy once edited, and a given date's list
 * can differ from its weekday's.
 */
export const DEFAULT_PENGAMPU: Record<number, string[]> = {
  1: [
    'Dr. dr. Abdul Hakim Alkatiri, Sp.JP(K)',
    'Prof. Dr. dr. Idar Mappangara, Sp.PD, SpJP(K)',
    'dr. Almudai, Sp.PD, Sp.JP(K)',
    'dr. Bogie Putra Palinggi, Sp.JP',
  ],
  2: [
    'dr. Az Hafid Nashar, Sp.JP(K)',
    'dr. Andi Alief Utama Armyn, M.Kes, Sp.JP, Subsp. KPPJB (K)',
    'Prof. dr. Peter Kabo, Ph.D, Sp.FK, Sp.JP(K)',
    'dr. Andi Renata Bastario, Sp.JP(K)',
  ],
  3: [
    'dr. Pendrik Tandean, Sp.PD-KKV',
    'Dr. dr. Yulius Patimang, Sp.A, Sp.JP(K)',
    'dr. Fadillah Maricar, Sp.JP (K), FIHA',
    'dr. Frizt Alfred Tandean, Sp.JP (K)',
    'dr. Aussie Fitriani Ghaznawie, Sp.JP(K)',
  ],
  4: [
    'Prof. Dr. dr. Muzakkir Amir, Sp.JP(K)',
    'Dr. dr. Khalid Saleh, Sp.PD-KKV',
    'Prof. dr. Peter Kabo, Ph.D, Sp.FK, Sp.JP(K)',
    'dr. Amelia Arindanie, Sp.JP',
    'dr. Muhammad Asrul Apris, Sp.JP(K)',
    'Dr. dr. Sumarni, Sp.JP(K)',
  ],
  5: [
    'Dr. dr. Akhtar Fajar Muzakkir, Sp.JP(K)',
    'dr. Zaenab Djafar, M.Kes, Sp.PD, Sp.JP(K)',
    'dr. Irmarisyani Sudirman, Sp.JP(K)',
    'dr. Sitti Multazam Sp.JP, FIHA',
  ],
};

/**
 * What the first release seeded: surnames only, taken from a condensed
 * restatement of Avi's message instead of the message itself. A stored list
 * identical to one of these was never edited by hand (it could only have been
 * saved by touching the settings box), so it is read as "use the default"
 * and picks up the corrected names. Anything else stored is his and wins.
 */
const SUPERSEDED_PENGAMPU: Record<number, string[]> = {
  1: ['Alkatiri', 'Idar Mappangara', 'Almudai', 'Bogie Putra Palinggi'],
  2: ['Az Hafid Nashar', 'Andi Alief Utama Armyn', 'Peter Kabo', 'Andi Renata Bastario'],
  3: ['Pendrik Tandean', 'Yulius Patimang', 'Fadillah Maricar', 'Frizt Alfred Tandean', 'Aussie Fitriani Ghaznawie'],
  4: ['Muzakkir Amir', 'Khalid Saleh', 'Peter Kabo', 'Amelia Arindanie', 'Muhammad Asrul Apris', 'Sumarni'],
  5: ['Akhtar Fajar Muzakkir', 'Zaenab Djafar', 'Irmarisyani Sudirman', 'Sitti Multazam'],
};
const SUPERSEDED_STATUSES = [
  DEFAULT_STATUS,
  'konfirmasi kehadiran pukul 07.00 WITA',
  'konfirmasi kehadiran pukul 07.30 WITA',
  'konfirmasi berhalangan hadir',
];

/**
 * A surname seeded by the first release → the full name it stood for, so a
 * date whose list was saved in that window (with its statuses) is shown
 * correctly without losing the statuses. Exact matches only.
 */
function fullName(name: string): string {
  for (const [day, names] of Object.entries(SUPERSEDED_PENGAMPU)) {
    const at = names.indexOf(name);
    if (at >= 0) return DEFAULT_PENGAMPU[Number(day)]?.[at] ?? name;
  }
  return name;
}

const sameList = (a: readonly string[], b: readonly string[] | undefined): boolean =>
  !!b && a.length === b.length && a.every((item, i) => item === b[i]);

/** Invisible characters WhatsApp inserts around bullets (U+2060 and friends). */
const INVISIBLE_RE = /[\u200B-\u200D\u2060\uFEFF]/g;
const STATUS_START_RE = /\b(?:menunggu|konfirmasi|berhalangan|hadir)\b/i;

/**
 * One line of a sent confirmation → name and status.
 *
 * The status is found by its WORDS, not by "the last parentheses": names
 * carry parentheses of their own (`Sp.JP(K)`, `Sp.JP (K)`), a status is
 * sometimes glued on without a space (`Sp.JP(K)(menunggu …)`), and one
 * sample is missing its opening bracket (`Sp.JP(K)  konfirmasi … WITA)`).
 * No title contains "menunggu"/"konfirmasi", so the first of those words is
 * where the status begins.
 */
export function parsePengampuLine(raw: string): Pengampu | null {
  const line = raw.replace(INVISIBLE_RE, '').trim();
  const bullet = /^(?:[-•·▪◦]|\d{1,2}[.)])\s*(.*)$/.exec(line);
  if (!bullet) return null;
  const text = (bullet[1] ?? '').trim();
  if (!text) return null;
  const at = text.search(STATUS_START_RE);
  if (at < 0) return { name: text, status: '' };
  const name = text.slice(0, at).replace(/[\s(]+$/, '').trim();
  const status = text.slice(at).replace(/[\s)]+$/, '').trim();
  return name ? { name, status } : null;
}

const DAY_INDEX: Record<string, number> = {
  senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum'at": 5,
};

/**
 * A PAKAR confirmation as sent (one or several pasted together) → the
 * weekday each block is for and its pengampu. Lets the weekly schedule be
 * taken from Avi's own messages rather than typed out again.
 */
export function parsePengampuMessage(text: string): Array<{ weekday: number; pengampu: Pengampu[] }> {
  const out: Array<{ weekday: number; pengampu: Pengampu[] }> = [];
  let current: { weekday: number; pengampu: Pengampu[] } | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const clean = raw.replace(INVISIBLE_RE, '').replace(/[*_]/g, '');
    const header = /pengampu\s+mr\b[\s,:]*(senin|selasa|rabu|kamis|jum'?at)\b/i.exec(clean);
    if (header) {
      current = { weekday: DAY_INDEX[header[1]!.toLowerCase()] ?? 0, pengampu: [] };
      out.push(current);
      continue;
    }
    if (!current) continue;
    const entry = parsePengampuLine(clean);
    if (entry) current.pengampu.push(entry);
  }
  return out.filter((block) => block.weekday > 0 && block.pengampu.length > 0);
}

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
  // "list Jaga Senin, 5 Oktober 2026" or "list Dinas Senin, 5 Oktober 2026".
  return [
    `Assalamualaikum wr. wb. dokter, mohon maaf mengganggu dok, tabe dokter saya ${sender} Dokter PJ MR hari ${dayName(input.mrDate)} tgl ${dateText(input.mrDate)} dok, mohon izin apakah boleh meminta list ${shiftLabel(input.shift)} yang akan di MR kan dok?`,
    'Tabe mohon arahannya dokter',
  ].join('\n');
}

/** "Selamat malam": by the hour the message is written (WITA, the device's clock). */
export function greetingTime(hour: number): string {
  if (hour >= 4 && hour < 11) return 'pagi';
  if (hour >= 11 && hour < 15) return 'siang';
  if (hour >= 15 && hour < 18) return 'sore';
  return 'malam';
}

/** `2026-10-09` → `Jumat, 09 Oktober 2026` (day zero-padded, as in Avi's message). */
export function longDatePadded(date: string): string {
  const at = parseIso(date);
  if (!at) return date;
  return `${dayName(date)}, ${String(at.getDate()).padStart(2, '0')} ${MONTH_NAMES[at.getMonth()]} ${at.getFullYear()}`;
}

export type PengampuAddress = 'dokter' | 'prof';

/**
 * To one pengampu, before the MR: will you lead it, and at what time.
 *
 * Two forms because the address recurs through the whole message ("dokter"
 * five times); a Prof is addressed "Prof" throughout, including "Izin Prof"
 * where the dokter form has the colloquial "Izin dok".
 *
 * "besok" / "hari ini" only when true: a message written two days ahead
 * that said "besok" would name the wrong day.
 */
export function buildPengampuInviteMessage(input: {
  sender: string;
  senderRole: string;
  mrDate: string;
  today: string;
  hour: number;
  address: PengampuAddress;
}): string {
  const a = input.address === 'prof' ? 'Prof' : 'dokter';
  const short = input.address === 'prof' ? 'Prof' : 'dok';
  const who = [input.sender.trim() || '…', input.senderRole.trim()].filter(Boolean).join(' ');
  const when =
    input.mrDate === addDays(input.today, 1) ? 'besok, ' : input.mrDate === input.today ? 'hari ini, ' : 'pada ';
  return [
    `Assalamualaikum dan Selamat ${greetingTime(input.hour)} ${a}, tabe mohon maaf mengganggu ${a}.`,
    `Izin ${short}, saya dengan ${who}.`,
    '',
    `Mohon izin petunjuk kesediaan ${a} untuk berkenan memimpin Morning Report ${when}*${longDatePadded(input.mrDate)}* ${a}.`,
    '',
    `Sekiranya ${a} bisa hadir di jam berapa ${a}? Mohon arahannya, terima kasih ${a}.`,
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
  /** "PPDS Kardio Semester 1": how the sender introduces themself to a pengampu. */
  senderRole?: string;
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
    const list = Array.isArray(stored) ? stored.filter(isString) : null;
    pengampu[day] =
      list && !sameList(list, SUPERSEDED_PENGAMPU[Number(day)])
        ? list
        : [...(DEFAULT_PENGAMPU[Number(day)] ?? [])];
  }
  const statuses = Array.isArray(source.statuses) ? source.statuses.filter(isString) : [];
  return {
    sender: isString(source.sender) ? source.sender : '',
    senderRole: isString(source.senderRole) ? source.senderRole : '',
    zoom: isString(source.zoom) ? source.zoom : '',
    statuses:
      statuses.length > 0 && !sameList(statuses, SUPERSEDED_STATUSES)
        ? statuses
        : [...DEFAULT_STATUSES],
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
  if (day.pengampu) return day.pengampu.map((entry) => ({ ...entry, name: fullName(entry.name) }));
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

/**
 * The previous or next MR day: weekdays only, since there is no Morning
 * Report on Saturday or Sunday (2026-10-05, Helper revamp).
 */
export function stepMrDate(date: string, direction: 1 | -1): string {
  let next = addDays(date, direction);
  while (weekday(next) === 0 || weekday(next) === 6) next = addDays(next, direction);
  return next;
}

export interface MrReadinessItem {
  label: string;
  ok: boolean;
  detail: string;
}

/**
 * What is still missing before the messages can be sent, in the order the
 * page asks for it. Read-only: it describes the state, it never blocks a copy
 * (an empty jaga is a legitimate "(Tidak ada pasien)").
 */
export function mrReadiness(input: {
  sender: string;
  shifts: readonly MrShift[];
  patients: Readonly<Record<string, string>>;
  pengampu: readonly Pengampu[];
  zoom: string;
}): MrReadinessItem[] {
  const filled = input.shifts.filter((shift) => (input.patients[shiftKey(shift)] ?? '').trim()).length;
  const named = input.pengampu.filter((entry) => entry.name.trim());
  const confirmed = named.filter((entry) => entry.status.trim() && entry.status !== DEFAULT_STATUS).length;
  return [
    {
      label: 'Nama pengirim',
      ok: input.sender.trim().length > 0,
      detail: input.sender.trim() || 'belum diisi',
    },
    {
      label: 'List pasien',
      ok: input.shifts.length > 0 && filled === input.shifts.length,
      detail: `${filled}/${input.shifts.length} list terisi`,
    },
    {
      label: 'Konfirmasi pengampu',
      ok: named.length > 0 && confirmed === named.length,
      detail: named.length === 0 ? 'belum ada pengampu' : `${confirmed}/${named.length} sudah konfirmasi`,
    },
    {
      label: 'Blok Zoom',
      ok: input.zoom.trim().length > 0,
      detail: input.zoom.trim() ? 'ada' : 'isi di Pengaturan MR',
    },
  ];
}
