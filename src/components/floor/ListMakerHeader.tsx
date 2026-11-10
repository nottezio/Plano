import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { DateField } from '@/components/common/DateField';
import { IconChevronRight } from '@/components/common/Icons';
import { ScrollStrip } from '@/components/common/ScrollStrip';
import { ChoiceChip, Field } from '@/components/common/ui';
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
  onGuide,
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
  /** The page's tools (Panduan, Catatan Visite): top row from 640 px, beside the date on a phone. */
  actions?: ReactNode;
  /** Opens the page guide; on a phone it is a chip in the list strip, not a button row of its own. */
  onGuide?: () => void;
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
  return (
    <div className="space-y-3">
      {/*
        Header layout (10 Nov 2026, Avi: "weirdly positioned"). Row 1: which list (the chips) and the
        page's tools (Panduan, Catatan Visite) pinned right, where page tools are looked for; they
        used to float mid-row next to the date inside a 48 rem block, leaving the right half of a
        wide screen empty. Row 2: the list's own fields. From 1024 px date | Chief Bangsal | Chief
        side by side across the full width, so the Chief chips wrap in the room left over instead of
        a narrow box; from 640 px date | Chief Bangsal, then Chief below. Phones keep the folded
        chiefs with Catatan Visite beside the date (Panduan is a chip in the strip).
      */}
      <div className="flex items-center gap-3">
        <ScrollStrip outerClassName="flex-1" className="flex gap-2 py-0.5 [&>*]:shrink-0 [&>*]:whitespace-nowrap" label="List">
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
          {onGuide ? (
            <span className="sm:hidden">
              <ChoiceChip active={false} onClick={onGuide}>
                Panduan
              </ChoiceChip>
            </span>
          ) : null}
        </ScrollStrip>
        {actions ? <div className="hidden shrink-0 sm:block">{actions}</div> : null}
      </div>

      <div className="grid grid-cols-1 gap-x-3 gap-y-2 min-[360px]:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:items-start lg:grid-cols-[minmax(0,11rem)_minmax(0,15rem)_minmax(0,1fr)]">
        <Field label="Tanggal list">
          <DateField value={date} onChange={onDate} className="w-full" />
        </Field>
        {editsChiefs ? (
          <button
            type="button"
            onClick={toggleChiefs}
            aria-expanded={chiefsOpen}
            aria-controls="list-chiefs"
            className="flex min-h-tap w-full items-center gap-3 self-end rounded-xl border border-border bg-surface px-3 py-2 text-left min-[360px]:col-span-2 transition-colors [@media(hover:hover)]:hover:bg-bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:hidden"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-fg-muted">{chiefsOpen ? 'Tutup chief' : 'Atur chief'}</span>
              <span className="block truncate text-sm font-medium text-fg">{summary}</span>
            </span>
            <IconChevronRight
              width={18}
              height={18}
              aria-hidden="true"
              className={`shrink-0 text-fg-muted transition-transform duration-150 motion-reduce:transition-none ${chiefsOpen ? '-rotate-90' : 'rotate-90'}`}
            />
          </button>
        ) : null}
        <div id="list-chiefs" className={`${chiefsOpen ? 'contents' : 'hidden'} sm:contents`}>
        {chiefBangsal !== null ? (
          // One name: a new chip replaces the old one.
          <div className="min-w-0 min-[360px]:col-span-2 sm:col-span-1">
            <ChiefsField
              chiefs={chiefBangsal ? [chiefBangsal] : []}
              onChange={(next) => onChiefBangsal(next.at(-1) ?? '')}
              label="Chief Bangsal"
              id="floor-chief-bangsal-input"
              noun="chief bangsal"
              wide
            />
          </div>
        ) : null}
        {chiefs ? (
          <div className="min-w-0 min-[360px]:col-span-2 lg:col-span-1">
            <ChiefsField chiefs={chiefs} onChange={onChiefs} wide />
          </div>
        ) : null}
        </div>
        {/* Phone: beside the date. From 640 px the tools sit in the top row instead. */}
        {actions ? <div className="min-[360px]:col-start-2 min-[360px]:row-start-1 min-[360px]:self-end sm:hidden">{actions}</div> : null}
      </div>
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
