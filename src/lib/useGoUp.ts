import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { appHistory } from './appHistory';

/**
 * The in-app ← button: the screen this one was opened from, one level up
 * (a patient opened from Arsip returns to Arsip), or `fallback` when the app
 * was opened right on this screen.
 */
export function useGoUp(fallback: string): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    const history = appHistory();
    if (history) history.up(fallback);
    else navigate(fallback);
  }, [fallback, navigate]);
}
