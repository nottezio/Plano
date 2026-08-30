import { useCallback } from 'react';

import type { ShiftNote } from '@/domain/types';

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
  const grow = useCallback((node: HTMLTextAreaElement | null) => {
    if (!node) return;
    // `auto` first or the box can only grow, never shrink back. Measured from
    // a callback ref so it runs on mount too, which a value-keyed effect does
    // not — the bug that kept Catatan pasien stuck at three rows.
    node.style.height = 'auto';
    node.style.height = `${Math.max(node.scrollHeight, 160)}px`;
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
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder="Keluhan saat jaga…"
        className="w-full resize-none overflow-hidden [overflow-wrap:anywhere] rounded-b-lg border border-border bg-surface p-3 text-sm leading-relaxed outline-none placeholder:text-fg-faint"
      />
    </section>
  );
}
