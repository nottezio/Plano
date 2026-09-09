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
  onDelete,
  /**
   * Open with this revision already expanded.
   *
   * Set when the sheet is reached from a version chip on the page: the chip
   * names one version, so landing on a list and having to find it again would
   * undo the point of the chip.
   */
  focusId = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  revisions: EntryRevision[];
  currentBody: string;
  onRestore: (body: string) => void;
  /** Absent when the trail is read-only. Saved versions only. */
  onDelete?: ((revisionId: string) => void) | undefined;
  focusId?: string | null;
}): JSX.Element {
  const [selected, setSelected] = useState<EntryRevision | null>(null);
  /**
   * Confirmed in place, not through a dialog.
   *
   * The diff is on screen directly above this button — the user is looking at
   * exactly what they are about to remove, which is better evidence than any
   * modal restating it in words could give them.
   */
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const focused = focusId ? (revisions.find((r) => r.id === focusId) ?? null) : null;
  const shown = selected ?? focused;
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
          ? `${saved.length} versi disimpan sendiri (tidak ikut terhapus otomatis) · ${auto.length} cadangan otomatis (maksimum 30).`
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
                onClick={() => setSelected(shown?.id === revision.id ? null : revision)}
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

              {shown?.id === revision.id ? (
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

                  {/*
                    Delete is offered for SAVED versions only.

                    An automatic snapshot is not the user's to delete — it is
                    the recovery trail, it prunes itself at thirty, and
                    removing one by hand only ever makes a bad day worse. A
                    saved version is a note somebody wrote and labelled, so
                    deleting it is an ordinary edit to their own work.
                  */}
                  {revision.reason === 'version' && onDelete ? (
                    confirmingDelete === revision.id ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onDelete(revision.id);
                            setConfirmingDelete(null);
                            setSelected(null);
                          }}
                          className="min-h-tap flex-1 rounded-lg px-3 text-sm font-medium text-white"
                          style={{ backgroundColor: 'var(--danger)' }}
                        >
                          Hapus "{revision.label ?? `rev ${String(revision.rev)}`}"
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDelete(null)}
                          className="min-h-tap shrink-0 px-3 text-sm text-fg-muted"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(revision.id)}
                        className="min-h-tap w-full text-xs text-[var(--danger)] underline"
                      >
                        Hapus versi ini
                      </button>
                    )
                  ) : null}
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
