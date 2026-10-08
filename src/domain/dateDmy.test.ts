import { describe, expect, it } from 'vitest';

import { formatDmy, parseDmy } from './dateDmy';

describe('formatDmy', () => {
  it('writes day first', () => {
    expect(formatDmy('2026-10-09')).toBe('09/10/2026');
    expect(formatDmy('')).toBe('');
    expect(formatDmy('9 Okt')).toBe('');
  });
});

describe('parseDmy', () => {
  it('reads day first in every common spelling', () => {
    expect(parseDmy('09/10/2026')).toBe('2026-10-09');
    expect(parseDmy('9/10/2026')).toBe('2026-10-09');
    expect(parseDmy('9-10-26')).toBe('2026-10-09');
    expect(parseDmy(' 9.10.2026 ')).toBe('2026-10-09');
    expect(parseDmy('9 10 2026')).toBe('2026-10-09');
  });

  it('never reads month first', () => {
    // 10/09 is 10 September, not October 9.
    expect(parseDmy('10/09/2026')).toBe('2026-09-10');
  });

  it('rejects dates that do not exist or are not dates', () => {
    expect(parseDmy('31/02/2026')).toBeNull();
    expect(parseDmy('13/13/2026')).toBeNull();
    expect(parseDmy('0/1/2026')).toBeNull();
    expect(parseDmy('besok')).toBeNull();
    expect(parseDmy('')).toBeNull();
  });
});
