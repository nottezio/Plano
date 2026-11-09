import type { RevisionRow } from '@/domain/format/revisionDiff';

const ADDED = 'bg-[var(--card-step-12-bg)] text-[var(--card-step-12-fg)]';
const REMOVED = 'bg-[var(--card-step-1-bg)] text-[var(--card-step-1-fg)] line-through';

/**
 * One row of a `diffRevision`. The sign in the gutter carries the meaning as
 * well as the colour, so the diff still reads for someone who cannot tell red
 * from green. Shared by Bandingkan (CompareSheet) and Tempel (PastePanel).
 */
export function RevisionLine({ row }: { row: RevisionRow }): JSX.Element {
  const sign = row.kind === 'added' ? '+' : row.kind === 'removed' ? '−' : row.kind === 'changed' ? '~' : ' ';
  return (
    <p className="flex gap-2 whitespace-pre-wrap break-words">
      <span aria-hidden="true" className="w-3 shrink-0 text-fg-faint">
        {sign}
      </span>
      <span className="min-w-0 flex-1">
        {row.kind === 'changed' ? (
          row.parts.map((part, index) => (
            <span key={index} className={part.type === 'insert' ? ADDED : part.type === 'delete' ? REMOVED : undefined}>
              {part.text}
            </span>
          ))
        ) : (
          <span className={row.kind === 'added' ? ADDED : row.kind === 'removed' ? REMOVED : 'text-fg-muted'}>{row.text || ' '}</span>
        )}
      </span>
    </p>
  );
}
