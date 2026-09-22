import { useCallback, useState } from 'react';

/**
 * A set of ids remembered on this device.
 *
 * For per-card view state on the board: which notes are folded shut, which
 * cards are folded to their name. It follows the SCREEN, like the canvas
 * layout — a phone and a ward PC want different cards folded — so it is
 * localStorage, not the account.
 *
 * Only ever toggled one id at a time, never rebuilt from the cards on screen.
 * A board is filtered by scope and by search, and a set rewritten from the
 * visible cards would forget every card the filter was hiding — recurring
 * pattern 1, which wiped canvas layouts twice.
 */
export function parseIdSet(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((item): item is string => typeof item === 'string'))
      : new Set();
  } catch {
    // A corrupt entry costs the remembered folds, not the board.
    return new Set();
  }
}

export function toggled(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
}

export function usePersistentIdSet(
  key: string,
): [ReadonlySet<string>, (id: string) => void] {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => {
    try {
      return parseIdSet(localStorage.getItem(key));
    } catch {
      return new Set();
    }
  });

  const toggle = useCallback(
    (id: string) => {
      setIds((current) => {
        const next = toggled(current, id);
        try {
          localStorage.setItem(key, JSON.stringify([...next]));
        } catch {
          // No storage: remembered for this session only.
        }
        return next;
      });
    },
    [key],
  );

  return [ids, toggle];
}
