import { useLayoutEffect, useRef, useState } from 'react';

import { usePatientNotes } from '@/components/patient/PatientNotes';
import type { Patient } from '@/domain/types';

const LINES_AT_REST = 3;
const LINES_WHILE_TYPING = 12;

/**
 * Catatan typed where it is read, in Kartu Ringkas and Papan Kerja.
 *
 * The same field and the same hook as the summary sticky and the patient page,
 * so all three are one note and merge the same way. The text is never changed
 * for display: at rest the box shows a few lines and says how many more there
 * are; on focus it opens up, and past twelve lines it scrolls.
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
    <div className="min-w-0">
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
          'block w-full resize-none rounded bg-transparent text-xs leading-snug [overflow-wrap:anywhere] placeholder:text-[color-mix(in_srgb,currentColor_75%,transparent)]',
          focused ? 'overflow-y-auto bg-black/10 dark:bg-white/10' : 'overflow-hidden',
          readOnly ? 'pointer-events-none' : 'hover:bg-black/5 dark:hover:bg-white/5',
        ].join(' ')}
        style={{ color: 'inherit' }}
      />
      {hiddenLines > 0 ? <p className="text-[11px] font-semibold opacity-80">+{hiddenLines} baris</p> : null}
    </div>
  );
}
