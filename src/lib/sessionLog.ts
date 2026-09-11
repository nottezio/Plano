/**
 * A short record of what happened to the session, kept across reloads.
 *
 * WHY A LOG RATHER THAN ANOTHER FIX
 *
 * A sign-out that happens "sometimes, without clear causes" and undoes itself
 * on a hard reload cannot be reproduced on demand, and the `?` in SIMGOS is
 * the standing lesson about what happens next: four releases of plausible
 * causes, each shipped, each followed by another report. The difference
 * between the candidates here — a token the server actually rejected, a
 * network failure treated as a rejection, a credential store read that came
 * back empty for a moment — is invisible afterwards unless something wrote it
 * down at the time.
 *
 * So this writes it down. When it next happens, the answer is in Pengaturan
 * rather than in a guess.
 *
 * WHAT IT DELIBERATELY DOES NOT HOLD
 *
 * No uid, no email, no token, no patient data. An entry is a timestamp, what
 * the SDK said, and the two pieces of context that separate the candidates:
 * whether the browser thought it was online, and how long the session had been
 * running. A diagnostic that carries identity is a diagnostic nobody can
 * safely paste into a chat.
 */

const KEY = 'visite.sessionLog';
/**
 * Twenty entries.
 *
 * Long enough to hold the boot, the failure, and the recovery of a few
 * incidents; short enough that it cannot grow into a localStorage problem of
 * its own, which would be an unusually poor way to cause the bug it exists to
 * explain.
 */
const LIMIT = 20;

export type SessionEventKind =
  | 'boot'
  | 'signed-in'
  | 'signed-out'
  | 'profile-error'
  | 'redirect-error';

export interface SessionEvent {
  at: string;
  kind: SessionEventKind;
  online: boolean;
  /** Error code where the SDK gave one, e.g. `auth/network-request-failed`. */
  detail?: string;
}

export function logSessionEvent(kind: SessionEventKind, detail?: string): void {
  try {
    const entry: SessionEvent = {
      at: new Date().toISOString(),
      kind,
      online: typeof navigator === 'undefined' ? true : navigator.onLine,
      ...(detail ? { detail } : {}),
    };
    const next = [...readSessionLog(), entry].slice(-LIMIT);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // A diagnostic that can break the thing it watches is worse than no
    // diagnostic. Storage full, storage blocked, private mode — all fine.
  }
}

export function readSessionLog(): SessionEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is SessionEvent =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as SessionEvent).at === 'string' &&
        typeof (entry as SessionEvent).kind === 'string',
    );
  } catch {
    return [];
  }
}

export function clearSessionLog(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Same reasoning as above.
  }
}

/**
 * A one-line reading of the log, for the person who has just been signed out
 * and wants to know whether it is worth reporting.
 *
 * The distinction that matters: a sign-out while the browser was OFFLINE is
 * almost certainly a dropped token refresh on ward wifi, and reloading fixes
 * it. A sign-out while online is the one worth chasing.
 */
export function describeLastSignOut(log: readonly SessionEvent[]): string | null {
  const last = [...log].reverse().find((entry) => entry.kind === 'signed-out');
  if (!last) return null;
  const when = new Date(last.at).toLocaleString('id-ID');
  if (last.detail) return `Keluar sendiri ${when} — ${last.detail}.`;
  return last.online
    ? `Keluar sendiri ${when}, saat jaringan tersambung.`
    : `Keluar sendiri ${when}, saat jaringan terputus.`;
}
