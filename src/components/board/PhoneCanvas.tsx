import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import type { BoardCard } from '@/domain/board';
import {
  compactGrid,
  gridRows,
  moveBlock,
  placeGrid,
  type Cell,
  type PhoneGrid,
} from '@/domain/board/phoneGrid';
import { NotePopover } from './NotePopover';

const CELL_H = 78;
const GAP = 8;

export interface PhoneSticky {
  id: string;
  text: string;
}

/**
 * The canvas on a phone: a grid of small blocks you arrange by dragging.
 *
 * Two modes, because a finger on a block can mean "open this patient" or
 * "move this block", and guessing between them by timing is how a scroll
 * becomes a drag by accident:
 *
 *  - Normal: a tap opens the patient, a long press opens the quick sheet
 *    (checklist and reminders), and the page scrolls as usual.
 *  - Atur: blocks follow the finger and drop into a cell; dropping on another
 *    block swaps the two. Empty cells are outlined and two spare rows are
 *    added below, so a block can be put anywhere. "Rapikan" packs the gaps.
 *
 * See `domain/board/phoneGrid` for the model.
 */
export function PhoneCanvas({
  ids,
  cards,
  stickies,
  grid,
  onChange,
  onLongPress,
}: {
  /** Patients and sticky notes, in board order (the order new blocks fill in). */
  ids: readonly string[];
  cards: ReadonlyMap<string, BoardCard>;
  stickies: ReadonlyMap<string, PhoneSticky>;
  grid: PhoneGrid;
  onChange: (next: PhoneGrid, columns: number) => void;
  onLongPress: (patientId: string) => void;
}): JSX.Element {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [editing, setEditing] = useState(false);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; target: Cell } | null>(null);

  useLayoutEffect(() => {
    const node = surfaceRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    setWidth(node.clientWidth);
    return () => observer.disconnect();
  }, []);

  const columns = width >= 640 ? 5 : width >= 480 ? 4 : 3;
  const cellW = width > 0 ? (width - GAP * (columns - 1)) / columns : 110;
  const placed = useMemo(() => placeGrid(ids, grid, columns), [ids, grid, columns]);
  const rows = Math.max(1, gridRows(placed)) + (editing ? 2 : 0);

  const cellAt = (clientX: number, clientY: number): Cell => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return { c: 0, r: 0 };
    const c = Math.floor((clientX - rect.left + GAP / 2) / (cellW + GAP));
    const r = Math.floor((clientY - rect.top + GAP / 2) / (CELL_H + GAP));
    return { c: Math.min(columns - 1, Math.max(0, c)), r: Math.min(rows - 1, Math.max(0, r)) };
  };

  // Scroll the page while a block is held near the top or bottom edge.
  const scroller = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!drag) return undefined;
    const main = document.getElementById('main');
    const tick = (): void => {
      if (main) {
        const rect = main.getBoundingClientRect();
        if (drag.y < rect.top + 70) main.scrollTop -= 12;
        else if (drag.y > rect.bottom - 90) main.scrollTop += 12;
      }
      scroller.current = requestAnimationFrame(tick);
    };
    scroller.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(scroller.current ?? 0);
  }, [drag]);

  const startDrag = (event: React.PointerEvent, id: string): void => {
    if (!editing) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setDrag({ id, x: event.clientX, y: event.clientY, target: cellAt(event.clientX, event.clientY) });
  };
  const moveDrag = (event: React.PointerEvent): void => {
    if (!drag) return;
    setDrag({ ...drag, x: event.clientX, y: event.clientY, target: cellAt(event.clientX, event.clientY) });
  };
  const endDrag = (): void => {
    if (!drag) return;
    onChange(moveBlock(placed, drag.id, drag.target), columns);
    setDrag(null);
  };

  return (
    <div className="px-4 pb-4">
      <div className="mb-2 flex items-center gap-2">
        <p className="min-w-0 flex-1 text-[11px] text-fg-muted">
          {editing ? 'Seret blok ke kotak lain. Blok yang ditimpa bertukar tempat.' : 'Ketuk untuk membuka, tekan lama untuk checklist.'}
        </p>
        {editing ? (
          <button
            type="button"
            onClick={() => onChange(compactGrid(placed, columns), columns)}
            className="min-h-tap rounded-lg border border-border bg-surface px-3 text-xs"
          >
            Rapikan
          </button>
        ) : null}
        <button
          type="button"
          aria-pressed={editing}
          onClick={() => setEditing((current) => !current)}
          className={[
            'min-h-tap rounded-lg border px-3 text-xs font-semibold',
            editing ? 'border-accent bg-accent text-white' : 'border-border bg-surface text-fg',
          ].join(' ')}
        >
          {editing ? 'Selesai' : 'Atur'}
        </button>
      </div>

      <div
        ref={surfaceRef}
        className="relative"
        style={{ height: rows * CELL_H + (rows - 1) * GAP }}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={() => setDrag(null)}
      >
        {editing
          ? Array.from({ length: rows * columns }, (_, index) => {
              const c = index % columns;
              const r = Math.floor(index / columns);
              const target = drag && drag.target.c === c && drag.target.r === r;
              return (
                <div
                  key={`cell-${index}`}
                  aria-hidden="true"
                  className={[
                    'absolute rounded-lg border border-dashed',
                    target ? 'border-accent bg-[var(--accent-soft)]' : 'border-border',
                  ].join(' ')}
                  style={{ left: c * (cellW + GAP), top: r * (CELL_H + GAP), width: cellW, height: CELL_H }}
                />
              );
            })
          : null}

        {ids.map((id) => {
          const cell = placed[id];
          if (!cell) return null;
          const held = drag?.id === id;
          const rect = surfaceRef.current?.getBoundingClientRect();
          const style: React.CSSProperties =
            held && rect
              ? {
                  left: drag.x - rect.left - cellW / 2,
                  top: drag.y - rect.top - CELL_H / 2,
                  width: cellW,
                  height: CELL_H,
                  zIndex: 20,
                  transform: 'scale(1.05)',
                }
              : {
                  left: cell.c * (cellW + GAP),
                  top: cell.r * (CELL_H + GAP),
                  width: cellW,
                  height: CELL_H,
                  transition: 'left 150ms ease, top 150ms ease',
                };
          const card = cards.get(id);
          const sticky = stickies.get(id);
          return (
            <div
              key={id}
              className={['absolute', editing ? 'touch-none' : '', held ? 'shadow-2xl' : ''].join(' ')}
              style={style}
              onPointerDown={(event) => startDrag(event, id)}
            >
              {card ? (
                <PatientBlock card={card} editing={editing} onLongPress={onLongPress} />
              ) : sticky ? (
                <StickyBlock sticky={sticky} editing={editing} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PatientBlock({
  card,
  editing,
  onLongPress,
}: {
  card: BoardCard;
  editing: boolean;
  onLongPress: (patientId: string) => void;
}): JSX.Element {
  const { patient, progress } = card;
  const timer = useRef<number | undefined>(undefined);
  const pressed = useRef(false);
  const where = [patient.room?.trim(), patient.bed?.trim()].filter(Boolean).join('/');
  const due = card.reminders.filter((reminder) => !reminder.done).length;

  const content = (
    <>
      <span className="line-clamp-2 text-[12px] font-semibold leading-tight">{card.name}</span>
      <span className="mt-auto flex items-center gap-1 truncate text-[10px] opacity-85">
        {where ? <span className="font-mono">{where}</span> : null}
        {card.dpjp ? <span className="truncate">· {card.dpjp.initials}</span> : null}
      </span>
      <span className="flex items-center gap-1 text-[10px] font-semibold">
        <span>{progress.complete ? '✓' : `${progress.doneCount}/${progress.total}`}</span>
        {card.discharge === 'today' || card.discharge === 'h1' ? (
          <span className="rounded bg-black/25 px-1">{card.discharge === 'today' ? 'Pulang' : 'H-1'}</span>
        ) : null}
        {due > 0 ? (
          <span className="ml-auto rounded-full bg-[var(--warn-strong)] px-1 text-black" title="Pengingat belum">
            {due}
          </span>
        ) : null}
      </span>
    </>
  );

  const className =
    'flex h-full w-full flex-col overflow-hidden rounded-lg border border-black/10 bg-token p-1.5 text-left text-token-fg shadow-sm dark:border-white/10';

  if (editing) {
    return (
      <div data-color-token={card.colorToken} className={`${className} cursor-grab select-none`}>
        {content}
      </div>
    );
  }
  return (
    <Link
      to={`/p/${patient.id}`}
      data-color-token={card.colorToken}
      className={className}
      onPointerDown={() => {
        pressed.current = false;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          pressed.current = true;
          onLongPress(patient.id);
        }, 500);
      }}
      onPointerUp={() => window.clearTimeout(timer.current)}
      onPointerLeave={() => window.clearTimeout(timer.current)}
      onClick={(event) => {
        // A long press opened the quick sheet; the release is not a tap.
        if (pressed.current) event.preventDefault();
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {content}
    </Link>
  );
}

function StickyBlock({ sticky, editing }: { sticky: PhoneSticky; editing: boolean }): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const first = sticky.text.split('\n').find((line) => line.trim()) ?? '(kosong)';
  return (
    <>
      <button
        ref={ref}
        type="button"
        disabled={editing}
        onClick={() => setOpen(true)}
        className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-[var(--warn-strong)] bg-[var(--warn-soft)] p-1.5 text-left text-fg disabled:cursor-grab"
      >
        <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--warn-strong)]">Catatan</span>
        <span className="line-clamp-3 text-[11px] leading-tight">{first}</span>
      </button>
      {open ? <NotePopover anchor={ref} title="Catatan papan" note={sticky.text} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
