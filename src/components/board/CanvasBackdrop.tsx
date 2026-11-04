import type { ReactNode } from 'react';

import { canvasBackgroundOf } from '@/domain/boardBackground';
import { useSession } from '@/store/useSession';

/**
 * The unlabelled floor plan behind the canvas ("Denah ruangan"): two columns of
 * room outlines either side of a nurse-station strip. Rows are many and the
 * layer clips them, so it fills any canvas height. Decoration only.
 */
export function CanvasRooms({ rows = 16, compact = false }: { rows?: number; compact?: boolean }): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="canvas-rooms"
      // The settings picker's small sample: the same rules, scaled down.
      style={compact ? ({ '--room-h': '20px', '--room-gap': '4px', '--station-w': '16px' } as React.CSSProperties) : undefined}
    >
      <div className="station" />
      {Array.from({ length: rows }, (_, row) => (
        <div key={`l${row}`} className="room left" style={{ gridRow: row + 1 }} />
      ))}
      {Array.from({ length: rows }, (_, row) => (
        <div key={`r${row}`} className="room right" style={{ gridRow: row + 1 }} />
      ))}
    </div>
  );
}

/**
 * Draws the chosen background behind the free canvas (desktop and phone). It
 * fills at least the visible height so the board reads as a panel, and its own
 * stacking context keeps the cards and the pen strokes above it.
 */
export function CanvasBackdrop({ children }: { children: ReactNode }): JSX.Element {
  const look = useSession((state) => canvasBackgroundOf(state.settings().canvasBackground));
  return (
    <div
      data-canvas-bg={look}
      className="relative isolate min-h-[calc(var(--app-h,100dvh)-9rem)]"
    >
      {look === 'denah' ? <CanvasRooms /> : null}
      {children}
    </div>
  );
}
