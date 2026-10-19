import { describe, expect, it } from 'vitest';

import { stampText } from './stamp';

describe('stampText', () => {
  const at = new Date(2026, 9, 9, 7, 5); // 9 Oct 2026, 07:05 local
  it('writes the date as dd/mm/yyyy', () => {
    expect(stampText(at, false)).toBe('09/10/2026');
  });
  it('adds the time as HH.mm', () => {
    expect(stampText(at, true)).toBe('09/10/2026 07.05');
  });
});
