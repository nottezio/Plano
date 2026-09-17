import {
  deleteField,
  FieldPath,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { getDeviceId } from '../deviceId';
import { jagaCol, jagaDoc } from '../paths';
import { trackWrite } from '../syncStatus';
import {
  JAGA_ROSTER_KINDS,
  toStorable,
  type JagaRosterKind,
  type JagaState,
  type JagaStateField,
} from '@/domain/jaga/sync';

/**
 * Firestore access for Konfirmasi Jaga. Paths: `users/{uid}/jaga/{id}`.
 *
 * ROSTERS are stored as a JSON STRING, not as Firestore maps. A string
 * accepts whatever the parser produces (nulls, a nested array a future parser
 * might add) without any of Firestore's type rules applying. The roster is
 * only ever read and written whole, so nothing is lost by not being able to
 * query inside it.
 *
 * STATE is one document of maps, written ONE KEY AT A TIME with `mergeFields`.
 * This is not `merge: true`: that deep-merges, so a tukar jaga replaced with
 * one lacking `initials` would keep the old initials. And not a read, modify,
 * write of the whole document: two quick ticks would lose one (recurring
 * pattern 5). `mergeFields` replaces exactly the named path and creates the
 * document if it does not exist yet.
 */

const STATE_ID = 'state';

export function putJagaRoster(uid: string, kind: JagaRosterKind, value: unknown): Promise<void> {
  const importedAt =
    value && typeof value === 'object' && 'importedAt' in value
      ? String((value as { importedAt: unknown }).importedAt)
      : null;
  return trackWrite(
    setDoc(jagaDoc(uid, kind), {
      json: JSON.stringify(value),
      importedAt,
      savedAt: serverTimestamp(),
      savedBy: getDeviceId(),
    }),
  );
}

// `updatedAt` rides along with every state write; it is listed in
// `mergeFields` above, so it has to be present in the data.
const withStamp = <T extends object>(data: T): T & { updatedAt: ReturnType<typeof serverTimestamp> } => ({
  ...data,
  updatedAt: serverTimestamp(),
});

export function putJagaState(
  uid: string,
  field: JagaStateField,
  key: string | null,
  value: unknown,
): Promise<void> {
  const stored = value === null || value === undefined ? deleteField() : toStorable(value);
  const path = key === null ? new FieldPath(field) : new FieldPath(field, key);
  const data = key === null ? { [field]: stored } : { [field]: { [key]: stored } };
  return trackWrite(
    setDoc(jagaDoc(uid, STATE_ID), withStamp(data), { mergeFields: [path, 'updatedAt'] }).catch(
      (error: unknown) => {
        console.error('[jaga] state write rejected', error);
      },
    ),
  );
}

export interface JagaSnapshot {
  /** Only kinds that exist in the account. A missing kind is not "empty". */
  rosters: Partial<Record<JagaRosterKind, unknown>>;
  state: JagaState | null;
  /** True once the server has answered; false for a cache-only snapshot. */
  confirmed: boolean;
}

/**
 * One listener for all five documents.
 *
 * `includeMetadataChanges` so the caller learns when a snapshot stops being
 * cache-only. On a device's first sync the cache is EMPTY, and treating that
 * first snapshot as "the account has nothing" would upload this device's old
 * rosters over newer ones.
 */
export function subscribeJaga(
  uid: string,
  onChange: (snapshot: JagaSnapshot) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    jagaCol(uid),
    { includeMetadataChanges: true },
    (snapshot) => {
      const rosters: JagaSnapshot['rosters'] = {};
      let state: JagaState | null = null;
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (docSnap.id === STATE_ID) {
          const { updatedAt: _stamp, ...rest } = data;
          state = rest as JagaState;
          continue;
        }
        if (!(JAGA_ROSTER_KINDS as readonly string[]).includes(docSnap.id)) continue;
        if (typeof data.json !== 'string') continue;
        try {
          rosters[docSnap.id as JagaRosterKind] = JSON.parse(data.json) as unknown;
        } catch (error) {
          // A document this build cannot read is skipped, not applied as
          // empty: the local copy is still good.
          console.error('[jaga] unreadable roster in account', docSnap.id, error);
        }
      }
      onChange({ rosters, state, confirmed: !snapshot.metadata.fromCache });
    },
    onError,
  );
}
