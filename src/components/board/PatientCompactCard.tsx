import { memo } from 'react';
import { Link } from 'react-router-dom';

import { IconCar, IconClipboard, IconEye } from '@/components/common/Icons';
import { diagnosisSummary, shortStepLabel, soapState, type BoardCard } from '@/domain/board';
import { STAGE_TOKEN } from '@/domain/discharge';
import { isTrioDpjp } from '@/domain/dpjp';
import { InlineCatatan } from './InlineCatatan';
import { HoverDetail } from './HoverDetail';
import { FlagRow, RmChip } from './PatientCard';
import { ProgressStrip } from './ProgressStrip';

/**
 * The name's link is stretched over the whole card or row, so anywhere opens the
 * patient (and Ctrl+click still opens a tab). Controls and the note sit above it.
 */
export const STRETCHED_LINK = '[&_button]:relative [&_button]:z-10 [&_textarea]:relative [&_textarea]:z-10';

/** `421/4`, the way the ward list writes it. */
export function placeOf(card: BoardCard): string {
  const room = card.patient.room?.trim();
  const bed = card.patient.bed?.trim();
  return [room, bed].filter(Boolean).join('/') || '–';
}

/** H-1 and pulang hari ini: what changes this round's work. Other stages stay in the flag row. */
export function dischargeStripOf(card: BoardCard): 'h1' | 'today' | null {
  return card.discharge === 'h1' || card.discharge === 'today' ? card.discharge : null;
}

/** Pemantauan and discharge as words, so colour is never the only signal. */
export function WatchTags({ card }: { card: BoardCard }): JSX.Element | null {
  const strip = dischargeStripOf(card);
  const usul = strip === null && card.usulDays !== null;
  if (!card.pemantauan && !strip && !usul) return null;
  return (
    <>
      {card.pemantauan ? (
        <span
          className="rounded-sm px-1 text-[11px] font-bold"
          style={{ backgroundColor: 'var(--pemantauan-bg)', color: 'var(--pemantauan-fg)' }}
        >
          Pemantauan
        </span>
      ) : null}
      {strip || usul ? (
        <span
          className="inline-flex items-center gap-1 rounded-sm px-1 text-[11px] font-bold"
          style={{ backgroundColor: STAGE_TOKEN[strip ?? 'h1'], color: 'var(--discharge-fg)' }}
        >
          <IconCar width={11} height={11} aria-hidden="true" />
          {usul ? 'Usul H-1' : strip === 'today' ? 'Pulang hari ini' : 'H-1'}
          {isTrioDpjp(card.dpjp?.id) ? ' · 6MWT' : null}
        </span>
      ) : null}
    </>
  );
}

/** Who the note is handed to, so never clipped away with the rest of a short card. Same wording as the full card. */
export function ChiefLine({ card, className = '' }: { card: BoardCard; className?: string }): JSX.Element | null {
  if (!card.chief) return null;
  return (
    <p className={`pointer-events-none truncate text-xs ${className}`} title={`Chief: ${card.chief}`}>
      <span className="opacity-70">Chief</span> <b className="font-semibold">{card.chief}</b>
    </p>
  );
}

/**
 * What is left on this patient: a button, because ticking the checklist is a
 * main job and right-click on a card is not something anyone finds. One colour
 * per patient; a finished patient shows a quiet tick instead of a full strip.
 */
export function StatusButton({
  card,
  onOpen,
  disabled = false,
}: {
  card: BoardCard;
  onOpen: (patientId: string) => void;
  disabled?: boolean;
}): JSX.Element {
  const { progress } = card;
  const soap = soapState(card);
  const next = shortStepLabel(progress.pendingLabel);
  return (
    <button
      type="button"
      disabled={disabled}
      title="Buka checklist"
      aria-label={`Buka checklist ${card.name}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen(card.patient.id);
      }}
      className="-my-1 block min-h-tap w-fit max-w-full rounded text-left text-xs hover:bg-black/5 dark:hover:bg-white/5 [@media(pointer:fine)]:my-0 [@media(pointer:fine)]:min-h-0"
    >
      {soap === 'today' ? null : (
        <span className="block font-semibold">
          <span aria-hidden="true">○ </span>
          {soap === 'stale' ? 'SOAP kemarin' : 'Belum ada SOAP'}
        </span>
      )}
      {progress.total === 0 ? null : progress.complete ? (
        <span className="card-status font-semibold opacity-90">✓ Selesai</span>
      ) : (
        <span className="flex min-w-0 items-center gap-2">
          <span className="w-14 shrink-0">
            <ProgressStrip progress={progress} mono />
          </span>
          <span className="card-status min-w-0 truncate tabular-nums" title={progress.pendingLabel ?? undefined}>
            {progress.doneCount}/{progress.total}
            {next ? ` · ${next}` : ''}
          </span>
        </span>
      )}
    </button>
  );
}

/**
 * The first diagnosis, whole, and how many there are. It wraps: a diagnosis cut
 * mid-phrase tells you nothing. Dx opens the note at its diagnosis section.
 */
export function DiagnosisLine({
  card,
  onDiagnosis,
}: {
  card: BoardCard;
  onDiagnosis?: ((patientId: string) => void) | undefined;
}): JSX.Element {
  const { first, count } = diagnosisSummary(card.preview);
  const added = card.dxChanges?.added.length ?? 0;
  if (!first) return <p className="pointer-events-none text-xs italic opacity-80">Belum ada catatan hari ini.</p>;
  return (
    // The preview as stored: one line says nothing the card does not already say.
    <HoverDetail title="Diagnosis" text={card.preview.includes('\n') ? card.preview : ''}>
    <p className="min-w-0 break-words text-xs">
      {/* The label comes first, so a line of diagnosis cannot be read as a line of Catatan. */}
      <button
        type="button"
        disabled={!onDiagnosis}
        aria-label={`Lihat ${count} diagnosis ${card.name}`}
        title="Lihat diagnosis di catatan"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onDiagnosis?.(card.patient.id);
        }}
        className="-my-2 mr-1.5 inline-flex min-h-tap items-center rounded align-baseline font-semibold tabular-nums underline decoration-dotted underline-offset-2 [@media(pointer:fine)]:my-0 [@media(pointer:fine)]:min-h-0"
      >
        Dx{count > 1 ? ` (${count})` : ''}
      </button>
      {/* Opacity paints this above the stretched link, which would swallow the click. */}
      <span className="pointer-events-none opacity-80">{first}</span>
      {added > 0 ? <span className="ml-1.5 whitespace-nowrap font-semibold">+{added} baru</span> : null}
    </p>
    </HoverDetail>
  );
}

/** Preview and Visite, shown on hover or focus, and always on a touch screen. */
export function RowActions({
  card,
  onPreview,
  onVisite,
}: {
  card: BoardCard;
  onPreview?: ((patientId: string) => void) | undefined;
  onVisite?: ((patientId: string) => void) | undefined;
}): JSX.Element {
  const className =
    'flex min-h-tap w-7 shrink-0 items-center justify-center opacity-0 transition-opacity focus-visible:opacity-100 group-hover/board:opacity-100 [@media(hover:none)]:opacity-100 [@media(pointer:fine)]:min-h-7';
  return (
    <div className="-my-1 flex shrink-0">
      {onPreview ? (
        <button
          type="button"
          aria-label={`Preview catatan ${card.title}`}
          title="Preview catatan"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onPreview(card.patient.id);
          }}
          className={className}
        >
          <IconEye width={16} height={16} />
        </button>
      ) : null}
      {onVisite ? (
        <button
          type="button"
          aria-label={`Visite ${card.title}`}
          title="Visite: ringkasan untuk visite DPJP"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onVisite(card.patient.id);
          }}
          className={className}
        >
          <IconClipboard width={16} height={16} />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Kartu Ringkas: bed first, then status, one diagnosis line and the Catatan.
 *
 * Catatan sits outside the link, because a text box inside a link is a chart
 * opened by a click meant for the caret. The colour stays on the whole card:
 * it is checklist progress, and so are the Netral and Garis styles' rules.
 */
function PatientCompactCardView({
  card,
  onChecklist,
  selectable = false,
  checked = false,
  onToggleSelected,
  onPreview,
  onDiagnosis,
  onVisite,
}: {
  card: BoardCard;
  onDiagnosis?: ((patientId: string) => void) | undefined;
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
      data-patient-id={patient.id}
      data-color-token={card.colorToken}
      data-patient-card
      onContextMenu={(event) => {
        // Not on the note, where right-click is paste.
        if ((event.target as HTMLElement).tagName === 'TEXTAREA') return;
        event.preventDefault();
        onChecklist(patient.id);
      }}
      className={[
        `group/board relative ${STRETCHED_LINK}`,
        'rounded-xl border border-black/5 bg-token p-d-card text-token-fg shadow-card transition-shadow hover:border-[color-mix(in_srgb,var(--token-fg)_45%,transparent)] hover:shadow-pop dark:border-white/10',
        card.pemantauan ? 'ring-2 ring-[var(--danger)]' : '',
        selectable && checked ? 'outline outline-2 outline-offset-1 outline-accent' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-1">
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
          className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 after:absolute after:inset-0 after:rounded-xl"
        >
          {selectable ? (
            <span aria-hidden="true" className="self-center text-xs">
              {checked ? '☑' : '☐'}
            </span>
          ) : null}
          <span className="text-ctitle font-bold tabular-nums">{placeOf(card)}</span>
          <h3 className="max-w-full break-words text-ctitle font-semibold">{card.name}</h3>
        </Link>
        <RowActions card={card} onPreview={onPreview} onVisite={onVisite} />
      </div>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
        {card.dpjp ? (
          <span title={`DPJP: ${card.dpjp.name}`} className="card-dpjp rounded-full bg-black/10 px-1.5 font-semibold dark:bg-white/15">
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
      <ChiefLine card={card} className="mt-0.5" />
      <div className="mt-d-gap space-y-d-gap">
        {/* Reminders share the status line: on their own row they cost every card a line. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusButton card={card} onOpen={onChecklist} disabled={selectable} />
          <FlagRow card={card} dischargeStrip={dischargeStripOf(card)} className="!mt-0" />
        </div>
        <DiagnosisLine card={card} onDiagnosis={onDiagnosis} />
        <InlineCatatan patient={patient} name={card.name} readOnly={selectable} />
      </div>
    </div>
  );
}

/** Memoised: the board redraws on every filter, selection and drag change. */
export const PatientCompactCard = memo(PatientCompactCardView);
