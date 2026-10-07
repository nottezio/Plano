import { useCallback, useEffect, useRef, useState } from 'react';

import { drawingStorageKey, parseDrawing, type Stroke } from '@/domain/board/drawing';

/** How many steps Urungkan can go back. In memory: undo does not survive a reload. */
const UNDO_DEPTH = 50;

export interface BoardDrawingState {
  strokes: Stroke[];
  /** Replace and store, as one undoable step. */
  commit: (next: Stroke[]) => void;
  undo: () => void;
  canUndo: boolean;
}

/**
 * The drawing of one board scope: state, storage, undo.
 *
 * Per device and per scope, like `useBoardStickers` (see `domain/board/drawing`).
 * A step is a whole stroke or a whole eraser drag, never a point, so one
 * Urungkan takes back one gesture.
 */
export function useBoardDrawing(scope: string): BoardDrawingState {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const history = useRef<Stroke[][]>([]);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    history.current = [];
    setCanUndo(false);
    try {
      setStrokes(parseDrawing(localStorage.getItem(drawingStorageKey(scope))));
    } catch {
      setStrokes([]);
    }
  }, [scope]);

  const store = useCallback(
    (next: Stroke[]) => {
      setStrokes(next);
      try {
        localStorage.setItem(drawingStorageKey(scope), JSON.stringify(next));
      } catch {
        // No storage (or full): the drawing lasts for this session.
      }
    },
    [scope],
  );

  const latest = useRef(strokes);
  latest.current = strokes;

  const commit = useCallback(
    (next: Stroke[]) => {
      if (next === latest.current) return;
      history.current = [...history.current.slice(-(UNDO_DEPTH - 1)), latest.current];
      setCanUndo(true);
      store(next);
    },
    [store],
  );

  const undo = useCallback(() => {
    const previous = history.current.pop();
    if (!previous) return;
    setCanUndo(history.current.length > 0);
    store(previous);
  }, [store]);

  return { strokes, commit, undo, canUndo };
}
