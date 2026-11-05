import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { usePatientNotes } from '@/components/patient/PatientNotes';
import type { Patient } from '@/domain/types';
import { HoverDetail } from './HoverDetail';

const LINES_UNROLLED = 12;

/**
 * Catatan as a rolled scroll, in Kartu Ringkas and Papan Kerja.
 *
 * Rolled it is one line, whatever the note holds, so adding Catatan never makes
 * a card taller. A press unrolls it downward as a layer over what is below, so
 * only the scroll grows and the card keeps its size; a press elsewhere or Esc
 * rolls it back. The same field and the same hook as the summary sticky and the
 * patient page, so all three are one note and merge the same way. The text is
 * never changed for display: the rolled line only shows its first line.
 */
export function InlineCatatan({
  patient,
  name,
  readOnly = false,
}: {
  patient: Patient;
  name: string;
  /** While selecting, a tap means "tick this patient": the press passes through to the card. */
  readOnly?: boolean;
}): JSX.Element {
  const sync = usePatientNotes(patient);
  const rootRef = useRef<HTMLDivElement>(null);
  const rollRef = useRef<HTMLButtonElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const sheetId = useId();
  const [wantOpen, setWantOpen] = useState(false);
  const [hiddenLines, setHiddenLines] = useState(0);
  const [lineCut, setLineCut] = useState(false);
  const open = wantOpen && !readOnly;
  const firstLine = sync.value.split('\n').find((line) => line.trim())?.trim() ?? '';

  useLayoutEffect(() => {
    const node = areaRef.current;
    if (!node) return undefined;
    const measure = (): void => {
      const line = Number.parseFloat(getComputedStyle(node).lineHeight) || 16;
      node.style.height = 'auto';
      const full = node.scrollHeight;
      node.style.height = `${Math.min(full, line * LINES_UNROLLED)}px`;
      setHiddenLines(Math.max(0, Math.ceil((full - line - 1) / line)));
      const shown = lineRef.current;
      if (!open && shown) setLineCut(shown.scrollWidth > shown.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [sync.value, open]);

  useEffect(() => {
    if (!open) {
      areaRef.current?.blur();
      return undefined;
    }
    // Nothing to read yet, so the press can only have meant "write".
    if (!sync.value.trim()) areaRef.current?.focus();
    const onDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setWantOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      // Only the scroll: an open preview window listens for Esc on the window.
      event.stopPropagation();
      setWantOpen(false);
      rollRef.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
    // Focus only on opening, not on each keystroke of a note that was empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <HoverDetail title="Catatan" text={hiddenLines > 0 || lineCut ? sync.value : ''} disabled={open}>
      <div
        ref={rootRef}
        className={`note-scroll relative min-h-tap [@media(pointer:fine)]:min-h-7 ${open ? 'z-30' : 'z-10'} ${readOnly ? 'pointer-events-none' : ''}`}
        data-open={open ? '' : undefined}
      >
        <div className="note-scroll-body">
          <button
            ref={rollRef}
            type="button"
            disabled={readOnly}
            aria-expanded={open}
            aria-controls={sheetId}
            aria-label={`${open ? 'Gulung' : 'Buka'} catatan ${name}`}
            title={open ? 'Gulung catatan' : 'Buka catatan'}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setWantOpen((current) => !current);
            }}
            className="note-scroll-bar flex min-h-tap w-full items-center gap-1.5 px-2 text-left text-xs [@media(pointer:fine)]:min-h-7"
          >
            <span
              ref={lineRef}
              className={`min-w-0 flex-1 truncate ${open ? 'text-[11px] font-semibold uppercase tracking-wide text-fg-muted' : firstLine ? 'font-medium' : 'text-fg-muted'}`}
            >
              {open ? 'Catatan' : firstLine || 'Tulis catatan…'}
            </span>
            {!open && hiddenLines > 0 ? <span className="shrink-0 rounded bg-bg-subtle px-1 text-[11px] font-semibold tabular-nums text-fg-muted">+{hiddenLines}</span> : null}
            <svg aria-hidden="true" viewBox="0 0 10 10" width="10" height="10" className="note-scroll-chevron shrink-0 text-fg-muted">
              <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div id={sheetId} className="note-scroll-sheet">
            <div className="min-h-0 overflow-hidden">
              <div className="border-t border-border px-2 pb-2.5 pt-1.5">
                <textarea
                  ref={areaRef}
                  value={sync.value}
                  readOnly={readOnly}
                  onChange={(event) => sync.setValue(event.target.value)}
                  onBlur={() => sync.flush()}
                  rows={1}
                  placeholder="Tulis catatan…"
                  aria-label={`Catatan pasien ${name}`}
                  className="block w-full resize-none overflow-y-auto rounded bg-transparent text-xs leading-snug [overflow-wrap:anywhere] placeholder:text-fg-muted"
                  style={{ color: 'inherit' }}
                />
              </div>
            </div>
          </div>
          <span aria-hidden="true" className="note-scroll-edge" />
        </div>
      </div>
    </HoverDetail>
  );
}
