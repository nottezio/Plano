import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DENIED_RETRIES, retryDenied } from './floors.repo';

const denied = Object.assign(new Error('denied'), { code: 'permission-denied' });

describe('retryDenied (a new list stayed empty until a reload, 10 Nov 2026)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('attaches again after a refusal, and reports only when the tries run out', () => {
    const fails: Array<(e: Error) => void> = [];
    const onError = vi.fn();
    retryDenied((fail) => {
      fails.push(fail);
      return () => undefined;
    }, onError);
    for (let i = 0; i < DENIED_RETRIES; i += 1) {
      fails[i]!(denied);
      vi.runOnlyPendingTimers();
    }
    expect(fails).toHaveLength(DENIED_RETRIES + 1);
    expect(onError).not.toHaveBeenCalled();
    fails[DENIED_RETRIES]!(denied);
    expect(onError).toHaveBeenCalledWith(denied);
  });

  it('reports any other error at once, and stops retrying once unsubscribed', () => {
    const onError = vi.fn();
    retryDenied((fail) => {
      fail(new Error('unavailable'));
      return () => undefined;
    }, onError);
    expect(onError).toHaveBeenCalledTimes(1);

    const start = vi.fn((fail: (e: Error) => void) => {
      fail(denied);
      return () => undefined;
    });
    const off = retryDenied(start, onError);
    off();
    vi.runAllTimers();
    expect(start).toHaveBeenCalledTimes(1);
  });
});
