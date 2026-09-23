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
   * Two versions picked to compare with each other.
   *
   * Expanding one version already diffs it against the note as it is NOW,
   * which answers "what has changed since then". It cannot answer "what
   * changed between the morning SOAP and the one after the chief's round",
   * which is two points in the past and the question a trail of thirty
   * snapshots exists for.
   *
   * Ids, not bodies: a revision can be deleted while this is open, and a
   * stored body would then be compared against something no longer in the
   * list.
   */
  const [comparing, setComparing] = useState<readonly string[]>([]);
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

  /**
   * The two picked versions, oldest first.
   *
   * Ordered by `rev`, not by the order they were tapped: a diff reads "what
   * became what", and picking the newer one first would print every addition
   * as a removal.
   */
  const picked = comparing
    .map((id) => revisions.find((revision) => revision.id === id))
    .filter((revision): revision is EntryRevision => revision !== undefined)
    .sort((a, b) => a.rev - b.rev || when(a) - when(b));
  const pair = picked.length === 2 ? { older: picked[0]!, newer: picked[1]! } : null;

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
      {pair ? (
        /*
          The comparison sits ABOVE the list, not inside the row that was
          picked second: it is about two rows, and putting it under one of
          them would say it belongs to that one.
        */
        <div className="mb-3 rounded-lg border border-accent/50 p-2">
          <p className="mb-2 text-xs font-medium">
            {versionLabel(pair.older)} <span className="text-fg-faint">→</span>{' '}
            {versionLabel(pair.newer)}
          </p>
          <DiffView before={pair.older.body} after={pair.newer.body} />
          <div className="mt-2 flex items-center gap-3">
            <p className="flex-1 text-[11px] text-fg-faint">
              Merah = ada di versi lama, hijau = ada di versi yang lebih baru.
            </p>
            <button
              type="button"
              onClick={() => setComparing([])}
              className="min-h-tap shrink-0 text-xs text-accent underline"
            >
              Bersihkan
            </button>
          </div>
        </div>
      ) : comparing.length === 1 ? (
        <p className="mb-3 rounded-lg border border-border px-3 py-2 text-xs text-fg-muted">
          Pilih satu versi lagi untuk dibandingkan.
        </p>
      ) : null}

      {revisions.length === 0 ? (
        <p className="text-sm text-fg-muted">Belum ada versi tersimpan untuk hari ini.</p>
      ) : (
        <ul className="space-y-2">
          {ordered.map((revision) => (
            <li key={revision.id}>
              <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => setSelected(shown?.id === revision.id ? null : revision)}
                className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-left"
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

              {/*
                Picking for comparison is its own control. Tapping the row
                expands it — one row, one meaning — and a row that sometimes
                expanded and sometimes queued a comparison would be neither.
              */}
              <button
                type="button"
                onClick={() => setComparing((current) => pick(current, revision.id))}
                aria-pressed={comparing.includes(revision.id)}
                title="Bandingkan dengan versi lain"
                className={[
                  'min-h-tap shrink-0 rounded-lg border px-2 text-[11px] font-medium',
                  comparing.includes(revision.id)
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border text-fg-muted',
                ].join(' ')}
              >
                {comparing.indexOf(revision.id) === 0
                  ? '1'
                  : comparing.indexOf(revision.id) === 1
                    ? '2'
                    : 'Banding'}
              </button>
              </div>

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

/**
 * Keeps at most two, oldest pick dropped first.
 *
 * Tapping a third replaces the first rather than refusing: refusing means the
 * user has to work out which one to clear before they can do the thing they
 * are already doing.
 */
export function pick(current: readonly string[], id: string): string[] {
  if (current.includes(id)) return current.filter((entry) => entry !== id);
  return [...current, id].slice(-2);
}

function versionLabel(revision: EntryRevision): string {
  const name = revision.label ?? REASON_LABEL[revision.reason];
  return `${name} (rev ${String(revision.rev)})`;
}

function when(revision: EntryRevision): number {
  return revision.at?.toMillis?.() ?? 0;
}
