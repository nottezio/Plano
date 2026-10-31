/**
 * Moving to a new address (GitHub Pages → Firebase Hosting).
 *
 * A new origin starts with empty browser storage. Everything in Firestore
 * comes back at sign-in; what lives only in this device's localStorage
 * (stickers, drawings, reference ranges, board order, theme…) does not. The
 * old site packs those keys into the account (`users/{uid}/private/move`), the
 * new site offers to put them back.
 *
 * Pure: no storage, no Firestore. The callers hand in key/value pairs.
 *
 * Carried: every `visite.*` / `plano.*` key EXCEPT the ones below. Excluded,
 * and why:
 * - device identity and device-only state (a new origin is a new device);
 * - the PIN and the AI key/flags (security; the AI pair is synced anyway);
 * - the clipboard note (a patient's name and RM, and stale by tomorrow);
 * - local mirrors of Firestore data (jaga, sensus): the new site rebuilds
 *   them from the account, and an old copy could shadow newer remote data;
 * - logs and diagnostics.
 *
 * Applying only writes keys that are ABSENT on the new device, so nothing the
 * new site already holds is replaced.
 */

const SKIP_EXACT = new Set([
  'visite.deviceId',
  'visite.chunkRecovery',
  'visite.iosInstallHint.dismissed',
  'visite.pin',
  'visite.ai.key',
  'visite.ai.flags',
  'visite.sessionLog',
  'plano.clipboard.last',
  'plano.signout.cacheKept',
  'plano.sensus.v1',
  'plano.sensus.v2',
]);

const SKIP_PREFIX = ['visite.jaga.', 'visite.access.', 'plano.move.'];

export function isCarriedKey(key: string): boolean {
  if (!key.startsWith('visite.') && !key.startsWith('plano.')) return false;
  if (SKIP_EXACT.has(key)) return false;
  return !SKIP_PREFIX.some((prefix) => key.startsWith(prefix));
}

/**
 * Firestore's document limit is 1 MiB, shared by every device's entry; the
 * rules allow three devices (phone, laptop, tablet), so each gets 300 KB.
 */
export const MAX_PACK_BYTES = 300_000;

export interface PackResult {
  /** JSON object of carried key → value. */
  json: string;
  carried: string[];
  /** Carried keys left out because the pack would exceed the limit. */
  skipped: string[];
}

function bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Smallest values first, so one huge drawing cannot push out twenty small
 * preferences. The size counted is the JSON the key and value become.
 */
export function packSettings(entries: ReadonlyArray<readonly [string, string]>, limit = MAX_PACK_BYTES): PackResult {
  const candidates = entries
    .filter(([key]) => isCarriedKey(key))
    .map(([key, value]) => ({ key, value, size: bytes(JSON.stringify(key)) + bytes(JSON.stringify(value)) + 2 }))
    .sort((a, b) => a.size - b.size || a.key.localeCompare(b.key));

  const kept: Record<string, string> = {};
  const carried: string[] = [];
  const skipped: string[] = [];
  let total = 2; // {}
  for (const item of candidates) {
    if (total + item.size > limit) {
      skipped.push(item.key);
      continue;
    }
    kept[item.key] = item.value;
    carried.push(item.key);
    total += item.size;
  }
  return { json: JSON.stringify(kept), carried: carried.sort(), skipped: skipped.sort() };
}

/**
 * Keys to write on the new device: carried, string-valued, and not already
 * present. Anything malformed yields nothing rather than throwing.
 */
export function planApply(json: string, has: (key: string) => boolean): Array<[string, string]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
  const out: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== 'string' || !isCarriedKey(key) || has(key)) continue;
    out.push([key, value]);
  }
  return out.sort(([a], [b]) => a.localeCompare(b));
}

/**
 * The new address's origin, or null when unset or not an https URL. Plain
 * http is accepted for loopback only, so both halves can be tried locally on
 * two ports (two origins).
 */
export function parseMovedTo(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol === 'https:') return url.origin;
    return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * `old`: this page is not the new address, so it shows the "moved" banner.
 * `new`: this page is the new address, so it may offer the carried settings.
 * `none`: no move configured.
 */
export type MoveRole = 'none' | 'old' | 'new';

export function moveRole(movedTo: string | null, origin: string): MoveRole {
  if (!movedTo) return 'none';
  return origin === movedTo ? 'new' : 'old';
}
