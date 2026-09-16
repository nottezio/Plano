import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchEntryBodies } from '@/data/repositories/entries.repo';
import { formatShortDate } from '@/domain/clinicalDate';
import { toPlain, toWhatsApp } from '@/domain/format/formatters';
import { useChecklist } from '@/hooks/useChecklist';
import { usePatientNotes } from '@/components/patient/PatientNotes';
import { useSession } from '@/store/useSession';
import { copyText } from '@/lib/clipboard';
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
  index,
  z,
  onFocus,
  onClose,
}: {
  patient: Patient;
  today: ClinicalDate;
  /** Position in the open stack, used to cascade the first placement. */
  index: number;
  z: number;
  onFocus: () => void;
  onClose: () => void;
}): JSX.Element {
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

  const settings = useSession((state) => state.settings());
  /*
    The checklist and the standing note are read for the day ON SCREEN, which
    is not always today — a window opened on an older note must show that day's
    ticks, not this morning's.
  */
  const checklist = useChecklist(patient.id, date ?? today, settings.checklistItems, date !== null);
  const notes = usePatientNotes(patient);

  useEffect(() => {
    // Placed once, offset from the top-right and CASCADED by how many are
    // already open — two windows landing on the same pixel look like one, and
    // the second appears not to have opened at all.
    if (!dragged.current) {
      const step = index * 28;
      setPos({
        x: Math.max(16, window.innerWidth - 460 - step),
        y: 96 + step,
      });
    }
  }, [patient.id, index]);

  useEffect(() => {
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
  }, [patient.id, today]);

  // Escape closes it. A floating window with no keyboard exit is one people
  // lose track of behind other things.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const beginDrag = (event: React.PointerEvent, mode: 'move' | 'resize'): void => {
    /*
      A press that started on a control is not a drag.

      The title bar is the drag handle AND carries Buka and ✕, and this handler
      called `setPointerCapture` on every pointerdown in it. Capture retargets
      every subsequent pointer event to the capturing element, so the pointerup
      never reached the button underneath and no click was ever generated —
      both controls were dead, while the bar itself dragged perfectly.

      Checked on the TARGET rather than by putting the handler elsewhere,
      because the whole bar should stay draggable: the gap around the title is
      the obvious place to grab a window from, and moving the handler to the
      title text alone would trade two broken buttons for a handle nobody can
      find.

      `mode` guards the resize grip, which is itself a button and whose own
      press must start a drag.
    */
    if (mode === 'move' && (event.target as HTMLElement).closest('button, a')) return;

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
      onPointerDownCapture={onFocus}
      className="fixed flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h, zIndex: z }}
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
          {/*
            The date is a chip, not a sentence.

            With several of these open at once, "hanya dibaca" is the same on
            every one and the date is the only thing that differs — and a note
            from three days ago read as today's is the mistake this exists to
            prevent.
          */}
          <p className="flex items-center gap-1 text-[10px] text-fg-muted">
            <span
              className={[
                'rounded px-1 font-medium',
                date === today ? 'bg-accent/15 text-accent' : 'bg-danger/15 text-danger',
              ].join(' ')}
            >
              {date ? (date === today ? 'Hari ini' : formatShortDate(date)) : '—'}
            </span>
            <span className="truncate">hanya dibaca</span>
          </p>
        </div>
        {/*
          Salin, in the two formats that actually leave this app.

          Not the full Salin sheet: that offers sections, presets, a preview
          and an identity line, and a 420 px window is not where any of that is
          chosen. What is wanted from a peek is the whole note, now, in the
          form it is about to be pasted into — so the two destinations are two
          buttons and there is nothing to configure.

          `toPlain` guarantees ASCII for SIMGOS; `toWhatsApp` keeps the
          markers. Both are the same functions the main sheet uses, so a note
          copied from here and one copied from there are identical.
        */}
        {body && body.trim() ? (
          <>
            <CopyButton label="SIMGOS" text={() => toPlain(body)} />
            <CopyButton label="WA" text={() => toWhatsApp(body, settings.whatsappBullet)} />
          </>
        ) : null}

        <Link
          to={`/p/${patient.id}`}
          className="flex min-h-tap shrink-0 items-center rounded-lg border border-border px-2 text-[10px] font-medium text-accent"
        >
          Buka
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup pratinjau"
          className="min-h-tap min-w-tap shrink-0 rounded-lg text-xs text-fg-muted"
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

      {/*
        Checklist and standing note, collapsed by default.

        Both are the reason somebody peeks at a patient they are not opening —
        "did anyone do the EKG" and "what was the access problem" — and both
        are short. Collapsed because the note is what the window is for and
        these two would push it below the fold on a small window; remembered
        per window, not persisted, because a window is a moment.
      */}
      <Collapsible label={`Checklist · ${checklist.progress.doneCount}/${checklist.progress.total}`}>
        <ul className="space-y-1">
          {settings.checklistItems.map((item) => (
            <li key={item.id}>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={checklist.states[item.id]?.done === true}
                  onChange={() => checklist.toggle(item.id)}
                  className="mt-0.5 h-3.5 w-3.5"
                />
                <span
                  className={
                    checklist.states[item.id]?.done ? 'text-fg-faint line-through' : undefined
                  }
                >
                  {item.label}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Collapsible>

      <Collapsible label="Catatan pasien">
        {notes.value.trim() ? (
          <p className="whitespace-pre-line">{notes.value}</p>
        ) : (
          <p className="text-fg-faint">Belum ada catatan tetap.</p>
        )}
      </Collapsible>

      {/* Corner grip. Both axes at once here, unlike the board cards: a window
          has no neighbours to disturb, so there is nothing for a stray pixel
          of the other dimension to break. */}
      <button
        type="button"
        aria-label="Ubah ukuran jendela"
        title="Tarik untuk ubah ukuran"
        onPointerDown={(event) => beginDrag(event, 'resize')}
        className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize touch-none"
      >
        {/*
          A visible grip, because an invisible one is a feature nobody finds.

          Two short strokes in the corner — the convention every desktop window
          uses — drawn in the border colour so it reads as part of the frame
          rather than as a control competing with the buttons above.
        */}
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-full w-full text-border">
          <path
            d="M15 6 L6 15 M15 11 L11 15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </button>
    </div>
  );
}


/** One copy target. Keeps its own "Tersalin" so two buttons cannot confuse it. */
function CopyButton({ label, text }: { label: string; text: () => string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void copyText(text());
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      title={`Salin catatan untuk ${label}`}
      className="min-h-tap shrink-0 rounded-lg border border-border px-2 text-[10px] font-medium"
    >
      {copied ? '✓' : label}
    </button>
  );
}

/**
 * A strip that opens. Closed by default and not remembered.
 *
 * A window is a moment — it is opened to answer one question and closed again
 * — so persisting which strips were open would restore the state of a question
 * somebody already finished asking.
 */
function Collapsible({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className="shrink-0 border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex min-h-tap w-full items-center gap-1 px-3 text-left text-[11px] font-medium text-fg-muted"
      >
        <span aria-hidden="true" className="w-3">
          {open ? '▾' : '▸'}
        </span>
        {label}
      </button>
      {open ? <div className="max-h-40 overflow-auto px-3 pb-2 text-[11px]">{children}</div> : null}
    </div>
  );
}