import type { ChecklistProgress } from '@/domain/checklist';

/**
 * SPEC 9.3 — colour is never the only signal.
 *
 * N segments for N active items, so the card is readable in greyscale and with
 * any form of colour blindness. N is whatever the user configured; nothing
 * here assumes seven.
 */
export function ProgressStrip({ progress }: { progress: ChecklistProgress }): JSX.Element {
  return (
    <div
      className="flex gap-[3px]"
      role="img"
      aria-label={`${progress.doneCount} dari ${progress.total} langkah selesai`}
    >
      {progress.segments.map((segment) => (
        <span
          key={segment.itemId}
          data-color-token={segment.colorToken}
          className={[
            'h-1.5 flex-1 rounded-full',
            segment.done ? 'bg-token-accent' : 'bg-token-accent/25',
          ].join(' ')}
        />
      ))}
    </div>
  );
}
