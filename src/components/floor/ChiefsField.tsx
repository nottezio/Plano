import { useState } from 'react';

import { INPUT } from '@/components/common/ui';

/**
 * "Chief hari ini" (12.11): one or more chiefs for the day, as removable
 * chips plus an input. Stored comma-separated on the day (`FloorDay.chief`).
 */
export function ChiefsField({ chiefs, onChange }: { chiefs: string[]; onChange: (next: string[]) => void }): JSX.Element {
  const [draft, setDraft] = useState('');
  const add = (): void => {
    const name = draft.trim();
    if (name && !chiefs.includes(name)) onChange([...chiefs, name]);
    setDraft('');
  };
  return (
    <div className="space-y-1">
      <span className="block text-xs text-fg-muted">Chief hari ini</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {chiefs.map((name) => (
          <span key={name} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-surface pl-3 text-sm">
            {name}
            <button
              type="button"
              aria-label={`Hapus chief ${name}`}
              onClick={() => onChange(chiefs.filter((c) => c !== name))}
              className="min-h-9 min-w-9 rounded-full text-fg-muted hover:text-fg"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={chiefs.length > 0 ? '+ chief' : 'Nama chief'}
          aria-label="Tambah chief"
          className={`${INPUT} w-28`}
        />
      </div>
    </div>
  );
}
