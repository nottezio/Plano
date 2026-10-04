// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  bootReason,
  formatSeconds,
  installLoadDiagnostics,
  otherTabCount,
  reportWait,
  useSlowWait,
} from './loadTiming';
import { readSessionLog } from './sessionLog';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let now = 0;
beforeEach(() => {
  localStorage.clear();
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => vi.restoreAllMocks());

const slowLines = (): string[] =>
  readSessionLog()
    .filter((entry) => entry.kind === 'slow')
    .map((entry) => entry.detail ?? '');

test('seconds are written the Indonesian way', () => {
  expect(formatSeconds(4200)).toBe('4,2 dtk');
  expect(formatSeconds(2000)).toBe('2,0 dtk');
});

test('a short wait is not logged; a slow one is, with what was waited for', () => {
  reportWait('daftar pasien', 1999);
  expect(slowLines()).toEqual([]);
  reportWait('daftar pasien', 3400);
  expect(slowLines()).toEqual(['daftar pasien 3,4 dtk']);
});

test('names the other open Plano tabs, which is what separates the multi-tab cause', () => {
  localStorage.setItem('plano.tabs', JSON.stringify({ a: Date.now(), b: Date.now() }));
  installLoadDiagnostics();
  expect(otherTabCount()).toBe(2);
  reportWait('membuka pasien', 2500);
  expect(slowLines()[0]).toBe('membuka pasien 2,5 dtk · 2 tab Plano lain terbuka');
});

test('a tab that died without saying goodbye stops counting after 12 hours', () => {
  const day = 24 * 60 * 60_000;
  localStorage.setItem('plano.tabs', JSON.stringify({ old: Date.now() - day, live: Date.now() }));
  installLoadDiagnostics();
  expect(otherTabCount()).toBe(1);
});

test('says when Chrome had discarded the tab', () => {
  Object.defineProperty(document, 'wasDiscarded', { value: true, configurable: true });
  expect(bootReason()).toContain('dibuang Chrome');
  Object.defineProperty(document, 'wasDiscarded', { value: false, configurable: true });
  expect(bootReason()).not.toContain('dibuang');
});

test('a frozen tab coming back is logged', () => {
  installLoadDiagnostics();
  document.dispatchEvent(new Event('resume'));
  expect(readSessionLog().some((entry) => entry.kind === 'resumed')).toBe(true);
});

function Probe({ waiting, endsOnUnmount }: { waiting: boolean; endsOnUnmount?: boolean }): null {
  useSlowWait('memuat catatan', waiting, endsOnUnmount ? { endsOnUnmount } : {});
  return null;
}

async function mountProbe(waiting: boolean, endsOnUnmount = false) {
  const root = createRoot(document.createElement('div'));
  const render = (next: boolean) =>
    act(async () => root.render(createElement(Probe, { waiting: next, endsOnUnmount })));
  await render(waiting);
  return { render, unmount: () => act(async () => root.unmount()) };
}

test('useSlowWait times a loading state from true to false', async () => {
  const view = await mountProbe(true);
  now = 3000;
  await view.render(false);
  expect(slowLines()).toEqual(['memuat catatan 3,0 dtk']);
  // A fast second wait adds nothing.
  await view.render(true);
  now = 3500;
  await view.render(false);
  expect(slowLines()).toHaveLength(1);
  await view.unmount();
});

test('a wait the user walked away from is logged as such', async () => {
  const view = await mountProbe(true);
  now = 5000;
  await view.unmount();
  expect(slowLines()).toEqual(['memuat catatan 5,0 dtk · (ditinggalkan)']);
});

test('where unmounting is the end of the wait, it is not "ditinggalkan"', async () => {
  const view = await mountProbe(true, true);
  now = 2500;
  await view.unmount();
  expect(slowLines()).toEqual(['memuat catatan 2,5 dtk']);
});
