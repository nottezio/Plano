import { THEMES, type ThemePreference } from '@/domain/theme';

type Swatch = (typeof THEMES)[number]['swatch'];

/** A small mock of the app in a theme's colours: ground, a header bar with an accent, four checklist cards. */
function Mock({ swatch }: { swatch: Swatch }): JSX.Element {
  return (
    <span aria-hidden="true" className="block h-full flex-1 p-1.5" style={{ background: swatch.bg }}>
      <span className="flex items-center gap-1 rounded-md p-1" style={{ background: swatch.surface }}>
        <span className="h-1.5 flex-1 rounded-full" style={{ background: swatch.fg, opacity: 0.7 }} />
        <span className="h-2 w-4 rounded-full" style={{ background: swatch.accent }} />
      </span>
      <span className="mt-1 flex gap-1">
        {swatch.cards.map((card) => (
          <span key={card} className="h-4 flex-1 rounded" style={{ background: card }} />
        ))}
      </span>
    </span>
  );
}

/**
 * The colour mode, as a row of previews rather than words: what Senja looks
 * like is the thing to choose by. "Sistem" shows day and night side by side.
 */
export function ThemePicker({ theme, onChange }: { theme: ThemePreference; onChange: (theme: ThemePreference) => void }): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-2 min-[560px]:grid-cols-4">
      {THEMES.map((option) => {
        const on = theme === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.id)}
            className={[
              'min-h-tap overflow-hidden rounded-xl border text-left transition-colors',
              on ? 'border-accent ring-2 ring-accent' : 'border-border hover:border-border-strong',
            ].join(' ')}
          >
            <span className="flex h-14 border-b border-border">
              <Mock swatch={option.swatch} />
              {'swatchNight' in option ? <Mock swatch={option.swatchNight} /> : null}
            </span>
            <span className="block px-2.5 py-2">
              <span className={['block text-sm', on ? 'font-semibold text-accent' : 'font-medium text-fg'].join(' ')}>{option.name}</span>
              <span className="block text-xs text-fg-faint">{option.note}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
