import { describe, expect, it } from 'vitest';

import { checklistHaystack, doneFor, nextStep, statusOf } from './progress';
import type { SavedChecklist } from '@/domain/types';

const LIST: SavedChecklist = {
  id: 'pci',
  title: 'Persiapan PCI',
  context: 'Pasien poli',
  items: [
    { id: 'a', label: 'Informed consent' },
    { id: 'b', label: 'Loading DAPT' },
    { id: 'c', label: 'Cek fungsi ginjal' },
  ],
  done: ['a', 'gone'],
};

describe('doneFor', () => {
  it('reads the list’s own tick entry when there is one', () => {
    expect(doneFor(LIST, { pci: ['b'] })).toEqual(['b']);
  });

  it('falls back to ticks stored the old way, inside the list', () => {
    expect(doneFor(LIST, {})).toEqual(['a']);
    expect(doneFor(LIST, undefined)).toEqual(['a']);
  });

  it('ignores ticks for steps that no longer exist', () => {
    expect(doneFor(LIST, { pci: ['a', 'gone'] })).toEqual(['a']);
  });

  it('an empty entry means reset, not "fall back"', () => {
    expect(doneFor(LIST, { pci: [] })).toEqual([]);
  });
});

describe('statusOf / nextStep', () => {
  it('knows new, running and finished', () => {
    expect(statusOf(0, 3)).toBe('baru');
    expect(statusOf(1, 3)).toBe('berjalan');
    expect(statusOf(3, 3)).toBe('selesai');
  });

  it('points at the first unticked step, in list order', () => {
    expect(nextStep(LIST, ['a'])).toBe('b');
    expect(nextStep(LIST, ['b'])).toBe('a');
    expect(nextStep(LIST, ['a', 'b', 'c'])).toBeNull();
  });
});

describe('checklistHaystack', () => {
  it('searches the steps, not only the title', () => {
    expect(checklistHaystack(LIST)).toContain('loading dapt');
  });
});
