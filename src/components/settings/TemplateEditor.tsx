import { useState } from 'react';
import { nanoid } from 'nanoid';

import type { NoteTemplate } from '@/domain/types';

/**
 * SPEC 14 — templates are user data.
 *
 * Editing here is free-form text on purpose. The app has no opinion about what
 * a correct handover looks like: it differs per DPJP, and the resident is the
 * one who gets corrected in the group chat, not the app. Anything typed here is
 * inserted verbatim.
 */
export function TemplateEditor({
  templates,
  onChange,
}: {
  templates: readonly NoteTemplate[];
  onChange: (next: NoteTemplate[]) => void;
}): JSX.Element {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const ordered = [...templates].sort((a, b) => a.order - b.order);

  const update = (id: string, patch: Partial<NoteTemplate>): void => {
    onChange(ordered.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const add = (): void => {
    const id = nanoid(8);
    onChange([
      ...ordered,
      { id, name: 'Format baru', body: '', order: ordered.length + 1 },
    ]);
    setEditingId(id);
  };

  const remove = (id: string): void => {
    onChange(
      ordered
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, order: index + 1 })),
    );
    setConfirmDeleteId(null);
    setEditingId(null);
  };

  const move = (id: string, direction: -1 | 1): void => {
    const index = ordered.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;

    const next = [...ordered];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(target, 0, moved);
    onChange(next.map((item, position) => ({ ...item, order: position + 1 })));
  };

  return (
    <div>
      <ul className="space-y-2">
        {ordered.map((template, index) => (
          <li key={template.id} className="rounded-lg border border-border p-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={template.name}
                onChange={(event) => update(template.id, { name: event.target.value })}
                className="min-h-tap min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm font-medium outline-none focus:border-border"
              />
              <button
                type="button"
                aria-label="Naikkan"
                disabled={index === 0}
                onClick={() => move(template.id, -1)}
                className="min-h-tap min-w-[32px] shrink-0 text-sm disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Turunkan"
                disabled={index === ordered.length - 1}
                onClick={() => move(template.id, 1)}
                className="min-h-tap min-w-[32px] shrink-0 text-sm disabled:opacity-30"
              >
                ↓
              </button>
            </div>

            <div className="mt-1 flex items-center gap-3 px-2 text-xs">
              <button
                type="button"
                onClick={() => setEditingId(editingId === template.id ? null : template.id)}
                className="min-h-tap underline"
              >
                {editingId === template.id ? 'Tutup' : 'Ubah isi'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(template.id)}
                className="min-h-tap text-danger underline"
              >
                Hapus
              </button>
              <span className="text-fg-faint">
                {template.body.trim() ? `${template.body.split('\n').length} baris` : 'Kosong'}
              </span>
            </div>

            {confirmDeleteId === template.id ? (
              <div className="mt-2 flex items-center gap-2 px-2">
                <span className="flex-1 text-xs text-fg-muted">Hapus “{template.name}”?</span>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="min-h-tap rounded-lg border border-border px-3 text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => remove(template.id)}
                  className="min-h-tap rounded-lg border border-danger px-3 text-xs text-danger"
                >
                  Hapus
                </button>
              </div>
            ) : null}

            {editingId === template.id ? (
              <textarea
                value={template.body}
                onChange={(event) => update(template.id, { body: event.target.value })}
                rows={14}
                spellCheck={false}
                className="mt-2 w-full rounded-lg border border-border bg-bg-subtle p-2 font-mono text-xs leading-relaxed outline-none"
              />
            ) : null}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={add}
        className="mt-3 min-h-tap w-full rounded-lg border border-accent px-4 text-sm font-medium text-accent"
      >
        Tambah format
      </button>
    </div>
  );
}
