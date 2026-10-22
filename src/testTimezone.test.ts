import { describe, expect, it } from 'vitest';

/**
 * vitest.config.ts pins the test process to UTC so that a helper leaking the
 * host timezone fails here instead of passing on an Asia/Jakarta machine.
 * This guards that the pin actually applies, on every platform.
 */
describe('test timezone', () => {
  it('runs in UTC', () => {
    expect(process.env.TZ).toBe('UTC');
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(0);
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(0);
  });
});
