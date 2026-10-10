import { ESC_2023_ACS, RASCHKE_1993, type HeparinProtocol, type HeparinRow } from './heparinProtocol';

/**
 * Unfractionated heparin by aPTT (2026-10-10).
 *
 * A SUGGESTION from a published nomogram, never an order: the card shows the
 * row that matched and the source, and the clinician decides. Stateless —
 * nothing here is stored per patient.
 *
 * Dosing is weight-based on ACTUAL body weight ("All doses in the
 * weight-based nomogram were calculated based on actual body weight rather
 * than ideal weight", Raschke 1993). The paper gives no dose cap and no
 * rounding, so neither is applied: units are shown to the whole unit.
 */

export const HEPARIN_SOURCES: readonly string[] = [
  'Raschke RA, Reilly BM, Guidry JR, Fontana JR, Srinivas S. The weight-based heparin dosing nomogram compared with a "standard care" nomogram. Ann Intern Med 1993;119:874–81. Tabel 2 (nomogram, dalam detik dan × kontrol); dosis awal 80 U/kg bolus lalu 18 U/kg/jam; dosis memakai berat badan aktual; aPTT tiap 6 jam; tidak menyesuaikan dosis bila sampel aPTT diambil < 4 jam setelah perubahan terakhir; kontrol = batas atas rentang normal aPTT lab.',
  'Garcia DA, Baglin TP, Weitz JI, Samama MM. Parenteral anticoagulants. Chest 2012;141(2 Suppl):e24S–e43S. Tabel 3 (nomogram Raschke: "then increase"); rentang 1,5–2,5 × kontrol "gained wide acceptance" (Basu et al. 1972); rentang aPTT harus disesuaikan dengan reagen dan alat lab setempat.',
  'Byrne RA, Rossello X, Coughlan JJ, et al. 2023 ESC Guidelines for the management of acute coronary syndromes. Eur Heart J 2023;44:3720–826. Tabel 6, UFH: "Initial treatment: i.v. bolus 70–100 U/kg followed by i.v. infusion titrated to achieve an aPTT of 60–80 s." (tanpa batas bolus maksimal dan tanpa laju awal).',
  'Cuker A, et al. American Society of Hematology 2018 guidelines for management of venous thromboembolism: heparin-induced thrombocytopenia. Blood Adv 2018;2:3360–92. Skor 4Ts untuk probabilitas HIT.',
];

export interface HeparinStops {
  activeBleeding: boolean;
  /** Platelets low or falling, or HIT suspected. */
  plateletsOrHit: boolean;
  /** INR already prolonged before heparin. */
  baselineInrHigh: boolean;
  severeLiverDisease: boolean;
}

export const NO_STOPS: HeparinStops = {
  activeBleeding: false,
  plateletsOrHit: false,
  baselineInrHigh: false,
  severeLiverDisease: false,
};

/**
 * The hard stops: any one replaces the dose with a warning. They are the
 * clinician's ticks, not thresholds Plano computes: no fetchable source gave
 * a cut-off for "low platelets" or "prolonged INR" that could be cited, and
 * an invented one would be the worst kind of number in a dosing card.
 */
export function heparinStops(stops: HeparinStops): string[] {
  const out: string[] = [];
  if (stops.activeBleeding) out.push('Perdarahan aktif: jangan beri atau naikkan heparin; nilai ulang indikasi antikoagulan.');
  if (stops.plateletsOrHit) {
    out.push('Trombosit rendah/turun atau curiga HIT: hitung skor 4Ts (ASH 2018) dan tangani sesuai protokol HIT sebelum melanjutkan heparin.');
  }
  if (stops.baselineInrHigh) out.push('INR awal sudah memanjang: cari penyebabnya dan diskusikan dengan DPJP sebelum memulai heparin.');
  if (stops.severeLiverDisease) out.push('Penyakit hati berat: risiko perdarahan tinggi; dosis dari nomogram tidak berlaku tanpa keputusan DPJP.');
  return out;
}

const ID = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const RATIO = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatUnits = (value: number): string => ID.format(Math.round(value));
export const formatRatio = (value: number): string => RATIO.format(value);
const formatKg = (value: number): string => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value);

function positive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export interface StartDose {
  bolusUnits: number;
  ratePerKg: number;
  rateUnitsPerHour: number;
  line: string;
}

export function startDose(weightKg: number, protocol: HeparinProtocol = RASCHKE_1993): StartDose | null {
  if (!positive(weightKg)) return null;
  const bolusUnits = protocol.initial.bolusPerKg * weightKg;
  const ratePerKg = protocol.initial.ratePerKg;
  const rateUnitsPerHour = ratePerKg * weightKg;
  return {
    bolusUnits,
    ratePerKg,
    rateUnitsPerHour,
    line:
      `- Heparin bolus ${formatUnits(bolusUnits)} U IV, lanjut ${ratePerKg} U/kgBB/jam ` +
      `(${formatUnits(rateUnitsPerHour)} U/jam) IV kontinu (BB ${formatKg(weightKg)} kg); cek aPTT ${protocol.recheckHours} jam`,
  };
}

export function apttRatio(aptt: number, control: number): number | null {
  if (!positive(aptt) || !positive(control)) return null;
  return aptt / control;
}

export function matchRow(ratio: number, protocol: HeparinProtocol = RASCHKE_1993): HeparinRow {
  for (const row of protocol.rows) {
    if (row.maxRatio === null) return row;
    if (row.maxInclusive ? ratio <= row.maxRatio : ratio < row.maxRatio) return row;
  }
  // Unreachable while the last row is open-ended; the protocol data test
  // guarantees that it is.
  return protocol.rows[protocol.rows.length - 1]!;
}

export interface Adjustment {
  ratio: number;
  row: HeparinRow;
  bolusUnits: number;
  holdMinutes: number;
  newRatePerKg: number;
  newRateUnitsPerHour: number;
  /** The decrease would take the rate to zero or below. */
  rateFloor: boolean;
  /** Seconds the target window spans for this control. */
  targetSeconds: { low: number; high: number };
  line: string;
}

export interface AdjustInput {
  weightKg: number;
  currentRatePerKg: number;
  aptt: number;
  control: number;
}

/** Why an adjustment cannot be computed, in the card's words. */
export function adjustProblems(input: Partial<AdjustInput>): string[] {
  const out: string[] = [];
  if (!positive(input.weightKg)) out.push('Isi berat badan (kg).');
  if (!positive(input.aptt)) out.push('Isi nilai aPTT (detik).');
  if (!positive(input.control)) out.push('Isi aPTT kontrol lab (detik).');
  if (typeof input.currentRatePerKg !== 'number' || !Number.isFinite(input.currentRatePerKg) || input.currentRatePerKg < 0) {
    out.push('Isi laju heparin sekarang (U/kgBB/jam).');
  }
  return out;
}

export function adjustDose(input: AdjustInput, protocol: HeparinProtocol = RASCHKE_1993): Adjustment | null {
  if (adjustProblems(input).length > 0) return null;
  const ratio = apttRatio(input.aptt, input.control);
  if (ratio === null) return null;
  const row = matchRow(ratio, protocol);
  const proposed = input.currentRatePerKg + row.rateChangePerKg;
  const rateFloor = proposed <= 0;
  const newRatePerKg = Math.max(0, proposed);
  const newRateUnitsPerHour = newRatePerKg * input.weightKg;
  const bolusUnits = row.bolusPerKg * input.weightKg;
  const therapeutic = protocol.rows.find((candidate) => candidate.therapeutic);
  const below = protocol.rows[protocol.rows.indexOf(therapeutic!) - 1];
  const targetSeconds = {
    low: (below?.maxRatio ?? 0) * input.control,
    high: (therapeutic?.maxRatio ?? 0) * input.control,
  };

  const parts: string[] = [];
  if (row.holdMinutes > 0) parts.push(`stop ${row.holdMinutes / 60} jam`);
  if (bolusUnits > 0) parts.push(`bolus ${formatUnits(bolusUnits)} U IV`);
  parts.push(
    row.rateChangePerKg === 0
      ? `lanjut ${formatNumber(newRatePerKg)} U/kgBB/jam (${formatUnits(newRateUnitsPerHour)} U/jam)`
      : `${row.rateChangePerKg > 0 ? 'naik' : 'turun'} ke ${formatNumber(newRatePerKg)} U/kgBB/jam (${formatUnits(newRateUnitsPerHour)} U/jam)`,
  );
  const line =
    `- Heparin: ${parts.join(', lalu ')} IV kontinu ` +
    `(aPTT ${formatNumber(input.aptt)} dtk = ${formatRatio(ratio)} × kontrol ${formatNumber(input.control)} dtk; BB ${formatKg(input.weightKg)} kg); ` +
    `cek aPTT ${protocol.recheckHours} jam`;

  return { ratio, row, bolusUnits, holdMinutes: row.holdMinutes, newRatePerKg, newRateUnitsPerHour, rateFloor, targetSeconds, line };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value);
}

/**
 * aPTT, its printed control, INR and body weight from a note (2026-10-10).
 *
 * Read from the NEWEST lab line that has them — the ward writes the stack
 * newest-first, so the first match is the latest — and only to PREFILL: every
 * field on the card stays editable. Forms seen in the ward's notes:
 *   `PT/INR/APTT 14,2/1.39/23,6`, `PT/APTT/INR 18.2/35.8/1.81`,
 *   `APTT 52`, `APTT : 52 (kontrol 31)`, `BB : 37 kg`, `BB: 50 kg`.
 * WhatsApp bold (`*52*`) is stripped first, as in the SOAP checker.
 */
export interface CoagReading {
  aptt?: number;
  control?: number;
  inr?: number;
  weightKg?: number;
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const toNumber = (text: string): number => Number(text.replace(',', '.'));

export function readCoagFromNote(note: string): CoagReading {
  const body = note.replace(/[*_~]/g, '');
  const out: CoagReading = {};

  // A slash group: names joined by "/" and as many values joined by "/".
  const group = new RegExp(String.raw`\b((?:PT|INR|APTT)(?:\s*\/\s*(?:PT|INR|APTT)){1,2})\s*:?\s*(${NUM.slice(1, -1)}(?:\s*\/\s*${NUM.slice(1, -1)}){1,2})`, 'i');
  const match = group.exec(body);
  if (match?.[1] && match[2]) {
    const names = match[1].split('/').map((name) => name.trim().toUpperCase());
    const values = match[2].split('/').map((value) => toNumber(value.trim()));
    names.forEach((name, index) => {
      const value = values[index];
      if (value === undefined || !Number.isFinite(value)) return;
      if (name === 'APTT') out.aptt = value;
      if (name === 'INR') out.inr = value;
    });
  }
  const single = new RegExp(String.raw`\bAPTT\s*:?\s*${NUM}(?:\s*(?:s|dtk|detik))?\s*\(\s*(?:kontrol|control)\s*:?\s*${NUM}`, 'i').exec(body);
  if (single?.[1] && single[2]) {
    out.aptt ??= toNumber(single[1]);
    out.control = toNumber(single[2]);
  } else if (out.aptt === undefined) {
    const plain = new RegExp(String.raw`\bAPTT\s*:?\s*${NUM}`, 'i').exec(body);
    if (plain?.[1]) out.aptt = toNumber(plain[1]);
  }
  if (out.inr === undefined) {
    const inr = new RegExp(String.raw`\bINR\s*:?\s*${NUM}`, 'i').exec(body);
    if (inr?.[1]) out.inr = toNumber(inr[1]);
  }
  const weight = new RegExp(String.raw`\bBB\s*:?\s*${NUM}\s*kg`, 'i').exec(body);
  if (weight?.[1]) out.weightKg = toNumber(weight[1]);
  return out;
}

export type ApttPosition = 'below' | 'in' | 'above';

export interface AcsDose {
  bolusMinUnits: number;
  bolusMaxUnits: number;
  line: string;
}

/** ESC 2023 ACS initial UFH: a bolus RANGE, then an infusion titrated to aPTT 60–80 s. */
export function acsStart(weightKg: number): AcsDose | null {
  if (!positive(weightKg)) return null;
  const bolusMinUnits = ESC_2023_ACS.bolusPerKg.min * weightKg;
  const bolusMaxUnits = ESC_2023_ACS.bolusPerKg.max * weightKg;
  return {
    bolusMinUnits,
    bolusMaxUnits,
    line:
      `- Heparin bolus ${formatUnits(bolusMinUnits)}–${formatUnits(bolusMaxUnits)} U IV ` +
      `(${ESC_2023_ACS.bolusPerKg.min}–${ESC_2023_ACS.bolusPerKg.max} U/kg, BB ${formatKg(weightKg)} kg), ` +
      `lanjut infus IV titrasi ke aPTT ${ESC_2023_ACS.apttSeconds.low}–${ESC_2023_ACS.apttSeconds.high} dtk`,
  };
}

/** Where an aPTT sits against the ESC 2023 window (inclusive at both ends). */
export function acsApttPosition(aptt: number): ApttPosition | null {
  if (!positive(aptt)) return null;
  if (aptt < ESC_2023_ACS.apttSeconds.low) return 'below';
  if (aptt > ESC_2023_ACS.apttSeconds.high) return 'above';
  return 'in';
}
