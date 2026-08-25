/**
 * A confirmation that names what it is about to do.
 *
 * "Are you sure?" is a question nobody reads, because it is the same question
 * every time. Naming the day being cleared makes it answerable — the whole
 * value of the pause is that you can catch having the wrong one selected.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-surface p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">{description}</p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-tap flex-1 rounded-lg border border-border text-sm"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className="min-h-tap flex-1 rounded-lg border border-danger text-sm font-medium text-danger"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
