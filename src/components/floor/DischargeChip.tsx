import type { FloorPatient } from '@/domain/floorList/report';

/** H-1 red, pulang hari ini green: the list's colours (and the Word list's). */
export const FLAG_TEXT = { tomorrow: 'var(--note-red)', today: 'var(--note-green)' } as const;

/** The H-1 / Pulang word as a small outlined chip; nothing when the patient has no plan to go home. */
export function DischargeChip({ patient, long = false }: { patient: FloorPatient; long?: boolean }): JSX.Element | null {
  if (!patient.discharge) return null;
  const colour = FLAG_TEXT[patient.discharge];
  const word = patient.discharge === 'tomorrow' ? (long ? 'H-1 · pulang besok' : 'H-1') : long ? 'Pulang hari ini' : 'Pulang';
  return (
    <span className="inline-block shrink-0 rounded-full border bg-surface px-1.5 text-[11px] font-semibold" style={{ borderColor: colour, color: colour }}>
      {word}
    </span>
  );
}
