import { useCallback, useEffect, useState } from 'react';

import {
  LEGACY_STICKER_KEY,
  parseStickers,
  stickerMigrationPlan,
  stickerStorageKey,
  type BoardSticker,
} from '@/domain/board/stickers';

/**
 * The board's stickers for one scope: state, storage, and the one-time
 * migration from the pre-scope key.
 *
 * Lifted out of the sticker layer so two places can draw them: the canvas
 * surface draws the free ones, and each card draws the ones stuck on it.
 * One owner of the list, two readers — rather than two copies that could
 * disagree about where a sticker is.
 */
export interface BoardStickersState {
  stickers: BoardSticker[];
  /** Replace in memory only — used while a drag is in flight. */
  preview: (next: BoardSticker[]) => void;
  /** Replace and store. */
  persist: (next: BoardSticker[]) => void;
}

export function useBoardStickers(scope: string): BoardStickersState {
  const [stickers, setStickers] = useState<BoardSticker[]>([]);

  useEffect(() => {
    try {
      const key = stickerStorageKey(scope);
      const scopeValue = localStorage.getItem(key);
      const legacyValue = localStorage.getItem(LEGACY_STICKER_KEY);
      // See `stickerMigrationPlan`: Pasien saya inherits the pre-scope
      // stickers once; Titipan starts empty.
      const plan = stickerMigrationPlan(scope, scopeValue, legacyValue);
      const loaded = parseStickers(plan === 'migrate-legacy' ? legacyValue : scopeValue);
      setStickers(loaded);
      if (plan === 'migrate-legacy') {
        localStorage.setItem(key, JSON.stringify(loaded));
        localStorage.removeItem(LEGACY_STICKER_KEY);
      }
    } catch {
      setStickers([]);
    }
  }, [scope]);

  const persist = useCallback(
    (next: BoardSticker[]) => {
      setStickers(next);
      try {
        localStorage.setItem(stickerStorageKey(scope), JSON.stringify(next));
      } catch {
        // No storage: they last for this session, which is what a sticker is for.
      }
    },
    [scope],
  );

  return { stickers, preview: setStickers, persist };
}
