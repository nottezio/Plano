// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { emptyDay, emptyStore, type SensusDay, type SensusStore } from '@/domain/census/makerStore';
import type { SensusInputSnapshot } from '@/data/repositories/sensusInput.repo';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const repo = vi.hoisted(() => ({
  listener: null as null | ((snapshot: SensusInputSnapshot) => void),
  writes: [] as Array<{ date: string; patch: unknown }>,
  deletes: [] as string[],
}));

vi.mock('@/data/repositories/sensusInput.repo', () => ({
  subscribeSensusInput: (_uid: string, callback: (snapshot: SensusInputSnapshot) => void) => {
    repo.listener = callback;
    return () => {
      repo.listener = null;
    };
  },
  writeSensusInput: (_uid: string, date: string, patch: unknown) => {
    repo.writes.push({ date, patch });
    return Promise.resolve();
  },
  deleteSensusInput: (_uid: string, date: string) => {
    repo.deletes.push(date);
    return Promise.resolve();
  },
}));

const { useSensusInputSync } = await import('./useSensusInputSync');

const TODAY = '2026-10-12';
const day = (text: string): SensusDay => ({ ...emptyDay(), lists: [{ text, kind: 'auto' }] });

let current: SensusStore = emptyStore();
let setter: ((next: SensusStore) => void) | null = null;

function Harness({ initial }: { initial: SensusStore }): null {
  const [store, setStore] = useState(initial);
  current = store;
  setter = setStore;
  useSensusInputSync('u1', store, setStore, TODAY);
  return null;
}

let root: Root | null = null;
beforeEach(() => {
  vi.useFakeTimers();
  repo.writes = [];
  repo.deletes = [];
});
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = null;
  vi.useRealTimers();
});

async function mount(initial: SensusStore): Promise<void> {
  const host = document.createElement('div');
  root = createRoot(host);
  await act(async () => root?.render(createElement(Harness, { initial })));
}

const server = async (days: Record<string, SensusDay>, extra: Partial<SensusInputSnapshot> = {}): Promise<void> => {
  await act(async () => repo.listener?.({ days, fromCache: false, pending: false, ...extra }));
};
const edit = async (text: string): Promise<void> => {
  await act(async () => setter?.({ ...current, days: { ...current.days, [TODAY]: day(text) } }));
};
const wait = async (ms: number): Promise<void> => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

test('nothing is uploaded before the first server answer; a pre-12.6 local day is uploaded after it', async () => {
  await mount({ ...emptyStore(), days: { [TODAY]: day('lama di perangkat') } });
  await act(async () => repo.listener?.({ days: {}, fromCache: true, pending: false }));
  await wait(5000);
  expect(repo.writes).toEqual([]);
  await server({});
  await wait(1300);
  expect(repo.writes).toHaveLength(1);
  expect(repo.writes[0]).toMatchObject({ date: TODAY, patch: { lists: [{ text: 'lama di perangkat' }] } });
});

test('a fresh device after sign-in gets the account days', async () => {
  await mount(emptyStore());
  await server({ '2026-10-11': day('dari HP') });
  expect(current.days['2026-10-11']!.lists[0]!.text).toBe('dari HP');
  await wait(2000);
  expect(repo.writes).toEqual([]);
});

test('typing writes once it pauses; the echo of an older write does not undo newer typing', async () => {
  await mount(emptyStore());
  await server({});
  await edit('List A');
  await wait(1300);
  expect(repo.writes).toHaveLength(1);
  await edit('List A + B');
  // The server acknowledges the FIRST write while the second waits.
  await server({ [TODAY]: day('List A') });
  expect(current.days[TODAY]!.lists[0]!.text).toBe('List A + B');
  await wait(1300);
  expect(repo.writes.at(-1)).toMatchObject({ patch: { lists: [{ text: 'List A + B' }] } });
});

test('leaving the page flushes a waiting write at once', async () => {
  await mount(emptyStore());
  await server({});
  await edit('belum terkirim');
  expect(repo.writes).toHaveLength(0);
  await act(async () => root?.unmount());
  root = null;
  expect(repo.writes).toHaveLength(1);
});

test('emptying a day deletes it from the account; expired account days are deleted', async () => {
  await mount(emptyStore());
  await server({ [TODAY]: day('x'), '2026-10-01': day('lama') });
  expect(repo.deletes).toEqual(['2026-10-01']);
  await act(async () => setter?.({ ...current, days: {} }));
  await wait(1300);
  expect(repo.deletes).toEqual(['2026-10-01', TODAY]);
});
