import { diffSegments } from '@/domain/merge/threeWayMerge';

/** SPEC 7.3 — "Lihat perbedaan". Additions green, removals struck through. */
export function DiffView({ before, after }: { before: string; after: string }): JSX.Element {
  return (
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-bg-subtle p-3 text-xs leading-relaxed">
      {diffSegments(before, after).map((segment, index) => (
        <span
          key={index}
          className={
            segment.type === 'insert'
              ? 'bg-[var(--card-step-12-bg)] text-[var(--card-step-12-fg)]'
              : segment.type === 'delete'
                ? 'bg-[var(--card-step-1-bg)] text-[var(--card-step-1-fg)] line-through'
                : undefined
          }
        >
          {segment.text}
        </span>
      ))}
    </pre>
  );
}
