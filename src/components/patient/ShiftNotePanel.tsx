import { useCallback } from 'react';

import type { ShiftNotesState } from '@/hooks/useShiftNotes';

/**
 * Shift notes for the day, below the SOAP.
 *
 * Renders NOTHING when there are none. A permanently visible empty panel would
 * cost a row on every patient on every round to serve the few days that have a
 * jaga complaint; the way to get one is the button, which lives in the note's
 * action menu.
 *
 * Each box is its own field on the entry, not text inside the body. See the
 * comment on `ShiftNote` in types.ts for why appending into the body would
 * merge the 21.40 complaint into the morning one on the way to the chief.
 */
export function ShiftNotePanel({
  state,
  readOnly,
}: {
  state: ShiftNotesState;
  readOnly: boolean;
}): JSX.Element | null {
  const grow = useCallback((node: HTMLTextAreaElement | null) => {
    if (!node) return;
    // `auto` first, or the box can only ever grow. Measured from a callback
    // ref so it also runs on mount, which a value-keyed effect does not.
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  }, []);

  if (state.notes.length === 0) return null;

  return (
    <section className="mt-3 border-t border-border pt-3" aria-label="SOAP jaga">
      <h3 className="px-4 text-xs font-semibold text-fg-muted">SOAP jaga</h3>

      <div className="mt-1 space-y-2 px-4">
        {state.notes.map((note) => (
          <div key={note.id} className="rounded-lg border border-border bg-surface">
            <div className="flex items-center gap-2 border-b border-border px-3 py-1">
              <span className="flex-1 text-xs font-medium text-fg-muted">
                Jam {note.time}
              </span>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => state.clear(note.id)}
                aria-label={`Hapus SOAP jaga jam ${note.time}`}
                title="Hapus SOAP jaga ini"
                className="min-h-tap min-w-tap shrink-0 text-fg-faint disabled:opacity-40"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <textarea
              ref={grow}
              value={note.body}
              readOnly={readOnly}
              onChange={(event) => state.setBody(note.id, event.target.value)}
              // Written on blur, like the body editor. A whole-array field
              // written per keystroke is a document write per character.
              onBlur={state.flush}
              rows={3}
              placeholder="Keluhan saat jaga…"
              className="w-full resize-none overflow-hidden [overflow-wrap:anywhere] bg-transparent p-3 text-sm leading-relaxed outline-none placeholder:text-fg-faint"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
