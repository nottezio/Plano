import { useEffect, useState } from 'react';
import { IconClose, IconShare } from './Icons';

const DISMISS_KEY = 'visite.iosInstallHint.dismissed';

function isIosSafariBrowserTab(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isIos && !isStandalone;
}

/**
 * SPEC 17 — iOS storage caveat.
 *
 * Safari evicts IndexedDB after ~7 days of non-use for *browser tabs*;
 * home-screen installs are exempt. For an offline-first clinical notebook that
 * eviction is a data-loss event, so the prompt states the reason rather than
 * nagging generically.
 */
export function IosInstallHint(): JSX.Element | null {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch (error) {
      console.warn('[install-hint] preference unreadable', error);
    }
    if (!dismissed && isIosSafariBrowserTab()) setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = (): void => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch (error) {
      console.warn('[install-hint] dismissal not persisted', error);
    }
    setShow(false);
  };

  return (
    <div className="mx-3 mb-3 flex items-start gap-3 rounded-xl border border-border bg-bg-subtle px-4 py-3 text-sm">
      <IconShare className="mt-0.5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Tambahkan ke Layar Utama</p>
        <p className="mt-0.5 text-xs text-fg-muted">
          Di Safari, data offline bisa terhapus setelah 7 hari tidak dibuka. Versi yang
          dipasang di layar utama tidak terpengaruh.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Tutup"
        className="min-h-tap min-w-tap shrink-0 text-fg-faint"
      >
        <IconClose />
      </button>
    </div>
  );
}
