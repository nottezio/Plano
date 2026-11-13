import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Button } from '@/components/common/ui';
import type { PhotoCrop } from '@/domain/slides/deck';
import { CROP_MIN_VISIBLE, hasCrop, NO_CROP } from '@/domain/slides/editMath';

/**
 * Crop one photo: the whole picture with a frame over the part that stays.
 * Drag an edge or a corner; arrow keys move a focused edge (1 %, 5 % with Shift).
 * The crop is a window onto the picture (nothing is deleted from the stored
 * photo), so it can always be widened again or reset.
 */

type Edge = 'l' | 't' | 'r' | 'b';
const OPPOSITE: Record<Edge, Edge> = { l: 'r', r: 'l', t: 'b', b: 't' };
const EDGE_LABEL: Record<Edge, string> = { l: 'kiri', t: 'atas', r: 'kanan', b: 'bawah' };
/** Moving the pointer right/down grows the crop on the left/top edge and shrinks it on the right/bottom. */
const SIGN: Record<Edge, number> = { l: 1, t: 1, r: -1, b: -1 };
const ARROW: Record<string, readonly ['x' | 'y', number]> = {
  ArrowRight: ['x', 1],
  ArrowLeft: ['x', -1],
  ArrowDown: ['y', 1],
  ArrowUp: ['y', -1],
};

const clampEdge = (crop: PhotoCrop, edge: Edge, value: number): number =>
  Math.min(Math.max(0, value), 1 - CROP_MIN_VISIBLE - crop[OPPOSITE[edge]]);

const pct = (v: number): string => `${v * 100}%`;

const HANDLE = 'absolute z-10 touch-none rounded-sm border-2 border-white bg-accent shadow';

const CORNERS: ReadonlyArray<readonly [string, readonly Edge[], string]> = [
  ['tl', ['t', 'l'], '-left-2 -top-2 h-4 w-4 cursor-nwse-resize'],
  ['tr', ['t', 'r'], '-right-2 -top-2 h-4 w-4 cursor-nesw-resize'],
  ['bl', ['b', 'l'], '-bottom-2 -left-2 h-4 w-4 cursor-nesw-resize'],
  ['br', ['b', 'r'], '-bottom-2 -right-2 h-4 w-4 cursor-nwse-resize'],
];

const SIDES: ReadonlyArray<readonly [Edge, string]> = [
  ['l', '-left-1.5 top-1/2 h-7 w-3 -translate-y-1/2 cursor-ew-resize'],
  ['r', '-right-1.5 top-1/2 h-7 w-3 -translate-y-1/2 cursor-ew-resize'],
  ['t', '-top-1.5 left-1/2 h-3 w-7 -translate-x-1/2 cursor-ns-resize'],
  ['b', '-bottom-1.5 left-1/2 h-3 w-7 -translate-x-1/2 cursor-ns-resize'],
];

export function CropEditor({
  url,
  crop,
  onChange,
}: {
  url: string;
  crop: PhotoCrop | undefined;
  onChange: (crop: PhotoCrop | undefined) => void;
}): JSX.Element {
  const current = crop ?? NO_CROP;
  const drag = useRef<{ edges: readonly Edge[]; x: number; y: number; from: PhotoCrop; w: number; h: number } | null>(null);

  const change = (next: PhotoCrop): void => onChange(hasCrop(next) ? next : undefined);

  const begin = (event: PointerEvent<HTMLElement>, edges: readonly Edge[]): void => {
    const box = event.currentTarget.closest('[data-crop-box]')?.getBoundingClientRect();
    if (!box) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { edges, x: event.clientX, y: event.clientY, from: current, w: box.width, h: box.height };
  };
  const move = (event: PointerEvent<HTMLElement>): void => {
    const d = drag.current;
    if (!d) return;
    const next = { ...d.from };
    for (const edge of d.edges) {
      const delta = edge === 'l' || edge === 'r' ? (event.clientX - d.x) / d.w : (event.clientY - d.y) / d.h;
      next[edge] = clampEdge(next, edge, d.from[edge] + SIGN[edge] * delta);
    }
    change(next);
  };
  const end = (): void => {
    drag.current = null;
  };
  const key = (event: KeyboardEvent<HTMLElement>, edge: Edge): void => {
    const arrow = ARROW[event.key];
    if (!arrow || (arrow[0] === 'x') !== (edge === 'l' || edge === 'r')) return;
    event.preventDefault();
    const step = (event.shiftKey ? 0.05 : 0.01) * arrow[1] * SIGN[edge];
    change({ ...current, [edge]: clampEdge(current, edge, current[edge] + step) });
  };
  const gestures = (edges: readonly Edge[]) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => begin(e, edges),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  });

  const cut = (['l', 't', 'r', 'b'] as const).filter((edge) => current[edge] > 0);
  return (
    <div className="space-y-2">
      <div data-crop-box className="relative select-none">
        <img src={url} alt="" draggable={false} className="block w-full rounded" />
        {/* The part that is cut away, dimmed. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-black/50" style={{ height: pct(current.t) }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/50" style={{ height: pct(current.b) }} />
        <div className="pointer-events-none absolute left-0 bg-black/50" style={{ top: pct(current.t), bottom: pct(current.b), width: pct(current.l) }} />
        <div className="pointer-events-none absolute right-0 bg-black/50" style={{ top: pct(current.t), bottom: pct(current.b), width: pct(current.r) }} />
        <div
          className="pointer-events-none absolute border-2 border-accent"
          style={{ left: pct(current.l), top: pct(current.t), right: pct(current.r), bottom: pct(current.b) }}
        >
          {SIDES.map(([edge, className]) => (
            <span
              key={edge}
              role="slider"
              tabIndex={0}
              aria-label={`Potong tepi ${EDGE_LABEL[edge]}`}
              aria-valuemin={0}
              aria-valuemax={Math.round((1 - CROP_MIN_VISIBLE) * 100)}
              aria-valuenow={Math.round(current[edge] * 100)}
              aria-valuetext={`${Math.round(current[edge] * 100)} persen`}
              aria-orientation={edge === 'l' || edge === 'r' ? 'horizontal' : 'vertical'}
              onKeyDown={(e) => key(e, edge)}
              className={`${HANDLE} pointer-events-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
              {...gestures([edge])}
            />
          ))}
          {CORNERS.map(([id, edges, className]) => (
            <span key={id} aria-hidden="true" className={`${HANDLE} pointer-events-auto ${className}`} {...gestures(edges)} />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-fg-muted">
          {cut.length > 0 ? `Dipotong: ${cut.map((edge) => `${EDGE_LABEL[edge]} ${Math.round(current[edge] * 100)}%`).join(', ')}` : 'Seret tepi atau sudut bingkai.'}
        </p>
        <Button size="sm" variant="quiet" disabled={!hasCrop(crop)} onClick={() => onChange(undefined)}>
          Reset potongan
        </Button>
      </div>
    </div>
  );
}
