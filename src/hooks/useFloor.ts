import { useEffect, useMemo, useState } from 'react';

import { subscribeDays, subscribeInvites, subscribeMyFloors } from '@/data/repositories/floors.repo';
import { LOOKBACK_DAYS, previousDates, type FloorDay, type FloorDoc } from '@/domain/floorList/floor';
import { useSession } from '@/store/useSession';

export type LoadState = 'loading' | 'ready' | 'error';

/** The floors I am in, and the ones that invited my email (12.8). */
export function useMyFloors(): { floors: FloorDoc[]; invites: FloorDoc[]; state: LoadState; error: string } {
  const uid = useSession((s) => s.user?.uid ?? null);
  const email = useSession((s) => s.user?.email ?? null);
  const [floors, setFloors] = useState<FloorDoc[]>([]);
  const [invites, setInvites] = useState<FloorDoc[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) return undefined;
    const fail = (e: Error): void => {
      console.error('[floors]', e);
      setError(e.message);
      setState('error');
    };
    const offFloors = subscribeMyFloors(
      uid,
      (list) => {
        setFloors(list.sort((a, b) => a.name.localeCompare(b.name)));
        setState('ready');
      },
      fail,
    );
    const offInvites = email ? subscribeInvites(email, setInvites, (e) => console.error('[floors] invites', e)) : () => undefined;
    return () => {
      offFloors();
      offInvites();
    };
  }, [uid, email]);

  return { floors, invites, state, error };
}

/** The stored days a list of `date` reads (D-2…D). */
export function useFloorDays(floorId: string | null, date: string): { days: FloorDay[]; state: LoadState } {
  const [days, setDays] = useState<FloorDay[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const dates = useMemo(() => previousDates(date, LOOKBACK_DAYS), [date]);

  useEffect(() => {
    if (!floorId) return undefined;
    setState('loading');
    return subscribeDays(
      floorId,
      dates,
      (list) => {
        setDays(list);
        setState('ready');
      },
      (e) => {
        console.error('[floors] days', e);
        setState('error');
      },
    );
  }, [floorId, dates]);

  return { days, state };
}
