// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { createAppHistory } from './appHistory';

/**
 * The real browser history (jsdom's), driven the way the router drives it.
 * One history for the whole file: it installs a window listener, as in the app.
 */
window.history.replaceState(null, '', '/p/pasien-a/2026-10-02');
sessionStorage.clear();
const history = createAppHistory();
const path = (): string => window.location.pathname + window.location.search;

function popped(): Promise<void> {
  return new Promise((resolve) => {
    window.addEventListener('popstate', () => setTimeout(resolve, 0), { once: true });
  });
}

async function back(): Promise<void> {
  const done = popped();
  window.history.back();
  await done;
}

describe('appHistory', () => {
  it('puts the board under a detail the app was opened on', async () => {
    expect(path()).toBe('/p/pasien-a/2026-10-02');
    await back();
    expect(path()).toBe('/');
    expect(history.location.pathname).toBe('/');
  });

  it('replaces sideways, so back from any day of a patient is the board', async () => {
    history.push('/p/pasien-a/2026-10-01');
    history.push('/p/pasien-a/2026-10-02');
    history.push('/p/pasien-a/2026-09-30');
    await back();
    expect(path()).toBe('/');
  });

  it('tabs do not stack: back from Pengaturan after Arsip and Kalkulator is the board', async () => {
    history.push('/arsip');
    history.push('/kalkulator');
    history.push('/pengaturan');
    await back();
    expect(path()).toBe('/');
  });

  it('a patient opened from Arsip goes back to Arsip; up() does the same', async () => {
    history.push('/arsip');
    history.push('/p/pasien-b');
    await back();
    expect(path()).toBe('/arsip');
    history.push('/p/pasien-b');
    const done = popped();
    history.up('/');
    await done;
    expect(path()).toBe('/arsip');
  });

  it('navigating up to an ancestor goes back to it instead of pushing it again', async () => {
    history.push('/p/pasien-c');
    const done = popped();
    history.push('/');
    await done;
    expect(path()).toBe('/');
    // Nothing left above the board: index 0.
    expect((window.history.state as { idx: number }).idx).toBe(0);
  });

  it('back closes an open sheet first, then leaves the screen', async () => {
    history.push('/arsip');
    let closed = 0;
    const release = history.openOverlay(() => {
      closed += 1;
    });
    await back();
    expect(closed).toBe(1);
    expect(path()).toBe('/arsip');
    release();
    await back();
    expect(path()).toBe('/');
  });

  it('a sheet closed with ✕ does not cost an extra back press', async () => {
    history.push('/arsip');
    const release = history.openOverlay(() => undefined);
    release();
    const first = popped();
    window.history.back();
    await first;
    // The spent entry is skipped: one more pop lands on the board.
    await popped();
    expect(path()).toBe('/');
  });

  it('navigating from an open sheet replaces its entry', async () => {
    const release = history.openOverlay(() => undefined);
    history.push('/p/pasien-d');
    release();
    expect(path()).toBe('/p/pasien-d');
    await back();
    expect(path()).toBe('/');
  });
});
