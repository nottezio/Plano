import { Link } from 'react-router-dom';

import { previewLines, type BoardCard } from '@/domain/board';
import { ProgressStrip } from './ProgressStrip';

/**
 * SPEC F2 — a Google-Keep-style card.
 *
 * Background comes from the resolved checklist token; the progress strip and
 * the pending chip carry the same information without relying on colour.
 */
export function PatientCard({
  card,
  onLongPress,
}: {
  card: BoardCard;
  onLongPress: (patientId: string) => void;
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
      data-color-token={card.colorToken}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onContextMenu={(event) => {
        event.preventDefault();
        onLongPress(patient.id);
      }}
      className="mb-3 block break-inside-avoid rounded-xl border border-black/5 bg-token p-3 text-token-fg shadow-sm transition-shadow hover:shadow-md dark:border-white/10"
    >
      <div className="flex items-start gap-2">
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
        {patient.pinned ? (
          <span aria-label="Disematkan" className="text-xs">
            ★
          </span>
        ) : null}
      </div>

      <p className="mt-0.5 text-[11px] opacity-70">
        Hari rawat ke-{card.hariRawat}
        {patient.ward ? ` · ${patient.ward}` : ''}
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
