/**
 * Messages from the admin (the Pesan tab).
 *
 * A notice lives on a document every app already listens to: `config/access`
 * for everyone, `access/{uid}` for one account. Only the admin can write
 * either field, so no new rule, collection or listener is involved.
 *
 * Expiry is judged on the device, from the clock, never in a query: a filter
 * on "now" is a moving value that can never resume a listener.
 */

import { formatDmy } from './dateDmy';

export const NOTICE_MAX = 500;

export type NoticeTone = 'info' | 'penting';

export interface AccessNotice {
  /** Random per message, so a new message shows again after an old one was closed. */
  id: string;
  text: string;
  tone: NoticeTone;
  /** `null` while the server stamp is still pending (a message just sent from this device). */
  createdAt: Date | null;
  /** `null` = never expires. */
  expiresAt: Date | null;
}

export function isExpired(notice: AccessNotice, now: number): boolean {
  return notice.expiresAt !== null && now >= notice.expiresAt.getTime();
}

/** Milliseconds until it expires; `null` if it never does. May be negative. */
export function msUntilExpiry(notice: AccessNotice, now: number): number | null {
  return notice.expiresAt === null ? null : notice.expiresAt.getTime() - now;
}

/**
 * The one message to show: unexpired, not closed on this device, newest first.
 * On a tie the earlier candidate wins, so list the personal one first.
 */
export function pickNotice(
  candidates: readonly (AccessNotice | null)[],
  closedIds: readonly string[],
  now: number,
): AccessNotice | null {
  let best: AccessNotice | null = null;
  for (const notice of candidates) {
    if (!notice || isExpired(notice, now) || closedIds.includes(notice.id)) continue;
    // A pending stamp means "just sent": newer than anything stamped.
    const stamp = notice.createdAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bestStamp = best ? (best.createdAt?.getTime() ?? Number.POSITIVE_INFINITY) : Number.NEGATIVE_INFINITY;
    if (stamp > bestStamp) best = notice;
  }
  return best;
}

export type ExpiryPreset = '1h' | '24h' | '3d' | '7d' | 'none';

const PRESET_MS: Record<Exclude<ExpiryPreset, 'none'>, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

export const EXPIRY_PRESETS: readonly { id: ExpiryPreset; label: string }[] = [
  { id: '1h', label: '1 jam' },
  { id: '24h', label: '24 jam' },
  { id: '3d', label: '3 hari' },
  { id: '7d', label: '7 hari' },
  { id: 'none', label: 'Tanpa batas' },
];

export function expiryFromPreset(preset: ExpiryPreset, now: number): Date | null {
  return preset === 'none' ? null : new Date(now + PRESET_MS[preset]);
}

const two = (value: number): string => String(value).padStart(2, '0');

/** Local calendar day as ISO (`DateField` speaks ISO). */
export const toLocalIso = (date: Date): string =>
  `${String(date.getFullYear())}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;

/** Local time as `HH:MM` (what `<input type="time">` speaks). */
export const toLocalTime = (date: Date): string => `${two(date.getHours())}:${two(date.getMinutes())}`;

/** "13/11/2026 09.30": the date day first, as everywhere in Plano. */
export const formatDmyTime = (date: Date): string =>
  `${formatDmy(toLocalIso(date))} ${toLocalTime(date).replace(':', '.')}`;

/** A local date and time typed by the admin → a Date; `null` if either is unreadable. */
export function fromLocal(iso: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const date = new Date(`${iso}T${time}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
