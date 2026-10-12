import { useEffect, useState } from 'react';

import { dpjpById } from '@/domain/dpjp';
import { formatDmy } from '@/domain/dateDmy';
import type { FloorPatient } from '@/domain/floorList/report';
import { copyText } from '@/lib/clipboard';
import { useBackToClose } from '@/lib/useBackToClose';

/**
 * A patient's full SOAP in a floating box (12.8), for the DPJP visit.
 *
 * Floating, not a modal: on a tablet or laptop the denah stays visible and
 * clickable beside it, so the next bed is one tap away instead of
 * close-then-open. On a phone it is a bottom panel over the lower part of the
 * screen. Back and Esc close it.
 */
export function SoapFloat({ patient, onClose }: { patient: FloorPatient | null; onClose: () => void }): JSX.Element | null {
  const [copied, setCopied] = useState(false);
  useBackToClose(patient !== null, onClose);

  useEffect(() => {
    setCopied(false);
    if (!patient) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [patient, onClose]);

  if (!patient) return null;
  const dpjp = patient.dpjpId ? dpjpById(patient.dpjpId) : undefined;
  const sent = patient.sentAt ? `${formatDmy(patient.sentAt.slice(0, 10))} ${patient.sentAt.slice(11, 16)}` : '';

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label={`SOAP ${patient.name}`}
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[80dvh] flex-col rounded-t-2xl border border-border bg-surface shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-20 sm:max-h-none sm:w-[30rem] sm:rounded-2xl"
    >
      <header className="flex items-start gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">
            {patient.room}
            {patient.bed ? ` Bed ${patient.bed}` : ''} · {patient.name}
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {[dpjp?.initials, patient.rm ? `RM ${patient.rm}` : '', [patient.junior, patient.chief].filter(Boolean).join(' / ')]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {sent ? (
            <p className="mt-0.5 text-[11px] text-fg-faint">
              Laporan {sent}
              {patient.sender ? ` · ${patient.sender}` : ''}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            void copyText(patient.full).then((ok) => setCopied(ok));
          }}
          className="min-h-tap rounded-lg border border-border px-3 text-xs font-medium"
        >
          {copied ? 'Tersalin' : 'Salin'}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="min-h-tap min-w-tap rounded-lg text-lg leading-none text-fg-muted hover:bg-bg-subtle"
        >
          ×
        </button>
      </header>
      <pre className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words px-4 py-3 font-sans text-[13px] leading-relaxed">
        {patient.full}
      </pre>
    </section>
  );
}
