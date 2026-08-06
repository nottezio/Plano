import { useCallback, useEffect, useMemo, useState } from 'react';

import { setTick, subscribeChecklist } from '@/data/repositories/checklist.repo';
import {
  buildDoneMap,
  checklistProgress,
  isDone,
  resolveStates,
  type ChecklistProgress,
  type ChecklistStates,
} from '@/domain/checklist';
import type { ChecklistItemDef, ClinicalDate, DailyChecklist } from '@/domain/types';
import { useClinicalToday } from './useClinicalToday';

export interface ChecklistController {
  states: ChecklistStates;
  progress: ChecklistProgress;
  toggle: (itemId: string) => void;
  loading: boolean;
}

/**
 * SPEC 9.2 — reads the AUTHORITATIVE checklist document.
 *
 * The board reads a denormalised cache on the patient doc because it needs one
 * query for the whole ward. Anywhere a checklist is actually *manipulated*,
 * this hook is used instead, so a tick is always computed from the real
 * document rather than from a cache that may be a write behind.
 *
 * There is still no reset anywhere: `date` is the document id, so a new day is
 * simply a document that does not exist yet.
 */
export function useChecklist(
  patientId: string | undefined,
  date: ClinicalDate,
  items: readonly ChecklistItemDef[],
  enabled = true,
): ChecklistController {
  const today = useClinicalToday();
  const [checklist, setChecklist] = useState<DailyChecklist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId || !enabled) return;
    setLoading(true);

    return subscribeChecklist(
      patientId,
      date,
      (next) => {
        setChecklist(next);
        setLoading(false);
      },
      (error) => {
        console.error('[checklist] subscription failed', error);
        setLoading(false);
      },
    );
  }, [patientId, date, enabled]);

  const states = useMemo(() => resolveStates(items, checklist), [items, checklist]);
  const progress = useMemo(() => checklistProgress(items, states), [items, states]);

  const toggle = useCallback(
    (itemId: string) => {
      if (!patientId) return;
      const next = !isDone(states, itemId);

      void setTick(
        patientId,
        date,
        itemId,
        next,
        // Written wholesale into the board cache, so it must be the complete,
        // current map — never a partial patch.
        buildDoneMap(items, states, itemId, next),
        date === today,
      ).catch((error: unknown) => console.error('[checklist] tick rejected', error));
    },
    [patientId, date, items, states, today],
  );

  return { states, progress, toggle, loading };
}
