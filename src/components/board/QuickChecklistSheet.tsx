import { useMemo } from 'react';

import { cardTitle } from '@/domain/board';
import { itemsForPatientDay } from '@/domain/checklistDay';
import { useSession } from '@/store/useSession';
import { Sheet } from '@/components/common/Sheet';
import { IconClipboard } from '@/components/common/Icons';
import { Button } from '@/components/common/ui';
import { ProgressStrip } from './ProgressStrip';
import { ReminderPicker } from '@/components/patient/ReminderPicker';
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
  onVisite,
}: {
  patient: Patient | null;
  items: readonly ChecklistItemDef[];
  today: ClinicalDate;
  onOpenChange: (open: boolean) => void;
  /** The phone's way into Visite mode: long-press opens this sheet, not a card button. */
  onVisite?: ((patientId: string) => void) | undefined;
}): JSX.Element | null {
  const dischargePlannedFor = patient?.dischargePlannedFor;
  const legacyDischarge = patient?.discharge;
  const dayItems = useMemo(
    () => itemsForPatientDay(items, { dischargePlannedFor, discharge: legacyDischarge }, today, today),
    [items, dischargePlannedFor, legacyDischarge, today],
  );
  const checklist = useChecklist(patient?.id, today, dayItems, patient !== null);
  const initialsOnly = useSession((state) => state.settings().privacy.boardShowInitialsOnly);

  if (!patient) return null;

  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      title={cardTitle(patient, initialsOnly, false)}
      description="Checklist dan pengingat hari ini"
      footer={
        onVisite ? (
          <Button
            className="w-full"
            icon={<IconClipboard width={16} height={16} />}
            onClick={() => onVisite(patient.id)}
          >
            Visite
          </Button>
        ) : undefined
      }
    >
      <ul className="space-y-2">
        {activeItems(dayItems).map((item) => {
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
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs',
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
        <p className="mt-1.5 text-xs text-fg-muted">
          {checklist.progress.doneCount}/{checklist.progress.total} selesai
        </p>
      </div>

      {/* Reminders are set from the board too, not only from the patient's
          ⋯ sheet: they are a board thing (a chip on the card), and a long
          press is the board's way to act on one patient without opening it. */}
      <div className="mt-4">
        <ReminderPicker patient={patient} today={today} />
      </div>
    </Sheet>
  );
}
