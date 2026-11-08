import { useCallback, useMemo, useState } from 'react';

import { resolveMarks, toggleMarks, type LineMark } from '@/domain/lineMarks';

// Per patient AND day: a mark made on one day's note must not appear on another's.
const key = (patientId: string, date: string): string => `plano.marks.${patientId}.${date}`;

function read(patientId: string | null, date: string): LineMark[] {
  if (!patientId) return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key(patientId, date)) ?? '[]');
    return Array.isArray(parsed) ? (parsed as LineMark[]) : [];
  } catch {
    return [];
  }
}

/** The patient's marker lines, kept on this device (no Firestore); see `domain/lineMarks`. */
export function useLineMarks(
  patientId: string | null,
  body: string,
  date: string,
): {
  spans: Array<{ start: number; end: number }>;
  toggle: (start: number, end: number) => void;
} {
  const scope = `${patientId ?? ''}|${date}`;
  const [state, setState] = useState<{ scope: string; marks: LineMark[] }>({
    scope,
    marks: read(patientId, date),
  });
  // A patient or day switch reads that note's marks.
  const marks = state.scope === scope ? state.marks : read(patientId, date);
  if (state.scope !== scope) setState({ scope, marks });

  const toggle = useCallback(
    (start: number, end: number) => {
      if (!patientId) return;
      const next = toggleMarks(body, marks, start, end);
      setState({ scope, marks: next });
      try {
        localStorage.setItem(key(patientId, date), JSON.stringify(next));
      } catch {
        // Not remembered: the mark still shows until the page closes.
      }
    },
    [patientId, date, scope, body, marks],
  );

  const spans = useMemo(() => resolveMarks(body, marks), [body, marks]);
  return { spans, toggle };
}
