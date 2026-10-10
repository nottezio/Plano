import { onSnapshot, query, serverTimestamp, setDoc, where, type Unsubscribe } from 'firebase/firestore';

import { sensusDayDoc, sensusDaysCol } from '../paths';
import { trackWrite } from '../syncStatus';
import { readSnapshot, snapshotId, type CensusSnapshot } from '@/domain/census/evolution';

/**
 * Firestore access for the Sensus history. Path: `users/{uid}/sensusDays/{CODE~date}`.
 *
 * Only the DPJP's own census for the day is stored — a dozen patients, a few
 * KB — never the pasted ward lists, which stay on the device.
 */

/** Save (or replace) one day's census. Whole-document set: the day is re-taken, not merged. */
export function saveSensusDay(uid: string, snapshot: CensusSnapshot): Promise<void> {
  return trackWrite(
    setDoc(sensusDayDoc(uid, snapshotId(snapshot.code, snapshot.date)), {
      ...snapshot,
      code: snapshot.code.toUpperCase(),
      updatedAt: serverTimestamp(),
    }),
  );
}

/**
 * Every stored day for one DPJP. An equality filter on one field needs no
 * composite index; the dates are sorted on the client (a few dozen days).
 */
export function subscribeSensusDays(
  uid: string,
  code: string,
  callback: (days: CensusSnapshot[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(sensusDaysCol(uid), where('code', '==', code.toUpperCase())),
    (snapshot) =>
      callback(
        snapshot.docs
          .map((entry) => readSnapshot(entry.data()))
          .filter((day): day is CensusSnapshot => day !== null)
          .sort((a, b) => a.date.localeCompare(b.date)),
      ),
    onError,
  );
}
