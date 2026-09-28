import { useEffect, useMemo, useState } from 'react';

import { fetchEntryBodies } from '@/data/repositories/entries.repo';
import type { Patient } from '@/domain/types';

/**
 * The searchable note text of archived patients: every day's SOAP plus the
 * Catatan pasien, loaded only when asked for.
 *
 * The SOAP lives in a subcollection, one document per day, so searching it
 * means reading those documents. That is done ONCE per patient version, on
 * request (the "cari di isi catatan" switch), and kept for the session:
 *
 *  - keyed by `id|updatedAt`, so a discharge summary written after archiving
 *    (the patient doc's `updatedAt` moves with every body write) is picked up,
 *    and an untouched patient is never read twice;
 *  - four patients at a time, so a large archive on ward wifi finishes rather
 *    than timing out half-done;
 *  - `getDocs` is served from the persistent cache offline, so a device that
 *    loaded it once can search it with no signal.
 *
 * The Catatan pasien is on the patient document itself and is always current;
 * it is joined in at read time, not cached.
 */
const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

const versionKey = (patient: Patient): string =>
  `${patient.id}|${patient.updatedAt?.toMillis?.() ?? 0}`;

function loadBodies(patient: Patient): Promise<string> {
  const key = versionKey(patient);
  const hit = cache.get(key);
  if (hit !== undefined) return Promise.resolve(hit);
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = fetchEntryBodies(patient.id)
    .then((entries) => entries.map((entry) => entry.body).join('\n'))
    .catch((error: unknown) => {
      console.error('[archive] note text failed', patient.id, error);
      return '';
    })
    .then((text) => {
      cache.set(key, text);
      inFlight.delete(key);
      return text;
    });
  inFlight.set(key, request);
  return request;
}

export interface ArchiveText {
  /** Note text for a patient while enabled (SOAP only once loaded), else undefined. */
  text: (patient: Patient) => string | undefined;
  loaded: number;
  total: number;
  loading: boolean;
}

export function useArchiveText(patients: readonly Patient[], enabled: boolean): ArchiveText {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const queue = patients.filter((patient) => !cache.has(versionKey(patient)));
    if (queue.length === 0) return;

    const worker = async (): Promise<void> => {
      while (!cancelled) {
        const next = queue.shift();
        if (!next) return;
        await loadBodies(next);
        if (!cancelled) setVersion((current) => current + 1);
      }
    };
    void Promise.all([worker(), worker(), worker(), worker()]);
    return () => {
      cancelled = true;
    };
  }, [patients, enabled]);

  return useMemo(() => {
    void version;
    const loaded = patients.filter((patient) => cache.has(versionKey(patient))).length;
    return {
      // The Catatan pasien is searchable at once; the SOAP joins as it loads.
      text: (patient: Patient) =>
        enabled ? `${patient.notes ?? ''}\n${cache.get(versionKey(patient)) ?? ''}` : undefined,
      loaded,
      total: patients.length,
      loading: enabled && loaded < patients.length,
    };
  }, [patients, enabled, version]);
}
