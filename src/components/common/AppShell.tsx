import { useEffect, type ReactNode } from 'react';

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

  /**
   * The browser tab / window title.
   *
   * Every route already tells `AppShell` what it is — `PatientPage` passes the
   * patient's name, `DocumentPage` the document's — and that string went to
   * the top bar and the screen-reader announcer but never to `document.title`,
   * so every tab said "Plano" and the only way to tell three open patients
   * apart was to click each one.
   *
   * Set HERE, not per route: one effect over the prop the routes already pass
   * cannot drift out of step with the header the way fourteen `useEffect`s
   * would.
   *
   * It reverts to the bare app name while `obscured`, for the same reason
   * SPEC 18 blurs the content: a patient's name sitting in a tab strip, a task
   * switcher or a shared screen is the same disclosure as the note itself, and
   * the title is the one part of the UI that a blur cannot cover.
   */
  useEffect(() => {
    document.title = obscured || !title ? 'Plano' : `${title} · Plano`;
    return () => {
      document.title = 'Plano';
    };
  }, [title, obscured]);

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
        {/* Phone and tablet only. On desktop the sidebar carries both the
            section name and the sync state, so this row was 56 px of chrome
            saying nothing the left rail did not already say. */}
        <div className="lg:hidden">
          <TopBar title={title} />
        </div>
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
