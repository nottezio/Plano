import { useEffect, useRef, useState } from 'react';

import { IconBack, IconChevronRight } from '@/components/common/Icons';
import { Sheet } from '@/components/common/Sheet';
import { Button } from '@/components/common/ui';
import { VisiteView } from '@/components/patient/VisiteView';
import { fetchEntryBodies } from '@/data/repositories/entries.repo';
import { cardTitle } from '@/domain/board';
import { hariRawat } from '@/domain/clinicalDate';
import type { ClinicalDate, Patient } from '@/domain/types';
import { useSession } from '@/store/useSession';

/** A horizontal swipe this long (px), and mostly sideways, steps to the next patient. */
const SWIPE = 60;

/**
 * Visite mode from the canvas: one patient's cheat sheet, stepped bed to bed in
 * board order without closing (‹ › or a sideways swipe). The note is read the
 * way the peek window reads it: today's, else the newest with content.
 */
export function VisiteSheet({
  patients,
  index,
  today,
  onIndex,
  onClose,
}: {
  patients: readonly Patient[];
  index: number;
  today: ClinicalDate;
  onIndex: (next: number) => void;
  onClose: () => void;
}): JSX.Element | null {
  const settings = useSession((state) => state.settings());
  const patient = patients[index];
  const [note, setNote] = useState<{ id: string; body: string; date: ClinicalDate | null } | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!patient) return;
    let cancelled = false;
    setNote(null);
    void fetchEntryBodies(patient.id)
      .then((days) => {
        const chosen = days.find((day) => day.date === today) ?? days[0];
        if (!cancelled) setNote({ id: patient.id, body: chosen?.body ?? '', date: chosen?.date ?? null });
      })
      .catch((error: unknown) => {
        console.error('[visite] could not read entries', error);
        if (!cancelled) setNote({ id: patient.id, body: '', date: null });
      });
    return () => {
      cancelled = true;
    };
  }, [patient, today]);

  if (!patient) return null;
  const current = note?.id === patient.id ? note : null;
  const where = [patient.ward?.trim(), [patient.room?.trim(), patient.bed?.trim()].filter(Boolean).join('/')]
    .filter(Boolean)
    .join(' · ');
  const description = [
    patient.age !== undefined ? `${patient.age} th` : null,
    patient.mrn ? `RM ${patient.mrn}` : null,
    where || null,
    `H${hariRawat(today, patient.admittedAt)} rawat`,
  ]
    .filter(Boolean)
    .join(' · ');
  const step = (by: number): void => {
    const next = index + by;
    if (next >= 0 && next < patients.length) onIndex(next);
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      size="lg"
      title={cardTitle(patient, settings.privacy.boardShowInitialsOnly, false)}
      description={description}
      footer={
        <div className="flex items-center gap-2">
          <Button icon={<IconBack width={16} height={16} />} disabled={index === 0} onClick={() => step(-1)}>
            Sebelumnya
          </Button>
          <span className="flex-1 text-center text-xs tabular-nums text-fg-muted" aria-live="polite">
            {index + 1} / {patients.length}
          </span>
          <Button disabled={index === patients.length - 1} onClick={() => step(1)}>
            Berikutnya
            <IconChevronRight width={16} height={16} />
          </Button>
        </div>
      }
    >
      <div
        onPointerDown={(event) => {
          swipe.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          const start = swipe.current;
          swipe.current = null;
          if (!start) return;
          const dx = event.clientX - start.x;
          if (Math.abs(dx) >= SWIPE && Math.abs(dx) > 2 * Math.abs(event.clientY - start.y)) step(dx < 0 ? 1 : -1);
        }}
      >
        <VisiteView
          patient={patient}
          body={current ? current.body : null}
          noteDate={current?.date ?? null}
          today={today}
          aliases={settings.sectionAliases}
        />
      </div>
    </Sheet>
  );
}
