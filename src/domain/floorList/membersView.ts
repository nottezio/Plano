import type { FloorDoc, FloorRole } from './floor';

/**
 * The small decisions behind the Setelan tab (26 Oct 2026, Avi: tidy it and
 * make the destructive taps safe). Kept out of the component so they are tested.
 */

/** Why a write failed, in words. Firestore queues offline writes, so a rejection is a real refusal. */
export function saveErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  if (code === 'permission-denied') return 'Tidak punya izin untuk perubahan ini. Hubungi pemilik list.';
  return 'Gagal menyimpan. Coba lagi.';
}

/** The owner is always an editor; anyone else reads their stored role, view when there is none. */
export function memberRole(floor: Pick<FloorDoc, 'ownerUid' | 'roles'>, member: string): FloorRole {
  return floor.ownerUid === member ? 'edit' : (floor.roles[member] ?? 'view');
}

/** The question asked before a member leaves: it names the person, so the wrong row cannot be confirmed. */
export function confirmQuestion(kind: 'remove' | 'leave', name = ''): string {
  if (kind === 'leave') return 'Keluar dari list ini?';
  return `Keluarkan ${name.trim() || 'anggota ini'} dari list?`;
}

/** The question before the list is handed over: names the person, and says what the owner keeps. */
export function transferQuestion(name = ''): string {
  return `Jadikan ${name.trim() || 'anggota ini'} pemilik list? Anda tetap menjadi editor.`;
}

/** Who a list can be handed to: members other than the owner (an invite not yet accepted is not a member). */
export function transferTargets(floor: Pick<FloorDoc, 'ownerUid' | 'memberIds'>): string[] {
  return floor.memberIds.filter((member) => member !== floor.ownerUid);
}

/** A sender list this long folds away; a short one stays open. */
export const NICKNAMES_OPEN_UP_TO = 5;
export function collapseNicknames(count: number): boolean {
  return count > NICKNAMES_OPEN_UP_TO;
}
