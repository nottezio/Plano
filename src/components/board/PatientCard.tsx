import { Link } from 'react-router-dom';

import { previewLines, type BoardCard } from '@/domain/board';
import { ProgressStrip } from './ProgressStrip';
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

  return (
    <Link
      to={`/p/${patient.id}`}
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
        'mb-3 block break-inside-avoid rounded-xl border border-black/5 bg-token p-3 text-token-fg shadow-sm transition-shadow hover:shadow-md dark:border-white/10',
        // The card being dragged fades rather than moves. Moving it would mean
        // owning a live preview of the whole list mid-gesture; fading says
        // which one is in hand and lets the drop do the rearranging.
        dragging ? 'opacity-40' : '',
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
      <div className="flex items-start gap-2">
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
      <p className="text-[11px] opacity-60">
        Hari rawat ke-{card.hariRawat}
        {card.chief ? ` · Chief ${card.chief}` : ''}
      </p>

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
  );
}
