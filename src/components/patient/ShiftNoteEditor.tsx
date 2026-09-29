import { useEffect, useRef, useState } from 'react';

import { parseShiftTime } from '@/domain/shiftNotes';

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
  watermark,
  onChange,
  onBlur,
  onClear,
  onBack,
  onTime,
  focusAt,
}: {
  note: ShiftNote;
  readOnly: boolean;
  aliases: readonly SectionAlias[];
  date: ClinicalDate;
  tint: boolean;
  /** Passed straight through; the jaga note needs the same guard. */
  watermark?:
    | { name: string; mrn: string; date: string; opacity?: number; mode?: 'ulang' | 'mengambang' }
    | undefined;
  onChange: (body: string) => void;
  onBlur: () => void;
  onClear: () => void;
  onBack: () => void;
  /** Correct the time stamp. */
  onTime: (time: string) => void;
  /** Put the caret here once, when a new note is opened. */
  focusAt?: number | undefined;
}): JSX.Element {
  const [confirming, setConfirming] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [timeDraft, setTimeDraft] = useState(note.time);
  const frame = useRef<HTMLDivElement>(null);

  // A new note opens with the caret on the complaint line, ready to type.
  useEffect(() => {
    if (focusAt === undefined) return;
    const textarea = frame.current?.querySelector('textarea');
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(focusAt, focusAt);
  }, [focusAt, note.id]);

  const commitTime = (): void => {
    const parsed = parseShiftTime(timeDraft);
    if (parsed && parsed !== note.time) onTime(parsed);
    setTimeDraft(parsed ?? note.time);
    setEditingTime(false);
  };

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
      {/*
        No `overflow-hidden` on this frame.
        
        It was there to keep the header strip inside the rounded corners, and
        it broke the editor: `position: sticky` cannot escape a clipping
        ancestor, so the toolbar — which is `sticky bottom-0` inside
        `BodyEditor` — stopped following the viewport and parked on the frame's
        bottom edge, sitting on top of the last lines of the note. That is the
        "cut off at the bottom" here; the text was never missing, it was
        underneath the toolbar.
        
        The header keeps its own rounded top corners instead, which costs one
        class and clips nothing.
      */}
      {/*
        A FLEX COLUMN, because that is what `BodyEditor` expects to live in.
        
        Its root is `flex min-h-0 flex-1 flex-col`. Dropped into a plain block
        this frame used to be, `min-h-0` applied with no flex parent to grow it
        against — so the editor was confined to whatever height it happened to
        get, the textarea overflowed inside it, and arrow keys scrolled the
        text within the frame instead of moving the page. That is the note
        being cut at both ends.
      */}
      <div ref={frame} className="mx-4 mt-2 flex flex-col rounded-lg border border-accent border-l-4 border-l-accent">
        <div className="flex items-center gap-2 rounded-t-md bg-[var(--accent-soft)] px-3 py-1.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Kembali ke SOAP hari ini"
            className="min-h-tap shrink-0 text-xs text-accent"
          >
            ← SOAP hari ini
          </button>
          {/*
            The time is editable: a jaga note is often written up after the
            event, and the stamp from the tap was then simply wrong.
          */}
          <span className="flex min-w-0 flex-1 items-center justify-end gap-1 text-xs font-semibold text-accent">
            SOAP jaga ·
            {editingTime ? (
              <input
                autoFocus
                value={timeDraft}
                inputMode="numeric"
                aria-label="Jam SOAP jaga"
                onChange={(event) => setTimeDraft(event.target.value)}
                onBlur={commitTime}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitTime();
                  if (event.key === 'Escape') {
                    setTimeDraft(note.time);
                    setEditingTime(false);
                  }
                }}
                className="w-16 rounded border border-accent bg-surface px-1 py-0.5 text-center text-xs text-fg"
              />
            ) : (
              <button
                type="button"
                disabled={readOnly}
                onClick={() => {
                  setTimeDraft(note.time);
                  setEditingTime(true);
                }}
                title="Ubah jam"
                className="min-h-tap rounded px-1 underline decoration-dotted underline-offset-2 disabled:no-underline"
              >
                {note.time}
              </button>
            )}
          </span>
          {/*
            Two taps to delete.
            
            The × sits a few pixels from "← SOAP hari ini", on a header that is
            tapped constantly, and it removes a note that was written at 03.00
            about something that had just happened. Everything else in this app
            that destroys work asks first; this was the one place that did not.
          */}
          {confirming ? (
            <>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="min-h-tap shrink-0 rounded px-2 text-xs text-fg-muted"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  onClear();
                }}
                className="min-h-tap shrink-0 rounded px-2 text-xs font-medium text-danger"
              >
                Hapus
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setConfirming(true)}
              aria-label={`Hapus SOAP jaga jam ${note.time}`}
              className="min-h-tap min-w-tap shrink-0 text-fg-faint disabled:opacity-40"
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
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
          watermark={watermark}
          minHeightClass="min-h-[30vh]"
          placeholder="Keluhan saat jaga…"
        />
      </div>
    </section>
  );
}
