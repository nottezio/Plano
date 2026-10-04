import { useEffect, useMemo, useRef, useState } from 'react';

import { latestPenunjangOnly } from '@/domain/penunjang';
import { isVersion, noteLabel, parseShiftTime } from '@/domain/shiftNotes';

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
  onRename,
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
  /** Name the note; '' returns it to its default name. */
  onRename: (title: string) => void;
  /** Put the caret here once, when a new note is opened. */
  focusAt?: number | undefined;
}): JSX.Element {
  const [confirming, setConfirming] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [timeDraft, setTimeDraft] = useState(note.time);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(note.title ?? '');
  const frame = useRef<HTMLDivElement>(null);
  const version = isVersion(note);
  const kindLabel = version ? 'Versi SOAP' : 'SOAP jaga';

  const commitTitle = (): void => {
    if (titleDraft.trim() !== (note.title ?? '').trim()) onRename(titleDraft);
    setEditingTitle(false);
  };

  /*
    Offered on a version only, and only when it would remove something. The
    version is a copy, so this edits nothing the day's SOAP depends on.
  */
  const trim = useMemo(
    () => (version && !readOnly ? latestPenunjangOnly(note.body, aliases) : null),
    [version, readOnly, note.body, aliases],
  );

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
    <section aria-label={`${kindLabel} ${noteLabel(note)}`}>
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
            {/*
              The name is editable on every note: a version is named for its
              reader ("Versi dr. AHA"), and a jaga note can be, too.
            */}
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                placeholder={version ? 'Versi' : `Jaga ${note.time}`}
                aria-label="Nama catatan"
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={commitTitle}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitTitle();
                  if (event.key === 'Escape') {
                    setTitleDraft(note.title ?? '');
                    setEditingTitle(false);
                  }
                }}
                className="w-40 min-w-0 rounded border border-accent bg-surface px-1 py-0.5 text-xs text-fg"
              />
            ) : (
              <button
                type="button"
                disabled={readOnly}
                onClick={() => {
                  setTitleDraft(note.title ?? '');
                  setEditingTitle(true);
                }}
                title="Ubah nama"
                className="min-h-tap min-w-0 truncate rounded px-1 underline decoration-dotted underline-offset-2 disabled:no-underline"
              >
                {version || note.title ? noteLabel(note) : 'SOAP jaga'}
              </button>
            )}
            {version ? null : (
              <>
                ·
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
                    className="min-h-tap shrink-0 rounded px-1 underline decoration-dotted underline-offset-2 disabled:no-underline"
                  >
                    {note.time}
                  </button>
                )}
              </>
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
              aria-label={`Hapus ${kindLabel.toLowerCase()} ${noteLabel(note)}`}
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
        {trim && trim.removed.length > 0 ? (
          <div className="flex items-center gap-2 border-b border-border px-3 py-1 text-[11px] text-fg-muted">
            <span className="min-w-0 flex-1">
              {trim.removed.length} blok penunjang lama di versi ini.
            </span>
            <button
              type="button"
              onClick={() => onChange(trim.text)}
              className="min-h-tap shrink-0 font-medium text-accent underline"
            >
              Penunjang terbaru saja
            </button>
          </div>
        ) : null}
        {/*
          A version is a full SOAP and gets the full editor: snippets and the
          day note's height. A jaga note stays the short review it is.
        */}
        <BodyEditor
          value={note.body}
          onChange={onChange}
          onBlur={onBlur}
          aliases={aliases}
          date={date}
          tint={tint}
          readOnly={readOnly}
          snippets={version}
          watermark={watermark}
          minHeightClass={version ? 'min-h-[55vh]' : 'min-h-[30vh]'}
          placeholder={version ? 'Tulis versi SOAP…' : 'Keluhan saat jaga…'}
        />
      </div>
    </section>
  );
}
