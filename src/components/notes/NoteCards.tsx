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
 * which is the wall of text the tabs were replacing. Four lines is enough to
 * recognise a note and not enough to read it instead of opening it.
 *
 * Cards do not drag. Dragging one card onto another to reorder was a gesture
 * with no visible target and no indication that the drop had moved anything;
 * ordering lives in the open note now, on two buttons that say what they do.
 */

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
}: {
  notes: readonly ScratchNote[];
  activeId: string | null;
  onOpen: (id: string) => void;
}): JSX.Element {
  return (
    <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
      {notes.map((note) => {
        const tone = noteTone(note.id);
        const preview = notePreview(note.body);
        return (
          <button
            key={note.id}
            type="button"
            onClick={() => onOpen(note.id)}
            style={{ backgroundColor: tone.bg, color: tone.fg }}
            className={[
              'mb-3 block w-full break-inside-avoid rounded-xl border p-3 text-left shadow-sm',
              note.id === activeId ? 'border-accent' : 'border-transparent',
            ].join(' ')}
          >
            <span className="block truncate text-sm font-semibold">
              {note.title || 'Tanpa judul'}
            </span>
            {preview ? (
              // A way in, not the note itself.
              <span className="mt-1 line-clamp-4 block whitespace-pre-line text-xs leading-snug opacity-80">
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
        );
      })}
    </div>
  );
}
