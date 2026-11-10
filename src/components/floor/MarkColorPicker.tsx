import type { KeyboardEvent } from 'react';

import { MARK_COLORS, markCss, type MarkColor } from '@/domain/floorList/marks';

const COLORS = Object.keys(MARK_COLORS) as MarkColor[];

/**
 * The list's colours as swatches (10 Nov 2026, Avi: "a palleted colour
 * picker suited to the app"). A palette, not a free hex: each swatch is a
 * token with a light, dark and Senja value that passes contrast and a Word
 * colour, so a tag looks right everywhere (the Colour-Is-Data rule).
 * A radio group: arrow keys move, the name is the swatch's label.
 */
export function MarkColorPicker({ value, onChange, label }: { value: MarkColor; onChange: (color: MarkColor) => void; label: string }): JSX.Element {
  const move = (e: KeyboardEvent<HTMLButtonElement>, step: number): void => {
    e.preventDefault();
    const next = COLORS[(COLORS.indexOf(value) + step + COLORS.length) % COLORS.length]!;
    onChange(next);
    // Keep focus on the newly picked swatch, as a native radio group does.
    e.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-color="${next}"]`)?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-0.5">
      {COLORS.map((c) => {
        const on = c === value;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={MARK_COLORS[c].name}
            title={MARK_COLORS[c].name}
            data-color={c}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(c)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(e, 1);
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(e, -1);
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
  );
}
