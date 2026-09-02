import { collection, doc, type CollectionReference, type DocumentReference } from 'firebase/firestore';
import { db } from './firebase';
import type { ClinicalDate } from '@/domain/types';

/**
 * SPEC 6 — every Firestore path in one file.
 *
 * Patients are TOP-LEVEL with `memberIds` (SPEC 6.1): isolation today, sharing
 * later with zero migration. Nesting them under users/{uid} would have forced
 * an export/re-import the day sharing ships.
 *
 * Entry and checklist doc ids are the clinical date string, which makes the
 * daily "reset" a property of the schema rather than a scheduled job.
 */
export const patientsCol = (): CollectionReference => collection(db(), 'patients');
export const patientDoc = (patientId: string): DocumentReference =>
  doc(db(), 'patients', patientId);

export const entriesCol = (patientId: string): CollectionReference =>
  collection(db(), 'patients', patientId, 'entries');
export const entryDoc = (patientId: string, date: ClinicalDate): DocumentReference =>
  doc(db(), 'patients', patientId, 'entries', date);

export const revisionsCol = (patientId: string, date: ClinicalDate): CollectionReference =>
  collection(db(), 'patients', patientId, 'entries', date, 'revisions');

export const checklistCol = (patientId: string): CollectionReference =>
  collection(db(), 'patients', patientId, 'checklist');
export const checklistDoc = (patientId: string, date: ClinicalDate): DocumentReference =>
  doc(db(), 'patients', patientId, 'checklist', date);

export const userDoc = (uid: string): DocumentReference => doc(db(), 'users', uid);
export const documentsCol = (uid: string): CollectionReference =>
  collection(db(), 'users', uid, 'documents');
export const documentDoc = (uid: string, documentId: string): DocumentReference =>
  doc(db(), 'users', uid, 'documents', documentId);
