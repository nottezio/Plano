import { useCallback, useMemo, useState } from 'react';

import { resolveMarks, toggleMarks, type LineMark } from '@/domain/lineMarks';

const key = (patientId: string): string => `plano.marks.${patientId}`;

function read(patientId: string | null): LineMark[] {
  if (!patientId) return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key(patientId)) ?? '[]');
    return Array.isArray(parsed) ? (parsed as LineMark[]) : [];
  } catch {
    return [];
  }
}

/** The patient's marker lines, kept on this device (no Firestore); see `domain/lineMarks`. */
export function useLineMarks(
  patientId: string | null,
  body: string,
): {
  spans: Array<{ start: number; end: number }>;
  toggle: (start: number, end: number) => void;
} {
  const [state, setState] = useState<{ id: string | null; marks: LineMark[] }>({
    id: patientId,
    marks: read(patientId),
  });
  // A patient switch reads that patient's marks.
  const marks = state.id === patientId ? state.marks : read(patientId);
  if (state.id !== patientId) setState({ id: patientId, marks });

  const toggle = useCallback(
    (start: number, end: number) => {
      if (!patientId) return;
      const next = toggleMarks(body, marks, start, end);
      setState({ id: patientId, marks: next });
      try {
        localStorage.setItem(key(patientId), JSON.stringify(next));
      } catch {
        // Not remembered: the mark still shows until the page closes.
      }
    },
    [patientId, body, marks],
  );

  const spans = useMemo(() => resolveMarks(body, marks), [body, marks]);
  return { spans, toggle };
}
