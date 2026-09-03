import { normaliseBullets, restoreEmphasis } from '@/domain/format/markdownLite';
import { SNIPPETS } from '@/domain/format/snippets';

/**
 * SPEC F4 — Bold, Italic, Bullet, and an insert menu.
 *
 * That menu used to insert a section header — `*O:*` at the caret — as the way
 * to opt into parseable structure. In practice nobody needed help typing a
 * five-character heading, and the menu was reported as redundant. It now
 * inserts the blocks that ARE retyped every admission: the dated EKG heading,
 * the long anamnesis, the cardiovascular risk factors.
 *
 * There are still no S/O/A/P input boxes and there never will be — the spec
 * rejects them explicitly. Structure remains something typed into free text.
 */
export function FormatToolbar({
  disabled,
  onBold,
  onItalic,
  onBullet,
  onNumbered,
  onInsertSnippet,
  value,
  onReplace,
}: {
  disabled: boolean;
  onBold: () => void;
  onItalic: () => void;
  onBullet: () => void;
  onNumbered: () => void;
  /**
   * Absent for the jaga editor: a shift note is a short paragraph about one
   * complaint, and an admission anamnesis block does not belong in it.
   */
  onInsertSnippet?: ((snippetId: string) => void) | undefined;
  /** Current body, for the whole-note actions. */
  value: string;
  onReplace: (next: string) => void;
}): JSX.Element {
  return (
    // Sized to its contents rather than spanning the column. A full-width bar
    // of four small buttons reads as a section of the page; a compact one reads
    // as a tool attached to the text above it.
    <div className="flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-surface px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Button label="B" title="Tebal" bold disabled={disabled} onClick={onBold} />
      <Button label="I" title="Miring" italic disabled={disabled} onClick={onItalic} />
      <Button label="•" title="Poin" disabled={disabled} onClick={onBullet} />
      <Button label="1." title="Bernomor" disabled={disabled} onClick={onNumbered} />

      <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />

      <label className="sr-only" htmlFor="insert-section">
        Sisipkan bagian
      </label>
      {/*
        Clinical blocks, not section headings.

        This dropdown used to insert `*O:*` — five characters anyone can type,
        on a screen where the work is the paragraph underneath. These are the
        blocks actually retyped on every admission.
      */}
      {onInsertSnippet ? (
        <select
          id="insert-snippet"
          disabled={disabled}
          value=""
          onChange={(event) => {
            if (event.target.value) onInsertSnippet(event.target.value);
            event.currentTarget.value = '';
          }}
          className="min-h-tap shrink-0 rounded-lg border border-border bg-surface px-2 text-xs text-fg-muted disabled:opacity-40"
        >
          <option value="">Sisipkan…</option>
          {SNIPPETS.map((snippet) => (
            <option key={snippet.id} value={snippet.id}>
              {snippet.label}
            </option>
          ))}
        </select>
      ) : null}
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />

      {/* Both are actions, never automatic. Applying either on paste would edit
          text the moment it arrives, and the one time it guessed wrong there
          would be no way to tell what the original said. */}
      <button
        type="button"
        onClick={() => onReplace(restoreEmphasis(value))}
        title="Kembalikan tebal/miring pada judul"
        className="min-h-tap rounded-lg px-2 text-xs text-fg-muted"
      >
        Aa*
      </button>
      <button
        type="button"
        onClick={() => onReplace(normaliseBullets(value))}
        title="Ubah • menjadi -"
        className="min-h-tap rounded-lg px-2 text-xs text-fg-muted"
      >
        •→-
      </button>
    </div>
  );
}

function Button({
  label,
  title,
  onClick,
  disabled,
  bold,
  italic,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled: boolean;
  bold?: boolean;
  italic?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      // Keep the textarea focused: losing the selection would make the button
      // operate on nothing, and on mobile it would also dismiss the keyboard.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={[
        'min-h-tap min-w-tap shrink-0 rounded-lg text-sm text-fg-muted disabled:opacity-40',
        bold ? 'font-bold' : '',
        italic ? 'italic' : '',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
