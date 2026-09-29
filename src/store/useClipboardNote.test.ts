import { describe, expect, it } from 'vitest';

import { isMismatch, type CopiedNote } from './useClipboardNote';

const note = (patientId: string | null): CopiedNote => ({
  what: 'SOAP harian',
  patientId,
  patientName: 'Tn. Contoh',
  mrn: null,
  at: 0,
});

describe('the clipboard note', () => {
  it('warns only when a DIFFERENT patient is open', () => {
    expect(isMismatch(note('a'), 'b')).toBe(true);
    expect(isMismatch(note('a'), 'a')).toBe(false);
    expect(isMismatch(note('a'), null)).toBe(false);
    expect(isMismatch(null, 'a')).toBe(false);
  });
});
