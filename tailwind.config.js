/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // toggled by ThemeProvider; 'system' resolves to a class too
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Shell colours map to the CSS variables in styles/tokens.css so that
        // dark mode is a single class flip and never a second Tailwind palette.
        bg: 'var(--bg)',
        'bg-subtle': 'var(--bg-subtle)',
        surface: 'var(--surface)',
        'surface-raised': 'var(--surface-raised)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        fg: 'var(--fg)',
        'fg-muted': 'var(--fg-muted)',
        'fg-faint': 'var(--fg-faint)',
        accent: 'var(--accent)',
        danger: 'var(--danger)',
        // Resolved checklist token trio (see [data-color-token] in tokens.css)
        token: 'var(--token-bg)',
        'token-accent': 'var(--token-accent)',
        'token-fg': 'var(--token-fg)',
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
      minHeight: { tap: '44px' },
      minWidth: { tap: '44px' },
      fontFamily: {
        sans: [
          'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue',
          'Arial', 'Noto Sans', 'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
