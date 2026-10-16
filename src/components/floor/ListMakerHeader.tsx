import { DateField } from '@/components/common/DateField';
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
}: {
  floors: ReadonlyArray<{ id: string; name: string }>;
  floorId: string;
  onPickFloor: (id: string) => void;
  onNewFloor: () => void;
  date: string;
  onDate: (date: string) => void;
  /** null: the chiefs are not editable here. */
  chiefs: string[] | null;
  onChiefs: (next: string[]) => void;
}): JSX.Element {
  return (
    <div className="space-y-2">
      <ScrollStrip className="flex gap-2 py-0.5" label="List">
        {floors.map((f) => (
          <ChoiceChip key={f.id} active={f.id === floorId} onClick={() => onPickFloor(f.id)}>
            {f.name}
          </ChoiceChip>
        ))}
        <ChoiceChip active={false} onClick={onNewFloor}>
          + List baru
        </ChoiceChip>
      </ScrollStrip>

      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:max-w-xl">
        <Field label="Tanggal list">
          <DateField value={date} onChange={onDate} className="w-full" />
        </Field>
        {chiefs ? <ChiefsField chiefs={chiefs} onChange={onChiefs} wide /> : null}
      </div>

    </div>
  );
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
    <div className="sticky top-0 z-20 -mx-4 bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] px-4 py-1 backdrop-blur">
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
                on ? 'bg-surface font-semibold text-fg shadow-sm ring-1 ring-border' : 'text-fg-muted hover:text-fg'
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
