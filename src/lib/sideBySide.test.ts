import { describe, expect, it } from 'vitest';

import { sideBySide } from './sideBySide';

class Quota extends Error {}
const isQuota = (error: unknown): boolean => error instanceof Quota;
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('sideBySide', () => {
  it('runs both at the same time', async () => {
    const log: string[] = [];
    const call = (name: string) => async (): Promise<string> => {
      log.push(`start ${name}`);
      await wait(5);
      log.push(`end ${name}`);
      return name;
    };
    expect(await sideBySide(call('a'), call('b'), isQuota)).toEqual(['a', 'b']);
    // Both started before either ended: not one after the other.
    expect(log.slice(0, 2)).toEqual(['start a', 'start b']);
  });

  it('skips a missing document', async () => {
    expect(await sideBySide(null, async () => 'b', isQuota)).toEqual([null, 'b']);
  });

  it('retries a quota refusal once, after the other finished', async () => {
    let calls = 0;
    const second = async (): Promise<string> => {
      calls += 1;
      if (calls === 1) throw new Quota('429');
      return 'b';
    };
    expect(await sideBySide(async () => 'a', second, isQuota)).toEqual(['a', 'b']);
    expect(calls).toBe(2);
  });

  it('throws any other failure without retrying', async () => {
    let calls = 0;
    const broken = async (): Promise<string> => {
      calls += 1;
      throw new Error('400');
    };
    await expect(sideBySide(async () => 'a', broken, isQuota)).rejects.toThrow('400');
    expect(calls).toBe(1);
  });

  it('throws a second quota refusal instead of looping', async () => {
    await expect(
      sideBySide(async () => 'a', async () => Promise.reject(new Quota('429')), isQuota),
    ).rejects.toThrow('429');
  });
});
