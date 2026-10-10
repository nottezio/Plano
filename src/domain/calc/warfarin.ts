import { CROWTHER_5MG, type WarfarinDay, type WarfarinRow } from './warfarinProtocol';

/**
 * Warfarin, INPATIENT INITIATION only (2026-10-10).
 *
 * The day's dose from the 5-mg nomogram, for a target INR of 2.0–3.0, as a
 * SUGGESTION: the matched row and its printed range are shown, and where the
 * table gives a range ("2.5 - 5.0 mg") the card gives the range — choosing
 * within it is the clinician's call, not an average Plano invents.
 *
 * Stateless: no per-patient storage. Every number below is quoted from a
 * source in `WARFARIN_SOURCES`.
 */

export const WARFARIN_SOURCES: readonly string[] = [
  'Crowther MA, Harrison L, Hirsh J. In response (Warfarin: Less May Be Better). Ann Intern Med 1997;127:332–3. Gambar: nomogram warfarin 5 mg (hari 1–6, INR → dosis); dosis hari ke-2 diturunkan hanya bila INR 12–16 jam setelah dosis pertama sudah menunjukkan efek berlebih.',
  'Crowther MA, Ginsberg JB, Kearon C, et al. A randomized trial comparing 5-mg and 10-mg warfarin loading doses. Arch Intern Med 1999;159:46–8. Target INR 2,0–3,0; dosis malam hari; INR tiap pagi sampai INR 2,0–3,0 dua hari berturut-turut.',
  'Ageno W, Gallus AS, Wittkowsky A, et al. Oral anticoagulant therapy. Chest 2012;141(2 Suppl):e44S–e88S. Dosis awal 5–10 mg; "starting doses of ≤ 5 mg might be appropriate" pada lansia, nutrisi buruk, penyakit hati, gagal jantung, risiko perdarahan tinggi; penggantian katup: "An initial dose of 2 to 3 mg seems to be appropriate"; INR harian di rawat inap sampai rentang terapi; Tabel 1 interaksi obat.',
  'Kearon C, Akl EA, Comerota AJ, et al. Antithrombotic therapy for VTE disease. Chest 2012;141(2 Suppl):e419S–e496S. Rekomendasi 2.4 (1B): mulai VKA di hari yang sama dengan antikoagulan parenteral; parenteral minimal 5 hari dan sampai INR ≥ 2,0 selama ≥ 24 jam.',
  'Whitlock RP, Sun JC, Fremes SE, et al. Antithrombotic and thrombolytic therapy for valvular disease. Chest 2012;141(2 Suppl):e576S–e600S. Bridging dini katup mekanik ke VKA dengan UFH (dosis DVT) atau LMWH (2C); target INR 2,5 aorta (1B), 3,0 mitral atau dua katup (2C).',
];

/** The target INR is a REQUIRED choice; nothing is assumed. */
export type InrTarget = '2-3' | '2.5-3.5' | 'mech-aortic-2.5' | 'mech-mitral-3';

export const INR_TARGETS: ReadonlyArray<{ value: InrTarget; label: string; nomogram: boolean }> = [
  { value: '2-3', label: '2,0–3,0', nomogram: true },
  { value: '2.5-3.5', label: '2,5–3,5', nomogram: false },
  { value: 'mech-aortic-2.5', label: 'Katup mekanik aorta: 2,5', nomogram: false },
  { value: 'mech-mitral-3', label: 'Katup mekanik mitral / dua katup: 3,0', nomogram: false },
];

export interface WarfarinStops {
  activeBleeding: boolean;
  baselineInrHigh: boolean;
  severeLiverDisease: boolean;
}

export const NO_WARFARIN_STOPS: WarfarinStops = { activeBleeding: false, baselineInrHigh: false, severeLiverDisease: false };

export function warfarinStops(stops: WarfarinStops): string[] {
  const out: string[] = [];
  if (stops.activeBleeding) out.push('Perdarahan aktif: jangan mulai warfarin; nilai ulang indikasi antikoagulan.');
  if (stops.baselineInrHigh) out.push('INR awal sudah memanjang sebelum warfarin: cari penyebabnya dan diskusikan dengan DPJP; nomogram mengandaikan INR awal normal.');
  if (stops.severeLiverDisease) out.push('Penyakit hati berat: respons warfarin tidak terduga; dosis nomogram tidak berlaku tanpa keputusan DPJP.');
  return out;
}

/** Ticked factors that call for a lower start (Ageno 2012). */
export const LOWER_START_FACTORS = [
  { key: 'elderly', label: 'Usia lanjut' },
  { key: 'nutrition', label: 'Nutrisi buruk' },
  { key: 'liver', label: 'Penyakit hati' },
  { key: 'hf', label: 'Gagal jantung' },
  { key: 'bleeding', label: 'Risiko perdarahan tinggi' },
  { key: 'valve', label: 'Penggantian katup jantung' },
] as const;
export type LowerStartKey = (typeof LOWER_START_FACTORS)[number]['key'];

export function lowerStartNote(ticked: ReadonlySet<LowerStartKey>): string | null {
  const lines: string[] = [];
  if (ticked.has('valve')) lines.push('Penggantian katup: dosis awal 2–3 mg tampaknya sesuai (Ageno 2012).');
  if ([...ticked].some((key) => key !== 'valve')) {
    lines.push('Dosis awal ≤ 5 mg mungkin sesuai (Ageno 2012). Nomogram ini dimulai 5 mg; pertimbangkan dosis lebih rendah.');
  }
  return lines.length > 0 ? lines.join(' ') : null;
}

/**
 * Drugs that potentiate warfarin, from Ageno 2012 Table 1 ("highly probable"
 * and "probable" potentiation), limited to those a cardiology ward meets.
 * A prompt to look, not a dose change: the table gives no adjustment.
 */
export const INTERACTING_DRUGS: ReadonlyArray<{ name: string; level: 'highly probable' | 'probable' }> = [
  { name: 'Amiodarone', level: 'highly probable' },
  { name: 'Diltiazem', level: 'highly probable' },
  { name: 'Propafenone', level: 'highly probable' },
  { name: 'Propranolol', level: 'highly probable' },
  { name: 'Fenofibrate', level: 'highly probable' },
  { name: 'Ciprofloxacin', level: 'highly probable' },
  { name: 'Cotrimoxazole', level: 'highly probable' },
  { name: 'Erythromycin', level: 'highly probable' },
  { name: 'Metronidazole', level: 'highly probable' },
  { name: 'Fluconazole', level: 'highly probable' },
  { name: 'Voriconazole', level: 'highly probable' },
  { name: 'Omeprazole', level: 'highly probable' },
  { name: 'Azithromycin', level: 'probable' },
  { name: 'Clarithromycin', level: 'probable' },
  { name: 'Levofloxacin', level: 'probable' },
  { name: 'Itraconazole', level: 'probable' },
];

export const OVERLAP_GUIDANCE: readonly string[] = [
  'Heparin/LMWH dan warfarin: mulai warfarin di hari yang sama dengan antikoagulan parenteral; lanjutkan parenteral minimal 5 hari DAN sampai INR ≥ 2,0 selama ≥ 24 jam (Kearon 2012, Rek. 2.4, 1B).',
  'Katup mekanik: bridging dini ke warfarin dengan UFH (dosis DVT) atau LMWH (Whitlock 2012, 2C). Target INR 2,5 untuk katup aorta (1B), 3,0 untuk mitral atau dua katup (2C).',
];

export interface DayDose {
  day: number;
  /** The rows the INR falls in; two when it sits between two printed rows. */
  rows: WarfarinRow[];
  minMg: number;
  maxMg: number;
  /** True when the INR fell in a gap between printed rows (e.g. 1.95). */
  between: boolean;
  line: string;
}

function inRow(inr: number, row: WarfarinRow): boolean {
  const aboveLow = row.low === null || (row.lowInclusive ? inr >= row.low : inr > row.low);
  const belowHigh = row.high === null || (row.highInclusive ? inr <= row.high : inr < row.high);
  return aboveLow && belowHigh;
}

const mg = (value: number): string => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value);
const inrText = (value: number): string => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value);

/** What the card asks for before it can answer. */
export function warfarinProblems(input: { target: InrTarget | null; day: number; inr: number }): string[] {
  const out: string[] = [];
  if (input.target === null) out.push('Pilih target INR.');
  if (!Number.isInteger(input.day) || input.day < 1) out.push('Isi hari ke berapa warfarin (1–6).');
  else if (input.day > 1 && !(Number.isFinite(input.inr) && input.inr > 0)) out.push('Isi INR pagi ini.');
  return out;
}

/**
 * The dose for `day`, from that morning's INR. Null when the day is outside
 * the table (the nomogram ends at day 6), or inputs are missing.
 */
export function dayDose(day: number, inr: number, table: readonly WarfarinDay[] = CROWTHER_5MG): DayDose | null {
  const entry = table.find((candidate) => candidate.day === day);
  if (!entry) return null;
  if (entry.fixedMg !== undefined) {
    return {
      day,
      rows: [],
      minMg: entry.fixedMg,
      maxMg: entry.fixedMg,
      between: false,
      line: `- Warfarin ${mg(entry.fixedMg)} mg/oral malam ini (hari ke-1); cek INR besok pagi`,
    };
  }
  if (!(Number.isFinite(inr) && inr > 0)) return null;
  let rows = entry.rows.filter((row) => inRow(inr, row));
  let between = false;
  if (rows.length === 0) {
    // A value between two printed rows (1.95 sits between "1.5 - 1.9" and
    // "2.0 - …"). The table is printed to one decimal; rather than round a
    // dosing input, both neighbours are shown and the clinician chooses.
    const below = [...entry.rows].reverse().find((row) => row.high !== null && inr > row.high);
    const above = entry.rows.find((row) => row.low !== null && inr < row.low);
    rows = [below, above].filter((row): row is WarfarinRow => row !== undefined);
    between = true;
  }
  const minMg = Math.min(...rows.map((row) => row.minMg));
  const maxMg = Math.max(...rows.map((row) => row.maxMg));
  const dose =
    maxMg === 0 ? 'tunda (0 mg) malam ini' : minMg === maxMg ? `${mg(minMg)} mg/oral malam ini` : `${mg(minMg)}–${mg(maxMg)} mg/oral malam ini`;
  return {
    day,
    rows,
    minMg,
    maxMg,
    between,
    line: `- Warfarin ${dose} (hari ke-${day}, INR ${inrText(inr)}); cek INR besok pagi`,
  };
}

export const LAST_NOMOGRAM_DAY = Math.max(...CROWTHER_5MG.map((entry) => entry.day));
