import { BodyEditor } from './BodyEditor';
import type { ClinicalDate, SectionAlias, ShiftNote } from '@/domain/types';

/**
 * The editor for one jaga note.
 *
 * A frame around `BodyEditor`, NOT a second editor.
 *
 * It used to reimplement it: its own auto-grow, its own mirror wiring, its own
 * toolbar placement, and a `border` on the textarea where `BodyEditor` uses
 * `border-0`. Every one of those diverged in a way that showed. Ctrl+B did
 * nothing because the key handler lived in the other file. The toolbar sat
 * above the text instead of following it, so on a long note it scrolled out of
 * reach. The tint bands landed a border-width off, because the mirror is
 * positioned against the wrapper and the textarea had an extra edge the mirror
 * did not. And the box came up short, because it grew by a different rule.
 *
 * One editor means those cannot drift apart again. What is genuinely different
 * about a jaga note — the header, the clock, the delete, the way back — lives
 * here, and nothing about editing text does.
 */
export function ShiftNoteEditor({
  note,
  readOnly,
  aliases,
  date,
  tint,
  onChange,
  onBlur,
  onClear,
  onBack,
}: {
  note: ShiftNote;
  readOnly: boolean;
  aliases: readonly SectionAlias[];
  date: ClinicalDate;
  tint: boolean;
  onChange: (body: string) => void;
  onBlur: () => void;
  onClear: () => void;
  onBack: () => void;
}): JSX.Element {
  return (
    <section aria-label={`SOAP jaga jam ${note.time}`}>
      {/*
        A visibly different frame from the daily note.
        
        Skimming the page, the two were the same rectangle of text — the only
        difference was a line of small grey type. A jaga note is written at a
        different hour by a different person about a different complaint, and
        mistaking one for the other while scanning is the failure this frame
        exists to prevent. An accent rule down the left edge and a tinted strip
        across the top say "not the morning round" before anything is read.
      */}
      <div className="mx-4 mt-2 overflow-hidden rounded-lg border border-accent/40 border-l-4 border-l-accent">
        <div className="flex items-center gap-2 bg-accent/10 px-3 py-1.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Kembali ke SOAP hari ini"
            className="min-h-tap shrink-0 text-xs text-accent"
          >
            ← SOAP hari ini
          </button>
          <span className="min-w-0 flex-1 truncate text-right text-xs font-semibold text-accent">
            SOAP jaga · {note.time}
          </span>
          <button
            type="button"
            disabled={readOnly}
            onClick={onClear}
            aria-label={`Hapus SOAP jaga jam ${note.time}`}
            className="min-h-tap min-w-tap shrink-0 text-fg-faint disabled:opacity-40"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {/*
          `snippets={false}`: the admission anamnesis and risk-factor blocks
          belong to a first-day note, not to a shift review of one complaint.

          A shorter opening height for the same reason — a jaga note is a
          paragraph, and half a screen of empty box invites it to be written
          like a daily SOAP.
        */}
        <BodyEditor
          value={note.body}
          onChange={onChange}
          onBlur={onBlur}
          aliases={aliases}
          date={date}
          tint={tint}
          readOnly={readOnly}
          snippets={false}
          minHeightClass="min-h-[30vh]"
          placeholder="Keluhan saat jaga…"
        />
      </div>
    </section>
  );
}
