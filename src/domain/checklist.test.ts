import { describe, expect, it } from 'vitest';

import {
  activeItems,
  addChecklistItem,
  buildDoneMap,
  checklistProgress,
  moveChecklistItem,
  normalizeOrders,
  pendingFilters,
  pendingItem,
  recolorChecklistItem,
  renameChecklistItem,
  resolveCardColor,
  resolveStates,
  setChecklistItemActive,
} from './checklist';
import { DEFAULT_CHECKLIST } from './defaults';
import { NEUTRAL_TOKEN, STEP_TOKENS, tokenForIndex } from './colorTokens';
import type { ChecklistItemDef, DailyChecklist } from './types';

/** Builds an N-item checklist. N is a parameter everywhere, never 7. */
function makeItems(count: number): ChecklistItemDef[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `c${index + 1}`,
    order: index + 1,
    label: `Langkah ${index + 1}`,
    colorToken: tokenForIndex(index + 1),
    active: true,
  }));
}

function ticked(itemIds: string[]): DailyChecklist {
  const items: DailyChecklist['items'] = {};
  for (const id of itemIds) items[id] = { done: true, at: null, by: 'test-device' };
  return { date: '2026-08-06', items };
}

describe('resolveStates', () => {
  it('treats a missing document as all-unchecked', () => {
    const items = makeItems(7);
    const states = resolveStates(items, null);
    expect(Object.keys(states)).toHaveLength(7);
    expect(Object.values(states).every((state) => !state.done)).toBe(true);
  });

  it('reads an item added after the day was ticked as unchecked, not undefined', () => {
    const states = resolveStates(makeItems(8), ticked(['c1', 'c2']));
    expect(states['c8']).toEqual({ done: false, at: null, by: null });
  });

  it('ignores stored ticks for items that no longer exist', () => {
    const states = resolveStates(makeItems(3), ticked(['c1', 'c9']));
    expect(Object.keys(states)).toEqual(['c1', 'c2', 'c3']);
  });
});

describe('resolveCardColor — the last ticked item', () => {
  for (const n of [3, 7, 12]) {
    describe(`with N = ${n}`, () => {
      const items = makeItems(n);

      it('is neutral when nothing is ticked — an untouched card is not an alert', () => {
        expect(resolveCardColor(items, resolveStates(items, null))).toBe(NEUTRAL_TOKEN);
      });

      it('advances one step per completed item, in order', () => {
        for (let done = 1; done < n; done += 1) {
          const doneIds = Array.from({ length: done }, (_, i) => `c${i + 1}`);
          const states = resolveStates(items, ticked(doneIds));
          // Colour follows the step just ticked, not the one still owed.
          expect(resolveCardColor(items, states)).toBe(tokenForIndex(done));
        }
      });

      it('is `done` only when every active item is ticked', () => {
        const allIds = items.map((item) => item.id);
        expect(resolveCardColor(items, resolveStates(items, ticked(allIds)))).toBe('done');
      });

      it('shows what was just finished, not what is still owed', () => {
        // Ticking a later item out of order colours by THAT item: it is the
        // furthest point actually reached.
        const states = resolveStates(items, ticked([`c${n}`]));
        expect(resolveCardColor(items, states)).toBe(tokenForIndex(n));
      });

      it('gives every item a distinct colour', () => {
        const tokens = new Set(items.map((item) => item.colorToken));
        expect(tokens.size).toBe(Math.min(n, STEP_TOKENS.length));
      });
    });
  }

  it('honours a manual override above everything', () => {
    const items = makeItems(7);
    const states = resolveStates(items, null);
    expect(resolveCardColor(items, states, 'step-11')).toBe('step-11');
    const allDone = resolveStates(items, ticked(items.map((item) => item.id)));
    expect(resolveCardColor(items, allDone, 'step-11')).toBe('step-11');
  });

  it('skips disabled items when choosing the colour', () => {
    const items = setChecklistItemActive(makeItems(5), 'c1', false);
    // A tick on a DISABLED item cannot set the colour; c2 can.
    expect(resolveCardColor(items, resolveStates(items, ticked(['c1'])))).toBe(NEUTRAL_TOKEN);
    expect(resolveCardColor(items, resolveStates(items, ticked(['c2'])))).toBe(tokenForIndex(2));
  });

  it('reads as done when no items are active at all', () => {
    const items = makeItems(3).map((item) => ({ ...item, active: false }));
    expect(resolveCardColor(items, resolveStates(items, null))).toBe('done');
  });

  it('respects order, not array position', () => {
    const items: ChecklistItemDef[] = [
      { id: 'b', order: 2, label: 'Kedua', colorToken: 'step-2', active: true },
      { id: 'a', order: 1, label: 'Pertama', colorToken: 'step-1', active: true },
    ];
    expect(pendingItem(items, resolveStates(items, null))?.id).toBe('a');
    // Ticking the order-1 item colours by IT, even though it sits second in
    // the array.
    expect(resolveCardColor(items, resolveStates(items, ticked(['a'])))).toBe('step-1');
  });
});

describe('checklistProgress', () => {
  for (const n of [3, 7, 12]) {
    it(`renders exactly ${n} segments for ${n} active items`, () => {
      const items = makeItems(n);
      const progress = checklistProgress(items, resolveStates(items, ticked(['c1'])));
      expect(progress.total).toBe(n);
      expect(progress.segments).toHaveLength(n);
      expect(progress.doneCount).toBe(1);
      expect(progress.complete).toBe(false);
    });
  }

  it('names the pending item so colour is never the only signal', () => {
    const items = DEFAULT_CHECKLIST.map((item) => ({ ...item }));
    const progress = checklistProgress(items, resolveStates(items, ticked(['c1', 'c2'])));
    expect(progress.pendingLabel).toBe('Kirim ke Chief');
  });

  it('reports completion and drops the pending label when done', () => {
    const items = makeItems(4);
    const progress = checklistProgress(
      items,
      resolveStates(items, ticked(items.map((item) => item.id))),
    );
    expect(progress.complete).toBe(true);
    expect(progress.pendingLabel).toBeNull();
  });

  it('excludes disabled items from the strip', () => {
    const items = setChecklistItemActive(makeItems(6), 'c3', false);
    expect(checklistProgress(items, resolveStates(items, null)).total).toBe(5);
  });
});

describe('pendingFilters', () => {
  it('generates one chip per active item, whatever N is', () => {
    expect(pendingFilters(makeItems(12))).toHaveLength(12);
    expect(pendingFilters(makeItems(3))).toHaveLength(3);
  });

  it('labels chips from the item label', () => {
    const items = DEFAULT_CHECKLIST.map((item) => ({ ...item }));
    expect(pendingFilters(items)[4]?.label).toBe('Belum lapor dpjp');
  });
});

describe('checklist editors', () => {
  it('renaming keeps the id, so history is relabelled retroactively', () => {
    const items = renameChecklistItem(makeItems(3), 'c2', 'Update SOAP');
    expect(items[1]).toMatchObject({ id: 'c2', label: 'Update SOAP' });
    // A tick recorded under c2 still resolves after the rename.
    expect(resolveStates(items, ticked(['c2']))['c2']?.done).toBe(true);
  });

  it('adding an item assigns the next palette colour and wraps past 12', () => {
    const twelve = makeItems(12);
    const thirteen = addChecklistItem(twelve, 'c13', 'Langkah 13');
    expect(thirteen).toHaveLength(13);
    expect(thirteen[12]?.colorToken).toBe(tokenForIndex(13));
    expect(tokenForIndex(13)).toBe(tokenForIndex(1));
  });

  it('disables rather than deletes', () => {
    const items = setChecklistItemActive(makeItems(3), 'c2', false);
    expect(items).toHaveLength(3);
    expect(activeItems(items).map((item) => item.id)).toEqual(['c1', 'c3']);
  });

  it('reordering renumbers to a contiguous 1..N', () => {
    const moved = moveChecklistItem(makeItems(5), 'c5', 0);
    expect(moved.map((item) => item.id)).toEqual(['c5', 'c1', 'c2', 'c3', 'c4']);
    expect(moved.map((item) => item.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it('reordering changes the card colour immediately', () => {
    const items = makeItems(4);
    // One tick, so the card is in a coloured state at all; the colour must
    // then follow the NEW first-pending item after the reorder.
    const moved = moveChecklistItem(items, 'c3', 0);
    const before = resolveCardColor(items, resolveStates(items, ticked(['c1'])));
    const after = resolveCardColor(moved, resolveStates(moved, ticked(['c3'])));
    // Colour is the ticked item's own token, so it follows the item through
    // a reorder rather than following the position.
    expect(before).toBe(items[0]?.colorToken);
    expect(after).toBe(items[2]?.colorToken);
  });

  it('clamps an out-of-range move instead of dropping the item', () => {
    const moved = moveChecklistItem(makeItems(3), 'c1', 99);
    expect(moved.map((item) => item.id)).toEqual(['c2', 'c3', 'c1']);
  });

  it('recolouring touches only the target', () => {
    const items = recolorChecklistItem(makeItems(3), 'c2', 'step-9');
    expect(items.map((item) => item.colorToken)).toEqual([
      tokenForIndex(1),
      'step-9',
      tokenForIndex(3),
    ]);
  });

  it('normalizeOrders sorts by order, not by array position', () => {
    const scrambled: ChecklistItemDef[] = [
      { id: 'x', order: 9, label: 'X', colorToken: 'step-1', active: true },
      { id: 'y', order: 2, label: 'Y', colorToken: 'step-2', active: true },
    ];
    expect(normalizeOrders(scrambled).map((item) => item.id)).toEqual(['y', 'x']);
  });
});

describe('buildDoneMap', () => {
  const items = makeItems(4);

  it('covers every current definition', () => {
    const map = buildDoneMap(items, resolveStates(items, ticked(['c2'])));
    expect(Object.keys(map)).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(map['c2']).toBe(true);
    expect(map['c1']).toBe(false);
  });

  it('drops ticks belonging to definitions that no longer exist', () => {
    const map = buildDoneMap(items, resolveStates(items, ticked(['c1', 'c99'])));
    expect(map['c99']).toBeUndefined();
  });

  it('keeps disabled items so hiding one does not erase its history', () => {
    const withDisabled = setChecklistItemActive(items, 'c3', false);
    const map = buildDoneMap(withDisabled, resolveStates(withDisabled, ticked(['c3'])));
    expect(map['c3']).toBe(true);
  });

  it('applies the requested toggle', () => {
    const states = resolveStates(items, null);
    expect(buildDoneMap(items, states, 'c2', true)['c2']).toBe(true);
    expect(buildDoneMap(items, resolveStates(items, ticked(['c2'])), 'c2', false)['c2']).toBe(
      false,
    );
  });
});

describe('the shipped seed', () => {
  it('matches Appendix A exactly', () => {
    expect(DEFAULT_CHECKLIST).toHaveLength(7);
    expect(DEFAULT_CHECKLIST.map((item) => item.label)).toEqual([
      'Visite pasien + TTV + EKG sesuai kebutuhan',
      'Update SOAP',
      'Kirim ke Chief',
      'SOAP dikoreksi',
      'Lapor DPJP',
      'Input SIMGOS',
      'Plan & terapi dilaksanakan',
    ]);
  });

  it('uses stable literal ids so two offline devices cannot fork the seed', () => {
    expect(DEFAULT_CHECKLIST.map((item) => item.id)).toEqual([
      'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7',
    ]);
  });
});
