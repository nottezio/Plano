import { Button } from '@/components/common/ui';
import { writeRosterFields } from '@/data/repositories/floors.repo';
import { suggestionActions, suggestionFor, suggestionWords, type FloorDoc, type RosterPatient } from '@/domain/floorList/floor';
import type { FloorPatient } from '@/domain/floorList/report';

/**
 * Every pending "Plan menyebut H-1 / pulang hari ini" at the top of the List
 * Maker (22 Oct 2026, Avi: "hidden inside the list"). The same suggestion
 * and the same two answers as the chip in each patient's Atur panel, gathered
 * where they are seen without opening anyone.
 */
export function DischargeSuggestions({
  floor,
  roster,
  active,
  date,
  myName,
  onOpen,
}: {
  floor: FloorDoc;
  roster: readonly RosterPatient[];
  active: readonly FloorPatient[];
  date: string;
  myName: string;
  onOpen: (patient: FloorPatient) => void;
}): JSX.Element | null {
  const pending = roster
    .map((entry) => ({ entry, mark: suggestionFor(entry, date) }))
    .filter((s): s is { entry: RosterPatient; mark: 'h1' | 'today' | 'usul' } => s.mark !== null);
  if (pending.length === 0) return null;

  const stamp = (what: string) => ({ at: new Date().toISOString(), by: myName, what });

  return (
    <section
      aria-label="Saran pulang dari Plan"
      className="space-y-1 rounded-lg border border-[var(--warn-strong)] p-2"
      style={{ backgroundColor: 'var(--warn-soft)' }}
    >
      <p className="text-xs font-semibold">
        Saran dari Plan (pulang / usul H-1) · {pending.length} pasien belum ditandai
      </p>
      {pending.map(({ entry, mark }) => {
        const shown = active.find((p) => p.key === entry.key);
        const place = `${entry.report.room}${entry.report.bed ? ` Bed ${entry.report.bed}` : ''}`;
        return (
          <div key={entry.key} className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              disabled={!shown}
              onClick={() => shown && onOpen(shown)}
              className="min-h-tap min-w-0 flex-1 truncate text-left hover:underline"
            >
              {place ? `${place} · ` : ''}
              {entry.report.name} — <strong>{suggestionWords(mark)}</strong>
            </button>
            {suggestionActions(entry, mark, date).map((action) => (
              <Button key={action.label} size="sm" onClick={() => void writeRosterFields(floor.id, entry.key, action.fields, stamp(action.what))}>
                {action.label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => void writeRosterFields(floor.id, entry.key, { dismissed: entry.report.sentAt })}>
              Abaikan
            </Button>
          </div>
        );
      })}
    </section>
  );
}
