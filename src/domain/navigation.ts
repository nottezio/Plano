/**
 * Back goes to the PARENT screen, not to the previous page.
 *
 * WHY (2026-10-02): the router kept the browser's model — every tap pushed a
 * new history entry — so the phone's back button replayed everything that had
 * been done: back from a patient walked through each day that had been
 * opened, back from Pengaturan went to Kalkulator, then Arsip, then the board.
 * That is a website. An app (and Windows Explorer's "up") goes to the screen
 * the current one lives under.
 *
 * The model: screens have a LEVEL —
 *
 *   0  the board  /
 *   1  a section  /arsip, /dokumen, /catatan, /kalkulator, /checklist, …
 *   2  a detail   /p/:id(/:date), /dokumen/:id, /catatan?n=, /checklist?c=
 *
 * and the browser's history is kept equal to the path of screens from the
 * board down to the current one. Every navigation is planned against it:
 *
 *  - deeper   → push (the current screen becomes the one back returns to)
 *  - sideways → replace (another day, another patient, another tab: back
 *               still goes to the same parent)
 *  - upward   → go BACK to the nearest entry at or above the target's level,
 *               then replace/push the target if it is not exactly that entry.
 *
 * So the stack can never hold more than one screen per level, and back is
 * always "up". Pure, so it is tested without a browser; `lib/appHistory`
 * applies it.
 */

export type ScreenLevel = 0 | 1 | 2;

/** Split an app-relative href ("/p/x/2026-10-02?y=1#z") into path and search. */
function split(href: string): { path: string; search: string } {
  const hashless = href.split('#')[0] ?? '';
  const q = hashless.indexOf('?');
  const rawPath = q === -1 ? hashless : hashless.slice(0, q);
  const search = q === -1 ? '' : hashless.slice(q);
  const path = rawPath.replace(/\/+$/, '') || '/';
  return { path, search };
}

export function screenLevel(href: string): ScreenLevel {
  const { path, search } = split(href);
  if (path === '/') return 0;
  if (path.startsWith('/p/')) return 2;
  if (/^\/dokumen\/[^/]+/.test(path)) return 2;
  const params = new URLSearchParams(search);
  // Notes and checklists open their detail as a query parameter (one screen
  // that is a list on the phone and a list + pane on a laptop).
  if (path === '/catatan' && params.get('n')) return 2;
  if (path === '/checklist' && params.get('c')) return 2;
  return 1;
}

/**
 * The screens above `href`, top first, for an app that was OPENED on it (a
 * shared link, a reload into a fresh tab). Without them back would leave the
 * app from a patient instead of going to the board.
 */
export function ancestorsOf(href: string): string[] {
  const level = screenLevel(href);
  if (level === 0) return [];
  if (level === 1) return ['/'];
  const { path } = split(href);
  if (path.startsWith('/dokumen/')) return ['/', '/dokumen'];
  if (path === '/catatan') return ['/', '/catatan'];
  if (path === '/checklist') return ['/', '/checklist'];
  return ['/'];
}

export type NavPlan =
  | { kind: 'push' }
  | { kind: 'replace' }
  /** history.go(delta), then — if the entry landed on is not the target — push or replace it. */
  | { kind: 'back'; delta: number; then: 'none' | 'push' | 'replace' };

/**
 * @param trail   app-relative href of each history entry by index (holes are
 *                entries this session did not record, e.g. before the app).
 * @param index   the current entry.
 * @param to      where the app asked to go.
 * @param mode    what the caller asked for.
 */
export function planNavigation(
  trail: readonly (string | undefined)[],
  index: number,
  to: string,
  mode: 'push' | 'replace',
): NavPlan {
  const current = trail[index];
  if (current === undefined) return { kind: mode };
  if (current === to) return { kind: 'replace' };

  const from = screenLevel(current);
  const target = screenLevel(to);
  if (target > from) return { kind: mode };
  if (target === from) return { kind: 'replace' };

  for (let k = index - 1; k >= 0; k -= 1) {
    const entry = trail[k];
    if (entry === undefined) break;
    const level = screenLevel(entry);
    if (level <= target) {
      const then = entry === to ? 'none' : level < target ? 'push' : 'replace';
      return { kind: 'back', delta: k - index, then };
    }
  }
  // Nothing above us was recorded: become the target in place.
  return { kind: 'replace' };
}
