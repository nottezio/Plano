import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchEntryBodies } from '@/data/repositories/entries.repo';
import { formatShortDate } from '@/domain/clinicalDate';
import { toPlain, toWhatsApp } from '@/domain/format/formatters';
import { useChecklist } from '@/hooks/useChecklist';
import { usePatientNotes } from '@/components/patient/PatientNotes';
import { PatientTodos } from '@/components/patient/PatientTodos';
import { todoViews } from '@/domain/patientTodos';
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
  const [tab, setTab] = useState<PeekTab | null>(null);
  /**
   * How the note is SHOWN: as written, or as SIMGOS or WhatsApp would receive
   * it. Changing the view writes nothing to the clipboard.
   *
   * The buttons used to copy the whole note. Here the window is the staging
   * area instead: pick the destination, see exactly what it will get, then
   * select the part that is needed. That is a different job from the Salin
   * sheet on the patient page, which copies and changes nothing on screen.
   */
  const [view, setView] = useState<PeekView>('asli');
  const panelId = useId();
  // Pressing the open tab closes it; pressing another switches straight to it.
  const toggleTab = (next: PeekTab): void =>
    setTab((current) => (current === next ? null : next));
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

  /*
    The custom checklist's counts are computed here only for the strip's label.
    The strip itself renders the real `PatientTodos`, so ticking, adding and
    importing behave exactly as they do on the patient page — a second,
    read-only copy would be a second thing to keep in step, and the first time
    they disagreed nobody would know which was right.
  */
  const todoCounts = (() => {
    const views = todoViews(patient.todos ?? [], patient.todoTicks, date ?? today);
    return { done: views.filter((view) => view.done).length, total: views.length };
  })();

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
          // 360, not 280: the title bar now carries Salin RM beside the two
          // view switches, Buka and ✕, all fixed-width. Below this the
          // patient's name — the one thing that identifies the window — was
          // the only part left to shrink, and it shrank to nothing.
          w: Math.max(360, originSize.w + dx),
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

  const shown =
    body === null
      ? ''
      : view === 'simgos'
        ? toPlain(body)
        : view === 'wa'
          ? toWhatsApp(body, settings.whatsappBullet)
          : body;

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
            {patient.mrn ? (
              <span className="shrink-0 font-mono">RM {patient.mrn}</span>
            ) : null}
            <span className="truncate">
              {view === 'asli' ? 'hanya dibaca' : `tampilan ${view === 'simgos' ? 'SIMGOS' : 'WA'}`}
            </span>
          </p>
        </div>
        {patient.mrn ? <CopyMrnButton mrn={patient.mrn} /> : null}
        {body && body.trim() ? (
          <div role="group" aria-label="Tampilan catatan" className="flex shrink-0 gap-1">
            <ViewToggle
              label="SIMGOS"
              pressed={view === 'simgos'}
              onPress={() => setView((current) => (current === 'simgos' ? 'asli' : 'simgos'))}
            />
            <ViewToggle
              label="WA"
              pressed={view === 'wa'}
              onPress={() => setView((current) => (current === 'wa' ? 'asli' : 'wa'))}
            />
          </div>
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
          <pre
            // Tells the copy sanitiser what is on screen, so selecting from
            // the WA view keeps `°` and selecting from the SIMGOS view folds
            // it. Per window, because each window can show a different view.
            // As written: no declaration, so the app-wide default applies.
            data-copy-format={
              view === 'wa' ? 'whatsapp' : view === 'simgos' ? 'plain' : undefined
            }
            className="whitespace-pre-wrap text-[11px] leading-relaxed"
          >
            {shown}
          </pre>
        ) : (
          <p className="py-6 text-center text-xs text-fg-muted">
            {date ? 'Catatan hari ini masih kosong.' : 'Belum ada catatan.'}
          </p>
        )}
      </div>

      {/*
        Checklist, Custom Checklist and the standing note: ONE row of tabs,
        one panel open at a time.

        They were three stacked strips, each a full-width 44 px row. Closed,
        that was ~135 px of a 380 px window spent on labels, leaving the note
        (the reason the window exists) a third of the height. Open, each strip
        added its own 160 px panel and nothing stopped all three being open at
        once, so the note could be squeezed to nothing. Stacked accordions SUM;
        a tab row costs one row whatever it holds, and a single panel slot
        caps what opening can take.

        The panel opens ABOVE the row, so the tabs never move: switching from
        Checklist to Catatan is two presses on the same spot, not a hunt for
        where the row went.

        What is open is not remembered. A window is a moment — opened to answer
        one question and closed again — so restoring it would restore the
        state of a question somebody already finished asking.
      */}
      {tab ? (
        <div
          id={panelId}
          className="max-h-[45%] shrink-0 overflow-auto border-t border-border px-3 py-2 text-[11px]"
        >
          {tab === 'checklist' ? (
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
          ) : tab === 'todos' ? (
            <PatientTodos patient={patient} date={date ?? today} compact />
          ) : notes.value.trim() ? (
            <p className="whitespace-pre-line">{notes.value}</p>
          ) : (
            <p className="text-fg-faint">Belum ada catatan tetap.</p>
          )}
        </div>
      ) : null}

      {/*
        `pr-6` keeps the last tab clear of the resize grip, which sits over
        this row's corner. No wrapping: a tab that wrapped would become a 44 px
        blank line (CHANGES, recurring pattern 7). Labels truncate instead,
        and the count — the part actually read at a glance — never does.
      */}
      <div className="flex shrink-0 items-stretch gap-1 border-t border-border bg-bg-subtle px-1 pr-6">
        <DockTab
          label="Checklist"
          count={
            checklist.progress.total > 0
              ? { done: checklist.progress.doneCount, total: checklist.progress.total }
              : null
          }
          open={tab === 'checklist'}
          panelId={panelId}
          onToggle={() => toggleTab('checklist')}
        />
        <DockTab
          label="Custom Checklist"
          count={todoCounts.total > 0 ? todoCounts : null}
          open={tab === 'todos'}
          panelId={panelId}
          onToggle={() => toggleTab('todos')}
        />
        <DockTab
          label="Catatan pasien"
          hasContent={notes.value.trim().length > 0}
          open={tab === 'catatan'}
          panelId={panelId}
          onToggle={() => toggleTab('catatan')}
        />
      </div>

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


type PeekView = 'asli' | 'simgos' | 'wa';

/**
 * A view switch. Pressed shows that format; pressing it again returns to the
 * note as written.
 */
function ViewToggle({
  label,
  pressed,
  onPress,
}: {
  label: string;
  pressed: boolean;
  onPress: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={pressed}
      title={pressed ? 'Kembali ke catatan asli' : `Tampilkan versi ${label}`}
      className={[
        'min-h-tap shrink-0 rounded-lg border px-2 text-[10px] font-medium',
        pressed ? 'border-accent bg-accent/15 text-accent' : 'border-border',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

/**
 * The medical record number, the one thing here that IS copied.
 *
 * Digits only, no `RM ` prefix, matching the patient page: it goes into a
 * search box that wants the number. The number itself is shown in the
 * subtitle, so the button can stay short.
 */
function CopyMrnButton({ mrn }: { mrn: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void copyText(mrn).then((ok) => {
          setCopied(ok);
          if (ok) window.setTimeout(() => setCopied(false), 1200);
        });
      }}
      title={`Salin nomor RM ${mrn}`}
      aria-label={`Salin nomor RM ${mrn}`}
      className="min-h-tap shrink-0 rounded-lg border border-border px-2 text-[10px] font-medium text-fg-muted"
    >
      {copied ? '✓' : 'Salin RM'}
    </button>
  );
}

type PeekTab = 'checklist' | 'todos' | 'catatan';

/**
 * One tab in the peek window's bottom row.
 *
 * A disclosure button (`aria-expanded`), not an ARIA tab: pressing the open one
 * closes it, and a tablist always has one tab selected.
 *
 * The count is a badge that stays whole while the label truncates, tinted when
 * everything is done — "7/7" and "0/1" are the whole answer to "did anyone do
 * it", and a narrow window should lose the word before the number.
 */
function DockTab({
  label,
  count,
  hasContent,
  open,
  panelId,
  onToggle,
}: {
  label: string;
  /** Omitted for a tab with nothing to count; `null` when the list is empty. */
  count?: { done: number; total: number } | null;
  /** For the standing note: a dot when there is something to read. */
  hasContent?: boolean;
  open: boolean;
  panelId: string;
  onToggle: () => void;
}): JSX.Element {
  const complete = count ? count.done === count.total : false;
  const summary = count ? `${count.done}/${count.total}` : null;
  const empty = count === null || hasContent === false;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      aria-label={summary ? `${label}, ${summary} selesai` : label}
      title={label}
      className={[
        'flex min-h-tap min-w-0 flex-auto items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-medium',
        open ? 'bg-surface text-fg shadow-sm' : empty ? 'text-fg-faint' : 'text-fg-muted',
      ].join(' ')}
    >
      <span className="truncate">{label}</span>
      {summary ? (
        <span
          aria-hidden="true"
          className={[
            'shrink-0 rounded px-1 tabular-nums',
            complete ? 'bg-accent/15 text-accent' : 'border border-border text-fg',
          ].join(' ')}
        >
          {summary}
        </span>
      ) : null}
      {hasContent ? (
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      ) : null}
    </button>
  );
}
