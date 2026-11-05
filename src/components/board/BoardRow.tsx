import { memo } from 'react';
import { Link } from 'react-router-dom';

import type { BoardCard } from '@/domain/board';
import { InlineCatatan } from './InlineCatatan';
import { FlagRow, RmChip } from './PatientCard';
import { DiagnosisLine, RowActions, STRETCHED_LINK, StatusButton, WatchTags, dischargeStripOf, placeOf } from './PatientCompactCard';

/** Below xl the diagnosis column goes: the count of columns is what a 1024 px screen cannot afford. */
const COLUMNS =
  'grid gap-x-3 lg:grid-cols-[3.5rem_11rem_9rem_minmax(0,1.3fr)_9rem_3.75rem] xl:grid-cols-[3.5rem_12rem_12rem_minmax(0,1fr)_minmax(0,1.3fr)_10rem_3.75rem]';

/** Column titles for Papan Kerja. */
export function BoardRowHeader(): JSX.Element {
  return (
    <div className={`${COLUMNS} border-b border-border px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-fg-muted`}>
      <span>Bed</span>
      <span>Pasien</span>
      <span>Status</span>
      <span className="hidden xl:block">Diagnosis</span>
      <span>Catatan</span>
      <span>Penanda</span>
      <span />
    </div>
  );
}

/**
 * Papan Kerja: one patient per row, so each column can be read straight down.
 *
 * Row colour stays neutral: the checklist colour moved to the status cell, as
 * in the Netral card style, because twenty coloured bands read as one wall. A
 * div, not a link, since the row holds a text box; the name is the link.
 */
function BoardRowView({
  card,
  roomStart = false,
  onChecklist,
  selectable = false,
  checked = false,
  onToggleSelected,
  onPreview,
  onDiagnosis,
  onVisite,
}: {
  onDiagnosis?: ((patientId: string) => void) | undefined;
  card: BoardCard;
  /** First patient of a new room: drawn with a stronger line above it. */
  roomStart?: boolean;
  onChecklist: (patientId: string) => void;
  selectable?: boolean;
  checked?: boolean;
  onToggleSelected?: ((patientId: string) => void) | undefined;
  onPreview?: ((patientId: string) => void) | undefined;
  onVisite?: ((patientId: string) => void) | undefined;
}): JSX.Element {
  const { patient } = card;
  return (
    <div
      data-patient-row={patient.id}
      data-color-token={card.colorToken}
      onContextMenu={(event) => {
        if ((event.target as HTMLElement).tagName === 'TEXTAREA') return;
        event.preventDefault();
        onChecklist(patient.id);
      }}
      className={[
        `group/board relative ${STRETCHED_LINK} ${COLUMNS} items-start px-3 py-1.5 text-fg hover:bg-bg-subtle`,
        roomStart ? 'border-t border-border-strong' : 'border-t border-border',
        card.pemantauan ? 'rounded-md ring-2 ring-inset ring-[var(--danger)]' : '',
        selectable && checked ? 'bg-[var(--accent-soft)]' : '',
      ].join(' ')}
    >
      <span className="text-ctitle font-bold tabular-nums">{placeOf(card)}</span>
      <div className="min-w-0">
        <Link
          to={`/p/${patient.id}`}
          onClick={
            selectable
              ? (event) => {
                  event.preventDefault();
                  onToggleSelected?.(patient.id);
                }
              : undefined
          }
          className="block break-words text-ctitle font-semibold after:absolute after:inset-0"
        >
          {selectable ? <span aria-hidden="true">{checked ? '☑ ' : '☐ '}</span> : null}
          {card.name}
        </Link>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-fg-muted">
          {card.dpjp ? (
            <span title={`DPJP: ${card.dpjp.name}`} className="rounded-full bg-bg-subtle px-1.5 font-semibold text-fg">
              {card.dpjp.initials}
            </span>
          ) : null}
          {card.mrn ? <RmChip mrn={card.mrn} hidden={card.mrnHidden} patientId={patient.id} name={card.name} /> : null}
          {card.checkCount ? (
            <span className="rounded-sm border border-current px-1 text-[11px] font-semibold" title={`${card.checkCount} hal perlu diperiksa lagi di catatan hari ini`}>
              ⚑ {card.checkCount}
            </span>
          ) : null}
          <WatchTags card={card} />
        </div>
      </div>
      <div className="min-w-0 rounded-md bg-token px-1.5 py-0.5 text-token-fg">
        <StatusButton card={card} onOpen={onChecklist} disabled={selectable} />
      </div>
      <div className="hidden min-w-0 xl:block">
        <DiagnosisLine card={card} onDiagnosis={onDiagnosis} />
      </div>
      <InlineCatatan patient={patient} name={card.name} readOnly={selectable} />
      <FlagRow card={card} dischargeStrip={dischargeStripOf(card)} className="!mt-0" />
      <RowActions card={card} onPreview={onPreview} onVisite={onVisite} />
    </div>
  );
}

/** Memoised: the board redraws on every filter, selection and drag change. */
export const BoardRow = memo(BoardRowView);
