import { useState } from 'react';
import { nanoid } from 'nanoid';

import { COLOR_TOKENS, STEP_TOKENS } from '@/domain/colorTokens';
import {
  addChecklistItem,
  moveChecklistItem,
  normalizeOrders,
  recolorChecklistItem,
  renameChecklistItem,
  setChecklistItemActive,
} from '@/domain/checklist';
import type { ChecklistItemDef } from '@/domain/types';

/**
 * SPEC 15 — the checklist is fully user-editable and N is whatever they choose.
 *
 * Every transform here is a pure function tested since P2; this component only
 * renders and dispatches. Two rules are visible in the UI because they are load
 * -bearing rather than stylistic:
 *
 *  - An item is DISABLED, never removed. Deleting a definition would orphan
 *    every historical tick keyed by its id, and those ids are the only link
 *    between a colour on a card in March and what it meant.
 *  - Renaming keeps the id, so a rename relabels history retroactively instead
 *    of forking it.
 */
export function ChecklistEditor({
  items,
  onChange,
}: {
  items: readonly ChecklistItemDef[];
  onChange: (next: ChecklistItemDef[]) => void;
}): JSX.Element {
  const [newLabel, setNewLabel] = useState('');
  const [paletteFor, setPaletteFor] = useState<string | null>(null);
  const ordered = normalizeOrders(items);

  const add = (): void => {
    if (!newLabel.trim()) return;
    onChange(addChecklistItem(ordered, nanoid(8), newLabel.trim()));
    setNewLabel('');
  };

  return (
    <div>
      <ul className="space-y-2">
        {ordered.map((item, index) => (
          <li
            key={item.id}
            data-color-token={item.colorToken}
            className={[
              'rounded-lg border border-border p-2',
              item.active ? 'bg-token text-token-fg' : 'opacity-60',
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-xs opacity-70">{item.order}</span>

              <input
                type="text"
                value={item.label}
                onChange={(event) =>
                  onChange(renameChecklistItem(ordered, item.id, event.target.value))
                }
                className="min-h-tap min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm outline-none focus:border-border"
              />

              <button
                type="button"
                aria-label="Naikkan"
                disabled={index === 0}
                onClick={() => onChange(moveChecklistItem(ordered, item.id, index - 1))}
                className="min-h-tap min-w-[32px] shrink-0 text-sm disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Turunkan"
                disabled={index === ordered.length - 1}
                onClick={() => onChange(moveChecklistItem(ordered, item.id, index + 1))}
                className="min-h-tap min-w-[32px] shrink-0 text-sm disabled:opacity-30"
              >
                ↓
              </button>
            </div>

            <div className="mt-1 flex items-center gap-2 px-7 text-xs">
              <button
                type="button"
                onClick={() => setPaletteFor(paletteFor === item.id ? null : item.id)}
                className="underline"
              >
                Warna
              </button>
              <button
                type="button"
                onClick={() => onChange(setChecklistItemActive(ordered, item.id, !item.active))}
                className="underline"
              >
                {item.active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
              {!item.active ? (
                <span className="opacity-70">
                  Disembunyikan — riwayat centang tetap tersimpan
                </span>
              ) : null}
            </div>

            {paletteFor === item.id ? (
              <div className="mt-2 flex flex-wrap gap-1.5 px-7">
                {COLOR_TOKENS.filter((token) => STEP_TOKENS.includes(token.id)).map((token) => (
                  <button
                    key={token.id}
                    type="button"
                    aria-label={token.label}
                    data-color-token={token.id}
                    onClick={() => {
                      onChange(recolorChecklistItem(ordered, item.id, token.id));
                      setPaletteFor(null);
                    }}
                    // 28 px dot inside a 44 px target: SPEC 20 is about what a
                    // thumb can hit, not about what the eye sees.
                    className="flex min-h-tap min-w-tap items-center justify-center"
                  >
                    <span
                      aria-hidden="true"
                      className={[
                        'h-7 w-7 rounded-full border-2 bg-token',
                        item.colorToken === token.id ? 'border-fg' : 'border-transparent',
                      ].join(' ')}
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={newLabel}
          placeholder="Langkah baru…"
          onChange={(event) => setNewLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') add();
          }}
          className="min-h-tap min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm outline-none"
        />
        <button
          type="button"
          onClick={add}
          disabled={!newLabel.trim()}
          className="min-h-tap shrink-0 rounded-lg border border-accent px-4 text-sm font-medium text-accent disabled:opacity-40"
        >
          Tambah
        </button>
      </div>

      <p className="mt-2 text-[11px] text-fg-faint">
        {ordered.filter((item) => item.active).length} langkah aktif. Warna kartu di papan
        mengikuti langkah aktif pertama yang belum dicentang.
      </p>
    </div>
  );
}
