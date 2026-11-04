/**
 * How the patient board draws its patients on a wide screen, chosen in
 * the board's Tampilan menu (4 Nov 2026). Per device, like the board's order and its
 * Normal/Ringkas switch: a laptop and a phone are used differently. Phones
 * always get the standard list.
 */
export type BoardLayout = 'standar' | 'kartu' | 'baris';

export const DEFAULT_BOARD_LAYOUT: BoardLayout = 'standar';

export const BOARD_LAYOUTS: ReadonlyArray<{ id: BoardLayout; label: string; hint: string }> = [
  { id: 'standar', label: 'Standar', hint: 'Kartu lengkap, seperti sebelumnya' },
  { id: 'kartu', label: 'Kartu Ringkas', hint: 'Bed, status, satu baris diagnosis, Catatan' },
  { id: 'baris', label: 'Papan Kerja', hint: 'Satu baris per pasien' },
];

/** Absent or unknown reads as the default, so a newer build can never break the board. */
export function boardLayoutOf(value: unknown): BoardLayout {
  return BOARD_LAYOUTS.some((entry) => entry.id === value) ? (value as BoardLayout) : DEFAULT_BOARD_LAYOUT;
}
