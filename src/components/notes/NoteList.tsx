import { useRef, useState } from 'react';

import { IconGrip, IconPin } from '@/components/common/Icons';
import {
  checklistProgress,
  displayTitle,
  noteTone,
  previewText,
  relativeTime,
  type ResolvedNote,
} from '@/domain/notes/scratchNotes';

type Place = 'before' | 'after';

/**
 * The Catatan list: one row per note, pinned first.
 *
 * Replaces the Kartu/Daftar pair. The cards showed four lines of a note but
 * not which ones had open checklist items or when they were last touched,
 * and on a phone they were a single column of large boxes anyway. A row now
 * carries what the cards did — colour, title, the first lines — plus
 * checklist progress and the last edit, in less height.
 *
 * REORDERING — a handle, on pointer events
 *
 * The old drag was the HTML drag-and-drop API, which touch screens do not
 * fire at all, so a phone could never reorder. The grip on each row uses
 * pointer events with `touch-action: none`, so the same gesture works with a
 * finger, a mouse or a pen, and the rest of the row still scrolls normally.
 * The drop line is drawn before the drop, and `orderForMove` puts the note on
 * the side the line was drawn on. Arrow keys on a focused grip move one step.
 */
export function NoteList({
  notes,
  activeId,
  onOpen,
  onMove,
  now,
  reorderable,
  showShelf = false,
}: {
  notes: readonly ResolvedNote[];
  activeId: string | null;
  onOpen: (id: string) => void;
  /** Put `fromId` beside `targetId`, within the same group. */
  onMove: (group: readonly ResolvedNote[], fromId: string, targetId: string, place: Place) => void;
  now: number;
  /** Off for search results and Sampah, whose order is not the user's. */
  reorderable: boolean;
  /** Search results span shelves; label which one each came from. */
  showShelf?: boolean;
}): JSX.Element {
  const pinned = notes.filter((note) => note.pinned);
  const rest = notes.filter((note) => !note.pinned);
  const grouped = reorderable && pinned.length > 0;

  if (!grouped) {
    return (
      <Group
        notes={notes}
        {...{ activeId, onOpen, onMove, now, reorderable, showShelf }}
      />
    );
  }
  return (
    <div className="space-y-3">
      <section>
        <h3 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-fg-faint">
          Disematkan
        </h3>
        <Group notes={pinned} {...{ activeId, onOpen, onMove, now, reorderable, showShelf }} />
      </section>
      {rest.length > 0 ? (
        <section>
          <h3 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-fg-faint">
            Lainnya
          </h3>
          <Group notes={rest} {...{ activeId, onOpen, onMove, now, reorderable, showShelf }} />
        </section>
      ) : null}
    </div>
  );
}

function Group({
  notes,
  activeId,
  onOpen,
  onMove,
  now,
  reorderable,
  showShelf,
}: {
  notes: readonly ResolvedNote[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onMove: (group: readonly ResolvedNote[], fromId: string, targetId: string, place: Place) => void;
  now: number;
  reorderable: boolean;
  showShelf: boolean;
}): JSX.Element {
  const rows = useRef(new Map<string, HTMLElement>());
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; place: Place } | null>(null);

  /** Which row, and which half of it, is under the pointer. */
  const hit = (clientY: number): { id: string; place: Place } | null => {
    for (const note of notes) {
      const element = rows.current.get(note.id);
      if (!element) continue;
      const box = element.getBoundingClientRect();
      if (clientY >= box.top && clientY <= box.bottom) {
        return { id: note.id, place: clientY < box.top + box.height / 2 ? 'before' : 'after' };
      }
    }
    // Past either end of the group: the end row.
    const first = notes[0];
    const last = notes[notes.length - 1];
    const firstBox = first ? rows.current.get(first.id)?.getBoundingClientRect() : undefined;
    if (first && firstBox && clientY < firstBox.top) return { id: first.id, place: 'before' };
    if (last) return { id: last.id, place: 'after' };
    return null;
  };

  const end = (): void => {
    setDragId(null);
    setOver(null);
  };

  return (
    <ul className="space-y-1">
      {notes.map((note, index) => {
        const tone = noteTone(note.id);
        const title = displayTitle(note);
        const preview = previewText(note);
        const progress = checklistProgress(note.body);
        const edited = relativeTime(note.updatedAt, now);
        const marker = dragId && over?.id === note.id && dragId !== note.id ? over.place : null;
        const active = note.id === activeId;

        return (
          <li
            key={note.id}
            ref={(element) => {
              if (element) rows.current.set(note.id, element);
              else rows.current.delete(note.id);
            }}
            className={['relative', dragId === note.id ? 'opacity-40' : ''].join(' ')}
          >
            {marker === 'before' ? <DropLine edge="top" /> : null}
            <div
              className={[
                'flex items-stretch overflow-hidden rounded-xl border transition-colors',
                active ? 'border-accent bg-[var(--accent-soft)]' : 'border-border bg-surface hover:bg-bg-subtle',
              ].join(' ')}
            >
              {/* The note's colour, as an edge rather than a fill: rows stay readable. */}
              <span aria-hidden="true" className="w-1 shrink-0" style={{ backgroundColor: tone.accent }} />
              <button
                type="button"
                onClick={() => onOpen(note.id)}
                aria-current={active ? 'true' : undefined}
                className="min-h-tap min-w-0 flex-1 px-3 py-2 text-left"
              >
                <span className="flex items-center gap-1">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>
                  {note.pinned && !reorderable ? (
                    <IconPin width="14" height="14" className="shrink-0 text-accent" filled />
                  ) : null}
                </span>
                {preview ? (
                  // No `block` beside `line-clamp-*` (pattern 13).
                  <span className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs leading-snug text-fg-muted">
                    {preview}
                  </span>
                ) : null}
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-fg-faint">
                  {progress ? (
                    <span
                      className={progress.done === progress.total ? 'text-accent' : ''}
                      aria-label={`${progress.done} dari ${progress.total} selesai`}
                    >
                      ☑ {progress.done}/{progress.total}
                    </span>
                  ) : null}
                  {edited ? <span>{edited}</span> : null}
                  {showShelf ? <span>{note.category === 'jaga' ? 'Catatan jaga' : 'Catatan'}</span> : null}
                  {note.archived ? (
                    <span className="rounded bg-bg-subtle px-1 font-medium">Arsip</span>
                  ) : null}
                </span>
              </button>
              {reorderable && notes.length > 1 ? (
                <button
                  type="button"
                  aria-label={`Pindahkan ${title}`}
                  title="Seret untuk memindah (atau panah atas/bawah)"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDragId(note.id);
                  }}
                  onPointerMove={(event) => {
                    if (dragId !== note.id) return;
                    const next = hit(event.clientY);
                    setOver((current) =>
                      current?.id === next?.id && current?.place === next?.place ? current : next,
                    );
                  }}
                  onPointerUp={() => {
                    if (dragId === note.id && over && over.id !== note.id) {
                      onMove(notes, note.id, over.id, over.place);
                    }
                    end();
                  }}
                  onPointerCancel={end}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp' && index > 0) {
                      event.preventDefault();
                      onMove(notes, note.id, notes[index - 1]!.id, 'before');
                    } else if (event.key === 'ArrowDown' && index < notes.length - 1) {
                      event.preventDefault();
                      onMove(notes, note.id, notes[index + 1]!.id, 'after');
                    }
                  }}
                  className="flex min-h-tap w-9 shrink-0 cursor-grab touch-none items-center justify-center text-fg-faint hover:text-fg-muted active:cursor-grabbing"
                >
                  <IconGrip width="16" height="16" />
                </button>
              ) : null}
            </div>
            {marker === 'after' ? <DropLine edge="bottom" /> : null}
          </li>
        );
      })}
    </ul>
  );
}

function DropLine({ edge }: { edge: 'top' | 'bottom' }): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={[
        'pointer-events-none absolute inset-x-0 z-10 h-1 rounded-full bg-accent',
        edge === 'top' ? '-top-1' : '-bottom-1',
      ].join(' ')}
    />
  );
}
