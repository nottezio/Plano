import type { ReactNode } from 'react';

import { usePrivacyGuard } from '@/hooks/usePrivacyGuard';
import { useLock } from '@/store/useLock';
import { ErrorBoundary } from './ErrorBoundary';
import { Footer } from './Footer';
import { RouteAnnouncer } from './RouteAnnouncer';
import { IosInstallHint } from './IosInstallHint';
import { TabBar } from './TabBar';
import { TopBar } from './TopBar';
import { UpdateBanner } from './UpdateBanner';

/**
 * SPEC 11.1 — the shell. Scrolling belongs to the content column only, so the
 * tab bar and top bar never move under a thumb mid-round.
 */
export function AppShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  usePrivacyGuard();
  // SPEC 18 — blur the moment the app is backgrounded. The class has existed
  // in styles/index.css since P0 precisely so this is one attribute, applied
  // above every route rather than remembered per screen.
  const obscured = useLock((state) => state.obscured);

  return (
    <div
      className={[
        'flex h-[100dvh] w-full overflow-hidden bg-bg',
        obscured ? 'privacy-blur' : '',
      ].join(' ')}
    >
      <RouteAnnouncer title={title} />

      {/* SPEC 20 — keyboard users should not tab through the whole nav rail
          to reach the note they opened. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        Lompat ke konten
      </a>

      <TabBar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} />
        <main
          id="main"
          className="min-h-0 flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+64px)] sm:pb-0"
        >
          <IosInstallHint />
          {/* A second boundary inside the shell: a crash in one route leaves
              the navigation usable instead of blanking the whole app. */}
          <ErrorBoundary variant="inline">{children}</ErrorBoundary>
          {/* Phone/tablet only — from lg the sidebar carries it. */}
          <div className="lg:hidden">
            <Footer />
          </div>
        </main>
      </div>
      <UpdateBanner />
    </div>
  );
}
