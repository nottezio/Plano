// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test, vi } from 'vitest';

import { useTextSync } from './useTextSync';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Audit 2026-09-29: the day changing under the editor (midnight rollover on
 * a page that follows "today", back/forward between days) must save the
 * previous day's unsaved text with the previous day's writer.
 */
test('a key change saves the previous note', async () => {
  vi.useFakeTimers();
  const writes: string[] = [];
  let api: ReturnType<typeof useTextSync> | null = null;
  function Harness({ k, server }: { k: string; server: string }): null {
    api = useTextSync({
      key: k,
      serverText: server,
      locked: false,
      write: async (text) => {
        writes.push(`${k}=>${text}`);
      },
    });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  await act(async () => root.render(createElement(Harness, { k: 'p|A', server: 'note A' })));
  await act(async () => api?.setValue('note A + typed'));
  await act(async () => root.render(createElement(Harness, { k: 'p|B', server: '' })));
  await act(async () => {
    vi.advanceTimersByTime(20_000);
  });
  expect(writes).toContain('p|A=>note A + typed');
  expect(writes.some((write) => write.startsWith('p|B'))).toBe(false);
  await act(async () => root.unmount());
  vi.useRealTimers();
});
