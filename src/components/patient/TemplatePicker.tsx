import type { NoteTemplate } from '@/domain/types';

/**
 * SPEC 14 — offered only on an empty day.
 *
 * It disappears the moment there is any text, and it never replaces existing
 * content: a picker that could overwrite a half-written note would be a
 * data-loss path with a friendly label. Choosing a template is an insert into
 * emptiness, nothing more.
 *
 * Templates are not applied automatically, even when only one exists. Which
 * format a note takes depends on the DPJP and on whether this is an admission
 * or a follow-up — decisions the app has no reliable way to infer, and guessing
 * wrong means the resident deletes a page of boilerplate before they can start.
 */
export function TemplatePicker({
  templates,
  onPick,
}: {
  templates: readonly NoteTemplate[];
  onPick: (body: string) => void;
}): JSX.Element | null {
  if (templates.length === 0) return null;

  const ordered = [...templates].sort((a, b) => a.order - b.order);

  return (
    <div className="border-b border-border px-4 py-3">
      <p className="mb-2 text-xs text-fg-muted">Mulai dari format:</p>
      <div className="flex flex-wrap gap-2">
        {ordered.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onPick(template.body)}
            className="min-h-tap rounded-lg border border-border px-3 text-sm text-fg"
          >
            {template.name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-fg-faint">
        Atau langsung tulis / tempel catatan di bawah.
      </p>
    </div>
  );
}
