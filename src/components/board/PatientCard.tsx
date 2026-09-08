import { Link } from 'react-router-dom';

import { previewLines, type BoardCard } from '@/domain/board';
import { ProgressStrip } from './ProgressStrip';
import { IconEye } from '@/components/common/Icons';
import { formatLocation } from '@/domain/identity';
import { STAGE_LABELS, STAGE_TOKEN } from '@/domain/discharge';

/**
 * SPEC F2 — a Google-Keep-style card.
 *
 * Background comes from the resolved checklist token; the progress strip and
 * the pending chip carry the same information without relying on colour.
 */
export function PatientCard({
  card,
  onLongPress,
  onDragHandleDown,
  dragging,
  selectable,
  checked,
  onToggleSelected,
  onPreview,
  noteExpanded = false,
  onToggleNote,
}: {
  card: BoardCard;
  onLongPress: (patientId: string) => void;
  /**
   * Present only while the board is in hand-made order.
   *
   * Drag lives on a HANDLE, not the card. The card is a link that opens the
   * patient and a long-press target that opens the quick checklist; a third
   * gesture on the same element would have to win a race against both, and
   * losing that race either opens a chart you did not want or moves a card you
   * did not mean to move.
   */
  onDragHandleDown?: ((event: React.PointerEvent, patientId: string) => void) | undefined;
  dragging?: boolean;
  /** True while the board is in selection mode. */
  selectable?: boolean;
  checked?: boolean;
  onToggleSelected?: ((patientId: string) => void) | undefined;
  /** Opens the read-only note preview. Absent while selecting. */
  onPreview?: ((patientId: string) => void) | undefined;
  /** The standing note is open, so the board has widened this cell. */
  noteExpanded?: boolean;
  onToggleNote?: ((patientId: string) => void) | undefined;
}): JSX.Element {
  const { patient, progress } = card;
  const lines = previewLines(card.preview);

  // Long-press opens the quick checklist (SPEC 11.3) so ticking during rounds
  // never requires opening the note. Implemented with pointer events + a timer
  // rather than `contextmenu` so it behaves the same on touch and mouse.
  let timer = 0;
  const startPress = (): void => {
    timer = window.setTimeout(() => onLongPress(patient.id), 500);
  };
  const cancelPress = (): void => window.clearTimeout(timer);

  const note = patient.notes.trim();
  /**
   * Held by the board, not here.
   *
   * Expanding the note makes the card's grid cell span two columns, and the
   * cell is the board's to size. Keeping the flag local would mean the card
   * knowing it was wide while its container did not.
   */
  const noteOpen = noteExpanded && note.length > 0;

  return (
    /*
      Card and note are siblings, so the note sits OUTSIDE the card's border.

      When the note is open the board gives this row two columns, and the two
      children split them evenly — so the card keeps the width it had and the
      note occupies the space to its right. Collapsed, the row is one column and
      the note is a spine on the edge.
    */
    <div className="flex items-stretch gap-1.5">
    <Link
      to={`/p/${patient.id}`}
      /**
       * In selection mode the card SELECTS instead of opening.
       *
       * Not a checkbox in the corner: the whole card is the target you are
       * already aiming at, and a small box beside a large link is a way to
       * open a chart when you meant to tick it.
       */
      onClick={
        selectable
          ? (event) => {
              event.preventDefault();
              onToggleSelected?.(patient.id);
            }
          : undefined
      }
      // Read by the drag tracker's hit test to find which card is under the
      // pointer. An id on the element is cheaper and steadier than measuring
      // every card's rectangle on each move.
      data-patient-id={patient.id}
      data-color-token={card.colorToken}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onContextMenu={(event) => {
        event.preventDefault();
        onLongPress(patient.id);
      }}
      className={[
        'block min-w-0 flex-1 rounded-xl border border-black/5 bg-token p-3 text-token-fg shadow-sm transition-shadow hover:shadow-md dark:border-white/10',
        // The card being dragged fades rather than moves. Moving it would mean
        // owning a live preview of the whole list mid-gesture; fading says
        // which one is in hand and lets the drop do the rearranging.
        dragging ? 'opacity-40' : '',
        /**
         * Pemantauan reads on the card's EDGE, not as a mark inside it.
         *
         * A dot beside the name was the first attempt and it disappeared into
         * the card — the cards already carry a colour, a title, a location and
         * a preview, and one more small thing among them is not something the
         * eye catches while scanning. A striped left edge changes the card's
         * silhouette, which is what actually registers at a glance down a
         * column of twenty.
         *
         * Warning colours rather than the accent: the accent already means
         * "selected" here, and a flag that shares a colour with a state is a
         * flag you have to think about.
         */
        /*
         * A ring around the WHOLE card, in the danger colour, plus a flag.
         *
         * The previous treatment was a left edge in `--warn-strong` with a
         * faint ring — and it lost, twice over. It shared the left edge with
         * the discharge stage, whose inline `borderLeftColor` overrides a
         * class and silently erased it on any patient who had both; and even
         * alone it read as one more amber accent on cards that already carry a
         * stage colour, a title, a location and a preview.
         *
         * The ring cannot collide with the discharge edge because it is not on
         * the same property, and the danger token is used nowhere else on a
         * card, so it means one thing.
         */
        /*
         * Ring only. NOTHING absolutely positioned inside a board card.
         *
         * The badge was `absolute -top-2 left-3` on a `relative` card, and the
         * board is a CSS multi-column layout (`columns-2 … columns-5`). An
         * absolutely-positioned box inside a relatively-positioned element in a
         * multicol container has no reliably-resolved containing block: the
         * browser fragments the flow into columns and the abspos child is laid
         * out against the wrong fragment. So the red pill landed in open space
         * between two other cards, several hundred pixels from the patient it
         * belonged to.
         *
         * `ring` is safe because it paints on the border box and never leaves
         * the flow. The label below is in normal flow for the same reason.
         */
        card.pemantauan ? 'ring-2 ring-[var(--danger)]' : '',
      ].join(' ')}
      style={
        // A left edge rather than a different card colour: the card colour
        // already means how far the round got, and one colour cannot carry two
        // unrelated facts without making both unreadable. An edge reads as a
        // marker on the card instead of a change to it.
        card.discharge
          ? {
              borderLeftWidth: '4px',
              borderLeftColor: STAGE_TOKEN[card.discharge],
            }
          : undefined
      }
    >
      {/*
        A strip across the top of the card, in normal flow.

        Named as well as coloured: a red ring says "something", the word says
        which something, and a resident scanning twenty cards should not have to
        remember what a colour meant. Negative margins pull it out to the card's
        padding edge so it reads as part of the frame rather than as content.
      */}
      {card.pemantauan ? (
        <p
          className="-mx-3 -mt-3 mb-2 rounded-t-xl px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white"
          style={{ backgroundColor: 'var(--danger)' }}
        >
          Pemantauan
        </p>
      ) : null}
      <div className="flex items-start gap-2">
        {selectable ? (
          <span
            aria-hidden="true"
            className={[
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px]',
              checked
                ? 'border-transparent bg-accent text-white'
                : 'border-current opacity-40',
            ].join(' ')}
          >
            {checked ? '✓' : ''}
          </span>
        ) : null}
        {onDragHandleDown ? (
          <button
            type="button"
            aria-label={`Pindahkan ${card.title}`}
            // The handle must not open the patient. `preventDefault` stops the
            // link, and stopping propagation keeps the card's long-press timer
            // from starting underneath the gesture.
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDragHandleDown(event, patient.id);
            }}
            onClick={(event) => event.preventDefault()}
            className="-my-1 -ml-1 min-h-tap min-w-tap shrink-0 cursor-grab touch-none text-token-fg/50"
          >
            <span aria-hidden="true">⠿</span>
          </button>
        ) : null}
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{card.title}</h3>

        {/*
          Its own small target, not a gesture on the card.
          
          The card is already a link, a long-press and — in custom order — a
          drag handle. A fourth gesture would have to win a race against three
          others, and losing that race opens a chart you did not ask for.
        */}
        {onPreview ? (
          <button
            type="button"
            aria-label={`Pratinjau catatan ${card.title}`}
            onClick={(event) => {
              // The card is a `<Link>`; without this the preview opens and the
              // route changes underneath it.
              event.preventDefault();
              event.stopPropagation();
              onPreview(patient.id);
            }}
            className="-my-1 -mr-1 min-h-tap min-w-tap shrink-0 text-token-fg/50"
          >
            <IconEye className="mx-auto" width={16} height={16} />
          </button>
        ) : null}
        {/* Consultant initials, read from the note's DPJP line. Initials
            rather than a name because the card has one line for it and a
            resident reads these as a set. */}
        {card.dpjp ? (
          <span
            title={card.dpjp.name}
            className="shrink-0 rounded border border-current/30 px-1 text-[10px] font-semibold opacity-80"
          >
            {card.dpjp.initials}
          </span>
        ) : null}
        {card.kjs ? (
          <span
            title="Kelola Jantung Sinergi — pasien rawat bersama"
            className="shrink-0 rounded border border-current/40 px-1 text-[10px] font-semibold opacity-80"
          >
            KJS
          </span>
        ) : null}
        {card.discharge ? (
          <span
            className="shrink-0 rounded px-1 text-[10px] font-semibold"
            style={{
              backgroundColor: STAGE_TOKEN[card.discharge],
              // Dark text on both badge colours in both themes: the badges are
              // deliberately bright, so the foreground does not flip with the
              // theme the way the rest of the card does.
              color: 'var(--discharge-fg)',
            }}
          >
            {STAGE_LABELS[card.discharge]}
          </span>
        ) : null}
        {patient.pinned ? (
          <span aria-label="Disematkan" className="text-xs">
            ★
          </span>
        ) : null}
      </div>

      {/* Location spelled out, not just the ward: on a round the room and bed
          are what you are walking to, and a card that shows only "PJT Lt 4"
          still needs opening to find out where. */}
      <p className="mt-0.5 text-[11px] opacity-70">
        {formatLocation(patient) || 'Lokasi belum diisi'}
      </p>
      {/*
        Hari rawat removed from the card.
        
        It is the same count the header setting already made optional, and on a
        board it earns even less: you are scanning for WHO and WHERE, and the
        admission-day number is not something any decision on this screen turns
        on. The chief stays, because that is who you hand the note to.
      */}
      {card.chief ? <p className="text-[11px] opacity-60">Chief {card.chief}</p> : null}

      {lines.length > 0 ? (
        <p className="mt-2 whitespace-pre-line text-xs leading-relaxed opacity-90">
          {lines.join('\n')}
        </p>
      ) : (
        <p className="mt-2 text-xs italic opacity-60">Belum ada catatan hari ini.</p>
      )}

      {card.previewIsStale ? (
        <p className="mt-1 text-[10px] opacity-60">Catatan dari hari sebelumnya</p>
      ) : null}

      {patient.labels.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {patient.labels.map((label) => (
            <span
              key={label}
              className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] dark:bg-white/15"
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3">
        <ProgressStrip progress={progress} />
        <p className="mt-1.5 text-[11px] font-medium opacity-80">
          {progress.complete
            ? 'Semua selesai'
            : `Belum: ${progress.pendingLabel ?? '—'}`}
        </p>
      </div>
    </Link>

      {note ? (
        <CardNote
          note={note}
          expanded={noteOpen}
          onToggle={() => onToggleNote?.(patient.id)}
        />
      ) : null}
    </div>
  );
}

/**
 * The standing note, clipped to the right of the card.
 *
 * Outside the card's border on purpose. Inside, it read as another field of the
 * card — one more line among the diagnoses — and it is not: the card says what
 * the patient HAS, the note says what to DO about them, and they are written
 * and read at different moments.
 *
 * Collapsed to a spine by default it would be invisible, so it opens expanded
 * and collapses to a tab. Absent entirely when there is no note: an empty box
 * on every card is furniture on the one screen where density is the point, and
 * its absence is itself information.
 */
function CardNote({
  note,
  expanded,
  onToggle,
}: {
  note: string;
  expanded: boolean;
  onToggle: (next: boolean) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={expanded ? 'Tutup catatan' : 'Buka catatan'}
      onClick={() => onToggle(!expanded)}
      className={[
        'shrink-0 self-stretch rounded-lg border border-[var(--warn-strong)] bg-[var(--warn-soft)] text-left text-fg transition-[width]',
        // `flex-1` against the card's `flex-1`, inside a row that is two
        // columns wide: the card lands back on exactly one column and the note
        // takes the other. Shrinking the card to make room was the previous
        // behaviour and the thing being fixed.
        expanded ? 'flex-1 p-2' : 'w-5 p-0',
      ].join(' ')}
    >
      {expanded ? (
        /*
          `break-words` is not optional here. A note is free text and residents
          paste identifiers into it — an unbroken 200-character string has no
          space to wrap at, so it ran straight out of the card and across the
          rest of the board.
        */
        <span className="block whitespace-pre-line break-words text-[11px] leading-snug [overflow-wrap:anywhere]">
          {note}
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="flex h-full items-center justify-center text-[10px] font-bold"
        >
          ▸
        </span>
      )}
    </button>
  );
}
