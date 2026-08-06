import { useEffect } from 'react';

import { useLock } from '@/store/useLock';
import { useSession } from '@/store/useSession';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;

/**
 * SPEC 18 — auto-lock and background blur.
 *
 * Two independent mechanisms, deliberately:
 *
 *  - The BLUR fires the instant the app is backgrounded, with no delay and no
 *    PIN required. Its job is the app switcher screenshot and the glance over a
 *    shoulder, so any delay defeats it.
 *  - The LOCK is time-based. Locking the moment the screen turns off would
 *    force a PIN entry every time a resident checks a message mid-round, and a
 *    lock that annoying gets switched off, which is strictly worse than a lock
 *    that waits three minutes.
 *
 * Backgrounded time counts toward the idle timer: the phone in a pocket for ten
 * minutes should come back locked even though the idle timer was not running.
 */
export function usePrivacyGuard(): void {
  const pinEnabled = useLock((state) => state.pinEnabled);
  const lock = useLock((state) => state.lock);
  const setObscured = useLock((state) => state.setObscured);
  const autoLockMinutes = useSession((state) => state.settings().privacy.autoLockMinutes);
  const blurOnBackground = useSession((state) => state.settings().privacy.blurOnBackground);

  useEffect(() => {
    const onVisibility = (): void => {
      setObscured(blurOnBackground && document.visibilityState === 'hidden');
    };
    const onBlur = (): void => setObscured(blurOnBackground);
    const onFocus = (): void => setObscured(false);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    onVisibility();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      setObscured(false);
    };
  }, [blurOnBackground, setObscured]);

  useEffect(() => {
    if (!pinEnabled) return;

    const timeoutMs = Math.max(1, autoLockMinutes) * 60_000;
    let lastActivity = Date.now();

    const markActive = (): void => {
      lastActivity = Date.now();
    };

    const check = (): void => {
      if (Date.now() - lastActivity >= timeoutMs) lock();
    };

    const onVisibility = (): void => {
      // Returning from the background: the elapsed time counts as idle, so a
      // long absence locks immediately instead of granting a fresh window.
      if (document.visibilityState === 'visible') check();
      else markActive();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }
    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setInterval(check, 15_000);

    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, markActive);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
  }, [pinEnabled, autoLockMinutes, lock]);
}
