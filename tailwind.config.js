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
        'on-accent': 'var(--on-accent)',
        'on-danger': 'var(--on-danger)',
        danger: 'var(--danger)',
        // Resolved checklist token trio (see [data-color-token] in tokens.css)
        token: 'var(--token-bg)',
        'token-accent': 'var(--token-accent)',
        'token-fg': 'var(--token-fg)',
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        // Kepadatan (Pengaturan → Tema): the values live in styles/index.css under [data-density].
        'd-card': 'var(--d-card)',
        'd-card-s': 'var(--d-card-s)',
        'd-band': 'var(--d-band)',
        'd-gap': 'var(--d-gap)',
        'd-flag': 'var(--d-flag)',
        'd-row': 'var(--d-row)',
      },
      // Ukuran teks (Pengaturan → Tema): the documented ramp times one factor, --tf.
      // `note` is the SOAP text, `ctitle` card titles and list rows, `cbody` the 12 px card lines.
      fontSize: {
        note: ['calc(0.9375rem * var(--tf))', { lineHeight: 'calc(1.75rem * var(--tf))' }],
        ctitle: ['calc(0.875rem * var(--tf))', { lineHeight: '1.375' }],
        cbody: ['calc(0.75rem * var(--tf))', { lineHeight: '1.375' }],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
        sheet: 'var(--shadow-sheet)',
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
