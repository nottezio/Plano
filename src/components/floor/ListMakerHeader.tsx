import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { DateField } from '@/components/common/DateField';
import { IconChevronRight } from '@/components/common/Icons';
import { ScrollStrip } from '@/components/common/ScrollStrip';
import { ChoiceChip } from '@/components/common/ui';
import { ChiefsField } from './ChiefsField';

/**
 * The List Maker's head (13.15, Avi: "mobile UI is broken"): the lists, the
 * list date, the chiefs, and the tabs.
 *
 * ROOT CAUSE of the phone layout: one wrapping flex row held the floor
 * chips, the date (fixed 10 rem) and the chief box (fixed 18 rem), and the
 * six tabs shared one row as equal flex items — on a 390 px phone the last
 * tab ("Anggota") was cut off and the date/chief pair wrapped unevenly. Now
 * the lists scroll in their own strip, the date and the chiefs sit in a
 * two-column grid that fits any width, and the tabs scroll sideways on a
 * phone (each as wide as its word) and share the row evenly from 640 px.
 */
export function ListMakerHeader({
  floors,
  floorId,
  onPickFloor,
  onNewFloor,
  date,
  onDate,
  chiefs,
  onChiefs,
  chiefBangsal,
  onChiefBangsal,
  actions,
  onReorder,
}: {
  floors: ReadonlyArray<{ id: string; name: string }>;
  floorId: string;
  onPickFloor: (id: string) => void;
  /** The lists' new order, after a chip is dragged (10 Nov 2026); absent: no dragging. */
  onReorder?: ((ids: string[]) => void) | undefined;
  /** Absent for a list viewer, who cannot create lists. */
  onNewFloor?: (() => void) | undefined;
  date: string;
  onDate: (date: string) => void;
  /** null: the chiefs are not editable here. */
  chiefs: string[] | null;
  onChiefs: (next: string[]) => void;
  /** The jam-dinas chief, one name (24 Oct 2026); null: not editable here. */
  chiefBangsal: string | null;
  onChiefBangsal: (name: string) => void;
  /** The page's tools (Panduan, Catatan Visite): the end of the head's one line. */
  actions?: ReactNode;
}): JSX.Element {
  /*
    On a phone the two chief fields are folded behind one summary line
    (2026-10-31): with the date, both chiefs and Catatan Visite open, the tabs
    started half way down the screen and the first patient two thirds down.
    Folded unless left open on this device; 640 px and up unchanged.
  */
  const [chiefsOpen, setChiefsOpen] = useState(readChiefsOpen);
  const toggleChiefs = (): void => {
    setChiefsOpen(!chiefsOpen);
    writeChiefsOpen(!chiefsOpen);
  };
  const editsChiefs = chiefs !== null || chiefBangsal !== null;
  const summary = [
    chiefBangsal !== null ? `Bangsal: ${chiefBangsal || '—'}` : null,
    chiefs !== null ? `Chief: ${chiefs.length ? chiefs.join(', ') : '—'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  /*
    Drag a list chip to reorder (10 Nov 2026, Avi): the first list is the one
    List Maker opens. Mouse drag (HTML drag and drop); on a phone the strip
    scrolls instead. Dropped right of where it started: after the target;
    left: before it.
  */
  const canReorder = Boolean(onReorder) && floors.length > 1;
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const drop = (target: string): void => {
    if (!onReorder || !dragId || dragId === target) return;
    const ids = floors.map((f) => f.id);
    const from = ids.indexOf(dragId);
    const rest = ids.filter((id) => id !== dragId);
    const at = rest.indexOf(target) + (from < ids.indexOf(target) ? 1 : 0);
    rest.splice(at, 0, dragId);
    onReorder(rest);
  };
  const endDrag = (): void => {
    setDragId(null);
    setOverId(null);
  };
  /*
    One line (12 Nov 2026, Avi: "overlap, empty spaces, non-human UI"). Before, the head was three
    rows on a phone (lists; date + Catatan Visite; the folded chiefs) and two on a desk (lists +
    tools; labelled fields), so the first patient sat on the second screen of a phone. Now: the
    lists, the date, the chiefs and the tools share one line. A phone scrolls it sideways, the
    chiefs folded behind one chip that opens their fields below.

    From 640 px the chiefs have their own row under it (12 Nov 2026, build 12.2). Inline in the one
    wrapping line, the Chief box was a flex item squeezed to its 12 rem minimum, so 14 chiefs wrapped
    into about 8 rows (350 px), and the line's items-center floated the chips, date and tools in the
    middle of that height. Now: Chief Bangsal at a fixed width, Chief taking the rest of the row.
  */
  const chiefFields = (suffix: string): JSX.Element => (
    <>
      {chiefBangsal !== null ? (
        // One name: a new chip replaces the old one.
        <div className="min-w-0 sm:w-64 sm:shrink-0">
          <ChiefsField
            chiefs={chiefBangsal ? [chiefBangsal] : []}
            onChange={(next) => onChiefBangsal(next.at(-1) ?? '')}
            label="Chief Bangsal"
            id={`floor-chief-bangsal-input${suffix}`}
            noun="chief bangsal"
            wide
            inline
          />
        </div>
      ) : null}
      {chiefs ? (
        <div className="min-w-0 sm:flex-1">
          <ChiefsField chiefs={chiefs} onChange={onChiefs} id={`floor-chief-input${suffix}`} wide inline />
        </div>
      ) : null}
    </>
  );
  return (
    <div className="space-y-2">
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] max-sm:[&>*]:shrink-0 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        <div role="group" aria-label="List" className="flex items-center gap-2 [&>*]:shrink-0 [&>*]:whitespace-nowrap">
          {floors.map((f) => (
            <span
              key={f.id}
              draggable={canReorder}
              onDragStart={(e) => {
                setDragId(f.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', f.id);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOverId(f.id);
              }}
              onDragLeave={() => setOverId((o) => (o === f.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                drop(f.id);
                endDrag();
              }}
              onDragEnd={endDrag}
              title={canReorder ? 'Seret untuk mengubah urutan. List pertama dibuka saat List Maker dibuka.' : undefined}
              className={`rounded-full transition-opacity ${canReorder ? 'cursor-grab active:cursor-grabbing' : ''} ${dragId === f.id ? 'opacity-40' : ''} ${
                overId === f.id && dragId !== f.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''
              }`}
            >
              <ChoiceChip active={f.id === floorId} onClick={() => onPickFloor(f.id)}>
                {f.name}
              </ChoiceChip>
            </span>
          ))}
          {onNewFloor ? (
            <ChoiceChip active={false} onClick={onNewFloor}>
              + List baru
            </ChoiceChip>
          ) : null}
        </div>
        <span aria-hidden="true" className="hidden h-6 w-px bg-border sm:block" />
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="hidden text-xs text-fg-muted 2xl:inline">
            Tanggal list
          </span>
          <DateField value={date} onChange={onDate} ariaLabel="Tanggal list" className="w-[9.5rem] sm:w-[10.5rem]" inputClassName="max-sm:rounded-full max-sm:text-xs" />
        </div>
        {editsChiefs ? (
          <button
            type="button"
            onClick={toggleChiefs}
            aria-expanded={chiefsOpen}
            aria-controls="list-chiefs"
            className={`flex min-h-tap max-w-[15rem] items-center gap-1 rounded-full border px-3 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:hidden ${
              chiefsOpen ? 'border-accent bg-[var(--accent-soft)] text-accent' : 'border-border bg-surface text-fg'
            }`}
          >
            <span className="truncate">{summary}</span>
            <IconChevronRight
              width={14}
              height={14}
              aria-hidden="true"
              className={`shrink-0 text-fg-muted transition-transform duration-150 motion-reduce:transition-none ${chiefsOpen ? '-rotate-90' : 'rotate-90'}`}
            />
          </button>
        ) : null}
        {actions ? <div className="flex items-center gap-2 sm:ml-auto">{actions}</div> : null}
      </div>
      {editsChiefs ? <div className="hidden items-start gap-2 sm:flex">{chiefFields('')}</div> : null}
      {editsChiefs ? (
        <div id="list-chiefs" className={chiefsOpen ? 'space-y-2 sm:hidden' : 'hidden'}>
          {chiefFields('-phone')}
        </div>
      ) : null}
    </div>
  );
}

const CHIEFS_OPEN_KEY = 'plano.listMaker.chiefsOpen';

/** Folded unless the user left them open; storage that throws reads as folded. */
function readChiefsOpen(): boolean {
  try {
    return window.localStorage.getItem(CHIEFS_OPEN_KEY) === 'open';
  } catch {
    return false;
  }
}

function writeChiefsOpen(open: boolean): void {
  try {
    if (open) window.localStorage.setItem(CHIEFS_OPEN_KEY, 'open');
    else window.localStorage.removeItem(CHIEFS_OPEN_KEY);
  } catch {
    // Not remembered; the toggle still works on this page.
  }
}

/**
 * The tabs, pinned to the top of the page while it scrolls (2026-10-17, Avi:
 * "make the header float to ease tab switching, but not so big it obstructs
 * the view"). Only the tab row floats — one compact strip; the lists, date
 * and chiefs above it scroll away. Its own component because a sticky element
 * sticks only within its parent: inside the header it went with the header.
 */
export function ListMakerTabs<T extends string>({
  tab,
  tabs,
  onTab,
  actions,
  children,
}: {
  tab: T;
  tabs: ReadonlyArray<readonly [T, string]>;
  onTab: (tab: T) => void;
  /** Salin teks, Cetak, Simpan edisi (10 Nov 2026): pinned with the tabs, on every tab. */
  actions?: ReactNode;
  /** Pinned with the tabs (the search, 9 Nov 2026), so `--lm-tabs-h` counts it too. */
  children?: ReactNode;
}): JSX.Element {
  /*
    The bar's real height, for whatever pins itself under it (the List tab's
    side panel). A guessed 4rem was 8 px short on a touch laptop, where the tab
    buttons are 44 px tall, so the panel's top sat behind the bar. Like
    `--tabs-h` in `DesktopTabs`: set on the root, removed on unmount.
  */
  const bar = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = bar.current;
    if (!node) return undefined;
    const root = document.documentElement.style;
    const measure = (): void => root.setProperty('--lm-tabs-h', `${node.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.removeProperty('--lm-tabs-h');
    };
  }, []);
  return (
    /*
      Phone: tabs, then the search with the action buttons beside it (no extra row).
      From 640 px: tabs with the actions at the row's end, the search below.
      From 1536 px: one row. The tab strip shrinks and scrolls before the actions wrap.
    */
    <div ref={bar} className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 bg-bg px-4 pb-2 pt-1">
      <ScrollStrip
        // basis 0 keeps it on the actions' line (a wrapping row wraps before it shrinks); max-w-fit stops it growing past its tabs.
        outerClassName="order-1 w-full rounded-xl border border-border bg-bg-subtle sm:w-auto sm:max-w-fit sm:flex-1 sm:basis-0"
        fade="from-bg-subtle"
        className="flex p-0.5"
        label="Tampilan"
        role="tablist"
      >
        {tabs.map(([key, label]) => {
          const on = key === tab;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onTab(key)}
              className={`min-h-tap min-w-max flex-1 shrink-0 rounded-lg px-2.5 text-xs transition-colors sm:flex-none sm:px-5 sm:text-sm [@media(pointer:fine)]:min-h-9 ${
                on ? 'bg-surface font-semibold text-fg shadow-card ring-1 ring-border' : 'text-fg-muted hover:text-fg'
              }`}
            >
              {label}
            </button>
          );
        })}
      </ScrollStrip>
      {actions ? <div className="order-3 ml-auto flex shrink-0 items-center gap-1.5 sm:order-2 2xl:order-3">{actions}</div> : null}
      {children ? <div className="order-2 min-w-0 flex-1 basis-0 sm:order-3 sm:basis-full 2xl:order-2 2xl:basis-0">{children}</div> : null}
    </div>
  );
}
