import { Link } from 'react-router-dom';

import { previewLines, type BoardCard } from '@/domain/board';
import { ProgressStrip } from './ProgressStrip';
import { IconCar, IconEye } from '@/components/common/Icons';
import { formatLocation } from '@/domain/identity';
import {
  STAGE_LABELS,
  STAGE_SHORT,
  STAGE_TOKEN,
  type DischargeStage,
} from '@/domain/discharge';

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
      THE NOTE GOES UNDER THE CARD, not beside it.

      Two attempts put it to the right, and both failed on the same constraint
      rather than on styling. A note can be to the RIGHT, sized to its CONTENT,
      and not OVERLAP its neighbour — any two of those, never all three. The
      board reserves whole columns, so a right-hand note that does not overlap
      has to reserve a whole column too, and a three-word note then leaves most
      of one empty. Splitting the columns in half halved the gap and left it
      obviously there.

      Underneath, all three hold. The note is as wide as the card and as tall as
      its text, masonry closes up beneath it exactly as it does for a card with
      one more line of diagnoses, and nothing is reserved or covered.

      It is still outside the card's border — square top corners against the
      card's squared-off bottom, its own fill and outline — so it reads as paper
      stuck to the card rather than as another field inside it, which was the
      actual objection to keeping it inside.
    */
    <div>
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
        'block min-w-0 border border-black/5 bg-token p-3 text-token-fg shadow-sm transition-shadow hover:shadow-md dark:border-white/10',
        // Square bottom edge whenever a note is attached, so the card and the
        // note form one continuous shape with a seam rather than two rounded
        // boxes stacked with a hairline between them.
        note ? 'rounded-t-xl rounded-b-none' : 'rounded-xl',
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
      /*
        NO discharge treatment on the card's own background. See DischargeChip.

        The wash removed here was a gradient in the stage token laid over
        `bg-token`, and it failed for a structural reason rather than a
        stylistic one: the card's background is ALREADY carrying domain data.
        `colorToken` encodes how far the checklist got, and every pixel of the
        card is that signal. Tinting it with a second, unrelated fact means the
        colour answers neither question — worst on a finished patient, where a
        green "done" background under a green "pulang hari ini" wash reads as
        one flat green block and the checklist colour is simply gone.

        This is the same failure as the 4px `borderLeftColor` before it and the
        left edge before that: a mark placed on a channel something else owns.
        The fix is a channel nothing else uses — the top-right corner.
      */
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
        {/*
          THE NAME WRAPS. It is never truncated.

          `truncate` is `white-space: nowrap` + `overflow: hidden` + an
          ellipsis, and this row was a single flex line in which every other
          child was `shrink-0`. So the name was the only thing that could give,
          and the width it had left was the card minus however many badges the
          patient happened to carry — DPJP, KJS, discharge, pin. That put the
          rule exactly backwards: the patients with the most going on were the
          ones whose names you could not read. "Tn. Petrus Da…" was not a long
          name, it was a name standing next to two badges.

          Wrapping costs a second line only on the cards that need one, and the
          board is masonry — a taller card closes the gap beneath it. Truncation
          cost a name on every card that carried badges, permanently.

          `overflow-wrap: anywhere` is for the ones with no space to break at:
          a single 30-character name would otherwise push the row wider than the
          card and reintroduce the overflow it just fixed.
        */}
        <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug break-words [overflow-wrap:anywhere]">
          {card.title}
        </h3>

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
            className="-my-1 min-h-tap min-w-tap shrink-0 text-token-fg/50"
          >
            <IconEye className="mx-auto" width={16} height={16} />
          </button>
        ) : null}

        {/*
          The corner. Nothing else on the card may sit to the right of this.

          The board is a measured-span CSS grid now (`MasonryGrid` /
          `MasonryItem`), not the multi-column layout the comment above was
          written against — but this is still in normal flow, not `absolute`.
          A flex row that ends here IS the top-right corner, and it stays the
          corner when the name below it wraps to two lines.
        */}
        {card.discharge ? <DischargeChip stage={card.discharge} /> : null}
      </div>

      {/*
        WHERE, and WHOSE. One row.

        The DPJP initials, the KJS mark and the pin used to sit on the title
        row, where they were `shrink-0` and the name was not — so each of them
        was, in effect, spending the patient's name to show itself. They are
        reference marks, not controls: you read them after you have found the
        card, never in order to find it. Down here they cost nothing that
        matters and the row wraps on its own if a location line is long.

        Location stays spelled out to the bed: on a round the room and bed are
        what you are walking to, and a card showing only "PJT Lt 4" still has
        to be opened to find out where.
      */}
      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] opacity-70">
        <span>{formatLocation(patient) || 'Lokasi belum diisi'}</span>
        {card.dpjp ? (
          <span
            title={card.dpjp.name}
            className="rounded border border-current/30 px-1 text-[10px] font-semibold"
          >
            {card.dpjp.initials}
          </span>
        ) : null}
        {card.kjs ? (
          <span
            title="Kelola Jantung Sinergi — pasien rawat bersama"
            className="rounded border border-current/40 px-1 text-[10px] font-semibold"
          >
            KJS
          </span>
        ) : null}
        {patient.pinned ? (
          <span aria-label="Disematkan" className="text-xs">
            ★
          </span>
        ) : null}
      </div>
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
 * How strongly the chip is tinted, by stage.
 *
 * Graded rather than uniform because the four stages are not equally urgent —
 * a discharge four days out is a note to self, one happening today changes
 * what you do on this round. Grading the FILL and not the text keeps the
 * contrast of the label fixed at the card's own foreground, so the loudest
 * chip is still no harder to read than the quietest.
 *
 * The ceiling is 32%. A solid fill was tried and rejected: at full saturation
 * the chip out-shouted the patient's name, which is the one thing on a card
 * that must win.
 */
const STAGE_TINT: Record<DischargeStage, number> = {
  planned: 12,
  h1: 24,
  today: 32,
  overdue: 32,
};

/**
 * Discharge, as a car in the card's top-right corner.
 *
 * WHY A CORNER CHIP AND NOT A CARD-WIDE MARK
 *
 * Every card-level treatment tried so far has collided with something that was
 * already there: a 4px left border lost to the pemantauan edge (an inline
 * `borderLeftColor` silently beats a class); a bare coloured stripe read as
 * noise among cards that are already coloured by checklist progress; and the
 * background wash it replaced tinted `colorToken` itself, which is domain data
 * — a finished patient going home today showed a green wash over a green
 * "selesai" background and lost both facts at once.
 *
 * The corner is free. Nothing else claims it, so a mark placed there cannot be
 * overridden, cannot be mistaken for a checklist colour, and does not have to
 * shout to be found — the eye lands on a card's corners on its own.
 *
 * WHY A CAR
 *
 * A glyph is a silhouette, and silhouettes survive peripheral vision in a way
 * that a coloured dot does not. It also lets the word shrink: "Pulang hari
 * ini" becomes "Hari ini" because the picture already said pulang, and the
 * width that frees goes to the patient's name.
 *
 * Colour is never the only signal — the label is always rendered, and the full
 * phrase is on `title` and in the accessible name for anyone who cannot see
 * either.
 */
function DischargeChip({ stage }: { stage: DischargeStage }): JSX.Element {
  const token = STAGE_TOKEN[stage];
  return (
    <span
      title={STAGE_LABELS[stage]}
      className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none"
      style={{
        backgroundColor: `color-mix(in srgb, ${token} ${STAGE_TINT[stage]}%, transparent)`,
        // A ring drawn as an inset shadow rather than a border: a border would
        // add a pixel to the chip's box and nudge the row it sits in.
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${token} 55%, transparent)`,
      }}
    >
      <IconCar width={12} height={12} className="shrink-0" style={{ color: token }} />
      {/* The short form is for the eye; the full phrase is for the reader who
          is not using one. */}
      <span className="sr-only">{STAGE_LABELS[stage]}</span>
      <span aria-hidden="true">{STAGE_SHORT[stage]}</span>
    </span>
  );
}

/**
 * The standing note, as paper stuck to the bottom of the card.
 *
 * WHY NOT TO THE RIGHT
 *
 * Two attempts put it there and both failed on the same constraint. A note can
 * be to the RIGHT, sized to its CONTENT, and not OVERLAP its neighbour — any
 * two of those, never all three. The board reserves whole columns, so a
 * right-hand note that does not overlap reserves a whole column too, and a
 * three-word note leaves most of one empty. Half-width tracks halved that gap
 * and left it plainly visible.
 *
 * Underneath, all three hold at once: full card width, height from the text,
 * and masonry closing up beneath it exactly as it does for a card carrying one
 * more line of diagnoses. Nothing is reserved and nothing is covered.
 *
 * WHY IT STILL READS AS SEPARATE
 *
 * The objection to keeping it inside the card was that it looked like another
 * field — one more line among the diagnoses. So it keeps its own fill and
 * outline and sits below the card's border with square top corners against the
 * card's squared-off bottom: one continuous shape with a visible seam, which is
 * what a note taped to a chart looks like.
 *
 * COLLAPSED IS STILL USEFUL
 *
 * Collapsed shows the first line, truncated, rather than hiding the note behind
 * a tab. A tab says "something is written here" and makes you click to find out
 * what; one line usually IS what — most of these are short — and it costs a
 * single row.
 */
function CardNote({
  note,
  expanded,
  onToggle,
}: {
  note: string;
  expanded: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={expanded ? 'Ringkas catatan' : 'Selengkapnya'}
      onClick={onToggle}
      className="flex w-full items-start gap-1.5 rounded-b-xl rounded-t-none border border-t-0 border-[var(--warn-strong)]/40 bg-[var(--warn-soft)] px-3 py-1.5 text-left text-fg"
    >
      <span
        aria-hidden="true"
        className="mt-px shrink-0 text-[9px] leading-snug text-[var(--warn-strong)]"
      >
        {expanded ? '▾' : '▸'}
      </span>
      <span
        className={[
          'min-w-0 flex-1 text-[11px] leading-snug',
          // `break-words` plus `overflow-wrap: anywhere` because notes are free
          // text and people paste identifiers into them. An unbroken
          // 200-character string has no space to wrap at, and ran across the
          // whole board before this.
          expanded
            ? 'whitespace-pre-line break-words [overflow-wrap:anywhere]'
            : 'truncate',
        ].join(' ')}
      >
        {expanded ? note : note.split('\n')[0]}
      </span>
    </button>
  );
}

