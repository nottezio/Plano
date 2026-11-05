import { describe, expect, it } from 'vitest';

import { firstOpenTab, keepShown } from './sidePanelLists';

describe('firstOpenTab', () => {
  it('opens the first list with something left', () => {
    expect(firstOpenTab(3, 2)).toBe('checklist');
    expect(firstOpenTab(0, 2)).toBe('todos');
  });

  it('falls back to the checklist when nothing is left', () => {
    expect(firstOpenTab(0, 0)).toBe('checklist');
  });
});

describe('keepShown', () => {
  const row = (id: string, done: boolean): { id: string; done: boolean } => ({ id, done });

  it('lists only open rows on arrival', () => {
    const shown = new Set<string>();
    expect(keepShown([row('a', true), row('b', false)], shown).map((r) => r.id)).toEqual(['b']);
  });

  it('keeps a row in place after it is ticked', () => {
    const shown = new Set<string>();
    keepShown([row('a', false), row('b', false)], shown);
    expect(keepShown([row('a', true), row('b', false)], shown)).toEqual([
      row('a', true),
      row('b', false),
    ]);
  });

  it('drops the ticked row once the view starts over', () => {
    expect(keepShown([row('a', true)], new Set())).toEqual([]);
  });

  it('adds a row unticked from the full list, in list order', () => {
    const shown = new Set(['b']);
    expect(keepShown([row('a', false), row('b', false)], shown).map((r) => r.id)).toEqual(['a', 'b']);
  });
});
