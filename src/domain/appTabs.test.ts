import { describe, expect, it } from 'vitest';

import { activate, closeTab, cycle, initialTabs, launch, MAX_TABS, moveTab, navigated, openTab, readTabs, tabLabel, tabTitle, titled } from './appTabs';

describe('desktop app tabs (2026-10-16)', () => {
  const start = initialTabs('/', 'a');

  it('opens a tab after the active one and switches to it; Ctrl+click opens it behind', () => {
    const two = openTab(start, '/list', { id: 'b' });
    expect(two.tabs.map((t) => t.url)).toEqual(['/', '/list']);
    expect(two.active).toBe('b');
    const three = openTab(activate(two, 'a'), '/helper', { id: 'c', background: true });
    expect(three.tabs.map((t) => t.id)).toEqual(['a', 'c', 'b']);
    expect(three.active).toBe('a');
  });

  it('closing the active tab activates the one to its right, else the left; the last tab goes home', () => {
    let s = openTab(openTab(start, '/list', { id: 'b' }), '/helper', { id: 'c' });
    s = closeTab(activate(s, 'b'), 'b');
    expect([s.tabs.map((t) => t.id), s.active]).toEqual([['a', 'c'], 'c']);
    s = closeTab(s, 'c');
    expect(s.active).toBe('a');
    const last = closeTab(navigated(s, '/list'), 'a');
    expect(last.tabs).toEqual([{ id: 'a', url: '/', title: '' }]);
  });

  it('follows navigation in the active tab only, and forgets its title when the page changes', () => {
    let s = titled(openTab(start, '/list', { id: 'b', background: true }), 'a', 'Aktif');
    s = navigated(s, '/p/x');
    expect(s.tabs.map((t) => [t.url, t.title])).toEqual([['/p/x', ''], ['/list', '']]);
  });

  it('cycles with Ctrl+Tab both ways', () => {
    const s = openTab(openTab(start, '/list', { id: 'b' }), '/helper', { id: 'c' });
    expect(cycle(s, 1).active).toBe('a');
    expect(cycle(s, -1).active).toBe('b');
  });

  it('opens no more than MAX_TABS: a further one replaces the active page', () => {
    let s = start;
    for (let i = 1; i < MAX_TABS; i += 1) s = openTab(s, `/x${i}`);
    expect(s.tabs).toHaveLength(MAX_TABS);
    const full = openTab(s, '/more');
    expect(full.tabs).toHaveLength(MAX_TABS);
    expect(full.tabs.find((t) => t.id === full.active)!.url).toBe('/more');
  });

  it('reads the page title without the app name', () => {
    expect(tabTitle('Tn. Contoh · Plano')).toBe('Tn. Contoh');
    expect(tabTitle('Plano')).toBe('Plano');
  });

  it('reads stored tabs defensively', () => {
    expect(readTabs(null)).toBeNull();
    expect(readTabs('{oops')).toBeNull();
    expect(readTabs(JSON.stringify({ tabs: [{ id: 'a', url: 'http://evil' }] }))).toBeNull();
    expect(readTabs(JSON.stringify({ tabs: [{ id: 'a', url: '/list', title: 'L' }], active: 'zzz' }))).toEqual({
      tabs: [{ id: 'a', url: '/list', title: 'L' }],
      active: 'a',
    });
  });

  it('names a tab from its page until the page sets a title; the board is "Aktif"', () => {
    expect(tabLabel({ url: '/list?f=x', title: '' })).toBe('List Maker');
    expect(tabLabel({ url: '/p/abc/2026-10-16', title: '' })).toBe('Pasien');
    expect(tabLabel({ url: '/', title: 'Plano' })).toBe('Aktif');
    expect(tabLabel({ url: '/p/abc', title: 'Tn. Contoh' })).toBe('Tn. Contoh');
  });

  it('opens at the board with the stored tabs, re-activates a tab on reload, opens a link as a new tab', () => {
    const stored = openTab(start, '/helper', { id: 'b', background: true });
    expect(launch(stored, '/')).toEqual(stored);
    expect(launch(stored, '/helper')).toEqual({ ...stored, active: 'b' });
    const linked = launch(stored, '/p/x');
    expect(linked.tabs).toHaveLength(3);
    expect(linked.tabs.find((t) => t.id === linked.active)!.url).toBe('/p/x');
    expect(launch(null, '/list').tabs.map((t) => t.url)).toEqual(['/list']);
  });

  it('moves a tab to a new position by drag, keeping the active tab', () => {
    const s = openTab(openTab(start, '/list', { id: 'b' }), '/helper', { id: 'c' });
    expect(moveTab(s, 'a', 2).tabs.map((t) => t.id)).toEqual(['b', 'c', 'a']);
    expect(moveTab(s, 'c', 0).tabs.map((t) => t.id)).toEqual(['c', 'a', 'b']);
    expect(moveTab(s, 'c', 99).tabs.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(moveTab(s, 'a', 2).active).toBe(s.active);
    expect(moveTab(s, 'zzz', 0)).toBe(s);
  });
});
