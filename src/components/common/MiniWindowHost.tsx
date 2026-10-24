import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

import { useViewerOnly } from '@/components/auth/viewerOnly';
import { canEdit } from '@/domain/floorList/floor';
import { resolveNotes } from '@/domain/notes/scratchNotes';
import { useMyFloors } from '@/hooks/useFloor';
import { useMiniWindow } from '@/store/useMiniWindow';
import { useSession } from '@/store/useSession';

// Lazy, as on the Catatan page: TipTap stays out of the main bundle.
const NoteEditor = lazy(() => import('@/components/notes/NoteEditor').then((m) => ({ default: m.NoteEditor })));
const FloorVisitNote = lazy(() => import('@/components/floor/FloorVisitNote').then((m) => ({ default: m.FloorVisitNote })));

/**
 * The small window's content, rendered at the app root (24 Oct 2026) so it
 * outlives whichever page opened it (`store/useMiniWindow`).
 */
export function MiniWindowHost(): JSX.Element | null {
  const { target, win } = useMiniWindow();
  const uid = useSession((s) => s.user?.uid ?? null);
  const profile = useSession((s) => s.profile);
  const navigate = useNavigate();
  const notes = useMemo(() => resolveNotes(profile), [profile]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!target || !win) return null;
  const note = target.kind === 'scratch' ? notes.find((n) => n.id === target.id) ?? null : null;
  if (target.kind === 'scratch' && !note) return null;

  return createPortal(
    <div className="flex h-screen flex-col overflow-auto bg-bg text-fg">
      <Suspense fallback={<p className="p-4 text-xs text-fg-faint">Memuat…</p>}>
        {note ? (
          <NoteEditor
            key={note.id}
            uid={uid}
            note={note}
            now={now}
            // The note's menu opens in the main window, on this note.
            onMenu={() => {
              window.focus();
              navigate(`/catatan?n=${encodeURIComponent(note.id)}`);
            }}
          />
        ) : target.kind === 'floor' ? (
          <FloorWindow key={target.floorId} floorId={target.floorId} uid={uid} />
        ) : null}
      </Suspense>
    </div>,
    win.document.body,
  );
}

/**
 * Who may edit is read live, the way List Maker reads it, not fixed when the
 * window opened: a member switched to "Lihat saja" (or removed) meanwhile gets
 * a read-only note, instead of typing text the rules then refuse.
 */
function FloorWindow({ floorId, uid }: { floorId: string; uid: string | null }): JSX.Element {
  const { floors } = useMyFloors();
  const viewer = useViewerOnly();
  const floor = floors.find((f) => f.id === floorId);
  const editable = floor && !viewer ? canEdit(floor, uid) : false;
  return <FloorVisitNote floorId={floorId} uid={uid} editable={editable} />;
}
