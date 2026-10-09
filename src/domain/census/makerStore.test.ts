import { describe, expect, it } from 'vitest';

import {
  dayOf,
  emptyStore,
  findAll,
  lineAt,
  readSensusStore,
  storedDays,
  withDay,
} from './makerStore';

const TODAY = '2026-10-09';

describe('readSensusStore', () => {
  it('moves the v1 lists onto the day they were saved for', () => {
    const v1 = JSON.stringify({ date: '2026-10-08', lists: [{ text: 'list A', kind: 'auto' }], code: 'ARB', address: 'prof', style: 'front' });
    const store = readSensusStore(null, v1, TODAY);
    expect(store.days['2026-10-08']?.lists).toEqual([{ text: 'list A', kind: 'auto' }]);
    expect(store).toMatchObject({ code: 'ARB', address: 'prof', style: 'front', mode: 'aturan' });
  });

  it('prefers v2 and keeps each day, its AI result, and the mode', () => {
    const v2 = JSON.stringify({
      days: {
        '2026-10-09': { lists: [{ text: 'today', kind: 'rsws' }], ai: { ARB: { key: 'k', text: 'ai census' } } },
        '2026-10-08': { lists: [{ text: 'yesterday', kind: 'auto' }], ai: {} },
      },
      code: 'MZ',
      mode: 'ai',
    });
    const store = readSensusStore(v2, '{"date":"2026-10-01","lists":[{"text":"old"}]}', TODAY);
    expect(Object.keys(store.days).sort()).toEqual(['2026-10-08', '2026-10-09']);
    expect(store.days['2026-10-09']?.ai.ARB).toEqual({ key: 'k', text: 'ai census' });
    expect(store.mode).toBe('ai');
  });

  it('drops days older than a week, empty days, and junk', () => {
    const v2 = JSON.stringify({
      days: {
        '2026-09-30': { lists: [{ text: 'old', kind: 'auto' }] },
        '2026-10-05': { lists: [{ text: '  ', kind: 'auto' }] },
        'not-a-date': { lists: [{ text: 'x' }] },
        '2026-10-06': { lists: [{ text: 'kept', kind: 'auto' }] },
      },
    });
    expect(Object.keys(readSensusStore(v2, null, TODAY).days)).toEqual(['2026-10-06']);
  });

  it('survives unreadable storage', () => {
    expect(readSensusStore('{oops', null, TODAY)).toEqual(emptyStore());
  });
});

describe('withDay / dayOf / storedDays', () => {
  it('gives each date its own boxes', () => {
    let store = emptyStore();
    store = withDay(store, '2026-10-09', { lists: [{ text: 'today', kind: 'auto' }], ai: {} });
    store = withDay(store, '2026-10-08', { lists: [{ text: 'a', kind: 'auto' }, { text: 'b', kind: 'auto' }], ai: {} });
    expect(dayOf(store, '2026-10-09').lists[0]?.text).toBe('today');
    expect(dayOf(store, '2026-10-10').lists).toEqual([{ text: '', kind: 'auto' }]);
    expect(storedDays(store)).toEqual([
      { date: '2026-10-09', lists: 1 },
      { date: '2026-10-08', lists: 2 },
    ]);
  });

  it('removes a day whose boxes were emptied', () => {
    let store = withDay(emptyStore(), '2026-10-09', { lists: [{ text: 'x', kind: 'auto' }], ai: {} });
    store = withDay(store, '2026-10-09', { lists: [{ text: '', kind: 'auto' }], ai: {} });
    expect(store.days).toEqual({});
  });
});

describe('findAll / lineAt', () => {
  const text = '1. ARB/414 Bed 1/Tn. Contoh\nDiagnosis:\n- CHF\n2. MZ/415 Bed 2/Ny. contoh';

  it('finds every occurrence, ignoring case', () => {
    expect(findAll(text, 'contoh')).toHaveLength(2);
    expect(findAll(text, '  ')).toEqual([]);
    expect(findAll(text, 'xyz')).toEqual([]);
  });

  it('shows the line a match is on', () => {
    const [first, second] = findAll(text, 'contoh');
    expect(lineAt(text, first![0])).toBe('1. ARB/414 Bed 1/Tn. Contoh');
    expect(lineAt(text, second![0])).toBe('2. MZ/415 Bed 2/Ny. contoh');
  });
});
