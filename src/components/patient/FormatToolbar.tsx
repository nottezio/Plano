import { sortedAliases } from '@/domain/sections/aliases';
import type { SectionAlias } from '@/domain/types';
import { normaliseBullets, restoreEmphasis } from '@/domain/format/markdownLite';

/**
 * SPEC F4 — Bold, Italic, Bullet, and "Sisipkan bagian".
 *
 * The last button is the entire structure story: it inserts a recognised
 * header line at the caret, which is how the user opts INTO parseable
 * structure. There are no S/O/A/P input boxes and there never will be — the
 * spec rejects them explicitly, and this button is what replaces them.
 */
export function FormatToolbar({
  aliases,
  disabled,
  onBold,
  onItalic,
  onBullet,
  onNumbered,
  onInsertSection,
  onShiftNote,
  value,
  onReplace,
}: {
  aliases: readonly SectionAlias[];
  disabled: boolean;
  onBold: () => void;
  onItalic: () => void;
  onBullet: () => void;
  onNumbered: () => void;
  onInsertSection: (label: string) => void;
  onShiftNote: () => void;
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
      <select
        id="insert-section"
        disabled={disabled}
        value=""
        onChange={(event) => {
          if (event.target.value) onInsertSection(event.target.value);
          event.currentTarget.value = '';
        }}
        className="min-h-tap shrink-0 rounded-lg border border-border bg-surface px-2 text-xs text-fg-muted disabled:opacity-40"
      >
        <option value="">Sisipkan bagian…</option>
        {sortedAliases([...aliases]).map((alias) => (
          <option key={alias.sectionId} value={alias.label}>
            {alias.label}
          </option>
        ))}
      </select>
      {/*
        The shift note is NOT in the "Sisipkan bagian" list above.

        That list inserts a header at the caret; this appends a timestamped
        block at the end of the note, and it stamps the clock. Two different
        actions with two different results should not share one control just
        because both put a heading in the body — picking "SOAP Jaga" from a
        dropdown of section names would reasonably be expected to behave like
        picking "Terapi" from the same dropdown, and it does not.
      */}
      <button
        type="button"
        disabled={disabled}
        onClick={onShiftNote}
        title="Tambah SOAP jaga (blok terpisah di akhir catatan)"
        className="min-h-tap shrink-0 rounded-lg px-2 text-xs text-fg-muted disabled:opacity-40"
      >
        + Jaga
      </button>

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
