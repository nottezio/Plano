import { useEffect, useState } from 'react';

import { putJagaRoster, putJagaState, subscribeJaga } from '@/data/repositories/jaga.repo';
import {
  applyJagaState,
  applyRosterKind,
  claimJagaLocal,
  readJagaState,
  readRosterKind,
  setJagaRemote,
} from '@/domain/jaga/store';
import {
  firstSyncState,
  followRemoteState,
  JAGA_ROSTER_KINDS,
  pickRoster,
} from '@/domain/jaga/sync';
import { useSession } from '@/store/useSession';

export type JagaSyncStatus = 'off' | 'waiting' | 'synced' | 'error';

/**
 * Keeps Konfirmasi Jaga in step with the account while the Helper page is
 * open.
 *
 * `revision` goes up whenever something from another device lands in
 * localStorage. The page re-reads its state when it changes, and does not
 * need to know where the change came from.
 *
 * Mounted on the Helper page only, not app-wide. Changes made elsewhere
 * arrive the next time the page opens, since the listener's first answer
 * carries the whole account state. The data is only used on this page, and
 * a listener running on every screen would be work nobody reads.
 */
export function useJagaSync(): { revision: number; status: JagaSyncStatus } {
  const uid = useSession((state) => state.user?.uid ?? null);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<JagaSyncStatus>('off');

  useEffect(() => {
    if (!uid) {
      setStatus('off');
      return undefined;
    }

    setStatus('waiting');
    // Before anything is read or uploaded: another account's local copy is
    // not this account's to merge.
    if (claimJagaLocal(uid)) setRevision((current) => current + 1);
    setJagaRemote({
      putRoster: (kind, value) => {
        void putJagaRoster(uid, kind, value).catch((error: unknown) =>
          console.error('[jaga] roster write rejected', error),
        );
      },
      putState: (field, key, value) => {
        void putJagaState(uid, field, key, value);
      },
    });

    // False until the first server-confirmed snapshot has been reconciled.
    let reconciled = false;

    const unsubscribe = subscribeJaga(
      uid,
      ({ rosters, state, confirmed }) => {
        let changed = false;

        if (!reconciled && !confirmed) {
          /*
            Cache only, before the first real answer. Apply what the cache
            holds, which is what this device last saw of the account, but
            never upload and never remove anything local. An empty first cache
            means "not known yet", not "the account is empty".
          */
          for (const kind of JAGA_ROSTER_KINDS) {
            const remote = rosters[kind];
            if (remote !== undefined && pickRoster(kind, readRosterKind(kind), remote) === 'download') {
              changed = applyRosterKind(kind, remote) || changed;
            }
          }
          if (state) {
            changed = applyJagaState(firstSyncState(readJagaState(), state).merged) || changed;
          }
          if (changed) setRevision((current) => current + 1);
          return;
        }

        if (!reconciled) {
          // The first server answer: the one-time meeting of both sides.
          reconciled = true;
          for (const kind of JAGA_ROSTER_KINDS) {
            const local = readRosterKind(kind);
            const remote = rosters[kind] ?? null;
            const pick = pickRoster(kind, local, remote);
            if (pick === 'upload') {
              void putJagaRoster(uid, kind, local).catch((error: unknown) =>
                console.error('[jaga] first upload rejected', error),
              );
            } else if (pick === 'download') {
              changed = applyRosterKind(kind, remote) || changed;
            }
          }
          const { merged, uploads } = firstSyncState(readJagaState(), state);
          for (const write of uploads) void putJagaState(uid, write.field, write.key, write.value);
          changed = applyJagaState(merged) || changed;
          setStatus('synced');
          if (changed) setRevision((current) => current + 1);
          return;
        }

        // After the first sync, the account leads: rosters by import time,
        // state field by field, so deletions made elsewhere arrive.
        for (const kind of JAGA_ROSTER_KINDS) {
          const remote = rosters[kind];
          const local = readRosterKind(kind);
          const pick = pickRoster(kind, local, remote ?? null);
          if (pick === 'download') {
            changed = applyRosterKind(kind, remote) || changed;
          } else if (pick === 'upload' && confirmed) {
            // The account holds an OLDER document than this device, e.g. one
            // pushed by a device that had not synced yet. Heal it. Converges:
            // every device moves toward the latest document, never away.
            void putJagaRoster(uid, kind, local).catch((error: unknown) =>
              console.error('[jaga] healing upload rejected', error),
            );
          }
        }
        if (state) changed = applyJagaState(followRemoteState(readJagaState(), state)) || changed;
        if (confirmed) setStatus('synced');
        if (changed) setRevision((current) => current + 1);
      },
      (error) => {
        console.error('[jaga] sync listener failed', error);
        setStatus('error');
      },
    );

    return () => {
      unsubscribe();
      setJagaRemote(null);
    };
  }, [uid]);

  return { revision, status };
}
