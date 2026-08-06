import { Component, type ErrorInfo, type ReactNode } from 'react';
import { APP_VERSION } from '@/version.js';

interface Props {
  children: ReactNode;
  /** Full-screen at the root; inline when wrapping a single route. */
  variant?: 'screen' | 'inline';
}
interface State {
  error: Error | null;
}

/**
 * SPEC 1.5 — errors are never swallowed.
 *
 * This boundary reports the failure and the app version, and deliberately logs
 * NO note bodies, names, or MRNs (SPEC 18). There is no third-party error
 * reporter and there must never be one while note text is in memory.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[visite] render error', { version: APP_VERSION, error, componentStack: info.componentStack });
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        className={[
          'flex flex-col items-center justify-center gap-3 px-6 text-center',
          this.props.variant === 'inline' ? 'py-16' : 'h-[100dvh]',
        ].join(' ')}
      >
        <h1 className="text-lg font-semibold">Terjadi kesalahan</h1>
        <p className="max-w-sm text-sm text-fg-muted">
          Catatan yang sudah tersimpan tetap aman. Muat ulang halaman untuk melanjutkan.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-tap rounded-lg bg-accent px-4 text-sm font-medium text-white"
        >
          Muat ulang
        </button>
        <p className="text-[11px] text-fg-faint">v{APP_VERSION}</p>
      </div>
    );
  }
}
