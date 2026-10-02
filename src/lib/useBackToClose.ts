import { useEffect, useRef } from 'react';

import { appHistory } from './appHistory';

/**
 * While `open`, the phone's back button closes this sheet or dialog instead of
 * leaving the screen — what every Android app does. See `appHistory`.
 */
export function useBackToClose(open: boolean, close: () => void): void {
  const latest = useRef(close);
  latest.current = close;
  useEffect(() => {
    if (!open) return undefined;
    return appHistory()?.openOverlay(() => latest.current());
  }, [open]);
}
