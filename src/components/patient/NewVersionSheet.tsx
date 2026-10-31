import { useEffect, useMemo, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { Callout, ChoiceChip } from '@/components/common/ui';
import { formatShortDate } from '@/domain/clinicalDate';
import { latestPenunjangOnly } from '@/domain/penunjang';
import type { ClinicalDate, SectionAlias } from '@/domain/types';
import { carryVersion, type CarryChange } from '@/domain/versionCarry';

/** An earlier day's versions this one can be carried on from. */
export interface CarrySource {
  date: ClinicalDate;
  versions: ReadonlyArray<{ id: string; title: string; body: string }>;
  /** That day's SOAP: `undefined` while it is read, `null` when it could not be. */
  base: string | null | undefined;
}

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
 *
 * CARRYING ON. When an earlier day has a version, the new one can start from
 * it plus what changed in the SOAP since that day (`domain/versionCarry`), so
 * the shortening done by hand yesterday is kept and only today's changes need
 * attention. What could not be placed comes back as `pending` and stays on
 * screen above the new version until dismissed (`CarryPendingPanel`).
 */
export function NewVersionSheet({
  open,
  onOpenChange,
  body,
  aliases,
  defaultTitle,
  latestByDefault,
  carry,
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
  carry: CarrySource | null;
  onCreate: (version: { title: string; body: string; pending: CarryChange[] }) => void;
}): JSX.Element {
  const [title, setTitle] = useState(defaultTitle);
  const [latest, setLatest] = useState(latestByDefault);
  /** The version carried on from, or `null` for today's SOAP. */
  const [sourceId, setSourceId] = useState<string | null>(null);

  // The earlier version named like this one, else that day's newest.
  const suggested = useMemo(() => {
    if (!carry || carry.versions.length === 0) return null;
    const wanted = defaultTitle.trim().toLowerCase();
    return (
      carry.versions.find((version) => version.title.trim().toLowerCase() === wanted) ??
      carry.versions[carry.versions.length - 1]!
    );
  }, [carry, defaultTitle]);

  // Each opening starts from the defaults for THIS note: carrying on from the
  // earlier version when there is one, since that is the daily routine.
  // Keyed on id and title, not the object: the earlier SOAP arriving rebuilds
  // `carry`, and that must not reset what has been picked or typed.
  const suggestedId = suggested?.id ?? null;
  const suggestedTitle = suggested?.title ?? null;
  useEffect(() => {
    if (!open) return;
    setTitle(suggestedTitle ?? defaultTitle);
    setLatest(latestByDefault);
    setSourceId(suggestedId);
  }, [open, suggestedId, suggestedTitle, defaultTitle, latestByDefault]);

  const source = carry?.versions.find((version) => version.id === sourceId) ?? null;
  const base = carry?.base;
  const carried = useMemo(
    () => (source && base ? carryVersion(base, source.body, body) : null),
    [source, base, body],
  );
  const waiting = source !== null && base === undefined;
  const unreadable = source !== null && base === null;
  const text = carried ? carried.text : body;

  const trimmed = useMemo(() => latestPenunjangOnly(text, aliases), [text, aliases]);
  const canTrim = trimmed.removed.length > 0;

  const create = (): void => {
    if (waiting || unreadable) return;
    onCreate({
      title: title.trim() || defaultTitle,
      body: latest && canTrim ? trimmed.text : text,
      pending: carried?.pending ?? [],
    });
  };

  const chooseSource = (id: string | null): void => {
    setSourceId(id);
    setTitle(carry?.versions.find((version) => version.id === id)?.title ?? defaultTitle);
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
          disabled={waiting || unreadable}
          className="min-h-tap w-full rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-50"
        >
          Buat versi
        </button>
      }
    >
      {carry && carry.versions.length > 0 ? (
        <div className="mb-4">
          <p className="text-xs font-medium text-fg-muted">Mulai dari</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {carry.versions.map((version) => (
              <ChoiceChip
                key={version.id}
                dashed
                active={sourceId === version.id}
                onClick={() => chooseSource(version.id)}
              >
                {version.title} · {formatShortDate(carry.date)}
              </ChoiceChip>
            ))}
            <ChoiceChip active={sourceId === null} onClick={() => chooseSource(null)}>
              SOAP hari ini
            </ChoiceChip>
          </div>
          {source ? (
            <p className="mt-2 text-xs leading-relaxed text-fg-muted">
              {waiting
                ? 'Membaca SOAP tanggal itu…'
                : unreadable
                  ? 'SOAP tanggal itu tidak terbaca (offline dan belum tersimpan di perangkat ini?). Pilih SOAP hari ini.'
                  : `Versi itu ditambah perubahan SOAP sejak ${formatShortDate(carry.date)}. Yang diubah di SOAP tanggal itu setelah versinya dibuat tidak ikut terbawa.`}
            </p>
          ) : null}
          {carried ? <CarrySummary applied={carried.applied} pending={carried.pending} /> : null}
        </div>
      ) : null}

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
          <p className="text-xs leading-relaxed text-fg-muted">
            {latest ? 'Dihilangkan dari versi ini' : 'Bila dicentang, dihilangkan'} (
            {trimmed.removed.length} blok lama):
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-fg-muted">
            {trimmed.removed.map((block) => (
              <li key={`${block.heading}-${block.date}`} className="truncate font-mono">
                {block.heading}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-xs text-fg-faint">
          Tiap jenis penunjang hanya ada satu tanggal, jadi tidak ada yang perlu dipangkas.
        </p>
      )}
    </Sheet>
  );
}

function CarrySummary({
  applied,
  pending,
}: {
  applied: readonly CarryChange[];
  pending: readonly CarryChange[];
}): JSX.Element {
  if (applied.length === 0 && pending.length === 0) {
    return <p className="mt-2 text-xs text-fg-muted">SOAP tidak berubah sejak versi itu.</p>;
  }
  return (
    <div className="mt-2 space-y-2">
      {applied.length > 0 ? (
        <details className="rounded-lg border border-border p-2 text-xs">
          <summary className="min-h-tap cursor-pointer content-center font-medium">
            {applied.length} perubahan sudah masuk otomatis
          </summary>
          <ChangeList changes={applied} />
        </details>
      ) : null}
      {pending.length > 0 ? (
        <Callout tone="warn" title={`${pending.length} perubahan belum masuk`}>
          Daftarnya tetap tampil di atas versi baru, untuk diisi sendiri.
        </Callout>
      ) : null}
    </div>
  );
}

function ChangeList({ changes }: { changes: readonly CarryChange[] }): JSX.Element {
  return (
    <ul className="mt-2 space-y-2">
      {changes.map((change, index) => (
        <li key={index} className="space-y-0.5 font-mono text-[11px] leading-snug">
          {change.before.map((line, k) => (
            <p key={`b${k}`} className="break-words text-fg-muted line-through">
              {line || ' '}
            </p>
          ))}
          {change.after.map((line, k) => (
            <p key={`a${k}`} className="break-words text-fg">
              {line || ' '}
            </p>
          ))}
        </li>
      ))}
    </ul>
  );
}

/**
 * What carrying on could not place, above the new version until dismissed.
 * The sheet closes on "Buat versi", and this list is the reason the feature
 * exists, so it must outlive the sheet.
 */
export function CarryPendingPanel({
  pending,
  onDismiss,
}: {
  pending: readonly CarryChange[];
  onDismiss: () => void;
}): JSX.Element {
  return (
    <div className="px-4 pb-2">
      <Callout
        tone="warn"
        role="status"
        title={`Belum masuk ke versi ini (${pending.length}): coret = kemarin, di bawahnya = hari ini`}
        action={
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-tap rounded-md px-2 text-xs font-semibold text-accent"
          >
            Selesai
          </button>
        }
      >
        <ChangeList changes={pending} />
      </Callout>
    </div>
  );
}
