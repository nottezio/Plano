import { useEffect, useState } from 'react';

import { clinicalDate } from '@/domain/clinicalDate';
import type { ClinicalDate } from '@/domain/types';
import { useSession } from '@/store/useSession';

/**
 * The current clinical date, kept fresh.
 *
 * This is NOT the checklist reset (SPEC 9.2) — nothing is written when the
 * date changes, and no state is cleared. It only re-reads the clock so the
 * board and headers stop saying "today" about yesterday. A device that slept
 * through midnight corrects itself on the next visibility change, which is
 * exactly when someone looks at it.
 */
export function useClinicalToday(): ClinicalDate {
  const timezone = useSession((state) => state.settings().timezone);
  const rolloverHour = useSession((state) => state.settings().dayRolloverHour);

  const compute = (): ClinicalDate => clinicalDate(new Date(), timezone, rolloverHour);
  const [today, setToday] = useState<ClinicalDate>(compute);

  useEffect(() => {
    const refresh = (): void => {
      const next = clinicalDate(new Date(), timezone, rolloverHour);
      setToday((current) => (current === next ? current : next));
    };

    refresh();
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [timezone, rolloverHour]);

  return today;
}
