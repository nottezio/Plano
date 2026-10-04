import { useEffect, useMemo, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { latestPenunjangOnly } from '@/domain/penunjang';
import type { SectionAlias } from '@/domain/types';

/**
 * Make a version of the day's SOAP.
 *
 * A COPY, edited on its own: the day's SOAP is not touched, now or later.
 * Asked for because dr. AHA wants only the newest investigations, and
 * trimming the real note would delete the stack the next day's note is
 * carried forward from.
 *
 * "Penunjang terbaru saja" is offered only when it would remove something,
 * and says how much, so ticking it is never a guess about what happens.
 */
export function NewVersionSheet({
  open,
  onOpenChange,
  body,
  aliases,
  defaultTitle,
  latestByDefault,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The day's SOAP as it is on screen now (unflushed text included). */
  body: string;
  aliases: readonly SectionAlias[];
  defaultTitle: string;
  /** The note's DPJP asks for the newest penunjang only (Settings → Format DPJP). */
  latestByDefault: boolean;
  onCreate: (version: { title: string; body: string }) => void;
}): JSX.Element {
  const [title, setTitle] = useState(defaultTitle);
  const [latest, setLatest] = useState(latestByDefault);

  // Each opening starts from the defaults for THIS note.
  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setLatest(latestByDefault);
  }, [open, defaultTitle, latestByDefault]);

  const trimmed = useMemo(() => latestPenunjangOnly(body, aliases), [body, aliases]);
  const canTrim = trimmed.removed.length > 0;

  const create = (): void => {
    onCreate({
      title: title.trim() || defaultTitle,
      body: latest && canTrim ? trimmed.text : body,
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Versi SOAP baru"
      description="Salinan SOAP hari ini. SOAP aslinya tidak berubah."
      footer={
        <button
          type="button"
          onClick={create}
          className="min-h-tap w-full rounded-lg bg-accent px-4 text-sm font-semibold text-white"
        >
          Buat versi
        </button>
      }
    >
      <label className="block text-xs font-medium text-fg-muted" htmlFor="version-title">
        Nama versi
      </label>
      <input
        id="version-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') create();
        }}
        className="mt-1 min-h-tap w-full rounded-lg border border-border bg-surface px-3 text-sm"
      />

      {canTrim ? (
        <div className="mt-4 rounded-lg border border-border bg-bg-subtle p-2">
          <label className="flex min-h-tap cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={latest}
              onChange={(event) => setLatest(event.target.checked)}
              className="h-4 w-4"
            />
            Penunjang terbaru saja
          </label>
          <p className="text-[11px] leading-relaxed text-fg-muted">
            {latest ? 'Dihilangkan dari versi ini' : 'Bila dicentang, dihilangkan'} (
            {trimmed.removed.length} blok lama):
          </p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-fg-muted">
            {trimmed.removed.map((block) => (
              <li key={`${block.heading}-${block.date}`} className="truncate font-mono">
                {block.heading}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-[11px] text-fg-faint">
          Tiap jenis penunjang hanya ada satu tanggal, jadi tidak ada yang perlu dipangkas.
        </p>
      )}
    </Sheet>
  );
}
