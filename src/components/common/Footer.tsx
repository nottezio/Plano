import { APP_VERSION } from '@/version.js';

/**
 * SPEC 11.1 / 16 — "© Avicenna · v{APP_VERSION}" on every page.
 * The version string is imported, never typed inline.
 */
export function Footer({ className = '' }: { className?: string }): JSX.Element {
  return (
    <footer
      className={`px-4 py-6 text-center text-[11px] leading-relaxed text-fg-faint ${className}`}
    >
      <span>© Avicenna</span>
      <span aria-hidden="true"> · </span>
      <span title="Versi aplikasi">v{APP_VERSION}</span>
    </footer>
  );
}
