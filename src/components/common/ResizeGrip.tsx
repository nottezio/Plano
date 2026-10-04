import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

/**
 * A drag handle that resizes something it is next to (2026-10-05).
 *
 * Built rather than using CSS `resize`, for two reasons. `resize` only works on
 * an element with a plain height, and the Salin preview is a box that FILLS its
 * column (`flex-1`) — a flex-basis of 0 beats the height the browser writes
 * while dragging, so the drag did nothing. And the native grip is a 10 px
 * triangle in one corner that a finger cannot hit.
 *
 * It does not own the size. The caller says where the drag starts from
 * (`getStart`), is told each new value (`onChange`) and when the drag is over
 * (`onCommit`, the moment to persist), and decides what "reset" means
 * (`onReset`: double-click, or Home). Keyboard works too: arrows move it by
 * `step`, because a separator that only a mouse can move is not a control.
 *
 * `axis="y"` is a horizontal bar that changes a HEIGHT; `axis="x"` is a
 * vertical bar that changes a WIDTH. Dragging down or right always grows.
 */
export function ResizeGrip({
  axis,
  label,
  getStart,
  onChange,
  onCommit,
  onReset,
  step = 32,
  className = '',
}: {
  axis: 'x' | 'y';
  label: string;
  /** The current size, read when a drag or key press begins. */
  getStart: () => number;
  onChange: (next: number) => void;
  /** The drag or key press finished. Optional: persist from state if you can. */
  onCommit?: (() => void) | undefined;
  onReset: () => void;
  step?: number;
  className?: string;
}): JSX.Element {
  // A ref, not a local: each move re-renders the parent, and a fresh object
  // per render would forget the drag had started.
  const origin = useRef<{ pointer: number; size: number } | null>(null);

  const position = (event: PointerEvent): number => (axis === 'y' ? event.clientY : event.clientX);

  const onDown = (event: PointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    origin.current = { pointer: position(event), size: getStart() };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onMove = (event: PointerEvent<HTMLDivElement>): void => {
    const from = origin.current;
    if (from) onChange(from.size + (position(event) - from.pointer));
  };
  const onUp = (): void => {
    if (!origin.current) return;
    origin.current = null;
    onCommit?.();
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    const grow = axis === 'y' ? 'ArrowDown' : 'ArrowRight';
    const shrink = axis === 'y' ? 'ArrowUp' : 'ArrowLeft';
    if (event.key === 'Home') {
      event.preventDefault();
      onReset();
    } else if (event.key === grow || event.key === shrink) {
      event.preventDefault();
      onChange(getStart() + (event.key === grow ? step : -step));
      onCommit?.();
    }
  };

  return (
    <div
      role="separator"
      aria-orientation={axis === 'y' ? 'horizontal' : 'vertical'}
      aria-label={label}
      tabIndex={0}
      title={`${label} — seret, atau tombol panah. Klik dua kali untuk mengembalikan.`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={onReset}
      onKeyDown={onKey}
      className={[
        'group flex shrink-0 touch-none select-none items-center justify-center outline-none',
        axis === 'y' ? 'h-3 w-full cursor-row-resize' : 'w-3 cursor-col-resize self-stretch',
        className,
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'rounded-full bg-border transition-colors group-hover:bg-accent group-focus-visible:bg-accent group-active:bg-accent',
          axis === 'y' ? 'h-1 w-12' : 'h-12 w-1',
        ].join(' ')}
      />
    </div>
  );
}
