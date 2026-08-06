import { Sheet } from '@/components/common/Sheet';
import { ProgressStrip } from './ProgressStrip';
import { useChecklist } from '@/hooks/useChecklist';
import { activeItems, isDone } from '@/domain/checklist';
import type { ChecklistItemDef, ClinicalDate, Patient } from '@/domain/types';

/**
 * SPEC F5 / 11.3 — long-press a card to tick during rounds without opening the
 * note.
 *
 * Reads the authoritative checklist document rather than the board cache. The
 * cache is fine for painting forty cards; it is not fine as the input to a
 * write, because a tick computed from a cache one write behind would resurrect
 * a state the user already changed. One extra listener, open only while the
 * sheet is.
 */
export function QuickChecklistSheet({
  patient,
  items,
  today,
  onOpenChange,
}: {
  patient: Patient | null;
  items: readonly ChecklistItemDef[];
  today: ClinicalDate;
  onOpenChange: (open: boolean) => void;
}): JSX.Element | null {
  const checklist = useChecklist(patient?.id, today, items, patient !== null);

  if (!patient) return null;

  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      title={patient.name}
      description="Checklist hari ini"
    >
      <ul className="space-y-2">
        {activeItems(items).map((item) => {
          const done = isDone(checklist.states, item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => checklist.toggle(item.id)}
                aria-pressed={done}
                data-color-token={item.colorToken}
                className={[
                  'flex min-h-tap w-full items-center gap-3 rounded-lg border px-3 text-left text-sm',
                  done
                    ? 'border-transparent bg-token text-token-fg'
                    : 'border-border text-fg-muted',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className={[
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]',
                    done ? 'border-current' : 'border-border-strong',
                  ].join(' ')}
                >
                  {done ? '✓' : ''}
                </span>
                <span className="min-w-0 flex-1 py-2">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4">
        <ProgressStrip progress={checklist.progress} />
        <p className="mt-1.5 text-[11px] text-fg-muted">
          {checklist.progress.doneCount}/{checklist.progress.total} selesai
        </p>
      </div>
    </Sheet>
  );
}
