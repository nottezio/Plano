import { useMemo, useState } from 'react';

import { Callout } from '@/components/common/ui';
import { formatDmy } from '@/domain/dateDmy';
import { dpjpById } from '@/domain/dpjp';
import { aliasesOrDefault } from '@/domain/sections/aliases';
import type { ClinicalDate, Patient, SectionAlias } from '@/domain/types';
import { visiteSummary, type VisiteSection, type VisiteSectionId } from '@/domain/visite';

/**
 * Visite mode: the note read back as a bedside cheat sheet (2026-10-28).
 *
 * Read at arm's length while presenting to the DPJP, so it is a reading list,
 * not a form: one column, a hairline between sections, the copied lines a step
 * larger than the editor. Identity is NOT repeated here: the sheet title (board)
 * and the sticky identity bar (patient page) already carry it.
 */

/** EKG and lab blocks run long; four lines is the part read aloud first. */
const FOLD_AT = 4;
const FOLDED = new Set(['ekg', 'lab']);
const LIST_LINE = /^\s*([-*•⁃]|\d+[.)])\s/;
const OWN = new Set<VisiteSectionId>(['diagnosis', 'terapi', 'plan']);
const PENUNJANG = new Set<VisiteSectionId>(['ekg', 'lab', 'thorax', 'tindakan', 'echo']);
/** One-column order (bedside): Diagnosis, then the investigations, then Terapi and Plan. */
const ORDER_CLASS: Record<VisiteSectionId, string> = {
  diagnosis: 'order-1',
  ekg: 'order-2',
  lab: 'order-3',
  thorax: 'order-4',
  tindakan: 'order-5',
  echo: 'order-6',
  terapi: 'order-7',
  plan: 'order-8',
};

export function VisiteView({
  patient,
  body,
  noteDate,
  today,
  aliases,
}: {
  patient: Patient;
  /** null while loading. */
  body: string | null;
  noteDate: ClinicalDate | null;
  today: ClinicalDate;
  aliases?: readonly SectionAlias[] | undefined;
}): JSX.Element {
  const summary = useMemo(
    () => (body ? visiteSummary(body, aliasesOrDefault(aliases)) : null),
    [body, aliases],
  );
  const dpjp = patient.dpjpId ? dpjpById(patient.dpjpId) : undefined;
  const chief = patient.chief?.trim();

  return (
    <div className="flex flex-col gap-4">
      {dpjp || chief ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {dpjp ? (
            <>
              <dt className="text-fg-muted">DPJP</dt>
              <dd className="font-semibold text-fg">{dpjp.name}</dd>
            </>
          ) : null}
          {chief ? (
            <>
              <dt className="text-fg-muted">Chief</dt>
              <dd className="text-fg">{chief}</dd>
            </>
          ) : null}
        </dl>
      ) : null}

      {noteDate && noteDate !== today ? (
        <Callout tone="warn" title={`SOAP ${formatDmy(noteDate)}, bukan hari ini`}>
          SOAP hari ini belum ditulis; ini catatan terakhir.
        </Callout>
      ) : null}

      {body === null ? (
        <p className="py-6 text-sm text-fg-muted" role="status">
          Membuka catatan…
        </p>
      ) : !summary || summary.sections.length === 0 ? (
        <p className="py-6 text-sm text-fg-muted">
          {body.trim() ? 'Tidak ada bagian yang dikenali di catatan ini.' : 'Belum ada SOAP.'}
        </p>
      ) : (
        <>
          {/*
            Two columns once the VIEW is 40rem wide (a container query, so the
            patient page's narrower note column decides for itself): our
            reasoning left, the investigations right (Avi, 2026-10-28). Narrower,
            one column in the bedside order: Diagnosis, penunjang, Terapi, Plan.
            `contents` lets the columns' children join that one list.
          */}
          <div className="[container-type:inline-size]">
            <div className="flex flex-col border-b border-border [@container(min-width:40rem)]:grid [@container(min-width:40rem)]:grid-cols-2 [@container(min-width:40rem)]:gap-x-8 [@container(min-width:40rem)]:border-b-0">
              {[OWN, PENUNJANG].map((column, at) => (
                <div key={at} className="contents [@container(min-width:40rem)]:block [@container(min-width:40rem)]:border-b [@container(min-width:40rem)]:border-border">
                  {summary.sections
                    .filter((section) => column.has(section.id))
                    .map((section) => (
                      <VisiteBlock key={section.id} section={section} />
                    ))}
                </div>
              ))}
            </div>
          </div>
          {summary.missing.length > 0 ? (
            <p className="text-xs text-fg-faint">Tidak ada di catatan: {summary.missing.join(', ')}.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

function VisiteBlock({ section }: { section: VisiteSection }): JSX.Element {
  const [open, setOpen] = useState(false);
  const foldable = FOLDED.has(section.id) && section.lines.length > FOLD_AT + 1;
  const shown = foldable && !open ? section.lines.slice(0, FOLD_AT) : section.lines;
  const headingId = `visite-${section.id}`;

  return (
    <section aria-labelledby={headingId} className={`border-t border-border py-3 ${ORDER_CLASS[section.id]}`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h3 id={headingId} className="text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
          {section.title}
        </h3>
        {section.date ? (
          <span className="shrink-0 text-xs tabular-nums text-fg-faint">{formatDmy(section.date)}</span>
        ) : null}
      </div>
      {/* Copied lines, as written. A list line hangs, so a wrapped diagnosis still shows where each item starts. */}
      <div className="break-words text-[15px] leading-relaxed text-fg">
        {shown.map((line, index) => (
          <p key={index} className={`whitespace-pre-wrap ${LIST_LINE.test(line) ? 'pl-3 -indent-3' : ''}`}>
            {line}
          </p>
        ))}
      </div>
      {foldable ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="mt-1 min-h-tap text-sm font-medium text-accent"
        >
          {open ? 'Ringkas' : `+${section.lines.length - FOLD_AT} baris`}
        </button>
      ) : null}
    </section>
  );
}
