import { describe, expect, it } from 'vitest';

import {
  formatShiftTime,
  hasShiftNotes,
  newShiftNoteId,
  renderShiftNotes,
  visibleShiftNotes,
} from './shiftNotes';
import type { ShiftNote } from './types';

function note(over: Partial<ShiftNote> = {}): ShiftNote {
  return {
    id: 'jaga-1',
    time: '21.40',
    body: 'Nyeri dada baru.',
    clearedAt: null,
    createdAt: null as never,
    ...over,
  };
}

describe('formatShiftTime', () => {
  it('uses a dot, because a colon is a heading delimiter', () => {
    expect(formatShiftTime(new Date(2026, 7, 29, 21, 40))).toBe('21.40');
  });

  it('pads both fields', () => {
    expect(formatShiftTime(new Date(2026, 7, 29, 9, 5))).toBe('09.05');
  });
});

describe('newShiftNoteId', () => {
  it('is unique against the existing notes', () => {
    const at = new Date(2026, 7, 29, 21, 40);
    const first = newShiftNoteId(at, []);
    const second = newShiftNoteId(at, [note({ id: first })]);
    expect(second).not.toBe(first);
  });

  it('does not depend on position in the array', () => {
    // The tick state in the copy sheet is keyed on this. An index-based key
    // would silently retarget when the list changes.
    const at = new Date(2026, 7, 29, 21, 40);
    expect(newShiftNoteId(at, [])).toBe(newShiftNoteId(at, []));
  });
});

describe('visibility', () => {
  it('hides cleared notes but keeps them in storage', () => {
    const notes = [note({ id: 'a' }), note({ id: 'b', clearedAt: {} as never })];
    expect(visibleShiftNotes(notes).map((n) => n.id)).toEqual(['a']);
    expect(notes).toHaveLength(2);
  });

  it('reads a missing field as none, never as a reason to write a default', () => {
    // Entries predating this field have no `shiftNotes`. Absence is not a
    // correction.
    expect(visibleShiftNotes(undefined)).toEqual([]);
    expect(hasShiftNotes(undefined)).toBe(false);
  });

  it('shows nothing when every note has been cleared', () => {
    expect(hasShiftNotes([note({ clearedAt: {} as never })])).toBe(false);
  });
});

describe('renderShiftNotes', () => {
  const notes = [
    note({ id: 'a', time: '14.05', body: 'Nyeri dada.' }),
    note({ id: 'b', time: '21.40', body: 'Sesak.' }),
  ];

  it('renders nothing when nothing is ticked', () => {
    // Opt-in. The morning note sent to the chief must not change shape
    // because a shift note was added to the same day hours later.
    expect(renderShiftNotes(notes, [])).toBe('');
  });

  it('renders only what was ticked', () => {
    expect(renderShiftNotes(notes, ['b'])).toBe('*SOAP Jaga 21.40*\nSesak.');
  });

  it('keeps stored order regardless of tick order', () => {
    expect(renderShiftNotes(notes, ['b', 'a'])).toBe(
      '*SOAP Jaga 14.05*\nNyeri dada.\n\n*SOAP Jaga 21.40*\nSesak.',
    );
  });

  it('skips an empty box rather than emitting an orphan heading', () => {
    const withBlank = [...notes, note({ id: 'c', time: '23.00', body: '   ' })];
    expect(renderShiftNotes(withBlank, ['c'])).toBe('');
  });

  it('never renders a cleared note even if its id is ticked', () => {
    const cleared = [note({ id: 'a', clearedAt: {} as never })];
    expect(renderShiftNotes(cleared, ['a'])).toBe('');
  });

  it('emits no colon in the stamp', () => {
    // Re-pasting copied text into a body must not create a section header.
    expect(renderShiftNotes(notes, ['a'])).not.toMatch(/Jaga \d+:/);
  });
});
