import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  removeBoardNote,
  setBoardNoteColor,
  setBoardNoteText,
} from '@/data/repositories/boardNotes.repo';
import { STICKY_COLORS, stickyTone, type BoardNote, type StickyColor } from '@/domain/boardNotes';

/**
 * A sticky note on the patient board, edited where it sits.
 *
 * There is no page behind it and no sheet: the note IS the card. Typing goes
 * straight into it and saves after a pause, the way a paper note is written
 * where it is stuck rather than taken somewhere to be written.
 *
 * On the canvas it is moved and resized by the same handle and grips as a
 * patient card — the canvas does not know or care which of the two it is
 * holding. It honours the same height contract as `PatientCard`: under
 * `fitHeight` it fills the height the canvas gives it and scrolls inside, and
 * it reports the range the height grip may use.
 */
export function StickyNoteCard({
  uid,
  id,
  note,
  fitHeight = false,
  onHeightBounds,
}: {
  uid: string;
  id: string;
  note: BoardNote;
  fitHeight?: boolean;
  onHeightBounds?: ((bounds: { min: number; max: number }) => void) | undefined;
}): JSX.Element {
  const [text, setText] = useState(note.text);
  const [focused, setFocused] = useState(false);
  const [armed, setArmed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const timer = useRef(0);
  const pending = useRef<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  /**
   * Follow the stored text — but never while typing.
   *
   * A write from this device echoes back a moment later, and an edit from the
   * other device can land at any time. Replacing the text under a caret moves
   * the caret and eats whatever was typed in between, so while the note has
   * focus it keeps its own text and the echo is ignored; on blur it catches up.
   */
  useEffect(() => {
    if (!focused && pending.current === null) setText(note.text);
  }, [note.text, focused]);

  const flush = (): void => {
    window.clearTimeout(timer.current);
    const value = pending.current;
    if (value === null) return;
    pending.current = null;
    void setBoardNoteText(uid, id, value).catch((error: unknown) =>
      console.error('[sticky] save rejected', error),
    );
  };

  // A note left mid-sentence is saved when the board unmounts, not dropped.
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps -- unmount-only flush; `flush` reads refs, not state.

  const change = (value: string): void => {
    setText(value);
    pending.current = value;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 600);
  };

  /*
    Grow with the text in masonry, where the note sets its own height. Under
    `fitHeight` the canvas owns the height and the textarea scrolls instead.
  */
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area || fitHeight) return;
    area.style.height = 'auto';
    area.style.height = `${Math.max(area.scrollHeight, 72)}px`;
  }, [text, fitHeight]);

  useLayoutEffect(() => {
    if (!fitHeight || !onHeightBounds || !rootRef.current) return;
    // A note is short by nature; the grip may make it anything from a strip
    // to a tall column, and nothing inside it needs a minimum beyond one line.
    onHeightBounds({ min: 96, max: 640 });
  }, [fitHeight, onHeightBounds]);

  useEffect(() => {
    if (!armed) return undefined;
    const handle = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(handle);
  }, [armed]);

  const tone = stickyTone(note.color);

  return (
    <div
      ref={rootRef}
      style={{ backgroundColor: tone.bg, color: tone.fg }}
      className={[
        'group relative rounded-lg shadow-md',
        // A slight tilt is the cheapest way to say "this is not a patient".
        '[transform:rotate(-0.4deg)]',
        fitHeight ? 'flex h-full flex-col' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-1 px-2 pt-1.5">
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">
          Catatan tempel
        </span>

        {/* Colour: a dot that opens the palette in place. */}
        <button
          type="button"
          onClick={() => setPaletteOpen((open) => !open)}
          aria-expanded={paletteOpen}
          aria-label="Ganti warna"
          title="Ganti warna"
          className="flex min-h-tap min-w-tap items-center justify-center"
        >
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 rounded-full border border-black/20"
            style={{ backgroundColor: tone.fg }}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            flush();
            void removeBoardNote(uid, id).catch((error: unknown) =>
              console.error('[sticky] remove rejected', error),
            );
          }}
          aria-label={armed ? 'Ketuk lagi untuk menghapus' : 'Hapus catatan tempel'}
          title={armed ? 'Ketuk lagi untuk menghapus' : 'Hapus'}
          className={[
            'flex min-h-tap min-w-tap items-center justify-center rounded text-sm',
            armed ? 'bg-black/15 font-semibold' : 'opacity-60',
          ].join(' ')}
        >
          {armed ? 'Hapus?' : '×'}
        </button>
      </div>

      {paletteOpen ? (
        <div role="group" aria-label="Warna" className="flex flex-wrap gap-1.5 px-2 pb-1">
          {STICKY_COLORS.map((color) => {
            const swatch = stickyTone(color.id);
            return (
              <button
                key={color.id}
                type="button"
                onClick={() => {
                  setPaletteOpen(false);
                  if (color.id === note.color) return;
                  void setBoardNoteColor(uid, id, color.id as StickyColor).catch(
                    (error: unknown) => console.error('[sticky] colour rejected', error),
                  );
                }}
                aria-label={color.label}
                aria-pressed={color.id === note.color}
                title={color.label}
                className={[
                  'h-7 w-7 rounded-full border-2',
                  color.id === note.color ? 'border-black/50' : 'border-black/10',
                ].join(' ')}
                style={{ backgroundColor: swatch.bg }}
              />
            );
          })}
        </div>
      ) : null}

      <textarea
        ref={areaRef}
        value={text}
        onChange={(event) => change(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          flush();
        }}
        placeholder="Tulis catatan…"
        aria-label="Isi catatan tempel"
        spellCheck
        className={[
          'w-full resize-none bg-transparent px-2.5 pb-2.5 pt-1 text-sm leading-snug outline-none placeholder:opacity-50',
          fitHeight ? 'min-h-0 flex-1 overflow-y-auto' : 'overflow-hidden',
        ].join(' ')}
        style={{ color: tone.fg }}
      />
    </div>
  );
}
