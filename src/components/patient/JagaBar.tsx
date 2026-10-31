import { isVersion, noteLabel } from '@/domain/shiftNotes';
import type { ShiftNote } from '@/domain/types';

/**
 * The day's notes as one row: the morning SOAP, each version and jaga note by
 * its name, then "+ Versi" and "+ SOAP jaga".
 *
 * A version is a copy of the day's SOAP made for one reader; a jaga note is a
 * shift review. Both are second notes on the same day, so they share this row
 * and the editor slot below it.
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
  onAddVersion,
}: {
  notes: readonly ShiftNote[];
  activeId: string | null;
  canAdd: boolean;
  onSelect: (id: string | null) => void;
  onAdd: () => void;
  /** Absent while the day's SOAP is empty: there is nothing to make a version of. */
  onAddVersion?: (() => void) | undefined;
}): JSX.Element | null {
  if (notes.length === 0 && !canAdd) return null;
  /*
    Below `sm` the add buttons live at the end of the date strip instead
    (`JagaAddButtons`, 2026-10-31): on a phone this row cost 50 px above the
    note and usually held nothing else. It stays for the day's note list.
  */

  const chip = (active: boolean): string =>
    [
      'min-h-tap shrink-0 rounded-full border px-3 text-xs [@media(pointer:fine)]:min-h-8',
      active ? 'border-accent bg-accent font-semibold text-on-accent' : 'border-border text-fg-muted hover:bg-bg-subtle',
    ].join(' ');

  return (
    <div
      role="group"
      aria-label="Catatan hari ini"
      className={`mx-4 mt-2 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${notes.length > 0 ? 'flex' : 'hidden sm:flex'}`}
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
              className={`${chip(activeId === note.id)} max-w-[12rem] truncate`}
              title={isVersion(note) ? 'Versi SOAP' : `SOAP jaga ${note.time}`}
            >
              {noteLabel(note)}
            </button>
          ))}
        </>
      ) : null}
      {canAdd && onAddVersion ? (
        <button
          type="button"
          onClick={onAddVersion}
          title="Salinan SOAP hari ini untuk diedit tanpa mengubah aslinya"
          className={`hidden sm:inline-block ${ADD_CHIP}`}
        >
          + Versi
        </button>
      ) : null}
      {canAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className={`hidden sm:inline-block ${ADD_CHIP}`}
        >
          + SOAP jaga
        </button>
      ) : null}
    </div>
  );
}

const ADD_CHIP =
  'min-h-tap shrink-0 whitespace-nowrap rounded-full border border-dashed border-accent px-3 text-xs font-medium text-accent [@media(pointer:fine)]:min-h-8';

/** The same two add buttons, for the end of the phone date strip. */
export function JagaAddButtons({
  canAdd,
  onAdd,
  onAddVersion,
}: {
  canAdd: boolean;
  onAdd: () => void;
  onAddVersion?: (() => void) | undefined;
}): JSX.Element | null {
  if (!canAdd) return null;
  return (
    <>
      {onAddVersion ? (
        <button
          type="button"
          onClick={onAddVersion}
          title="Salinan SOAP hari ini untuk diedit tanpa mengubah aslinya"
          className={ADD_CHIP}
        >
          + Versi
        </button>
      ) : null}
      <button type="button" onClick={onAdd} className={ADD_CHIP}>
        + SOAP jaga
      </button>
    </>
  );
}
