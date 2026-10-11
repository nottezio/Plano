import type { DenahExtraction, ListExtraction } from './verify';
import {
  DEFAULT_CONFIG,
  flatten,
  matchPatients,
  type Issue,
  type MatchedPatient,
  type Severity,
  type VerifierConfig,
  type ViewId,
} from './verifier';

/**
 * The verifier's findings, as a person reads them (2026-10-11).
 *
 * WHY THIS EXISTS
 *
 * The verifier (`verifier.ts`) is rule-shaped: one issue per rule that fired,
 * titled in the rule's own English ("Orphaned from holder-list"), grouped by
 * severity. Correct, and hard to act on: one patient missing from three places
 * was three cards in three sections, and "room grid" / "views" are the
 * program's words, not the ward's.
 *
 * Avi's Residency Helper reports read differently, and that is the model here:
 *   - one numbered item per PATIENT, saying in one line what is wrong
 *     ("hanya ada di denah kamar"), the line as written, where they are
 *     missing, and what it probably means;
 *   - the counts reconciled in one place, with the numbers side by side and
 *     the patients that likely explain them;
 *   - how many patients are clean, and a closing "what to ask whom".
 *
 * The RULES are untouched: this only regroups and words what `runChecks`
 * found. Every sentence is built from fields the verifier already has; the
 * "meaning" lines say "kemungkinan", because they are the usual explanation,
 * not a finding.
 */

export type PatientKind = 'hanya-denah' | 'kurang-di-bagian' | 'sisa' | 'hilang' | 'beda-data';

export interface PresenceCell {
  label: string;
  /** null: not expected there (e.g. no holder list for an unassigned category). */
  present: boolean | null;
}

export interface Mismatch {
  label: string;
  values: Array<{ where: string; value: string; odd: boolean }>;
}

export interface PatientFinding {
  key: string;
  name: string;
  place: string | null;
  dpjp: string | null;
  severity: Severity;
  kind: PatientKind;
  /** One line: what is wrong. */
  summary: string;
  /** The line as the document wrote it, to find it again. */
  source: { where: string; text: string } | null;
  presence: PresenceCell[];
  mismatches: Mismatch[];
  /** What it usually means; worded as a possibility. */
  meaning: string;
  status: Issue['status'];
  /** The verifier issues folded into this item (for answers and history). */
  issues: Issue[];
}

export interface CountRow {
  label: string;
  value: string;
  odd: boolean;
}

export interface CountFinding {
  title: string;
  rows: CountRow[];
  /** Per DPJP, only the ones that disagree. */
  perDpjp: Array<{ dpjp: string; cells: CountRow[] }>;
  notes: string[];
  /** Patients above that likely explain the difference. */
  relatedNames: string[];
  issues: Issue[];
}

export interface PlainFinding {
  severity: Severity;
  title: string;
  detail: string;
  issues: Issue[];
}

export interface ReadableReport {
  headline: string;
  dateLabel: string | null;
  patientCount: number;
  preflight: PlainFinding[];
  patients: PatientFinding[];
  counts: CountFinding | null;
  other: PlainFinding[];
  minor: PlainFinding[];
  clean: { count: number; names: string[]; newNames: string[] };
  advice: string[];
  /** How many things need a look: numbered patients + the count block + other. */
  total: number;
}

const VIEW: Record<ViewId, string> = {
  roomGrid: 'denah kamar',
  dpjpTable: 'tabel DPJP',
  holderList: 'holder list',
  listPasien: 'LIST PASIEN',
};
const VIEW_ORDER: ViewId[] = ['roomGrid', 'dpjpTable', 'holderList', 'listPasien'];
const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, confirm: 2, cosmetic: 3 };
const KIND_RANK: Record<PatientKind, number> = { 'hanya-denah': 0, sisa: 1, hilang: 2, 'kurang-di-bagian': 3, 'beda-data': 4 };
const WEEKDAY = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** "Sabtu, 29-08-2026" from an ISO date; the raw text when it is not one. */
export function shiftDateLabel(iso: string | null): string | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return `${WEEKDAY[day] ?? ''}, ${match[3]}-${match[2]}-${match[1]}`;
}

const joinNames = (names: readonly string[]): string =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} dan ${names[names.length - 1] ?? ''}`;

function place(m: MatchedPatient): string | null {
  for (const view of VIEW_ORDER) {
    const record = m.byView[view];
    if (record?.room) return record.bed != null ? `${record.room}/${String(record.bed)}` : record.room;
  }
  return null;
}

function worst(issues: readonly Issue[]): Severity {
  return issues.reduce<Severity>(
    (best, issue) => (SEVERITY_RANK[issue.severity] < SEVERITY_RANK[best] ? issue.severity : best),
    'cosmetic',
  );
}

function marked(values: Array<{ where: string; value: string }>): Mismatch['values'] {
  const counts = new Map<string, number>();
  for (const { value } of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const top = Math.max(...counts.values());
  const leaders = [...counts].filter(([, count]) => count === top);
  // No majority, no "odd one": there is no telling which side is wrong.
  const majority = leaders.length === 1 ? leaders[0]?.[0] : undefined;
  return values.map((entry) => ({ ...entry, odd: majority !== undefined && entry.value !== majority }));
}

const FIELD: Array<{ rule: string; label: string; read: (m: MatchedPatient, view: ViewId) => string | null }> = [
  { rule: 'F4', label: 'Kamar', read: (m, v) => { const r = m.byView[v]; return r?.room ? `${r.room}${r.bed != null ? `/${String(r.bed)}` : ''}` : null; } },
  { rule: 'F1', label: 'DPJP', read: (m, v) => m.byView[v]?.dpjp ?? null },
  { rule: 'F2', label: 'Residen', read: (m, v) => m.byView[v]?.resident ?? null },
  { rule: 'F3', label: 'Chief', read: (m, v) => m.byView[v]?.chief ?? null },
  { rule: 'F6', label: 'Nama', read: (m, v) => m.byView[v]?.nameRaw ?? null },
];

function patientFinding(m: MatchedPatient, issues: Issue[], cfg: VerifierConfig): PatientFinding {
  const rules = new Set(issues.map((issue) => issue.ruleId));
  const dpjp = m.byView.roomGrid?.dpjp ?? m.byView.dpjpTable?.dpjp ?? m.byView.listPasien?.dpjp ?? null;
  const unassigned = dpjp !== null && cfg.unassignedCategories.includes(dpjp);
  const holderExpected = !unassigned && Boolean(m.byView.roomGrid?.resident ?? m.byView.dpjpTable?.resident);

  const presence: PresenceCell[] = VIEW_ORDER.map((view) => ({
    label: VIEW[view],
    present: view === 'holderList' && !holderExpected && !m.byView.holderList ? null : Boolean(m.byView[view]),
  }));
  const missing = presence.filter((cell) => cell.present === false).map((cell) => cell.label);
  const presentElsewhere = VIEW_ORDER.filter((view) => view !== 'roomGrid' && m.byView[view]).map((view) => VIEW[view]);

  const mismatches: Mismatch[] = FIELD.filter((field) => rules.has(field.rule)).map((field) => ({
    label: field.label,
    values: marked(
      VIEW_ORDER.flatMap((view) => {
        const value = field.read(m, view);
        return value ? [{ where: VIEW[view], value }] : [];
      }),
    ),
  }));
  if (rules.has('F5') && m.byView.roomGrid) {
    mismatches.push({
      label: 'Kode DPJP ganda',
      values: [{ where: VIEW.roomGrid, value: m.byView.roomGrid.dpjpRaw, odd: true }],
    });
  }

  let kind: PatientKind;
  let summary: string;
  let meaning: string;
  if (rules.has('O5')) {
    kind = 'hilang';
    summary = 'tidak ada lagi di dokumen mana pun';
    meaning = 'Ada di pemeriksaan sebelumnya. Pastikan memang sudah pulang atau pindah.';
  } else if (!m.byView.roomGrid) {
    kind = 'sisa';
    summary = `sudah tidak ada di denah kamar, masih tertulis di ${joinNames(presentElsewhere)}`;
    meaning = m.byView.listPasien
      ? 'Kemungkinan sudah pulang/pindah, tetapi LIST PASIEN belum diperbarui (dan masih ikut terhitung).'
      : `Kemungkinan sudah pulang/pindah, tetapi belum dihapus dari ${joinNames(presentElsewhere)}.`;
  } else if (missing.length > 0 && presentElsewhere.length === 0) {
    kind = 'hanya-denah';
    summary = 'hanya ada di denah kamar, tidak ada di bagian lain';
    meaning =
      'Kemungkinan pasien baru yang belum dimasukkan ke bagian lain, atau salah tulis di denah kamar. Pastikan apakah memang pasien baru.';
  } else if (missing.length > 0) {
    kind = 'kurang-di-bagian';
    summary = `ada di denah kamar, tidak ada di ${joinNames(missing)}`;
    meaning = missing.includes('LIST PASIEN')
      ? 'Belum ada catatan diagnosis/plan untuk shift ini di LIST PASIEN.'
      : `Belum dimasukkan ke ${joinNames(missing)}.`;
  } else {
    kind = 'beda-data';
    summary = `data berbeda antar bagian: ${mismatches.map((item) => item.label.toLowerCase()).join(', ')}`;
    meaning = rules.has('F3')
      ? 'Samakan datanya. Chief yang berbeda sering sisa rotasi yang belum diganti.'
      : 'Samakan datanya di semua bagian.';
  }
  if (kind !== 'beda-data' && mismatches.length > 0) {
    summary += `; ${mismatches.map((item) => item.label.toLowerCase()).join(', ')} juga berbeda`;
  }

  const sourceView = VIEW_ORDER.find((view) => m.byView[view]);
  const source = sourceView ? { where: VIEW[sourceView], text: m.byView[sourceView]!.sourceLine } : null;
  const name = kind === 'hilang' ? (issues[0]?.title.replace(/^Patient vanished:?\s*/, '') || `RM ${issues[0]?.id.split(':')[1] ?? '?'}`) : m.displayName;
  return {
    key: m.key,
    name,
    place: place(m),
    dpjp,
    severity: worst(issues),
    kind,
    summary,
    source,
    presence: kind === 'hilang' ? [] : presence,
    mismatches,
    meaning,
    status: issues.some((issue) => issue.status === 'new') ? 'new' : 'persisting',
    issues,
  };
}

function countFinding(
  list: ListExtraction | null,
  matched: MatchedPatient[],
  issues: Issue[],
  related: PatientFinding[],
): CountFinding | null {
  const mine = issues.filter((issue) => ['C1', 'C2', 'C3', 'C3T'].includes(issue.ruleId));
  if (mine.length === 0 || !list) return null;
  const grid = matched.filter((m) => m.byView.roomGrid).length;
  const header = list.header.jumlahPasien;
  const perDpjpSum = list.header.perDpjp.reduce((sum, line) => sum + (line.count ?? 0), 0);
  const body = list.sections.reduce((sum, section) => sum + section.entries.length, 0);
  const totals = [
    { label: 'Denah kamar', value: String(grid) },
    ...(header != null ? [{ label: 'Header LIST (jumlah pasien)', value: String(header) }] : []),
    { label: 'Jumlah per DPJP di header LIST', value: String(perDpjpSum) },
    { label: 'Pasien tertulis di isi LIST', value: String(body) },
  ];
  const oddTotals = marked(totals.map((row) => ({ where: row.label, value: row.value })));

  const perDpjp = mine
    .filter((issue) => issue.ruleId === 'C3')
    .map((issue) => {
      const code = issue.id.split(':')[1] ?? '';
      const listMatch = /heading=(\S+), body=(\d+)/.exec(issue.comparison?.listPasien ?? '');
      const cells = [
        { where: 'header LIST', value: issue.comparison?.header ?? '' },
        ...(listMatch && listMatch[1] !== 'null' ? [{ where: 'judul bagian LIST', value: listMatch[1] ?? '' }] : []),
        { where: 'isi LIST', value: listMatch?.[2] ?? '' },
        { where: 'denah kamar', value: issue.comparison?.roomGrid ?? '' },
        { where: 'tabel DPJP', value: issue.comparison?.dpjpTable ?? '' },
      ].filter((cell) => cell.value !== '' && cell.value !== 'null');
      return { dpjp: code, cells: marked(cells).map((cell) => ({ label: cell.where, value: cell.value, odd: cell.odd })) };
    });

  const notes = mine
    .filter((issue) => issue.ruleId === 'C3T')
    .map((issue) => {
      const codes = issue.id.split(':')[1]?.split('+') ?? [];
      return `Jumlah ${joinNames(codes)} kemungkinan tertukar di header LIST: satu kelebihan, satu kekurangan, totalnya tetap cocok.`;
    });
  if (header != null && header !== perDpjpSum) {
    notes.push(`Header LIST tidak cocok dengan rinciannya sendiri (${String(header)} vs ${String(perDpjpSum)}).`);
  }

  const relatedNames = related
    .filter((finding) => finding.kind === 'sisa' || finding.kind === 'hanya-denah')
    .map((finding) => finding.name);
  return {
    title: 'Jumlah pasien tidak cocok',
    rows: oddTotals.map((row) => ({ label: row.where, value: row.value, odd: row.odd })),
    perDpjp,
    notes,
    relatedNames,
    issues: mine,
  };
}

/** The rules with no patient attached, in Indonesian, with their numbers. */
function plainFinding(issue: Issue, list: ListExtraction | null, matched: MatchedPatient[], cfg: VerifierConfig): PlainFinding {
  const c = issue.comparison ?? {};
  const scope = issue.id.split(':')[1] ?? '';
  const h = list?.header;
  const base = { severity: issue.severity, issues: [issue] };
  switch (issue.ruleId) {
    case 'P1':
      return { ...base, title: 'Satu dokumen belum dipilih', detail: `${/DENAH was not/.test(issue.detail) ? 'DENAH' : 'LIST PASIEN'} tidak ada, jadi hanya sebagian yang bisa diperiksa.` };
    case 'P2':
      return { ...base, title: 'Tanggal kedua dokumen berbeda', detail: `DENAH ${c.header ?? '?'}, LIST PASIEN ${c.footer ?? '?'}. Perbedaan di bawah belum pasti; pastikan keduanya dari shift yang sama.` };
    case 'C5':
      return { ...base, title: 'Jumlah KJS BTKV tidak cocok', detail: `Header LIST ${c.header ?? '?'}, yang ditandai KJS BTKV di denah kamar ${c.roomGrid ?? '?'}.` };
    case 'C7':
      return { ...base, title: 'Jumlah Pediatri tidak cocok', detail: `Header LIST ${c.header ?? '?'}, pasien DPJP pediatri (${cfg.pediatricDpjps.join('/')}) di denah kamar ${c.roomGrid ?? '?'}.` };
    case 'C6': {
      const expected = h && h.jumlahPasien != null && h.kjsBtkv != null && h.kjsTsLain != null && h.pediatri != null
        ? h.jumlahPasien - h.kjsBtkv - h.kjsTsLain - h.pediatri
        : null;
      return {
        ...base,
        title: 'Jumlah Kardio tidak cocok',
        detail: `Header LIST ${c.header ?? '?'}${expected != null && h ? `; seharusnya ${String(expected)} (jumlah ${String(h.jumlahPasien)} − KJS BTKV ${String(h.kjsBtkv)} − KJS TS lain ${String(h.kjsTsLain)} − Pediatri ${String(h.pediatri)})` : ''}.`,
      };
    }
    case 'C8': {
      const holder = matched.filter((m) => m.byView.holderList).length;
      const grid = matched.filter((m) => m.byView.roomGrid).length;
      const unassigned = matched.filter((m) => cfg.unassignedCategories.includes(m.byView.roomGrid?.dpjp ?? '')).length;
      return {
        ...base,
        title: 'Jumlah di holder list tidak cocok',
        detail: `Holder list berisi ${String(holder)} pasien; seharusnya ${String(grid - unassigned)} (denah kamar ${String(grid)} − pasien tanpa residen ${String(unassigned)}).`,
      };
    }
    case 'C9': {
      const counted = /raw=(\d+)/.exec(c.roomGrid ?? '')?.[1] ?? '?';
      return { ...base, title: `Hitungan chief ${scope} tidak cocok`, detail: `Footer DENAH menulis ${c.footer ?? '?'}, di denah kamar terhitung ${counted} (ejaan nama harus sama persis).` };
    }
    case 'C10a':
      return { ...base, title: 'Footer "Tidak di FU" tidak ada', detail: `Ada pasien ${cfg.unassignedCategories.join('/')} di denah kamar, tetapi DENAH tidak punya footer "Tidak di FU".` };
    case 'C10b':
      return { ...base, title: `"Tidak di FU" ${scope} tidak cocok`, detail: `Footer menulis ${c.footer ?? '?'}, di denah kamar ada ${c.roomGrid ?? '?'} pasien ${scope}.` };
    default:
      return { ...base, title: issue.title, detail: issue.detail };
  }
}

export function readableReport(input: {
  /** The OPEN issues (answered ones already removed). */
  issues: Issue[];
  denah: DenahExtraction | null;
  list: ListExtraction | null;
  shiftDate: string | null;
  cfg?: VerifierConfig;
  /** RMs on the ward at the last run on this device; absent on a first run. */
  previousRms?: ReadonlySet<string>;
}): ReadableReport {
  const cfg = input.cfg ?? DEFAULT_CONFIG;
  const matched = matchPatients(flatten(input.denah, input.list, cfg));
  const byKey = new Map(matched.map((m) => [m.key, m]));

  // Issues about one patient, folded per patient.
  const perPatient = new Map<string, Issue[]>();
  const loose: Issue[] = [];
  for (const issue of input.issues) {
    const key = issue.patients[0]?.key;
    if (issue.patients.length === 1 && key && byKey.has(key)) {
      perPatient.set(key, [...(perPatient.get(key) ?? []), issue]);
    } else if (issue.ruleId === 'O5') {
      perPatient.set(issue.id, [issue]);
    } else {
      loose.push(issue);
    }
  }

  const patients: PatientFinding[] = [];
  const minor: PlainFinding[] = [];
  for (const [key, issues] of perPatient) {
    const m = byKey.get(key) ?? { key, rm: null, displayName: '', byView: {}, presentIn: [] };
    const finding = patientFinding(m, issues, cfg);
    // Cosmetic only (a dual code, a spelling): listed, not numbered.
    if (finding.severity === 'cosmetic') {
      minor.push({
        severity: 'cosmetic',
        title: `${finding.name}${finding.place ? ` (${finding.place})` : ''}`,
        detail: finding.mismatches.map((item) => `${item.label}: ${item.values.map((v) => `${v.where} "${v.value}"`).join(' · ')}`).join('; '),
        issues,
      });
    } else patients.push(finding);
  }
  // Worst first; within a severity, the kinds that change the census itself
  // (a patient in one place only) before a value that differs.
  patients.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
      (a.place ?? '').localeCompare(b.place ?? '', 'id', { numeric: true }),
  );

  const preflight = loose.filter((issue) => issue.ruleId === 'P1' || issue.ruleId === 'P2').map((issue) => plainFinding(issue, input.list, matched, cfg));
  const counts = countFinding(input.list, matched, loose, patients);
  const other = loose
    .filter((issue) => !['P1', 'P2', 'C1', 'C2', 'C3', 'C3T'].includes(issue.ruleId))
    .map((issue) => plainFinding(issue, input.list, matched, cfg))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  // A holder-list total that is off because a patient above is missing from it.
  const notInHolder = patients.filter((p) => p.presence.some((cell) => cell.label === VIEW.holderList && cell.present === false));
  for (const item of other) {
    if (item.issues[0]?.ruleId === 'C8' && notInHolder.length > 0) {
      item.detail += ` Kemungkinan karena ${joinNames(notInHolder.map((p) => p.name))} di atas belum ada di holder list.`;
    }
  }

  const flagged = new Set(perPatient.keys());
  const cleanPatients = matched.filter((m) => m.byView.roomGrid && !flagged.has(m.key));
  const newNames = input.previousRms
    ? cleanPatients.filter((m) => m.rm && !input.previousRms!.has(m.rm)).map((m) => m.displayName)
    : [];

  const advice: string[] = [];
  const named = (kind: PatientKind): string[] => patients.filter((p) => p.kind === kind).map((p) => p.name);
  if (named('sisa').length > 0) {
    advice.push(`Tanyakan ke penyusun LIST: apakah ${joinNames(named('sisa'))} sudah pulang/pindah? Bila ya, hapus dari LIST dan sesuaikan jumlahnya.`);
  }
  if (named('hanya-denah').length > 0) {
    advice.push(`Pastikan ${joinNames(named('hanya-denah'))} memang pasien baru; bila ya, tambahkan ke tabel DPJP, holder list dan LIST PASIEN.`);
  }
  if (named('kurang-di-bagian').length > 0) {
    advice.push(`Lengkapi ${joinNames(named('kurang-di-bagian'))} di bagian yang belum ada.`);
  }
  if (named('beda-data').length > 0) {
    advice.push(`Samakan data ${joinNames(named('beda-data'))} di semua bagian.`);
  }
  if (named('hilang').length > 0) {
    advice.push(`Konfirmasi: ${joinNames(named('hilang'))} sudah pulang atau pindah?`);
  }
  if (counts && counts.relatedNames.length === 0) advice.push('Perbaiki angka jumlah di header LIST.');
  if (other.length > 0) advice.push(`Periksa juga: ${other.map((item) => item.title.toLowerCase()).join('; ')}.`);

  const total = patients.length + (counts ? 1 : 0) + other.length;
  const dateLabel = shiftDateLabel(input.shiftDate);
  const partial = !input.denah || !input.list;
  const headline =
    total === 0 && minor.length === 0
      ? partial
        ? 'Tidak ada masalah pada bagian yang bisa diperiksa'
        : 'Bersih: semua cocok'
      : total === 0
        ? 'Hanya perbedaan kecil'
        : `${String(total)} hal perlu dicek`;

  return {
    headline,
    dateLabel,
    patientCount: matched.filter((m) => m.byView.roomGrid).length,
    preflight,
    patients,
    counts,
    other,
    minor,
    clean: { count: cleanPatients.length, names: cleanPatients.map((m) => m.displayName), newNames },
    advice,
    total,
  };
}

/** The same report as text for WhatsApp: bold with `*`, no emoji. */
export function readableText(report: ReadableReport): string {
  const out: string[] = [];
  out.push(`*Verifikasi List${report.dateLabel ? ` — ${report.dateLabel}` : ''}*`);
  out.push(`${report.headline} · ${String(report.patientCount)} pasien di denah kamar`);
  for (const item of report.preflight) out.push('', `*${item.title}*`, item.detail);

  report.patients.forEach((p, index) => {
    out.push('', `*${String(index + 1)}. ${p.name}${p.place ? ` (${p.place})` : ''}${p.dpjp ? ` · ${p.dpjp}` : ''}*`);
    out.push(p.summary.charAt(0).toUpperCase() + p.summary.slice(1));
    const missing = p.presence.filter((cell) => cell.present === false).map((cell) => cell.label);
    if (missing.length > 0) out.push(`Tidak ada di: ${missing.join(', ')}`);
    for (const item of p.mismatches) {
      out.push(`${item.label}: ${item.values.map((v) => `${v.where} ${v.value}`).join(' · ')}`);
    }
    if (p.source) out.push(`Tertulis (${p.source.where}): ${p.source.text}`);
    out.push(`_${p.meaning}_`);
  });

  if (report.counts) {
    const c = report.counts;
    out.push('', `*${report.patients.length + 1}. ${c.title}*`);
    for (const row of c.rows) out.push(`- ${row.label}: ${row.value}`);
    for (const line of c.perDpjp) out.push(`- DPJP ${line.dpjp}: ${line.cells.map((cell) => `${cell.label} ${cell.value}`).join(', ')}`);
    for (const note of c.notes) out.push(note);
    if (c.relatedNames.length > 0) out.push(`_Kemungkinan terkait ${joinNames(c.relatedNames)} di atas._`);
  }
  const offset = report.patients.length + (report.counts ? 1 : 0);
  report.other.forEach((item, index) => out.push('', `*${String(offset + index + 1)}. ${item.title}*`, item.detail));

  if (report.minor.length > 0) {
    out.push('', '*Perbedaan kecil*');
    for (const item of report.minor) out.push(`- ${item.title}: ${item.detail}`);
  }
  out.push('', `*Cocok di semua bagian:* ${String(report.clean.count)} pasien`);
  if (report.clean.newNames.length > 0) out.push(`Pasien baru (cocok): ${report.clean.newNames.join(', ')}`);
  if (report.advice.length > 0) {
    out.push('', '*Saran*');
    for (const line of report.advice) out.push(`- ${line}`);
  }
  return out.join('\n');
}

/**
 * The transcription's self-check, in Indonesian. `verify.ts` keeps its own
 * terse strings (they are tested and logged); this is what a person reads.
 */
export function transcriptionWarning(text: string): string {
  const doc = /^(DENAH|LIST): /.exec(text)?.[1];
  const body = doc ? text.slice(doc.length + 2) : text;
  const prefix = doc === 'LIST' ? 'LIST PASIEN: ' : doc ? `${doc}: ` : '';
  const where: Record<string, string> = { roomGrid: 'denah kamar', dpjpTable: 'tabel DPJP', holderList: 'holder list', body: 'isi LIST' };
  let match = /^Expected (\S+), got (\S+)$/.exec(body);
  if (match) return `${prefix}PDF yang dipilih sebagai ${match[1] ?? ''} ternyata ${(match[2] ?? '').replace('_', ' ')}. Periksa apakah PDF tertukar.`;
  match = /^(roomGrid|dpjpTable|holderList|body) (\d+) ≠ selfCheck (\d+)$/.exec(body);
  if (match) {
    return `${prefix}AI menghitung ${match[3] ?? ''} pasien di ${where[match[1] ?? ''] ?? ''}, tetapi menyalin ${match[2] ?? ''}. Mungkin ada baris yang terlewat atau terulang.`;
  }
  match = /^roomBlocks occupied (\d+) ≠ roomGrid (\d+)$/.exec(body);
  if (match) return `${prefix}Bed terisi di gambar denah (${match[1] ?? ''}) tidak sama dengan jumlah pasien di denah kamar (${match[2] ?? ''}).`;
  if (body === 'header perDpjp line count mismatch') return `${prefix}Jumlah baris per DPJP di header LIST tidak sama dengan yang dihitung AI.`;
  return text;
}
