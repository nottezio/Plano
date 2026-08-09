import { useState } from 'react';

/**
 * A reorderable list of free-text lines.
 *
 * Used for greetings and opening sentences: both are just phrasings the user
 * collects over time, and neither deserves its own bespoke editor.
 */
export function StringListEditor({
  values,
  onChange,
  placeholder,
  multiline = false,
}: {
  values: readonly string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  multiline?: boolean;
}): JSX.Element {
  const [draft, setDraft] = useState('');

  /**
   * Undo, not a confirm dialog.
   *
   * The `×` here deletes instantly, which is right for a list you edit often —
   * a confirm on every removal punishes the common case to guard the rare one.
   * What it needed was a way back. One level, ten seconds, restored to its
   * original position rather than appended.
   */
  const [undo, setUndo] = useState<{ value: string; index: number } | null>(null);

  const update = (index: number, value: string): void => {
    onChange(values.map((item, position) => (position === index ? value : item)));
  };

  const remove = (index: number): void => {
    const removed = values[index];
    if (removed === undefined) return;

    setUndo({ value: removed, index });
    window.setTimeout(
      () => setUndo((current) => (current?.value === removed ? null : current)),
      10_000,
    );
    onChange(values.filter((_, position) => position !== index));
  };

  const restore = (): void => {
    if (!undo) return;
    const next = [...values];
    next.splice(Math.min(undo.index, next.length), 0, undo.value);
    onChange(next);
    setUndo(null);
  };

  const move = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= values.length) return;
    const next = [...values];
    const [moved] = next.splice(index, 1);
    if (moved !== undefined) next.splice(target, 0, moved);
    onChange(next);
  };

  const add = (): void => {
    if (!draft.trim()) return;
    onChange([...values, draft.trim()]);
    setDraft('');
  };

  return (
    <div>
      <ul className="space-y-2">
        {values.map((value, index) => (
          <li key={`${index}-${value.slice(0, 12)}`} className="flex items-start gap-1">
            {multiline ? (
              <textarea
                value={value}
                rows={2}
                onChange={(event) => update(index, event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface p-2 text-xs leading-relaxed outline-none"
              />
            ) : (
              <input
                type="text"
                value={value}
                onChange={(event) => update(index, event.target.value)}
                className="min-h-tap min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm outline-none"
              />
            )}
            <button
              type="button"
              aria-label="Naikkan"
              disabled={index === 0}
              onClick={() => move(index, -1)}
              className="min-h-tap min-w-[32px] shrink-0 text-sm disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Turunkan"
              disabled={index === values.length - 1}
              onClick={() => move(index, 1)}
              className="min-h-tap min-w-[32px] shrink-0 text-sm disabled:opacity-30"
            >
              ↓
            </button>
            <button
              type="button"
              aria-label="Hapus"
              onClick={() => remove(index)}
              className="min-h-tap min-w-[32px] shrink-0 text-sm text-danger"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {undo ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">
            Dihapus: {undo.value}
          </span>
          <button
            type="button"
            onClick={restore}
            className="min-h-tap shrink-0 text-xs font-medium text-accent underline"
          >
            Urungkan
          </button>
        </div>
      ) : null}

      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') add();
          }}
          className="min-h-tap min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm outline-none"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="min-h-tap shrink-0 rounded-lg border border-accent px-4 text-sm font-medium text-accent disabled:opacity-40"
        >
          Tambah
        </button>
      </div>
    </div>
  );
}
