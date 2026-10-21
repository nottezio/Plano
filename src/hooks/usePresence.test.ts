import { describe, expect, it } from 'vitest';

import { presenceDue } from './usePresence';

describe('presenceDue (22 Oct 2026: heartbeat only while typing)', () => {
  const now = 1_000_000;
  it('is not due when the user never typed', () => {
    expect(presenceDue(now, 0, true)).toBe(false);
  });
  it('is due within a minute of the last edit, while visible', () => {
    expect(presenceDue(now, now - 20_000, true)).toBe(true);
    expect(presenceDue(now, now - 20_000, false)).toBe(false);
  });
  it('stops a minute after the last edit', () => {
    expect(presenceDue(now, now - 61_000, true)).toBe(false);
  });
});
