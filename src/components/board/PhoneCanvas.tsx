import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import type { BoardCard } from '@/domain/board';
import {
  compactGrid,
  gridRows,
  moveBlock,
  placeGrid,
  viewOffset,
  type Cell,
  type PhoneGrid,
} from '@/domain/board/phoneGrid';
import {
  addPhoneShelf,
  MAX_PHONE_SHELVES,
  putOnShelf,
  removePhoneShelf,
  renamePhoneShelf,
  shelvedIds,
  takeOffShelf,
  togglePhoneShelf,
  PHONE_SHELF_TITLE,
  PHONE_SHELF_TITLE_MAX,
  type PhoneScope,
  type PhoneShelf,
} from '@/domain/board/phoneShelf';
import { NotePopover } from './NotePopover';

const CELL_H = 104;
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
 * Shelves (26 Oct 2026): in Atur, "+ Shelf" adds a drawer below the grid; drag
 * a patient block onto it to put the patient away, "Keluarkan" puts it back
 * on the grid. A shelf folds to its header and keeps its name. See
 * `domain/board/phoneShelf`.
 *
 * See `domain/board/phoneGrid` for the model.
 */
export function PhoneCanvas({
  ids,
  cards,
  stickies,
  grid,
  onChange,
  shelves,
  scope,
  onShelves,
  onLongPress,
  onOpenSticky,
}: {
  /** Patients and sticky notes, in board order (the order new blocks fill in). */
  ids: readonly string[];
  cards: ReadonlyMap<string, BoardCard>;
  stickies: ReadonlyMap<string, PhoneSticky>;
  grid: PhoneGrid;
  onChange: (next: PhoneGrid, columns: number) => void;
  /** This board view's shelves, and which view it is (new shelves belong to it). */
  shelves: readonly PhoneShelf[];
  scope: PhoneScope;
  onShelves: (next: PhoneShelf[], columns: number) => void;
  onLongPress: (patientId: string) => void;
  /** Open a sticky note for editing. Without it a tap only shows the text. */
  onOpenSticky?: ((noteId: string) => void) | undefined;
}): JSX.Element {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [editing, setEditing] = useState(false);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; target: Cell; shelf: string | null } | null>(null);

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
  // A shelved patient is off the grid until taken off; stickies are never shelved.
  const onShelf = useMemo(() => shelvedIds(shelves), [shelves]);
  const gridIds = useMemo(() => ids.filter((id) => !(cards.has(id) && onShelf.has(id))), [ids, cards, onShelf]);
  const placed = useMemo(() => placeGrid(gridIds, grid, columns), [gridIds, grid, columns]);
  // Outside Atur the used part of the grid is drawn from the top-left corner;
  // Atur shows every cell so a block can be put anywhere.
  const offset = useMemo(() => (editing ? { c: 0, r: 0 } : viewOffset(placed)), [editing, placed]);
  const rows = Math.max(1, gridRows(placed) - offset.r) + (editing ? 2 : 0);

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

  /** The shelf under the finger, for a patient block (a sticky note has no shelf). */
  const shelfAt = (id: string, clientX: number, clientY: number): string | null => {
    if (!cards.has(id)) return null;
    const found = [...document.querySelectorAll<HTMLElement>('[data-phone-shelf]')].find((node) => {
      const rect = node.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    });
    return found?.dataset.phoneShelf ?? null;
  };
  const startDrag = (event: React.PointerEvent, id: string): void => {
    if (!editing) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setDrag({ id, x: event.clientX, y: event.clientY, target: cellAt(event.clientX, event.clientY), shelf: null });
  };
  const moveDrag = (event: React.PointerEvent): void => {
    if (!drag) return;
    setDrag({ ...drag, x: event.clientX, y: event.clientY, target: cellAt(event.clientX, event.clientY), shelf: shelfAt(drag.id, event.clientX, event.clientY) });
  };
  const endDrag = (): void => {
    if (!drag) return;
    if (drag.shelf) onShelves(putOnShelf(shelves, drag.id, drag.shelf), columns);
    else onChange(moveBlock(placed, drag.id, drag.target), columns);
    setDrag(null);
  };

  return (
    <div className="px-4 pb-24">
      <div className="mb-2 flex items-center gap-2">
        <p className="min-w-0 flex-1 text-xs text-fg-muted">
          {editing ? 'Seret blok ke kotak lain (yang ditimpa bertukar tempat) atau ke shelf.' : 'Ketuk buka · tahan untuk checklist'}
        </p>
        {editing ? (
          <button
            type="button"
            disabled={shelves.length >= MAX_PHONE_SHELVES}
            onClick={() => onShelves(addPhoneShelf(shelves, scope), columns)}
            className="min-h-tap rounded-lg border border-border bg-surface px-3 text-xs disabled:opacity-50"
          >
            + Shelf
          </button>
        ) : null}
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
            editing ? 'border-accent bg-accent text-on-accent' : 'border-border bg-surface text-fg',
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
                    target && !drag?.shelf ? 'border-accent bg-[var(--accent-soft)]' : 'border-border',
                  ].join(' ')}
                  style={{ left: c * (cellW + GAP), top: r * (CELL_H + GAP), width: cellW, height: CELL_H }}
                />
              );
            })
          : null}

        {gridIds.map((id) => {
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
                  left: (cell.c - offset.c) * (cellW + GAP),
                  top: (cell.r - offset.r) * (CELL_H + GAP),
                  width: cellW,
                  height: CELL_H,
                  transition: 'left 150ms ease, top 150ms ease',
                };
          const card = cards.get(id);
          const sticky = stickies.get(id);
          return (
            <div
              key={id}
              className={['absolute', editing ? 'touch-none' : '', held ? 'shadow-sheet' : ''].join(' ')}
              style={style}
              onPointerDown={(event) => startDrag(event, id)}
            >
              {card ? (
                <PatientBlock card={card} editing={editing} onLongPress={onLongPress} />
              ) : sticky ? (
                <StickyBlock sticky={sticky} editing={editing} onOpen={onOpenSticky} />
              ) : null}
            </div>
          );
        })}
      </div>

      {shelves.length > 0 ? (
        <div className="mt-4 space-y-2">
          {shelves.map((shelf) => (
            <ShelfDrawer
              key={shelf.id}
              shelf={shelf}
              cards={cards}
              editing={editing}
              over={drag?.shelf === shelf.id}
              onLongPress={onLongPress}
              onChange={(next) => onShelves(next, columns)}
              shelves={shelves}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One shelf: a header that folds it (and, in Atur, renames or removes it) over
 * the patients put on it, as compact rows in the order they were put away.
 * Removing a shelf only removes the drawer; its patients go back on the grid.
 */
function ShelfDrawer({
  shelf,
  shelves,
  cards,
  editing,
  over,
  onLongPress,
  onChange,
}: {
  shelf: PhoneShelf;
  shelves: readonly PhoneShelf[];
  cards: ReadonlyMap<string, BoardCard>;
  editing: boolean;
  /** A block is held over this shelf. */
  over: boolean;
  onLongPress: (patientId: string) => void;
  onChange: (next: PhoneShelf[]) => void;
}): JSX.Element {
  // Patients that left the board stay in the stored list but are not drawn or counted.
  const rows = shelf.ids.filter((id) => cards.has(id));
  const open = !shelf.closed || over;
  return (
    <section
      data-phone-shelf={shelf.id}
      aria-label={`Shelf ${shelf.title}`}
      className={['rounded-xl border bg-surface', over ? 'border-accent bg-[var(--accent-soft)]' : 'border-border'].join(' ')}
    >
      <div className="flex items-center gap-1.5 px-2">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? 'Lipat' : 'Buka'} shelf ${shelf.title}`}
          onClick={() => onChange(togglePhoneShelf(shelves, shelf.id))}
          className="flex min-h-tap shrink-0 items-center gap-1 text-xs font-semibold"
        >
          <span aria-hidden="true">{open ? '▾' : '▸'}</span>
          <span aria-hidden="true">🗄️</span>
        </button>
        {editing ? (
          <input
            key={shelf.title}
            aria-label="Nama shelf"
            defaultValue={shelf.title}
            maxLength={PHONE_SHELF_TITLE_MAX}
            placeholder={PHONE_SHELF_TITLE}
            onBlur={(event) => {
              if (event.target.value.trim() !== shelf.title) onChange(renamePhoneShelf(shelves, shelf.id, event.target.value));
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            className="min-h-8 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 text-sm font-semibold"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{shelf.title}</span>
        )}
        <span className="shrink-0 text-xs tabular-nums text-fg-muted">{rows.length}</span>
        {editing ? (
          <button
            type="button"
            aria-label={`Hapus shelf ${shelf.title}`}
            onClick={() => onChange(removePhoneShelf(shelves, shelf.id))}
            className="min-h-tap shrink-0 rounded-lg px-2 text-xs text-fg-muted"
          >
            Hapus
          </button>
        ) : null}
      </div>
      {open ? (
        <ol className="space-y-1 px-2 pb-2">
          {rows.length === 0 ? (
            <li className="rounded-lg border border-dashed border-border px-2 py-3 text-center text-xs text-fg-muted">
              {editing ? 'Seret blok pasien ke sini.' : 'Kosong'}
            </li>
          ) : null}
          {rows.map((id) => (
            <li key={id} className="flex items-stretch gap-1">
              <ShelfRow card={cards.get(id)!} editing={editing} onLongPress={onLongPress} />
              {editing ? (
                <button
                  type="button"
                  aria-label={`Keluarkan ${cards.get(id)!.name} dari shelf`}
                  onClick={() => onChange(takeOffShelf(shelves, id))}
                  className="min-h-tap shrink-0 rounded-lg border border-border bg-surface px-2 text-xs"
                >
                  Keluarkan
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

/** A shelved patient: room/bed, name and DPJP in the block's own colour; a tap opens the patient. */
function ShelfRow({ card, editing, onLongPress }: { card: BoardCard; editing: boolean; onLongPress: (patientId: string) => void }): JSX.Element {
  const { patient } = card;
  const timer = useRef<number | undefined>(undefined);
  const pressed = useRef(false);
  const where = [patient.room?.trim(), patient.bed?.trim()].filter(Boolean).join('/');
  const className =
    'flex min-h-tap min-w-0 flex-1 items-center gap-2 rounded-lg border border-black/10 bg-token px-2 py-1 text-left text-token-fg dark:border-white/10';
  const content = (
    <>
      <span className="shrink-0 font-mono text-xs font-bold">{where || '—'}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{card.name}</span>
      {card.dpjp ? <span className="shrink-0 rounded bg-black/25 px-1 text-[10px] font-semibold leading-4">{card.dpjp.initials}</span> : null}
    </>
  );
  if (editing) {
    return (
      <div data-color-token={card.colorToken} className={className}>
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
        if (pressed.current) event.preventDefault();
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {content}
    </Link>
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

  const percent = progress.total > 0 ? Math.round((progress.doneCount / progress.total) * 100) : 0;
  const stage = card.discharge === 'today' ? 'Pulang' : card.discharge === 'h1' ? 'H-1' : null;

  const content = (
    <>
      <span className="flex items-start justify-between gap-1">
        <span className="truncate font-mono text-[13px] font-bold leading-tight">{where || '—'}</span>
        {card.dpjp ? (
          <span className="shrink-0 rounded bg-black/25 px-1 text-[10px] font-semibold leading-4">{card.dpjp.initials}</span>
        ) : null}
      </span>
      <span className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-tight">{card.name}</span>
      <span className="mt-auto flex items-center gap-1.5">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/25" aria-hidden="true">
          <span className="block h-full rounded-full bg-current" style={{ width: `${percent}%` }} />
        </span>
        <span className="text-[11px] font-semibold tabular-nums">
          {progress.complete ? '✓' : `${progress.doneCount}/${progress.total}`}
        </span>
      </span>
      {stage || due > 0 || card.ekg ? (
        <span className="mt-1 flex items-center gap-1 overflow-hidden whitespace-nowrap text-[10px] font-semibold leading-4">
          {stage ? <span className="rounded bg-black/30 px-1">{stage}</span> : null}
          {card.ekg ? <span className="rounded bg-black/30 px-1">EKG</span> : null}
          {due > 0 ? (
            <span className="ml-auto rounded-full bg-[var(--warn-strong)] px-1 text-black" title="Pengingat belum">
              🔔 {due}
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );

  const className =
    'flex h-full w-full flex-col overflow-hidden rounded-lg border border-black/10 bg-token p-2 text-left text-token-fg shadow-card dark:border-white/10';
  const ringed = card.pemantauan ? ' ring-2 ring-[var(--danger)]' : '';

  if (editing) {
    return (
      <div data-color-token={card.colorToken} className={`${className}${ringed} cursor-grab select-none`}>
        {content}
      </div>
    );
  }
  return (
    <Link
      to={`/p/${patient.id}`}
      data-color-token={card.colorToken}
      className={`${className}${ringed}`}
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

/**
 * A sticky note on the phone canvas.
 *
 * A tap used to open `NotePopover`, which only SHOWS the text: on a phone the
 * notes could be read and never edited, while the laptop canvas and the list
 * view both render the editable `StickyNoteCard` (Avi, 2026-10-08). Now a tap
 * hands the note to the board, which opens that same editor in a sheet, so a
 * note is edited by one component everywhere. The popover stays only as the
 * fallback for a caller that does not offer editing.
 */
function StickyBlock({
  sticky,
  editing,
  onOpen,
}: {
  sticky: PhoneSticky;
  editing: boolean;
  onOpen?: ((noteId: string) => void) | undefined;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const found = sticky.text.split('\n').find((line) => line.trim());
  const empty = !found;
  const first = found ?? '(kosong)';
  return (
    <>
      <button
        ref={ref}
        type="button"
        disabled={editing}
        onClick={() => (onOpen ? onOpen(sticky.id) : setOpen(true))}
        className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-[var(--warn-strong)] bg-[var(--warn-soft)] text-left text-fg disabled:cursor-grab"
      >
        <span className="w-full bg-[var(--warn-strong)]/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--warn-strong)]">
          Catatan
        </span>
        <span className={['line-clamp-4 px-2 pt-1 text-[13px] leading-tight', empty ? 'italic text-fg-muted' : ''].join(' ')}>
          {first}
        </span>
      </button>
      {open ? <NotePopover anchor={ref} title="Catatan papan" note={sticky.text} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
