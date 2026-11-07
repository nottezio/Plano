/**
 * Fluid balance, in the line a handover is written in: input - output.
 *
 * Measured volumes only. The ward does not count IWL (Avi, 7 Nov 2026), and air
 * metabolisme went with it: alone it could only ever raise the balance.
 *
 * The line says "Balance", as the notes do: the SOAP checker reads that word.
 */

export interface FluidBalanceInput {
  /** Each measured intake, as labelled parts. Empty parts are not counted. */
  intake: ReadonlyArray<{ label: string; ml: number | null }>;
  output: ReadonlyArray<{ label: string; ml: number | null }>;
  hours: number;
}

export interface FluidBalanceResult {
  intakeMl: number;
  outputMl: number;
  balanceMl: number;
  line: string;
}

export const FLUID_BALANCE_SOURCES = ['Balans cairan = total input − total output. IWL dan air metabolisme tidak dihitung, sesuai praktik bangsal.'];

const counted = (parts: FluidBalanceInput['intake']): Array<{ label: string; ml: number }> =>
  parts.flatMap((part) => (part.ml === null ? [] : [{ label: part.label, ml: part.ml }]));

const total = (parts: ReadonlyArray<{ ml: number }>): number => parts.reduce((sum, part) => sum + part.ml, 0);

/** The parts named only when there is more than one, so a single value is not said twice. */
const detail = (parts: ReadonlyArray<{ label: string; ml: number }>): string =>
  parts.length > 1 ? ` (${parts.map((part) => `${part.label} ${String(part.ml)}`).join(', ')})` : '';

/**
 * Null until there is at least one input and one output: an unfilled side is
 * not zero, and a balance without it reads as a real, wrong number.
 */
export function calculateFluidBalance(input: FluidBalanceInput): FluidBalanceResult | null {
  const intake = counted(input.intake);
  const output = counted(input.output);
  const { hours } = input;

  if (intake.length === 0 || output.length === 0 || !(hours > 0)) return null;
  if ([...intake, ...output].some((part) => !(part.ml >= 0))) return null;

  const intakeMl = total(intake);
  const outputMl = total(output);
  const balanceMl = Math.round(intakeMl - outputMl);

  // ASCII only: this line is pasted into the hospital system.
  const signed = balanceMl > 0 ? `+${String(balanceMl)}` : String(balanceMl);
  const line = `Balance cairan ${String(hours)} jam: input ${String(intakeMl)} cc${detail(intake)} - output ${String(outputMl)} cc${detail(output)} = ${signed} cc`;

  return { intakeMl, outputMl, balanceMl, line };
}
