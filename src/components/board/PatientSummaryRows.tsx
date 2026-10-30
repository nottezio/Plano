import { useCallback, useLayoutEffect, useRef } from 'react';

import { usePatientNotes } from '@/components/patient/PatientNotes';
import type { BoardCard } from '@/domain/board';
import type { StickyKind } from '@/domain/boardNotes';
import type { ClinicalDate } from '@/domain/types';

/**
 * The body of a summary sticky (`BoardNote.kind`): one line of identity per
 * patient on the board, in board order, and under it either the standing
 * note or today's planned labs.
 *
 * Nothing here is stored on the sticky. The catatan row edits `Patient.notes`
 * through the same `usePatientNotes` the SOAP page uses, so an edit on either
 * side is the same field changing; the lab rows read `Patient.labPlans`,
 * derived from the note's plan, and are read-only because the plan is where
 * they are written.
 */
export function PatientSummaryRows({
  kind,
  cards,
  today,
}: {
  kind: StickyKind;
  cards: readonly BoardCard[];
  today: ClinicalDate;
}): JSX.Element {
  if (kind === 'catatan') {
    return cards.length > 0 ? (
      <ul className="space-y-2">
        {cards.map((card) => (
          <CatatanRow key={card.patient.id} card={card} />
        ))}
      </ul>
    ) : (
      <p className="text-sm opacity-70">Belum ada pasien di papan ini.</p>
    );
  }

  const due = cards
    .map((card) => ({ card, plans: (card.patient.labPlans ?? []).filter((plan) => plan.date === today) }))
    .filter((entry) => entry.plans.length > 0);
  return due.length > 0 ? (
    <ul className="space-y-2">
      {due.map(({ card, plans }) => (
        <li key={card.patient.id}>
          <Identity card={card} />
          {plans.map((plan, at) => (
            <p key={at} className="whitespace-pre-line text-sm leading-snug [overflow-wrap:anywhere]">
              {plan.text}
            </p>
          ))}
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm opacity-70">
      Tidak ada lab bertanggal hari ini di Plan SOAP, misalnya “- Cek DL, SE (30/10/2026)”.
    </p>
  );
}

/** Name · room/bed · DPJP, the way the owner reads a ward list. */
function Identity({ card }: { card: BoardCard }): JSX.Element {
  const { room, bed, dpjp } = card.patient;
  const place = [room?.trim(), bed?.trim()].filter(Boolean).join('/');
  const consultant = card.dpjp?.initials ?? dpjp?.trim();
  return (
    <p className="text-xs font-semibold" title={card.dpjp?.name}>
      • {[card.name, place, consultant].filter(Boolean).join(' · ')}
    </p>
  );
}

function CatatanRow({ card }: { card: BoardCard }): JSX.Element {
  // One hook per row, as on the patient page: it owns the draft and the merge.
  const sync = usePatientNotes(card.patient);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Height follows the content; see PatientNotes for why a callback ref too.
  const measure = useCallback((node: HTMLTextAreaElement | null) => {
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  }, []);
  const attach = useCallback(
    (node: HTMLTextAreaElement | null) => {
      ref.current = node;
      measure(node);
    },
    [measure],
  );
  useLayoutEffect(() => measure(ref.current), [measure, sync.value]);

  return (
    <li>
      <Identity card={card} />
      <textarea
        ref={attach}
        value={sync.value}
        onChange={(event) => sync.setValue(event.target.value)}
        onBlur={sync.flush}
        rows={1}
        placeholder="Tulis catatan…"
        aria-label={`Catatan pasien ${card.name}`}
        className="w-full resize-none overflow-hidden bg-transparent text-sm leading-snug outline-none [overflow-wrap:anywhere] placeholder:opacity-50"
        style={{ color: 'inherit' }}
      />
    </li>
  );
}
