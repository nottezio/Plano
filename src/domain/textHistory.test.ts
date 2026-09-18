import { describe, expect, it } from 'vitest';

import {
  COALESCE_MS,
  HISTORY_CAP,
  canRedo,
  canUndo,
  initHistory,
  record,
  redo,
  undo,
  type TextHistory,
} from './textHistory';

const step = (value: string) => ({ value, selection: null });
const type = (history: TextHistory, value: string, at: number) =>
  record(history, step(value), 'type', at);

describe('recording', () => {
  it('starts with nothing to undo', () => {
    const history = initHistory('awal');
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it('coalesces a burst of typing into one step', () => {
    let history = initHistory('');
    history = type(history, 'S', 100);
    history = type(history, 'S:', 200);
    history = type(history, 'S: nyeri', 300);
    expect(history.past).toHaveLength(1);
    expect(undo(history)?.step.value).toBe('');
  });

  it('starts a new step after a pause', () => {
    let history = initHistory('');
    history = type(history, 'S: nyeri', 100);
    history = type(history, 'S: nyeri dada', 100 + COALESCE_MS + 1);
    expect(history.past).toHaveLength(2);
    expect(undo(history)?.step.value).toBe('S: nyeri');
  });

  it('never merges a transform into the typing around it', () => {
    let history = initHistory('catatan');
    history = type(history, 'catatan a', 100);
    history = record(history, step('CATATAN RAPI'), 'transform', 150);
    expect(undo(history)?.step.value).toBe('catatan a');
  });

  it('keeps a change that arrived from elsewhere as its own step', () => {
    let history = initHistory('milik saya');
    history = record(history, step('hasil gabung'), 'external', 100);
    expect(undo(history)?.step.value).toBe('milik saya');
  });

  it('ignores a recording that changes nothing', () => {
    const history = type(initHistory('sama'), 'sama', 100);
    expect(canUndo(history)).toBe(false);
  });

  it('caps the stack', () => {
    let history = initHistory('0');
    for (let index = 1; index <= HISTORY_CAP + 20; index += 1) {
      history = record(history, step(`v${index}`), 'transform', index * 10_000);
    }
    expect(history.past).toHaveLength(HISTORY_CAP);
  });
});

describe('undo and redo', () => {
  const built = (): TextHistory => {
    let history = initHistory('a');
    history = record(history, step('b'), 'transform', 100);
    return record(history, step('c'), 'transform', 200);
  };

  it('walks back and forward through the steps', () => {
    const first = undo(built());
    expect(first?.step.value).toBe('b');
    const second = undo(first!.history);
    expect(second?.step.value).toBe('a');
    expect(canUndo(second!.history)).toBe(false);

    const forward = redo(second!.history);
    expect(forward?.step.value).toBe('b');
    expect(redo(forward!.history)?.step.value).toBe('c');
  });

  it('returns null at each end rather than throwing', () => {
    expect(undo(initHistory('a'))).toBeNull();
    expect(redo(initHistory('a'))).toBeNull();
  });

  it('drops the redo path once a new edit is made', () => {
    const back = undo(built())!.history;
    expect(canRedo(back)).toBe(true);
    const edited = type(back, 'b baru', 300);
    expect(canRedo(edited)).toBe(false);
  });

  it('does not let the next keystroke merge into a restored step', () => {
    const back = undo(built())!.history;
    const typed = type(back, 'b2', 210);
    expect(undo(typed)?.step.value).toBe('b');
  });

  it('carries the caret with the step', () => {
    let history = initHistory('halo');
    history = record(history, { value: 'halo dunia', selection: { start: 10, end: 10 } }, 'type', 1);
    history = record(history, { value: 'halo dunia!', selection: { start: 11, end: 11 } }, 'transform', 5000);
    expect(undo(history)?.step.selection).toEqual({ start: 10, end: 10 });
  });
});
