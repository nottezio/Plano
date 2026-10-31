import { useState } from 'react';

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
}: {
  floors: ReadonlyArray<{ id: string; name: string }>;
  floorId: string;
  onPickFloor: (id: string) => void;
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
  return (
    <div className="space-y-2">
      <ScrollStrip className="flex gap-2 py-0.5" label="List">
        {floors.map((f) => (
          <ChoiceChip key={f.id} active={f.id === floorId} onClick={() => onPickFloor(f.id)}>
            {f.name}
          </ChoiceChip>
        ))}
        {onNewFloor ? (
          <ChoiceChip active={false} onClick={onNewFloor}>
          + List baru
        </ChoiceChip>
        ) : null}
      </ScrollStrip>

      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:max-w-3xl sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field label="Tanggal list">
          <DateField value={date} onChange={onDate} className="w-full" />
        </Field>
        {editsChiefs ? (
          <button
            type="button"
            onClick={toggleChiefs}
            aria-expanded={chiefsOpen}
            aria-controls="list-chiefs"
            className="flex min-h-tap w-full items-center gap-3 self-end rounded-xl border border-border bg-surface px-3 py-2 text-left transition-colors [@media(hover:hover)]:hover:bg-bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:hidden"
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
          <ChiefsField
            chiefs={chiefBangsal ? [chiefBangsal] : []}
            onChange={(next) => onChiefBangsal(next.at(-1) ?? '')}
            label="Chief Bangsal"
            id="floor-chief-bangsal-input"
            noun="chief bangsal"
            wide
          />
        ) : null}
        {chiefs ? <ChiefsField chiefs={chiefs} onChange={onChiefs} wide /> : null}
        </div>
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
}: {
  tab: T;
  tabs: ReadonlyArray<readonly [T, string]>;
  onTab: (tab: T) => void;
}): JSX.Element {
  return (
    <div className="sticky top-0 z-20 -mx-4 bg-bg px-4 py-1">
      <ScrollStrip outerClassName="rounded-xl border border-border bg-bg-subtle" fade="from-bg-subtle" className="flex p-0.5" label="Tampilan" role="tablist">
        {tabs.map(([key, label]) => {
          const on = key === tab;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onTab(key)}
              className={`min-h-tap min-w-max flex-1 shrink-0 rounded-lg px-2.5 text-xs transition-colors sm:px-4 [@media(pointer:fine)]:min-h-9 ${
                on ? 'bg-surface font-semibold text-fg shadow-card ring-1 ring-border' : 'text-fg-muted hover:text-fg'
              }`}
            >
              {label}
            </button>
          );
        })}
      </ScrollStrip>
    </div>
  );
}
