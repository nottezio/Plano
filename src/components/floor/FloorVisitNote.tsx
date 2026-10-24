import { useCallback, useEffect, useState } from 'react';

import { Callout } from '@/components/common/ui';
import { NoteBodyView, useNoteBody } from '@/components/notes/NoteBody';
import { subscribeVisitNote, writeVisitNote } from '@/data/repositories/floors.repo';

/**
 * Catatan Visite (24 Oct 2026): one note per list, shared with its members.
 * Edit members write; viewers read (the rules agree). Same editor and merge
 * as Catatan, so two list makers typing at once lose nothing.
 */
export function FloorVisitNote({ floorId, uid, editable }: { floorId: string; uid: string | null; editable: boolean }): JSX.Element {
  const [note, setNote] = useState<{ body: string } | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    return subscribeVisitNote(
      floorId,
      (next) => {
        setFailed(false);
        setNote(next);
      },
      (error) => {
        // Usually permission: removed from the list meanwhile. Never "Memuat…" forever.
        console.error('[catatan visite] read failed', error.name);
        setFailed(true);
      },
    );
  }, [floorId]);
  if (failed) {
    return (
      <div className="p-3">
        <Callout tone="warn">Catatan Visite tidak bisa dibuka. Mungkin Anda sudah tidak menjadi anggota list ini, atau koneksi terputus.</Callout>
      </div>
    );
  }
  if (note === undefined) return <p className="p-4 text-xs text-fg-faint">Memuat…</p>;
  // Mounted once the first snapshot is in, so the editor starts from the stored text.
  return <VisitNoteBody key={floorId} floorId={floorId} uid={uid} editable={editable} serverText={note?.body ?? ''} />;
}

function VisitNoteBody({
  floorId,
  uid,
  editable,
  serverText,
}: {
  floorId: string;
  uid: string | null;
  editable: boolean;
  serverText: string;
}): JSX.Element {
  const write = useCallback((body: string) => (uid ? writeVisitNote(floorId, body, uid) : Promise.resolve()), [floorId, uid]);
  const { editor, sync, editable: canWrite } = useNoteBody({
    syncKey: `floorVisit|${floorId}`,
    serverText,
    write,
    locked: !editable || uid === null,
    ariaLabel: 'Isi Catatan Visite',
  });
  return (
    <div className="flex min-h-full flex-col">
      <NoteBodyView
        editor={editor}
        sync={sync}
        editable={canWrite}
        notice={<p className="mx-3 mt-2 rounded-lg bg-bg-subtle px-3 py-2 text-xs text-fg-muted">Kamu hanya bisa melihat catatan ini. Yang bisa mengubahnya: pembuat list dan anggota dengan izin edit.</p>}
      />
    </div>
  );
}
