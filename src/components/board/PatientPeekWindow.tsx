import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchEntryBodies } from '@/data/repositories/entries.repo';
import { formatShortDate } from '@/domain/clinicalDate';
import type { ClinicalDate, Patient } from '@/domain/types';

/**
 * The peek, as a window you can put somewhere and leave.
 *
 * WHY NOT A SHEET
 *
 * A sheet is modal: it covers the board, and closing it is the only way to see
 * the board again. That is the wrong shape for what this is used for — reading
 * one patient's note WHILE looking at the others, comparing a plan against the
 * card beside it, keeping a note open while typing a report. Every one of
 * those needs both things visible at once, and a sheet makes them alternate.
 *
 * So: a floating panel, dragged by its title bar, that stays where it is put.
 *
 * WHAT IT DELIBERATELY IS NOT
 *
 * Not an editor. It reads one day and offers "Buka pasien"; nothing typed here
 * could be saved anywhere, so there is nothing to type into. A read-only
 * window cannot produce a half-written note in a chart nobody is looking at.
 */
export function PatientPeekWindow({
  patient,
  today,
  onClose,
}: {
  patient: Patient | null;
  today: ClinicalDate;
  onClose: () => void;
}): JSX.Element | null {
  const [body, setBody] = useState<string | null>(null);
  const [date, setDate] = useState<ClinicalDate | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Where the window sits, in viewport pixels.
   *
   * Pixels, not the fractions the board canvas uses, and the difference is the
   * lifetime: a card's position is saved and has to survive a different
   * screen, while this window lives for as long as it is open. Nothing is
   * persisted — reopening puts it back at the default, which is the behaviour
   * of every inspector that is not also a layout.
   */
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 420, h: 380 });
  const dragged = useRef(false);

  useEffect(() => {
    if (!patient) return;
    // Placed once per patient, offset from the top-right, unless the user has
    // already moved it — a window that jumps back on every peek is one you
    // have to reposition every time.
    if (!dragged.current) {
      setPos({ x: Math.max(16, window.innerWidth - 460), y: 96 });
    }
  }, [patient]);

  useEffect(() => {
    if (!patient) return;
    let cancelled = false;
    setLoading(true);
    setBody(null);
    setDate(null);

    void fetchEntryBodies(patient.id)
      .then((days) => {
        if (cancelled) return;
        // Today's, or the most recent with content: "nothing written" and "not
        // yet today" are different answers, and only one of them is useful.
        const chosen = days.find((day) => day.date === today) ?? days[0];
        setBody(chosen?.body ?? '');
        setDate(chosen?.date ?? null);
      })
      .catch((error: unknown) => {
        console.error('[peek] could not read entries', error);
        if (!cancelled) setBody('');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [patient, today]);

  // Escape closes it. A floating window with no keyboard exit is one people
  // lose track of behind other things.
  useEffect(() => {
    if (!patient) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [patient, onClose]);

  if (!patient) return null;

  const beginDrag = (event: React.PointerEvent, mode: 'move' | 'resize'): void => {
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    dragged.current = true;

    const startX = event.clientX;
    const startY = event.clientY;
    // Captured separately rather than as one union, so neither branch has to
    // narrow a shape the other owns.
    const originPos = { ...pos };
    const originSize = { ...size };

    const onMove = (movement: PointerEvent): void => {
      const dx = movement.clientX - startX;
      const dy = movement.clientY - startY;
      if (mode === 'move') {
        // Clamped so the title bar can never leave the viewport — a window
        // dragged past the edge has no handle left to drag it back by.
        setPos({
          x: Math.min(Math.max(originPos.x + dx, 8 - size.w + 80), window.innerWidth - 80),
          y: Math.min(Math.max(originPos.y + dy, 8), window.innerHeight - 48),
        });
      } else {
        setSize({
          w: Math.max(280, originSize.w + dx),
          h: Math.max(180, originSize.h + dy),
        });
      }
    };

    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <div
      role="dialog"
      aria-label={`Pratinjau ${patient.name?.trim() || 'pasien'}`}
      className="fixed z-40 flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      {/*
        The title bar is the drag handle and carries the whole identity.

        On a board of twelve cards this window is often one of several things
        being read at once, and a panel whose header says only "Pratinjau" is
        one you have to click into to identify.
      */}
      <div
        onPointerDown={(event) => beginDrag(event, 'move')}
        className="flex cursor-grab touch-none items-center gap-2 border-b border-border bg-bg-subtle px-3 py-2"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">
            {patient.name?.trim() || 'Tanpa nama'}
          </p>
          <p className="truncate text-[10px] text-fg-muted">
            {date
              ? date === today
                ? 'Catatan hari ini · hanya dibaca'
                : `Catatan ${formatShortDate(date)} · hanya dibaca`
              : 'Hanya dibaca'}
          </p>
        </div>
        <Link
          to={`/p/${patient.id}`}
          className="shrink-0 rounded-lg border border-border px-2 py-1 text-[10px] font-medium text-accent"
        >
          Buka
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup pratinjau"
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-fg-muted"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {loading ? (
          <p className="py-6 text-center text-xs text-fg-muted">Memuat…</p>
        ) : body && body.trim().length > 0 ? (
          /*
            `pre`, not the tinted editor mirror. The mirror exists to line up
            with a textarea being typed into; on a read-only excerpt it is
            machinery with nothing to align to, and plain preformatted text
            cannot drift from the note the way a re-rendered version could.
          */
          <pre className="whitespace-pre-wrap text-[11px] leading-relaxed">{body}</pre>
        ) : (
          <p className="py-6 text-center text-xs text-fg-muted">
            {date ? 'Catatan hari ini masih kosong.' : 'Belum ada catatan.'}
          </p>
        )}
      </div>

      {/* Corner grip. Both axes at once here, unlike the board cards: a window
          has no neighbours to disturb, so there is nothing for a stray pixel
          of the other dimension to break. */}
      <button
        type="button"
        aria-label="Ubah ukuran jendela"
        onPointerDown={(event) => beginDrag(event, 'resize')}
        className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none"
      />
    </div>
  );
}
