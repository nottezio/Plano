import { useState } from 'react';

/**
 * "Chief" (12.11): one or more chiefs, as removable chips INSIDE one input
 * box (12.12). The chips and the input used to be separate items in a
 * wrapping row, so a chip pushed the full-width input onto a second line and
 * the whole header row grew and shifted (Avi's screenshot). One box of a fixed
 * minimum height, same label and height as the date field beside it, keeps the
 * row aligned; only a long list of chiefs makes it wrap, inside the box.
 */
export function ChiefsField({ chiefs, onChange }: { chiefs: string[]; onChange: (next: string[]) => void }): JSX.Element {
  const [draft, setDraft] = useState('');
  const add = (): void => {
    const name = draft.trim().replace(/,$/, '');
    if (name && !chiefs.includes(name)) onChange([...chiefs, name]);
    setDraft('');
  };
  return (
    <div className="min-w-0">
      <label htmlFor="floor-chief-input" className="mb-1 block text-xs font-medium text-fg-muted">
        Chief
      </label>
      <div className="flex min-h-tap w-72 max-w-full flex-wrap items-center gap-1 rounded-xl border border-border bg-surface px-1.5 py-1 focus-within:border-accent [@media(pointer:fine)]:min-h-10">
        {chiefs.map((name) => (
          <span key={name} className="inline-flex h-7 items-center gap-0.5 rounded-full bg-bg-subtle pl-2.5 text-sm">
            {name}
            <button
              type="button"
              aria-label={`Hapus chief ${name}`}
              onClick={() => onChange(chiefs.filter((c) => c !== name))}
              className="h-7 w-7 rounded-full text-fg-muted hover:text-fg"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id="floor-chief-input"
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
          className="h-7 min-w-[5rem] flex-1 bg-transparent px-1 text-sm text-fg outline-none placeholder:text-fg-faint"
        />
      </div>
    </div>
  );
}
