import { useState } from 'react';

import type { ScratchNote } from '@/domain/types';

/**
 * The Catatan shelf as sticky notes.
 *
 * It used to be a row of tabs. A row scrolls sideways, shows one title at a
 * time, and says nothing about what is IN a note — so finding the one you
 * wanted meant opening several. Cards show the first lines of every note at
 * once, which is the whole reason a board of notes beats a list of names.
 *
 * Masonry through CSS columns rather than a grid: notes are different lengths,
 * and a grid pads every card to the tallest in its row. `break-inside` keeps a
 * card whole.
 *
 * A card shows a FEW lines, not the note. At ten lines a long reference note
 * filled a whole column and the board became the notes themselves, stacked —
 * the wall of text the tabs were replacing.
 *
 * Dragging orders the board, and the drop is SHOWN before it happens: an
 * accent line appears on the edge of the card the note will land next to,
 * above or below it depending on which half the pointer is over. The first
 * attempt had no indicator — a card faded, something moved, and you found out
 * afterwards. The second moved ordering into the open note, which is a
 * different screen from the one whose order you are changing.
 *
 * The line is the promise and `moveBeside` keeps it: the note ends up on the
 * side of the target the line was drawn on, whichever direction the drag came
 * from.
 */

type Place = 'before' | 'after';

/**
 * A stable colour per note, derived from its id.
 *
 * Not stored: a colour field would need a picker, a migration and a default,
 * and the job here is only to tell one card from another at a glance. Derived
 * means it never changes for a given note, which is what makes it findable.
 *
 * The palette is the shared card tokens, so it follows the theme and passes
 * `check:contrast`; a raw hex here would fail it, correctly.
 */
const PALETTE = [3, 5, 6, 7, 9, 12, 2, 4] as const;

export function noteTone(id: string): { bg: string; fg: string } {
  let sum = 0;
  for (const char of id) sum = (sum + char.charCodeAt(0)) % 997;
  const step = PALETTE[sum % PALETTE.length] ?? 6;
  return { bg: `var(--card-step-${step}-bg)`, fg: `var(--card-step-${step}-fg)` };
}

/**
 * The note's text without its markup, for the card.
 *
 * Bodies are HTML from a contenteditable. Rendering that into a preview would
 * bring its own headings, list markers and font sizes into a card sized for
 * plain lines — and would render whatever else a pasted fragment carried.
 * Block tags become line breaks so the shape of the note survives.
 */
export function notePreview(body: string): string {
  return body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function NoteCards({
  notes,
  activeId,
  onOpen,
  onMove,
  view = 'kartu',
}: {
  notes: readonly ScratchNote[];
  activeId: string | null;
  onOpen: (id: string) => void;
  /** Put `fromId` immediately before or after `targetId`. */
  onMove: (fromId: string, targetId: string, place: Place) => void;
  /**
   * `kartu` is the board. `daftar` is one note per row, full width, with a
   * single line of preview — for a shelf of twenty where the question is
   * "which one was it" and the titles answer it faster than the colours.
   *
   * Same cards, same drag, same drop line: a list that behaved differently
   * would be a second component to keep in step.
   */
  view?: 'kartu' | 'daftar';
}): JSX.Element {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; place: Place } | null>(null);

  const end = (): void => {
    setDragId(null);
    setOver(null);
  };

  return (
    <div className={view === 'daftar' ? '' : 'columns-1 gap-2 sm:columns-2 lg:columns-3'}>
      {notes.map((note) => {
        const tone = noteTone(note.id);
        const preview = notePreview(note.body);
        const marker = over?.id === note.id ? over.place : null;
        return (
          /*
            8px between cards. It was ~24px: a 12px margin PLUS two 4px strips
            reserved above and below every card for the drop line, which
            existed so the board would not jump when a line appeared. The
            lines now OVERLAY the gap (absolutely positioned inside it), so
            they still cost no layout when they appear — and nothing when
            they do not.
          */
          <div key={note.id} className="relative mb-2 break-inside-avoid">
            {/* The promise: this is where it lands. */}
            {marker === 'before' ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 -top-1.5 h-1 rounded-full bg-accent"
              />
            ) : null}
            <button
              type="button"
              draggable
              onDragStart={(event) => {
                setDragId(note.id);
                // Firefox refuses to start a drag with an empty transfer object.
                event.dataTransfer.setData('text/plain', note.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event) => {
                if (!dragId || dragId === note.id) return;
                event.preventDefault();
                // Which half of the card the pointer is over decides the side,
                // so a drop near the top goes above and near the bottom below.
                const box = event.currentTarget.getBoundingClientRect();
                const place: Place = event.clientY < box.top + box.height / 2 ? 'before' : 'after';
                setOver((current) =>
                  current?.id === note.id && current.place === place
                    ? current
                    : { id: note.id, place },
                );
              }}
              onDragLeave={() => {
                setOver((current) => (current?.id === note.id ? null : current));
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragId && over?.id === note.id) onMove(dragId, note.id, over.place);
                end();
              }}
              onDragEnd={end}
              onClick={() => onOpen(note.id)}
              style={{ backgroundColor: tone.bg, color: tone.fg }}
              className={[
                'block w-full cursor-grab rounded-xl border p-3 text-left shadow-sm',
                note.id === activeId ? 'border-accent' : 'border-transparent',
                dragId === note.id ? 'opacity-40' : '',
              ].join(' ')}
            >
              <span className="block truncate text-sm font-semibold">
                {note.title || 'Tanpa judul'}
              </span>
              {preview ? (
                /*
                  A way in, not the note itself.

                  NO `block` on this span. `line-clamp-4` sets
                  `display:-webkit-box`, and Tailwind emits `.block` AFTER the
                  line-clamp utilities — so a span carrying both got
                  `display:block`, the clamp did nothing, and every card printed
                  its whole note. It shipped twice looking correct in review.
                  `clampClasses.test.ts` fails the build if it comes back.
                */
                <span
                  className={[
                    'mt-1 whitespace-pre-line text-xs leading-snug opacity-80',
                    // One line in the list, four on a card. No `block` here:
                    // see the note above.
                    view === 'daftar' ? 'line-clamp-1' : 'line-clamp-4',
                  ].join(' ')}
                >
                  {preview}
                </span>
              ) : (
                <span className="mt-1 block text-xs italic opacity-60">Kosong</span>
              )}
              {note.archived ? (
                <span className="mt-2 inline-block rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-medium">
                  Arsip
                </span>
              ) : null}
            </button>
            {marker === 'after' ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 -bottom-1.5 h-1 rounded-full bg-accent"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
