import type { ShiftNote } from '@/domain/types';

/**
 * The day's notes as one row: the morning SOAP, each jaga note by its time,
 * and "+ SOAP jaga".
 *
 * Adding a jaga note used to be: open ⋯, find "Tambah SOAP jaga" among ten
 * actions, get an empty box with the tap's time stamped on it, then switch
 * back through the date rail. At 03.00 that is four places to look for one
 * thing. The row sits directly above the editor, where the note will be
 * written, and switching between the notes of the day is one tap on it.
 */
export function JagaBar({
  notes,
  activeId,
  canAdd,
  onSelect,
  onAdd,
}: {
  notes: readonly ShiftNote[];
  activeId: string | null;
  canAdd: boolean;
  onSelect: (id: string | null) => void;
  onAdd: () => void;
}): JSX.Element | null {
  if (notes.length === 0 && !canAdd) return null;

  const chip = (active: boolean): string =>
    [
      'min-h-tap shrink-0 rounded-full border px-3 text-xs [@media(pointer:fine)]:min-h-8',
      active ? 'border-accent bg-accent font-semibold text-white' : 'border-border text-fg-muted hover:bg-bg-subtle',
    ].join(' ');

  return (
    <div
      role="group"
      aria-label="Catatan hari ini"
      className="mx-4 mt-2 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {notes.length > 0 ? (
        <>
          <button type="button" aria-pressed={activeId === null} onClick={() => onSelect(null)} className={chip(activeId === null)}>
            SOAP hari ini
          </button>
          {notes.map((note) => (
            <button
              key={note.id}
              type="button"
              aria-pressed={activeId === note.id}
              onClick={() => onSelect(note.id)}
              className={chip(activeId === note.id)}
            >
              Jaga {note.time}
            </button>
          ))}
        </>
      ) : null}
      {canAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className="min-h-tap shrink-0 rounded-full border border-dashed border-accent px-3 text-xs font-medium text-accent [@media(pointer:fine)]:min-h-8"
        >
          + SOAP jaga
        </button>
      ) : null}
    </div>
  );
}
