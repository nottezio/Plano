import { useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import type { EntryRevision } from '@/domain/types';
import { DiffView } from './DiffView';

const REASON_LABEL: Record<EntryRevision['reason'], string> = {
  autosave: 'Simpan otomatis',
  'pre-merge': 'Sebelum penggabungan',
  'pre-conflict': 'Sebelum resolusi konflik',
  restore: 'Pemulihan',
  unlock: 'Buka kunci',
  version: 'Versi tersimpan',
};

/**
 * SPEC 7.4 — "Riwayat perubahan".
 *
 * The last line of defence. Restoring does not delete anything: the current
 * body is snapshotted first, so a restore is itself undoable.
 */
export function RevisionTrail({
  open,
  onOpenChange,
  revisions,
  currentBody,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  revisions: EntryRevision[];
  currentBody: string;
  onRestore: (body: string) => void;
}): JSX.Element {
  const [selected, setSelected] = useState<EntryRevision | null>(null);
  const saved = revisions.filter((revision) => revision.reason === 'version');
  const auto = revisions.filter((revision) => revision.reason !== 'version');
  /**
   * Saved versions first, then the automatic trail.
   *
   * Both stay in one list rather than two sections: the thing being looked for
   * is "the text as it was at some earlier point today", and which mechanism
   * captured it is secondary. Ordering puts the deliberate ones where the eye
   * lands and the label distinguishes them.
   */
  const ordered = [...saved, ...auto];

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelected(null);
        onOpenChange(next);
      }}
      title="Riwayat perubahan"
      /*
        Two counts, because they behave differently. Saved versions are kept
        indefinitely; automatic snapshots are capped and the oldest are dropped.
        One number covering both would imply the morning SOAP is as disposable
        as an autosave from ninety seconds ago.
      */
      description={
        saved.length > 0
          ? `${saved.length} versi disimpan sendiri (tidak pernah dihapus) · ${auto.length} cadangan otomatis (maksimum 30).`
          : `${auto.length} cadangan otomatis (maksimum 30).`
      }
    >
      {revisions.length === 0 ? (
        <p className="text-sm text-fg-muted">Belum ada versi tersimpan untuk hari ini.</p>
      ) : (
        <ul className="space-y-2">
          {ordered.map((revision) => (
            <li key={revision.id}>
              <button
                type="button"
                onClick={() => setSelected(selected?.id === revision.id ? null : revision)}
                className="w-full rounded-lg border border-border px-3 py-2 text-left"
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">
                    {revision.label ?? REASON_LABEL[revision.reason]}
                  </span>
                  {revision.reason === 'version' ? (
                    // Named as well as ordered: a label the author typed is
                    // indistinguishable from an automatic one at a glance
                    // otherwise, and only one of the two is safe to ignore.
                    <span className="rounded px-1 text-[10px] font-semibold text-[var(--warn-strong)]">
                      disimpan
                    </span>
                  ) : null}
                  <span className="text-[11px] text-fg-faint">rev {revision.rev}</span>
                  <span className="ml-auto text-[11px] text-fg-faint">
                    {formatWhen(revision)}
                  </span>
                </span>
                <span className="mt-1 block truncate text-xs text-fg-muted">
                  {revision.body.trim().split('\n')[0] || '(kosong)'}
                </span>
              </button>

              {selected?.id === revision.id ? (
                <div className="mt-2 space-y-2">
                  <DiffView before={revision.body} after={currentBody} />
                  <p className="text-[11px] text-fg-faint">
                    Merah = ada di versi ini, hijau = ada di catatan sekarang.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onRestore(revision.body);
                      setSelected(null);
                      onOpenChange(false);
                    }}
                    className="min-h-tap w-full rounded-lg border border-accent px-3 text-sm font-medium text-accent"
                  >
                    Pulihkan versi ini
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function formatWhen(revision: EntryRevision): string {
  const millis = revision.at?.toMillis?.();
  if (millis === undefined) return 'menunggu sinkron';
  return new Date(millis).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
