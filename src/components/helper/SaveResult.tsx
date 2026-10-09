import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/common/ui';
import { IconBookmark, IconCheck } from '@/components/common/Icons';
import { saveHelperResult, subscribeHelperResults } from '@/data/repositories/helperResults.repo';
import {
  helperResultId,
  saveState,
  type HelperResult,
  type HelperResultKind,
} from '@/domain/helperResults';
import { useSession } from '@/store/useSession';

/**
 * One listener for the whole Helper page.
 *
 * Every Simpan button needs to know whether its text is already saved, and
 * the Tersimpan tab needs the list. Each subscribing on its own would be one
 * Firestore listener per message box — four on the Morning Report tab alone.
 */

interface SavedResultsValue {
  uid: string | null;
  /** Deleted ones included: Undo and "saved, then deleted" both need them. */
  results: HelperResult[];
  byId: ReadonlyMap<string, HelperResult>;
  ready: boolean;
  error: boolean;
}

const SavedResultsContext = createContext<SavedResultsValue>({
  uid: null,
  results: [],
  byId: new Map(),
  ready: false,
  error: false,
});

export function SavedResultsProvider({ children }: { children: ReactNode }): JSX.Element {
  const uid = useSession((state) => state.user?.uid ?? null);
  const [results, setResults] = useState<HelperResult[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeHelperResults(
      uid,
      (next) => {
        setResults(next);
        setReady(true);
        setError(false);
      },
      (failure) => {
        // Most likely the rules for this path are not deployed yet: the app
        // still works, the list just says it cannot be read.
        console.error('[helperResults] listener failed', failure);
        setReady(true);
        setError(true);
      },
    );
  }, [uid]);

  const value = useMemo(
    () => ({ uid, results, byId: new Map(results.map((result) => [result.id, result])), ready, error }),
    [uid, results, ready, error],
  );
  return <SavedResultsContext.Provider value={value}>{children}</SavedResultsContext.Provider>;
}

export function useSavedResults(): SavedResultsValue {
  return useContext(SavedResultsContext);
}

/**
 * Simpan, beside each Salin.
 *
 * Three states, from what is already on the account (`saveState`):
 *   Simpan     — nothing saved for this result yet
 *   Tersimpan  — saved and identical; pressing it opens the Tersimpan tab
 *   Perbarui   — saved, but the text on screen has changed since
 */
export function SaveResultButton({
  kind,
  forDate,
  subject,
  title,
  text,
  disabled = false,
}: {
  kind: HelperResultKind;
  forDate: string;
  subject: string;
  title: string;
  text: string;
  disabled?: boolean;
}): JSX.Element {
  const { uid, byId } = useSavedResults();
  const [, setParams] = useSearchParams();
  const existing = byId.get(helperResultId(kind, forDate, subject));
  const state = saveState(existing, text);
  const empty = !text.trim();

  if (state === 'same') {
    return (
      <Button
        size="sm"
        variant="secondary"
        icon={<IconCheck className="h-4 w-4" />}
        title="Sudah tersimpan di akun — buka daftar Tersimpan"
        onClick={() => setParams({ tab: 'tersimpan' }, { replace: true })}
      >
        Tersimpan
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={disabled || empty || !uid}
      icon={<IconBookmark className="h-4 w-4" />}
      title={
        state === 'changed'
          ? 'Teks sudah berubah sejak disimpan — timpa simpanan dengan versi ini'
          : 'Simpan ke akun; bisa dibuka lagi di perangkat mana pun'
      }
      onClick={() => {
        if (!uid) return;
        void saveHelperResult(uid, { kind, forDate, subject, title, text }).written.catch(
          (error: unknown) => console.error('[helperResults] save rejected', error),
        );
      }}
    >
      {state === 'changed' ? 'Perbarui' : 'Simpan'}
    </Button>
  );
}
