import {
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { nanoid } from 'nanoid';

import { db } from '../firebase';
import { documentDoc, documentsCol } from '../paths';
import { trackWrite } from '../syncStatus';
import { bodyHash } from '@/domain/hash';
import { documentsInCategory } from '@/domain/documentCategories';
import type { AppDocument } from '@/domain/types';

/**
 * SPEC 14 — same editor, same parser, same copy engine as a SOAP page.
 *
 * Not a fixed enum: a category is free text on a document, exactly like a
 * title. These three are offered as a starting point when the list is
 * otherwise empty, via "Tambahkan format bawaan yang belum ada" — a
 * suggestion, not a constraint the rest of the app enforces.
 */
export const DEFAULT_DOCUMENT_CATEGORIES = ['jadwal_poli', 'format', 'lainnya'];

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

/**
 * Rename a category everywhere it appears, in one write.
 *
 * A category exists only as a string repeated across documents — there is no
 * separate category record to edit. Renaming it therefore means updating every
 * document that carries the old string, and that has to be one batch: if it
 * ran document-by-document and failed partway, some documents would show the
 * new name and others the old, which on the filter tabs would silently create
 * a SECOND tab holding the ones that did not make it across.
 *
 * `documents` is passed in rather than queried inside this function, because
 * the caller (the category-management sheet) already has the live list from
 * its subscription — querying again here would be a second read of data
 * already in hand, and would use the state as of the query rather than the
 * state the user was looking at when they pressed rename.
 */
export async function renameDocumentCategory(
  uid: string,
  documents: readonly AppDocument[],
  from: string,
  to: string,
): Promise<void> {
  const target = to.trim();
  if (!target || target === from) return;

  const affected = documentsInCategory(documents, from);
  if (affected.length === 0) return;

  const batch = writeBatch(db());
  for (const doc of affected) {
    batch.update(documentDoc(uid, doc.id), { category: target, updatedAt: serverTimestamp() });
  }
  await trackWrite(batch.commit());
}

/**
 * Reassign every document out of a category, then the category no longer
 * exists — there is nothing else holding it.
 *
 * `into` is a category to move the documents to rather than an unconditional
 * delete, because the alternative is deleting documents to delete a label,
 * which is not what "remove this category" means. Reassigning to the same
 * category the create-document form defaults new documents into keeps this
 * consistent with how an unlabelled document already behaves.
 */
export async function deleteDocumentCategory(
  uid: string,
  documents: readonly AppDocument[],
  category: string,
  into: string,
): Promise<void> {
  return renameDocumentCategory(uid, documents, category, into);
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
