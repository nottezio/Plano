import { useMemo, useState } from 'react';

import { Button } from '@/components/common/ui';
import { dpjpTitle } from '@/domain/floorList/build';
import { dpjpVisit, dpjpVisitText, visitDpjps } from '@/domain/floorList/dpjpVisit';
import type { FloorPatient } from '@/domain/floorList/report';
import { copyText } from '@/lib/clipboard';
import { DischargeChip } from './DischargeChip';

/**
 * Visite DPJP (11 Nov 2026, Avi): pick the DPJP who is visiting, and their
 * patients follow in visit-route order, each with Dx, Tx and Plan from the
 * SOAP (`dpjpVisit`). Tap a patient for the full SOAP. Salin gives it as one
 * WhatsApp message. Firestore: nothing read or written (the roster is loaded).
 */
export function VisitPanel({
  patients,
  ward,
  date,
  onOpen,
}: {
  patients: readonly FloorPatient[];
  ward: string;
  date: string;
  onOpen: (patient: FloorPatient) => void;
}): JSX.Element {
  const dpjps = useMemo(() => visitDpjps(patients), [patients]);
  const [picked, setPicked] = useState<string | null>(null);
  const id = picked && dpjps.some((d) => d.id === picked) ? picked : (dpjps[0]?.id ?? null);
  const rows = useMemo(() => (id ? dpjpVisit(patients, id, ward) : []), [patients, id, ward]);
  const [copied, setCopied] = useState(false);

  if (!id) return <p className="text-sm text-fg-muted">Belum ada pasien dengan DPJP di list.</p>;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="DPJP yang visite">
        {dpjps.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={d.id === id}
            onClick={() => {
              setPicked(d.id);
              setCopied(false);
            }}
            className={`min-h-tap rounded-full border px-3 text-xs font-semibold [@media(pointer:fine)]:min-h-9 ${
              d.id === id ? 'border-accent bg-accent text-on-accent' : 'border-border text-fg-muted hover:text-fg'
            }`}
          >
            {dpjpTitle(d.id)} <span className="tabular-nums">({d.count})</span>
          </button>
        ))}
        <span className="flex-1" />
        <Button size="sm" onClick={() => void copyText(dpjpVisitText(id, date, rows)).then(setCopied)}>
          {copied ? 'Tersalin' : 'Salin'}
        </Button>
      </div>

      {/*
        From 1024 px Dx | Tx | Plan stand side by side after the patient (12 Nov 2026): stacked,
        each card used the left third of a wide screen and was twice as tall as its text.
      */}
      <ol className="space-y-2">
        {rows.map((row, k) => (
          <li key={row.patient.key} className="rounded-xl border border-border bg-surface p-3 lg:grid lg:grid-cols-[14rem_repeat(3,minmax(0,1fr))] lg:gap-x-5">
            <div className="min-w-0">
              <button type="button" onClick={() => onOpen(row.patient)} className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-left hover:underline">
                <span className="text-sm font-semibold tabular-nums">
                  {k + 1}. {row.patient.room || '—'}
                  {row.patient.bed ? `/${row.patient.bed}` : ''}
                </span>
                <span className="min-w-0 text-sm font-semibold">{row.patient.name || row.patient.identity}</span>
                <DischargeChip patient={row.patient} long />
                {row.kjs ? <span className="rounded border border-border px-1 text-[11px] font-semibold text-fg-muted">KJS</span> : null}
              </button>
              <p className="mt-0.5 text-xs text-fg-muted">
                {[row.patient.junior, row.patient.chief].filter(Boolean).map((n) => `dr. ${n.replace(/^dr\.?\s*/i, '')}`).join(' / ') || 'belum ada residen'}
              </p>
            </div>
            <dl className="mt-2 grid gap-x-3 gap-y-1.5 text-cbody sm:grid-cols-[3.5rem_1fr] lg:col-span-3 lg:mt-0 lg:grid-cols-3 lg:gap-x-5">
              {(
                [
                  ['Dx', row.dx],
                  ['Tx', row.tx],
                  ['Plan', row.plan],
                ] as const
              ).map(([title, lines]) => (
                <div key={title} className="contents lg:block lg:min-w-0">
                  <dt className="text-xs font-semibold text-fg-muted sm:pt-0.5 lg:pt-0">{title}</dt>
                  <dd className="whitespace-pre-wrap break-words lg:mt-0.5">{lines.length > 0 ? lines.join('\n') : <span className="text-fg-faint">—</span>}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
}
