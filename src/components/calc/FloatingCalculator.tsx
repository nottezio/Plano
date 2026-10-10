import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';

import {
  OsmolalityCard,
  SodiumGlucoseCard,
  UnitConverterCard,
  UrineOutputCard,
} from '@/components/calc/ClinicalCards';
import { IconClose, IconGrip } from '@/components/common/Icons';
import { HeparinCard } from './HeparinCard';
import { Segmented } from '@/components/common/ui';
import {
  ARITHMETIC_ERROR_TEXT,
  evaluate,
  formatResult,
  type ArithmeticError,
} from '@/domain/calc/arithmetic';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { copyText } from '@/lib/clipboard';

/**
 * A calculator that floats over the SOAP (2026-10-05).
 *
 * The point is to be open WHILE writing: a drip rate, a fluid balance, a sum of
 * intake lines, without leaving the note or losing the caret's place. So it is
 * deliberately not a Sheet. A Sheet is modal — it dims the page, traps focus,
 * and blocks the editor underneath, which is the opposite of the job. This is
 * a plain non-modal panel (`aria-modal="false"`): the note stays editable and
 * selectable behind it.
 *
 * TWO TABS, because there are two different needs and one did not cover both.
 * `Hitung` is plain arithmetic (typed, or from a keypad). `Klinis` is the same
 * bedside cards as the Kalkulator page, from one shared definition — a formula
 * corrected there is corrected here.
 *
 * Nothing is stored except where the panel sits, whether it is folded, and the
 * tab. The tape of results lives and dies with the panel, for the reason the
 * Kalkulator page gives: a history would be numbers with no patient attached.
 *
 * On a phone it docks to the bottom instead of floating (dragging a panel
 * around a 360 px screen is a way to lose it), and the keypad replaces the
 * system keyboard, which would otherwise cover the note it is meant to sit over.
 */

type Tab = 'hitung' | 'klinis';

interface Prefs {
  x: number | null;
  y: number | null;
  folded: boolean;
  tab: Tab;
}

const STORAGE_KEY = 'plano.floatCalc';
const DEFAULT_PREFS: Prefs = { x: null, y: null, folded: false, tab: 'hitung' };
/** Distance kept from the window edge, so the header can always be grabbed. */
const MARGIN = 8;
const TAPE_LENGTH = 5;

function readPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    const coordinate = (value: unknown): number | null =>
      typeof value === 'number' && Number.isFinite(value) ? value : null;
    return {
      x: coordinate(parsed.x),
      y: coordinate(parsed.y),
      folded: parsed.folded === true,
      tab: parsed.tab === 'klinis' ? 'klinis' : 'hitung',
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(prefs: Prefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Not remembered; the panel still works for this visit.
  }
}

interface TapeEntry {
  id: number;
  read: string;
  result: string;
}

/** Keypad, row by row. `⌫` and `C` are handled apart from the characters. */
const KEYS: ReadonlyArray<readonly string[]> = [
  ['C', '(', ')', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', ',', '%', '='],
];

export function FloatingCalculator({
  onClose,
  noteBody,
  onInsertTerapi,
}: {
  onClose: () => void;
  /** The open note, for cards that prefill from it (heparin). */
  noteBody?: string | undefined;
  /** Adds a line to the note's Terapi list; false when the note has none. */
  onInsertTerapi?: ((line: string) => boolean) | undefined;
}): JSX.Element {
  const desktop = useMediaQuery('(min-width: 640px)');
  const coarse = useMediaQuery('(pointer: coarse)');
  const [prefs, setPrefsState] = useState<Prefs>(readPrefs);
  const setPrefs = useCallback((update: (current: Prefs) => Prefs): void => {
    setPrefsState((current) => {
      const next = update(current);
      writePrefs(next);
      return next;
    });
  }, []);

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const tapeId = useRef(0);
  const labelId = useId();

  const [text, setText] = useState('');
  const [tape, setTape] = useState<TapeEntry[]>([]);
  const [problem, setProblem] = useState<ArithmeticError | null>(null);
  const [copied, setCopied] = useState(false);

  const live = useMemo(() => evaluate(text), [text]);
  /** A bare number needs no "= …" line under it. */
  const showLive = live.ok && /[+\-−–×x÷/:*^%()]/.test(text.replace(/^\s*[-−–+]/, ''));

  /* ── position ─────────────────────────────────────────────────────── */

  const clamp = useCallback((x: number, y: number): { x: number; y: number } => {
    const box = panelRef.current?.getBoundingClientRect();
    const width = box?.width ?? 352;
    const height = box?.height ?? 200;
    return {
      x: Math.max(MARGIN, Math.min(x, window.innerWidth - width - MARGIN)),
      y: Math.max(MARGIN, Math.min(y, window.innerHeight - height - MARGIN)),
    };
  }, []);

  // The window got smaller, or the panel got taller (a tab with more in it):
  // pull it back on screen rather than leave its header out of reach.
  useEffect(() => {
    if (!desktop || prefs.x === null || prefs.y === null) return;
    const next = clamp(prefs.x, prefs.y);
    if (next.x !== prefs.x || next.y !== prefs.y) setPrefs((current) => ({ ...current, ...next }));
  }, [desktop, prefs.x, prefs.y, prefs.folded, prefs.tab, clamp, setPrefs]);

  useEffect(() => {
    if (!desktop) return;
    const onResize = (): void =>
      setPrefsState((current) => {
        if (current.x === null || current.y === null) return current;
        const next = clamp(current.x, current.y);
        return next.x === current.x && next.y === current.y ? current : { ...current, ...next };
      });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [desktop, clamp]);

  const onHeaderDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!desktop || (event.target as HTMLElement).closest('button')) return;
    const box = panelRef.current?.getBoundingClientRect();
    if (!box) return;
    drag.current = { dx: event.clientX - box.left, dy: event.clientY - box.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onHeaderMove = (event: PointerEvent<HTMLDivElement>): void => {
    const grab = drag.current;
    if (!grab) return;
    const next = clamp(event.clientX - grab.dx, event.clientY - grab.dy);
    setPrefsState((current) => ({ ...current, ...next }));
  };
  const onHeaderUp = (): void => {
    if (!drag.current) return;
    drag.current = null;
    setPrefsState((current) => {
      writePrefs(current);
      return current;
    });
  };

  /* ── typing ───────────────────────────────────────────────────────── */

  // Opens ready to type on a laptop. Not on a touch screen, where focusing
  // would raise the keyboard over the note.
  useEffect(() => {
    if (!coarse) inputRef.current?.focus({ preventScroll: true });
  }, [coarse]);

  const edit = (build: (before: string, after: string, selected: string) => [string, number]): void => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? text.length;
    const [next, caret] = build(text.slice(0, start), text.slice(end), text.slice(start, end));
    setText(next);
    setProblem(null);
    requestAnimationFrame(() => {
      input?.focus({ preventScroll: true });
      input?.setSelectionRange(caret, caret);
    });
  };

  const insert = (value: string): void =>
    edit((before, after) => [before + value + after, before.length + value.length]);

  const backspace = (): void =>
    edit((before, after, selected) =>
      selected ? [before + after, before.length] : [before.slice(0, -1) + after, Math.max(0, before.length - 1)],
    );

  const clear = (): void => {
    setText('');
    setProblem(null);
    inputRef.current?.focus({ preventScroll: true });
  };

  const commit = (): void => {
    const result = evaluate(text);
    if (!result.ok) {
      setProblem(result.reason);
      return;
    }
    const formatted = formatResult(result.value);
    setTape((current) =>
      [{ id: ++tapeId.current, read: result.read, result: formatted }, ...current].slice(0, TAPE_LENGTH),
    );
    // The result becomes the next line, so a chain of steps needs no retyping.
    setText(formatted);
    setProblem(null);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      input?.focus({ preventScroll: true });
      input?.setSelectionRange(formatted.length, formatted.length);
    });
  };

  const copyLatest = (): void => {
    const value = live.ok ? formatResult(live.value) : tape[0]?.result;
    if (!value) return;
    void copyText(value).then((ok) => {
      setCopied(ok);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  const pressKey = (key: string): void => {
    if (key === 'C') clear();
    else if (key === '=') commit();
    else insert(key);
  };

  /* ── layout ───────────────────────────────────────────────────────── */

  const placed = desktop && prefs.x !== null && prefs.y !== null;
  const summary = live.ok && showLive ? `= ${formatResult(live.value)}` : null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={labelId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
      style={placed ? { left: prefs.x ?? 0, top: prefs.y ?? 0, right: 'auto', bottom: 'auto' } : undefined}
      className={[
        'fixed z-40 flex flex-col overflow-hidden border border-border bg-surface shadow-2xl',
        // phone: docked above the tab bar
        'inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] rounded-2xl',
        // laptop: floats, bottom right until it is moved
        'sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[22rem]',
      ].join(' ')}
    >
      <div
        onPointerDown={onHeaderDown}
        onPointerMove={onHeaderMove}
        onPointerUp={onHeaderUp}
        onPointerCancel={onHeaderUp}
        className={[
          'flex touch-none select-none items-center gap-2 border-b border-border bg-bg-subtle px-3 py-1.5',
          desktop ? 'cursor-grab active:cursor-grabbing' : '',
        ].join(' ')}
      >
        {desktop ? <IconGrip width={14} height={14} className="shrink-0 text-fg-faint" aria-hidden="true" /> : null}
        <h2 id={labelId} className="text-xs font-semibold text-fg">
          Kalkulator
        </h2>
        {prefs.folded && summary ? (
          <span className="min-w-0 flex-1 truncate text-right font-mono text-xs tabular-nums text-fg-muted">
            {summary}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <button
          type="button"
          onClick={() => setPrefs((current) => ({ ...current, folded: !current.folded }))}
          aria-label={prefs.folded ? 'Buka kalkulator' : 'Lipat kalkulator'}
          aria-expanded={!prefs.folded}
          className="flex min-h-tap min-w-tap items-center justify-center rounded-full text-fg-muted hover:bg-surface hover:text-fg [@media(pointer:fine)]:min-h-8 [@media(pointer:fine)]:min-w-8"
        >
          <span aria-hidden="true" className="text-base leading-none">
            {prefs.folded ? '▴' : '▾'}
          </span>
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup kalkulator"
          className="flex min-h-tap min-w-tap items-center justify-center rounded-full text-fg-muted hover:bg-surface hover:text-fg [@media(pointer:fine)]:min-h-8 [@media(pointer:fine)]:min-w-8"
        >
          <IconClose width={16} height={16} />
        </button>
      </div>

      {/* Hidden, not unmounted, when folded: the line and the tape survive. */}
      <div className={prefs.folded ? 'hidden' : 'flex min-h-0 flex-col'}>
        <div className="px-3 pt-3">
          <Segmented
            size="sm"
            label="Jenis kalkulator"
            value={prefs.tab}
            onChange={(tab) => setPrefs((current) => ({ ...current, tab }))}
            options={[
              ['hitung', 'Hitung'],
              ['klinis', 'Klinis'],
            ]}
          />
        </div>

        <div className={prefs.tab === 'hitung' ? 'space-y-2 p-3' : 'hidden'}>
          <input
            ref={inputRef}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setProblem(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
              }
            }}
            // The keypad is the input on a touch screen; the system keyboard
            // would cover the note this panel sits over.
            inputMode={coarse ? 'none' : 'text'}
            enterKeyHint="done"
            aria-label="Hitungan"
            aria-describedby={`${labelId}-hint`}
            placeholder="mis. 1.250 + 480 − 3,5 × 2"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="min-h-tap w-full rounded-xl border border-border bg-bg px-3 text-right font-mono text-base tabular-nums text-fg outline-none placeholder:text-xs placeholder:text-fg-faint focus:border-accent [@media(pointer:fine)]:min-h-10"
          />

          <div className="min-h-[2.75rem]" aria-live="polite">
            {problem ? (
              <p role="alert" className="text-xs text-danger">
                {ARITHMETIC_ERROR_TEXT[problem]}
              </p>
            ) : live.ok && showLive ? (
              <>
                <p className="text-right font-mono text-xl font-semibold tabular-nums text-fg">
                  = {formatResult(live.value)}
                </p>
                <p className="text-right font-mono text-[11px] text-fg-faint">Dibaca: {live.read}</p>
              </>
            ) : (
              <p id={`${labelId}-hint`} className="text-[11px] leading-relaxed text-fg-faint">
                Titik tiga digit = ribuan (12.000), koma = desimal (3,1). Enter untuk menghitung.
              </p>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {KEYS.flat().map((key) => {
              const operator = /[÷×−+=]/.test(key);
              return (
                <button
                  key={key}
                  type="button"
                  // Keep the caret in the line: a button press must not blur it.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pressKey(key)}
                  aria-label={
                    key === 'C' ? 'Hapus semua' : key === '=' ? 'Hitung hasil' : key === '−' ? 'Kurang' : undefined
                  }
                  className={[
                    'min-h-tap rounded-lg border text-sm font-medium tabular-nums transition-colors [@media(pointer:fine)]:min-h-9',
                    key === '='
                      ? 'border-accent bg-accent text-white hover:opacity-90'
                      : operator
                      ? 'border-border bg-bg-subtle text-accent hover:bg-surface'
                      : key === 'C'
                      ? 'border-border bg-bg-subtle text-danger hover:bg-surface'
                      : 'border-border bg-surface text-fg hover:bg-bg-subtle',
                  ].join(' ')}
                >
                  {key}
                </button>
              );
            })}
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={backspace}
              aria-label="Hapus satu karakter"
              className="min-h-tap flex-1 rounded-lg border border-border text-xs text-fg-muted hover:bg-bg-subtle [@media(pointer:fine)]:min-h-9"
            >
              ⌫ Hapus
            </button>
            <button
              type="button"
              onClick={copyLatest}
              disabled={!live.ok && tape.length === 0}
              className="min-h-tap flex-1 rounded-lg border border-accent text-xs font-medium text-accent disabled:opacity-40 [@media(pointer:fine)]:min-h-9"
            >
              {copied ? 'Tersalin ✓' : 'Salin hasil'}
            </button>
          </div>

          {tape.length > 0 ? (
            <ul aria-label="Hasil sebelumnya" className="space-y-0.5 border-t border-border pt-2">
              {tape.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => insert(entry.result)}
                    title="Pakai hasil ini di hitungan"
                    className="flex w-full items-baseline justify-between gap-3 rounded-md px-1 py-0.5 text-left font-mono text-[11px] hover:bg-bg-subtle"
                  >
                    <span className="min-w-0 truncate text-fg-faint">{entry.read}</span>
                    <span className="shrink-0 tabular-nums text-fg">= {entry.result}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Mounted in both tabs so a half-filled card survives a switch. */}
        <div
          className={
            prefs.tab === 'klinis'
              ? 'max-h-[min(30rem,55dvh)] space-y-3 overflow-y-auto overscroll-contain p-3'
              : 'hidden'
          }
        >
          <UrineOutputCard />
          <OsmolalityCard />
          <SodiumGlucoseCard />
          <HeparinCard noteBody={noteBody} onInsertTerapi={onInsertTerapi} />
          <UnitConverterCard />
        </div>
      </div>
    </div>
  );
}
