import { useEffect, useLayoutEffect, type ReactNode } from 'react';

import { usePrivacyGuard } from '@/hooks/usePrivacyGuard';
import { Link, NavigationType, useLocation, useNavigationType } from 'react-router-dom';
import { appHistory } from '@/lib/appHistory';
import { useLock } from '@/store/useLock';
import { useOutboxReconcile } from '@/hooks/useOutboxReconcile';
import { formatShortDate } from '@/domain/clinicalDate';
import { useUI } from '@/store/useUI';
import { useSanitizedCopy } from '@/hooks/useSanitizedCopy';
import { useSession } from '@/store/useSession';
import { initials } from '@/domain/board';
import { ErrorBoundary } from './ErrorBoundary';
import { Footer } from './Footer';
import { RouteAnnouncer } from './RouteAnnouncer';
import { IosInstallHint } from './IosInstallHint';
import { TabBar } from './TabBar';
import { TopBar } from './TopBar';
import { UpdateBanner } from './UpdateBanner';
import { ClipboardPill } from './ClipboardPill';

/**
 * SPEC 11.1 — the shell. Scrolling belongs to the content column only, so the
 * tab bar and top bar never move under a thumb mid-round.
 */
/**
 * Route titles are not all names. "Aktif", "Kalkulator" and "Pengaturan" carry
 * nothing private and must not be initialised into meaningless letters, so the
 * reduction applies only where the title IS a person — which is exactly where
 * `initials` differs from its input.
 */
/**
 * Back to a list puts it where it was left.
 *
 * Every route mounts its own shell, so `#main` used to come back at the top:
 * back from a patient opened halfway down the board, or from the fortieth
 * archived patient, meant scrolling to find the place again — the clearest
 * "this is a web page" tell. `appHistory` records each entry's scroll when it
 * is left; on a back navigation it is put back. Lists can still be filling in
 * for a few frames, so it is re-applied until it sticks (≈1.5 s at most) and
 * abandoned the moment the user touches or scrolls.
 */
function useRestoreScroll(): void {
  const navigationType = useNavigationType();
  const { key } = useLocation();
  useLayoutEffect(() => {
    if (navigationType !== NavigationType.Pop) return undefined;
    const target = appHistory()?.savedScroll(key) ?? 0;
    const main = document.getElementById('main');
    if (!main || target <= 0) return undefined;
    let frame = 0;
    let tries = 0;
    const stop = (): void => cancelAnimationFrame(frame);
    const apply = (): void => {
      main.scrollTop = target;
      tries += 1;
      if (Math.abs(main.scrollTop - target) > 1 && tries < 90) frame = requestAnimationFrame(apply);
    };
    main.addEventListener('touchstart', stop, { passive: true });
    main.addEventListener('wheel', stop, { passive: true });
    apply();
    return () => {
      stop();
      main.removeEventListener('touchstart', stop);
      main.removeEventListener('wheel', stop);
    };
  }, [key, navigationType]);
}

function titleForPrivacy(title: string, initialsOnly: boolean): string {
  return initialsOnly ? initials(title) : title;
}

export function AppShell({
  title,
  children,
  topBar = true,
  titleBadge,
}: {
  title: string;
  children: ReactNode;
  /**
   * The phone/tablet title row. A detail screen that draws its own sticky
   * header (the patient page) turns it off: two stacked headers cost a sixth
   * of a phone screen and printed the patient's name twice. That screen then
   * owns the safe-area inset and the sync state the bar carried.
   */
  topBar?: boolean;
  /** A mark beside the phone title, e.g. Helper's WIP. */
  titleBadge?: ReactNode;
}): JSX.Element {
  usePrivacyGuard();
  useRestoreScroll();
  // SPEC 18 — blur the moment the app is backgrounded. The class has existed
  // in styles/index.css since P0 precisely so this is one attribute, applied
  // above every route rather than remembered per screen.
  const obscured = useLock((state) => state.obscured);

  /**
   * Mounted once for the whole app rather than per surface.
   *
   * Selecting text and copying it is possible on every screen — the note, the
   * preview, a document, the rail — and a sanitiser attached to only some of
   * them would work in the places someone remembered to wire it and fail
   * silently everywhere else, which is indistinguishable from it not working.
   */
  // Folded UNLESS a non-ASCII-tolerant preview is on screen. See
  // `nonAsciiPreview` for why the default sits on this side.
  useSanitizedCopy(!useUI((state) => state.nonAsciiPreview));
  const initialsOnly = useSession((state) => state.settings().privacy.boardShowInitialsOnly);

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
   * It is deliberately NOT tied to `obscured`. The first version reverted the
   * title to "Plano" whenever the document was hidden, which sounded like a
   * privacy win and was self-defeating: switching tabs IS `visibilitychange →
   * hidden`, so every inactive tab — the only ones whose titles you actually
   * read — went blank. The title was correct exactly on the tab you were
   * already looking at.
   *
   * The blur and the title guard different exposures and must not share a
   * switch. `obscured` hides the app-switcher SCREENSHOT, an image of the note
   * itself. A tab title is text you are deliberately reading in your own
   * browser. Privacy here belongs to `boardShowInitialsOnly`, which already
   * means "do not render full names in list contexts" — and a tab strip is a
   * list.
   */
  useEffect(() => {
    document.title = title ? `${titleForPrivacy(title, initialsOnly)} · Plano` : 'Plano';
    return () => {
      document.title = 'Plano';
    };
  }, [title, initialsOnly]);

  return (
    <div
      className={[
        'flex h-[100dvh] w-full overflow-hidden bg-bg',
        obscured ? 'privacy-blur' : '',
      ].join(' ')}
    >
      <RouteAnnouncer title={title} />
      <OutboxNotice />

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
        {topBar ? (
          <div className="lg:hidden">
            <TopBar title={title} badge={titleBadge} />
          </div>
        ) : null}
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
      {/* Phone/tablet: floating above the tab bar. Desktop: in the sidebar. */}
      <div className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-40 flex justify-start sm:bottom-4 lg:hidden">
        <ClipboardPill className="pointer-events-auto max-w-[min(100%,22rem)]" />
      </div>
      <UpdateBanner />
    </div>
  );
}

/**
 * What happened to writes that had not reached the server.
 *
 * Shown because the alternative is a note changing on its own. A merge is
 * reported so it can be checked against Riwayat perubahan; a version left for
 * review is reported because only the person can decide which one is right.
 * Writes that simply landed say nothing.
 */
function OutboxNotice(): JSX.Element | null {
  const { results, dismiss } = useOutboxReconcile();
  if (results.length === 0) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md rounded-xl border border-border bg-surface p-3 text-xs shadow-lg"
    >
      <p className="font-medium">Catatan offline diselesaikan</p>
      <ul className="mt-1 space-y-1">
        {results.map((result) => (
          <li key={`${result.patientId}|${result.date}|${result.outcome}`}>
            <Link
              to={`/p/${result.patientId}/${result.date}`}
              onClick={dismiss}
              className="text-accent underline"
            >
              {formatShortDate(result.date)}
            </Link>{' '}
            {result.outcome === 'merged'
              ? '— digabung dengan versi terbaru. Cek Riwayat perubahan.'
              : result.outcome === 'rewritten'
                ? '— tersimpan sekarang.'
                : '— tidak bisa digabung otomatis; versi offline disimpan di Riwayat perubahan.'}
          </li>
        ))}
      </ul>
      <button type="button" onClick={dismiss} className="mt-2 min-h-tap text-fg-muted underline">
        Tutup
      </button>
    </div>
  );
}
