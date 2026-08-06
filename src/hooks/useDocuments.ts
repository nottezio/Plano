import { useEffect, useState } from 'react';

import {
  subscribeDocument,
  subscribeDocuments,
  writeDocumentBody,
} from '@/data/repositories/documents.repo';
import { useTextSync, type TextSyncState } from './useTextSync';
import { useSession } from '@/store/useSession';
import type { AppDocument } from '@/domain/types';

export function useDocumentList(): { documents: AppDocument[]; loading: boolean } {
  const uid = useSession((state) => state.user?.uid ?? null);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    return subscribeDocuments(
      uid,
      (next) => {
        setDocuments(next);
        setLoading(false);
      },
      (error) => {
        console.error('[documents] query failed', error);
        setLoading(false);
      },
    );
  }, [uid]);

  return { documents, loading };
}

export function useDocument(documentId: string | undefined): {
  document: AppDocument | null;
  loading: boolean;
} {
  const uid = useSession((state) => state.user?.uid ?? null);
  const [document, setDocument] = useState<AppDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !documentId) return;
    return subscribeDocument(
      uid,
      documentId,
      (next) => {
        setDocument(next);
        setLoading(false);
      },
      (error) => {
        console.error('[documents] subscription failed', error);
        setLoading(false);
      },
    );
  }, [uid, documentId]);

  return { document, loading };
}

/**
 * SPEC F8 — a document body gets exactly the same durability as a SOAP body.
 *
 * Same debounce, same force-flush triggers, same three-way merge. Documents
 * have no revision trail (they are reference material, not a clinical record),
 * so `snapshot` is omitted — which is the only difference, and it is explicit
 * rather than accidental.
 */
export function useDocumentEditor(
  documentId: string | undefined,
  document: AppDocument | null,
): TextSyncState {
  const uid = useSession((state) => state.user?.uid ?? null);

  return useTextSync({
    key: `doc|${documentId ?? 'none'}`,
    serverText: document?.body ?? '',
    locked: !uid || !documentId,
    write: (body) =>
      uid && documentId ? writeDocumentBody(uid, documentId, body) : Promise.resolve(),
  });
}
