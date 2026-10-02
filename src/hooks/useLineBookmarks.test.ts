// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';

import type { LineBookmark } from '@/domain/bookmarks';

const writes: Array<[string, string, LineBookmark | null]> = [];
vi.mock('@/data/repositories/patients.repo', () => ({
  setPatientBookmark: (patientId: string, id: string, value: LineBookmark | null) => {
    writes.push([patientId, id, value]);
    return Promise.resolve();
  },
}));

const { useLineBookmarks } = await import('./useLineBookmarks');

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  writes.length = 0;
  vi.useRealTimers();
});

type Api = ReturnType<typeof useLineBookmarks>;

interface Props {
  body: string;
  date?: string;
  stored?: Record<string, LineBookmark>;
}

async function mount(initial: Props) {
  let api: Api | null = null;
  function Harness(props: Props): null {
    api = useLineBookmarks({
      patientId: 'p1',
      stored: props.stored,
      body: props.body,
      date: props.date ?? '2026-10-03',
      enabled: true,
    });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  const render = (props: Props) => act(async () => root.render(createElement(Harness, props)));
  await render(initial);
  return { api: () => api as unknown as Api, render, unmount: () => act(async () => root.unmount()) };
}

const BODY = '*O :*\n- K 3,1\n- Na 135';

test('bookmarks the caret line and writes one leaf', async () => {
  const view = await mount({ body: BODY });
  await act(async () => view.api().toggleAt(BODY.indexOf('3,1')));
  expect(view.api().resolved.map((entry) => entry.label)).toEqual(['K 3,1']);
  expect(writes).toHaveLength(1);
  expect(writes[0]?.[2]).toMatchObject({ text: '- K 3,1', nth: 0 });

  // Same line again removes it.
  await act(async () => view.api().toggleAt(BODY.indexOf('- K')));
  expect(view.api().resolved).toEqual([]);
  expect(writes[1]?.[2]).toBeNull();
  await view.unmount();
});

test('follows typing into the bookmarked line, keystroke by keystroke', async () => {
  vi.useFakeTimers();
  const stored = { k: { text: '- K 3,1', nth: 0, createdAt: '' } };
  const view = await mount({ body: BODY, stored });
  let body = BODY;
  for (const next of ['- K 3,', '- K 3,5', '- K 3,5 (KCl)']) {
    const line = body.split('\n')[1] ?? '';
    body = body.replace(line, next);
    await view.render({ body, stored });
    expect(view.api().resolved).toHaveLength(1);
  }
  // Written once, after typing settles — not per keystroke.
  expect(writes).toHaveLength(0);
  await act(async () => {
    vi.advanceTimersByTime(2000);
  });
  expect(writes).toEqual([['p1', 'k', { text: '- K 3,5 (KCl)', nth: 0, createdAt: '' }]]);
  await view.unmount();
});

test('does not re-anchor across a change of day', async () => {
  const stored = { k: { text: '- K 3,1', nth: 0, createdAt: '' } };
  const view = await mount({ body: BODY, stored });
  await view.render({ body: '*O :*\n- K 3,9\n- Na 135', date: '2026-10-04', stored });
  expect(view.api().resolved).toEqual([]);
  expect(view.api().missing).toEqual(['k']);
  await view.unmount();
  expect(writes).toEqual([]);
});
