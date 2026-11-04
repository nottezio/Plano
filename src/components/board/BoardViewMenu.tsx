import { useEffect, useRef, useState } from 'react';

import type { BoardOrder } from '@/domain/board';
import { BOARD_LAYOUTS, type BoardLayout } from '@/domain/boardLayout';

export const BOARD_ORDERS: ReadonlyArray<{ id: BoardOrder; label: string; hint?: string }> = [
  { id: 'recent', label: 'Terbaru' },
  { id: 'visite', label: 'Urutan visite', hint: 'Mengikuti rute bangsal' },
  { id: 'dpjp', label: 'Per DPJP' },
  { id: 'status', label: 'Status hari ini', hint: 'Yang belum selesai di atas' },
  { id: 'custom', label: 'Urutan sendiri', hint: 'Kanvas bebas, kartu diseret' },
  { id: 'location', label: 'Denah', hint: 'Peta kamar, tanpa kartu' },
];

function Choice({
  on,
  label,
  hint,
  onSelect,
}: {
  on: boolean;
  label: string;
  hint?: string | undefined;
  onSelect: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onSelect}
      className={[
        'flex min-h-tap w-full items-center gap-2 rounded-lg px-2.5 py-1 text-left hover:bg-bg-subtle [@media(pointer:fine)]:min-h-9',
        on ? 'bg-[var(--accent-soft)]' : '',
      ].join(' ')}
    >
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${on ? 'font-semibold text-accent' : 'font-medium text-fg'}`}>{label}</span>
        {hint ? <span className="block text-xs text-fg-muted">{hint}</span> : null}
      </span>
      {on ? (
        <span aria-hidden="true" className="shrink-0 text-sm font-bold text-accent">
          ✓
        </span>
      ) : null}
    </button>
  );
}

/**
 * The one place that decides how patients are shown on a wide screen: which
 * layout and in what order. Both used to live apart (a dropdown here, a section
 * in Pengaturan, a Normal/Ringkas button), and nobody could tell which won.
 *
 * Stays open after a choice: the two questions are often answered together, and
 * the board behind it is the feedback.
 */
export function BoardViewMenu({
  layout,
  order,
  onLayout,
  onOrder,
}: {
  layout: BoardLayout;
  order: BoardOrder;
  onLayout: (next: BoardLayout) => void;
  onOrder: (next: BoardOrder) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const layoutLabel = BOARD_LAYOUTS.find((entry) => entry.id === layout)?.label;
  const orderLabel = BOARD_ORDERS.find((entry) => entry.id === order)?.label;
  // Denah draws no cards, so naming a card layout beside it would claim something untrue.
  const summary = order === 'location' ? orderLabel : `${layoutLabel} · ${orderLabel}`;

  return (
    <span ref={rootRef} className="relative min-w-0 shrink">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-tap w-full max-w-sm items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs text-fg-muted hover:border-border-strong [@media(pointer:fine)]:min-h-9"
      >
        <span className="shrink-0">Tampilan</span>
        <span className="min-w-0 truncate font-semibold text-fg">{summary}</span>
        <span aria-hidden="true" className="shrink-0 text-[11px]">
          ▾
        </span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-[80vh] w-[300px] max-w-[calc(100vw-2rem)] space-y-2 overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface p-1.5 shadow-pop">
          <div role="radiogroup" aria-labelledby="board-view-layout">
            <p id="board-view-layout" className="px-2.5 pb-1 pt-1 text-xs font-semibold text-fg-muted">
              Tata letak
            </p>
            {BOARD_LAYOUTS.map((entry) => (
              <Choice
                key={entry.id}
                on={layout === entry.id}
                label={entry.label}
                hint={entry.hint}
                onSelect={() => onLayout(entry.id)}
              />
            ))}
          </div>
          <div role="radiogroup" aria-labelledby="board-view-order" className="border-t border-border pt-1">
            <p id="board-view-order" className="px-2.5 pb-1 pt-1 text-xs font-semibold text-fg-muted">
              Urutan
            </p>
            {/* Rows have no hand-placed position to honour. */}
            {BOARD_ORDERS.filter((entry) => layout !== 'baris' || entry.id !== 'custom').map((entry) => (
              <Choice
                key={entry.id}
                on={order === entry.id}
                label={entry.label}
                hint={entry.hint}
                onSelect={() => onOrder(entry.id)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </span>
  );
}
