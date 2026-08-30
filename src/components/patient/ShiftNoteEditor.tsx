import { useCallback } from 'react';

import type { ShiftNote } from '@/domain/types';

/**
 * Opening height, in pixels.
 *
 * A jaga note is short, but 160 px showed about three lines and made the box
 * read as a single-line field on a laptop — it looked like somewhere to put a
 * sentence, not a finding. Tall enough that the common case needs no growth at
 * all, and it grows past this anyway.
 */
const MIN_HEIGHT = 260;

/**
 * The editor for one jaga note, shown in place of the day's SOAP.
 *
 * Visibly not a SOAP editor. It has a header naming what it is and the time it
 * was opened, a way back to the day, and no format toolbar, no section tinting
 * and no jump bar — because it has no sections. A jaga note is a short free
 * paragraph about one complaint, and giving it the daily note's furniture
 * would invite it to be written like one, which is exactly the confusion the
 * separate document exists to prevent.
 */
export function ShiftNoteEditor({
  note,
  readOnly,
  onChange,
  onBlur,
  onClear,
  onBack,
}: {
  note: ShiftNote;
  readOnly: boolean;
  onChange: (body: string) => void;
  onBlur: () => void;
  onClear: () => void;
  onBack: () => void;
}): JSX.Element {
  /**
   * Height follows the content.
   *
   * `auto` first, or the box can only grow and never shrink back when text is
   * deleted.
   *
   * Called from BOTH the callback ref and `onChange`, and both are needed. The
   * first version wired it to the ref alone, which measures when the element
   * mounts and never again — so the box opened at its minimum and stayed
   * there no matter how much was typed into it. That is the same mistake as
   * the `Catatan pasien` textarea, which was keyed on value and so never ran
   * on mount: one ran only at mount, the other only after it. A growing
   * textarea needs measuring at both.
   */
  const grow = useCallback((node: HTMLTextAreaElement | null) => {
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.max(node.scrollHeight, MIN_HEIGHT)}px`;
  }, []);

  return (
    <section aria-label={`SOAP jaga jam ${note.time}`} className="px-4">
      <div className="mt-2 flex items-center gap-2 rounded-t-lg border border-b-0 border-border bg-bg-subtle px-3 py-1.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Kembali ke SOAP hari ini"
          className="min-h-tap shrink-0 text-xs text-accent"
        >
          ← SOAP hari ini
        </button>
        <span className="min-w-0 flex-1 truncate text-right text-xs font-medium text-fg-muted">
          SOAP jaga · {note.time}
        </span>
        <button
          type="button"
          disabled={readOnly}
          onClick={onClear}
          aria-label={`Hapus SOAP jaga jam ${note.time}`}
          className="min-h-tap min-w-tap shrink-0 text-fg-faint disabled:opacity-40"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <textarea
        ref={grow}
        value={note.body}
        readOnly={readOnly}
        onChange={(event) => {
          onChange(event.target.value);
          grow(event.currentTarget);
        }}
        onBlur={onBlur}
        placeholder="Keluhan saat jaga…"
        className="w-full resize-none overflow-hidden [overflow-wrap:anywhere] rounded-b-lg border border-border bg-surface p-3 text-sm leading-relaxed outline-none placeholder:text-fg-faint"
      />
    </section>
  );
}
