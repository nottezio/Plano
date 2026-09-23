import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  removeBoardNote,
  setBoardNoteColor,
  setBoardNoteText,
} from '@/data/repositories/boardNotes.repo';
import {
  addImageToNote,
  copyImageToClipboard,
  loadBoardImage,
  removeImageFromNote,
} from '@/data/repositories/boardImages.repo';
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
  const [dropping, setDropping] = useState(false);
  const [imageStatus, setImageStatus] = useState<string | null>(null);

  /**
   * Images from a drop or a paste. Each is compressed and stored as its own
   * document (see `boardImages.repo`), one after another so the note shows
   * them in the order they were given.
   */
  const attach = async (files: readonly File[]): Promise<void> => {
    const images = files.filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) return;
    setImageStatus(images.length === 1 ? 'Mengunggah gambar…' : `Mengunggah ${String(images.length)} gambar…`);
    try {
      for (const image of images) await addImageToNote(uid, id, image);
      setImageStatus(null);
    } catch (error) {
      setImageStatus(error instanceof Error ? error.message : 'Gambar gagal diunggah.');
    }
  };
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

  /*
    Bounds from what the note CONTAINS, not a fixed range.

    It reported 96–640px whatever was in it, which was fine for text — the
    text scrolls inside — and wrong once images arrived: an image does not
    scroll, so under a small cap it was simply clipped. Now the minimum is
    everything except the text area, plus one line of text, and the maximum is
    everything at its natural height. The canvas enforces the minimum.
  */
  useLayoutEffect(() => {
    const root = rootRef.current;
    const area = areaRef.current;
    if (!fitHeight || !onHeightBounds || !root || !area) return undefined;
    const ONE_LINE = 28;
    const measure = (): void => {
      const fixed = root.scrollHeight - area.clientHeight;
      onHeightBounds({
        min: Math.round(fixed + ONE_LINE),
        max: Math.round(fixed + Math.max(area.scrollHeight, ONE_LINE)),
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(area);
    measure();
    return () => observer.disconnect();
  }, [fitHeight, onHeightBounds, note.images]);

  useEffect(() => {
    if (!armed) return undefined;
    const handle = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(handle);
  }, [armed]);

  const tone = stickyTone(note.color);

  return (
    <div
      ref={rootRef}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        if (!dropping) setDropping(true);
      }}
      onDragLeave={(event) => {
        // Leaving INTO a child is not leaving the note.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        setDropping(false);
        void attach([...event.dataTransfer.files]);
      }}
      style={{ backgroundColor: tone.bg, color: tone.fg }}
      className={[
        /*
          Made to look like PAPER, not like a card, because on a board of
          patient cards the one thing a note must never be is mistaken for a
          patient. A patient card is a rounded box with a header band; this has
          square-ish corners, a strip of tape across the top, a folded corner
          at the bottom right, a tilt, and no header band at all.
        */
        'group relative rounded-sm pt-2 shadow-[0_6px_14px_rgba(0,0,0,0.35)]',
        '[transform:rotate(-0.6deg)]',
        dropping ? 'outline-dashed outline-2 outline-offset-2 outline-current' : '',
        fitHeight ? 'flex h-full flex-col' : '',
      ].join(' ')}
    >
      {/* The tape. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-2 left-1/2 h-4 w-16 -translate-x-1/2 rotate-2 rounded-[2px] bg-white/45 shadow-sm"
      />
      {/* The folded corner. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 bg-[linear-gradient(135deg,transparent_50%,rgba(0,0,0,0.22)_50%)]"
      />
      <div className="flex items-center gap-1 px-2 pt-1.5">
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">
          📌 Catatan
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
          aria-label={armed ? 'Ketuk lagi untuk menghapus' : 'Hapus catatan'}
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
        onPaste={(event) => {
          // An image pasted INTO the text becomes an attachment, not a
          // filename in the text. Text pastes are left entirely alone.
          const files = [...event.clipboardData.files].filter((file) =>
            file.type.startsWith('image/'),
          );
          if (files.length === 0) return;
          event.preventDefault();
          void attach(files);
        }}
        value={text}
        onChange={(event) => change(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          flush();
        }}
        placeholder="Tulis catatan…"
        aria-label="Isi catatan"
        spellCheck
        className={[
          'w-full resize-none bg-transparent px-2.5 pb-2.5 pt-1 text-sm leading-snug outline-none placeholder:opacity-50',
          fitHeight ? 'min-h-0 flex-1 overflow-y-auto' : 'overflow-hidden',
        ].join(' ')}
        style={{ color: tone.fg }}
      />

      {(note.images ?? []).length > 0 ? (
        <div className={['space-y-1.5 px-2.5 pb-3', fitHeight ? 'shrink-0' : ''].join(' ')}>
          {(note.images ?? []).map((imageId) => (
            <NoteImage key={imageId} uid={uid} noteId={id} imageId={imageId} />
          ))}
        </div>
      ) : null}

      {imageStatus ? (
        <p role="status" className="px-2.5 pb-2 text-[11px] opacity-70">
          {imageStatus}
        </p>
      ) : dropping ? (
        <p className="px-2.5 pb-2 text-[11px] font-medium">Lepaskan untuk menempel gambar</p>
      ) : null}
    </div>
  );
}

/**
 * One attached image, with the two things it is for: seeing it, and taking
 * it somewhere else.
 *
 * Copy puts the IMAGE on the clipboard, so it pastes into WhatsApp or a
 * document as a picture. A right-click → copy on the `<img>` works too; the
 * button is for the phone, where there is no right-click.
 */
function NoteImage({
  uid,
  noteId,
  imageId,
}: {
  uid: string;
  noteId: string;
  imageId: string;
}): JSX.Element {
  const [src, setSrc] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void loadBoardImage(uid, imageId).then((value) => {
      if (alive) setSrc(value);
    });
    return () => {
      alive = false;
    };
  }, [uid, imageId]);

  if (src === undefined) {
    return <div className="h-16 animate-pulse rounded bg-black/10" aria-label="Memuat gambar" />;
  }
  if (src === null) {
    return <p className="text-[11px] opacity-60">Gambar tidak bisa dimuat.</p>;
  }

  return (
    <figure className="group/img relative">
      <img
        src={src}
        alt="Gambar di catatan"
        className="max-h-48 w-full rounded border border-black/15 bg-white object-contain"
        draggable={false}
      />
      <div className="absolute right-1 top-1 hidden gap-1 group-hover/img:flex">
        <button
          type="button"
          onClick={() => {
            void copyImageToClipboard(src)
              .then(() => setCopied('Tersalin'))
              .catch((error: unknown) =>
                setCopied(error instanceof Error ? error.message : 'Gagal menyalin'),
              )
              .finally(() => window.setTimeout(() => setCopied(null), 2500));
          }}
          className="min-h-tap rounded bg-black/70 px-2 text-[11px] font-medium text-white"
        >
          Salin
        </button>
        <button
          type="button"
          onClick={() =>
            void removeImageFromNote(uid, noteId, imageId).catch((error: unknown) =>
              console.error('[sticky] detach failed', error),
            )
          }
          aria-label="Lepas gambar dari catatan"
          className="min-h-tap min-w-tap rounded bg-black/70 text-sm text-white"
        >
          ×
        </button>
      </div>
      {copied ? (
        <figcaption role="status" className="mt-0.5 text-[11px] opacity-80">
          {copied}
        </figcaption>
      ) : null}
    </figure>
  );
}
