import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import type { FloorDoc, RosterPatient } from '@/domain/floorList/floor';
import { IconClose } from '@/components/common/Icons';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { clampGeometry, currentViewport, dragGeometry, readStoredGeometry, type Geometry } from '@/lib/floatGeometry';
import { PastePanel } from './PastePanel';

const GEOMETRY_KEY = 'plano.listmaker.pasteFloat';
const MIN = { w: 340, h: 260 };

function defaultGeometry(): Geometry {
  const w = Math.min(480, window.innerWidth - 32);
  return { x: window.innerWidth - w - 16, y: window.innerHeight - Math.min(640, window.innerHeight - 120) - 16, w, h: Math.min(640, window.innerHeight - 120) };
}

const clamp = (g: Geometry): Geometry => clampGeometry(g, currentViewport(), MIN);

function initialGeometry(): Geometry {
  try {
    return clamp(readStoredGeometry(localStorage.getItem(GEOMETRY_KEY)) ?? defaultGeometry());
  } catch {
    return clamp(defaultGeometry());
  }
}

/**
 * Tempel as a floating box over the List tab (2026-10-16, Avi: "add a tempel
 * button that opens a floating box for pasting a WhatsApp message").
 *
 * Not a modal: the list stays readable and live behind it, so what a paste
 * changed shows in the list the moment it is saved, and the box stays open
 * for the next message. The same panel as the Tempel tab — one paste flow,
 * with its review and its undo.
 *
 * From 640 px it is moved by its header and resized from its corner
 * (2026-10-17, Avi), remembered on this device, like the SOAP boxes; on a
 * phone it stays a bottom sheet.
 */
export function PasteFloat({
  floor,
  roster,
  myName,
  onClose,
}: {
  floor: FloorDoc;
  roster: readonly RosterPatient[];
  myName: string;
  onClose: () => void;
}): JSX.Element {
  const floating = useMediaQuery('(min-width: 640px)');
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const drag = useRef<{ kind: 'move' | 'resize'; startX: number; startY: number; from: Geometry } | null>(null);

  useEffect(() => {
    if (floating && !geometry) setGeometry(initialGeometry());
  }, [floating, geometry]);
  // A smaller window keeps the box on it.
  useEffect(() => {
    if (!floating) return undefined;
    const onResize = (): void => setGeometry((g) => (g ? clamp(g) : g));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [floating]);

  const begin = (kind: 'move' | 'resize') => (event: ReactPointerEvent<HTMLElement>): void => {
    if (!floating || !geometry) return;
    if (kind === 'move' && (event.target as HTMLElement).closest('button, input, textarea')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { kind, startX: event.clientX, startY: event.clientY, from: geometry };
  };
  const move = (event: ReactPointerEvent<HTMLElement>): void => {
    const d = drag.current;
    if (d) setGeometry(clamp(dragGeometry(d.from, d.kind, event.clientX - d.startX, event.clientY - d.startY)));
  };
  const end = (): void => {
    if (!drag.current) return;
    drag.current = null;
    try {
      if (geometry) localStorage.setItem(GEOMETRY_KEY, JSON.stringify(geometry));
    } catch {
      // Not remembered: fine.
    }
  };

  const placed = floating && geometry;
  return (
    <section
      role="dialog"
      aria-label="Tempel pesan WhatsApp"
      style={placed ? { left: geometry.x, top: geometry.y, width: geometry.w, height: geometry.h } : undefined}
      className={
        placed
          ? 'fixed z-40 flex flex-col rounded-2xl border border-border bg-surface shadow-sheet'
          : 'fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col rounded-t-2xl border border-border bg-surface shadow-sheet'
      }
    >
      <header
        onPointerDown={begin('move')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className={`flex touch-none select-none items-center gap-2 border-b border-border px-3 py-1.5 ${placed ? 'cursor-move' : ''}`}
      >
        <h2 className="flex-1 text-sm font-semibold">Tempel pesan WhatsApp</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup Tempel"
          className="flex min-h-tap min-w-tap items-center justify-center rounded-lg text-fg-muted hover:bg-bg-subtle hover:text-fg [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9"
        >
          <IconClose width={18} height={18} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <PastePanel floor={floor} roster={roster} myName={myName} />
      </div>
      {placed ? (
        <div
          role="separator"
          aria-label="Ubah ukuran kotak Tempel"
          onPointerDown={begin('resize')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="absolute bottom-0 right-0 flex h-5 w-5 cursor-se-resize touch-none items-end justify-end rounded-br-2xl p-1 text-fg-faint"
        >
          <span aria-hidden="true" className="block h-2 w-2 border-b-2 border-r-2 border-current" />
        </div>
      ) : null}
    </section>
  );
}
