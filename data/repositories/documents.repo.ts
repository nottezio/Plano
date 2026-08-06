import {
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { nanoid } from 'nanoid';

import { documentDoc, documentsCol } from '../paths';
import { trackWrite } from '../syncStatus';
import { bodyHash } from '@/domain/hash';
import type { AppDocument } from '@/domain/types';

/** SPEC 14 — same editor, same parser, same copy engine as a SOAP page. */
export const DEFAULT_DOCUMENT_CATEGORIES = ['jadwal_poli', 'format', 'lainnya'] as const;

export function createDocument(
  uid: string,
  input: { title: string; category: string; body?: string },
): { id: string; written: Promise<void> } {
  const id = nanoid(12);
  const body = input.body ?? '';
  const record: DocumentData = {
    id,
    title: input.title.trim(),
    category: input.category,
    body,
    bodyHash: bodyHash(body),
    pinned: false,
    order: Date.now(),
    labels: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  };
  return { id, written: trackWrite(setDoc(documentDoc(uid, id), record)) };
}

export function writeDocumentBody(uid: string, documentId: string, body: string): Promise<void> {
  return trackWrite(
    updateDoc(documentDoc(uid, documentId), {
      body,
      bodyHash: bodyHash(body),
      updatedAt: serverTimestamp(),
    }),
  );
}

export function updateDocument(
  uid: string,
  documentId: string,
  patch: Partial<Pick<AppDocument, 'title' | 'category' | 'pinned' | 'order' | 'labels'>>,
): Promise<void> {
  return trackWrite(
    updateDoc(documentDoc(uid, documentId), { ...patch, updatedAt: serverTimestamp() }),
  );
}

export function softDeleteDocument(uid: string, documentId: string): Promise<void> {
  return trackWrite(
    updateDoc(documentDoc(uid, documentId), {
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
}

export function subscribeDocument(
  uid: string,
  documentId: string,
  callback: (document: AppDocument | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    documentDoc(uid, documentId),
    (snapshot) => callback(snapshot.exists() ? (snapshot.data() as AppDocument) : null),
    onError,
  );
}

export function subscribeDocuments(
  uid: string,
  callback: (documents: AppDocument[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(documentsCol(uid), where('deletedAt', '==', null), orderBy('pinned', 'desc'), orderBy('order', 'desc')),
    (snapshot) => callback(snapshot.docs.map((entry) => entry.data() as AppDocument)),
    onError,
  );
}
