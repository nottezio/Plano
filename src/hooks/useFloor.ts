import { useEffect, useState } from 'react';

import { subscribeEditions, subscribeInvites, subscribeMyFloors, subscribeRestorePoints, subscribeRoster } from '@/data/repositories/floors.repo';
import type { Edition, FloorDoc, RosterPatient } from '@/domain/floorList/floor';
import type { RestorePointMeta } from '@/domain/floorList/restore';
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

/** The floor's roster (12.12). */
export function useRoster(floorId: string | null): { roster: RosterPatient[]; state: LoadState } {
  const [roster, setRoster] = useState<RosterPatient[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  useEffect(() => {
    if (!floorId) return undefined;
    setState('loading');
    return subscribeRoster(
      floorId,
      (list) => {
        setRoster(list);
        setState('ready');
      },
      (e) => {
        console.error('[floors] roster', e);
        setState('error');
      },
    );
  }, [floorId]);
  return { roster, state };
}

/** Sent lists, newest first (12.12). */
export function useEditions(floorId: string | null): Edition[] {
  const [editions, setEditions] = useState<Edition[]>([]);
  useEffect(() => {
    if (!floorId) return undefined;
    return subscribeEditions(floorId, setEditions, (e) => console.error('[floors] editions', e));
  }, [floorId]);
  return editions;
}

/** The list's restore points, newest first (2026-10-16). */
export function useRestorePoints(floorId: string | null): RestorePointMeta[] {
  const [points, setPoints] = useState<RestorePointMeta[]>([]);
  useEffect(() => {
    if (!floorId) return undefined;
    return subscribeRestorePoints(floorId, setPoints, (e) => console.error('[floors] restore points', e));
  }, [floorId]);
  return points;
}
