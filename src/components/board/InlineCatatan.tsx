import { useLayoutEffect, useRef, useState } from 'react';

import { usePatientNotes } from '@/components/patient/PatientNotes';
import type { Patient } from '@/domain/types';
import { HoverDetail } from './HoverDetail';

const LINES_AT_REST = 3;
const LINES_WHILE_TYPING = 12;

/**
 * Catatan typed where it is read, in Kartu Ringkas and Papan Kerja.
 *
 * The same field and the same hook as the summary sticky and the patient page,
 * so all three are one note and merge the same way. The text is never changed
 * for display: at rest the box shows a few lines and says how many more there
 * are; the ✎ button (or Tab) opens it up, and past twelve lines it scrolls.
 */
export function InlineCatatan({
  patient,
  name,
  readOnly = false,
  linesAtRest = LINES_AT_REST,
}: {
  patient: Patient;
  name: string;
  /** Papan Kerja shows two: every line is paid for by the whole row. */
  linesAtRest?: number;
  /** While selecting, a tap means "tick this patient". */
  readOnly?: boolean;
}): JSX.Element {
  const sync = usePatientNotes(patient);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const [hiddenLines, setHiddenLines] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const measure = (): void => {
      const line = Number.parseFloat(getComputedStyle(node).lineHeight) || 16;
      node.style.height = 'auto';
      const full = node.scrollHeight;
      const limit = line * (focused ? LINES_WHILE_TYPING : linesAtRest);
      node.style.height = `${Math.min(full, limit)}px`;
      setHiddenLines(focused ? 0 : Math.max(0, Math.ceil((full - limit - 1) / line)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [sync.value, focused, linesAtRest]);

  return (
    <HoverDetail title="Catatan" text={hiddenLines > 0 ? sync.value : ''} disabled={focused}>
      <div className="flex items-start gap-1">
      <textarea
        ref={ref}
        value={sync.value}
        readOnly={readOnly}
        onChange={(event) => sync.setValue(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          sync.flush();
        }}
        rows={1}
        placeholder="Tulis catatan…"
        aria-label={`Catatan pasien ${name}`}
        className={[
          'block min-w-0 flex-1 resize-none rounded bg-transparent text-xs leading-snug [overflow-wrap:anywhere] placeholder:text-[color-mix(in_srgb,currentColor_75%,transparent)]',
          // At rest a click passes through to the card's link: the note covers too much of the card to catch it.
          focused ? 'overflow-y-auto bg-black/10 dark:bg-white/10' : 'pointer-events-none overflow-hidden',
        ].join(' ')}
        style={{ color: 'inherit' }}
      />
      {readOnly ? null : (
        <button
          type="button"
          aria-label={`Ubah catatan ${name}`}
          title="Ubah catatan"
          // Keeps the caret in the note when it is already open.
          onPointerDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const node = ref.current;
            node?.focus();
            node?.setSelectionRange(node.value.length, node.value.length);
          }}
          className="-my-1 flex min-h-tap w-6 shrink-0 items-center justify-center rounded text-sm leading-none hover:bg-black/15 dark:hover:bg-white/15 [@media(pointer:fine)]:my-0 [@media(pointer:fine)]:min-h-5"
        >
          <span aria-hidden="true">✎</span>
        </button>
      )}
      </div>
      {hiddenLines > 0 ? <p className="text-[11px] font-semibold opacity-80">+{hiddenLines} baris</p> : null}
    </HoverDetail>
  );
}
