import { describe, expect, it } from 'vitest';

import {
  availableLabels,
  availableWards,
  boardTickStates,
  buildCard,
  cardTitle,
  filterPatients,
  hasActiveFilters,
  initials,
  matchesQuery,
  previewLines,
  sortPatients,
  EMPTY_FILTERS,
} from './board';
import { DEFAULT_CHECKLIST } from './defaults';
import { buildSearchBlobFor, makePatient } from './testFactories';

const ITEMS = DEFAULT_CHECKLIST.map((item) => ({ ...item }));
const TODAY = '2026-08-06';

describe('initials', () => {
  it('drops Indonesian honorifics', () => {
    expect(initials('Tn. Budi Santoso')).toBe('B.S');
    expect(initials('Ny. Siti Aminah')).toBe('S.A');
    expect(initials('An. Rizky')).toBe('R');
  });

  it('caps at three letters', () => {
    expect(initials('Muhammad Rizky Aditya Pratama')).toBe('M.R.A');
  });

  it('falls back to the raw name when everything looks like a title', () => {
    expect(initials('Tn.')).toBe('T');
  });

  it('never returns an empty string', () => {
    expect(initials('   ')).toBe('—');
  });
});

describe('cardTitle', () => {
  const patient = makePatient({ name: 'Tn. Budi Santoso', bed: '3B' });

  it('shows initials plus bed by default (SPEC 18)', () => {
    expect(cardTitle(patient, true)).toBe('B.S · 3B');
  });

  it('shows the full name only when the user opted in', () => {
    expect(cardTitle(patient, false)).toBe('Tn. Budi Santoso · 3B');
  });

  it('omits the separator when there is no bed', () => {
    expect(cardTitle(makePatient({ name: 'Tn. Budi Santoso' }), true)).toBe('B.S');
  });
});

describe('boardTickStates — the midnight reset, on the board', () => {
  it('reads a same-day cache', () => {
    const patient = makePatient({
      boardChecklist: { date: TODAY, done: { c1: true, c2: true } },
    });
    const states = boardTickStates(patient, ITEMS, TODAY);
    expect(states['c1']?.done).toBe(true);
    expect(states['c3']?.done).toBe(false);
  });

  it('ignores yesterday’s cache entirely — no job, no network', () => {
    const patient = makePatient({
      boardChecklist: { date: '2026-08-05', done: { c1: true, c2: true, c3: true } },
    });
    const states = boardTickStates(patient, ITEMS, TODAY);
    expect(Object.values(states).every((state) => !state.done)).toBe(true);
  });

  it('treats a missing cache as nothing ticked', () => {
    const states = boardTickStates(makePatient({}), ITEMS, TODAY);
    expect(Object.keys(states)).toHaveLength(ITEMS.length);
    expect(states['c1']?.done).toBe(false);
  });
});

describe('buildCard', () => {
  it('colours the card by the lowest-order unchecked item', () => {
    const card = buildCard(
      makePatient({ boardChecklist: { date: TODAY, done: { c1: true, c2: true } } }),
      ITEMS,
      TODAY,
      true,
    );
    expect(card.colorToken).toBe('step-3');
    expect(card.progress.pendingLabel).toBe('Kirim ke Chief');
    expect(card.progress.total).toBe(7);
  });

  it('goes green only when the day is complete', () => {
    const done = Object.fromEntries(ITEMS.map((item) => [item.id, true]));
    const card = buildCard(
      makePatient({ boardChecklist: { date: TODAY, done } }),
      ITEMS,
      TODAY,
      true,
    );
    expect(card.colorToken).toBe('done');
    expect(card.progress.complete).toBe(true);
  });

  it('resets to the first colour after midnight without any write', () => {
    const done = Object.fromEntries(ITEMS.map((item) => [item.id, true]));
    const patient = makePatient({ boardChecklist: { date: '2026-08-05', done } });
    expect(buildCard(patient, ITEMS, '2026-08-05', true).colorToken).toBe('done');
    // A new day has no ticks, so the card reads as unstarted rather than
    // jumping straight to the step-1 alert colour.
    expect(buildCard(patient, ITEMS, TODAY, true).colorToken).toBe('neutral');
  });

  it('computes hari rawat from the admission date', () => {
    const card = buildCard(makePatient({ admittedAt: '2026-08-03' }), ITEMS, TODAY, true);
    expect(card.hariRawat).toBe(4);
  });

  it('flags a preview carried over from an earlier day', () => {
    const fresh = buildCard(
      makePatient({ preview: 'S: sesak', previewDate: TODAY }),
      ITEMS,
      TODAY,
      true,
    );
    const stale = buildCard(
      makePatient({ preview: 'S: sesak', previewDate: '2026-08-04' }),
      ITEMS,
      TODAY,
      true,
    );
    expect(fresh.previewIsStale).toBe(false);
    expect(stale.previewIsStale).toBe(true);
  });

  it('does not flag staleness when there is no preview at all', () => {
    expect(buildCard(makePatient({}), ITEMS, TODAY, true).previewIsStale).toBe(false);
  });

  it('honours a manual colour override', () => {
    const card = buildCard(makePatient({ colorOverride: 'step-11' }), ITEMS, TODAY, true);
    expect(card.colorToken).toBe('step-11');
  });
});

describe('previewLines', () => {
  it('drops blank lines and caps the count', () => {
    const preview = 'S: sesak\n\nO:\nTTV: 120/80\nA: pneumonia\nP: observasi';
    expect(previewLines(preview)).toEqual(['S: sesak', 'O:', 'TTV: 120/80', 'A: pneumonia']);
  });

  it('handles an empty preview', () => {
    expect(previewLines('')).toEqual([]);
  });
});

describe('matchesQuery', () => {
  const patient = makePatient({
    name: 'Tn. Budi Santoso',
    mrn: '123456',
    ward: 'Melati',
    bed: '3B',
    diagnoses: ['Pneumonia komunitas'],
  });

  it('matches mid-string, not just word starts', () => {
    expect(matchesQuery(patient, 'melati')).toBe(true);
    expect(matchesQuery(patient, '3b')).toBe(true);
    expect(matchesQuery(patient, 'monia')).toBe(true);
  });

  it('requires every token, in any order', () => {
    expect(matchesQuery(patient, 'budi melati')).toBe(true);
    expect(matchesQuery(patient, 'melati budi')).toBe(true);
    expect(matchesQuery(patient, 'budi mawar')).toBe(false);
  });

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(matchesQuery(patient, '  BUDI  ')).toBe(true);
  });

  it('matches everything on an empty query', () => {
    expect(matchesQuery(patient, '')).toBe(true);
  });

  it('falls back to the name when searchBlob is missing', () => {
    const bare = { ...makePatient({ name: 'Tn. Budi' }), searchBlob: '' };
    expect(matchesQuery(bare, 'budi')).toBe(true);
  });

  it('searchBlob really contains what the card is searched by', () => {
    expect(buildSearchBlobFor(patient)).toContain('melati');
    expect(buildSearchBlobFor(patient)).toContain('pneumonia');
  });
});

describe('search finds unnamed patients by their note', () => {
  it('matches text from the preview when no name was typed', () => {
    const patient = makePatient({ name: '', preview: 'Tn. Budi, pneumonia komunitas' });
    expect(matchesQuery(patient, 'pneumonia')).toBe(true);
    expect(matchesQuery(patient, 'budi')).toBe(true);
    expect(matchesQuery(patient, 'sepsis')).toBe(false);
  });
});

describe('filterPatients', () => {
  const a = makePatient({
    id: 'a',
    name: 'Tn. Budi',
    ward: 'Melati',
    labels: ['isolasi'],
    boardChecklist: { date: TODAY, done: { c1: true } },
  });
  const b = makePatient({
    id: 'b',
    name: 'Ny. Siti',
    ward: 'Mawar',
    labels: [],
    boardChecklist: { date: TODAY, done: { c1: true, c2: true, c3: true } },
  });

  it('filters by ward', () => {
    const result = filterPatients([a, b], { ...EMPTY_FILTERS, wards: ['Mawar'] }, ITEMS, TODAY);
    expect(result.map((patient) => patient.id)).toEqual(['b']);
  });

  it('filters by label', () => {
    const result = filterPatients(
      [a, b],
      { ...EMPTY_FILTERS, labels: ['isolasi'] },
      ITEMS,
      TODAY,
    );
    expect(result.map((patient) => patient.id)).toEqual(['a']);
  });

  it('"belum …" chips select patients where the item is still undone', () => {
    const result = filterPatients(
      [a, b],
      { ...EMPTY_FILTERS, pendingItemIds: ['c3'] },
      ITEMS,
      TODAY,
    );
    expect(result.map((patient) => patient.id)).toEqual(['a']);
  });

  it('combines multiple pending chips conjunctively', () => {
    const result = filterPatients(
      [a, b],
      { ...EMPTY_FILTERS, pendingItemIds: ['c2', 'c3'] },
      ITEMS,
      TODAY,
    );
    expect(result.map((patient) => patient.id)).toEqual(['a']);
  });

  it('a yesterday cache makes every item read as pending', () => {
    const stale = makePatient({
      id: 'c',
      boardChecklist: { date: '2026-08-05', done: { c1: true, c2: true, c3: true } },
    });
    const result = filterPatients(
      [stale],
      { ...EMPTY_FILTERS, pendingItemIds: ['c1'] },
      ITEMS,
      TODAY,
    );
    expect(result).toHaveLength(1);
  });

  it('returns everything when no filter is set', () => {
    expect(filterPatients([a, b], EMPTY_FILTERS, ITEMS, TODAY)).toHaveLength(2);
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });
});

describe('sortPatients', () => {
  it('puts pinned first and otherwise preserves the incoming order', () => {
    const first = makePatient({ id: 'first', updatedAtMillis: 1000 });
    const second = makePatient({ id: 'second', updatedAtMillis: 2000 });
    const pinned = makePatient({ id: 'pinned', pinned: true, updatedAtMillis: 1 });
    expect(sortPatients([first, second, pinned]).map((patient) => patient.id)).toEqual([
      'pinned',
      'first',
      'second',
    ]);
  });

  it('does not reorder when a card is edited', () => {
    const a = makePatient({ id: 'a', updatedAtMillis: 1 });
    const b = makePatient({ id: 'b', updatedAtMillis: 2 });
    const before = sortPatients([a, b]).map((patient) => patient.id);
    // b gets typed into; its updatedAt jumps. Position must not change.
    const edited = makePatient({ id: 'b', updatedAtMillis: 999_999 });
    expect(sortPatients([a, edited]).map((patient) => patient.id)).toEqual(before);
  });
});

describe('filter chip sources', () => {
  it('lists distinct wards and labels', () => {
    const patients = [
      makePatient({ ward: 'Melati', labels: ['isolasi', 'covid'] }),
      makePatient({ ward: 'Mawar', labels: ['isolasi'] }),
      makePatient({ ward: 'Melati', labels: [] }),
    ];
    expect(availableWards(patients)).toEqual(['Mawar', 'Melati']);
    expect(availableLabels(patients)).toEqual(['covid', 'isolasi']);
  });
});

describe('standing patient notes', () => {
  it('are not part of the searchable board blob by default', () => {
    // The note is private working memory, not an index. Including it would
    // surface a patient by a family contact's name, which is not what the
    // board search is for.
    const patient = makePatient({ name: 'Tn. Budi' });
    const withNote = { ...patient, notes: 'alergi penisilin' };
    expect(matchesQuery(withNote, 'penisilin')).toBe(false);
    expect(matchesQuery(withNote, 'budi')).toBe(true);
  });
});
