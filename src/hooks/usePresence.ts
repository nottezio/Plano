import { useEffect } from 'react';

import { clearEditing, heartbeatEditing } from '@/data/repositories/entries.repo';
import { getDeviceId } from '@/data/deviceId';
import type { ClinicalDate, DailyEntry } from '@/domain/types';

/** SPEC 7.5 — heartbeat interval and the window a heartbeat stays meaningful. */
const HEARTBEAT_MS = 30_000;
const STALE_AFTER_MS = 90_000;

/**
 * SPEC 7.5 — soft presence.
 *
 * A HINT, never a lock. Two people may write the same day simultaneously; the
 * merge handles that. A hard lock would be worse than the problem: the holder
 * walks away, the document stays locked, and the person who actually needs to
 * write is stuck — offline, with no way to release it.
 *
 * A missed heartbeat therefore has no consequence beyond the banner fading.
 */
export function usePresenceHeartbeat(
  patientId: string | undefined,
  date: ClinicalDate,
  active: boolean,
): void {
  useEffect(() => {
    if (!patientId || !active) return;

    void heartbeatEditing(patientId, date);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void heartbeatEditing(patientId, date);
    }, HEARTBEAT_MS);

    return () => {
      window.clearInterval(timer);
      void clearEditing(patientId, date);
    };
  }, [patientId, date, active]);
}

/** Another device's label if it is currently editing this day, else null. */
export function otherDeviceEditing(entry: DailyEntry | null): string | null {
  const editing = entry?.editing;
  if (!editing) return null;
  if (editing.deviceId === getDeviceId()) return null;

  const at = editing.at?.toMillis?.();
  // No timestamp yet means the write is still queued locally on the other
  // device; treat it as live rather than stale.
  if (at !== undefined && Date.now() - at > STALE_AFTER_MS) return null;

  return editing.deviceId.slice(0, 4);
}
