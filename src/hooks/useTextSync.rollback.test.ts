// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test, vi } from 'vitest';

import { useTextSync } from './useTextSync';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * 2026-10-01: a phone's write is echoed by Firestore (pending), then REFUSED
 * because a laptop changed the note; the cache rolls back to the laptop text.
 * The phone's text must survive on screen and be merged, not silently replaced.
 */
function harness() {
  let api: ReturnType<typeof useTextSync> | null = null;
  function Harness({ server, pending }: { server: string; pending: boolean }): null {
    api = useTextSync({
      key: 'p|2026-10-01',
      serverText: server,
      serverPending: pending,
      locked: false,
      write: async () => {},
    });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  return {
    render: (server: string, pending: boolean) =>
      act(async () => root.render(createElement(Harness, { server, pending }))),
    get api() {
      return api!;
    },
    unmount: () => act(async () => root.unmount()),
  };
}

const BASE = 'S: sesak\nO: TD 120/80\nP: furosemid';
const PHONE = 'S: sesak berkurang\nO: TD 120/80\nP: furosemid';
const LAPTOP = 'S: sesak\nO: TD 120/80\nP: furosemid stop';

test('a refused write rolls back without losing the phone text: different lines merge', async () => {
  vi.useFakeTimers();
  const h = harness();
  await h.render(BASE, false);
  await act(async () => h.api.setValue(PHONE));
  await act(async () => {
    vi.advanceTimersByTime(1000); // flush
  });
  // Firestore's optimistic echo of our own write.
  await h.render(PHONE, true);
  expect(h.api.value).toBe(PHONE);
  // Refused: the cache rolls back to the laptop's confirmed text.
  await h.render(LAPTOP, false);
  expect(h.api.value).toContain('sesak berkurang');
  expect(h.api.value).toContain('furosemid stop');
  await h.unmount();
  vi.useRealTimers();
});

test('same line changed on both: a conflict is raised instead of a silent swap', async () => {
  vi.useFakeTimers();
  const h = harness();
  await h.render(BASE, false);
  await act(async () => h.api.setValue('S: sesak berat\nO: TD 120/80\nP: furosemid'));
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  await h.render('S: sesak berat\nO: TD 120/80\nP: furosemid', true);
  await h.render('S: tidak sesak\nO: TD 120/80\nP: furosemid', false);
  expect(h.api.value).toContain('sesak berat');
  expect(h.api.conflict).not.toBeNull();
  await h.unmount();
  vi.useRealTimers();
});

test('a confirmed echo still clears the draft as before', async () => {
  vi.useFakeTimers();
  const h = harness();
  await h.render(BASE, false);
  await act(async () => h.api.setValue(PHONE));
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  await h.render(PHONE, true);
  await h.render(PHONE, false);
  expect(h.api.dirty).toBe(false);
  // A later edit elsewhere is adopted normally.
  await h.render(LAPTOP, false);
  expect(h.api.value).toBe(LAPTOP);
  await h.unmount();
  vi.useRealTimers();
});
