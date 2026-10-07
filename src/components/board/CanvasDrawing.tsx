import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  DRAW_COLORS,
  STROKE_OPACITY,
  STROKE_WIDTH,
  addStroke,
  drawingBottom,
  eraseAt,
  strokePath,
  type DrawColor,
  type DrawTool,
  type Stroke,
} from '@/domain/board/drawing';
import type { BoardDrawingState } from '@/hooks/useBoardDrawing';

type Mode = DrawTool | 'eraser';

const TOOLS: ReadonlyArray<{ id: Mode; label: string; glyph: string }> = [
  { id: 'pen', label: 'Pena', glyph: '✏️' },
  { id: 'highlighter', label: 'Stabilo', glyph: '🖍️' },
  { id: 'eraser', label: 'Penghapus', glyph: '🧽' },
];

const colorCss = (id: DrawColor): string => DRAW_COLORS.find((color) => color.id === id)?.css ?? 'var(--fg)';

const BUTTON =
  'min-h-tap shrink-0 rounded-lg px-2.5 text-xs font-medium hover:bg-bg-subtle disabled:opacity-40 [@media(pointer:fine)]:min-h-9';

/**
 * Drawing on the board canvas, behind the cards (Avi, 2026-10-07).
 *
 * Two layers, deliberately separate:
 *  - the DRAWING, an SVG laid down before the cards, so every card sits on top
 *    of it and stays readable and clickable; it never takes a pointer;
 *  - while drawing, a transparent CAPTURE layer over everything, so the
 *    pointer draws instead of dragging a card or opening a patient. It exists
 *    only in draw mode: outside it the board behaves exactly as before.
 *
 * The tools go in the board toolbar beside Penanda, not over a corner of the
 * canvas, for the reason the sticker picker gives.
 */
export function CanvasDrawing({
  surfaceRef,
  enabled,
  actionsSlot,
  state,
}: {
  surfaceRef: React.RefObject<HTMLDivElement>;
  /** False while searching or selecting: the drawing stays, drawing does not. */
  enabled: boolean;
  actionsSlot?: HTMLElement | null;
  state: BoardDrawingState;
}): JSX.Element | null {
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<Mode>('pen');
  const [color, setColor] = useState<DrawColor>('ink');
  const [live, setLive] = useState<number[] | null>(null);
  const [erasing, setErasing] = useState<Stroke[] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [size, setSize] = useState({ width: 1, height: 0 });

  // The surface's size, for converting between pixels and width fractions.
  useEffect(() => {
    const node = surfaceRef.current;
    if (!node) return undefined;
    const measure = (): void => setSize({ width: Math.max(node.clientWidth, 1), height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [surfaceRef]);

  useEffect(() => {
    if (!enabled) setActive(false);
  }, [enabled]);

  const { undo, canUndo } = state;
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setActive(false);
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, undo]);

  useEffect(() => {
    if (!confirmClear) return undefined;
    const timer = window.setTimeout(() => setConfirmClear(false), 3000);
    return () => window.clearTimeout(timer);
  }, [confirmClear]);

  const points = useRef<number[]>([]);
  const frame = useRef(0);
  const working = useRef<Stroke[]>([]);

  const toCanvas = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const box = surfaceRef.current?.getBoundingClientRect();
      if (!box) return [0, 0];
      return [(clientX - box.left) / Math.max(box.width, 1), clientY - box.top];
    },
    [surfaceRef],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const [x, y] = toCanvas(event.clientX, event.clientY);
    if (mode === 'eraser') {
      working.current = eraseAt(state.strokes, x, y, size.width);
      setErasing(working.current);
      return;
    }
    points.current = [x, y];
    setLive([x, y]);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    // Every position the pointer reported since the last event, not just the
    // last one: a fast stroke otherwise draws as straight segments.
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    for (const each of events.length > 0 ? events : [event.nativeEvent]) {
      const [x, y] = toCanvas(each.clientX, each.clientY);
      if (mode === 'eraser') working.current = eraseAt(working.current, x, y, size.width);
      else points.current.push(x, y);
    }
    if (mode === 'eraser') {
      setErasing(working.current);
      return;
    }
    if (!frame.current) {
      frame.current = window.requestAnimationFrame(() => {
        frame.current = 0;
        setLive([...points.current]);
      });
    }
  };

  const finish = (event: React.PointerEvent<HTMLDivElement>, keep: boolean): void => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    window.cancelAnimationFrame(frame.current);
    frame.current = 0;
    if (mode === 'eraser') {
      if (keep && working.current.length !== state.strokes.length) state.commit(working.current);
      setErasing(null);
      return;
    }
    if (keep && points.current.length >= 2) {
      const stroke: Stroke = {
        id: `dr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        tool: mode,
        color,
        points: points.current,
      };
      state.commit(addStroke(state.strokes, stroke, size.width));
    }
    points.current = [];
    setLive(null);
  };

  const shown = erasing ?? state.strokes;
  const height = Math.max(size.height, drawingBottom(shown) + 24);

  const toolbar = (
    <span className="flex shrink-0 flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => setActive((on) => !on)}
        aria-pressed={active}
        title="Gambar di latar papan (tersimpan di perangkat ini)"
        className={`${BUTTON} ${active ? 'bg-[var(--accent-soft)] text-accent' : 'text-fg'}`}
      >
        ✏️ {active ? 'Selesai' : 'Gambar'}
      </button>
      {active ? (
        <>
          <span role="group" aria-label="Alat gambar" className="flex rounded-lg border border-border p-0.5">
            {TOOLS.map((tool) => (
              <button
                key={tool.id}
                type="button"
                aria-pressed={mode === tool.id}
                onClick={() => setMode(tool.id)}
                className={`${BUTTON} ${mode === tool.id ? 'bg-bg-subtle font-semibold text-fg' : 'text-fg-muted'}`}
              >
                <span aria-hidden="true">{tool.glyph}</span> {tool.label}
              </button>
            ))}
          </span>
          {mode !== 'eraser' ? (
            <span role="group" aria-label="Warna" className="flex items-center gap-0.5">
              {DRAW_COLORS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-label={entry.label}
                  aria-pressed={color === entry.id}
                  onClick={() => setColor(entry.id)}
                  className="flex min-h-tap min-w-tap items-center justify-center rounded-lg hover:bg-bg-subtle [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9"
                >
                  <span
                    aria-hidden="true"
                    className={`block h-4 w-4 rounded-full ${color === entry.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
                    style={{ backgroundColor: entry.css }}
                  />
                </button>
              ))}
            </span>
          ) : null}
          <button type="button" onClick={undo} disabled={!canUndo} className={`${BUTTON} text-fg`}>
            ↶ Urungkan
          </button>
          <button
            type="button"
            disabled={state.strokes.length === 0}
            onClick={() => {
              // Two presses, not a browser dialog: a dialog would freeze the
              // board, and one press is too easy to make by accident.
              if (!confirmClear) {
                setConfirmClear(true);
                return;
              }
              setConfirmClear(false);
              state.commit([]);
            }}
            className={`${BUTTON} ${confirmClear ? 'bg-[var(--danger-soft)] text-danger' : 'text-fg-muted'}`}
          >
            {confirmClear ? 'Yakin hapus semua?' : 'Hapus semua'}
          </button>
        </>
      ) : null}
    </span>
  );

  return (
    <>
      {actionsSlot && enabled ? createPortal(toolbar, actionsSlot) : null}

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0"
        width={size.width}
        height={height}
        style={{ overflow: 'visible' }}
      >
        {shown.map((stroke) => (
          <path
            key={stroke.id}
            d={strokePath(stroke.points, size.width)}
            fill="none"
            stroke={colorCss(stroke.color)}
            strokeWidth={STROKE_WIDTH[stroke.tool]}
            strokeOpacity={STROKE_OPACITY[stroke.tool]}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {live && mode !== 'eraser' ? (
          <path
            d={strokePath(live, size.width)}
            fill="none"
            stroke={colorCss(color)}
            strokeWidth={STROKE_WIDTH[mode]}
            strokeOpacity={STROKE_OPACITY[mode]}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>

      {active ? (
        <div
          role="application"
          aria-label={mode === 'eraser' ? 'Hapus gambar: seret di atas garis' : 'Gambar di papan: seret untuk menggambar'}
          className="absolute left-0 top-0 z-50 w-full"
          style={{ height, touchAction: 'none', cursor: mode === 'eraser' ? 'cell' : 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => finish(event, true)}
          onPointerCancel={(event) => finish(event, false)}
        />
      ) : null}
    </>
  );
}
