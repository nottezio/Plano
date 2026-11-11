import { useEffect, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { IconChevronRight } from '@/components/common/Icons';
import { MARK_COLORS, hueColor, hueOf, markCss, markInfo, type MarkColor } from '@/domain/floorList/marks';
import { Popover } from './ListActions';

const PRESETS = Object.keys(MARK_COLORS) as Array<keyof typeof MARK_COLORS>;
/** The ring's gradient, drawn with the theme's own lightness and chroma, so it shows what a tag will look like. */
const RING = `conic-gradient(${Array.from({ length: 13 }, (_, i) => `oklch(var(--hue-l) var(--hue-c) ${i * 30})`).join(', ')})`;
const SIZE = 132;
const BAND = 20;

/** Hue of a pointer on the ring: 0° at the top, clockwise, as the conic gradient draws it. */
function hueAt(e: PointerEvent<HTMLDivElement>): number {
  const box = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - box.left - box.width / 2;
  const y = e.clientY - box.top - box.height / 2;
  return ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
}

/**
 * The tag colour (11 Nov 2026, Avi: "a colour wheel where you can choose the
 * colour"). A hue ring: drag or tap anywhere on it, or use the arrow keys
 * (Shift = 15°). Only the hue is chosen; lightness and chroma are the
 * theme's, so any hue reads at 4.5:1 in every theme and prints in a matching
 * Word colour. The named palette stays as quick picks beside it (grey and
 * brown are not on the ring).
 *
 * Firestore: a drag writes once, on release; arrow keys write on key-up.
 */
export function MarkColorPicker({ value, onChange, label }: { value: MarkColor; onChange: (color: MarkColor) => void; label: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MarkColor>(value);
  useEffect(() => setDraft(value), [value]);
  const hue = hueOf(draft);
  const commit = (color: MarkColor): void => {
    if (color !== value) onChange(color);
  };
  const angle = ((hue ?? 0) * Math.PI) / 180;
  const radius = SIZE / 2 - BAND / 2;
  const thumb = { left: SIZE / 2 + Math.sin(angle) * radius, top: SIZE / 2 - Math.cos(angle) * radius };
  const key = (e: KeyboardEvent<HTMLDivElement>): void => {
    const step = e.shiftKey ? 15 : 5;
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : 0;
    if (!delta) return;
    e.preventDefault();
    setDraft(hueColor((hue ?? 0) + delta));
  };

  // Folded (11 Nov 2026, Avi: the wheel took too much room): a swatch button opens it, as in other apps.
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      label={label}
      align="left"
      trigger={
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${label}: ${markInfo(value).name}`}
          title={label}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-border px-2 text-xs text-fg-muted [@media(pointer:fine)]:min-h-9"
        >
          <span aria-hidden="true" className="h-4 w-4 rounded-full" style={{ background: markCss(value) }} />
          <span>{markInfo(value).name}</span>
          <IconChevronRight width="12" height="12" aria-hidden="true" className={`transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
        </button>
      }
    >
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <div
        role="slider"
        tabIndex={0}
        aria-label={`${label}: roda warna`}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={hue ?? 0}
        aria-valuetext={hue === null ? `${markInfo(draft).name} (palet)` : `${hue}°`}
        onKeyDown={key}
        onKeyUp={() => commit(draft)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDraft(hueColor(hueAt(e)));
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) setDraft(hueColor(hueAt(e)));
        }}
        onPointerUp={(e) => commit(hueColor(hueAt(e)))}
        className="relative shrink-0 cursor-pointer touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        style={{ width: SIZE, height: SIZE, background: RING }}
      >
        {/* The hole shows the chosen colour as the tag will read. */}
        <span aria-hidden="true" className="absolute flex items-center justify-center rounded-full bg-surface" style={{ inset: BAND }}>
          <span className="h-9 w-9 rounded-full" style={{ background: markCss(draft) }} />
        </span>
        {hue !== null ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
            style={{ ...thumb, background: markCss(draft) }}
          />
        ) : null}
      </div>
      <div role="radiogroup" aria-label={`${label}: palet`} className="flex max-w-[7.5rem] flex-wrap gap-0.5">
        {PRESETS.map((c) => {
          const on = c === draft;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={MARK_COLORS[c].name}
              title={MARK_COLORS[c].name}
              onClick={() => {
                setDraft(c);
                commit(c);
                setOpen(false);
              }}
              className="flex min-h-tap min-w-tap items-center justify-center rounded-full [@media(pointer:fine)]:min-h-8 [@media(pointer:fine)]:min-w-8"
            >
              <span
                aria-hidden="true"
                className={`block h-5 w-5 rounded-full transition-shadow ${on ? 'ring-2 ring-fg ring-offset-2 ring-offset-surface' : ''}`}
                style={{ background: markCss(c) }}
              />
            </button>
          );
        })}
      </div>
    </div>
    </Popover>
  );
}
