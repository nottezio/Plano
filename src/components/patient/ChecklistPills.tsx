import { ProgressStrip } from '@/components/board/ProgressStrip';
import { activeItems, isDone, type ChecklistProgress, type ChecklistStates } from '@/domain/checklist';
import type { ChecklistItemDef } from '@/domain/types';

/**
 * SPEC F5 — the checklist at the top of the patient page.
 *
 * Pills, not a vertical list of checkboxes: during rounds this is tapped while
 * walking, and a horizontal row keeps every target on one thumb arc. Each pill
 * carries its own colour token AND a tick glyph, so state is never conveyed by
 * colour alone (SPEC 9.3).
 */
export function ChecklistPills({
  items,
  states,
  progress,
  onToggle,
  disabled,
  orientation = 'horizontal',
}: {
  items: readonly ChecklistItemDef[];
  states: ChecklistStates;
  progress: ChecklistProgress;
  onToggle: (itemId: string) => void;
  disabled: boolean;
  orientation?: 'horizontal' | 'vertical';
}): JSX.Element | null {
  const visible = activeItems(items);
  if (visible.length === 0) return null;

  return (
    <section
      aria-label="Checklist hari ini"
      className={orientation === 'vertical' ? '' : 'border-b border-border px-4 py-2'}
    >
      <div
        className={
          orientation === 'vertical'
            ? 'flex flex-col gap-1.5'
            : 'flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        }
      >
        {visible.map((item) => {
          const done = isDone(states, item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              disabled={disabled}
              aria-pressed={done}
              data-color-token={item.colorToken}
              className={[
                'flex min-h-tap items-center gap-1.5 border px-3 text-xs',
                orientation === 'vertical'
                  ? 'w-full rounded-lg text-left'
                  : 'shrink-0 rounded-full',
                done
                  ? 'border-transparent bg-token font-medium text-token-fg'
                  : 'border-border text-fg-muted',
                disabled ? 'opacity-50' : '',
              ].join(' ')}
            >
              <span aria-hidden="true">{done ? '✓' : '○'}</span>
              <span className={orientation === 'vertical' ? 'flex-1' : 'whitespace-nowrap'}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <ProgressStrip progress={progress} />
      <p className="mt-1.5 text-[11px] text-fg-muted">
        {progress.complete
          ? 'Semua langkah selesai'
          : `${progress.doneCount}/${progress.total} selesai · belum: ${progress.pendingLabel ?? '—'}`}
      </p>
    </section>
  );
}
