import { useCallback, useSyncExternalStore } from 'react';

import { boardLayoutOf, type BoardLayout } from '@/domain/boardLayout';

const KEY = 'visite.board.layout';
const EVENT = 'visite:board-layout';

function read(): BoardLayout {
  try {
    return boardLayoutOf(localStorage.getItem(KEY));
  } catch {
    return boardLayoutOf(null);
  }
}

function subscribe(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

/** The board layout on this device. Shared live: Pengaturan and the board can both be open in tabs. */
export function useBoardLayout(): [BoardLayout, (next: BoardLayout) => void] {
  const layout = useSyncExternalStore(subscribe, read);
  const set = useCallback((next: BoardLayout) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Per-device convenience only.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [layout, set];
}
