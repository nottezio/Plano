import type { Timestamp } from 'firebase/firestore';

import type { Patient } from './types';

/**
 * Test-only builders.
 *
 * `Timestamp` is a type-only import, so nothing here pulls the Firebase SDK
 * into a unit-test run: the domain layer must stay testable with no network,
 * no emulator and no initialisation.
 */

function fakeTimestamp(millis: number): Timestamp {
  return {
    toMillis: () => millis,
    toDate: () => new Date(millis),
    seconds: Math.floor(millis / 1000),
    nanoseconds: 0,
  } as unknown as Timestamp;
}

export interface PatientOverrides extends Partial<Omit<Patient, 'updatedAt' | 'createdAt'>> {
  updatedAtMillis?: number;
}

export function makePatient(overrides: PatientOverrides = {}): Patient {
  const { updatedAtMillis, ...rest } = overrides;
  const base: Patient = {
    id: 'p1',
    ownerId: 'u1',
    memberIds: ['u1'],
    name: 'Tn. Budi Santoso',
    diagnoses: [],
    admittedAt: '2026-08-06',
    status: 'active',
    labels: [],
    pinned: false,
    searchBlob: '',
    createdAt: fakeTimestamp(0),
    updatedAt: fakeTimestamp(updatedAtMillis ?? 0),
    updatedBy: 'device-test',
    deletedAt: null,
  };

  const patient = { ...base, ...rest } as Patient;
  if (!patient.searchBlob) patient.searchBlob = buildSearchBlobFor(patient);
  return patient;
}

/** Mirrors patients.repo.buildSearchBlob without importing the repository. */
export function buildSearchBlobFor(patient: Patient): string {
  return [
    patient.name,
    patient.mrn,
    patient.bed,
    patient.ward,
    patient.dpjp,
    ...patient.diagnoses,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase();
}
