import { useEffect, useRef } from 'react';

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
  /** True while the user's own typing is waiting to save (`editor.dirty`). */
  editing: boolean,
): void {
  /*
    Only while TYPING (22 Oct 2026, Firebase quota at 87%). It used to write
    the day's entry every 30 s for as long as the page was open and visible,
    so a laptop tab left on a patient all shift wrote ~1,000 times and every
    listener on that entry re-read each write. Presence means "someone is
    writing here"; a page that is only open says nothing.
  */
  const lastEdit = useRef(0);
  const sent = useRef(false);

  useEffect(() => {
    if (editing) lastEdit.current = Date.now();
  }, [editing]);

  useEffect(() => {
    if (!patientId || !active) return;
    sent.current = false;
    const timer = window.setInterval(() => {
      if (presenceDue(Date.now(), lastEdit.current, document.visibilityState === 'visible')) {
        sent.current = true;
        void heartbeatEditing(patientId, date);
      }
    }, HEARTBEAT_MS);
    return () => {
      window.clearInterval(timer);
      if (sent.current) void clearEditing(patientId, date);
    };
  }, [patientId, date, active]);

  // The first keystroke announces at once, not up to 30 s later.
  useEffect(() => {
    if (!editing || !patientId || !active || sent.current) return;
    sent.current = true;
    void heartbeatEditing(patientId, date);
  }, [editing, patientId, date, active]);
}

/** A beat is due when the page is visible and the user typed within the last two intervals. */
export function presenceDue(now: number, lastEdit: number, visible: boolean): boolean {
  return visible && lastEdit > 0 && now - lastEdit < HEARTBEAT_MS * 2;
}

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
